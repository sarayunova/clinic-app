-- Migration 070: Neonatal Sepsis (Kaiser EOS & I/T Ratio) & Targeted Hemodynamic Inotrope Stewardship
-- Reference: Kaiser Permanente Neonatal Early-Onset Sepsis Calculator, AAP 2018 Sepsis Guidelines,
-- and Neonatal Hemodynamics / Targeted Neonatal Echocardiography (TnECHO) Consensus.

CREATE TABLE IF NOT EXISTS neonatal_sepsis_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  evaluation_datetime                 TEXT NOT NULL,
  gestational_age_weeks               REAL NOT NULL,
  gestational_age_days                INTEGER NOT NULL DEFAULT 0,
  birth_weight_kg                     REAL NOT NULL,
  maternal_temp_celsius               REAL NOT NULL,
  rom_hours                           REAL NOT NULL DEFAULT 0,
  maternal_gbs_status                 TEXT NOT NULL DEFAULT 'unknown' CHECK (maternal_gbs_status IN ('positive', 'negative', 'unknown')),
  maternal_iap_status                 TEXT NOT NULL DEFAULT 'none' CHECK (maternal_iap_status IN ('adequate', 'inadequate', 'none')),
  clinical_presentation               TEXT NOT NULL DEFAULT 'well_appearing' CHECK (clinical_presentation IN ('well_appearing', 'equivocal', 'clinical_illness')),
  eos_risk_per_1000                   REAL NOT NULL DEFAULT 0,
  eos_recommendation                  TEXT NOT NULL DEFAULT 'routine_care' CHECK (eos_recommendation IN ('routine_care', 'serial_physical_exams', 'blood_culture_empiric_antibiotics')),
  blood_culture_drawn                 INTEGER NOT NULL DEFAULT 0,
  blood_culture_result                TEXT DEFAULT 'pending',
  empiric_antibiotics_started         INTEGER NOT NULL DEFAULT 0,
  ampicillin_dose_mg                  REAL,
  gentamicin_dose_mg                  REAL,
  it_ratio                            REAL,
  crp_mg_l                            REAL,
  micro_esr_mm_hr                     REAL,
  platelets_k_ul                      REAL,
  los_suspected                       INTEGER NOT NULL DEFAULT 0,
  los_action_plan                     TEXT,
  status                              TEXT NOT NULL DEFAULT 'evaluating' CHECK (status IN ('evaluating', 'active_treatment', 'surveillance_complete', 'resolved', 'escalated_septic_shock')),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS neonatal_inotrope_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  sepsis_episode_id                   INTEGER NOT NULL REFERENCES neonatal_sepsis_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                        TEXT NOT NULL,
  hours_on_inotropes                  REAL NOT NULL DEFAULT 0,
  heart_rate_bpm                      INTEGER,
  blood_pressure_systolic             INTEGER,
  blood_pressure_diastolic            INTEGER,
  map_mmhg                            REAL,
  pre_ductal_spo2                     REAL,
  post_ductal_spo2                    REAL,
  delta_spo2                          REAL,
  svc_flow_ml_kg_min                  REAL,
  urine_output_ml_kg_hr               REAL,
  dopamine_mcg_kg_min                 REAL DEFAULT 0,
  dobutamine_mcg_kg_min               REAL DEFAULT 0,
  epinephrine_mcg_kg_min              REAL DEFAULT 0,
  milrinone_mcg_kg_min                REAL DEFAULT 0,
  hydrocortisone_mg_kg                REAL DEFAULT 0,
  ino_ppm                             REAL DEFAULT 0,
  notes                               TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_sepsis_patient ON neonatal_sepsis_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_sepsis_status ON neonatal_sepsis_episodes(status);
CREATE INDEX IF NOT EXISTS idx_neonatal_inotrope_episode ON neonatal_inotrope_flowsheet_logs(sepsis_episode_id);
