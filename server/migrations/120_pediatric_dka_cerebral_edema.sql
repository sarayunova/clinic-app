-- Migration 120: Pediatric DKA Cerebral Edema & Emergent Hyperosmolar Rescue Protocol
-- Reference: ISPAD 2022 Guidelines / Muir Diagnostic Criteria for DKA Cerebral Edema

CREATE TABLE IF NOT EXISTS pediatric_dka_cerebral_edema_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  detection_datetime                  TEXT NOT NULL,
  age_years                           REAL NOT NULL,
  weight_kg                           REAL NOT NULL,
  gcs_score                           INTEGER NOT NULL, -- 3 to 15
  headache_severe_sudden              INTEGER NOT NULL DEFAULT 1 CHECK (headache_severe_sudden IN (0, 1)),
  lethargy_or_confusion               INTEGER NOT NULL DEFAULT 1 CHECK (lethargy_or_confusion IN (0, 1)),
  recurrent_emesis_post_hydration     INTEGER NOT NULL DEFAULT 1 CHECK (recurrent_emesis_post_hydration IN (0, 1)),
  bradycardia_cushing_triad           INTEGER NOT NULL DEFAULT 0 CHECK (bradycardia_cushing_triad IN (0, 1)),
  hypertension_diastolic_ge_90        INTEGER NOT NULL DEFAULT 0 CHECK (hypertension_diastolic_ge_90 IN (0, 1)),
  cranial_nerve_palsy                 INTEGER NOT NULL DEFAULT 0 CHECK (cranial_nerve_palsy IN (0, 1)),
  pupillary_abnormality               TEXT NOT NULL CHECK (pupillary_abnormality IN (
                                        'normal_reactive',
                                        'sluggish',
                                        'unequal_anisocoria',
                                        'dilated_fixed'
                                      )),
  decorticate_decerebrate_posturing   INTEGER NOT NULL DEFAULT 0 CHECK (decorticate_decerebrate_posturing IN (0, 1)),
  blood_glucose_mg_dl                 REAL NOT NULL,
  serum_sodium_measured_meq_l         REAL NOT NULL,
  serum_sodium_corrected_meq_l        REAL NOT NULL,
  serum_potassium_meq_l               REAL NOT NULL,
  effective_serum_osmolality_mosm_kg  REAL NOT NULL,
  blood_ph                            REAL NOT NULL,
  serum_bicarbonate_meq_l             REAL NOT NULL,
  muir_criteria_category              TEXT NOT NULL CHECK (muir_criteria_category IN (
                                        'diagnostic_cerebral_edema',
                                        'impending_warning_signs',
                                        'standard_dka_no_edema'
                                      )),
  primary_hyperosmolar_agent          TEXT NOT NULL CHECK (primary_hyperosmolar_agent IN (
                                        'hypertonic_saline_3pct',
                                        'mannitol_20pct',
                                        'dual_hyperosmolar_rescue'
                                      )),
  hyperosmolar_dose_ml                REAL NOT NULL,
  fluid_rate_reduced_by_30pct         INTEGER NOT NULL DEFAULT 1 CHECK (fluid_rate_reduced_by_30pct IN (0, 1)),
  head_of_bed_elevated_30deg          INTEGER NOT NULL DEFAULT 1 CHECK (head_of_bed_elevated_30deg IN (0, 1)),
  status                              TEXT NOT NULL DEFAULT 'emergent_hyperosmolar_rescue' CHECK (status IN (
                                        'emergent_hyperosmolar_rescue',
                                        'hypertonic_saline_infusing',
                                        'picu_neuro_monitoring',
                                        'neurological_recovery_gcs15',
                                        'brainstem_herniation_critical'
                                      )),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_dka_ce_patient ON pediatric_dka_cerebral_edema_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_dka_ce_status ON pediatric_dka_cerebral_edema_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_dka_cerebral_edema_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  dka_cerebral_episode_id             INTEGER NOT NULL REFERENCES pediatric_dka_cerebral_edema_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                        TEXT NOT NULL,
  hours_from_detection                REAL NOT NULL,
  gcs_score                           INTEGER NOT NULL,
  pupil_size_and_reactivity           TEXT NOT NULL,
  heart_rate                          INTEGER NOT NULL,
  blood_pressure_sys                  INTEGER NOT NULL,
  blood_pressure_dia                  INTEGER NOT NULL,
  blood_glucose_mg_dl                 REAL NOT NULL,
  serum_sodium_measured_meq_l         REAL NOT NULL,
  serum_sodium_corrected_meq_l        REAL NOT NULL,
  hyperosmolar_agent_given            TEXT,
  iv_fluid_rate_ml_hr                 REAL NOT NULL,
  neurological_exam_notes             TEXT,
  notes                               TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dka_ce_logs_episode ON pediatric_dka_cerebral_edema_flowsheet_logs(dka_cerebral_episode_id);
