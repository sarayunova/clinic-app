-- Migration 085: Neonatal Bronchopulmonary Dysplasia (BPD), Jensen 2019 / NRN Staging & Respiratory Support Protocol
-- References: Jensen et al. (NEJM 2019 / NICHD Neonatal Research Network criteria at 36 weeks PMA)

CREATE TABLE IF NOT EXISTS neonatal_bpd_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  evaluation_datetime TEXT NOT NULL,
  gestational_age_weeks REAL NOT NULL,
  birth_weight_grams REAL NOT NULL,
  current_pma_weeks REAL NOT NULL,
  respiratory_support_type TEXT NOT NULL CHECK(respiratory_support_type IN (
    'none_room_air',
    'nasal_cannula_low_flow',
    'nasal_cannula_high_flow',
    'cpap_nippv',
    'invasive_mechanical_ventilation'
  )),
  cannula_flow_lpm REAL NOT NULL DEFAULT 0,
  fio2_percent REAL NOT NULL DEFAULT 21,
  jensen_bpd_grade TEXT NOT NULL CHECK(jensen_bpd_grade IN (
    'no_bpd',
    'grade_1',
    'grade_2',
    'grade_3'
  )),
  caffeine_therapy_active INTEGER NOT NULL DEFAULT 0 CHECK(caffeine_therapy_active IN (0, 1)),
  diuretic_therapy_active INTEGER NOT NULL DEFAULT 0 CHECK(diuretic_therapy_active IN (0, 1)),
  postnatal_steroids_active INTEGER NOT NULL DEFAULT 0 CHECK(postnatal_steroids_active IN (0, 1)),
  steroid_regimen TEXT,
  home_oxygen_planned INTEGER NOT NULL DEFAULT 0 CHECK(home_oxygen_planned IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'evaluating' CHECK(status IN (
    'evaluating',
    'inpatient_respiratory_care',
    'weaning_protocol',
    'discharged_home_oxygen',
    'resolved'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_bpd_patient ON neonatal_bpd_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_bpd_status ON neonatal_bpd_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_bpd_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bpd_episode_id INTEGER NOT NULL REFERENCES neonatal_bpd_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  pma_weeks REAL NOT NULL,
  respiratory_support TEXT NOT NULL,
  flow_lpm REAL NOT NULL DEFAULT 0,
  fio2_percent REAL NOT NULL DEFAULT 21,
  spo2_percent REAL NOT NULL,
  target_spo2_in_range INTEGER NOT NULL DEFAULT 1 CHECK(target_spo2_in_range IN (0, 1)),
  apnea_bradycardia_episodes_24h INTEGER NOT NULL DEFAULT 0,
  diuretic_dose_mg_kg REAL,
  weight_grams REAL,
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_bpd_logs_episode ON neonatal_bpd_flowsheet_logs(bpd_episode_id);
