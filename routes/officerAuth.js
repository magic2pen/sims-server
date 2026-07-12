const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/officer/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM officers WHERE username = $1', [username]);
    const officer = result.rows[0];
    if (!officer) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    if (officer.status !== 'active') {
      return res.status(403).json({ error: 'This account has been deactivated. Contact your administrator.' });
    }

    const passwordOk = await bcrypt.compare(password, officer.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: officer.id, role: 'officer', officerId: officer.officer_id, name: officer.name, designation: officer.designation },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      officer: {
        id: officer.id,
        officerId: officer.officer_id,
        name: officer.name,
        designation: officer.designation,
        district: officer.district,
        block: officer.block
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// GET /api/officer/me — the logged-in officer's own profile
router.get('/me', requireAuth('officer'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM officers WHERE id = $1', [req.user.id]);
    const officer = result.rows[0];
    if (!officer) return res.status(404).json({ error: 'Officer not found' });
    delete officer.password_hash;
    res.json(officer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
