-- Migration 096: Pediatric Croup (Laryngotracheobronchitis) & Upper Airway Obstruction Protocol
-- References: Westley Croup Score (1978); AAP Clinical Practice Guidelines; Canadian Paediatric Society

CREATE TABLE IF NOT EXISTS pediatric_croup_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  triage_datetime TEXT NOT NULL,
  age_months INTEGER NOT NULL,
  weight_kg REAL NOT NULL,

  -- Westley Croup Score Components (0 - 17)
  inspiratory_stridor_score INTEGER NOT NULL CHECK(inspiratory_stridor_score IN (0, 1, 2)),
  retractions_score INTEGER NOT NULL CHECK(retractions_score IN (0, 1, 2, 3)),
  air_entry_score INTEGER NOT NULL CHECK(air_entry_score IN (0, 1, 2)),
  cyanosis_score INTEGER NOT NULL CHECK(cyanosis_score IN (0, 4, 5)),
  consciousness_score INTEGER NOT NULL CHECK(consciousness_score IN (0, 5)),
  westley_croup_score_total INTEGER NOT NULL,
  croup_severity_tier TEXT NOT NULL CHECK(croup_severity_tier IN (
    'mild_croup_score_le_2',
    'moderate_croup_score_3_to_5',
    'severe_croup_score_6_to_11',
    'impending_respiratory_failure_ge_12'
  )),

  -- Vital Signs & Airway Features
  heart_rate_bpm INTEGER NOT NULL,
  respiratory_rate INTEGER NOT NULL,
  spo2_percent REAL NOT NULL,
  barking_cough_present INTEGER NOT NULL DEFAULT 1 CHECK(barking_cough_present IN (0, 1)),
  hoarseness_present INTEGER NOT NULL DEFAULT 1 CHECK(hoarseness_present IN (0, 1)),

  -- Therapeutic Dosing & Timing
  dexamethasone_dose_mg REAL NOT NULL,
  dexamethasone_route TEXT NOT NULL CHECK(dexamethasone_route IN ('oral', 'im', 'iv')),
  dexamethasone_administered INTEGER NOT NULL DEFAULT 0 CHECK(dexamethasone_administered IN (0, 1)),
  nebulized_epinephrine_indicated INTEGER NOT NULL CHECK(nebulized_epinephrine_indicated IN (0, 1)),
  epinephrine_nebulization_dose_ml REAL,
  epinephrine_nebulization_administered INTEGER NOT NULL DEFAULT 0 CHECK(epinephrine_nebulization_administered IN (0, 1)),
  rebound_observation_hours_required REAL NOT NULL DEFAULT 2.0,

  status TEXT NOT NULL DEFAULT 'acute_triage_resuscitation' CHECK(status IN (
    'acute_triage_resuscitation',
    'post_nebulization_observation',
    'picu_admission_escalation',
    'discharged_home_stable'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_croup_patient ON pediatric_croup_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_croup_status ON pediatric_croup_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_croup_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  croup_episode_id INTEGER NOT NULL REFERENCES pediatric_croup_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  minutes_from_triage INTEGER NOT NULL DEFAULT 0,
  westley_score_current INTEGER NOT NULL,
  heart_rate_bpm INTEGER NOT NULL,
  respiratory_rate INTEGER NOT NULL,
  spo2_percent REAL NOT NULL,
  stridor_at_rest INTEGER NOT NULL DEFAULT 0 CHECK(stridor_at_rest IN (0, 1)),
  chest_retractions_severity TEXT NOT NULL CHECK(chest_retractions_severity IN (
    'none',
    'mild_subcostal',
    'moderate_intercostal',
    'severe_sternal_indrawing'
  )),
  intervention_given TEXT NOT NULL CHECK(intervention_given IN (
    'none_observation',
    'dexamethasone_oral',
    'dexamethasone_im_iv',
    'nebulized_epinephrine_1',
    'nebulized_epinephrine_repeat',
    'heliox_or_intubation_prep'
  )),
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_croup_logs_ep ON pediatric_croup_flowsheet_logs(croup_episode_id);
