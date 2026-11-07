-- Migration 084: Pediatric Status Asthmaticus, Modified Wood's Clinical Asthma Score (M-WCAS) & Stepwise Resuscitation Protocol
-- References: GINA 2023 Guidelines, BTS/SIGN Guideline on Asthma Management, AAP Critical Care Pediatric Asthma

CREATE TABLE IF NOT EXISTS pediatric_asthma_status_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  onset_datetime TEXT NOT NULL,
  age_months INTEGER NOT NULL,
  weight_kg REAL NOT NULL,
  spo2_room_air_percent REAL NOT NULL,
  wheezing_score INTEGER NOT NULL CHECK(wheezing_score BETWEEN 0 AND 2),
  retractions_score INTEGER NOT NULL CHECK(retractions_score BETWEEN 0 AND 2),
  air_entry_score INTEGER NOT NULL CHECK(air_entry_score BETWEEN 0 AND 2),
  mental_state_score INTEGER NOT NULL CHECK(mental_state_score BETWEEN 0 AND 2),
  total_mwcas_score INTEGER NOT NULL CHECK(total_mwcas_score BETWEEN 0 AND 10),
  severity_tier TEXT NOT NULL CHECK(severity_tier IN (
    'mild_1_3',
    'moderate_4_6',
    'severe_impending_failure_7_10'
  )),
  tier1_continuous_albuterol INTEGER NOT NULL DEFAULT 1 CHECK(tier1_continuous_albuterol IN (0, 1)),
  tier1_ipratropium INTEGER NOT NULL DEFAULT 1 CHECK(tier1_ipratropium IN (0, 1)),
  tier1_systemic_steroids INTEGER NOT NULL DEFAULT 1 CHECK(tier1_systemic_steroids IN (0, 1)),
  tier2_iv_magnesium INTEGER NOT NULL DEFAULT 0 CHECK(tier2_iv_magnesium IN (0, 1)),
  tier3_iv_terbutaline INTEGER NOT NULL DEFAULT 0 CHECK(tier3_iv_terbutaline IN (0, 1)),
  tier4_respiratory_support TEXT NOT NULL DEFAULT 'none' CHECK(tier4_respiratory_support IN (
    'none',
    'hfnc',
    'bipap_nippv',
    'heliox',
    'invasive_mechanical_ventilation'
  )),
  vbg_ph REAL,
  vbg_pco2_mmhg REAL,
  status TEXT NOT NULL DEFAULT 'acute_ed_treatment' CHECK(status IN (
    'acute_ed_treatment',
    'picu_monitoring',
    'stepdown_ward',
    'discharged_resolved'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_asthma_patient ON pediatric_asthma_status_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pediatric_asthma_status ON pediatric_asthma_status_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_asthma_status_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asthma_episode_id INTEGER NOT NULL REFERENCES pediatric_asthma_status_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  minutes_from_triage INTEGER NOT NULL DEFAULT 0,
  respiratory_rate INTEGER NOT NULL,
  heart_rate INTEGER NOT NULL,
  spo2_percent REAL NOT NULL,
  fio2_percent REAL NOT NULL DEFAULT 21,
  total_mwcas_score INTEGER NOT NULL CHECK(total_mwcas_score BETWEEN 0 AND 10),
  albuterol_rate_mg_hr REAL,
  terbutaline_rate_mcg_kg_min REAL,
  bipap_settings TEXT,
  vbg_ph REAL,
  vbg_pco2_mmhg REAL,
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pediatric_asthma_logs_episode ON pediatric_asthma_status_flowsheet_logs(asthma_episode_id);
