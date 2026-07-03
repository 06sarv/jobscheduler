/**
 * queues.queries.js
 * Query builders for the queues table.
 * Returns { text, values } objects for pg parameterized queries.
 */

function findById(queueId) {
  return {
    text: 'SELECT * FROM queues WHERE id = $1',
    values: [queueId],
  };
}

function findByProjectId(projectId) {
  return {
    text: `
      SELECT * FROM queues
      WHERE project_id = $1
      ORDER BY priority DESC, name ASC
    `,
    values: [projectId],
  };
}

// create a new queue
function create(queueData) {
  const {
    project_id,
    name,
    priority = 0,
    concurrency_limit = 5,
    retry_policy_id = null,
    max_queue_size = 10000,
    tags = [],
  } = queueData;

  return {
    text: `
      INSERT INTO queues (project_id, name, priority, concurrency_limit, retry_policy_id, max_queue_size, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    values: [project_id, name, priority, concurrency_limit, retry_policy_id, max_queue_size, JSON.stringify(tags)],
  };
}

/**
 * Update a queue's settings.
 * Only updates the fields that are actually provided.
 * 
 * TODO: there's gotta be a cleaner way to do dynamic updates...
 */
function update(queueId, updateData) {
  const allowedFields = ['name', 'priority', 'concurrency_limit', 'retry_policy_id', 'max_queue_size', 'tags'];
  const setClauses = ['updated_at = NOW()'];
  const values = [queueId];
  let paramIndex = 2;

  for (const [key, value] of Object.entries(updateData)) {
    if (allowedFields.includes(key)) {
      setClauses.push(`${key} = $${paramIndex}`);
      // tags needs to be stringified since it's JSONB
      values.push(key === 'tags' ? JSON.stringify(value) : value);
      paramIndex++;
    }
  }

  return {
    text: `UPDATE queues SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    values,
  };
}

// update just the status (active, paused, draining, etc)
function updateStatus(queueId, status) {
  return {
    text: `
      UPDATE queues
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    values: [queueId, status],
  };
}

/**
 * Get job counts grouped by status for a specific queue.
 * This powers the queue stats on the dashboard.
 */
function getStats(queueId) {
  return {
    text: `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'queued')::int AS queued,
        COUNT(*) FILTER (WHERE status = 'running')::int AS running,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COUNT(*) FILTER (WHERE status = 'dead')::int AS dead
      FROM jobs
      WHERE queue_id = $1
    `,
    values: [queueId],
  };
}

// just the number of queued jobs - useful for quick checks
function getDepth(queueId) {
  return {
    text: `
      SELECT COUNT(*)::int AS depth
      FROM jobs
      WHERE queue_id = $1 AND status = 'queued'
    `,
    values: [queueId],
  };
}

module.exports = {
  findById,
  findByProjectId,
  create,
  update,
  updateStatus,
  getStats,
  getDepth,
};
