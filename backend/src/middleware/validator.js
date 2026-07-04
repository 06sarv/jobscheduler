const { ValidationError } = require('../utils/errors');

/**
 * Factory function that creates validation middleware.
 * 
 * @param {import('joi').Schema} schema - Joi schema to validate against
 * @param {string} property - which part of the request to validate (body, query, params)
 * @returns {Function} Express middleware
 */
function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,       // collect all errors, not just the first one
      stripUnknown: true,      // remove unknown fields
      allowUnknown: false
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.context?.key || detail.path.join('.'),
        message: detail.message,
        type: detail.type
      }));

      return next(new ValidationError('Request validation failed', details));
    }

    // replace with the validated (and possibly coerced) values
    req[property] = value;
    next();
  };
}

module.exports = { validate };
