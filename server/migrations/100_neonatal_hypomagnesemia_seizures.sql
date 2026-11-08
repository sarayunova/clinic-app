-- Migration 100: Neonatal Hypomagnesemia & Electrolyte Refractory Seizures Protocol
-- References: AAP Guidelines; Nelson Textbook of Pediatrics; Gomella's Neonatology (8th Ed)

CREATE TABLE IF NOT EXISTS neonatal_hypomagnesemia_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  onset_datetime TEXT NOT NULL,
  gestational_age_weeks REAL NOT NULL,
  birth_weight_grams REAL NOT NULL,
  chronological_age_hours INTEGER NOT NULL,
  current_weight_kg REAL NOT NULL,

  -- Laboratory Diagnostics
  serum_magnesium_mg_dl REAL NOT NULL,
  serum_calcium_mg_dl REAL,
  ionized_calcium_mmol_l REAL,
  serum_potassium_meq_l REAL,

  -- Clinical Presentation & Refractoriness
  neuromuscular_symptoms TEXT NOT NULL CHECK(neuromuscular_symptoms IN (
    'none_asymptomatic',
    'jitteriness_tremors',
    'hyperreflexia_clonus',
    'tetany_carpopedal',
    'clonic_seizures_refractory',
    'apnea_bradycardia'
  )),
  seizures_observed INTEGER NOT NULL DEFAULT 0 CHECK(seizures_observed IN (0, 1)),
  calcium_refractory_tetany INTEGER NOT NULL DEFAULT 0 CHECK(calcium_refractory_tetany IN (0, 1)),
  ecg_abnormalities TEXT NOT NULL DEFAULT 'none' CHECK(ecg_abnormalities IN (
    'none',
    'prolonged_pr_interval',
    'widened_qrs',
    'ventricular_arrhythmias_torsades',
    'sinus_bradycardia'
  )),
  renal_impairment_present INTEGER NOT NULL DEFAULT 0 CHECK(renal_impairment_present IN (0, 1)),

  -- Treatment Parameters
  magnesium_sulfate_bolus_ml REAL NOT NULL,
  administration_route TEXT NOT NULL DEFAULT 'slow_iv_infusion' CHECK(administration_route IN (
    'slow_iv_infusion',
    'deep_intramuscular',
    'oral_maintenance'
  )),
  continuous_ecg_monitored INTEGER NOT NULL DEFAULT 1 CHECK(continuous_ecg_monitored IN (0, 1)),

  status TEXT NOT NULL DEFAULT 'acute_resuscitation' CHECK(status IN (
    'acute_resuscitation',
    'maintenance_infusion',
    'monitoring_stabilized',
    'resolved_eumagnesemic'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_hypomag_patient ON neonatal_hypomagnesemia_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_hypomag_status ON neonatal_hypomagnesemia_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_hypomagnesemia_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hypomagnesemia_episode_id INTEGER NOT NULL REFERENCES neonatal_hypomagnesemia_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  hours_from_onset REAL NOT NULL DEFAULT 0,

  serum_magnesium_mg_dl REAL,
  ionized_calcium_mmol_l REAL,
  heart_rate_bpm INTEGER NOT NULL,
  respiratory_rate INTEGER NOT NULL,
  deep_tendon_reflexes TEXT NOT NULL CHECK(deep_tendon_reflexes IN (
    'normal_2_plus',
    'brisk_3_plus_clonus',
    'diminished_1_plus',
    'absent_areflexia_toxicity'
  )),
  seizure_activity_present INTEGER NOT NULL DEFAULT 0 CHECK(seizure_activity_present IN (0, 1)),
  magnesium_infusion_rate_ml_hr REAL NOT NULL DEFAULT 0,
  ecg_rhythm_strip TEXT NOT NULL DEFAULT 'normal_sinus' CHECK(ecg_rhythm_strip IN (
    'normal_sinus',
    'sinus_bradycardia',
    'pr_prolongation',
    'heart_block',
    'arrhythmia'
  )),
  toxicity_warning INTEGER NOT NULL DEFAULT 0 CHECK(toxicity_warning IN (0, 1)),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_hypomag_flowsheet_ep ON neonatal_hypomagnesemia_flowsheet_logs(hypomagnesemia_episode_id);
