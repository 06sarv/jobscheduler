const winston = require('winston');

// figure out what log level we should use
const logLevel = process.env.LOG_LEVEL || 'info';

// different formats depending on environment
// production gets JSON (easier to parse in log aggregators)
// development gets the colorful human-readable format
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

const isProduction = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: logLevel,
  format: isProduction ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console()
  ],
  // don't crash the whole app if logging fails lol
  exitOnError: false
});

// TODO: maybe add file transport for production later?
// something like: new winston.transports.File({ filename: 'error.log', level: 'error' })

module.exports = logger;
