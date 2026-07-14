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
      `SELECT id, name, email, admin_level, designation, rank, district, subdivision, block, status, created_at
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

// PATCH /api/admins/:id — edit your OWN account (name/email/password/
// jurisdiction, no rank/status change), or a subordinate's account
// (more junior AND within your jurisdiction — same rule that governs
// whether you can see them at all).
router.patch('/:id', requireAuth('admin'), async (req, res) => {
  const { id } = req.params;
  const isSelf = parseInt(id, 10) === req.user.id;
  const { name, email, password, designation, district, subdivision, block, status } = req.body;

  if (!isSelf) {
    try {
      const targetResult = await pool.query('SELECT * FROM admins WHERE id = $1', [id]);
      if (targetResult.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
      const target = targetResult.rows[0];
      if (target.rank <= req.user.rank) {
        return res.status(403).json({ error: 'You can only edit admin accounts more junior than your own role.' });
      }
      const creatorCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
      if (!isWithinJurisdiction(creatorCtx, target)) {
        return res.status(403).json({ error: 'You can only edit admin accounts within your own jurisdiction.' });
      }
      // If the location is being changed, the NEW location must also be
      // within your jurisdiction — otherwise you could reassign someone
      // to somewhere outside your own authority.
      if (district !== undefined || subdivision !== undefined || block !== undefined) {
        const newLocation = {
          district: district !== undefined ? district : target.district,
          subdivision: subdivision !== undefined ? subdivision : target.subdivision,
          block: block !== undefined ? block : target.block
        };
        if (!isWithinJurisdiction(creatorCtx, newLocation)) {
          return res.status(403).json({ error: 'You cannot move this account to a location outside your own jurisdiction.' });
        }
      }
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  const updates = [];
  const params = [];
  if (name !== undefined) { params.push(name); updates.push(`name = $${params.length}`); }
  if (email !== undefined) { params.push(email); updates.push(`email = $${params.length}`); }
  if (district !== undefined) { params.push(district); updates.push(`district = $${params.length}`); }
  if (subdivision !== undefined) { params.push(subdivision); updates.push(`subdivision = $${params.length}`); }
  if (block !== undefined) { params.push(block); updates.push(`block = $${params.length}`); }
  if (password) {
    const passwordHash = await bcrypt.hash(password, 10);
    params.push(passwordHash);
    updates.push(`password_hash = $${params.length}`);
  }

  // A designation/rank change or a status change is only allowed when
  // editing a subordinate — you can't promote/demote or deactivate yourself.
  if (!isSelf) {
    if (designation !== undefined) {
      const roleInfo = ADMIN_DESIGNATIONS[designation];
      if (!roleInfo) return res.status(400).json({ error: 'Unknown admin designation.' });
      if (roleInfo.rank <= req.user.rank) {
        return res.status(403).json({ error: 'You can only assign posts more junior than your own role.' });
      }
      params.push(designation); updates.push(`designation = $${params.length}`);
      params.push(roleInfo.level); updates.push(`admin_level = $${params.length}`);
      params.push(roleInfo.rank); updates.push(`rank = $${params.length}`);
    }
    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) return res.status(400).json({ error: 'status must be active or inactive' });
      params.push(status); updates.push(`status = $${params.length}`);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  params.push(id);
  try {
    const result = await pool.query(
      `UPDATE admins SET ${updates.join(', ')} WHERE id = $${params.length}
       RETURNING id, name, email, admin_level, designation, rank, district, subdivision, block, status`,
      params
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An admin with this email already exists.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error updating admin' });
  }
});

// DELETE /api/admins/:id — deactivates a subordinate admin (does not
// permanently remove the row — see the note in sql/admin_status.sql).
// You cannot deactivate your own account this way.
router.delete('/:id', requireAuth('admin'), async (req, res) => {
  const { id } = req.params;
  if (parseInt(id, 10) === req.user.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account. Ask a more senior admin if this is genuinely needed.' });
  }
  try {
    const targetResult = await pool.query('SELECT * FROM admins WHERE id = $1', [id]);
    if (targetResult.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
    const target = targetResult.rows[0];
    if (target.rank <= req.user.rank) {
      return res.status(403).json({ error: 'You can only remove admin accounts more junior than your own role.' });
    }
    const creatorCtx = { admin_level: req.user.adminLevel, district: req.user.district, subdivision: req.user.subdivision, block: req.user.block };
    if (!isWithinJurisdiction(creatorCtx, target)) {
      return res.status(403).json({ error: 'You can only remove admin accounts within your own jurisdiction.' });
    }
    await pool.query('UPDATE admins SET status = $1 WHERE id = $2', ['inactive', id]);
    res.json({ success: true, message: 'Admin account deactivated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error deactivating admin' });
  }
});

module.exports = router;
