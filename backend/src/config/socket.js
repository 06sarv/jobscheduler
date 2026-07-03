const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('./env');
const logger = require('../utils/logger');

// module-level variable to hold the io instance
let io = null;

/**
 * Set up socket.io on the given HTTP server.
 * Adds JWT auth middleware so only authenticated users can connect.
 * 
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.server.corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // auth middleware - runs before connection is established
  io.use((socket, next) => {
    // try to get token from auth header first, then from query params
    const token = socket.handshake.auth?.token
      || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      socket.user = decoded; // attach user info to the socket
      next();
    } catch (err) {
      logger.warn(`Socket auth failed: ${err.message}`);
      return next(new Error('Invalid or expired token'));
    }
  });

  // handle connections
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (user: ${socket.user?.id})`);

    // join user to their own room for targeted messages
    if (socket.user?.id) {
      socket.join(`user:${socket.user.id}`);
    }

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (reason: ${reason})`);
    });

    // TODO: add more event handlers as we build out features
    // like: subscribe to job updates, worker status, etc.
  });

  logger.info('Socket.IO initialized');
  return io;
}

/**
 * Get the socket.io instance.
 * Call this from anywhere after initializeSocket has been called.
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.IO has not been initialized - call initializeSocket first');
  }
  return io;
}

module.exports = {
  initializeSocket,
  getIO
};
