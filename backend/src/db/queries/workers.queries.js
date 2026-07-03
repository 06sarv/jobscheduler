/**
 * workers.queries.js
 * Query builders for the workers and worker_heartbeats tables.
 * 
 * Each function returns { text, values } for use with pg.
 */

// Register a new worker
function register(workerData) {
  const {
    name,
    queue_ids,
    concurrency = 3,
    hostname = null,
    pid = null,
    metadata = {},
  } = workerData;

  return {
    text: `
      INSERT INTO workers (name, queue_ids, concurrency, hostname, pid, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    values: [name, queue_ids, concurrency, hostname, pid, JSON.stringify(metadata)],
  };
}

// Bump the heartbeat timestamp so we know the worker is still alive
function updateHeartbeat(workerId) {
  return {
    text: `
      UPDATE workers
      SET last_heartbeat_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    values: [workerId],
  };
}

/**
 * Update worker status and current load.
 * Called when a worker picks up or finishes a job.
 */
function updateStatus(workerId, status, currentLoad = null) {
  // if currentLoad is provided, update that too
  if (currentLoad !== null) {
    return {
      text: `
        UPDATE workers
        SET status = $2, current_load = $3, last_heartbeat_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      values: [workerId, status, currentLoad],
    };
  }

  return {
    text: `
      UPDATE workers
      SET status = $2, last_heartbeat_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    values: [workerId, status],
  };
}

/**
 * Find all workers that are still considered "active".
 * A worker is active if:
 *  - it's not marked as offline
 *  - its last heartbeat was within the last 2 minutes
 * 
 * If a worker hasn't sent a heartbeat in 2+ minutes, we assume it's dead
 * even if its status says otherwise. The reaper process handles cleanup.
 */
function findActive() {
  return {
    text: `
      SELECT * FROM workers
      WHERE status != 'offline'
        AND last_heartbeat_at > NOW() - INTERVAL '2 minutes'
      ORDER BY current_load ASC
    `,
    values: [],
  };
}

function findById(workerId) {
  return {
    text: 'SELECT * FROM workers WHERE id = $1',
    values: [workerId],
  };
}

// get recent heartbeat snapshots for a worker
function getHeartbeatHistory(workerId, limit = 50) {
  return {
    text: `
      SELECT * FROM worker_heartbeats
      WHERE worker_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `,
    values: [workerId, limit],
  };
}

/*
 * Record a heartbeat with resource usage stats.
 * This goes into the worker_heartbeats table (separate from just
 * updating last_heartbeat_at on the worker itself).
 */
function recordHeartbeat(heartbeatData) {
  const {
    worker_id,
    cpu_usage = null,
    memory_usage = null,
    active_jobs = null,
  } = heartbeatData;

  return {
    text: `
      INSERT INTO worker_heartbeats (worker_id, cpu_usage, memory_usage, active_jobs)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    values: [worker_id, cpu_usage, memory_usage, active_jobs],
  };
}

module.exports = {
  register,
  updateHeartbeat,
  updateStatus,
  findActive,
  findById,
  getHeartbeatHistory,
  recordHeartbeat,
};
