-- Migration 074: Obstetric Postpartum Hemorrhage (PPH), Gravimetric QBL & WHO E-MOTIVE / Bakri Balloon Bundle
-- Reference: WHO Recommendations on E-MOTIVE Treatment Package for Postpartum Hemorrhage (2023),
-- FIGO Postpartum Hemorrhage Guidelines (2022), ACOG Practice Bulletin No. 183, and WOMAN Trial.

CREATE TABLE IF NOT EXISTS obstetric_pph_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  delivery_mode                       TEXT NOT NULL DEFAULT 'vaginal' CHECK (delivery_mode IN ('vaginal', 'cesarean')),
  pph_recognition_datetime            TEXT NOT NULL,
  gestation_weeks                     REAL,
  gravimetric_qbl_ml                  REAL NOT NULL DEFAULT 0,
  drape_blood_volume_ml               REAL NOT NULL DEFAULT 0,
  swab_sponge_weight_net_g            REAL NOT NULL DEFAULT 0,
  initial_sbp                         INTEGER NOT NULL,
  initial_dbp                         INTEGER NOT NULL,
  initial_heart_rate                  INTEGER NOT NULL,
  shock_index                         REAL NOT NULL,
  etiology_4t                         TEXT NOT NULL DEFAULT 'tone_atony' CHECK (etiology_4t IN ('tone_atony', 'trauma_laceration', 'tissue_retained', 'thrombin_coagulopathy')),
  maternal_hypertension_history       INTEGER NOT NULL DEFAULT 0,
  maternal_asthma_history             INTEGER NOT NULL DEFAULT 0,
  emotive_massage_done                INTEGER NOT NULL DEFAULT 0,
  emotive_oxytocin_given              INTEGER NOT NULL DEFAULT 0,
  emotive_txa_given                   INTEGER NOT NULL DEFAULT 0,
  emotive_iv_fluids_given             INTEGER NOT NULL DEFAULT 0,
  emotive_exam_completed              INTEGER NOT NULL DEFAULT 0,
  emotive_escalation_needed           INTEGER NOT NULL DEFAULT 0,
  bakri_balloon_placed                INTEGER NOT NULL DEFAULT 0,
  bakri_fill_volume_ml                REAL DEFAULT 0,
  tamponade_test_result               TEXT NOT NULL DEFAULT 'not_performed' CHECK (tamponade_test_result IN ('not_performed', 'success_bleeding_stopped', 'failure_ongoing_bleeding')),
  status                              TEXT NOT NULL DEFAULT 'resuscitation_active' CHECK (status IN ('resuscitation_active', 'tamponade_active', 'stabilized', 'surgical_escalation', 'resolved')),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS obstetric_pph_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  pph_episode_id                      INTEGER NOT NULL REFERENCES obstetric_pph_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                        TEXT NOT NULL,
  minutes_from_recognition            INTEGER NOT NULL DEFAULT 0,
  interval_blood_loss_ml              REAL NOT NULL DEFAULT 0,
  cumulative_qbl_ml                   REAL NOT NULL DEFAULT 0,
  sbp                                 INTEGER NOT NULL,
  dbp                                 INTEGER NOT NULL,
  heart_rate_bpm                      INTEGER NOT NULL,
  calculated_shock_index              REAL NOT NULL,
  uterine_tone                        TEXT NOT NULL DEFAULT 'firm_contracted' CHECK (uterine_tone IN ('firm_contracted', 'boggy_soft', 'relaxed')),
  medication_given                    TEXT,
  bakri_drainage_ml                   REAL DEFAULT 0,
  urine_output_ml                     REAL DEFAULT 0,
  notes                               TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obs_pph_patient ON obstetric_pph_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_obs_pph_status ON obstetric_pph_episodes(status);
CREATE INDEX IF NOT EXISTS idx_obs_pph_flowsheet_episode ON obstetric_pph_flowsheet_logs(pph_episode_id);
