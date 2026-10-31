-- Foundation: users, sessions, patients, appointments, audit.
-- Timestamps are ISO-8601 UTC strings. Local clinic dates are stored separately where queried by day.

CREATE TABLE users (
  id                  INTEGER PRIMARY KEY,
  username            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name           TEXT NOT NULL,
  role                TEXT NOT NULL CHECK (role IN ('doctor','nurse','attender')),
  password_hash       TEXT NOT NULL,
  active              INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0,1)),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash   TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at   TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Sequential, never-reused patient numbers.
CREATE TABLE counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
INSERT INTO counters(name, value) VALUES ('patient', 0);

CREATE TABLE patients (
  id                    INTEGER PRIMARY KEY,
  patient_number        TEXT NOT NULL UNIQUE,
  full_name             TEXT NOT NULL,
  date_of_birth         TEXT,                 -- YYYY-MM-DD, optional
  estimated_age_years   INTEGER,              -- used when DOB unknown
  phone                 TEXT,
  address               TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,

  -- Allergies: 'unknown' is distinct from 'none' (no known allergies).
  allergy_status        TEXT NOT NULL DEFAULT 'unknown' CHECK (allergy_status IN ('unknown','none','known')),
  allergy_details       TEXT,

  medical_history       TEXT,
  surgical_history      TEXT,
  family_history        TEXT,
  menstrual_history     TEXT,
  last_menstrual_period TEXT,                 -- YYYY-MM-DD as entered; never inferred
  menopause_status      TEXT NOT NULL DEFAULT 'unknown' CHECK (menopause_status IN ('unknown','not_applicable','pre','peri','post')),
  obstetric_history     TEXT,
  gravida               INTEGER,
  para                  INTEGER,
  ongoing_medicines     TEXT,
  clinical_notes        TEXT,

  version               INTEGER NOT NULL DEFAULT 1,
  created_by            INTEGER NOT NULL REFERENCES users(id),
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);
CREATE INDEX idx_patients_name  ON patients(full_name COLLATE NOCASE);
CREATE INDEX idx_patients_phone ON patients(phone);

CREATE TABLE appointments (
  id             INTEGER PRIMARY KEY,
  patient_id     INTEGER NOT NULL REFERENCES patients(id),
  scheduled_at   TEXT NOT NULL,               -- UTC instant
  scheduled_date TEXT NOT NULL,               -- local clinic date YYYY-MM-DD (for day queries)
  reason         TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled','waiting','in_consultation','completed','cancelled','absent')),
  version        INTEGER NOT NULL DEFAULT 1,
  created_by     INTEGER NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX idx_appointments_date ON appointments(scheduled_date, scheduled_at);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);

-- Append-only. Triggers below block UPDATE and DELETE.
CREATE TABLE audit_events (
  id        INTEGER PRIMARY KEY,
  at        TEXT NOT NULL,
  actor_id  INTEGER REFERENCES users(id),
  action    TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id TEXT,
  detail    TEXT                               -- JSON: changed fields (before/after) or context
);
CREATE INDEX idx_audit_entity ON audit_events(entity, entity_id);
CREATE INDEX idx_audit_at ON audit_events(at);

CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_events
BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_events
BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
