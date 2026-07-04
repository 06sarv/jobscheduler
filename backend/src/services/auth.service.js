const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const config = require('../config/env');
const logger = require('../utils/logger');
const { hashPassword, comparePassword } = require('../utils/crypto');
const { AppError, NotFoundError, ConflictError, UnauthorizedError } = require('../utils/errors');

/**
 * Auth service - handles user registration, login, tokens etc.
 * 
 * Probably should add rate limiting at the route level too,
 * but that's a problem for another day.
 */

// helper to strip password_hash from user objects before returning
function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

// Build token payload - keep it minimal
function buildTokenPayload(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

/**
 * Register a new user account.
 * Hashes the password before storing, returns user without password_hash.
 */
async function register(email, password, fullName) {
  // check if email already taken
  const existing = await query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existing.rows.length > 0) {
    throw new ConflictError('A user with this email already exists');
  }

  const hashedPw = await hashPassword(password);

  const result = await query(
    `INSERT INTO users (email, password_hash, full_name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [email, hashedPw, fullName]
  );

  const user = result.rows[0];
  logger.info(`New user registered: ${user.email}`);

  return sanitizeUser(user);
}

/**
 * Login - verify credentials and return tokens + user data.
 */
async function login(email, password) {
  const result = await query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  const user = result.rows[0];
  if (!user) {
    // don't reveal whether email exists or not
    throw new UnauthorizedError('Invalid email or password');
  }

  const passwordMatch = await comparePassword(password, user.password_hash);
  if (!passwordMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const payload = buildTokenPayload(user);

  // TODO: maybe make these expiry times configurable from the dashboard?
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: '15m',
  });

  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: '7d',
  });

  logger.info(`User logged in: ${user.email}`);

  return {
    accessToken,
    refreshToken,
    user: sanitizeUser(user),
  };
}

/**
 * Refresh an access token using a valid refresh token.
 * Returns a fresh access token and user info.
 */
async function refreshToken(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.refreshSecret);
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  // Make sure the user still exists (they could've been deleted)
  const result = await query(
    'SELECT * FROM users WHERE id = $1',
    [decoded.id]
  );

  const user = result.rows[0];
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const payload = buildTokenPayload(user);
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: '15m',
  });

  return {
    accessToken,
    user: sanitizeUser(user),
  };
}

/**
 * Get a user by their ID (without the password hash ofc).
 */
async function getUserById(userId) {
  const result = await query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );

  const user = result.rows[0];
  if (!user) {
    throw new NotFoundError('User not found');
  }

  return sanitizeUser(user);
}

module.exports = {
  register,
  login,
  refreshToken,
  getUserById,
};
