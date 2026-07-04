const jobService = require('../services/job.service');
const logger = require('../utils/logger');

/*
  Job controller
  Jobs are the actual units of work that get pushed to queues
  and picked up by workers.
*/

const create = async (req, res, next) => {
  try {
    const job = await jobService.create({
      ...req.body,
      createdBy: req.user.id,
    });

    logger.info(`Job created: ${job.id} in queue ${job.queueId}`);

    return res.status(201).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

// Submit multiple jobs at once - useful for bulk ingestion
const createBatch = async (req, res, next) => {
  try {
    const { jobs } = req.body;

    const result = await jobService.createBatch(
      jobs.map((j) => ({ ...j, createdBy: req.user.id }))
    );

    logger.info(`Batch created: ${result.length} jobs`);

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const job = await jobService.getById(req.params.id);

    return res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

// get jobs by queue with pagination support
const getByQueue = async (req, res, next) => {
  try {
    const { queueId } = req.params;
    const pagination = req.pagination; // set by parsePagination middleware

    const result = await jobService.getByQueue(queueId, pagination);

    return res.status(200).json({
      success: true,
      data: result.jobs,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

const cancel = async (req, res, next) => {
  try {
    const job = await jobService.cancel(req.params.id);

    logger.info(`Job cancelled: ${req.params.id}`);

    return res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

// retry a failed job - puts it back in the queue
const retry = async (req, res, next) => {
  try {
    const job = await jobService.retry(req.params.id);

    logger.info(`Job retried: ${req.params.id}`);

    return res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get execution logs for a specific execution of a job.
 * Each job can have multiple executions (e.g. after retries).
 */
const getExecutionLogs = async (req, res, next) => {
  try {
    const { id, executionId } = req.params;

    const logs = await jobService.getExecutionLogs(id, executionId);

    return res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};

const getAiSummary = async (req, res, next) => {
  try {
    const aiSummary = await jobService.getAiSummary(req.params.id);

    return res.status(200).json({
      success: true,
      data: aiSummary,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  createBatch,
  getById,
  getByQueue,
  cancel,
  retry,
  getExecutionLogs,
  getAiSummary,
};
