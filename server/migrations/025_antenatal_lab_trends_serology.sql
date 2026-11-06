-- Antenatal Longitudinal Lab Trends & Serology Tracker
-- Tracks longitudinal parameters (Hb, Platelets, TSH, Ferritin, 75g OGTT curve, Uric acid/UPCR)
-- and maternal infectious disease serology matrix (HIV, HBsAg, HCV, VDRL, Rubella, Rh/ICT, Anti-D, GBS, HPLC).

CREATE TABLE antenatal_lab_trends (
  id                              INTEGER PRIMARY KEY,
  patient_id                      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  test_date                       TEXT NOT NULL,            -- YYYY-MM-DD
  gestational_age_weeks           INTEGER,
  gestational_age_days            INTEGER,
  trimester                       TEXT NOT NULL DEFAULT 't1' CHECK (trimester IN ('t1', 't2', 't3')),
  
  -- Parameter identification
  parameter_key                   TEXT NOT NULL CHECK (parameter_key IN (
                                    'hb', 'platelets', 'tsh', 'ft4', 'ferritin', 'serum_iron', 'tibc',
                                    'ogtt_fasting', 'ogtt_1hr', 'ogtt_2hr', 'fbs', 'ppbs', 'hba1c',
                                    'serum_creatinine', 'uric_acid', 'urine_albumin', 'upcr'
                                  )),
  parameter_name                  TEXT NOT NULL,
  numeric_value                   REAL NOT NULL,
  unit                            TEXT NOT NULL,
  reference_range                 TEXT,
  abnormal_flag                   TEXT NOT NULL DEFAULT 'normal' CHECK (abnormal_flag IN ('normal', 'low', 'high', 'critical')),
  
  clinical_action                 TEXT,                     -- e.g. "Oral iron stepped up", "Inj FCM 1g planned", "Levothyroxine 50mcg started"
  lab_result_id                   INTEGER REFERENCES patient_lab_results(id) ON DELETE SET NULL,
  attachment_id                   INTEGER REFERENCES attachments(id) ON DELETE SET NULL,
  
  created_by                      INTEGER NOT NULL REFERENCES users(id),
  created_at                      TEXT NOT NULL
);

CREATE INDEX idx_lab_trends_patient ON antenatal_lab_trends(patient_id, test_date DESC);
CREATE INDEX idx_lab_trends_param ON antenatal_lab_trends(patient_id, parameter_key, test_date ASC);

CREATE TABLE antenatal_serology_matrix (
  id                              INTEGER PRIMARY KEY,
  patient_id                      INTEGER NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  
  -- Blood Group & Rh / Alloimmunization
  blood_group_abo                 TEXT,                     -- A, B, AB, O
  rh_factor                       TEXT CHECK (rh_factor IN ('positive', 'negative')),
  indirect_coombs_test_booking    TEXT DEFAULT 'not_done' CHECK (indirect_coombs_test_booking IN ('negative', 'positive', 'not_done')),
  indirect_coombs_test_28w        TEXT DEFAULT 'not_done' CHECK (indirect_coombs_test_28w IN ('negative', 'positive', 'not_done')),
  anti_d_given                    INTEGER NOT NULL DEFAULT 0, -- 1 if Anti-D administered
  anti_d_given_date               TEXT,
  anti_d_batch_dose               TEXT,                     -- e.g. "300 mcg (1500 IU) IM"
  
  -- Core Antenatal Infectious Disease Screening
  hiv_status                      TEXT NOT NULL DEFAULT 'not_tested' CHECK (hiv_status IN ('non_reactive', 'reactive', 'pending', 'not_tested')),
  hiv_tested_date                 TEXT,
  hbsag_status                    TEXT NOT NULL DEFAULT 'not_tested' CHECK (hbsag_status IN ('non_reactive', 'reactive', 'pending', 'not_tested')),
  hbsag_tested_date               TEXT,
  hcv_status                      TEXT NOT NULL DEFAULT 'not_tested' CHECK (hcv_status IN ('non_reactive', 'reactive', 'pending', 'not_tested')),
  hcv_tested_date                 TEXT,
  vdrl_rpr_status                 TEXT NOT NULL DEFAULT 'not_tested' CHECK (vdrl_rpr_status IN ('non_reactive', 'reactive', 'pending', 'not_tested')),
  vdrl_rpr_titer                  TEXT,                     -- e.g. "1:8", "Non-reactive"
  vdrl_tested_date                TEXT,
  
  -- Immunity & Other Pathogens
  rubella_igg_status              TEXT NOT NULL DEFAULT 'not_tested' CHECK (rubella_igg_status IN ('immune', 'non_immune', 'equivocal', 'not_tested')),
  rubella_igg_value               REAL,                     -- IU/mL
  rubella_tested_date             TEXT,
  
  gbs_culture_status              TEXT NOT NULL DEFAULT 'not_tested' CHECK (gbs_culture_status IN ('negative', 'positive', 'pending', 'not_tested')),
  gbs_tested_date                 TEXT,                     -- 35-37 weeks
  
  urine_culture_status            TEXT NOT NULL DEFAULT 'not_tested' CHECK (urine_culture_status IN ('no_growth', 'significant_growth', 'mixed_growth', 'not_tested')),
  urine_culture_organism          TEXT,                     -- e.g. "E. coli > 10^5 CFU/mL"
  urine_culture_date              TEXT,
  
  hemoglobinopathy_hplc           TEXT NOT NULL DEFAULT 'not_tested' CHECK (hemoglobinopathy_hplc IN ('normal_a1_a2', 'beta_thalassemia_trait', 'sickle_cell_trait', 'hb_e_trait', 'other_variant', 'not_tested')),
  hplc_hba2_pct                   REAL,                     -- e.g. 5.4% (> 3.5% diagnostic of Beta Thal Trait)
  hplc_tested_date                TEXT,
  
  consultant_review_notes         TEXT,
  updated_by                      INTEGER NOT NULL REFERENCES users(id),
  updated_at                      TEXT NOT NULL
);

CREATE INDEX idx_serology_patient ON antenatal_serology_matrix(patient_id);
