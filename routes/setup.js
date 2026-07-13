// routes/setup.js
// Render's free tier doesn't include Shell access, so this route lets us
// do the one-time setup (creating tables, creating the first admin)
// through the browser instead of a command line. Both actions require a
// secret key (set as the SETUP_SECRET environment variable in Render) so
// a stranger on the internet can't call these and mess with your data.

const express = require('express');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const pool = require('../db');

const router = express.Router();

// POST /api/setup/init-database   Body: { secret }
// Creates all the database tables. Safe to run more than once — it uses
// "IF NOT EXISTS" so it won't wipe or duplicate anything already there.
router.post('/init-database', async (req, res) => {
  if (!process.env.SETUP_SECRET || req.body.secret !== process.env.SETUP_SECRET) {
    return res.status(403).json({ error: 'Invalid setup secret' });
  }
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
    await pool.query(schemaSql);
    const schoolsSql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schools.sql'), 'utf8');
    await pool.query(schoolsSql);
    const inspectionsSql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'inspections.sql'), 'utf8');
    await pool.query(inspectionsSql);
    const gradeColSql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'inspections_grade.sql'), 'utf8');
    await pool.query(gradeColSql);
    const adminHierarchySql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'admin_hierarchy.sql'), 'utf8');
    await pool.query(adminHierarchySql);
    const assignmentsSql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'assignments.sql'), 'utf8');
    await pool.query(assignmentsSql);
    res.json({ success: true, message: 'Database tables created (or already existed). You can now create your first admin.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/setup/create-admin   Body: { secret, name, email, password }
router.post('/create-admin', async (req, res) => {
  const { secret, name, email, password } = req.body;
  if (!process.env.SETUP_SECRET || secret !== process.env.SETUP_SECRET) {
    return res.status(403).json({ error: 'Invalid setup secret' });
  }
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, passwordHash]
    );
    res.json({ success: true, admin: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An admin with this email already exists.' });
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
