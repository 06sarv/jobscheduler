/**
 * migrate.js
 * Runs the database migration SQL files against Postgres.
 * 
 * Usage: node src/db/migrate.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// set up the connection pool from env vars
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log(' Starting database migration...');
    console.log(`   Connected to: ${process.env.DATABASE_URL?.split('@')[1] || 'database'}`);

    // grab the migration file
    const migrationsDir = path.join(__dirname, 'migrations');
    const sqlFile = path.join(migrationsDir, '001_initial_schema.sql');

    if (!fs.existsSync(sqlFile)) {
      throw new Error(`Migration file not found: ${sqlFile}`);
    }

    const sql = fs.readFileSync(sqlFile, 'utf-8');

    console.log('   Running 001_initial_schema.sql...');

    // wrap it in a transaction so if anything goes wrong we roll back cleanly
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log(' Migration completed successfully!');
  } catch (err) {
    // something broke, roll it back
    await client.query('ROLLBACK');
    console.error(' Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
