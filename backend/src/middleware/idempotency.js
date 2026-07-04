const checkIdempotency = (req, res, next) => {
  const idempotencyKey = req.header('X-Idempotency-Key');
  if (idempotencyKey) {
    req.idempotencyKey = idempotencyKey;
  }
  next();
};

module.exports = { checkIdempotency };
