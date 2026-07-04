const router = require('express').Router();
const workerController = require('../controllers/worker.controller');
const { authenticate } = require('../middleware/auth');

// Workers are read-only from the API side - they register themselves
router.use(authenticate);

router.get('/', workerController.getAll);
router.get('/:id', workerController.getById);
router.get('/:id/heartbeats', workerController.getHeartbeats);

module.exports = router;
