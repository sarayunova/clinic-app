-- Inpatient care, slice A: beds, admissions, care entries.

CREATE TABLE beds (
  id         INTEGER PRIMARY KEY,
  room       TEXT NOT NULL,
  label      TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL,
  UNIQUE (room, label)
);

INSERT INTO counters(name, value) VALUES ('admission', 0);

CREATE TABLE admissions (
  id               INTEGER PRIMARY KEY,
  admission_number TEXT NOT NULL UNIQUE,
  patient_id       INTEGER NOT NULL REFERENCES patients(id),
  bed_id           INTEGER NOT NULL REFERENCES beds(id),
  admitted_at      TEXT NOT NULL,                -- clinical time (UTC)
  status           TEXT NOT NULL DEFAULT 'admitted' CHECK (status IN ('admitted','discharged')),
  reason           TEXT NOT NULL,
  diagnosis        TEXT,
  initial_assessment TEXT,
  treatment_plan   TEXT,
  discharged_at    TEXT,
  version          INTEGER NOT NULL DEFAULT 1,
  created_by       INTEGER NOT NULL REFERENCES users(id),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  CHECK ((status = 'discharged') = (discharged_at IS NOT NULL)),
  CHECK (discharged_at IS NULL OR discharged_at >= admitted_at)
);
CREATE INDEX idx_admissions_patient ON admissions(patient_id, admitted_at);

-- The rules the spec requires, enforced by the database itself:
-- a bed holds at most one active admission, and a patient has at most one.
CREATE UNIQUE INDEX uq_admission_bed_active     ON admissions(bed_id)     WHERE status = 'admitted';
CREATE UNIQUE INDEX uq_admission_patient_active ON admissions(patient_id) WHERE status = 'admitted';

CREATE TRIGGER admissions_no_delete BEFORE DELETE ON admissions
BEGIN SELECT RAISE(ABORT, 'admissions cannot be deleted'); END;

-- Care entries are append-only. A correction is a new entry that points at the original.
CREATE TABLE care_entries (
  id            INTEGER PRIMARY KEY,
  admission_id  INTEGER NOT NULL REFERENCES admissions(id),
  entry_type    TEXT NOT NULL CHECK (entry_type IN ('doctor_round','nursing_note','observation','procedure','investigation')),
  clinical_at   TEXT NOT NULL,                  -- when it happened
  created_at    TEXT NOT NULL,                  -- when it was recorded
  author_id     INTEGER NOT NULL REFERENCES users(id),
  content       TEXT,
  systolic_mmhg  INTEGER,
  diastolic_mmhg INTEGER,
  pulse_bpm      INTEGER,
  temperature_c  REAL,
  spo2_pct       INTEGER,
  resp_rate      INTEGER,
  corrects_id       INTEGER REFERENCES care_entries(id),
  correction_reason TEXT,
  CHECK ((corrects_id IS NULL) = (correction_reason IS NULL)),
  CHECK (correction_reason IS NULL OR length(trim(correction_reason)) >= 5)
);
CREATE INDEX idx_care_admission ON care_entries(admission_id, clinical_at);
CREATE INDEX idx_care_corrects ON care_entries(corrects_id);
CREATE TRIGGER care_no_update BEFORE UPDATE ON care_entries
BEGIN SELECT RAISE(ABORT, 'care entries are append-only'); END;
CREATE TRIGGER care_no_delete BEFORE DELETE ON care_entries
BEGIN SELECT RAISE(ABORT, 'care entries are append-only'); END;
