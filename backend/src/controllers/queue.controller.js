const queueService = require('../services/queue.service');
const logger = require('../utils/logger');

// Queue controller - wraps queueService calls
// Queues hold jobs and define processing behavior (retries, concurrency, etc.)

const create = async (req, res, next) => {
  try {
    const queue = await queueService.create({
      ...req.body,
      createdBy: req.user.id,
    });

    logger.info(`Queue created: ${queue.name}`);

    return res.status(201).json({
      success: true,
      data: queue,
    });
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const queue = await queueService.getById(req.params.id);

    return res.status(200).json({
      success: true,
      data: queue,
    });
  } catch (error) {
    next(error);
  }
};

// get all queues for a given project
const getByProjectId = async (req, res, next) => {
  try {
    const queues = await queueService.getByProjectId(req.params.projectId);

    return res.status(200).json({
      success: true,
      data: queues,
    });
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const queues = await queueService.findAll();

    return res.status(200).json({
      success: true,
      data: queues,
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const queue = await queueService.update(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      data: queue,
    });
  } catch (error) {
    next(error);
  }
};

// pause a queue - stops it from processing new jobs
const pause = async (req, res, next) => {
  try {
    const queue = await queueService.pause(req.params.id);

    logger.info(`Queue paused: ${req.params.id}`);

    return res.status(200).json({
      success: true,
      data: queue,
    });
  } catch (error) {
    next(error);
  }
};

const resume = async (req, res, next) => {
  try {
    const queue = await queueService.resume(req.params.id);

    logger.info(`Queue resumed: ${req.params.id}`);

    return res.status(200).json({
      success: true,
      data: queue,
    });
  } catch (error) {
    next(error);
  }
};

/** Get stats for a specific queue (pending, active, failed counts etc.) */
const getStats = async (req, res, next) => {
  try {
    const stats = await queueService.getStats(req.params.id);

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// TODO: should we do a soft delete instead? might want to keep history
const deleteQueue = async (req, res, next) => {
  try {
    await queueService.delete(req.params.id);

    logger.info(`Queue deleted: ${req.params.id}`);

    return res.status(200).json({
      success: true,
      message: 'Queue deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getById,
  getByProjectId,
  getAll,
  update,
  pause,
  resume,
  getStats,
  delete: deleteQueue,
};
