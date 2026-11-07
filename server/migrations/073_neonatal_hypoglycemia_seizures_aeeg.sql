-- Migration 073: Neonatal Hypoglycemia (GIR Calculator), Neonatal Seizures & aEEG Neuro-Monitoring
-- Reference: AAP Clinical Report (2011) "Postnatal Glucose Homeostasis in Late-Preterm and Term Infants",
-- WHO/ILAE (2021) "Classification and Management of Neonatal Seizures", and Neonatal Neuro-Critical Care Consensus.

CREATE TABLE IF NOT EXISTS neonatal_hypoglycemia_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  evaluation_datetime                 TEXT NOT NULL,
  age_hours                           REAL NOT NULL,
  birth_weight_kg                     REAL NOT NULL,
  current_weight_kg                   REAL NOT NULL,
  risk_factors_json                   TEXT NOT NULL DEFAULT '[]',
  symptoms_present                    INTEGER NOT NULL DEFAULT 0,
  initial_blood_glucose_mg_dl         REAL NOT NULL,
  glucose_target_mg_dl                REAL NOT NULL DEFAULT 45.0,
  d10w_bolus_given_ml                 REAL NOT NULL DEFAULT 0,
  current_gir_mg_kg_min               REAL NOT NULL DEFAULT 0,
  fluid_dextrose_percent              REAL NOT NULL DEFAULT 10.0,
  fluid_rate_ml_hr                    REAL NOT NULL DEFAULT 0,
  seizure_activity_observed           INTEGER NOT NULL DEFAULT 0,
  seizure_type                        TEXT NOT NULL DEFAULT 'none' CHECK (seizure_type IN ('none', 'subclinical_only', 'electroclinical_clonic', 'electroclinical_tonic', 'electroclinical_myoclonic', 'electroclinical_subtle')),
  aeeg_background_pattern             TEXT NOT NULL DEFAULT 'continuous_normal_voltage' CHECK (aeeg_background_pattern IN ('continuous_normal_voltage', 'discontinuous_normal_voltage', 'continuous_low_voltage', 'burst_suppression', 'flat_trace')),
  first_line_asm_given                INTEGER NOT NULL DEFAULT 0,
  phenobarbital_dose_mg               REAL,
  levetiracetam_dose_mg               REAL,
  status                              TEXT NOT NULL DEFAULT 'evaluating' CHECK (status IN ('evaluating', 'active_infusion', 'stabilized_weaning', 'resolved')),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS neonatal_glucose_gir_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id                          INTEGER NOT NULL REFERENCES neonatal_hypoglycemia_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                        TEXT NOT NULL,
  hours_on_protocol                   REAL NOT NULL DEFAULT 0,
  blood_glucose_mg_dl                 REAL NOT NULL,
  fluid_dextrose_percent              REAL NOT NULL DEFAULT 10.0,
  fluid_rate_ml_hr                    REAL NOT NULL DEFAULT 0,
  calculated_gir_mg_kg_min            REAL NOT NULL DEFAULT 0,
  d10w_bolus_ml                       REAL NOT NULL DEFAULT 0,
  feeding_volume_ml                   REAL NOT NULL DEFAULT 0,
  feeding_type                        TEXT NOT NULL DEFAULT 'breast_milk' CHECK (feeding_type IN ('breast_milk', 'formula', 'tpn_npo')),
  aeeg_pattern                        TEXT NOT NULL DEFAULT 'continuous_normal_voltage' CHECK (aeeg_pattern IN ('continuous_normal_voltage', 'discontinuous_normal_voltage', 'continuous_low_voltage', 'burst_suppression', 'flat_trace')),
  seizure_events_count                INTEGER NOT NULL DEFAULT 0,
  notes                               TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_hypoglycemia_patient ON neonatal_hypoglycemia_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_hypoglycemia_status ON neonatal_hypoglycemia_episodes(status);
CREATE INDEX IF NOT EXISTS idx_neonatal_gir_episode ON neonatal_glucose_gir_flowsheet_logs(episode_id);
