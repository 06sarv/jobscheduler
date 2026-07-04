const router = require('express').Router();
const Joi = require('joi');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const { authLimiter } = require('../middleware/rateLimiter');

// --- Validation schemas ---

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  fullName: Joi.string().max(100).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// --- Routes ---

// public routes (rate limited to prevent brute force)
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);

// protected route - need a valid token
router.get('/me', authenticate, authController.getMe);

module.exports = router;
