-- Migration 071: Acute Severe Obstetric Hypertensive Crisis & Peripartum Cardiomyopathy (PPCM) Resuscitation
-- Reference: ACOG Practice Bulletin No. 222 (Gestational Hypertension and Preeclampsia / Emergent Antihypertensive Therapy),
-- SMFM Consult Series #58, and ESC Heart Failure Association PPCM BOARD Guidelines.

CREATE TABLE IF NOT EXISTS obstetric_hypertensive_crises (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  crisis_code                         TEXT NOT NULL UNIQUE,
  crisis_datetime                     TEXT NOT NULL,
  gestation_weeks                     REAL,
  onset_phase                         TEXT NOT NULL DEFAULT 'antepartum' CHECK (onset_phase IN ('antepartum', 'intrapartum', 'postpartum')),
  initial_sbp                         INTEGER NOT NULL,
  initial_dbp                         INTEGER NOT NULL,
  initial_map                         REAL NOT NULL,
  first_line_agent                    TEXT NOT NULL DEFAULT 'labetalol' CHECK (first_line_agent IN ('labetalol', 'hydralazine', 'nifedipine')),
  asthma_history                      INTEGER NOT NULL DEFAULT 0,
  bradycardia_history                 INTEGER NOT NULL DEFAULT 0,
  mgso4_co_administered               INTEGER NOT NULL DEFAULT 0,
  cumulative_labetalol_mg             REAL NOT NULL DEFAULT 0,
  cumulative_hydralazine_mg           REAL NOT NULL DEFAULT 0,
  cumulative_nifedipine_mg            REAL NOT NULL DEFAULT 0,
  final_sbp                           INTEGER,
  final_dbp                           INTEGER,
  final_map                           REAL,
  blood_pressure_controlled           INTEGER NOT NULL DEFAULT 0,
  fetal_heart_rate_status             TEXT DEFAULT 'normal' CHECK (fetal_heart_rate_status IN ('normal', 'category_1', 'category_2', 'category_3', 'postpartum_na')),
  ppcm_screen_positive                INTEGER NOT NULL DEFAULT 0,
  lvef_percent                        REAL,
  nt_pro_bnp_pg_ml                    REAL,
  troponin_i_ng_ml                    REAL,
  board_bromocriptine_started         INTEGER NOT NULL DEFAULT 0,
  board_oral_hf_rx                    TEXT,
  board_anticoagulation_started       INTEGER NOT NULL DEFAULT 0,
  board_diuretics_started             INTEGER NOT NULL DEFAULT 0,
  status                              TEXT NOT NULL DEFAULT 'active_crisis' CHECK (status IN ('active_crisis', 'controlled_surveillance', 'resolved', 'icu_transferred')),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS obstetric_hypertensive_dose_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  crisis_id                           INTEGER NOT NULL REFERENCES obstetric_hypertensive_crises(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                        TEXT NOT NULL,
  step_number                         INTEGER NOT NULL DEFAULT 1,
  sbp                                 INTEGER NOT NULL,
  dbp                                 INTEGER NOT NULL,
  map_mmhg                            REAL NOT NULL,
  medication_administered             TEXT NOT NULL,
  dose_value                          REAL NOT NULL,
  dose_unit                           TEXT NOT NULL DEFAULT 'mg',
  route                               TEXT NOT NULL DEFAULT 'IV',
  fetal_heart_rate                    INTEGER,
  maternal_symptoms                   TEXT,
  notes                               TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obs_htn_patient ON obstetric_hypertensive_crises(patient_id);
CREATE INDEX IF NOT EXISTS idx_obs_htn_status ON obstetric_hypertensive_crises(status);
CREATE INDEX IF NOT EXISTS idx_obs_htn_dose_crisis ON obstetric_hypertensive_dose_logs(crisis_id);
