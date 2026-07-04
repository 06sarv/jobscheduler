const router = require('express').Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth');

// Dashboard/metrics routes
// These power the frontend dashboard with aggregated data
router.use(authenticate);

router.get('/health', dashboardController.getHealth);
router.get('/throughput', dashboardController.getThroughput);
router.get('/queue-stats', dashboardController.getQueueStats);
router.get('/worker-stats', dashboardController.getWorkerStats);

module.exports = router;
