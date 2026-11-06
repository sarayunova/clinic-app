-- Pediatric Birth Profile & Childhood Immunization Schedule Tracker
CREATE TABLE patient_pediatric_profiles (
  patient_id                      INTEGER PRIMARY KEY REFERENCES patients(id),
  birth_weight_kg                 REAL,
  birth_length_cm                 REAL,
  birth_head_circumference_cm     REAL,
  gestational_age_weeks           INTEGER,
  delivery_type                   TEXT CHECK (delivery_type IS NULL OR delivery_type IN ('normal_vaginal', 'cesarean', 'assisted', 'other')),
  birth_hospital                  TEXT,
  apgar_1min                      INTEGER CHECK (apgar_1min IS NULL OR (apgar_1min >= 0 AND apgar_1min <= 10)),
  apgar_5min                      INTEGER CHECK (apgar_5min IS NULL OR (apgar_5min >= 0 AND apgar_5min <= 10)),
  blood_group                     TEXT,
  birth_notes                     TEXT,
  updated_by                      INTEGER NOT NULL REFERENCES users(id),
  updated_at                      TEXT NOT NULL
);

CREATE TABLE patient_vaccinations (
  id              INTEGER PRIMARY KEY,
  patient_id      INTEGER NOT NULL REFERENCES patients(id),
  vaccine_key     TEXT NOT NULL,
  vaccine_name    TEXT NOT NULL,
  milestone_group TEXT NOT NULL,
  target_disease  TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'given', 'scheduled', 'exempt', 'delayed')),
  given_date      TEXT,
  batch_number    TEXT,
  route_site      TEXT,
  administered_by TEXT,
  notes           TEXT,
  attachment_id   INTEGER REFERENCES attachments(id),
  updated_by      INTEGER NOT NULL REFERENCES users(id),
  updated_at      TEXT NOT NULL,
  UNIQUE(patient_id, vaccine_key)
);

CREATE INDEX idx_vaccinations_patient ON patient_vaccinations(patient_id);
