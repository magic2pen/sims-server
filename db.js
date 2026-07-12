// db.js — one shared PostgreSQL connection pool for the whole server.
// DATABASE_URL comes from an environment variable so this file never
// needs to change no matter where it's deployed (Render today, an
// NIC server tomorrow — same code, different env var value).

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

module.exports = pool;
