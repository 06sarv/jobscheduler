const { Pool } = require('pg');
const config = require('./env');
const logger = require('../utils/logger');

// create the connection pool using the database url from env
const pool = new Pool({
  connectionString: config.db.url,
  min: config.db.poolMin,
  max: config.db.poolMax
});

// log when we first connect successfully
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

// handle pool errors - these can happen if a connection drops
pool.on('error', (err) => {
  logger.error('Unexpected database pool error:', err);
  // don't crash, the pool will try to reconnect on the next query
});

/**
 * Helper function to run a query against the pool.
 * Saves us from having to do pool.query() everywhere.
 * 
 * @param {string} text - SQL query text
 * @param {Array} params - query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  // log slow queries so we can optimize them later
  // TODO: make the threshold configurable?
  if (duration > 500) {
    logger.warn(`Slow query (${duration}ms): ${text}`);
  } else {
    logger.debug(`Query executed in ${duration}ms: ${text.substring(0, 80)}...`);
  }

  return result;
}

module.exports = {
  pool,
  query
};
