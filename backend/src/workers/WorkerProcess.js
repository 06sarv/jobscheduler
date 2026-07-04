const config = require('../config/env');
const logger = require('../utils/logger');
const workerService = require('../services/worker.service');
const JobExecutor = require('./JobExecutor');
const HeartbeatEmitter = require('./HeartbeatEmitter');

/*
 * WorkerProcess
 *
 * This is the main worker that polls for jobs and executes them.
 * It manages its own concurrency, heartbeat, and shutdown logic.
 *
 * Usage:
 *   const worker = new WorkerProcess({ name: 'my-worker', concurrency: 5 });
 *   await worker.start();
 */
class WorkerProcess {
  constructor(options = {}) {
    this.name = options.name || `worker-${process.pid}`;
    this.queueIds = options.queueIds || [];
    this.concurrency = options.concurrency || (config.worker && config.worker.concurrency) || 3;
    this.pollInterval = options.pollInterval || (config.worker && config.worker.pollInterval) || 1000;
    this.heartbeatInterval = options.heartbeatInterval || (config.worker && config.worker.heartbeatInterval) || 30000;

    this.workerId = null;
    this.isRunning = false;
    this.activeJobs = 0;
    this.pollTimer = null;
    this.heartbeatEmitter = null;
    this.jobExecutor = new JobExecutor();

    // Track total jobs processed for logging
    this.totalProcessed = 0;
    this.totalFailed = 0;

    // flag to know if we're in the middle of shutting down
    this._shuttingDown = false;
  }

  /**
   * Start the worker - registers with the system, begins polling and heartbeat
   */
  async start() {
    if (this.isRunning) {
      logger.warn(`Worker ${this.name} is already running`);
      return;
    }

    logger.info(`Starting worker "${this.name}" with concurrency=${this.concurrency}`);

    try {
      // Register this worker in the database
      const registration = await workerService.register({
        name: this.name,
        queueIds: this.queueIds,
        concurrency: this.concurrency,
        hostname: require('os').hostname(),
        pid: process.pid,
      });

      this.workerId = registration.id;
      this.isRunning = true;

      logger.info(`Worker registered with id: ${this.workerId}`);

      // Fire up the heartbeat
      this.heartbeatEmitter = new HeartbeatEmitter(this.workerId, this.heartbeatInterval);
      this.heartbeatEmitter.start();

      // Set up signal handlers for clean shutdown
      this.setupGracefulShutdown();

      // Start the polling loop
      this._schedulePoll();

      logger.info(`Worker "${this.name}" is now running and polling for jobs`);
    } catch (err) {
      logger.error(`Failed to start worker "${this.name}": ${err.message}`, {
        stack: err.stack,
      });
      throw err;
    }
  }

  /**
   * Stop the worker gracefully
   */
  async stop() {
    if (!this.isRunning && !this._shuttingDown) {
      logger.info(`Worker "${this.name}" is not running`);
      return;
    }

    // prevent double-shutdown
    if (this._shuttingDown) return;
    this._shuttingDown = true;

    logger.info(`Stopping worker "${this.name}"...`);

    // Stop accepting new jobs
    this.isRunning = false;

    // Stop the poll timer
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Stop heartbeat
    if (this.heartbeatEmitter) {
      this.heartbeatEmitter.stop();
      this.heartbeatEmitter = null;
    }

    // Wait for any active jobs to wrap up
    if (this.activeJobs > 0) {
      logger.info(`Waiting for ${this.activeJobs} active job(s) to finish...`);
      await this._waitForActiveJobs();
    }

    // Deregister from the system
    if (this.workerId) {
      try {
        await workerService.deregister(this.workerId);
        logger.info(`Worker ${this.workerId} deregistered`);
      } catch (err) {
        // not much we can do here, just log it
        logger.error(`Error deregistering worker: ${err.message}`);
      }
    }

    logger.info(`Worker "${this.name}" stopped. Processed ${this.totalProcessed} jobs (${this.totalFailed} failed)`);
  }

