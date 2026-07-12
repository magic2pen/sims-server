// sql/seedAdmin.js
// Run this ONCE to create the very first admin account. After that,
// admins can be managed through the (future) admin panel — but the
// very first one has to be created this way, since there's no
// self-registration anywhere in this system by design.
//
// Usage:  node sql/seedAdmin.js "Your Name" "your@email.com" "yourPassword"

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db');

async function seedAdmin() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Usage: node sql/seedAdmin.js "Name" "email@example.com" "password"');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const result = await pool.query(
      'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, passwordHash]
    );
    console.log('Admin account created:', result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      console.error('An admin with this email already exists.');
    } else {
      console.error('Error creating admin:', err.message);
    }
  } finally {
    await pool.end();
  }
}

seedAdmin();
