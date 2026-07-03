/**
 * seed.js
 * Inserts demo/seed data into the database.
 * Safe to run multiple times (uses ON CONFLICT DO NOTHING).
 *
 * Usage: node src/db/seed.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runSeed() {
  const client = await pool.connect();

  try {
    console.log(' Starting database seed...');

    const seedFile = path.join(__dirname, 'seeds', 'seed.sql');

    if (!fs.existsSync(seedFile)) {
      throw new Error(`Seed file not found: ${seedFile}`);
    }

    const sql = fs.readFileSync(seedFile, 'utf-8');

    // run in a transaction
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log(' Seed data inserted successfully!');
    console.log('   Demo accounts:');
    console.log('     admin@example.com / password123');
    console.log('     dev@example.com   / password123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(' Seeding failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();
