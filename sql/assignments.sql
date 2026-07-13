-- Assignments: an admin assigning a specific school to a specific
-- officer, with a due date. This is what finally replaces the app's
-- hardcoded "Assigned Schools" sample list with real data. Run through
-- test.html's Setup box as usual.

CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES schools(id),
    officer_id INTEGER NOT NULL REFERENCES officers(id),
    assigned_by_admin_id INTEGER REFERENCES admins(id),
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' or 'completed'
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_officer ON assignments(officer_id);
CREATE INDEX IF NOT EXISTS idx_assignments_school ON assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
