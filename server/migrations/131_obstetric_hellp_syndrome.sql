-- Migration 131: Obstetric HELLP Syndrome & Mississippi Triple-Class Protocol
-- Reference: ACOG Practice Bulletin No. 222 / SMFM Consults / Mississippi Triple-Class System

CREATE TABLE IF NOT EXISTS obstetric_hellp_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  onset_datetime                        TEXT NOT NULL,
  gestational_age_weeks                 REAL NOT NULL,
  platelet_count_per_ul                 INTEGER NOT NULL,
  ast_u_l                               REAL NOT NULL,
  alt_u_l                               REAL NOT NULL,
  ldh_u_l                               REAL NOT NULL,
  total_bilirubin_mg_dl                 REAL NOT NULL,
  schistocytes_present                  INTEGER NOT NULL DEFAULT 1 CHECK (schistocytes_present IN (0, 1)),
  systolic_bp                           INTEGER NOT NULL,
  diastolic_bp                          INTEGER NOT NULL,
  epigastric_ruq_pain                   INTEGER NOT NULL DEFAULT 1 CHECK (epigastric_ruq_pain IN (0, 1)),
  hepatic_subcapsular_hematoma_suspected INTEGER NOT NULL DEFAULT 0 CHECK (hepatic_subcapsular_hematoma_suspected IN (0, 1)),
  hepatic_imaging_performed             TEXT NOT NULL CHECK (hepatic_imaging_performed IN (
                                          'none',
                                          'ultrasound_capsule_intact',
                                          'subcapsular_hematoma_contained',
                                          'hepatic_rupture_hemoperitoneum'
                                        )),
  dexamethasone_pulse_initiated         INTEGER NOT NULL DEFAULT 1 CHECK (dexamethasone_pulse_initiated IN (0, 1)),
  magnesium_sulfate_seizure_prophylaxis INTEGER NOT NULL DEFAULT 1 CHECK (magnesium_sulfate_seizure_prophylaxis IN (0, 1)),
  platelet_transfusion_administered     INTEGER NOT NULL DEFAULT 0 CHECK (platelet_transfusion_administered IN (0, 1)),
  delivery_timing_plan                  TEXT NOT NULL CHECK (delivery_timing_plan IN (
                                          'immediate_crash_delivery_under_2h',
                                          'planned_stabilization_and_delivery',
                                          'steroid_window_24_to_48h_if_stable'
                                        )),
  status                                TEXT NOT NULL DEFAULT 'acute_stabilization_icu_triage' CHECK (status IN (
                                          'acute_stabilization_icu_triage',
                                          'dexamethasone_antihypertensive_active',
                                          'in_operating_room_crash_delivery',
                                          'postpartum_icu_platelet_nadir_surveillance',
                                          'resolved_platelet_recovery_discharge'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hellp_patient ON obstetric_hellp_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_hellp_status ON obstetric_hellp_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_hellp_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  hellp_episode_id                      INTEGER NOT NULL REFERENCES obstetric_hellp_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                          TEXT NOT NULL,
  hours_from_admission                  REAL NOT NULL,
  platelet_count_per_ul                 INTEGER NOT NULL,
  ast_u_l                               REAL NOT NULL,
  ldh_u_l                               REAL NOT NULL,
  systolic_bp                           INTEGER NOT NULL,
  diastolic_bp                          INTEGER NOT NULL,
  urine_output_ml_hr                    REAL NOT NULL,
  deep_tendon_reflexes                  TEXT NOT NULL CHECK (deep_tendon_reflexes IN (
                                          'absent_hyporeflexia',
                                          'normal_2_plus',
                                          'hyperreflexic_clonus'
                                        )),
  epigastric_pain_score                 INTEGER NOT NULL DEFAULT 0 CHECK (epigastric_pain_score BETWEEN 0 AND 10),
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hellp_logs_episode ON obstetric_hellp_flowsheet_logs(hellp_episode_id);
