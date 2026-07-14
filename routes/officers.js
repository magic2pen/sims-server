const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isWithinJurisdiction } = require('../utils/jurisdiction');

const router = express.Router();

// All routes below require a valid ADMIN token — this is what enforces
// "no self-registration, only the administrator creates accounts".
router.use(requireAuth('admin'));

// GET /api/officers — list all officers (optionally filter by district/status)
router.get('/', async (req, res) => {
  const { district, status } = req.query;
  let query = 'SELECT id, officer_id, employee_code, name, designation, department, district, subdivision, block, mobile_number, email, office, status, created_at FROM officers WHERE 1=1';
  const params = [];

  if (district) {
    params.push(district);
    query += ` AND district = $${params.length}`;
  }
  if (status) {
    params.push(status);
    query += ` AND status = $${params.length}`;
  }
  query += ' ORDER BY created_at DESC';

  try {
    const result = await pool.query(query, params);
    const creatorCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
    const visible = result.rows.filter((row) => isWithinJurisdiction(creatorCtx, row));
    res.json(visible);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/officers — create a new officer account
router.post('/', async (req, res) => {
  const {
    officerId, employeeCode, name, designation, department,
    district, subdivision, block, mobileNumber, email, office,
    username, password
  } = req.body;

  if (!officerId || !name || !email || !username || !password) {
    return res.status(400).json({ error: 'officerId, name, email, username, and password are required' });
  }
  if (!district || !block) {
    return res.status(400).json({ error: 'district and block are required' });
  }

  const creatorCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
  const targetCtx = { district, subdivision, block };
  if (!isWithinJurisdiction(creatorCtx, targetCtx)) {
    return res.status(403).json({ error: 'You can only create officer accounts within your own jurisdiction.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO officers
        (officer_id, employee_code, name, designation, department, district, subdivision, block,
         mobile_number, email, office, username, password_hash, created_by_admin_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id, officer_id, name, email, username, status`,
      [officerId, employeeCode, name, designation, department, district, subdivision, block,
       mobileNumber, email, office, username, passwordHash, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      return res.status(409).json({ error: 'An officer with this Officer ID, email, or username already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error creating officer' });
  }
});

// PATCH /api/officers/:id — edit an officer within your jurisdiction
// (same rule as who can see them). Now also supports a password reset.
router.patch('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const targetResult = await pool.query('SELECT * FROM officers WHERE id = $1', [id]);
    if (targetResult.rows.length === 0) return res.status(404).json({ error: 'Officer not found' });
    const target = targetResult.rows[0];
    const creatorCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
    if (!isWithinJurisdiction(creatorCtx, target)) {
      return res.status(403).json({ error: 'You can only edit officer accounts within your own jurisdiction.' });
    }
    if (req.body.district !== undefined || req.body.subdivision !== undefined || req.body.block !== undefined) {
      const newLocation = {
        district: req.body.district !== undefined ? req.body.district : target.district,
        subdivision: req.body.subdivision !== undefined ? req.body.subdivision : target.subdivision,
        block: req.body.block !== undefined ? req.body.block : target.block
      };
      if (!isWithinJurisdiction(creatorCtx, newLocation)) {
        return res.status(403).json({ error: 'You cannot move this officer to a location outside your own jurisdiction.' });
      }
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }

  const allowedFields = [
    'employee_code', 'name', 'designation', 'department', 'district',
    'subdivision', 'block', 'mobile_number', 'email', 'office', 'status', 'username'
  ];
  const updates = [];
  const params = [];

  for (const field of allowedFields) {
    const camelCase = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (req.body[camelCase] !== undefined) {
      params.push(req.body[camelCase]);
      updates.push(`${field} = $${params.length}`);
    }
  }

  if (req.body.password) {
    const passwordHash = await bcrypt.hash(req.body.password, 10);
    params.push(passwordHash);
    updates.push(`password_hash = $${params.length}`);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  params.push(id);
  try {
    const result = await pool.query(
      `UPDATE officers SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, name, status`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Officer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An officer with this Officer ID, email, or username already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error updating officer' });
  }
});

// DELETE /api/officers/:id — deactivates (does not permanently remove —
// their historical inspections stay fully intact and attributed).
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const targetResult = await pool.query('SELECT * FROM officers WHERE id = $1', [id]);
    if (targetResult.rows.length === 0) return res.status(404).json({ error: 'Officer not found' });
    const target = targetResult.rows[0];
    const creatorCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
    if (!isWithinJurisdiction(creatorCtx, target)) {
      return res.status(403).json({ error: 'You can only remove officer accounts within your own jurisdiction.' });
    }
    await pool.query('UPDATE officers SET status = $1 WHERE id = $2', ['inactive', id]);
    res.json({ success: true, message: 'Officer account deactivated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error deactivating officer' });
  }
});

module.exports = router;
