const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { ADMIN_DESIGNATIONS, isWithinJurisdiction } = require('../utils/jurisdiction');

const router = express.Router();

// GET /api/admins/designations — the fixed list of valid admin posts,
// so the Portal can build its "Create Admin" dropdown from the server
// instead of hardcoding it in two places.
router.get('/designations', requireAuth('admin'), (req, res) => {
  const options = Object.entries(ADMIN_DESIGNATIONS)
    .map(([designation, info]) => ({ designation, ...info }))
    .filter((opt) => opt.rank > req.user.rank); // only show posts more junior than you
  res.json(options);
});

// PATCH /api/admins/me — one-time (or anytime) self-service way to set
// your own jurisdiction. Needed because the very first bootstrap admin
// was created before district/subdivision/block existed as fields.
router.patch('/me', requireAuth('admin'), async (req, res) => {
  const { district, subdivision, block } = req.body;
  try {
    const result = await pool.query(
      `UPDATE admins SET
         district = COALESCE($1, district),
         subdivision = COALESCE($2, subdivision),
         block = COALESCE($3, block)
       WHERE id = $4
       RETURNING id, name, email, admin_level, designation, rank, district, subdivision, block`,
      [district || null, subdivision || null, block || null, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating profile' });
  }
});

// POST /api/admins — create a more junior admin, within your own jurisdiction.
router.post('/', requireAuth('admin'), async (req, res) => {
  const { name, email, password, designation, district, subdivision, block } = req.body;

  if (!name || !email || !password || !designation) {
    return res.status(400).json({ error: 'name, email, password, and designation are required' });
  }

  const roleInfo = ADMIN_DESIGNATIONS[designation];
  if (!roleInfo) {
    return res.status(400).json({ error: 'Unknown admin designation. Please choose from the provided list.' });
  }

  if (roleInfo.rank <= req.user.rank) {
    return res.status(403).json({ error: 'You can only create admin accounts more junior than your own role.' });
  }

  const creatorCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
  const targetCtx = { district, subdivision, block };
  if (!isWithinJurisdiction(creatorCtx, targetCtx)) {
    return res.status(403).json({ error: 'You can only create admin accounts within your own jurisdiction.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO admins (name, email, password_hash, admin_level, designation, rank, district, subdivision, block, parent_admin_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, name, email, admin_level, designation, rank, district, subdivision, block`,
      [name, email, passwordHash, roleInfo.level, designation, roleInfo.rank, district || null, subdivision || null, block || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An admin with this email already exists.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error creating admin' });
  }
});

// GET /api/admins — list admins visible to you (more junior + within your jurisdiction).
router.get('/', requireAuth('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, admin_level, designation, rank, district, subdivision, block, created_at
       FROM admins WHERE rank > $1 ORDER BY rank ASC, name ASC`,
      [req.user.rank]
    );
    const creatorCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
    const visible = result.rows.filter((row) => isWithinJurisdiction(creatorCtx, row));
    res.json(visible);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
