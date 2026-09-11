-- Akpoly Computer Engineering System - Initial Schema
-- SQLite dialect (deployed on Raspberry Pi, file lives on external SSD/HDD)

PRAGMA foreign_keys = ON;

-- Core identity table shared by every role
CREATE TABLE IF NOT EXISTS users (
    id                  TEXT PRIMARY KEY,           -- uuid
    role                TEXT NOT NULL CHECK (role IN ('student','lecturer','hod','technician')),
    first_name          TEXT NOT NULL,
    last_name           TEXT NOT NULL,
    middle_name         TEXT,
    email               TEXT NOT NULL UNIQUE,
    phone               TEXT NOT NULL,
    password_hash       TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','active','rejected','suspended')),
    email_verified_at   TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    approved_by         TEXT REFERENCES users(id),
    approved_at         TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Student-specific profile fields
CREATE TABLE IF NOT EXISTS students (
    user_id             TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    registration_number TEXT NOT NULL UNIQUE,
    admission_year      INTEGER NOT NULL,
    date_of_birth       TEXT NOT NULL,               -- YYYY-MM-DD
    department          TEXT NOT NULL DEFAULT 'Computer Engineering',
    level               TEXT,                         -- ND1, ND2, HND1, HND2
    receipt_file_id     TEXT REFERENCES files(id)
);

-- Lecturer-specific profile fields
CREATE TABLE IF NOT EXISTS lecturers (
    user_id             TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    staff_id            TEXT NOT NULL UNIQUE,
    domain_validated    INTEGER NOT NULL DEFAULT 0,   -- boolean: institutional email domain checked
    title               TEXT                          -- e.g. Engr., Dr., Mr., Mrs.
);

-- HOD / Management-specific profile fields
CREATE TABLE IF NOT EXISTS hods (
    user_id             TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    activated_via_key   INTEGER NOT NULL DEFAULT 0,   -- boolean: admin passcode used at registration
    ownership_holder    INTEGER NOT NULL DEFAULT 0    -- boolean: currently holds site ownership control
);

-- Uploaded files (fee receipts, documents) - stored outside the public web root
CREATE TABLE IF NOT EXISTS files (
    id                  TEXT PRIMARY KEY,
    owner_id            TEXT REFERENCES users(id) ON DELETE SET NULL,
    original_name       TEXT NOT NULL,
    stored_name         TEXT NOT NULL,               -- safe, randomized filename on disk
    mime_type           TEXT NOT NULL,
    size_bytes          INTEGER NOT NULL,
    category            TEXT NOT NULL CHECK (category IN ('receipt','document','other')),
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One-time passcodes for login/registration verification
CREATE TABLE IF NOT EXISTS otp_codes (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash           TEXT NOT NULL,               -- OTP is hashed at rest, never stored plain
    purpose             TEXT NOT NULL CHECK (purpose IN ('registration','login','password_reset')),
    expires_at          TEXT NOT NULL,
    consumed_at         TEXT,
    attempt_count       INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_otp_user_purpose ON otp_codes(user_id, purpose);

-- Security / activity audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
    id                  TEXT PRIMARY KEY,
    actor_id            TEXT REFERENCES users(id) ON DELETE SET NULL,
    action              TEXT NOT NULL,               -- e.g. 'login_success', 'registration_submitted'
    target_type         TEXT,                        -- e.g. 'user', 'result', 'file'
    target_id           TEXT,
    ip_address          TEXT,
    user_agent          TEXT,
    metadata_json        TEXT,                        -- free-form JSON details
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

-- Sessions (for revocable, device-aware login; JWT jti is tracked here)
CREATE TABLE IF NOT EXISTS sessions (
    id                  TEXT PRIMARY KEY,             -- jti
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint  TEXT NOT NULL,
    ip_address          TEXT,
    user_agent          TEXT,
    is_recognized_device INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at          TEXT NOT NULL,
    revoked_at          TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
