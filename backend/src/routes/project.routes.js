const router = require('express').Router();
const Joi = require('joi');
const projectController = require('../controllers/project.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validator');

// validation schema for creating a project
const createProjectSchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  name: Joi.string().max(100).required(),
  description: Joi.string().allow('').optional(),
});

// everything here needs auth
router.use(authenticate);

router.post('/', validate(createProjectSchema), projectController.create);
router.get('/org/:orgId', projectController.getByOrgId);
router.get('/:id', projectController.getById);
router.put('/:id', projectController.update);
router.delete('/:id', projectController.delete);

module.exports = router;
