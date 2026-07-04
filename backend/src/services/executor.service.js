const { pool } = require('../config/database');
const logger = require('../utils/logger');
const io = require('../config/socket');

const executeJob = async (job, workerId) => {
  logger.info(`Worker ${workerId} executing job ${job.id}`);
  
  // Create execution record
  const client = await pool.connect();
  let executionId;
  try {
    const execResult = await client.query(`
      INSERT INTO job_executions (job_id, worker_id, attempt_number, status, started_at)
      VALUES ($1, $2, $3, 'running', NOW())
      RETURNING id
    `, [job.id, workerId, job.retry_count + 1]);
    
    executionId = execResult.rows[0].id;
    
    // Simulate work (1-5s delay)
    const delay = Math.floor(Math.random() * 4000) + 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // 80% success, 20% fail
    const success = Math.random() < 0.8;
    
    if (success) {
      await client.query(`
        UPDATE jobs SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1
      `, [job.id]);
      
      await client.query(`
        UPDATE job_executions SET status = 'completed', completed_at = NOW(), duration_ms = $1 WHERE id = $2
      `, [delay, executionId]);
    } else {
      await client.query(`
        UPDATE jobs SET status = 'failed', updated_at = NOW() WHERE id = $1
      `, [job.id]);
      
      await client.query(`
        UPDATE job_executions SET status = 'failed', completed_at = NOW(), duration_ms = $1, error_message = 'Simulated failure' WHERE id = $2
      `, [delay, executionId]);
    }
  } catch (error) {
    logger.error('Error in executeJob:', error);
  } finally {
    client.release();
  }
};

module.exports = {
  executeJob
};