  /**
   * Poll for available jobs and execute them
   * Uses a semaphore-like pattern - only grabs new work if under concurrency limit
   */
  async poll() {
    if (!this.isRunning) return;

    try {
      // Only try to claim a job if we have capacity
      if (this.activeJobs >= this.concurrency) {
        // at capacity, skip this poll cycle
        return;
      }

      // figure out how many slots we have open
      const availableSlots = this.concurrency - this.activeJobs;

      // try to claim jobs for each available slot
      // TODO: maybe batch this into a single query that claims multiple jobs?
      for (let i = 0; i < availableSlots; i++) {
        if (!this.isRunning) break; // check again in case we got a stop signal

        try {
          const job = await workerService.claimNextJob(this.workerId, this.queueIds);

          if (!job) {
            // no more jobs available right now
            break;
          }

          logger.info(`Claimed job ${job.id} (type: ${job.type || 'default'})`, {
            workerId: this.workerId,
            activeJobs: this.activeJobs + 1,
          });

          // Fire and forget - executeJob handles its own errors
          // (we don't await here so we can claim multiple jobs in one poll cycle)
          this.executeJob(job);
        } catch (claimErr) {
          // could be a race condition where another worker got it first, thats ok
          logger.debug(`Failed to claim job: ${claimErr.message}`);
          break;
        }
      }
    } catch (err) {
      logger.error(`Error during poll: ${err.message}`, { stack: err.stack });
    }
  }

  /**
   * Execute a single job, managing the activeJobs counter
   */
  async executeJob(job) {
    this.activeJobs++;

    // keep heartbeat in sync
    if (this.heartbeatEmitter) {
      this.heartbeatEmitter.setActiveJobs(this.activeJobs);
    }

    try {
      const result = await this.jobExecutor.execute(job, this.workerId);

      this.totalProcessed++;
      if (!result.success) {
        this.totalFailed++;
      }
    } catch (err) {
      // executor should handle its own errors, but just in case...
      logger.error(`Unhandled error in job execution for ${job.id}: ${err.message}`);
      this.totalProcessed++;
      this.totalFailed++;
    } finally {
      this.activeJobs--;

      // sync heartbeat again
      if (this.heartbeatEmitter) {
        this.heartbeatEmitter.setActiveJobs(this.activeJobs);
      }
    }
  }

  /**
   * Schedule the next poll using setTimeout.
   * Using setTimeout instead of setInterval prevents overlapping polls.
   */
  _schedulePoll() {
    if (!this.isRunning) return;

    this.pollTimer = setTimeout(async () => {
      await this.poll();
      // schedule the next one after this poll finishes
      this._schedulePoll();
    }, this.pollInterval);

    // Don't let the poll timer keep the process alive during shutdown
    if (this.pollTimer.unref) {
      this.pollTimer.unref();
    }
  }

  /**
   * Wait for all active jobs to complete (up to a timeout)
   */
  _waitForActiveJobs(timeoutMs = 30000) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const check = () => {
        if (this.activeJobs <= 0) {
          resolve();
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          logger.warn(`Timed out waiting for ${this.activeJobs} active jobs to finish`);
          resolve(); // resolve anyway, we tried
          return;
        }

        // check again in a bit
        setTimeout(check, 500);
      };

      check();
    });
  }

  /**
   * Set up handlers for graceful shutdown on process signals
   */
  setupGracefulShutdown() {
    const handleSignal = async (signal) => {
      logger.info(`Worker "${this.name}" received ${signal}`);
      await this.stop();
      // don't call process.exit here - let the main process handle that
    };

    process.on('SIGTERM', () => handleSignal('SIGTERM'));
    process.on('SIGINT', () => handleSignal('SIGINT'));
  }
}

module.exports = WorkerProcess;
