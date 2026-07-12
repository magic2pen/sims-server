const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

// POST /api/admin/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM admins WHERE email = $1', [email]);
    const admin = result.rows[0];
    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordOk = await bcrypt.compare(password, admin.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: admin.id, role: 'admin', name: admin.name, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;
