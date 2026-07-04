const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { JOB_STATES } = require('../constants/jobStates');

// try to get socket, but don't blow up if it's not ready
let getIO;
try {
  ({ getIO } = require('../config/socket'));
} catch (err) {
  getIO = () => null;
}

/**
 * JobExecutor - handles actually running a job once it's been claimed.
 * Right now we simulate work with random delays, but eventually this
 * would call out to real task handlers.
 */
class JobExecutor {
  constructor() {
    // could add plugin support here later
    this.executionTimeout = 60000; // 1 minute max per job for now
  }

  /**
   * Execute a job and handle all the bookkeeping around it
   * @param {Object} job - the job row from the DB
   * @param {string} workerId - UUID of the worker running this
   * @returns {Object} execution result
   */
  async execute(job, workerId) {
    const executionId = uuidv4();
    const startTime = Date.now();

    logger.info(`Starting execution of job ${job.id}`, {
      jobId: job.id,
      executionId,
      workerId,
      jobType: job.type,
    });

    try {
      // Step 1: create the execution record
      await query(
        `INSERT INTO job_executions (id, job_id, worker_id, status, started_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [executionId, job.id, workerId, 'running']
      );

      await this._insertLog(job.id, executionId, 'info', 'Job execution started');

      // Step 2: mark the job as running
      await query(
        `UPDATE jobs SET status = $1, started_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [JOB_STATES.RUNNING, job.id]
      );

      // emit real-time update
      this._emitStatusUpdate(job.id, JOB_STATES.RUNNING, workerId);

      await this._insertLog(job.id, executionId, 'info', 'Job status set to running');

      // Step 3: do the actual work (simulated for now)
      // TODO: replace this with real task handlers / plugin system
      const result = await this._simulateWork(job);

      const duration = Date.now() - startTime;

      if (result.success) {
        // --- success path ---
        await query(
          `UPDATE job_executions
           SET status = 'completed', completed_at = NOW(), result = $1, duration_ms = $2
           WHERE id = $3`,
          [JSON.stringify(result.data), duration, executionId]
        );

        await query(
          `UPDATE jobs SET status = $1, completed_at = NOW(), result = $2, updated_at = NOW()
           WHERE id = $3`,
          [JOB_STATES.COMPLETED, JSON.stringify(result.data), job.id]
        );

        await this._insertLog(job.id, executionId, 'info',
          `Job completed successfully in ${duration}ms`);

        this._emitStatusUpdate(job.id, JOB_STATES.COMPLETED, workerId, result.data);

        logger.info(`Job ${job.id} completed in ${duration}ms`, {
          jobId: job.id,
          executionId,
          duration,
        });

        return {
          success: true,
          executionId,
          duration,
          data: result.data,
        };
      } else {
        // --- failure path ---
        const error = result.error || 'Unknown error during execution';

        await query(
          `UPDATE job_executions
           SET status = 'failed', completed_at = NOW(), error = $1, duration_ms = $2
           WHERE id = $3`,
          [error, duration, executionId]
        );

        await this._insertLog(job.id, executionId, 'error', `Job failed: ${error}`);

        // Let the retry service figure out what to do next
        // (it'll either re-queue or mark as permanently failed)
        try {
          const retryService = require('../services/retry.service');
          await retryService.handleFailure(job, new Error(error));
        } catch (retryErr) {
          // if retry service isn't available or errors out, just mark failed
          logger.warn(`Retry handling failed for job ${job.id}, marking as failed`, {
            error: retryErr.message,
          });
          await query(
            `UPDATE jobs SET status = $1, error = $2, updated_at = NOW() WHERE id = $3`,
            [JOB_STATES.FAILED, error, job.id]
          );
        }

        this._emitStatusUpdate(job.id, JOB_STATES.FAILED, workerId, null, error);

        logger.error(`Job ${job.id} failed after ${duration}ms: ${error}`, {
          jobId: job.id,
          executionId,
          duration,
        });

        return {
          success: false,
          executionId,
          duration,
          error,
        };
      }
    } catch (err) {
      // something went really wrong (DB error, etc)
      const duration = Date.now() - startTime;
      logger.error(`Unexpected error executing job ${job.id}: ${err.message}`, {
        jobId: job.id,
        executionId,
        stack: err.stack,
      });

      // try to update the execution record, but don't throw if that fails too
      try {
        await query(
          `UPDATE job_executions
           SET status = 'failed', completed_at = NOW(), error = $1, duration_ms = $2
           WHERE id = $3`,
          [err.message, duration, executionId]
        );
        await query(
          `UPDATE jobs SET status = $1, error = $2, updated_at = NOW() WHERE id = $3`,
          [JOB_STATES.FAILED, err.message, job.id]
        );
      } catch (updateErr) {
        logger.error(`Failed to update job status after error: ${updateErr.message}`);
      }

      this._emitStatusUpdate(job.id, JOB_STATES.FAILED, workerId, null, err.message);

      return {
        success: false,
        executionId,
        duration,
        error: err.message,
      };
    }
  }

  /**
   * Simulate doing some actual work.
   * 80% chance of success, 20% chance of failure.
   * Random delay between 1 and 5 seconds.
   *
   * TODO: this is obviously temporary - need to build out real executors
   */
  async _simulateWork(job) {
    const delay = Math.floor(Math.random() * 4000) + 1000; // 1-5s

    await new Promise((resolve) => setTimeout(resolve, delay));

    const roll = Math.random();
    if (roll < 0.8) {
      return {
        success: true,
        data: {
          message: 'Job processed successfully',
          processedAt: new Date().toISOString(),
          simulatedDelay: delay,
          jobType: job.type || 'default',
        },
      };
    } else {
      // pick a random-ish error
      const errors = [
        'Simulated timeout error',
        'Simulated processing failure',
        'Simulated resource unavailable',
        'Simulated validation error',
      ];
      return {
        success: false,
        error: errors[Math.floor(Math.random() * errors.length)],
      };
    }
  }

  // Insert a log entry for a job execution
  async _insertLog(jobId, executionId, level, message) {
    try {
      await query(
        `INSERT INTO job_logs (id, job_id, execution_id, level, message, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [uuidv4(), jobId, executionId, level, message]
      );
    } catch (err) {
      // logging failures shouldn't kill the job
      logger.warn(`Failed to insert job log: ${err.message}`);
    }
  }

  // Emit a socket event for real-time job status updates
  _emitStatusUpdate(jobId, status, workerId, data = null, error = null) {
    try {
      const io = getIO();
      if (io) {
        io.emit('job:status', {
          jobId,
          status,
          workerId,
          data,
          error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      // socket not available, that's fine
      // this happens during tests or if socket isn't initialized yet
    }
  }
}

module.exports = JobExecutor;
