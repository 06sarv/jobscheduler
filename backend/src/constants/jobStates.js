// All the possible states a job can be in
const JOB_STATES = {
  QUEUED: 'queued',
  SCHEDULED: 'scheduled',
  CLAIMED: 'claimed',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  DEAD: 'dead'        // job that failed too many times and won't be retried
};

// Which states can transition to which.
// This is basically the state machine for our jobs.
const JOB_STATE_TRANSITIONS = {
  [JOB_STATES.QUEUED]: [
    JOB_STATES.SCHEDULED,
    JOB_STATES.CLAIMED,
    JOB_STATES.CANCELLED
  ],
  [JOB_STATES.SCHEDULED]: [
    JOB_STATES.QUEUED,
    JOB_STATES.CANCELLED
  ],
  [JOB_STATES.CLAIMED]: [
    JOB_STATES.RUNNING,
    JOB_STATES.QUEUED,     // if the worker dies, re-queue it
    JOB_STATES.CANCELLED
  ],
  [JOB_STATES.RUNNING]: [
    JOB_STATES.COMPLETED,
    JOB_STATES.FAILED,
    JOB_STATES.CANCELLED
  ],
  [JOB_STATES.COMPLETED]: [],   // terminal state - no transitions out
  [JOB_STATES.FAILED]: [
    JOB_STATES.QUEUED,     // retry
    JOB_STATES.DEAD        // give up
  ],
  [JOB_STATES.CANCELLED]: [],   // also terminal
  [JOB_STATES.DEAD]: []         // very terminal lol
};

/**
 * Check if a state transition is allowed
 * @param {string} from - current state
 * @param {string} to - target state
 * @returns {boolean}
 */
function isValidTransition(from, to) {
  const allowed = JOB_STATE_TRANSITIONS[from];
  if (!allowed) {
    return false;
  }
  return allowed.includes(to);
}

module.exports = {
  JOB_STATES,
  JOB_STATE_TRANSITIONS,
  isValidTransition
};
