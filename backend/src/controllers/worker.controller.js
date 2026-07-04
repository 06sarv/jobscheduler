const workerService = require('../services/worker.service');
const logger = require('../utils/logger');

// Worker controller
// Workers are the processes that actually execute jobs from queues

const getAll = async (req, res, next) => {
  try {
    const workers = await workerService.getAll();

    return res.status(200).json({
      success: true,
      data: workers,
    });
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const worker = await workerService.getById(req.params.id);

    return res.status(200).json({
      success: true,
      data: worker,
    });
  } catch (error) {
    next(error);
  }
};

// get heartbeat history for a worker
// TODO: add pagination here too eventually
const getHeartbeats = async (req, res, next) => {
  try {
    const heartbeats = await workerService.getHeartbeats(req.params.id);

    return res.status(200).json({
      success: true,
      data: heartbeats,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  getHeartbeats,
};
