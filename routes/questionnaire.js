// routes/questionnaire.js
// Phase 1 of the future-proofing work: lets the DM view and manage the
// questionnaire structure (schemes/sections/questions) stored in the
// database. The Android app doesn't read from here yet — that's
// Phase 2 — so nothing here affects what officers see in the field
// today. This is purely the foundation: a real place to build out new
// inspection types and edit the existing one, ready for when the app
// is updated to fetch from here directly.
//
// Restricted to the DM specifically (rank 1) — editing the core
// questionnaire structure is district-wide in its effect, so this
// intentionally sits above the normal jurisdiction-based admin rules
// used everywhere else in the system.

const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { SCHOOL_SCHEME_SEED } = require('./questionnaireSeed');

const router = express.Router();

function requireDM(req, res, next) {
  if (req.user.rank !== 1) {
    return res.status(403).json({ error: 'Only the DM can manage the questionnaire structure.' });
  }
  next();
}

// ====================================================================
// SCHEMES
// ====================================================================

// GET /api/questionnaire/schemes — any admin can VIEW the list (so a
// BDO/SDM can at least see what inspection types exist), only the DM
// can create/edit/delete.
router.get('/schemes', requireAuth('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inspection_schemes ORDER BY order_index ASC, id ASC');
    res.json({ schemes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching schemes', detail: err.message });
  }
});

router.post('/schemes', requireAuth('admin'), requireDM, async (req, res) => {
  const { name, code, description } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'name and code are required' });
  try {
    const result = await pool.query(
      'INSERT INTO inspection_schemes (name, code, description) VALUES ($1,$2,$3) RETURNING *',
      [name, code.toLowerCase().trim(), description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A scheme with this code already exists.' });
    console.error(err);
    res.status(500).json({ error: 'Server error creating scheme', detail: err.message });
  }
});

