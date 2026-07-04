const { ForbiddenError } = require('../utils/errors');

/**
 * Role-based access control middleware factory.
 * 
 * Usage: router.get('/admin', authenticate, requireRole('admin'), handler)
 * 
 * @param  {...string} roles - list of allowed roles
 * @returns {Function} Express middleware
 */
function requireRole(...roles) {
  return (req, res, next) => {
    // make sure authenticate middleware ran first
    if (!req.user) {
      return next(new ForbiddenError('User information not available'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Role '${req.user.role}' is not authorized. Required: ${roles.join(', ')}`
        )
      );
    }

    next();
  };
}

module.exports = { requireRole };
