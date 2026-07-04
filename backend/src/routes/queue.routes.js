const router = require('express').Router();
const Joi = require('joi');
const queueController = require('../controllers/queue.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validator');

// Schema for queue creation
const createQueueSchema = Joi.object({
  projectId: Joi.string().uuid().required(),
  name: Joi.string().max(100).required(),
  description: Joi.string().allow('').optional(),
  maxRetries: Joi.number().integer().min(0).max(10).default(3),
  retryBackoff: Joi.string().valid('fixed', 'exponential').default('exponential'),
  rateLimit: Joi.number().integer().min(1).optional(),
  timeout: Joi.number().integer().min(1000).optional(), // ms
  concurrency: Joi.number().integer().min(1).default(1),
});

// all routes need authentication
router.use(authenticate);

router.post('/', validate(createQueueSchema), queueController.create);
router.get('/', queueController.getAll);
router.get('/project/:projectId', queueController.getByProjectId);
router.get('/:id', queueController.getById);
router.put('/:id', queueController.update);
router.delete('/:id', queueController.delete);

// queue actions
router.post('/:id/pause', queueController.pause);
router.post('/:id/resume', queueController.resume);
router.get('/:id/stats', queueController.getStats);

module.exports = router;
