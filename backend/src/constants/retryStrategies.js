// Retry strategies for failed jobs
const RETRY_STRATEGIES = {
  FIXED: 'fixed',
  LINEAR: 'linear',
  EXPONENTIAL: 'exponential'
};

/**
 * Calculate the delay before the next retry attempt.
 * 
 * @param {string} strategy - one of the RETRY_STRATEGIES values
 * @param {number} attempt - which attempt this is (1-based)
 * @param {number} initialDelay - base delay in ms (default 1000)
 * @param {number} maxDelay - cap on the delay in ms (default 5 min)
 * @param {number} multiplier - for exponential strategy (default 2)
 * @returns {number} delay in milliseconds
 */
function calculateDelay(
  strategy,
  attempt,
  initialDelay = 1000,
  maxDelay = 300000,
  multiplier = 2
) {
  let delay;

  switch (strategy) {
    case RETRY_STRATEGIES.FIXED:
      delay = initialDelay;
      break;

    case RETRY_STRATEGIES.LINEAR:
      // each attempt adds another initialDelay
      delay = Math.min(initialDelay * attempt, maxDelay);
      break;

    case RETRY_STRATEGIES.EXPONENTIAL:
      // classic exponential backoff
      delay = Math.min(
        initialDelay * Math.pow(multiplier, attempt - 1),
        maxDelay
      );
      break;

    default:
      // if someone passes something weird, just use the initial delay
      // TODO: should we throw here instead? might be better to be strict
      delay = initialDelay;
  }

  return delay;
}

module.exports = {
  RETRY_STRATEGIES,
  calculateDelay
};
