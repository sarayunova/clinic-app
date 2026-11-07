-- Migration 057: Pediatric Renal Surveillance, Peritoneal Dialysis & Neonatal AKI / KDIGO Staging
-- High-risk neonatal and pediatric acute kidney injury (KDIGO AWAKEN criteria),
-- Bedside Schwartz eGFR, Fluid Overload %, Urinary Indices (FENa/FEUrea),
-- and Acute Peritoneal Dialysis (PD) flowsheet with serial cycle ultrafiltration and peritonitis surveillance.

CREATE TABLE IF NOT EXISTS pediatric_renal_assessments (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  assessment_datetime                 TEXT NOT NULL, -- YYYY-MM-DDTHH:MM:SS
  patient_category                    TEXT NOT NULL CHECK (patient_category IN (
                                        'preterm_infant', 'term_infant', 'child',
                                        'adolescent_female', 'adolescent_male'
                                      )),
  height_cm                           REAL NOT NULL,
  dry_weight_kg                       REAL NOT NULL,
  current_weight_kg                   REAL NOT NULL,
  baseline_creatinine_mg_dl           REAL NOT NULL,
  current_creatinine_mg_dl            REAL NOT NULL,
  urine_output_ml                     REAL,
  urine_output_hours                  REAL,
  serum_sodium_meq_l                  REAL,
  urine_sodium_meq_l                  REAL,
  serum_bun_mg_dl                     REAL,
  urine_urea_mg_dl                    REAL,
  urine_creatinine_mg_dl              REAL,

  -- Calculated Clinical Biomarkers
  calculated_egfr                     REAL NOT NULL,
  calculated_uop_ml_kg_h              REAL,
  calculated_fluid_overload_pct       REAL NOT NULL,
  calculated_fena_pct                 REAL,
  calculated_feurea_pct               REAL,
  kdigo_scr_stage                     INTEGER NOT NULL CHECK (kdigo_scr_stage BETWEEN 0 AND 3),
  kdigo_uop_stage                     INTEGER CHECK (kdigo_uop_stage IS NULL OR kdigo_uop_stage BETWEEN 0 AND 3),
  kdigo_overall_stage                 INTEGER NOT NULL CHECK (kdigo_overall_stage BETWEEN 0 AND 3),
  prerenal_vs_atn                     TEXT CHECK (prerenal_vs_atn IN ('prerenal', 'intrinsic_atn', 'indeterminate', 'not_evaluated')),

  -- Risk Exposures & Action Plan
  nephrotoxic_medications             TEXT, -- JSON array of active nephrotoxic medications
  clinical_action_plan                TEXT,
  assessed_by_id                      INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pediatric_renal_patient_id ON pediatric_renal_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_renal_kdigo_stage ON pediatric_renal_assessments(kdigo_overall_stage);
CREATE INDEX IF NOT EXISTS idx_pediatric_renal_datetime ON pediatric_renal_assessments(assessment_datetime);

-- Acute Peritoneal Dialysis (PD) Master Sessions
CREATE TABLE IF NOT EXISTS peritoneal_dialysis_sessions (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  session_number                      TEXT NOT NULL UNIQUE,
  start_datetime                      TEXT NOT NULL,
  end_datetime                        TEXT,
  indication                          TEXT NOT NULL CHECK (indication IN (
                                        'kdigo_stage_3_aki', 'severe_fluid_overload_gt20',
                                        'refractory_hyperkalemia', 'severe_metabolic_acidosis',
                                        'inborn_error_metabolism', 'uremic_encephalopathy', 'other'
                                      )),
  catheter_type                       TEXT NOT NULL CHECK (catheter_type IN (
                                        'acute_rigid_percutaneous', 'flexible_curved_cook',
                                        'tenckhoff_single_cuff', 'tenckhoff_double_cuff', 'other'
                                      )),
  catheter_insertion_date             TEXT,
  patient_weight_kg                   REAL NOT NULL,
  solution_type                       TEXT NOT NULL CHECK (solution_type IN (
                                        'dextrose_1_5', 'dextrose_2_5', 'dextrose_4_25', 'custom_compound'
                                      )),
  fill_volume_ml_per_kg               REAL NOT NULL,
  calculated_fill_volume_ml           REAL NOT NULL,
  inflow_time_minutes                 INTEGER NOT NULL DEFAULT 15,
  dwell_time_minutes                  INTEGER NOT NULL DEFAULT 45,
  drain_time_minutes                  INTEGER NOT NULL DEFAULT 20,
  target_cycles_count                 INTEGER NOT NULL DEFAULT 12,
  heparin_units_per_liter             REAL DEFAULT 500,
  potassium_meq_per_liter             REAL DEFAULT 0,
  antibiotic_additive                 TEXT,
  status                              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'aborted')),
  deactivation_reason                 TEXT,
  prescribed_by_id                    INTEGER NOT NULL REFERENCES users(id),
  completed_by_id                     INTEGER REFERENCES users(id),
  cumulative_inflow_ml                REAL DEFAULT 0,
  cumulative_outflow_ml               REAL DEFAULT 0,
  cumulative_net_uf_ml                REAL DEFAULT 0,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pd_sessions_patient_id ON peritoneal_dialysis_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_pd_sessions_status ON peritoneal_dialysis_sessions(status);

-- Serial Peritoneal Dialysis Bedside Flowsheet Cycle Logs
CREATE TABLE IF NOT EXISTS pd_cycle_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id                          INTEGER NOT NULL REFERENCES peritoneal_dialysis_sessions(id) ON DELETE CASCADE,
  cycle_number                        INTEGER NOT NULL,
  cycle_start_time                    TEXT NOT NULL,
  inflow_ml                           REAL NOT NULL,
  dwell_duration_minutes              INTEGER NOT NULL,
  outflow_ml                          REAL NOT NULL,
  net_uf_ml                           REAL NOT NULL, -- outflow_ml - inflow_ml (positive = net fluid removed)
  cumulative_uf_ml                    REAL NOT NULL,
  effluent_appearance                 TEXT NOT NULL CHECK (effluent_appearance IN (
                                        'clear_straw', 'hazy', 'cloudy_turbid',
                                        'blood_tinged', 'frank_blood', 'fibrin_clots'
                                      )),
  abdominal_girth_cm                  REAL,
  catheter_site_leakage               INTEGER NOT NULL DEFAULT 0, -- 0 or 1 boolean
  patient_tolerance                   TEXT CHECK (patient_tolerance IN (
                                        'well_tolerated', 'mild_distress',
                                        'severe_pain_distension', 'respiratory_compromise'
                                      )),
  nurse_id                            INTEGER NOT NULL REFERENCES users(id),
  notes                               TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pd_cycles_session_id ON pd_cycle_flowsheet_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_pd_cycles_number ON pd_cycle_flowsheet_logs(session_id, cycle_number);

-- Dialysate Effluent & Peritonitis Surveillance
CREATE TABLE IF NOT EXISTS pd_effluent_surveillance (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id                          INTEGER NOT NULL REFERENCES peritoneal_dialysis_sessions(id) ON DELETE CASCADE,
  sample_datetime                     TEXT NOT NULL,
  wbc_count_per_mcl                   INTEGER NOT NULL,
  neutrophils_percent                 REAL NOT NULL,
  gram_stain                          TEXT,
  culture_growth                      TEXT,
  peritonitis_confirmed               INTEGER NOT NULL DEFAULT 0, -- 1 if WBC > 100/mcL and Neutrophils > 50%
  empiric_antibiotic_initiated        TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pd_effluent_session_id ON pd_effluent_surveillance(session_id);