router.patch('/schemes/:id', requireAuth('admin'), requireDM, async (req, res) => {
  const { name, description, status, orderIndex } = req.body;
  const fields = [];
  const params = [];
  if (name !== undefined) { params.push(name); fields.push(`name = $${params.length}`); }
  if (description !== undefined) { params.push(description); fields.push(`description = $${params.length}`); }
  if (status !== undefined) { params.push(status); fields.push(`status = $${params.length}`); }
  if (orderIndex !== undefined) { params.push(orderIndex); fields.push(`order_index = $${params.length}`); }
  if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  params.push(req.params.id);
  try {
    const result = await pool.query(`UPDATE inspection_schemes SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Scheme not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating scheme', detail: err.message });
  }
});

router.delete('/schemes/:id', requireAuth('admin'), requireDM, async (req, res) => {
  try {
    const result = await pool.query("UPDATE inspection_schemes SET status = 'inactive' WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Scheme not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error deactivating scheme', detail: err.message });
  }
});

// GET /api/questionnaire/schemes/:id/full — the whole structure for one
// scheme: every section, every question, with nested reveal-questions
// properly nested back into their parent (not a flat list).
router.get('/schemes/:id/full', requireAuth('admin'), async (req, res) => {
  try {
    const schemeResult = await pool.query('SELECT * FROM inspection_schemes WHERE id = $1', [req.params.id]);
    if (schemeResult.rows.length === 0) return res.status(404).json({ error: 'Scheme not found' });
    const scheme = schemeResult.rows[0];

    const sectionsResult = await pool.query(
      'SELECT * FROM scheme_sections WHERE scheme_id = $1 ORDER BY order_index ASC, id ASC',
      [req.params.id]
    );
    const sectionIds = sectionsResult.rows.map((s) => s.id);
    const questionsResult = sectionIds.length > 0
      ? await pool.query('SELECT * FROM scheme_questions WHERE section_id = ANY($1::int[]) ORDER BY order_index ASC, id ASC', [sectionIds])
      : { rows: [] };

    // Group top-level (no parent) questions by their section, and
    // nested reveal-questions by their parent question id.
    const topBySection = {};
    const childrenByParent = {};
    questionsResult.rows.forEach((q) => {
      if (q.parent_question_id) {
        if (!childrenByParent[q.parent_question_id]) childrenByParent[q.parent_question_id] = [];
        childrenByParent[q.parent_question_id].push(q);
      } else {
        if (!topBySection[q.section_id]) topBySection[q.section_id] = [];
        topBySection[q.section_id].push(q);
      }
    });

    function attachChildren(question) {
      const children = childrenByParent[question.id] || [];
      return {
        ...question,
        options: question.options_json ? JSON.parse(question.options_json) : [],
        revealsOnYes: children.filter((c) => c.reveal_condition === 'ON_YES').map(attachChildren),
        revealsOnNo: children.filter((c) => c.reveal_condition === 'ON_NO').map(attachChildren),
        extraTextField: children.find((c) => c.reveal_condition === 'EXTRA') ? attachChildren(children.find((c) => c.reveal_condition === 'EXTRA')) : null
      };
    }

    const sections = sectionsResult.rows.map((s) => ({
      ...s,
      questions: (topBySection[s.id] || []).map(attachChildren)
    }));

    res.json({ scheme, sections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching scheme structure', detail: err.message });
  }
});

// ====================================================================
// SECTIONS
// ====================================================================

router.post('/schemes/:id/sections', requireAuth('admin'), requireDM, async (req, res) => {
  const { sectionKey, title, icon, specialType } = req.body;
  if (!sectionKey || !title) return res.status(400).json({ error: 'sectionKey and title are required' });
  try {
    const orderResult = await pool.query('SELECT COALESCE(MAX(order_index), -1) + 1 AS next FROM scheme_sections WHERE scheme_id = $1', [req.params.id]);
    const result = await pool.query(
      'INSERT INTO scheme_sections (scheme_id, section_key, title, icon, special_type, order_index) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.params.id, sectionKey, title, icon || null, specialType || null, orderResult.rows[0].next]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A section with this key already exists in this scheme.' });
    console.error(err);
    res.status(500).json({ error: 'Server error creating section', detail: err.message });
  }
});

router.patch('/sections/:id', requireAuth('admin'), requireDM, async (req, res) => {
  const { title, icon, specialType, status, orderIndex } = req.body;
  const fields = [];
  const params = [];
  if (title !== undefined) { params.push(title); fields.push(`title = $${params.length}`); }
  if (icon !== undefined) { params.push(icon); fields.push(`icon = $${params.length}`); }
  if (specialType !== undefined) { params.push(specialType); fields.push(`special_type = $${params.length}`); }
  if (status !== undefined) { params.push(status); fields.push(`status = $${params.length}`); }
  if (orderIndex !== undefined) { params.push(orderIndex); fields.push(`order_index = $${params.length}`); }
  if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  params.push(req.params.id);
  try {
    const result = await pool.query(`UPDATE scheme_sections SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Section not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating section', detail: err.message });
  }
});

router.delete('/sections/:id', requireAuth('admin'), requireDM, async (req, res) => {
  try {
    // Sections can be genuinely deleted (not just deactivated) — unlike
    // schools/officers/admins, a section here has no historical
    // inspection data tied to it directly (that lives in the
    // inspections table as a JSON blob, independent of this schema).
    const result = await pool.query('DELETE FROM scheme_sections WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Section not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error deleting section', detail: err.message });
  }
});

// ====================================================================
// QUESTIONS
// ====================================================================

