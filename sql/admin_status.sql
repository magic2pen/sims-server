-- Admins get the same active/inactive status officers already have.
-- "Deleting" an admin sets this to 'inactive' rather than removing the
-- row — this protects historical inspection/assignment data (which
-- references officers created by admins) and preserves an audit trail,
-- while still fully blocking login and hiding them from active use.

ALTER TABLE admins ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
