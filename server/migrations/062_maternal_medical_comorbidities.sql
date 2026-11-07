-- Migration 062: High-Risk Antenatal Maternal Medical Comorbidities
-- Reference: RCOG Green-top Guideline #43 (Obstetric Cholestasis / ICP),
-- European Society of Cardiology (ESC) Guidelines on Cardiovascular Disease during Pregnancy (mWHO & CARPREG-II).

CREATE TABLE IF NOT EXISTS maternal_cardiac_assessments (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  assessment_code                     TEXT NOT NULL UNIQUE,
  assessment_datetime                 TEXT NOT NULL,
  gestational_age_weeks               REAL,
  cardiac_diagnosis                   TEXT NOT NULL,
  mwho_class                          TEXT NOT NULL CHECK (mwho_class IN (
                                        'mwho_I', 'mwho_II', 'mwho_II_III', 'mwho_III', 'mwho_IV'
                                      )),
  prior_cardiac_event                 INTEGER NOT NULL DEFAULT 0, -- 1 = yes
  prior_arrhythmia                    INTEGER NOT NULL DEFAULT 0,
  nyha_class_baseline                 TEXT NOT NULL CHECK (nyha_class_baseline IN ('I', 'II', 'III', 'IV')),
  left_heart_obstruction              INTEGER NOT NULL DEFAULT 0,
  reduced_systemic_ventricular_function_ef_lt50 INTEGER NOT NULL DEFAULT 0,
  high_risk_valve_or_aorta            INTEGER NOT NULL DEFAULT 0,
  late_pregnancy_presentation         INTEGER NOT NULL DEFAULT 0,
  carpreg_ii_score                    INTEGER NOT NULL,
  predicted_cardiac_event_risk_pct    REAL NOT NULL,
  monitoring_plan_antepartum          TEXT,
  delivery_mode_recommendation        TEXT NOT NULL DEFAULT 'vaginal_with_assisted_second_stage',
  anesthesia_recommendation           TEXT,
  icu_postpartum_bed_reserved         INTEGER NOT NULL DEFAULT 0,
  attending_cardiologist_name         TEXT,
  consultant_obgyn_id                 INTEGER NOT NULL REFERENCES users(id),
  notes                               TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cardiac_patient ON maternal_cardiac_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_cardiac_mwho ON maternal_cardiac_assessments(mwho_class);

CREATE TABLE IF NOT EXISTS maternal_icp_surveillance (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  observation_datetime                TEXT NOT NULL,
  gestational_age_weeks               REAL,
  pruritus_severity                   TEXT NOT NULL CHECK (pruritus_severity IN (
                                        'mild_nocturnal_palms_soles', 'moderate_continuous', 'severe_intractable_excoriations'
                                      )),
  total_serum_bile_acids_umol_l       REAL NOT NULL,
  icp_severity_tier                   TEXT NOT NULL CHECK (icp_severity_tier IN (
                                        'mild_10_39', 'moderate_40_99', 'severe_100_plus'
                                      )),
  alt_u_l                             REAL,
  ast_u_l                             REAL,
  total_bilirubin_mg_dl               REAL,
  udca_prescribed_mg_day              REAL NOT NULL DEFAULT 0.0,
  udca_dose_mg_kg_day                 REAL NOT NULL DEFAULT 0.0,
  recommended_delivery_gestation_weeks REAL NOT NULL,
  fetal_surveillance_interval_days    INTEGER NOT NULL DEFAULT 7,
  status                              TEXT NOT NULL DEFAULT 'active_monitoring' CHECK (status IN (
                                        'active_monitoring', 'delivered', 'resolved'
                                      )),
  assessed_by_id                      INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_icp_patient ON maternal_icp_surveillance(patient_id);
CREATE INDEX IF NOT EXISTS idx_icp_severity ON maternal_icp_surveillance(icp_severity_tier);
