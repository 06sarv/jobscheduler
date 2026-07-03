require('dotenv').config();
const Joi = require('joi');

// validate all the env vars we need upfront
// better to crash at startup than have weird bugs later
const envSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  DATABASE_URL: Joi.string().uri().required()
    .description('PostgreSQL connection string'),
  JWT_SECRET: Joi.string().min(10).required()
    .description('Secret key for signing JWTs'),
  JWT_REFRESH_SECRET: Joi.string().min(10).required()
    .description('Secret for refresh tokens'),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
  WORKER_POLL_INTERVAL: Joi.number().default(1000),
  WORKER_HEARTBEAT_INTERVAL: Joi.number().default(30000),
  WORKER_CONCURRENCY: Joi.number().integer().min(1).default(3),
  LOG_LEVEL: Joi.string().default('info'),
  DB_POOL_MIN: Joi.number().integer().default(2),
  DB_POOL_MAX: Joi.number().integer().default(10),
  GEMINI_API_KEY: Joi.string().required().description('API key for Gemini AI summary feature')
}).unknown(true); // allow other env vars we don't care about

const { error, value: envVars } = envSchema.validate(process.env, {
  abortEarly: false,
  stripUnknown: false
});

if (error) {
  console.error(' Environment validation failed:');
  error.details.forEach((detail) => {
    console.error(`  - ${detail.message}`);
  });
  process.exit(1);
}

// organize everything into a nice nested config object
const config = {
  server: {
    port: envVars.PORT,
    env: envVars.NODE_ENV,
    corsOrigin: envVars.CORS_ORIGIN
  },
  db: {
    url: envVars.DATABASE_URL,
    poolMin: envVars.DB_POOL_MIN,
    poolMax: envVars.DB_POOL_MAX
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN
  },
  worker: {
    pollInterval: envVars.WORKER_POLL_INTERVAL,
    heartbeatInterval: envVars.WORKER_HEARTBEAT_INTERVAL,
    concurrency: envVars.WORKER_CONCURRENCY
  },
  ai: {
    geminiApiKey: envVars.GEMINI_API_KEY
  }
};

module.exports = config;
