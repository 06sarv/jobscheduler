const router = require('express').Router();
const orgController = require('../controllers/organization.controller');
const { authenticate } = require('../middleware/auth');

// All org routes require authentication
router.use(authenticate);

// Organization CRUD
router.post('/', orgController.create);
router.get('/', orgController.getAll);
router.get('/:id', orgController.getById);

// Member management
router.post('/:id/members', orgController.addMember);
router.delete('/:id/members/:userId', orgController.removeMember);

module.exports = router;
