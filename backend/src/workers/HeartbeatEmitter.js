const logger = require('../utils/logger');
const workerService = require('../services/worker.service');

/**
 * HeartbeatEmitter
 *
 * Sends periodic heartbeats so the system knows this worker is alive.
 * Reports CPU usage, memory usage, and current load.
 */
class HeartbeatEmitter {
  constructor(workerId, interval) {
    this.workerId = workerId;
    this.interval = interval || 30000;
    this.timer = null;
    this.activeJobs = 0; // updated externally by WorkerProcess

    // Keep track of last CPU reading to compute a delta
    this._lastCpuUsage = process.cpuUsage();
    this._lastCpuTime = Date.now();
  }

  /**
   * Start sending heartbeats on the configured interval
   */
  start() {
    if (this.timer) {
      logger.warn('HeartbeatEmitter already running, skipping start');
      return;
    }

    logger.info(`Starting heartbeat emitter for worker ${this.workerId} (interval: ${this.interval}ms)`);

    // Send one right away so the system knows we're alive immediately
    this.sendHeartbeat().catch((err) => {
      logger.error(`Initial heartbeat failed: ${err.message}`);
    });

    this.timer = setInterval(() => {
      this.sendHeartbeat().catch((err) => {
        logger.error(`Heartbeat failed: ${err.message}`);
      });
    }, this.interval);

    // don't let the heartbeat timer keep the process alive
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Stop the heartbeat loop
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info(`Heartbeat emitter stopped for worker ${this.workerId}`);
    }
  }

  /**
   * Send a single heartbeat with current metrics
   */
  async sendHeartbeat() {
    const cpuUsage = this._getCpuPercent();
    const memUsage = this._getMemoryPercent();

    const metrics = {
      cpuUsage: parseFloat(cpuUsage.toFixed(2)),
      memoryUsage: parseFloat(memUsage.toFixed(2)),
      activeJobs: this.activeJobs,
      uptime: process.uptime(),
    };

    await workerService.heartbeat(this.workerId, metrics);

    logger.debug('Heartbeat sent', {
      workerId: this.workerId,
      ...metrics,
    });
  }

  /**
   * Update the number of active jobs (called by WorkerProcess)
   */
  setActiveJobs(count) {
    this.activeJobs = count;
  }

  // Calculate CPU usage as a percentage since last check
  // This is a rough estimate - process.cpuUsage gives microseconds of CPU time
  _getCpuPercent() {
    const currentCpu = process.cpuUsage(this._lastCpuUsage);
    const currentTime = Date.now();
    const elapsedMs = currentTime - this._lastCpuTime;

    // avoid division by zero
    if (elapsedMs <= 0) return 0;

    // cpuUsage gives us microseconds, convert to milliseconds
    const totalCpuMs = (currentCpu.user + currentCpu.system) / 1000;
    const cpuPercent = (totalCpuMs / elapsedMs) * 100;

    // reset for next measurement
    this._lastCpuUsage = process.cpuUsage();
    this._lastCpuTime = currentTime;

    // clamp to 0-100 just in case
    return Math.min(Math.max(cpuPercent, 0), 100);
  }

  // Get heap memory usage as a percentage
  _getMemoryPercent() {
    const mem = process.memoryUsage();
    if (mem.heapTotal === 0) return 0;
    return (mem.heapUsed / mem.heapTotal) * 100;
  }
}

module.exports = HeartbeatEmitter;
