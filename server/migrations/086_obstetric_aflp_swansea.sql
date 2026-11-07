-- Migration 086: Obstetric Acute Fatty Liver of Pregnancy (AFLP), Swansea Diagnostic Criteria & Emergency MDT Protocol
-- References: Swansea Diagnostic Criteria (Gut 2002; RCOG Green-top Guideline, EASL Liver in Pregnancy)

CREATE TABLE IF NOT EXISTS obstetric_aflp_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  diagnosis_datetime TEXT NOT NULL,
  gestation_weeks REAL NOT NULL,
  vomiting_present INTEGER NOT NULL DEFAULT 0 CHECK(vomiting_present IN (0, 1)),
  abdominal_pain_present INTEGER NOT NULL DEFAULT 0 CHECK(abdominal_pain_present IN (0, 1)),
  polydipsia_polyuria_present INTEGER NOT NULL DEFAULT 0 CHECK(polydipsia_polyuria_present IN (0, 1)),
  encephalopathy_present INTEGER NOT NULL DEFAULT 0 CHECK(encephalopathy_present IN (0, 1)),
  elevated_bilirubin INTEGER NOT NULL DEFAULT 0 CHECK(elevated_bilirubin IN (0, 1)),
  hypoglycemia_present INTEGER NOT NULL DEFAULT 0 CHECK(hypoglycemia_present IN (0, 1)),
  elevated_urate INTEGER NOT NULL DEFAULT 0 CHECK(elevated_urate IN (0, 1)),
  leukocytosis_present INTEGER NOT NULL DEFAULT 0 CHECK(leukocytosis_present IN (0, 1)),
  ascites_or_bright_liver INTEGER NOT NULL DEFAULT 0 CHECK(ascites_or_bright_liver IN (0, 1)),
  elevated_transaminases INTEGER NOT NULL DEFAULT 0 CHECK(elevated_transaminases IN (0, 1)),
  elevated_ammonia INTEGER NOT NULL DEFAULT 0 CHECK(elevated_ammonia IN (0, 1)),
  renal_impairment INTEGER NOT NULL DEFAULT 0 CHECK(renal_impairment IN (0, 1)),
  coagulopathy_present INTEGER NOT NULL DEFAULT 0 CHECK(coagulopathy_present IN (0, 1)),
  microvesicular_steatosis_biopsy INTEGER NOT NULL DEFAULT 0 CHECK(microvesicular_steatosis_biopsy IN (0, 1)),
  total_swansea_criteria_met INTEGER NOT NULL CHECK(total_swansea_criteria_met BETWEEN 0 AND 14),
  aflp_confirmed INTEGER NOT NULL CHECK(aflp_confirmed IN (0, 1)),
  serum_glucose_mg_dl REAL,
  serum_bilirubin_total_mg_dl REAL,
  ast_u_l REAL,
  alt_u_l REAL,
  serum_creatinine_mg_dl REAL,
  pt_seconds REAL,
  inr REAL,
  dextrose_infusion_active INTEGER NOT NULL DEFAULT 0 CHECK(dextrose_infusion_active IN (0, 1)),
  delivery_urgency TEXT NOT NULL DEFAULT 'immediate_emergent_delivery' CHECK(delivery_urgency IN (
    'immediate_emergent_delivery',
    'urgent_stabilize_then_deliver',
    'delivered_postpartum_management'
  )),
  delivery_performed INTEGER NOT NULL DEFAULT 0 CHECK(delivery_performed IN (0, 1)),
  delivery_datetime TEXT,
  lchad_newborn_screening_alert INTEGER NOT NULL DEFAULT 1 CHECK(lchad_newborn_screening_alert IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'evaluating' CHECK(status IN (
    'evaluating',
    'active_critical_resuscitation',
    'postpartum_icu_monitoring',
    'hepatic_recovery',
    'resolved'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_aflp_patient ON obstetric_aflp_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_obstetric_aflp_status ON obstetric_aflp_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_aflp_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aflp_episode_id INTEGER NOT NULL REFERENCES obstetric_aflp_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  hours_from_diagnosis REAL NOT NULL DEFAULT 0,
  blood_glucose_mg_dl REAL NOT NULL,
  dextrose_infusion_rate_ml_hr REAL NOT NULL DEFAULT 0,
  dextrose_concentration_percent REAL NOT NULL DEFAULT 10,
  sbp_mmhg INTEGER,
  dbp_mmhg INTEGER,
  hr_bpm INTEGER,
  encephalopathy_grade INTEGER NOT NULL DEFAULT 0 CHECK(encephalopathy_grade BETWEEN 0 AND 4),
  urine_output_ml_hr REAL,
  platelet_count INTEGER,
  fibrinogen_mg_dl REAL,
  pt_seconds REAL,
  inr REAL,
  blood_products_administered TEXT,
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_aflp_logs_episode ON obstetric_aflp_flowsheet_logs(aflp_episode_id);
