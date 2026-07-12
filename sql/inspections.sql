-- Adds the inspections table. Run through the Setup box on test.html
-- (Step A now also creates this table).
--
-- Note on storage: PDFs are stored as TEXT (base64) directly in the
-- database rather than as files on disk. This is deliberate — Render's
-- free web service has "ephemeral" disk storage that gets wiped on
-- every restart/redeploy, but the database is a separate, persistent
-- service. For a testing/demo phase this is the simplest reliable
-- option; a production rollout would move large files to proper object
-- storage later (Phase E).

CREATE TABLE IF NOT EXISTS inspections (
    id SERIAL PRIMARY KEY,
    officer_id INTEGER REFERENCES officers(id),
    school_id INTEGER REFERENCES schools(id),
    school_name TEXT NOT NULL,
    district TEXT,
    block TEXT,
    inspection_datetime TEXT,
    answers_json TEXT,
    pdf_base64 TEXT,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspections_officer ON inspections(officer_id);
CREATE INDEX IF NOT EXISTS idx_inspections_school ON inspections(school_id);
