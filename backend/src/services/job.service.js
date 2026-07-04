const { query } = require('../config/database');
const logger = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');
const { JOB_STATES } = require('../constants/jobStates');
const jobQueries = require('../db/queries/jobs.queries');
const { getIO } = require('../config/socket');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/env');
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: config.ai.geminiApiKey });

/*
  Job service - the big one.
  
  Handles creating, querying, cancelling, retrying jobs.
  Also deals with batch creation which is kinda tricky with multi-row inserts.
*/

// helper to safely emit socket events without crashing if socket isn't set up
function emitEvent(event, data) {
  try {
    const io = getIO();
    io.emit(event, data);
  } catch (err) {
    // socket might not be initialized yet, that's ok
    logger.warn(`Failed to emit socket event '${event}': ${err.message}`);
  }
}

/**
 * Create a single job and add it to a queue.
 */
async function create(jobData, userId) {
  const {
    queue_id,
    type,
    payload,
    priority,
    scheduled_at,
    cron_expression,
    max_retries,
  } = jobData;

  // figure out the initial status
  const status = scheduled_at ? JOB_STATES.SCHEDULED : JOB_STATES.QUEUED;

  const result = await query(
    `INSERT INTO jobs (queue_id, type, payload, priority, status, scheduled_at, cron_expression, max_retries, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [queue_id, type, JSON.stringify(payload), priority || 0, status, scheduled_at || null, cron_expression || null, max_retries, userId]
  );

  const job = result.rows[0];
  logger.info(`Job created: ${job.id} (type: ${job.type}, queue: ${job.queue_id})`);

  emitEvent('job:created', job);

  return job;
}

/**
 * Create multiple jobs at once. Uses a multi-row insert for efficiency.
 * This was a pain to get right ngl
 */
async function createBatch(jobs, userId) {
  if (!jobs || jobs.length === 0) {
    return [];
  }

  // build the multi-row values clause
  const valuePlaceholders = [];
  const allValues = [];
  let paramIdx = 1;

  for (const jobData of jobs) {
    const status = jobData.scheduled_at ? JOB_STATES.SCHEDULED : JOB_STATES.QUEUED;
    
    valuePlaceholders.push(
      `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7}, $${paramIdx + 8})`
    );
    
    allValues.push(
      jobData.queue_id,
      jobData.type,
      JSON.stringify(jobData.payload),
      jobData.priority || 0,
      status,
      jobData.scheduled_at || null,
      jobData.cron_expression || null,
      jobData.max_retries || null,
      userId
    );
    
    paramIdx += 9;
  }

  const result = await query(
    `INSERT INTO jobs (queue_id, type, payload, priority, status, scheduled_at, cron_expression, max_retries, created_by)
     VALUES ${valuePlaceholders.join(', ')}
     RETURNING *`,
    allValues
  );

  const createdJobs = result.rows;
  logger.info(`Batch created: ${createdJobs.length} jobs`);

  emitEvent('jobs:batchCreated', { count: createdJobs.length, jobs: createdJobs });

  return createdJobs;
}

/**
 * Find a job by ID, including its execution history and latest logs.
 */
async function findById(jobId) {
  // get the job itself
  const jobResult = await query(
    'SELECT * FROM jobs WHERE id = $1',
    [jobId]
  );

  if (jobResult.rows.length === 0) {
    throw new NotFoundError(`Job with id ${jobId} not found`);
  }

  const job = jobResult.rows[0];

  // grab executions
  const execResult = await query(
    `SELECT * FROM job_executions 
     WHERE job_id = $1 
     ORDER BY started_at DESC`,
    [jobId]
  );

  // and the latest logs (limit to last 50 to keep response size reasonable)
  const logsResult = await query(
    `SELECT * FROM job_logs 
     WHERE job_id = $1 
     ORDER BY created_at DESC 
     LIMIT 50`,
    [jobId]
  );

  return {
    ...job,
    executions: execResult.rows,
    logs: logsResult.rows,
  };
}

/**
 * Find jobs for a specific queue with pagination, filtering, and sorting.
 * 
 * TODO: might want to add full-text search on job type/payload later
 */
async function findByQueueId(queueId, options = {}) {
  const {
    page = 1,
    limit = 20,
    status,
    type,
    sort = 'created_at',
    order = 'DESC',
  } = options;

  const offset = (page - 1) * limit;

  // build WHERE conditions
  let conditions = [];
  let params = [];
  let paramIdx = 1;

  if (queueId && queueId !== 'all') {
    conditions.push(`queue_id = $${paramIdx}`);
    params.push(queueId);
    paramIdx++;
  }

  if (status) {
    conditions.push(`status = $${paramIdx}`);
    params.push(status);
    paramIdx++;
  }

  if (type) {
    conditions.push(`type = $${paramIdx}`);
    params.push(type);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

  // whitelist sort columns to prevent SQL injection
  const allowedSorts = ['created_at', 'updated_at', 'priority', 'type', 'status', 'scheduled_at'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // get total count
  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM jobs WHERE ${whereClause}`,
    params
  );
  const total = countResult.rows[0].total;

  // get the actual jobs
  const jobsResult = await query(
    `SELECT * FROM jobs 
     WHERE ${whereClause} 
     ORDER BY ${sortCol} ${sortOrder}
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  return {
    jobs: jobsResult.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Cancel a running or queued job.
 */
async function cancel(jobId) {
  const result = await query(
    `UPDATE jobs 
     SET status = $1, updated_at = NOW() 
     WHERE id = $2 AND status IN ($3, $4, $5)
     RETURNING *`,
    [JOB_STATES.CANCELLED, jobId, JOB_STATES.QUEUED, JOB_STATES.SCHEDULED, JOB_STATES.RUNNING]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError(`Job ${jobId} not found or cannot be cancelled in its current state`);
  }

  const job = result.rows[0];
  logger.info(`Job cancelled: ${jobId}`);
  emitEvent('job:cancelled', job);

  return job;
}

/**
 * Retry a failed/dead job - resets it back to queued with incremented retry count.
 */
async function retry(jobId) {
  const result = await query(
    `UPDATE jobs 
     SET status = $1, 
         retry_count = retry_count + 1, 
         updated_at = NOW(),
         error_message = NULL
     WHERE id = $2 AND status IN ($3, $4)
     RETURNING *`,
    [JOB_STATES.QUEUED, jobId, JOB_STATES.FAILED, JOB_STATES.DEAD]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError(`Job ${jobId} not found or cannot be retried in its current state`);
  }

  const job = result.rows[0];
  logger.info(`Job retried: ${jobId}, retry count: ${job.retry_count}`);
  emitEvent('job:retried', job);

  return job;
}

/**
 * Get execution logs for a specific execution of a job.
 */
async function getExecutionLogs(jobId, executionId) {
  const result = await query(
    `SELECT * FROM job_logs 
     WHERE job_id = $1 AND execution_id = $2 
     ORDER BY created_at ASC`,
    [jobId, executionId]
  );

  return result.rows;
}

/**
 * Generate an AI summary for a failed job using Gemini.
 */
async function getAiSummary(jobId) {
  // get the job and its latest execution error
  const jobResult = await query('SELECT * FROM jobs WHERE id = $1', [jobId]);

  if (jobResult.rows.length === 0) {
    throw new NotFoundError(`Job ${jobId} not found`);
  }

  const job = jobResult.rows[0];

  if (job.status !== JOB_STATES.FAILED && job.status !== JOB_STATES.DEAD) {
    return { summary: 'Job has not failed. No AI analysis needed.' };
  }

  const execResult = await query(
    `SELECT error_message FROM job_executions 
     WHERE job_id = $1 
     ORDER BY started_at DESC LIMIT 1`,
    [jobId]
  );

  const errorMessage = execResult.rows[0]?.error_message || 'Unknown error';

  const prompt = `Analyze the following failed job execution and provide a concise, actionable summary explaining what likely went wrong and how to fix it. Keep it under 3 sentences.
  
Job ID: ${job.id}
Job Type: ${job.type}
Payload: ${JSON.stringify(job.payload)}
Error Message: ${errorMessage}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return { summary: response.text };
  } catch (error) {
    logger.error(`Failed to generate AI summary for job ${jobId}: ${error.message}`);
    return { summary: 'Failed to generate AI summary. Please check the raw execution logs.' };
  }
}

module.exports = {
  create,
  createBatch,
  findById,
  findByQueueId,
  cancel,
  retry,
  getExecutionLogs,
  getAiSummary,
};
