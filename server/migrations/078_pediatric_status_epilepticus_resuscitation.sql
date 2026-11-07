-- Migration 078: Pediatric Status Epilepticus & Refractory Seizure Resuscitation Protocol
-- Rapid Benzodiazepine -> Non-Sedating Second-Line AED -> Anesthetic Infusion Titration
-- AES 2016 / PALS 2025 / Neurocritical Care Society

CREATE TABLE IF NOT EXISTS pediatric_status_epilepticus_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  seizure_onset_datetime TEXT NOT NULL,
  age_months INTEGER NOT NULL,
  weight_kg REAL NOT NULL,
  etiology TEXT NOT NULL CHECK(etiology IN (
    'febrile_status',
    'known_epilepsy',
    'cns_infection',
    'toxic_metabolic',
    'trauma_stroke',
    'unknown'
  )),
  seizure_semiology TEXT NOT NULL CHECK(seizure_semiology IN (
    'generalized_tonic_clonic',
    'focal_motor',
    'non_convulsive_status',
    'myoclonic'
  )),
  phase1_benzo_given INTEGER NOT NULL DEFAULT 0 CHECK(phase1_benzo_given IN (0, 1)),
  phase1_benzo_agent TEXT CHECK(phase1_benzo_agent IN ('midazolam_buccal_in', 'lorazepam_iv', 'diazepam_rectal')),
  phase1_benzo_dose_mg REAL,
  phase1_administered_minute INTEGER,
  phase2_second_line_given INTEGER NOT NULL DEFAULT 0 CHECK(phase2_second_line_given IN (0, 1)),
  phase2_agent TEXT CHECK(phase2_agent IN ('levetiracetam', 'fosphenytoin', 'valproate_sodium')),
  phase2_dose_mg REAL,
  phase2_administered_minute INTEGER,
  phase3_refractory_status INTEGER NOT NULL DEFAULT 0 CHECK(phase3_refractory_status IN (0, 1)),
  phase3_infusion_agent TEXT CHECK(phase3_infusion_agent IN ('midazolam_infusion', 'propofol_infusion', 'ketamine_infusion')),
  phase3_infusion_rate_mcg_kg_min REAL,
  seizure_cessation_minute INTEGER,
  status TEXT NOT NULL DEFAULT 'active_seizure' CHECK(status IN (
    'active_seizure',
    'refractory_status',
    'seizure_abated_post_ictal',
    'picu_neuro_monitoring',
    'resolved'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_status_epilepticus_patient ON pediatric_status_epilepticus_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_status_epilepticus_status ON pediatric_status_epilepticus_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_status_epilepticus_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seizure_episode_id INTEGER NOT NULL REFERENCES pediatric_status_epilepticus_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  minutes_from_onset INTEGER NOT NULL DEFAULT 0,
  phase_active TEXT NOT NULL CHECK(phase_active IN (
    'phase_1_emergent_benzo',
    'phase_2_urgent_control',
    'phase_3_refractory_infusion',
    'post_seizure_stabilization'
  )),
  seizure_activity_present INTEGER NOT NULL DEFAULT 1 CHECK(seizure_activity_present IN (0, 1)),
  vitals_hr INTEGER,
  vitals_sbp INTEGER,
  vitals_dbp INTEGER,
  vitals_spo2 REAL,
  airway_status TEXT NOT NULL DEFAULT 'patent_spontaneous' CHECK(airway_status IN (
    'patent_spontaneous',
    'bag_valve_mask',
    'intubated_ett',
    'laryngeal_mask'
  )),
  infusion_rate_mcg_kg_min REAL,
  eeg_background TEXT DEFAULT 'not_monitoring' CHECK(eeg_background IN (
    'not_monitoring',
    'normal',
    'slowing',
    'continuous_spikes',
    'burst_suppression',
    'flat'
  )),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_seizure_logs_episode ON pediatric_status_epilepticus_flowsheet_logs(seizure_episode_id);
