-- Migration 117: Pediatric Kawasaki Disease (KD) & Coronary Artery Aneurysm Prevention Protocol
-- Reference: AHA 2017 Guidelines / Kobayashi Score for IVIG Resistance

CREATE TABLE IF NOT EXISTS pediatric_kawasaki_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  presentation_datetime               TEXT NOT NULL,
  age_months                          INTEGER NOT NULL,
  weight_kg                           REAL NOT NULL,
  fever_duration_days                 INTEGER NOT NULL, -- >= 5 days typical
  conjunctivitis_bilateral_bulbar     INTEGER NOT NULL DEFAULT 1 CHECK (conjunctivitis_bilateral_bulbar IN (0, 1)),
  oral_mucosal_changes                INTEGER NOT NULL DEFAULT 1 CHECK (oral_mucosal_changes IN (0, 1)), -- strawberry tongue, erythema, fissured lips
  polymorphous_exanthem_rash          INTEGER NOT NULL DEFAULT 1 CHECK (polymorphous_exanthem_rash IN (0, 1)),
  peripheral_extremity_changes        INTEGER NOT NULL DEFAULT 1 CHECK (peripheral_extremity_changes IN (0, 1)), -- erythema, indurative edema, periungual desquamation
  cervical_lymphadenopathy_ge_1_5cm   INTEGER NOT NULL DEFAULT 0 CHECK (cervical_lymphadenopathy_ge_1_5cm IN (0, 1)),
  bcg_scar_erythema                   INTEGER NOT NULL DEFAULT 0 CHECK (bcg_scar_erythema IN (0, 1)),
  perineal_erythema_desquamation      INTEGER NOT NULL DEFAULT 0 CHECK (perineal_erythema_desquamation IN (0, 1)),
  principal_criteria_count            INTEGER NOT NULL, -- 0-5
  diagnosis_classification            TEXT NOT NULL CHECK (diagnosis_classification IN (
                                        'classic_complete_kd',
                                        'incomplete_atypical_kd',
                                        'suspected_kd_evaluating'
                                      )),
  crp_mg_l                            REAL NOT NULL, -- >= 30
  esr_mm_hr                           REAL NOT NULL, -- >= 40
  serum_albumin_g_dl                  REAL, -- <= 3.0
  serum_sodium_meq_l                  REAL, -- <= 133
  platelet_count                      REAL, -- >= 450,000 in convalescent, or <= 300,000 early
  wbc_count                           REAL, -- >= 15,000
  alt_u_l                             REAL, -- > 50
  neutrophil_pct                      REAL, -- >= 80%
  sterile_pyuria_present              INTEGER NOT NULL DEFAULT 0 CHECK (sterile_pyuria_present IN (0, 1)),
  kobayashi_score                     INTEGER NOT NULL DEFAULT 0,
  ivig_resistance_risk                TEXT NOT NULL CHECK (ivig_resistance_risk IN (
                                        'low_risk',
                                        'high_risk'
                                      )),
  ivig_administered                   INTEGER NOT NULL DEFAULT 1 CHECK (ivig_administered IN (0, 1)),
  ivig_dose_g_kg                      REAL NOT NULL DEFAULT 2.0,
  aspirin_dose_mg_kg_day              REAL NOT NULL DEFAULT 40.0,
  echo_performed                      INTEGER NOT NULL DEFAULT 1 CHECK (echo_performed IN (0, 1)),
  lad_z_score                         REAL,
  rca_z_score                         REAL,
  coronary_aneurysm_classification    TEXT NOT NULL CHECK (coronary_aneurysm_classification IN (
                                        'normal_z_lt_2',
                                        'dilation_z_2_to_2_5',
                                        'small_aneurysm_z_2_5_to_5',
                                        'medium_aneurysm_z_5_to_10',
                                        'giant_aneurysm_ge_10_or_ge_8mm'
                                      )),
  status                              TEXT NOT NULL DEFAULT 'active_diagnostic_workup' CHECK (status IN (
                                        'active_diagnostic_workup',
                                        'ivig_infusion_in_progress',
                                        'afebrile_post_ivig_monitoring',
                                        'ivig_resistant_retreatment',
                                        'resolved_discharged'
                                      )),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_kawasaki_patient ON pediatric_kawasaki_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_kawasaki_status ON pediatric_kawasaki_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_kawasaki_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  kawasaki_episode_id                 INTEGER NOT NULL REFERENCES pediatric_kawasaki_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                        TEXT NOT NULL,
  hours_from_admission                REAL NOT NULL,
  temperature_celsius                 REAL NOT NULL,
  heart_rate                          INTEGER NOT NULL,
  blood_pressure_sys                  INTEGER,
  blood_pressure_dia                  INTEGER,
  ivig_infusion_running               INTEGER NOT NULL DEFAULT 0 CHECK (ivig_infusion_running IN (0, 1)),
  aspirin_dose_given_mg               REAL,
  rash_appearance                     TEXT,
  extremity_edema                     TEXT,
  notes                               TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kawasaki_logs_episode ON pediatric_kawasaki_flowsheet_logs(kawasaki_episode_id);