router.post('/sections/:id/questions', requireAuth('admin'), requireDM, async (req, res) => {
  const { questionKey, label, type, options, subLabel1, subLabel2, parentQuestionId, revealCondition } = req.body;
  if (!questionKey || !label || !type) return res.status(400).json({ error: 'questionKey, label, and type are required' });
  try {
    const orderResult = await pool.query('SELECT COALESCE(MAX(order_index), -1) + 1 AS next FROM scheme_questions WHERE section_id = $1', [req.params.id]);
    const result = await pool.query(
      `INSERT INTO scheme_questions (section_id, question_key, label, type, options_json, sub_label_1, sub_label_2, parent_question_id, reveal_condition, order_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.params.id, questionKey, label, type, options ? JSON.stringify(options) : null, subLabel1 || null, subLabel2 || null, parentQuestionId || null, revealCondition || null, orderResult.rows[0].next]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A question with this key already exists in this section.' });
    console.error(err);
    res.status(500).json({ error: 'Server error creating question', detail: err.message });
  }
});

router.patch('/questions/:id', requireAuth('admin'), requireDM, async (req, res) => {
  const { label, type, options, subLabel1, subLabel2, status, orderIndex } = req.body;
  const fields = [];
  const params = [];
  if (label !== undefined) { params.push(label); fields.push(`label = $${params.length}`); }
  if (type !== undefined) { params.push(type); fields.push(`type = $${params.length}`); }
  if (options !== undefined) { params.push(JSON.stringify(options)); fields.push(`options_json = $${params.length}`); }
  if (subLabel1 !== undefined) { params.push(subLabel1); fields.push(`sub_label_1 = $${params.length}`); }
  if (subLabel2 !== undefined) { params.push(subLabel2); fields.push(`sub_label_2 = $${params.length}`); }
  if (status !== undefined) { params.push(status); fields.push(`status = $${params.length}`); }
  if (orderIndex !== undefined) { params.push(orderIndex); fields.push(`order_index = $${params.length}`); }
  if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  params.push(req.params.id);
  try {
    const result = await pool.query(`UPDATE scheme_questions SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Question not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating question', detail: err.message });
  }
});

router.delete('/questions/:id', requireAuth('admin'), requireDM, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM scheme_questions WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Question not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error deleting question', detail: err.message });
  }
});

// ====================================================================
// SEED — populates the "School Inspection" scheme with the structure
// the app currently has hardcoded, if it doesn't already exist.
// Idempotent: safe to call more than once, does nothing the second time.
// ====================================================================
router.post('/seed-school-scheme', requireAuth('admin'), requireDM, async (req, res) => {
  try {
    const existing = await pool.query('SELECT id FROM inspection_schemes WHERE code = $1', [SCHOOL_SCHEME_SEED.code]);
    if (existing.rows.length > 0) {
      return res.json({ success: true, message: 'School Inspection scheme already exists — nothing to do.', schemeId: existing.rows[0].id });
    }

    const schemeResult = await pool.query(
      'INSERT INTO inspection_schemes (name, code, description, order_index) VALUES ($1,$2,$3,0) RETURNING id',
      [SCHOOL_SCHEME_SEED.name, SCHOOL_SCHEME_SEED.code, SCHOOL_SCHEME_SEED.description]
    );
    const schemeId = schemeResult.rows[0].id;

    for (let i = 0; i < SCHOOL_SCHEME_SEED.sections.length; i++) {
      const section = SCHOOL_SCHEME_SEED.sections[i];
      const sectionResult = await pool.query(
        'INSERT INTO scheme_sections (scheme_id, section_key, title, icon, special_type, order_index) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [schemeId, section.key, section.title, section.icon || null, section.special_type || null, i]
      );
      const sectionId = sectionResult.rows[0].id;

      for (let j = 0; j < (section.questions || []).length; j++) {
        await insertQuestionTree(sectionId, section.questions[j], j, null, null);
      }
    }

    res.json({ success: true, message: 'School Inspection scheme seeded.', schemeId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error seeding questionnaire', detail: err.message });
  }
});

// Recursively inserts a question and its nested revealsOnYes/revealsOnNo/
// extraTextField, preserving the parent-child relationship.
async function insertQuestionTree(sectionId, q, orderIndex, parentId, revealCondition) {
  const result = await pool.query(
    `INSERT INTO scheme_questions (section_id, question_key, label, type, options_json, sub_label_1, sub_label_2, parent_question_id, reveal_condition, order_index)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [sectionId, q.key, q.label, q.type, q.options ? JSON.stringify(q.options) : null, q.subLabel1 || null, q.subLabel2 || null, parentId, revealCondition, orderIndex]
  );
  const questionId = result.rows[0].id;

  for (let i = 0; i < (q.revealsOnYes || []).length; i++) {
    await insertQuestionTree(sectionId, q.revealsOnYes[i], i, questionId, 'ON_YES');
  }
  for (let i = 0; i < (q.revealsOnNo || []).length; i++) {
    await insertQuestionTree(sectionId, q.revealsOnNo[i], i, questionId, 'ON_NO');
  }
  if (q.extraTextField) {
    await insertQuestionTree(sectionId, q.extraTextField, 0, questionId, 'EXTRA');
  }
}

module.exports = router;
