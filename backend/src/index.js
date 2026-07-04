/**
 * index.js - Main entry point for the Distributed Job Scheduler
 *
 * Sets up Express, middleware, routes, socket.io, and starts the server.
 * Also handles graceful shutdown so we don't drop jobs on deploys.
 */

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config/env');
const logger = require('./utils/logger');
const { pool } = require('./config/database');
const { initializeSocket } = require('./config/socket');
const { errorHandler } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

// -- Import all route modules --
const authRoutes = require('./routes/auth.routes');
const orgRoutes = require('./routes/organization.routes');
const projectRoutes = require('./routes/project.routes');
const queueRoutes = require('./routes/queue.routes');
const jobRoutes = require('./routes/job.routes');
const workerRoutes = require('./routes/worker.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

// -- Import services --
const schedulerService = require('./services/scheduler.service');

// Create express app and HTTP server
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO so we can push real-time updates to the frontend
const io = initializeSocket(server);

// ============================================
//  Global Middleware
// ============================================

// Security headers
app.use(helmet());

// CORS - let the frontend talk to us
app.use(cors({
  origin: config.server.corsOrigin,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting to prevent abuse
app.use(generalLimiter);

// Request logging
// TODO: maybe move this to a separate middleware file if it gets more complex
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ============================================
//  Routes
// ============================================

// Health check endpoint - no auth required
// (load balancers and k8s probes hit this)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 handler for anything that doesn't match a route
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND',
    },
  });
});

// Global error handler - has to be last
app.use(errorHandler);

// ============================================
//  Start Server
// ============================================

const PORT = config.server.port;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.server.env}`);

  // kick off the scheduler so cron jobs get processed
  schedulerService.start();
  logger.info('Scheduler service started');
});

// ============================================
//  Graceful Shutdown
// ============================================

/**
 * Handle shutdown signals. We want to:
 * 1. Stop accepting new scheduled jobs
 * 2. Close the HTTP server (stop accepting new requests)
 * 3. Close the database pool
 * 4. Exit cleanly
 *
 * If something hangs, force-exit after 30 seconds.
 */
const shutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // stop the scheduler first
  try {
    schedulerService.stop();
    logger.info('Scheduler stopped');
  } catch (err) {
    logger.error(`Error stopping scheduler: ${err.message}`);
  }

  server.close(() => {
    logger.info('HTTP server closed');

    pool.end(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });

  // Safety net: force exit if we're still hanging after 30s
  // (could happen if a DB query is stuck or something)
  setTimeout(() => {
    logger.error('Forced shutdown after timeout - something is hanging');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled promise rejections so the process doesn't silently die
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection:', err);
  // TODO: decide if we should exit here. For now, just log it.
});

// same for uncaught exceptions - log and keep going
// (in production you might want to crash here)
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
});

module.exports = { app, server };
