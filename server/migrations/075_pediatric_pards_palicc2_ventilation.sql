-- Migration 075: Pediatric Acute Respiratory Distress Syndrome (PARDS) & PALICC-2 Ventilation Stewardship
-- Reference: PALICC-2 (Pediatric Acute Lung Injury Consensus Conference 2023) Guidelines,
-- PALS 2025, and Pediatric Critical Care Medicine Mechanical Ventilation Consensus.

CREATE TABLE IF NOT EXISTS pediatric_pards_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  diagnosis_datetime                  TEXT NOT NULL,
  age_months                          INTEGER NOT NULL,
  weight_kg                           REAL NOT NULL,
  predicted_body_weight_kg            REAL NOT NULL,
  trigger_cause                       TEXT NOT NULL DEFAULT 'pneumonia' CHECK (trigger_cause IN ('pneumonia', 'aspiration', 'sepsis_shock', 'trauma', 'drowning', 'other')),
  ventilation_mode                    TEXT NOT NULL DEFAULT 'invasive_mechanical' CHECK (ventilation_mode IN ('invasive_mechanical', 'non_invasive_cpap_bipap', 'high_frequency_oscillation')),
  current_peep_cmh2o                  REAL NOT NULL DEFAULT 5.0,
  current_map_cmh2o                   REAL NOT NULL DEFAULT 8.0,
  current_fio2_percent                REAL NOT NULL DEFAULT 40.0,
  pao2_mmhg                           REAL,
  spo2_percent                        REAL NOT NULL DEFAULT 95.0,
  calculated_oi                       REAL,
  calculated_osi                      REAL,
  pards_severity                      TEXT NOT NULL DEFAULT 'none_at_risk' CHECK (pards_severity IN ('none_at_risk', 'mild', 'moderate', 'severe')),
  target_tidal_volume_ml_min          REAL NOT NULL DEFAULT 0,
  target_tidal_volume_ml_max          REAL NOT NULL DEFAULT 0,
  plateau_pressure_limit_cmh2o        REAL NOT NULL DEFAULT 28.0,
  driving_pressure_limit_cmh2o        REAL NOT NULL DEFAULT 15.0,
  prone_positioning_active            INTEGER NOT NULL DEFAULT 0,
  neuromuscular_blockade_active       INTEGER NOT NULL DEFAULT 0,
  status                              TEXT NOT NULL DEFAULT 'acute_management' CHECK (status IN ('acute_management', 'stabilized_weaning', 'extubated', 'picu_stepdown', 'resolved')),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pediatric_pards_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  pards_episode_id                    INTEGER NOT NULL REFERENCES pediatric_pards_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                        TEXT NOT NULL,
  hours_on_protocol                   REAL NOT NULL DEFAULT 0,
  pip_cmh2o                           REAL,
  plateau_pressure_cmh2o              REAL,
  peep_cmh2o                          REAL NOT NULL DEFAULT 5.0,
  calculated_driving_pressure_cmh2o   REAL,
  map_cmh2o                           REAL NOT NULL DEFAULT 8.0,
  fio2_percent                        REAL NOT NULL DEFAULT 40.0,
  tidal_volume_set_ml                 REAL,
  tidal_volume_measured_ml_kg         REAL,
  respiratory_rate_set                INTEGER,
  respiratory_rate_total              INTEGER,
  abg_ph                              REAL,
  abg_pao2_mmhg                       REAL,
  abg_pco2_mmhg                       REAL,
  abg_hco3_meq_l                      REAL,
  spo2_percent                        REAL,
  calculated_oi                       REAL,
  calculated_osi                      REAL,
  prone_positioning_hours             REAL DEFAULT 0,
  notes                               TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ped_pards_patient ON pediatric_pards_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_ped_pards_status ON pediatric_pards_episodes(status);
CREATE INDEX IF NOT EXISTS idx_ped_pards_flowsheet_episode ON pediatric_pards_flowsheet_logs(pards_episode_id);
