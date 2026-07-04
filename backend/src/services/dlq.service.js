const logger = require('../utils/logger');

const moveToDeadLetter = async (jobId, reason) => {
  logger.info(`Moving job ${jobId} to DLQ because: ${reason}`);
  return true;
};

const getDeadLetterJobs = async () => {
  return [];
};

const retryFromDLQ = async (id) => {
  return true;
};

const discardFromDLQ = async (id) => {
  return true;
};

module.exports = {
  moveToDeadLetter,
  getDeadLetterJobs,
  retryFromDLQ,
  discardFromDLQ
};
