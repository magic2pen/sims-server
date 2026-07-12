-- Adds the schools table. Safe to run more than once (IF NOT EXISTS).
-- Run this the same way you ran schema.sql — through the Setup box on
-- test.html once we add that option, OR you can run this SQL manually
-- later if you ever get real Shell/psql access.

CREATE TABLE IF NOT EXISTS schools (
    id SERIAL PRIMARY KEY,
    udise_code TEXT,
    name TEXT NOT NULL,
    category TEXT,              -- Junior Basic / Senior Basic / High School / Higher Secondary
    district TEXT NOT NULL,
    subdivision TEXT,
    block TEXT NOT NULL,
    address TEXT,
    headmaster_name TEXT,
    headmaster_phone TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schools_district ON schools(district);
CREATE INDEX IF NOT EXISTS idx_schools_block ON schools(block);
CREATE INDEX IF NOT EXISTS idx_schools_name ON schools(name);
