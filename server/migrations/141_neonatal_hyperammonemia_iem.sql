-- Migration 141: Neonatal Inborn Errors of Metabolism (IEM) Hyperammonemic Crisis Protocol
-- Reference: ACMG / SIMD / BIMDG Guidelines

CREATE TABLE IF NOT EXISTS neonatal_hyperammonemia_iem_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  onset_datetime                        TEXT NOT NULL,
  age_hours                             INTEGER NOT NULL,
  birth_weight_grams                    INTEGER NOT NULL,
  gestational_age_weeks                 REAL NOT NULL,
  plasma_ammonia_umol_l                 REAL NOT NULL,
  blood_gas_acid_base_pattern           TEXT NOT NULL CHECK (blood_gas_acid_base_pattern IN (
                                          'respiratory_alkalosis',
                                          'high_anion_gap_metabolic_acidosis',
                                          'normal_compensated',
                                          'mixed_acid_base'
                                        )),
  plasma_lactate_mmol_l                 REAL NOT NULL,
  anion_gap_meq_l                       REAL NOT NULL,
  urine_ketones_present                 INTEGER NOT NULL DEFAULT 0 CHECK (urine_ketones_present IN (0, 1)),
  suspected_disorder_category           TEXT NOT NULL CHECK (suspected_disorder_category IN (
                                          'urea_cycle_disorder_ucd',
                                          'organic_acidemia_oa',
                                          'fatty_acid_oxidation_faod',
                                          'undifferentiated_hyperammonemia'
                                        )),
  protein_intake_halted                 INTEGER NOT NULL DEFAULT 1 CHECK (protein_intake_halted IN (0, 1)),
  high_calorie_dextrose_active          INTEGER NOT NULL DEFAULT 1 CHECK (high_calorie_dextrose_active IN (0, 1)),
  gir_mg_kg_min                         REAL NOT NULL DEFAULT 10.0,
  nitrogen_scavenger_ammonul_active     INTEGER NOT NULL DEFAULT 1 CHECK (nitrogen_scavenger_ammonul_active IN (0, 1)),
  iv_l_arginine_active                  INTEGER NOT NULL DEFAULT 1 CHECK (iv_l_arginine_active IN (0, 1)),
  iv_l_carnitine_active                 INTEGER NOT NULL DEFAULT 0 CHECK (iv_l_carnitine_active IN (0, 1)),
  crrt_dialysis_indicated               INTEGER NOT NULL DEFAULT 0 CHECK (crrt_dialysis_indicated IN (0, 1)),
  crrt_dialysis_active                  INTEGER NOT NULL DEFAULT 0 CHECK (crrt_dialysis_active IN (0, 1)),
  status                                TEXT NOT NULL DEFAULT 'acute_hyperammonemic_crisis' CHECK (status IN (
                                          'acute_hyperammonemic_crisis',
                                          'medical_scavenger_infusion',
                                          'emergency_crrt_hemodialysis',
                                          'catabolism_reversal_stabilization',
                                          'controlled_protein_reintroduction',
                                          'convalescent_metabolic_maintenance',
                                          'neonatal_demise'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_iem_patient ON neonatal_hyperammonemia_iem_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_iem_status ON neonatal_hyperammonemia_iem_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_hyperammonemia_iem_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id                            INTEGER NOT NULL REFERENCES neonatal_hyperammonemia_iem_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                          TEXT NOT NULL,
  hours_from_crisis_onset               REAL NOT NULL,
  plasma_ammonia_umol_l                 REAL NOT NULL,
  ph_value                              REAL NOT NULL,
  pco2_mmhg                             REAL NOT NULL,
  bicarbonate_meq_l                     REAL NOT NULL,
  glucose_mg_dl                         REAL NOT NULL,
  gir_mg_kg_min                         REAL NOT NULL,
  dialysis_blood_flow_ml_min            REAL NOT NULL DEFAULT 0.0,
  encephalopathy_grade                  TEXT NOT NULL CHECK (encephalopathy_grade IN (
                                          'grade_1_mild_lethargy_poor_feeding',
                                          'grade_2_moderate_somnolence_hyperreflexia',
                                          'grade_3_severe_stupor_decerebrate_posturing',
                                          'grade_4_deep_coma_fixed_dilated_pupils'
                                        )),
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_iem_flowsheet_ep ON neonatal_hyperammonemia_iem_flowsheet_logs(episode_id);
CREATE INDEX IF NOT EXISTS idx_iem_flowsheet_pat ON neonatal_hyperammonemia_iem_flowsheet_logs(patient_id);
