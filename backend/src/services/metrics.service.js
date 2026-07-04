const { pool } = require('../config/database');
const logger = require('../utils/logger');

const getSystemHealth = async () => {
  const client = await pool.connect();
  try {
    const totalJobsResult = await client.query("SELECT COUNT(*) FROM jobs");
    const activeWorkersResult = await client.query("SELECT COUNT(*) FROM workers WHERE status IN ('idle', 'busy') AND last_heartbeat_at > NOW() - INTERVAL '1 minute'");
    
    // For demo purposes, we return a mock success rate and execution time if no data exists
    return {
      totalJobs: parseInt(totalJobsResult.rows[0].count, 10),
      activeWorkers: parseInt(activeWorkersResult.rows[0].count, 10),
      completedToday: 0,
      failedToday: 0,
      successRate: 100.0,
      avgExecutionTime: 0,
      queueDepth: 0
    };
  } finally {
    client.release();
  }
};

const getThroughput = async (range) => {
  // Mock throughput data for now
  return Array.from({ length: 24 }).map((_, i) => ({
    timestamp: `${i}:00`,
    completed: Math.floor(Math.random() * 100),
    failed: Math.floor(Math.random() * 10)
  }));
};

const getQueueStats = async () => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        q.id, q.name, q.status,
        (SELECT COUNT(*) FROM jobs j WHERE j.queue_id = q.id AND j.status = 'queued') as depth,
        (SELECT COUNT(*) FROM jobs j WHERE j.queue_id = q.id AND j.status = 'running') as processing,
        (SELECT COUNT(*) FROM jobs j WHERE j.queue_id = q.id AND j.status = 'completed') as completed,
        (SELECT COUNT(*) FROM jobs j WHERE j.queue_id = q.id AND j.status = 'failed') as failed
      FROM queues q
    `);
    
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      status: row.status,
      depth: parseInt(row.depth, 10),
      processing: parseInt(row.processing, 10),
      completed: parseInt(row.completed, 10),
      failed: parseInt(row.failed, 10),
      avgTime: 0
    }));
  } finally {
    client.release();
  }
};

const getWorkerStats = async () => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM workers ORDER BY started_at DESC');
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      status: row.status,
      currentLoad: row.current_load,
      concurrency: row.concurrency,
      cpuUsage: 0,
      memoryUsage: 0,
      lastHeartbeat: row.last_heartbeat_at,
      uptime: '1h'
    }));
  } finally {
    client.release();
  }
};

module.exports = {
  getSystemHealth,
  getThroughput,
  getQueueStats,
  getWorkerStats
};
