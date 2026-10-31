-- OPD consultations: visits, vitals entries, prescription items, immutable revisions.

CREATE TABLE visits (
  id             INTEGER PRIMARY KEY,
  patient_id     INTEGER NOT NULL REFERENCES patients(id),
  appointment_id INTEGER UNIQUE REFERENCES appointments(id),
  visit_at       TEXT NOT NULL,                 -- clinical time of the visit (UTC)
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','final')),

  -- Doctor-entered clinical content. Nothing here is generated or inferred.
  complaints     TEXT,
  history        TEXT,
  examination    TEXT,
  assessment     TEXT,
  antenatal_notes TEXT,
  investigations TEXT,
  advice         TEXT,
  follow_up_date TEXT,                          -- YYYY-MM-DD

  version        INTEGER NOT NULL DEFAULT 1,
  created_by     INTEGER NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL,                 -- when the record was created (differs from visit_at)
  updated_at     TEXT NOT NULL,
  finalised_at   TEXT,
  finalised_by   INTEGER REFERENCES users(id),

  CHECK ((status = 'final') = (finalised_at IS NOT NULL AND finalised_by IS NOT NULL))
);
CREATE INDEX idx_visits_patient ON visits(patient_id, visit_at);

-- Clinical records are never deleted.
CREATE TRIGGER visits_no_delete BEFORE DELETE ON visits
BEGIN SELECT RAISE(ABORT, 'visits cannot be deleted'); END;

-- Each reading is its own entry with author and time; corrections are new entries.
CREATE TABLE visit_vitals (
  id          INTEGER PRIMARY KEY,
  visit_id    INTEGER NOT NULL REFERENCES visits(id),
  recorded_at TEXT NOT NULL,
  recorded_by INTEGER NOT NULL REFERENCES users(id),
  systolic_mmhg   INTEGER,
  diastolic_mmhg  INTEGER,
  pulse_bpm       INTEGER,
  temperature_c   REAL,
  weight_kg       REAL,
  height_cm       REAL,
  note        TEXT
);
CREATE INDEX idx_vitals_visit ON visit_vitals(visit_id);
CREATE TRIGGER vitals_no_update BEFORE UPDATE ON visit_vitals
BEGIN SELECT RAISE(ABORT, 'vitals entries are append-only'); END;
CREATE TRIGGER vitals_no_delete BEFORE DELETE ON visit_vitals
BEGIN SELECT RAISE(ABORT, 'vitals entries are append-only'); END;

CREATE TABLE prescription_items (
  id           INTEGER PRIMARY KEY,
  visit_id     INTEGER NOT NULL REFERENCES visits(id),
  position     INTEGER NOT NULL,
  medicine     TEXT NOT NULL,
  strength     TEXT,
  dose         TEXT,
  route        TEXT,
  frequency    TEXT,
  duration     TEXT,
  instructions TEXT,
  UNIQUE (visit_id, position)
);

-- Revision 1 is the content as first finalised; every later amendment adds a row.
-- Snapshots are full copies, so the original is always recoverable.
CREATE TABLE visit_revisions (
  id          INTEGER PRIMARY KEY,
  visit_id    INTEGER NOT NULL REFERENCES visits(id),
  revision_no INTEGER NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('final','amendment')),
  author_id   INTEGER NOT NULL REFERENCES users(id),
  at          TEXT NOT NULL,
  reason      TEXT,                              -- required for amendments
  changes     TEXT,                              -- JSON {field: {from, to}} for amendments
  snapshot    TEXT NOT NULL,                     -- JSON of clinical fields + prescription items
  UNIQUE (visit_id, revision_no),
  CHECK (kind = 'final' OR (reason IS NOT NULL AND length(trim(reason)) >= 5))
);
CREATE TRIGGER revisions_no_update BEFORE UPDATE ON visit_revisions
BEGIN SELECT RAISE(ABORT, 'visit revisions are append-only'); END;
CREATE TRIGGER revisions_no_delete BEFORE DELETE ON visit_revisions
BEGIN SELECT RAISE(ABORT, 'visit revisions are append-only'); END;
