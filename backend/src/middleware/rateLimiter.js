const rateLimit = require('express-rate-limit');

// shared config for the rate limit response
const standardHeaders = true; // return rate limit info in headers
const legacyHeaders = false;  // disable X-RateLimit-* headers

/*
 * General rate limiter - applies to most endpoints.
 * 100 requests per 15 minute window.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
  standardHeaders,
  legacyHeaders,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  }
});

/*
 * Auth rate limiter - for login and registration routes.
 * Much stricter to prevent brute force attacks.
 * 10 requests per 15 minutes.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders,
  legacyHeaders,
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts, please try again later',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  }
});

/*
 * Heavy operations rate limiter - for batch operations and expensive queries.
 * 20 requests per 15 minutes.
 */
const heavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders,
  legacyHeaders,
  message: {
    success: false,
    error: {
      message: 'Too many requests for this resource, please try again later',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  heavyLimiter
};
