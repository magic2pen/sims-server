-- Adds status to schools, same active/inactive pattern as admins and
-- officers. "Deactivating" a school (e.g. it's closed or merged) hides
-- it from the app's school-selection list without breaking any past
-- inspection's history.

ALTER TABLE schools ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
