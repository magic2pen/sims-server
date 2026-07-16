-- Phase 1 of the future-proofing work: the questionnaire structure
-- (currently hardcoded into the Android app) gets a proper home in the
-- database instead. This doesn't change how the app behaves yet — that
-- happens in Phase 2, after the presentation — but it gives the DM a
-- real place to build out new inspection types (AWC, Health Sub
-- Centre, etc.) and edit the existing School Inspection structure,
-- ready for the day the app is updated to read from here directly.

-- A "scheme" is one full inspection type/department — School
-- Inspection, AWC Inspection, HSC Inspection, and so on.
CREATE TABLE IF NOT EXISTS inspection_schemes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- A section within a scheme (e.g. "Infrastructure", "Classroom
-- Observation"). special_type marks the handful of sections that need
-- dedicated rendering rather than a plain question list (student
-- attendance, staff attendance, photos, grading, signature) — mirrors
-- the isClassWiseAttendance/isPhotosSection/etc. flags already used in
-- the app's current hardcoded structure.
CREATE TABLE IF NOT EXISTS scheme_sections (
  id SERIAL PRIMARY KEY,
  scheme_id INTEGER NOT NULL REFERENCES inspection_schemes(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,
  icon TEXT,
  special_type TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(scheme_id, section_key)
);

-- A single question. parent_question_id + reveal_condition let a
-- question be a nested follow-up that only shows depending on its
-- parent's answer — matches the app's existing revealsOnYes/
-- revealsOnNo/extraTextField pattern, just properly normalized instead
-- of buried in nested Kotlin objects.
CREATE TABLE IF NOT EXISTS scheme_questions (
  id SERIAL PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES scheme_sections(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  options_json TEXT,
  sub_label_1 TEXT,
  sub_label_2 TEXT,
  parent_question_id INTEGER REFERENCES scheme_questions(id) ON DELETE CASCADE,
  reveal_condition TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(section_id, question_key)
);
