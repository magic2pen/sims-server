const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isWithinJurisdiction } = require('../utils/jurisdiction');

const router = express.Router();

// GET /api/schools?search=&district=&block=&includeInactive=true
// Any logged-in user can browse — this is what the app's School
// Selection screen calls. Only active schools show by default, so the
// app needs no changes: deactivated schools just quietly stop
// appearing there. The Portal's management page passes
// includeInactive=true to see (and potentially reactivate) everything.
router.get('/', requireAuth(), async (req, res) => {
  const { search, district, block, includeInactive } = req.query;
  let query = 'SELECT id, udise_code, name, category, district, subdivision, block, status FROM schools WHERE 1=1';
  const params = [];

  if (!includeInactive) {
    query += ` AND status = 'active'`;
  }
  if (search) {
    params.push(`%${search}%`);
    query += ` AND name ILIKE $${params.length}`;
  }
  if (district) {
    params.push(district);
    query += ` AND district = $${params.length}`;
  }
  if (block) {
    params.push(block);
    query += ` AND block = $${params.length}`;
  }
  query += ' ORDER BY name ASC';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/schools — admin only, within your own jurisdiction.
router.post('/', requireAuth('admin'), async (req, res) => {
  const { udiseCode, name, category, district, subdivision, block, address, headmasterName, headmasterPhone } = req.body;

  if (!name || !district || !block) {
    return res.status(400).json({ error: 'name, district, and block are required' });
  }

  const adminCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
  if (!isWithinJurisdiction(adminCtx, { district, subdivision, block })) {
    return res.status(403).json({ error: 'You can only add schools within your own jurisdiction.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO schools (udise_code, name, category, district, subdivision, block, address, headmaster_name, headmaster_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, name, district, block, status`,
      [udiseCode, name, category, district, subdivision, block, address, headmasterName, headmasterPhone]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error creating school' });
  }
});

// PATCH /api/schools/:id — admin only, within jurisdiction (both the
// school's current location AND, if it's being moved, the new one).
router.patch('/:id', requireAuth('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const targetResult = await pool.query('SELECT * FROM schools WHERE id = $1', [id]);
    if (targetResult.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    const target = targetResult.rows[0];
    const adminCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
    if (!isWithinJurisdiction(adminCtx, target)) {
      return res.status(403).json({ error: 'You can only edit schools within your own jurisdiction.' });
    }
    if (req.body.district !== undefined || req.body.subdivision !== undefined || req.body.block !== undefined) {
      const newLocation = {
        district: req.body.district !== undefined ? req.body.district : target.district,
        subdivision: req.body.subdivision !== undefined ? req.body.subdivision : target.subdivision,
        block: req.body.block !== undefined ? req.body.block : target.block
      };
      if (!isWithinJurisdiction(adminCtx, newLocation)) {
        return res.status(403).json({ error: 'You cannot move this school to a location outside your own jurisdiction.' });
      }
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }

  const allowedFields = ['udise_code', 'name', 'category', 'district', 'subdivision', 'block', 'address', 'headmaster_name', 'headmaster_phone', 'status'];
  const updates = [];
  const params = [];

  for (const field of allowedFields) {
    const camelCase = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (req.body[camelCase] !== undefined) {
      params.push(req.body[camelCase]);
      updates.push(`${field} = $${params.length}`);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  params.push(id);
  try {
    const result = await pool.query(
      `UPDATE schools SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, name, status`,
      params
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating school' });
  }
});

// DELETE /api/schools/:id — deactivates (does not permanently remove —
// any past inspections at this school stay fully intact).
router.delete('/:id', requireAuth('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const targetResult = await pool.query('SELECT * FROM schools WHERE id = $1', [id]);
    if (targetResult.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    const target = targetResult.rows[0];
    const adminCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
    if (!isWithinJurisdiction(adminCtx, target)) {
      return res.status(403).json({ error: 'You can only remove schools within your own jurisdiction.' });
    }
    await pool.query('UPDATE schools SET status = $1 WHERE id = $2', ['inactive', id]);
    res.json({ success: true, message: 'School deactivated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error deactivating school' });
  }
});

module.exports = router;
