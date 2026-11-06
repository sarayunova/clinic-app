-- Migration 031: Neonatal Hyperbilirubinemia (Jaundice) Phototherapy Nomogram (Bhutani & AAP 2022)
-- Tracks hour-specific transcutaneous/serum bilirubin, Bhutani risk percentiles, and AAP phototherapy & exchange transfusion thresholds.

CREATE TABLE IF NOT EXISTS neonatal_jaundice_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  delivery_record_id INTEGER,
  birth_datetime TEXT NOT NULL,
  gestational_age_weeks INTEGER NOT NULL,
  birth_weight_grams INTEGER,
  blood_group TEXT,
  maternal_blood_group TEXT,
  direct_coombs_test TEXT DEFAULT 'not_tested' CHECK (direct_coombs_test IN ('positive', 'negative', 'not_tested')),
  g6pd_deficiency TEXT DEFAULT 'not_tested' CHECK (g6pd_deficiency IN ('normal', 'deficient', 'not_tested')),
  neurotoxicity_risk INTEGER DEFAULT 0,
  feeding_type TEXT DEFAULT 'exclusive_breastfeeding' CHECK (feeding_type IN ('exclusive_breastfeeding', 'formula', 'mixed')),
  status TEXT DEFAULT 'monitoring' CHECK (status IN ('monitoring', 'under_phototherapy', 'resolved', 'escalated_transfusion', 'discharged')),
  clinical_summary TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_neonatal_jaundice_patient ON neonatal_jaundice_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_jaundice_status ON neonatal_jaundice_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_bilirubin_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL REFERENCES neonatal_jaundice_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  sample_datetime TEXT NOT NULL,
  age_hours INTEGER NOT NULL,
  reading_type TEXT NOT NULL DEFAULT 'tsb_serum' CHECK (reading_type IN ('tsb_serum', 'tcb_transcutaneous')),
  bilirubin_mg_dl REAL NOT NULL,
  bilirubin_umol_l REAL,
  rate_of_rise_mg_dl_hr REAL,
  bhutani_risk_zone TEXT CHECK (bhutani_risk_zone IN ('low', 'low_intermediate', 'high_intermediate', 'high')),
  phototherapy_threshold_mg_dl REAL,
  exchange_threshold_mg_dl REAL,
  phototherapy_indicated INTEGER DEFAULT 0,
  exchange_indicated INTEGER DEFAULT 0,
  clinical_action TEXT,
  active_phototherapy INTEGER DEFAULT 0,
  phototherapy_device TEXT,
  notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bilirubin_readings_episode ON neonatal_bilirubin_readings(episode_id, age_hours ASC);
