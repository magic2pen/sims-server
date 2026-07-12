const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/inspections — officer uploads a completed inspection.
// This is what "Final Submission and Upload" on the Pending Uploads
// screen calls. Requires a valid OFFICER token.
router.post('/', requireAuth('officer'), async (req, res) => {
  const { schoolId, schoolName, district, block, dateTime, answersJson, pdfBase64 } = req.body;

  if (!schoolName || !answersJson) {
    return res.status(400).json({ error: 'schoolName and answersJson are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO inspections
        (officer_id, school_id, school_name, district, block, inspection_datetime, answers_json, pdf_base64)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, school_name, uploaded_at`,
      [req.user.id, schoolId || null, schoolName, district, block, dateTime, answersJson, pdfBase64 || null]
    );
    res.status(201).json({ success: true, inspection: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error saving inspection' });
  }
});

// GET /api/inspections — list inspections (any logged-in user for now;
// once the Web Portal exists this will filter by the viewer's role/district).
router.get('/', requireAuth(), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, officer_id, school_id, school_name, district, block, inspection_datetime, uploaded_at
       FROM inspections ORDER BY uploaded_at DESC LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
