-- Migration 097: Neonatal Polycythemia, Hyperviscosity & Partial Exchange Transfusion (PET)
-- References: AAP / Gomella's Neonatology (8th Ed) / UpToDate Neonatal Polycythemia

CREATE TABLE IF NOT EXISTS neonatal_polycythemia_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  diagnosis_datetime TEXT NOT NULL,
  gestational_age_weeks REAL NOT NULL,
  birth_weight_grams REAL NOT NULL,
  chronological_age_hours INTEGER NOT NULL,
  current_weight_kg REAL NOT NULL,

  -- Hematocrit & Diagnostic Sampling
  sampling_site TEXT NOT NULL CHECK(sampling_site IN ('peripheral_venous', 'umbilical_venous', 'capillary_unconfirmed')),
  venous_hematocrit_pct REAL NOT NULL,
  hemoglobin_g_dl REAL,
  blood_volume_ml_kg REAL NOT NULL DEFAULT 80.0,
  target_hematocrit_pct REAL NOT NULL DEFAULT 55.0,

  -- Hyperviscosity Symptoms & Organ Compromise
  symptoms_present INTEGER NOT NULL DEFAULT 0 CHECK(symptoms_present IN (0, 1)),
  symptom_details TEXT NOT NULL CHECK(symptom_details IN (
    'asymptomatic',
    'plethora_ruddy_appearance',
    'poor_feeding_lethargy',
    'jitteriness_tremors',
    'tachypnea_respiratory_distress',
    'hypoglycemia',
    'cyanosis_peripheral',
    'priapism_or_oliguria'
  )),
  serum_glucose_mg_dl REAL,
  platelet_count INTEGER,
  serum_bilirubin_mg_dl REAL,

  -- Partial Exchange Transfusion (PET) Parameters
  partial_exchange_indicated INTEGER NOT NULL CHECK(partial_exchange_indicated IN (0, 1)),
  exchange_volume_ml REAL NOT NULL,
  aliquot_size_ml REAL NOT NULL DEFAULT 15.0,
  replacement_fluid TEXT NOT NULL DEFAULT 'normal_saline_0_9' CHECK(replacement_fluid IN ('normal_saline_0_9', '5_percent_albumin', 'fresh_frozen_plasma')),

  status TEXT NOT NULL DEFAULT 'hydration_surveillance' CHECK(status IN (
    'hydration_surveillance',
    'pet_procedure_in_progress',
    'post_pet_observation',
    'eupolycythemic_resolved'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_polycythemia_patient ON neonatal_polycythemia_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_polycythemia_status ON neonatal_polycythemia_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_polycythemia_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  polycythemia_episode_id INTEGER NOT NULL REFERENCES neonatal_polycythemia_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  hours_from_triage REAL NOT NULL DEFAULT 0,

  aliquot_number INTEGER NOT NULL DEFAULT 1,
  volume_withdrawn_ml REAL NOT NULL DEFAULT 0,
  volume_infused_ml REAL NOT NULL DEFAULT 0,
  cumulative_exchanged_ml REAL NOT NULL DEFAULT 0,
  current_hematocrit_pct REAL,

  heart_rate_bpm INTEGER NOT NULL,
  respiratory_rate INTEGER NOT NULL,
  mean_arterial_pressure_mmhg REAL,
  capillary_refill_seconds REAL,
  blood_glucose_mg_dl REAL,
  adverse_events_observed TEXT NOT NULL DEFAULT 'none' CHECK(adverse_events_observed IN (
    'none',
    'hypotension_bradycardia',
    'catheter_thrombosis',
    'abdominal_distension_nec_suspicion',
    'hypoglycemia_recurrence'
  )),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_polycythemia_flowsheet_ep ON neonatal_polycythemia_flowsheet_logs(polycythemia_episode_id);
