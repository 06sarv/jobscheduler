const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { UnauthorizedError } = require('../utils/errors');

/**
 * Authentication middleware.
 * 
 * Expects a Bearer token in the Authorization header.
 * Decodes the JWT and sticks the user info on req.user.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('No authentication token provided'));
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return next(new UnauthorizedError('Malformed authorization header'));
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);

    // attach user data to request object
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token has expired'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid token'));
    }
    // some other jwt error we didn't expect
    return next(new UnauthorizedError('Authentication failed'));
  }
}

module.exports = { authenticate };
