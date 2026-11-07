-- Migration 082: Neonatal Persistent Pulmonary Hypertension of the Newborn (PPHN) & Inhaled Nitric Oxide (iNO) Protocol
-- References: AAP / AHA 2015 Pediatric Pulmonary Hypertension Guidelines, European Consensus on iNO in Neonates

CREATE TABLE IF NOT EXISTS neonatal_pphn_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code TEXT NOT NULL UNIQUE,
  onset_datetime TEXT NOT NULL,
  gestational_age_weeks REAL NOT NULL,
  birth_weight_grams REAL NOT NULL,
  primary_etiology TEXT NOT NULL CHECK(primary_etiology IN (
    'idiopathic',
    'meconium_aspiration_syndrome',
    'respiratory_distress_syndrome',
    'congenital_diaphragmatic_hernia',
    'neonatal_pneumonia_sepsis',
    'pulmonary_hypoplasia',
    'other'
  )),
  preductal_spo2 REAL NOT NULL,
  postductal_spo2 REAL NOT NULL,
  spo2_gradient REAL NOT NULL,
  mean_airway_pressure_cmh2o REAL NOT NULL,
  fio2_percent REAL NOT NULL,
  pao2_mmhg REAL NOT NULL,
  calculated_oi REAL NOT NULL,
  pphn_severity_tier TEXT NOT NULL CHECK(pphn_severity_tier IN (
    'mild_oi_under_15',
    'moderate_oi_15_24',
    'severe_oi_25_39',
    'critical_ecmo_oi_40_plus'
  )),
  echo_tr_jet_velocity_m_s REAL,
  echo_estimated_rvsp_mmhg REAL,
  echo_shunt_direction TEXT NOT NULL DEFAULT 'right_to_left' CHECK(echo_shunt_direction IN (
    'right_to_left',
    'bidirectional',
    'left_to_right'
  )),
  ino_active INTEGER NOT NULL DEFAULT 0 CHECK(ino_active IN (0, 1)),
  ino_dose_ppm REAL NOT NULL DEFAULT 0,
  methemoglobin_percent REAL,
  sildenafil_active INTEGER NOT NULL DEFAULT 0 CHECK(sildenafil_active IN (0, 1)),
  milrinone_active INTEGER NOT NULL DEFAULT 0 CHECK(milrinone_active IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'evaluating' CHECK(status IN (
    'evaluating',
    'active_ino_therapy',
    'weaning_ino',
    'ecmo_referred',
    'resolved_weaned'
  )),
  consultant_id INTEGER NOT NULL REFERENCES users(id),
  clinical_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_pphn_patient ON neonatal_pphn_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_pphn_status ON neonatal_pphn_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_pphn_flowsheet_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pphn_episode_id INTEGER NOT NULL REFERENCES neonatal_pphn_episodes(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime TEXT NOT NULL,
  hours_from_onset REAL NOT NULL DEFAULT 0,
  preductal_spo2 REAL NOT NULL,
  postductal_spo2 REAL NOT NULL,
  spo2_gradient REAL NOT NULL,
  map_cmh2o REAL NOT NULL,
  fio2_percent REAL NOT NULL,
  pao2_mmhg REAL NOT NULL,
  calculated_oi REAL NOT NULL,
  ino_dose_ppm REAL NOT NULL DEFAULT 0,
  methemoglobin_percent REAL,
  circuit_no2_ppm REAL,
  mean_arterial_pressure_mmhg REAL,
  inotropic_score REAL,
  notes TEXT,
  logged_by_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_pphn_logs_episode ON neonatal_pphn_flowsheet_logs(pphn_episode_id);
