const cronParser = require('cron-parser');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const jobService = require('./job.service');

class SchedulerService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Check every second for jobs that are due
    this.intervalId = setInterval(() => this.tick(), 1000);
    logger.info('Scheduler service started');
  }

  stop() {
    if (!this.isRunning) return;
    clearInterval(this.intervalId);
    this.isRunning = false;
    logger.info('Scheduler service stopped');
  }

  async tick() {
    // We use a simple advisory lock to ensure only one instance of the scheduler runs this
    // (useful if we scale the backend to multiple instances)
    const client = await pool.connect();
    try {
      const lockResult = await client.query('SELECT pg_try_advisory_lock(999) as locked');
      if (!lockResult.rows[0].locked) {
        return; // Another instance is running the scheduler
      }

      await client.query('BEGIN');

      // 1. Find scheduled jobs that are due
      // 2. Move them to the jobs table (queued)
      
      const now = new Date();
      
      // We assume jobs table has a scheduled_at column
      // This is a bit simplified for the sake of completion.
      const result = await client.query(`
        UPDATE jobs
        SET status = 'queued', updated_at = NOW()
        WHERE status = 'scheduled' AND scheduled_at <= $1
        RETURNING id
      `, [now]);

      if (result.rowCount > 0) {
        logger.debug(`Scheduler moved ${result.rowCount} scheduled jobs to queued status`);
      }

      // TODO: Handle recurring cron jobs from scheduled_jobs table

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Error in scheduler tick:', err);
    } finally {
      // Release lock
      try {
        await client.query('SELECT pg_advisory_unlock(999)');
      } catch (e) {
        // ignore
      }
      client.release();
    }
  }
}

module.exports = new SchedulerService();
