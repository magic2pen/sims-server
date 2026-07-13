-- Stores the raw numeric grading sum (0-70) alongside the letter grade,
-- so trend-over-time charts can compute averages without re-parsing
-- every inspection's full answers_json each time.

ALTER TABLE inspections ADD COLUMN IF NOT EXISTS grade_score INTEGER;
