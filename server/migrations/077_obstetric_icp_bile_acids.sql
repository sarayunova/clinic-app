-- Migration 077: Intrahepatic Cholestasis of Pregnancy (ICP / Obstetric Cholestasis)
-- Total Serum Bile Acids (TSBA) Risk Stratification, UDCA Titration & Delivery Timing Protocol
-- SMFM 2021 / RCOG Green-top 43 / ACOG 2021

CREATE TABLE IF NOT EXISTS obstetric_icp_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  diagnosis_datetime TEXT NOT NULL,
  gestation_weeks REAL NOT NULL,
  peak_tsba_umol_l REAL NOT NULL,
  baseline_alt_u_l REAL,
  baseline_ast_u_l REAL,
  pruritus_severity_score INTEGER NOT NULL DEFAULT 5 CHECK(pruritus_severity_score BETWEEN 0 AND 10),
  pruritus_palms_soles INTEGER NOT NULL DEFAULT 1 CHECK(pruritus_palms_soles IN (0, 1)),
  nocturnal_worsening INTEGER NOT NULL DEFAULT 1 CHECK(nocturnal_worsening IN (0, 1)),
  icp_severity_tier TEXT NOT NULL CHECK(icp_severity_tier IN ('mild_10_39', 'moderate_40_99', 'severe_ge_100')),
  udca_started INTEGER NOT NULL DEFAULT 1 CHECK(udca_started IN (0, 1)),
  udca_dose_mg_day INTEGER NOT NULL DEFAULT 900,
  ctg_surveillance_frequency TEXT NOT NULL DEFAULT 'twice_weekly' CHECK(ctg_surveillance_frequency IN ('weekly', 'twice_weekly', 'daily', 'continuous_inpatient')),
  planned_delivery_weeks REAL NOT NULL,
  delivery_timing_rationale TEXT,
  status TEXT NOT NULL DEFAULT 'active_surveillance' CHECK(status IN (
    'active_surveillance',
    'medication_titration',
    'planned_induction',
    'delivered',
    'resolved'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_icp_patient ON obstetric_icp_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_obstetric_icp_status ON obstetric_icp_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_icp_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  icp_episode_id INTEGER NOT NULL REFERENCES obstetric_icp_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  gestation_weeks REAL NOT NULL,
  current_tsba_umol_l REAL NOT NULL,
  alt_u_l REAL,
  ast_u_l REAL,
  pruritus_score INTEGER NOT NULL CHECK(pruritus_score BETWEEN 0 AND 10),
  ctg_result TEXT NOT NULL DEFAULT 'reactive' CHECK(ctg_result IN ('reactive', 'equivocal', 'non_reactive')),
  fetal_movements_adequate INTEGER NOT NULL DEFAULT 1 CHECK(fetal_movements_adequate IN (0, 1)),
  udca_current_dose_mg_day INTEGER NOT NULL DEFAULT 900,
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_icp_logs_episode ON obstetric_icp_flowsheet_logs(icp_episode_id);
