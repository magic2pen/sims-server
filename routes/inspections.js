const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Same score bands used in the app's Section 13 (Overall Grading).
// Computed here too, once, at upload time — so the Portal can show a
// grade badge in the inspections list without parsing every row's full
// answers_json on every page load.
function computeOverallGrade(answersJson) {
  try {
    const answers = JSON.parse(answersJson || '{}');
    const fields = [
      'grade_infrastructure', 'grade_academics', 'grade_administration',
      'grade_premises_cleanliness', 'grade_hygiene', 'grade_discipline', 'grade_attendance'
    ];
    const sum = fields.reduce((total, id) => {
      const v = answers[id] && answers[id].value ? parseInt(answers[id].value, 10) : 0;
      return total + (isNaN(v) ? 0 : v);
    }, 0);
    if (sum > 63) return 'A+';
    if (sum > 56) return 'A';
    if (sum > 49) return 'B+';
    if (sum > 42) return 'B';
    if (sum > 35) return 'C';
    if (sum > 28) return 'D';
    return 'Poor';
  } catch (e) {
    return null;
  }
}

// POST /api/inspections — officer uploads a completed inspection.
// This is what "Final Submission and Upload" on the Pending Uploads
// screen calls. Requires a valid OFFICER token.
router.post('/', requireAuth('officer'), async (req, res) => {
  const { schoolId, schoolName, district, block, dateTime, answersJson, pdfBase64 } = req.body;

  if (!schoolName || !answersJson) {
    return res.status(400).json({ error: 'schoolName and answersJson are required' });
  }

  const overallGrade = computeOverallGrade(answersJson);

  try {
    const result = await pool.query(
      `INSERT INTO inspections
        (officer_id, school_id, school_name, district, block, inspection_datetime, answers_json, pdf_base64, overall_grade)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, school_name, uploaded_at`,
      [req.user.id, schoolId || null, schoolName, district, block, dateTime, answersJson, pdfBase64 || null, overallGrade]
    );

    // If this school was assigned to this officer, close the loop —
    // the assignment is now fulfilled, no manual step needed.
    if (schoolId) {
      await pool.query(
        `UPDATE assignments SET status = 'completed'
         WHERE officer_id = $1 AND school_id = $2 AND status = 'pending'`,
        [req.user.id, schoolId]
      );
    }

    res.status(201).json({ success: true, inspection: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error saving inspection', detail: err.message, code: err.code });
  }
});

// GET /api/inspections?search=&district=&block=
// List view for the Web Portal — lightweight (no answers/PDF payload).
router.get('/', requireAuth(), async (req, res) => {
  const { search, district, block } = req.query;
  let query = `
    SELECT i.id, i.officer_id, o.name AS officer_name, o.designation AS officer_designation,
           i.school_id, i.school_name, i.district, i.block, i.inspection_datetime,
           i.overall_grade, i.uploaded_at
    FROM inspections i
    LEFT JOIN officers o ON i.officer_id = o.id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    query += ` AND i.school_name ILIKE $${params.length}`;
  }
  if (district) {
    params.push(district);
    query += ` AND i.district = $${params.length}`;
  }
  if (block) {
    params.push(block);
    query += ` AND i.block = $${params.length}`;
  }
  query += ' ORDER BY i.uploaded_at DESC LIMIT 200';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/inspections/:id — full detail, including the PDF, for the
// Portal's inspection detail page.
router.get('/:id', requireAuth(), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, o.name AS officer_name, o.designation AS officer_designation
       FROM inspections i
       LEFT JOIN officers o ON i.officer_id = o.id
       WHERE i.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Inspection not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
