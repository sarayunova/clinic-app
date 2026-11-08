-- Migration 119: Obstetric External Cephalic Version (ECV) & Non-Cephalic Protocol
-- Reference: ACOG Practice Bulletin No. 13 / RCOG Green-top Guideline No. 20a

CREATE TABLE IF NOT EXISTS obstetric_ecv_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  procedure_datetime                  TEXT NOT NULL,
  gestational_age_weeks               REAL NOT NULL,
  maternal_parity                     INTEGER NOT NULL DEFAULT 0,
  maternal_bmi                        REAL NOT NULL,
  fetal_presentation_initial          TEXT NOT NULL CHECK (fetal_presentation_initial IN (
                                        'frank_breech',
                                        'complete_breech',
                                        'footling_incomplete_breech',
                                        'transverse_lie',
                                        'oblique_lie'
                                      )),
  placental_location                  TEXT NOT NULL CHECK (placental_location IN (
                                        'posterior',
                                        'fundal',
                                        'lateral',
                                        'anterior',
                                        'low_lying_placenta_previa'
                                      )),
  amniotic_fluid_index_cm             REAL NOT NULL,
  estimated_fetal_weight_g            INTEGER NOT NULL,
  fetal_spine_position                TEXT NOT NULL CHECK (fetal_spine_position IN (
                                        'posterior',
                                        'lateral',
                                        'anterior'
                                      )),
  fetal_engagement_level              TEXT NOT NULL CHECK (fetal_engagement_level IN (
                                        'high_unengaged_floating',
                                        'dipping_in_pelvis',
                                        'deeply_engaged'
                                      )),
  tocolytic_agent_administered        TEXT NOT NULL CHECK (tocolytic_agent_administered IN (
                                        'terbutaline_0_25mg_sc',
                                        'salbutamol_iv',
                                        'nitroglycerin_sublingual',
                                        'none_attempted'
                                      )),
  terbutaline_given                   INTEGER NOT NULL DEFAULT 1 CHECK (terbutaline_given IN (0, 1)),
  maternal_rh_negative                INTEGER NOT NULL DEFAULT 0 CHECK (maternal_rh_negative IN (0, 1)),
  rh_anti_d_administered              INTEGER NOT NULL DEFAULT 0 CHECK (rh_anti_d_administered IN (0, 1)),
  kleihauer_betke_sent                INTEGER NOT NULL DEFAULT 0 CHECK (kleihauer_betke_sent IN (0, 1)),
  contraindications_present           INTEGER NOT NULL DEFAULT 0 CHECK (contraindications_present IN (0, 1)),
  attempts_count                      INTEGER NOT NULL DEFAULT 1,
  forward_roll_attempted              INTEGER NOT NULL DEFAULT 1 CHECK (forward_roll_attempted IN (0, 1)),
  backward_flip_attempted             INTEGER NOT NULL DEFAULT 0 CHECK (backward_flip_attempted IN (0, 1)),
  ecv_outcome                         TEXT NOT NULL CHECK (ecv_outcome IN (
                                        'successful_cephalic_conversion',
                                        'failed_breech_persistent',
                                        'procedure_aborted_fhr_deceleration',
                                        'emergency_cesarean_transfer'
                                      )),
  calculated_success_probability_pct  REAL NOT NULL,
  status                              TEXT NOT NULL DEFAULT 'pre_procedure_assessment' CHECK (status IN (
                                        'pre_procedure_assessment',
                                        'tocolysis_in_progress',
                                        'version_attempts_active',
                                        'successful_monitoring_discharge',
                                        'emergency_delivery_transfer',
                                        'elective_cesarean_scheduled'
                                      )),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_ecv_patient ON obstetric_ecv_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_obstetric_ecv_status ON obstetric_ecv_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_ecv_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  ecv_episode_id                      INTEGER NOT NULL REFERENCES obstetric_ecv_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                        TEXT NOT NULL,
  minutes_from_start                  REAL NOT NULL,
  maternal_heart_rate                 INTEGER NOT NULL,
  maternal_blood_pressure_sys         INTEGER,
  maternal_blood_pressure_dia         INTEGER,
  fetal_heart_rate_baseline           INTEGER NOT NULL,
  efm_pattern                         TEXT NOT NULL CHECK (efm_pattern IN (
                                        'reactive_reassuring',
                                        'transient_bradycardia_self_resolved',
                                        'persistent_severe_bradycardia',
                                        'tachycardia_post_terbutaline'
                                      )),
  uterine_relaxation_adequate         INTEGER NOT NULL DEFAULT 1 CHECK (uterine_relaxation_adequate IN (0, 1)),
  notes                               TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ecv_logs_episode ON obstetric_ecv_flowsheet_logs(ecv_episode_id);
