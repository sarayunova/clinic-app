-- Migration 069: Pediatric Status Epilepticus Resuscitation & Refractory Seizure Algorithm
-- Reference: American Epilepsy Society (AES) Guidelines & Pediatric Advanced Life Support (PALS) Resuscitation Protocol.

CREATE TABLE IF NOT EXISTS pediatric_seizure_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  seizure_start_datetime              TEXT NOT NULL,
  seizure_type                        TEXT NOT NULL CHECK (seizure_type IN (
                                        'generalized_tonic_clonic', 'focal_with_impaired_awareness', 'myoclonic', 'absence_atypical', 'subtle_neonatal', 'non_convulsive_status'
                                      )),
  etiology                            TEXT CHECK (etiology IN (
                                        'febrile_status', 'known_epilepsy', 'cns_infection_meningitis_encephalitis', 'electrolyte_derangement_hypoglycemia_hyponatremia', 'acute_trauma_intracranial_hemorrhage', 'toxic_ingestion', 'unknown_cryptogenic'
                                      )),
  patient_age_months                  REAL NOT NULL,
  weight_kg                           REAL NOT NULL,
  broselow_color_zone                 TEXT CHECK (broselow_color_zone IN (
                                        'grey', 'pink', 'red', 'purple', 'yellow', 'white', 'blue', 'orange', 'green', 'not_applicable'
                                      )),
  current_algorithm_phase             TEXT NOT NULL CHECK (current_algorithm_phase IN (
                                        'phase_1_stabilization_0_5m',
                                        'phase_2_first_line_bzd_5_20m',
                                        'phase_3_second_line_asm_20_40m',
                                        'phase_4_refractory_rsi_picu_gt_40m',
                                        'seizure_aborted_postictal'
                                      )),
  seizure_cessation_datetime          TEXT,
  total_seizure_duration_minutes      REAL,
  blood_glucose_mg_dl                 REAL,
  d10w_bolus_given_ml                 REAL,
  phase2_benzodiazepine_given         TEXT,
  phase2_dose_count                   INTEGER NOT NULL DEFAULT 0,
  phase3_second_line_agent            TEXT,
  phase3_second_line_dose_mg          REAL,
  phase3_infusion_status              TEXT CHECK (phase3_infusion_status IN ('not_started', 'infusing', 'completed', 'failed_to_abort')),
  phase4_picu_escalation_status       TEXT CHECK (phase4_picu_escalation_status IN ('not_needed', 'rsi_intubation_underway', 'midazolam_infusion_titrating', 'propofol_infusion_titrating', 'ketamine_infusion_titrating', 'admitted_picu_continuous_eeg')),
  attending_pediatrician_id           INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seizure_patient ON pediatric_seizure_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_seizure_phase ON pediatric_seizure_episodes(current_algorithm_phase);

CREATE TABLE IF NOT EXISTS pediatric_seizure_timeline_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  seizure_episode_id                  INTEGER NOT NULL REFERENCES pediatric_seizure_episodes(id) ON DELETE CASCADE,
  elapsed_minutes                     REAL NOT NULL,
  timestamp                           TEXT NOT NULL,
  action_type                         TEXT NOT NULL CHECK (action_type IN (
                                        'airway_oxygen_positioning',
                                        'blood_glucose_checked',
                                        'd10w_bolus_administered',
                                        'iv_io_access_secured',
                                        'first_line_benzodiazepine',
                                        'second_line_asm_administered',
                                        'rsi_intubation_preoxygenation',
                                        'anesthetic_infusion_started',
                                        'seizure_aborted',
                                        'eeg_monitoring_initiated',
                                        'vital_signs_recorded'
                                      )),
  medication_name                     TEXT,
  dose_administered                   TEXT,
  route                               TEXT CHECK (route IN ('iv', 'io', 'intranasal', 'buccal', 'rectal', 'im', 'infusion', 'inhalation', 'oral', 'subcutaneous')),
  heart_rate_bpm                      INTEGER,
  blood_pressure_systolic             INTEGER,
  blood_pressure_diastolic            INTEGER,
  spo2_percent                        REAL,
  active_motor_activity               INTEGER NOT NULL DEFAULT 1,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  clinical_observations               TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seizure_timeline_episode ON pediatric_seizure_timeline_logs(seizure_episode_id);
