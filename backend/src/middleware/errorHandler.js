const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Global error handling middleware.
 * This should be the last middleware registered on the app.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // log it first
  if (err.isOperational) {
    // our custom errors - expected, not a bug
    logger.warn(`${err.code || 'ERROR'}: ${err.message}`);
  } else {
    // unexpected errors - these are bugs we need to fix
    logger.error('Unhandled error:', err);
  }

  // handle our custom AppError instances
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
        details: err.details || null
      }
    });
  }

  // Joi validation errors (from validate middleware or direct use)
  if (err.isJoi || err.name === 'ValidationError') {
    const details = err.details?.map((d) => ({
      field: d.context?.key,
      message: d.message
    })) || null;

    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details
      }
    });
  }

  // postgres unique violation (error code 23505)
  if (err.code === '23505') {
    // try to extract which field caused the conflict
    const detail = err.detail || 'A record with this value already exists';
    return res.status(409).json({
      success: false,
      error: {
        message: 'Duplicate entry',
        code: 'CONFLICT',
        details: detail
      }
    });
  }

  // if we get here, it's something we didn't anticipate
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(500).json({
    success: false,
    error: {
      message: isProduction ? 'Internal server error' : err.message,
      code: 'INTERNAL_ERROR',
      // don't leak the stack trace or error details in production!
      details: isProduction ? null : err.stack
    }
  });
}

module.exports = { errorHandler };
