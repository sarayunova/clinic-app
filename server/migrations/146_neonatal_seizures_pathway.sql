-- Series 41A: Neonatal Seizures & Status Epilepticus Pathway
CREATE TABLE IF NOT EXISTS neonatal_seizures_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  episode_number TEXT NOT NULL UNIQUE,
  diagnosis_datetime TEXT NOT NULL,
  gestational_age_weeks REAL NOT NULL,
  postnatal_age_days INTEGER NOT NULL,
  current_weight_kg REAL NOT NULL,
  seizure_semiology TEXT NOT NULL, -- 'clonic', 'tonic', 'myoclonic', 'autonomic', 'subtle', 'electrographic_only'
  seizure_duration_category TEXT NOT NULL, -- 'isolated_brief', 'recurrent_cluster', 'status_epilepticus'
  suspected_etiology TEXT NOT NULL, -- 'hie', 'cns_infection', 'stroke_thrombosis', 'ich', 'inborn_metabolism', 'hypoglycemia', 'hypocalcemia', 'benign_familial', 'unknown'
  blood_glucose_mg_dl REAL,
  ionized_calcium_mmol_l REAL,
  serum_magnesium_mg_dl REAL,
  sodium_meq_l REAL,
  first_line_phenobarbital_given INTEGER NOT NULL DEFAULT 0,
  cumulative_phenobarbital_mg_kg REAL NOT NULL DEFAULT 0,
  second_line_anticonvulsant TEXT, -- 'none', 'levetiracetam', 'midazolam_infusion', 'lidocaine'
  second_line_given INTEGER NOT NULL DEFAULT 0,
  pyridoxine_trial_done INTEGER NOT NULL DEFAULT 0,
  pyridoxine_responsive INTEGER NOT NULL DEFAULT 0,
  respiratory_support_status TEXT NOT NULL DEFAULT 'room_air', -- 'room_air', 'nasal_prongs', 'cpap', 'mechanical_ventilation'
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'stabilized', 'resolved', 'transferred')),
  clinical_summary TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_seizures_patient ON neonatal_seizures_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_seizures_status ON neonatal_seizures_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_seizures_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL REFERENCES neonatal_seizures_episodes(id) ON DELETE CASCADE,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  seizure_count_past_hour INTEGER NOT NULL DEFAULT 0,
  current_seizure_state TEXT NOT NULL, -- 'seizure_free', 'infrequent_twitches', 'active_clinical_seizures', 'continuous_status'
  heart_rate_bpm INTEGER,
  respiratory_rate_bpm INTEGER,
  spo2_percent REAL,
  blood_pressure_sys INTEGER,
  blood_pressure_dia INTEGER,
  sedation_score TEXT NOT NULL, -- 'normal_alert', 'mild_somnolence', 'deep_stupor', 'unresponsive'
  medication_administered TEXT,
  eeg_background TEXT, -- 'normal', 'mildly_abnormal', 'discontinuous', 'burst_suppression', 'isoelectric', 'not_available'
  nurse_notes TEXT,
  recorded_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_seizures_flowsheet_episode ON neonatal_seizures_flowsheet_logs(episode_id);
