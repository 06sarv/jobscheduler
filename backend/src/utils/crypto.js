const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12; // good balance between security and speed

/**
 * Hash a plaintext password
 * @param {string} password - the plaintext password
 * @returns {Promise<string>} the hashed password
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

/**
 * Compare a plaintext password against a hash
 * @param {string} password - plaintext password to check
 * @param {string} hash - the stored hash
 * @returns {Promise<boolean>} true if they match
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = {
  hashPassword,
  comparePassword
};
