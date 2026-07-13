-- Adds admin hierarchy fields: level, designation, jurisdiction, rank, and
-- who created whom. Run through test.html's Setup box as usual.
--
-- Existing admin row(s) get sensible defaults (District level, rank 1,
-- "DM" designation) since that's the top of the hierarchy for now — but
-- their actual district wasn't collected when they were first created, so
-- there's a new one-time step to fill that in (see README).

ALTER TABLE admins ADD COLUMN IF NOT EXISTS admin_level TEXT DEFAULT 'district';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS designation TEXT DEFAULT 'DM (District Magistrate & Collector)';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS rank INTEGER DEFAULT 1;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS subdivision TEXT;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS block TEXT;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS parent_admin_id INTEGER REFERENCES admins(id);

CREATE INDEX IF NOT EXISTS idx_admins_district ON admins(district);
CREATE INDEX IF NOT EXISTS idx_admins_rank ON admins(rank);
