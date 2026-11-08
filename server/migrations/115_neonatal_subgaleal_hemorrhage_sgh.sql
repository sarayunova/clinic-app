-- Migration 115: Neonatal Subgaleal Hemorrhage (SGH) & Emergent Shock Resuscitation Protocol
-- Reference: AAP / British Association of Perinatal Medicine (BAPM) Framework on Neonatal Subgaleal Hemorrhage

CREATE TABLE IF NOT EXISTS neonatal_sgh_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  birth_datetime                      TEXT NOT NULL,
  diagnosis_datetime                  TEXT NOT NULL,
  delivery_mode                       TEXT NOT NULL CHECK (delivery_mode IN (
                                        'vacuum_assisted',
                                        'forceps_assisted',
                                        'vacuum_failed_cesarean',
                                        'normal_vaginal',
                                        'emergency_cesarean_unassisted'
                                      )),
  vacuum_cup_popoffs                  INTEGER NOT NULL DEFAULT 0,
  birth_weight_kg                     REAL NOT NULL,
  initial_head_circumference_cm       REAL NOT NULL,
  current_head_circumference_cm       REAL NOT NULL,
  hc_increase_cm                      REAL NOT NULL,
  estimated_occult_blood_loss_ml      REAL NOT NULL, -- hc_increase * 38 mL
  circulating_volume_loss_pct         REAL NOT NULL, -- (blood_loss / (birth_weight * 80)) * 100
  swelling_crosses_sutures            INTEGER NOT NULL DEFAULT 1 CHECK (swelling_crosses_sutures IN (0, 1)),
  swelling_fluctuant_pitting          INTEGER NOT NULL DEFAULT 1 CHECK (swelling_fluctuant_pitting IN (0, 1)),
  periorbital_ecchymosis              INTEGER NOT NULL DEFAULT 0 CHECK (periorbital_ecchymosis IN (0, 1)),
  ear_displacement                    INTEGER NOT NULL DEFAULT 0 CHECK (ear_displacement IN (0, 1)),
  pallor_severe                       INTEGER NOT NULL DEFAULT 1 CHECK (pallor_severe IN (0, 1)),
  shock_state                         TEXT NOT NULL CHECK (shock_state IN (
                                        'compensated_tachycardia',
                                        'uncompensated_hypotensive_shock',
                                        'life_threatening_circulatory_collapse'
                                      )),
  heart_rate_bpm                      INTEGER NOT NULL,
  blood_pressure_sys                  INTEGER,
  blood_pressure_dia                  INTEGER,
  shock_index                         REAL, -- HR / SBP
  capillary_refill_seconds            REAL,
  hematocrit_initial_pct              REAL,
  hematocrit_lowest_pct               REAL,
  platelet_count                      REAL,
  fibrinogen_mg_dl                    REAL,
  mtp_activated                       INTEGER NOT NULL DEFAULT 0 CHECK (mtp_activated IN (0, 1)),
  prbc_volume_transfused_ml           REAL NOT NULL DEFAULT 0.0,
  ffp_volume_transfused_ml            REAL NOT NULL DEFAULT 0.0,
  cryoprecipitate_volume_ml           REAL NOT NULL DEFAULT 0.0,
  status                              TEXT NOT NULL DEFAULT 'active_resuscitation' CHECK (status IN (
                                        'active_resuscitation',
                                        'mtp_massive_transfusion',
                                        'stabilized_monitoring',
                                        'resolved_discharged'
                                      )),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_sgh_patient ON neonatal_sgh_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_sgh_status ON neonatal_sgh_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_sgh_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  sgh_episode_id                      INTEGER NOT NULL REFERENCES neonatal_sgh_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                        TEXT NOT NULL,
  hours_from_birth                    REAL NOT NULL,
  head_circumference_cm               REAL NOT NULL,
  blood_pressure_sys                  INTEGER,
  blood_pressure_dia                  INTEGER,
  heart_rate                          INTEGER NOT NULL,
  shock_index                         REAL,
  capillary_refill_seconds            REAL,
  hematocrit_pct                      REAL,
  blood_products_transfused           TEXT,
  notes                               TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sgh_logs_episode ON neonatal_sgh_flowsheet_logs(sgh_episode_id);
