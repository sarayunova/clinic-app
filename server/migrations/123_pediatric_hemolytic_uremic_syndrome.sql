-- Migration 123: Pediatric Hemolytic Uremic Syndrome (STEC-HUS & Atypical HUS) Protocol
-- Reference: IPNA Clinical Practice Guidelines / AAP Pediatric Nephrology

CREATE TABLE IF NOT EXISTS pediatric_hus_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  onset_datetime                        TEXT NOT NULL,
  age_years                             REAL NOT NULL,
  weight_kg                             REAL NOT NULL,
  prodromal_bloody_diarrhea             INTEGER NOT NULL DEFAULT 1 CHECK (prodromal_bloody_diarrhea IN (0, 1)),
  shiga_toxin_tested                    INTEGER NOT NULL DEFAULT 1 CHECK (shiga_toxin_tested IN (0, 1)),
  shiga_toxin_result                    TEXT NOT NULL CHECK (shiga_toxin_result IN (
                                          'positive_stec',
                                          'negative',
                                          'pending'
                                        )),
  hemoglobin_g_dl                       REAL NOT NULL,
  platelet_count                        INTEGER NOT NULL,
  serum_creatinine_mg_dl                REAL NOT NULL,
  baseline_creatinine_mg_dl             REAL NOT NULL,
  kdigo_aki_stage                       TEXT NOT NULL CHECK (kdigo_aki_stage IN (
                                          'stage_1',
                                          'stage_2',
                                          'stage_3_failure'
                                        )),
  schistocytes_present_pct              REAL NOT NULL,
  serum_ldh_u_l                         INTEGER NOT NULL,
  direct_coombs_test                    TEXT NOT NULL CHECK (direct_coombs_test IN (
                                          'negative',
                                          'positive_non_stec',
                                          'not_performed'
                                        )),
  serum_potassium_meq_l                 REAL NOT NULL,
  oliguria_anuria_duration_hours        REAL NOT NULL DEFAULT 0.0,
  hypertension_present                  INTEGER NOT NULL DEFAULT 0 CHECK (hypertension_present IN (0, 1)),
  neurological_involvement              TEXT NOT NULL CHECK (neurological_involvement IN (
                                          'none',
                                          'lethargy_irritability',
                                          'seizures_altered_mental_status',
                                          'coma_stroke'
                                        )),
  hus_phenotype                         TEXT NOT NULL CHECK (hus_phenotype IN (
                                          'typical_stec_d_plus',
                                          'atypical_complement_mediated_ahus',
                                          'secondary_pneumococcal_or_other'
                                        )),
  antibiotics_avoided_strict            INTEGER NOT NULL DEFAULT 1 CHECK (antibiotics_avoided_strict IN (0, 1)),
  antimotility_agents_avoided           INTEGER NOT NULL DEFAULT 1 CHECK (antimotility_agents_avoided IN (0, 1)),
  dialysis_rrt_indicated                INTEGER NOT NULL DEFAULT 0 CHECK (dialysis_rrt_indicated IN (0, 1)),
  dialysis_modality                     TEXT NOT NULL CHECK (dialysis_modality IN (
                                          'none',
                                          'peritoneal_dialysis',
                                          'crrt_cvvhdf',
                                          'hemodialysis'
                                        )),
  eculizumab_indicated                  INTEGER NOT NULL DEFAULT 0 CHECK (eculizumab_indicated IN (0, 1)),
  status                                TEXT NOT NULL DEFAULT 'active_fluid_electrolyte_management' CHECK (status IN (
                                          'active_fluid_electrolyte_management',
                                          'dialysis_crrt_running',
                                          'eculizumab_infusion',
                                          'renal_recovery_phase',
                                          'resolved_normal_renal_function'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_hus_patient ON pediatric_hus_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_hus_status ON pediatric_hus_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_hus_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  hus_episode_id                        INTEGER NOT NULL REFERENCES pediatric_hus_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                          TEXT NOT NULL,
  hours_from_onset                      REAL NOT NULL,
  urine_output_ml_kg_hr                 REAL NOT NULL,
  fluid_balance_24h_ml                  REAL,
  platelet_count                        INTEGER NOT NULL,
  serum_creatinine_mg_dl                REAL NOT NULL,
  serum_potassium_meq_l                 REAL NOT NULL,
  blood_pressure_sys                    INTEGER NOT NULL,
  blood_pressure_dia                    INTEGER NOT NULL,
  neurological_status                   TEXT NOT NULL CHECK (neurological_status IN (
                                          'alert',
                                          'irritable',
                                          'somnolent',
                                          'seizure_activity'
                                        )),
  dialysis_ultrafiltration_ml           REAL,
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_hus_logs_episode ON pediatric_hus_flowsheet_logs(hus_episode_id);
