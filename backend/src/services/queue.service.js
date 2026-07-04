const { query } = require('../config/database');
const logger = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');
const queueQueries = require('../db/queries/queues.queries');

/*
 * Queue service
 * 
 * Manages job queues - creation, updates, pausing/resuming, stats, etc.
 * Each queue belongs to a project and can have its own retry policy.
 */

// Create a new queue
async function create(queueData) {
  const { name, project_id, description, max_concurrency, retry_policy_id } = queueData;

  const result = await query(
    `INSERT INTO queues (name, project_id, description, max_concurrency, retry_policy_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, project_id, description, max_concurrency || 5, retry_policy_id]
  );

  logger.info(`Queue created: ${result.rows[0].name} (id: ${result.rows[0].id})`);
  return result.rows[0];
}

// Find queue by ID, joined with its retry policy
async function findById(queueId) {
  const result = await query(
    `SELECT q.*, 
            rp.strategy AS retry_strategy,
            rp.max_retries AS retry_max_retries,
            rp.initial_delay AS retry_initial_delay,
            rp.max_delay AS retry_max_delay,
            rp.multiplier AS retry_multiplier
     FROM queues q
     LEFT JOIN retry_policies rp ON q.retry_policy_id = rp.id
     WHERE q.id = $1`,
    [queueId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError(`Queue with id ${queueId} not found`);
  }

  return result.rows[0];
}

// Get all queues for a given project
async function findByProjectId(projectId) {
  const result = await query(
    `SELECT * FROM queues WHERE project_id = $1 ORDER BY created_at DESC`,
    [projectId]
  );

  return result.rows;
}

// Get all queues with stats (used for main Queues list)
async function findAll() {
  const result = await query(`
    SELECT q.*, p.name as project_name,
           (SELECT COUNT(*) FROM jobs j WHERE j.queue_id = q.id AND j.status IN ('queued', 'scheduled'))::int as queued_jobs,
           (SELECT COUNT(*) FROM jobs j WHERE j.queue_id = q.id AND j.status = 'running')::int as active_jobs
    FROM queues q
    LEFT JOIN projects p ON q.project_id = p.id
    ORDER BY q.created_at DESC
  `);
  
  return result.rows.map(q => ({
    id: q.id,
    name: q.name,
    project: q.project_name || 'Default Project',
    status: q.status,
    priority: q.priority || 0,
    concurrencyLimit: q.max_concurrency || 5,
    activeJobs: q.active_jobs || 0,
    queuedJobs: q.queued_jobs || 0
  }));
}

// Update a queue's properties
async function update(queueId, updateData) {
  // build the SET clause dynamically based on what fields are provided
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = ['name', 'description', 'max_concurrency', 'retry_policy_id', 'status'];

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      fields.push(`${field} = $${paramIndex}`);
      values.push(updateData[field]);
      paramIndex++;
    }
  }

  if (fields.length === 0) {
    // nothing to update, just return the existing queue
    return findById(queueId);
  }

  // always update the updated_at timestamp
  fields.push(`updated_at = NOW()`);

  values.push(queueId);
  const result = await query(
    `UPDATE queues SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw new NotFoundError(`Queue with id ${queueId} not found`);
  }

  return result.rows[0];
}

// Pause a queue - stops new jobs from being picked up
async function pause(queueId) {
  const updated = await update(queueId, { status: 'paused' });
  logger.info(`Queue paused: ${queueId}`);
  return updated;
}

// Resume a paused queue
async function resume(queueId) {
  const updated = await update(queueId, { status: 'active' });
  logger.info(`Queue resumed: ${queueId}`);
  return updated;
}

/**
 * Get stats for a queue - job counts per status and overall queue depth.
 * Queue depth = number of jobs waiting to be processed (queued + scheduled).
 */
async function getStats(queueId) {
  // make sure the queue exists first
  await findById(queueId);

  const result = await query(
    `SELECT 
       status,
       COUNT(*)::int AS count
     FROM jobs 
     WHERE queue_id = $1
     GROUP BY status`,
    [queueId]
  );

  // build a nice stats object
  const statusCounts = {};
  let totalJobs = 0;

  for (const row of result.rows) {
    statusCounts[row.status] = row.count;
    totalJobs += row.count;
  }

  // queue depth is jobs that are waiting to run
  const queueDepth = (statusCounts['queued'] || 0) + (statusCounts['scheduled'] || 0);

  return {
    queueId,
    totalJobs,
    queueDepth,
    statusCounts,
  };
}

// Delete a queue (should probably check for active jobs first... TODO)
async function deleteQueue(queueId) {
  const result = await query(
    'DELETE FROM queues WHERE id = $1 RETURNING id',
    [queueId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError(`Queue with id ${queueId} not found`);
  }

  logger.info(`Queue deleted: ${queueId}`);
  return { deleted: true, id: queueId };
}

module.exports = {
  create,
  findById,
  findByProjectId,
  findAll,
  update,
  pause,
  resume,
  getStats,
  delete: deleteQueue,
};
