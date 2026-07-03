/**
 * jobs.queries.js
 * Query builders for the jobs table and related tables.
 *
 * Each function returns a { text, values } object that you can pass
 * directly to pool.query() or client.query().
 */

// Simple lookup by ID
function findById(jobId) {
  return {
    text: 'SELECT * FROM jobs WHERE id = $1',
    values: [jobId],
  };
}

/**
 * Find jobs by queue with pagination, filtering, and sorting.
 * This one's a bit involved because of all the optional params.
 */
function findByQueueId(queueId, options = {}) {
  const {
    page = 1,
    limit = 20,
    status = null,
    type = null,
    sortBy = 'created_at',
    sortOrder = 'DESC',
  } = options;

  // start building the query
  const conditions = ['queue_id = $1'];
  const values = [queueId];
  let paramIndex = 2;

  // optional status filter
  if (status) {
    conditions.push(`status = $${paramIndex}`);
    values.push(status);
    paramIndex++;
  }

  // optional type filter
  if (type) {
    conditions.push(`type = $${paramIndex}`);
    values.push(type);
    paramIndex++;
  }

  // whitelist sortable columns to prevent SQL injection
  const allowedSortColumns = ['created_at', 'updated_at', 'priority', 'status', 'type'];
  const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const offset = (page - 1) * limit;

  // add pagination params
  values.push(limit);
  const limitParam = `$${paramIndex}`;
  paramIndex++;

  values.push(offset);
  const offsetParam = `$${paramIndex}`;

  const text = `
    SELECT * FROM jobs
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${safeSortBy} ${safeSortOrder}
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  return { text, values };
}

// Create a single job
function create(jobData) {
  const {
    queue_id,
    idempotency_key = null,
    type,
    payload,
    priority = 0,
    max_retries = 3,
    scheduled_at = null,
    created_by = null,
  } = jobData;

  // If there's a scheduled_at, set status to 'scheduled' instead of 'queued'
  const status = scheduled_at ? 'scheduled' : 'queued';

  return {
    text: `
      INSERT INTO jobs (queue_id, idempotency_key, type, payload, status, priority, max_retries, scheduled_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    values: [queue_id, idempotency_key, type, payload, status, priority, max_retries, scheduled_at, created_by],
  };
}

/**
 * Batch insert multiple jobs at once.
 * Generates a multi-row INSERT statement.
 *
 * TODO: should probably cap the batch size at some reasonable limit
 */
function createBatch(jobs) {
  if (!jobs || jobs.length === 0) {
    throw new Error('createBatch requires at least one job');
  }

  const columns = '(queue_id, idempotency_key, type, payload, status, priority, max_retries, scheduled_at, created_by)';
  const values = [];
  const placeholders = [];

  jobs.forEach((job, i) => {
    const offset = i * 9; // 9 fields per job
    const status = job.scheduled_at ? 'scheduled' : 'queued';

    placeholders.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`
    );

    values.push(
      job.queue_id,
      job.idempotency_key || null,
      job.type,
      job.payload,
      status,
      job.priority || 0,
      job.max_retries || 3,
      job.scheduled_at || null,
      job.created_by || null
    );
  });

  return {
    text: `INSERT INTO jobs ${columns} VALUES ${placeholders.join(', ')} RETURNING *`,
    values,
  };
}

/**
 * Update a job's status and optionally set extra fields.
 * The extraFields param lets you set things like started_at, completed_at, etc.
 */
function updateStatus(jobId, status, extraFields = {}) {
  const setClauses = ['status = $2', 'updated_at = NOW()'];
  const values = [jobId, status];
  let paramIndex = 3;

  // dynamically add any extra fields
  // we whitelist the allowed fields to be safe
  const allowedExtras = ['started_at', 'completed_at', 'retry_count', 'error_message'];

  for (const [key, value] of Object.entries(extraFields)) {
    if (allowedExtras.includes(key)) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  return {
    text: `UPDATE jobs SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    values,
  };
}

/**
 * Claim the next available job from one or more queues.
 *
 * This uses FOR UPDATE SKIP LOCKED which is the key to making
 * concurrent workers play nice. Without SKIP LOCKED, workers would
 * block each other trying to claim the same job.
 *
 * The subquery finds the highest-priority, oldest job that's ready
 * to run, locks it, and the outer UPDATE marks it as claimed.
 */
function claimNextJob(queueIds, workerId) {
  return {
    text: `
      UPDATE jobs SET status = 'claimed', started_at = NOW(), updated_at = NOW()
      WHERE id = (
        SELECT id FROM jobs
        WHERE queue_id = ANY($1)
          AND status = 'queued'
          AND (scheduled_at IS NULL OR scheduled_at <= NOW())
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `,
    values: [queueIds],
  };
}

// Get all execution attempts for a job
function getExecutions(jobId) {
  return {
    text: `
      SELECT * FROM job_executions
      WHERE job_id = $1
      ORDER BY attempt_number ASC
    `,
    values: [jobId],
  };
}

// Get logs, optionally filtered by execution
function getLogs(jobId, executionId = null) {
  if (executionId) {
    return {
      text: `
        SELECT * FROM job_logs
        WHERE job_id = $1 AND execution_id = $2
        ORDER BY timestamp ASC
      `,
      values: [jobId, executionId],
    };
  }

  // no execution filter, just get all logs for the job
  return {
    text: `
      SELECT * FROM job_logs
      WHERE job_id = $1
      ORDER BY timestamp ASC
    `,
    values: [jobId],
  };
}

/**
 * Get a count of jobs grouped by status for a given queue.
 * Handy for dashboard stats.
 */
function countByStatus(queueId) {
  return {
    text: `
      SELECT status, COUNT(*)::int AS count
      FROM jobs
      WHERE queue_id = $1
      GROUP BY status
    `,
    values: [queueId],
  };
}

module.exports = {
  findById,
  findByQueueId,
  create,
  createBatch,
  updateStatus,
  claimNextJob,
  getExecutions,
  getLogs,
  countByStatus,
};
