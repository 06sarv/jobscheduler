const logger = require('./logger');

/**
 * Middleware to check for idempotency key in request headers.
 * 
 * Right now this just grabs the key and attaches it to the request.
 * The actual deduplication logic will come later.
 */
function checkIdempotency(req, res, next) {
  const idempotencyKey = req.headers['x-idempotency-key'];

  if (idempotencyKey) {
    req.idempotencyKey = idempotencyKey;
    logger.debug(`Idempotency key received: ${idempotencyKey}`);

    // TODO: implement actual caching and deduplication
    // the plan is to store the key + response in redis or postgres
    // and return the cached response if we've seen this key before.
    // for now we just pass through
  }

  next();
}

module.exports = {
  checkIdempotency
};
