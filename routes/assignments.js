const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isWithinJurisdiction } = require('../utils/jurisdiction');

const router = express.Router();

// POST /api/assignments — admin assigns a school to an officer, with a due date.
// Both the officer AND the school must fall within the admin's own jurisdiction.
router.post('/', requireAuth('admin'), async (req, res) => {
  const { schoolId, officerId, dueDate, notes } = req.body;

  if (!schoolId || !officerId) {
    return res.status(400).json({ error: 'schoolId and officerId are required' });
  }

  try {
    const officerResult = await pool.query('SELECT district, subdivision, block FROM officers WHERE id = $1', [officerId]);
    if (officerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Officer not found' });
    }
    const schoolResult = await pool.query('SELECT district, subdivision, block FROM schools WHERE id = $1', [schoolId]);
    if (schoolResult.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    const adminCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
    if (!isWithinJurisdiction(adminCtx, officerResult.rows[0])) {
      return res.status(403).json({ error: 'That officer is outside your jurisdiction.' });
    }
    if (!isWithinJurisdiction(adminCtx, schoolResult.rows[0])) {
      return res.status(403).json({ error: 'That school is outside your jurisdiction.' });
    }

    const result = await pool.query(
      `INSERT INTO assignments (school_id, officer_id, assigned_by_admin_id, due_date, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, school_id, officer_id, due_date, status`,
      [schoolId, officerId, req.user.id, dueDate || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error creating assignment', detail: err.message });
  }
});

// GET /api/assignments — an OFFICER sees only their own assignments.
// An ADMIN sees every assignment for officers within their jurisdiction.
router.get('/', requireAuth(), async (req, res) => {
  try {
    if (req.user.role === 'officer') {
      const result = await pool.query(
        `SELECT a.id, a.due_date, a.status, a.notes, a.created_at,
                s.id AS school_id, s.name AS school_name, s.district, s.subdivision, s.block
         FROM assignments a
         LEFT JOIN schools s ON a.school_id = s.id
         WHERE a.officer_id = $1
         ORDER BY (a.status = 'pending') DESC, a.due_date ASC NULLS LAST`,
        [req.user.id]
      );
      return res.json(result.rows);
    }

    // Admin view — everything for officers within their jurisdiction.
    const result = await pool.query(
      `SELECT a.id, a.due_date, a.status, a.notes, a.created_at,
              s.id AS school_id, s.name AS school_name, s.district, s.subdivision, s.block,
              o.id AS officer_id, o.name AS officer_name, o.designation AS officer_designation,
              o.district AS officer_district, o.subdivision AS officer_subdivision, o.block AS officer_block
       FROM assignments a
       LEFT JOIN schools s ON a.school_id = s.id
       LEFT JOIN officers o ON a.officer_id = o.id
       ORDER BY (a.status = 'pending') DESC, a.due_date ASC NULLS LAST`
    );
    const adminCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
    const visible = result.rows.filter((row) =>
      isWithinJurisdiction(adminCtx, { district: row.officer_district, subdivision: row.officer_subdivision, block: row.officer_block })
    );
    res.json(visible);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/assignments/:id — admin can edit due date/notes, or cancel/reopen.
router.patch('/:id', requireAuth('admin'), async (req, res) => {
  const { id } = req.params;
  const allowedFields = ['due_date', 'status', 'notes'];
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
      `UPDATE assignments SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, status, due_date`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating assignment' });
  }
});

module.exports = router;
