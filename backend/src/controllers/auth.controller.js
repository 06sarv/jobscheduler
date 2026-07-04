const authService = require('../services/auth.service');
const logger = require('../utils/logger');

// Auth controller - handles registration, login, token refresh, and profile

/**
 * Register a new user account
 */
const register = async (req, res, next) => {
  try {
    const user = await authService.register(req.body);

    logger.info(`New user registered: ${user.email}`);

    return res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log in with email + password, get back tokens
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    logger.info(`User logged in: ${email}`);

    return res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Refresh an expired access token using the refresh token
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshToken(refreshToken);

    return res.status(200).json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    next(error);
  }
};

// Get the currently authenticated user's profile
const getMe = async (req, res, next) => {
  try {
    const user = await authService.getUserById(req.user.id);

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  getMe,
};
