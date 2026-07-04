const router = require('express').Router();
const Joi = require('joi');
const jobController = require('../controllers/job.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const { parsePagination } = require('../middleware/pagination');
const { heavyLimiter } = require('../middleware/rateLimiter');
const { checkIdempotency } = require('../middleware/idempotency');

// -- Schemas --

const createJobSchema = Joi.object({
  queueId: Joi.string().uuid().required(),
  payload: Joi.object().required(),
  priority: Joi.number().integer().min(0).max(10).default(5),
  scheduledAt: Joi.date().iso().optional(),
  maxRetries: Joi.number().integer().min(0).optional(),
});

const batchJobSchema = Joi.object({
  jobs: Joi.array()
    .items(
      Joi.object({
        queueId: Joi.string().uuid().required(),
        payload: Joi.object().required(),
        priority: Joi.number().integer().min(0).max(10).default(5),
      })
    )
    .min(1)
    .max(100) // limit batch size to keep things sane
    .required(),
});

// authenticate everything
router.use(authenticate);

// create a single job (with idempotency support)
router.post('/', checkIdempotency, validate(createJobSchema), jobController.create);

// batch job creation - rate limited since it's heavier
router.post('/batch', heavyLimiter, validate(batchJobSchema), jobController.createBatch);

// list jobs for a queue (paginated)
router.get('/queue/:queueId', parsePagination, jobController.getByQueue);

// single job operations
router.get('/:id', jobController.getById);
router.post('/:id/cancel', jobController.cancel);
router.post('/:id/retry', jobController.retry);

// execution logs for a specific execution of a job
// TODO: might want to add filtering by log level here at some point
router.get('/:id/executions/:executionId/logs', jobController.getExecutionLogs);

// get AI generated summary for a failed job
router.get('/:id/ai-summary', jobController.getAiSummary);

module.exports = router;
