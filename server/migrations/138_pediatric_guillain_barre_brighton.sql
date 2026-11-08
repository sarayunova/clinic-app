-- Migration 138: Pediatric Guillain-Barré Syndrome (GBS) & Brighton Diagnostic Criteria Protocol
-- Reference: Brighton Collaboration GBS Criteria / AAP / Peripheral Nerve Society / Hughes Disability Scale

CREATE TABLE IF NOT EXISTS pediatric_gbs_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  onset_datetime                        TEXT NOT NULL,
  age_years                             REAL NOT NULL,
  weight_kg                             REAL NOT NULL,
  antecedent_infection_type             TEXT NOT NULL CHECK (antecedent_infection_type IN (
                                          'campylobacter_gastroenteritis',
                                          'upper_respiratory_viral',
                                          'ebv_cmv_infection',
                                          'none_identified'
                                        )),
  brighton_criteria_level               TEXT NOT NULL CHECK (brighton_criteria_level IN (
                                          'level_1_highest_certainty_csf_ncs',
                                          'level_2_csf_or_ncs',
                                          'level_3_clinical_only',
                                          'level_4_unclassifiable'
                                        )),
  hughes_disability_score               INTEGER NOT NULL CHECK (hughes_disability_score BETWEEN 0 AND 6),
  ascending_symmetric_weakness          INTEGER NOT NULL DEFAULT 1 CHECK (ascending_symmetric_weakness IN (0, 1)),
  areflexia_or_hyporeflexia             INTEGER NOT NULL DEFAULT 1 CHECK (areflexia_or_hyporeflexia IN (0, 1)),
  csf_protein_mg_dl                     REAL NOT NULL,
  csf_wbc_count_per_ul                  INTEGER NOT NULL,
  vital_capacity_ml_kg                  REAL NOT NULL,
  negative_inspiratory_force_cmh2o      REAL NOT NULL,
  peak_expiratory_pressure_cmh2o        REAL NOT NULL,
  dysautonomia_signs_present            INTEGER NOT NULL DEFAULT 0 CHECK (dysautonomia_signs_present IN (0, 1)),
  immunotherapy_regimen                 TEXT NOT NULL DEFAULT 'ivig_2g_kg_over_2_days' CHECK (immunotherapy_regimen IN (
                                          'ivig_2g_kg_over_2_days',
                                          'ivig_2g_kg_over_5_days',
                                          'plasma_exchange_tpe',
                                          'supportive_care_only'
                                        )),
  corticosteroids_avoided               INTEGER NOT NULL DEFAULT 1 CHECK (corticosteroids_avoided IN (0, 1)),
  status                                TEXT NOT NULL DEFAULT 'acute_diagnostic_evaluation' CHECK (status IN (
                                          'acute_diagnostic_evaluation',
                                          'picu_ventilatory_support',
                                          'immunotherapy_infusion_active',
                                          'dysautonomia_telemetry_monitoring',
                                          'subacute_rehabilitation_weaning',
                                          'resolved_full_motor_recovery'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gbs_patient ON pediatric_gbs_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_gbs_status ON pediatric_gbs_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_gbs_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  gbs_episode_id                        INTEGER NOT NULL REFERENCES pediatric_gbs_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                          TEXT NOT NULL,
  day_of_illness                        INTEGER NOT NULL,
  hughes_score_current                  INTEGER NOT NULL CHECK (hughes_score_current BETWEEN 0 AND 6),
  vital_capacity_ml_kg                  REAL NOT NULL,
  single_breath_count                   INTEGER NOT NULL,
  cranial_nerve_palsy_facial_bulbar     INTEGER NOT NULL DEFAULT 0 CHECK (cranial_nerve_palsy_facial_bulbar IN (0, 1)),
  neck_flexion_power_mrc                INTEGER NOT NULL CHECK (neck_flexion_power_mrc BETWEEN 0 AND 5),
  heart_rate_bpm                        INTEGER NOT NULL,
  systolic_bp                           INTEGER NOT NULL,
  diastolic_bp                          INTEGER NOT NULL,
  urinary_retention_catheterized        INTEGER NOT NULL DEFAULT 0 CHECK (urinary_retention_catheterized IN (0, 1)),
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gbs_flowsheet_episode ON pediatric_gbs_flowsheet_logs(gbs_episode_id);
CREATE INDEX IF NOT EXISTS idx_gbs_flowsheet_patient ON pediatric_gbs_flowsheet_logs(patient_id);
