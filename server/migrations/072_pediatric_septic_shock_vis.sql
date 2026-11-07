-- Migration 072: Pediatric Septic Shock, Vasoactive-Inotropic Score (VIS) & Fluid-Refractory Resuscitation
-- Reference: Surviving Sepsis Campaign Pediatric Septic Shock Guidelines (2020) & PALS 2025 Resuscitation Protocol.

CREATE TABLE IF NOT EXISTS pediatric_septic_shock_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  recognition_datetime                TEXT NOT NULL,
  age_months                          INTEGER NOT NULL,
  weight_kg                           REAL NOT NULL,
  shock_phenotype                     TEXT NOT NULL DEFAULT 'unspecified' CHECK (shock_phenotype IN ('cold_shock', 'warm_shock', 'unspecified', 'indeterminate')),
  mental_status                       TEXT NOT NULL DEFAULT 'alert' CHECK (mental_status IN ('alert', 'voice', 'pain', 'unresponsive')),
  capillary_refill_seconds            REAL NOT NULL DEFAULT 2.0,
  heart_rate_bpm                      INTEGER NOT NULL,
  sbp                                 INTEGER NOT NULL,
  dbp                                 INTEGER NOT NULL,
  map_mmhg                            REAL NOT NULL,
  pulse_quality                       TEXT NOT NULL DEFAULT 'normal' CHECK (pulse_quality IN ('normal', 'bounding', 'weak_thready', 'absent')),
  extremity_temperature               TEXT NOT NULL DEFAULT 'warm' CHECK (extremity_temperature IN ('warm', 'cool_mottled')),
  cumulative_fluid_ml                 REAL NOT NULL DEFAULT 0,
  cumulative_fluid_ml_kg              REAL NOT NULL DEFAULT 0,
  hepatomegaly_present                INTEGER NOT NULL DEFAULT 0,
  pulmonary_crackles_present          INTEGER NOT NULL DEFAULT 0,
  fluid_overload_alert                INTEGER NOT NULL DEFAULT 0,
  fluid_refractory                    INTEGER NOT NULL DEFAULT 0,
  first_line_vasoactive               TEXT NOT NULL DEFAULT 'none' CHECK (first_line_vasoactive IN ('epinephrine', 'norepinephrine', 'dobutamine', 'none')),
  stress_hydrocortisone_administered  INTEGER NOT NULL DEFAULT 0,
  current_vis_score                   REAL NOT NULL DEFAULT 0,
  organ_dysfunction_flags             TEXT,
  status                              TEXT NOT NULL DEFAULT 'resuscitating' CHECK (status IN ('resuscitating', 'stabilized', 'fluid_refractory', 'picu_transferred', 'resolved')),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pediatric_septic_shock_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  shock_episode_id                    INTEGER NOT NULL REFERENCES pediatric_septic_shock_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                        TEXT NOT NULL,
  minutes_from_recognition            INTEGER NOT NULL DEFAULT 0,
  heart_rate_bpm                      INTEGER,
  sbp                                 INTEGER,
  dbp                                 INTEGER,
  map_mmhg                            REAL,
  capillary_refill_seconds            REAL,
  mental_status                       TEXT,
  bolus_fluid_type                    TEXT,
  bolus_fluid_volume_ml               REAL DEFAULT 0,
  total_fluid_ml_kg                   REAL NOT NULL DEFAULT 0,
  dopamine_mcg_kg_min                 REAL DEFAULT 0,
  dobutamine_mcg_kg_min               REAL DEFAULT 0,
  epinephrine_mcg_kg_min              REAL DEFAULT 0,
  norepinephrine_mcg_kg_min           REAL DEFAULT 0,
  milrinone_mcg_kg_min                REAL DEFAULT 0,
  vasopressin_units_kg_min            REAL DEFAULT 0,
  vis_score                           REAL NOT NULL DEFAULT 0,
  hepatomegaly_checked                INTEGER NOT NULL DEFAULT 1,
  pulmonary_crackles_checked          INTEGER NOT NULL DEFAULT 1,
  notes                               TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ped_septic_shock_patient ON pediatric_septic_shock_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_ped_septic_shock_status ON pediatric_septic_shock_episodes(status);
CREATE INDEX IF NOT EXISTS idx_ped_shock_flowsheet_episode ON pediatric_septic_shock_flowsheet_logs(shock_episode_id);
