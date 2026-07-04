const metricsService = require('../services/metrics.service');
const logger = require('../utils/logger');

// Dashboard controller
// Provides aggregated metrics and health info for the dashboard UI

const getHealth = async (req, res, next) => {
  try {
    const health = await metricsService.getHealth();

    return res.status(200).json({
      success: true,
      data: health,
    });
  } catch (error) {
    next(error);
  }
};

// throughput = jobs processed over time
const getThroughput = async (req, res, next) => {
  try {
    const throughput = await metricsService.getThroughput(req.query);

    return res.status(200).json({
      success: true,
      data: throughput,
    });
  } catch (error) {
    next(error);
  }
};

/** per-queue stats like pending/active/failed counts */
const getQueueStats = async (req, res, next) => {
  try {
    const stats = await metricsService.getQueueStats();

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// worker-level stats - active workers, utilization, etc
const getWorkerStats = async (req, res, next) => {
  try {
    const stats = await metricsService.getWorkerStats();

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHealth,
  getThroughput,
  getQueueStats,
  getWorkerStats,
};
