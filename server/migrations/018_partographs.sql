-- WHO Partograph / Labor Progress Monitor
-- Tracks cervical dilatation, alert/action lines, fetal descent, FHR, liquor, molding, uterine contractions, maternal vitals, and delivery outcomes.

INSERT OR IGNORE INTO counters(name, value) VALUES ('partograph', 0);

CREATE TABLE partographs (
  id                          INTEGER PRIMARY KEY,
  partograph_number           TEXT NOT NULL UNIQUE,
  patient_id                  INTEGER NOT NULL REFERENCES patients(id),
  admission_id                INTEGER REFERENCES admissions(id),
  start_time                  TEXT NOT NULL,            -- ISO UTC instant when active phase monitoring began
  status                      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'discontinued')),
  parity                      TEXT,                     -- e.g. G2 P1 L1
  gestational_age_weeks       REAL,                     -- e.g. 39.2
  rupture_of_membranes_time   TEXT,                     -- ISO UTC instant
  fetal_position              TEXT,                     -- e.g. LOA, ROA, LOT, ROT, OP
  alert_line_start_hours      REAL NOT NULL DEFAULT 0.0, -- hours from start when dilatation reached active phase (>=4cm)
  alert_line_start_cm         REAL NOT NULL DEFAULT 4.0,
  outcome                     TEXT CHECK (outcome IS NULL OR outcome IN ('normal_vaginal', 'assisted_vacuum', 'assisted_forceps', 'emergency_lscs', 'elective_lscs', 'transferred')),
  outcome_notes               TEXT,
  delivery_time               TEXT,                     -- ISO UTC instant
  baby_gender                 TEXT CHECK (baby_gender IS NULL OR baby_gender IN ('male', 'female', 'ambiguous')),
  baby_weight_grams           INTEGER,
  apgar_1min                  INTEGER CHECK (apgar_1min IS NULL OR (apgar_1min >= 0 AND apgar_1min <= 10)),
  apgar_5min                  INTEGER CHECK (apgar_5min IS NULL OR (apgar_5min >= 0 AND apgar_5min <= 10)),
  created_by                  INTEGER NOT NULL REFERENCES users(id),
  created_at                  TEXT NOT NULL,
  updated_at                  TEXT NOT NULL
);

CREATE INDEX idx_partographs_patient ON partographs(patient_id, created_at);
CREATE INDEX idx_partographs_admission ON partographs(admission_id);

CREATE TABLE partograph_entries (
  id                          INTEGER PRIMARY KEY,
  partograph_id               INTEGER NOT NULL REFERENCES partographs(id) ON DELETE CASCADE,
  recorded_at                 TEXT NOT NULL,            -- ISO UTC instant
  hours_from_start            REAL NOT NULL,            -- elapsed hours since start_time (e.g. 0.0, 0.5, 1.0)
  -- Fetal condition
  fetal_heart_rate            INTEGER,                  -- bpm (60-220)
  liquor                      TEXT CHECK (liquor IS NULL OR liquor IN ('I', 'C', 'M', 'A', 'B')), -- Intact, Clear, Meconium, Absent, Blood
  molding                     TEXT CHECK (molding IS NULL OR molding IN ('0', '+', '++', '+++')),
  -- Labor progress
  cervical_dilatation_cm      REAL CHECK (cervical_dilatation_cm IS NULL OR (cervical_dilatation_cm >= 0.0 AND cervical_dilatation_cm <= 10.0)),
  station_descent             TEXT CHECK (station_descent IS NULL OR station_descent IN ('5/5', '4/5', '3/5', '2/5', '1/5', '0/5')),
  -- Contractions
  contractions_count          INTEGER CHECK (contractions_count IS NULL OR (contractions_count >= 0 AND contractions_count <= 10)),
  contractions_intensity      TEXT CHECK (contractions_intensity IS NULL OR contractions_intensity IN ('mild', 'moderate', 'strong')),
  contractions_duration_sec   INTEGER,
  -- Medications / Fluids
  oxytocin_u_per_l            REAL,                     -- Units/L
  oxytocin_drops_per_min      INTEGER,                  -- drops/min
  drugs_given                 TEXT,
  iv_fluids                   TEXT,
  -- Maternal condition
  maternal_pulse_bpm          INTEGER,
  maternal_systolic_mmhg      INTEGER,
  maternal_diastolic_mmhg     INTEGER,
  maternal_temperature_c      REAL,
  urine_protein               TEXT,
  urine_ketones               TEXT,
  urine_volume_ml             INTEGER,
  -- Notes & staff attribution
  clinical_notes              TEXT,
  recorded_by                 INTEGER NOT NULL REFERENCES users(id),
  created_at                  TEXT NOT NULL
);

CREATE INDEX idx_partograph_entries_partograph ON partograph_entries(partograph_id, recorded_at);
