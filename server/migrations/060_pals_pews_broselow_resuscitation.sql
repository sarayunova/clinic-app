-- Migration 060: Pediatric Advanced Life Support (PALS / PEWS) & Broselow Resuscitation Drawer
-- Reference: AHA PALS 2020 Guidelines, Pediatric Early Warning Score (PEWS),
-- Broselow Pediatric Emergency Length-Based Color-Coding System (Grey to Green),
-- and weight-adjusted resuscitation formulary (Defibrillation, Epinephrine, Amiodarone, ETT size).

CREATE TABLE IF NOT EXISTS pews_observations (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  observation_datetime                TEXT NOT NULL,
  behavior_score                      INTEGER NOT NULL CHECK (behavior_score BETWEEN 0 AND 3),
  cardiovascular_score                INTEGER NOT NULL CHECK (cardiovascular_score BETWEEN 0 AND 3),
  respiratory_score                   INTEGER NOT NULL CHECK (respiratory_score BETWEEN 0 AND 3),
  persistent_vomiting_postop          INTEGER NOT NULL DEFAULT 0, -- 1 point added if persistent vomiting
  total_pews_score                    INTEGER NOT NULL CHECK (total_pews_score BETWEEN 0 AND 10),
  risk_level                          TEXT NOT NULL CHECK (risk_level IN ('low_0_2', 'moderate_3_4', 'critical_5_plus')),
  heart_rate_bpm                      INTEGER NOT NULL,
  respiratory_rate_bpm                INTEGER NOT NULL,
  crt_seconds                         INTEGER NOT NULL,
  spo2_percent                        REAL NOT NULL,
  temperature_celsius                 REAL,
  fio2_percent                        REAL DEFAULT 21.0,
  escalation_triggered                INTEGER NOT NULL DEFAULT 0, -- 1 if score >= 3
  assessed_by_id                      INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pews_patient ON pews_observations(patient_id);
CREATE INDEX IF NOT EXISTS idx_pews_score ON pews_observations(total_pews_score);

-- Acute Broselow Resuscitation Event Logs
CREATE TABLE IF NOT EXISTS broselow_resuscitation_events (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  event_code                          TEXT NOT NULL UNIQUE,
  event_datetime                      TEXT NOT NULL,
  event_type                          TEXT NOT NULL CHECK (event_type IN (
                                        'cardiac_arrest_code_blue', 'status_epilepticus',
                                        'anaphylaxis', 'severe_septic_shock',
                                        'acute_respiratory_failure', 'other'
                                      )),
  measured_length_cm                  REAL NOT NULL,
  estimated_weight_kg                 REAL NOT NULL,
  broselow_color_zone                 TEXT NOT NULL CHECK (broselow_color_zone IN (
                                        'grey', 'pink', 'red', 'purple', 'yellow', 'white', 'blue', 'orange', 'green'
                                      )),
  ett_cuffed_size                     REAL NOT NULL,
  ett_depth_cm                        REAL NOT NULL,
  defib_joules_initial                REAL NOT NULL,
  epinephrine_iv_dose_ml              REAL NOT NULL,
  fluid_bolus_ml                      REAL NOT NULL,
  team_leader_id                      INTEGER NOT NULL REFERENCES users(id),
  outcome                             TEXT NOT NULL CHECK (outcome IN (
                                        'rosc_achieved', 'stabilized_transferred_picu', 'ongoing_cpr', 'expired'
                                      )),
  clinical_summary                    TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_broselow_patient ON broselow_resuscitation_events(patient_id);
