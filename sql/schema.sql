-- SIMS Central Server — Database Schema (Phase A, first slice)
-- Run this once against your PostgreSQL database before starting the server.

CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS officers (
    id SERIAL PRIMARY KEY,
    officer_id TEXT UNIQUE NOT NULL,       -- e.g. "OFF-0001", assigned by admin
    employee_code TEXT,
    name TEXT NOT NULL,
    designation TEXT,                       -- e.g. Inspector of Schools, DEO, BDO, SDM, ADM, DM
    department TEXT,
    district TEXT,
    subdivision TEXT,
    block TEXT,
    mobile_number TEXT,
    email TEXT UNIQUE NOT NULL,
    office TEXT,
    profile_photo_url TEXT,
    status TEXT NOT NULL DEFAULT 'active',  -- 'active' or 'inactive'
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by_admin_id INTEGER REFERENCES admins(id)
);

CREATE INDEX IF NOT EXISTS idx_officers_district ON officers(district);
CREATE INDEX IF NOT EXISTS idx_officers_status ON officers(status);
