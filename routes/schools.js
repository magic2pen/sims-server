const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/schools?search=&district=&block=
// Any logged-in user (officer OR admin) can browse the school list —
// this is what the app's School Selection screen calls.
router.get('/', requireAuth(), async (req, res) => {
  const { search, district, block } = req.query;
  let query = 'SELECT id, udise_code, name, category, district, subdivision, block FROM schools WHERE 1=1';
  const params = [];

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

// POST /api/schools — admin only, adds one school to the master list
router.post('/', requireAuth('admin'), async (req, res) => {
  const { udiseCode, name, category, district, subdivision, block, address, headmasterName, headmasterPhone } = req.body;

  if (!name || !district || !block) {
    return res.status(400).json({ error: 'name, district, and block are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO schools (udise_code, name, category, district, subdivision, block, address, headmaster_name, headmaster_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, name, district, block`,
      [udiseCode, name, category, district, subdivision, block, address, headmasterName, headmasterPhone]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error creating school' });
  }
});

// PATCH /api/schools/:id — admin only, edit a school
router.patch('/:id', requireAuth('admin'), async (req, res) => {
  const { id } = req.params;
  const allowedFields = ['udise_code', 'name', 'category', 'district', 'subdivision', 'block', 'address', 'headmaster_name', 'headmaster_phone'];
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
      `UPDATE schools SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, name`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating school' });
  }
});

module.exports = router;
