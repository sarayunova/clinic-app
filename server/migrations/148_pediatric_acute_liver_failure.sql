-- Series 41C: Pediatric Acute Liver Failure (PALF) & Hepatic Encephalopathy
CREATE TABLE IF NOT EXISTS pediatric_acute_liver_failure_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  episode_number TEXT NOT NULL UNIQUE,
  diagnosis_datetime TEXT NOT NULL,
  age_months INTEGER NOT NULL,
  weight_kg REAL NOT NULL,
  suspected_etiology TEXT NOT NULL, -- 'acetaminophen_toxicity', 'viral_hepatitis', 'autoimmune_hepatitis', 'metabolic_wilson_galactosemia', 'ischemic_shock', 'drug_induced_dili', 'gestational_neonatal_hemochromatosis', 'indeterminate'
  encephalopathy_stage INTEGER NOT NULL DEFAULT 0, -- 0 (None), 1 (Mild confusion/sleep disturbance), 2 (Lethargy/disorientation), 3 (Somnolence/stupor), 4 (Coma)
  inr REAL NOT NULL,
  total_bilirubin_mg_dl REAL NOT NULL,
  direct_bilirubin_mg_dl REAL,
  alt_u_l REAL NOT NULL,
  ast_u_l REAL NOT NULL,
  serum_ammonia_umol_l REAL,
  blood_glucose_mg_dl REAL NOT NULL,
  serum_sodium_meq_l REAL,
  serum_creatinine_mg_dl REAL,
  has_cerebral_edema INTEGER NOT NULL DEFAULT 0,
  hypertonic_saline_3pct_active INTEGER NOT NULL DEFAULT 0,
  mannitol_administered INTEGER NOT NULL DEFAULT 0,
  nac_infusion_active INTEGER NOT NULL DEFAULT 0,
  lactulose_active INTEGER NOT NULL DEFAULT 0,
  transplant_center_contacted INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'stabilized', 'resolved', 'transferred')),
  clinical_summary TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_palf_patient ON pediatric_acute_liver_failure_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_palf_status ON pediatric_acute_liver_failure_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_acute_liver_failure_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL REFERENCES pediatric_acute_liver_failure_episodes(id) ON DELETE CASCADE,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  encephalopathy_stage INTEGER NOT NULL,
  pupil_reactivity TEXT NOT NULL, -- 'brisk_equal', 'sluggish', 'asymmetric', 'fixed_dilated'
  mean_arterial_pressure_mmhg REAL,
  heart_rate_bpm INTEGER,
  gcs_score INTEGER,
  blood_glucose_mg_dl REAL,
  serum_sodium_meq_l REAL,
  serum_ammonia_umol_l REAL,
  daily_stool_count INTEGER NOT NULL DEFAULT 0,
  icp_monitoring_notes TEXT,
  nurse_notes TEXT,
  recorded_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_palf_flowsheet_episode ON pediatric_acute_liver_failure_flowsheet_logs(episode_id);
