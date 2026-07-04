const { query } = require('../config/database');
const logger = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');
const { JOB_STATES } = require('../constants/jobStates');

/**
 * Worker service
 * 
 * Manages worker nodes - registration, heartbeats, stale detection.
 * Workers are the things that actually execute jobs.
 * 
 * Each worker sends periodic heartbeats so we know it's alive.
 * If a worker goes silent for too long, we mark it as offline and
 * fail any jobs it was supposedly running.
 */

const STALE_THRESHOLD_MINUTES = 2; // how long before we consider a worker dead

/**
 * Register a new worker node.
 */
async function register(workerData) {
  const { hostname, pid, concurrency, queues } = workerData;

  const result = await query(
    `INSERT INTO workers (hostname, pid, concurrency, queues, status, last_heartbeat_at)
     VALUES ($1, $2, $3, $4, 'online', NOW())
     RETURNING *`,
    [hostname, pid, concurrency || 1, JSON.stringify(queues || [])]
  );

  const worker = result.rows[0];
  logger.info(`Worker registered: ${worker.id} (${worker.hostname}, pid: ${worker.pid})`);

  return worker;
}

/**
 * Deregister a worker - mark it as offline.
 * Called when a worker shuts down gracefully.
 */
async function deregister(workerId) {
  const result = await query(
    `UPDATE workers 
     SET status = 'offline', updated_at = NOW() 
     WHERE id = $1 
     RETURNING *`,
    [workerId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError(`Worker ${workerId} not found`);
  }

  logger.info(`Worker deregistered: ${workerId}`);
  return result.rows[0];
}

/**
 * Process a heartbeat from a worker.
 * Updates the worker's last_heartbeat_at and stores the metrics snapshot.
 */
async function heartbeat(workerId, metrics = {}) {
  // update the worker record
  const workerResult = await query(
    `UPDATE workers 
     SET last_heartbeat_at = NOW(), 
         current_load = $1,
         updated_at = NOW()
     WHERE id = $2 AND status != 'offline'
     RETURNING *`,
    [metrics.current_load || 0, workerId]
  );

  if (workerResult.rows.length === 0) {
    throw new NotFoundError(`Worker ${workerId} not found or is offline`);
  }

  // also store the heartbeat data for history
  await query(
    `INSERT INTO worker_heartbeats (worker_id, cpu_usage, memory_usage, active_jobs, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      workerId,
      metrics.cpu_usage || 0,
      metrics.memory_usage || 0,
      metrics.active_jobs || 0,
      JSON.stringify(metrics.metadata || {}),
    ]
  );

  return workerResult.rows[0];
}

/**
 * Get all workers that are currently active.
 * "Active" means they're not offline AND they've sent a heartbeat recently.
 */
async function getActiveWorkers() {
  const result = await query(
    `SELECT * FROM workers 
     WHERE status != 'offline' 
       AND last_heartbeat_at > NOW() - INTERVAL '${STALE_THRESHOLD_MINUTES} minutes'
     ORDER BY hostname ASC`
  );

  return result.rows;
}

// Get a single worker by ID, plus their recent heartbeat history
async function getWorkerById(workerId) {
  const workerResult = await query(
    'SELECT * FROM workers WHERE id = $1',
    [workerId]
  );

  if (workerResult.rows.length === 0) {
    throw new NotFoundError(`Worker ${workerId} not found`);
  }

  const worker = workerResult.rows[0];

  // grab the last 20 heartbeats for the history chart
  const heartbeatResult = await query(
    `SELECT * FROM worker_heartbeats 
     WHERE worker_id = $1 
     ORDER BY created_at DESC 
     LIMIT 20`,
    [workerId]
  );

  return {
    ...worker,
    heartbeatHistory: heartbeatResult.rows,
  };
}

/**
 * Detect workers that haven't sent a heartbeat in a while.
 * Marks them as offline and fails any jobs they were running.
 * 
 * This gets called periodically (probably from the scheduler).
 * TODO: maybe send an alert/notification when workers go stale?
 */
async function detectStaleWorkers() {
  // find stale workers
  const staleResult = await query(
    `SELECT * FROM workers 
     WHERE status != 'offline' 
       AND last_heartbeat_at < NOW() - INTERVAL '${STALE_THRESHOLD_MINUTES} minutes'`
  );

  const staleWorkers = staleResult.rows;

  if (staleWorkers.length === 0) {
    return { markedOffline: 0, failedJobs: 0 };
  }

  const staleIds = staleWorkers.map(w => w.id);
  logger.warn(`Detected ${staleWorkers.length} stale worker(s): ${staleIds.join(', ')}`);

  // mark them all as offline
  await query(
    `UPDATE workers 
     SET status = 'offline', updated_at = NOW() 
     WHERE id = ANY($1::uuid[])`,
    [staleIds]
  );

  // fail any jobs that were assigned to these workers and still "running"
  const failedJobsResult = await query(
    `UPDATE jobs 
     SET status = $1, 
         error_message = 'Worker went offline unexpectedly',
         updated_at = NOW()
     WHERE worker_id = ANY($2::uuid[]) 
       AND status = $3
     RETURNING id`,
    [JOB_STATES.FAILED, staleIds, JOB_STATES.RUNNING]
  );

  const failedCount = failedJobsResult.rows.length;
  if (failedCount > 0) {
    logger.warn(`Failed ${failedCount} jobs from stale workers`);
  }

  return {
    markedOffline: staleWorkers.length,
    failedJobs: failedCount,
  };
}

module.exports = {
  register,
  deregister,
  heartbeat,
  getActiveWorkers,
  getWorkerById,
  detectStaleWorkers,
};
