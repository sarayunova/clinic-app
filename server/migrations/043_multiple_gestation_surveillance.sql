-- Migration 043: Multiple Gestation Surveillance Tracker (Twins & Triplets)
-- Chorionicity/Amnionicity determination, Quintero TTTS Staging, Gratacós sFGR Staging,
-- TAPS MCA-PSV Discordance, Inter-twin EFW/AC Discordance, and Tailored Surveillance Protocols.

CREATE TABLE IF NOT EXISTS multiple_gestation_pregnancies (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  plurality                           TEXT NOT NULL DEFAULT 'twins' CHECK (plurality IN ('twins', 'triplets')),
  chorionicity                        TEXT NOT NULL CHECK (chorionicity IN ('dcda', 'mcda', 'mcma', 'tcta', 'dcta', 'mc')),
  amnionicity                         TEXT NOT NULL CHECK (amnionicity IN ('diamniotic', 'monoamniotic', 'triamniotic')),
  first_trimester_sign                TEXT CHECK (first_trimester_sign IS NULL OR first_trimester_sign IN ('lambda_sign', 't_sign', 'no_dividing_membrane')),
  dividing_membrane_thickness_mm      REAL,
  placental_configuration             TEXT CHECK (placental_configuration IS NULL OR placental_configuration IN ('two_separate', 'two_fused', 'single_anterior', 'single_posterior', 'single_fundal')),
  conception_method                   TEXT DEFAULT 'spontaneous' CHECK (conception_method IN ('spontaneous', 'ivf_et', 'ovulation_induction')),
  status                              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'delivered', 'archived')),
  diagnosis_gestation_weeks           INTEGER,
  baseline_notes                      TEXT,

  created_by                          INTEGER NOT NULL REFERENCES users(id),
  updated_by                          INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL,
  updated_at                          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mg_pregnancies_patient ON multiple_gestation_pregnancies(patient_id);
CREATE INDEX IF NOT EXISTS idx_mg_pregnancies_status ON multiple_gestation_pregnancies(status);

CREATE TABLE IF NOT EXISTS multiple_gestation_assessments (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  pregnancy_id                        INTEGER NOT NULL REFERENCES multiple_gestation_pregnancies(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  ultrasound_report_id                INTEGER REFERENCES patient_ultrasound_reports(id) ON DELETE SET NULL,
  assessment_date                     TEXT NOT NULL, -- YYYY-MM-DD
  assessment_time                     TEXT, -- HH:MM
  gestational_age_weeks               INTEGER NOT NULL,
  gestational_age_days                INTEGER NOT NULL DEFAULT 0,

  -- Individual Fetuses Data (JSON Array of biometry, Doppler, fluid, and anatomic findings)
  fetuses_json                        TEXT NOT NULL,

  -- Calculated Concordance & Discordance Metrics
  efw_discordance_percent             REAL NOT NULL DEFAULT 0,
  ac_discordance_percent              REAL NOT NULL DEFAULT 0,
  dvp_discordance_cm                  REAL NOT NULL DEFAULT 0,
  discordance_severity                TEXT NOT NULL CHECK (discordance_severity IN ('concordant', 'mild_discordance', 'significant_discordance_gt_20', 'severe_discordance_gt_25')),
  larger_fetus_label                  TEXT,
  smaller_fetus_label                 TEXT,

  -- Complications Staging
  ttts_stage                          TEXT NOT NULL DEFAULT 'none' CHECK (ttts_stage IN ('none', 'stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5')),
  sfgr_type                           TEXT NOT NULL DEFAULT 'none' CHECK (sfgr_type IN ('none', 'type_1', 'type_2', 'type_3')),
  taps_stage                          TEXT NOT NULL DEFAULT 'none' CHECK (taps_stage IN ('none', 'stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5')),
  cord_entanglement_noted             INTEGER DEFAULT 0 CHECK (cord_entanglement_noted IN (0, 1)),

  -- Clinical Surveillance & Delivery Timing Guidelines
  surveillance_interval_recommendation TEXT NOT NULL,
  delivery_timing_recommendation      TEXT NOT NULL,
  delivery_mode_recommendation        TEXT NOT NULL,
  corticosteroids_indicated           INTEGER DEFAULT 0 CHECK (corticosteroids_indicated IN (0, 1)),
  action_plan                         TEXT,

  clinical_notes                      TEXT,
  performed_by                        TEXT,
  reviewed_by                         INTEGER NOT NULL REFERENCES users(id),
  created_by                          INTEGER NOT NULL REFERENCES users(id),
  updated_by                          INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL,
  updated_at                          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mg_assessments_pregnancy ON multiple_gestation_assessments(pregnancy_id);
CREATE INDEX IF NOT EXISTS idx_mg_assessments_patient ON multiple_gestation_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_mg_assessments_date ON multiple_gestation_assessments(assessment_date);
CREATE INDEX IF NOT EXISTS idx_mg_assessments_ttts ON multiple_gestation_assessments(ttts_stage);
CREATE INDEX IF NOT EXISTS idx_mg_assessments_sfgr ON multiple_gestation_assessments(sfgr_type);
