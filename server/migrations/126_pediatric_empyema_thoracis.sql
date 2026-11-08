-- Migration 126: Pediatric Empyema & Complicated Parapneumonic Effusion Protocol
-- Reference: BTS Pediatric Pleural Infection Guidelines / AAP Section on Pediatric Pulmonology

CREATE TABLE IF NOT EXISTS pediatric_empyema_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  onset_datetime                        TEXT NOT NULL,
  age_years                             REAL NOT NULL,
  weight_kg                             REAL NOT NULL,
  staging_phase                         TEXT NOT NULL CHECK (staging_phase IN (
                                          'stage_1_exudative_simple',
                                          'stage_2_fibrinopurulent_complicated',
                                          'stage_3_organizing_pleural_peel'
                                        )),
  ultrasound_findings                   TEXT NOT NULL CHECK (ultrasound_findings IN (
                                          'free_flowing_anechoic',
                                          'fibrinous_strands_early_septation',
                                          'dense_multiloculated_honeycomb',
                                          'thickened_visceral_pleura_trapped_lung'
                                        )),
  pleural_fluid_ph                      REAL,
  pleural_fluid_glucose_mg_dl           REAL,
  pleural_fluid_ldh_u_l                 REAL,
  pleural_fluid_appearance              TEXT NOT NULL CHECK (pleural_fluid_appearance IN (
                                          'clear_serous',
                                          'turbid_cloudy',
                                          'frank_pus_purulent'
                                        )),
  gram_stain_culture_isolated           TEXT,
  chest_tube_placed                     INTEGER NOT NULL DEFAULT 1 CHECK (chest_tube_placed IN (0, 1)),
  chest_tube_size_fr                    INTEGER,
  intrapleural_fibrinolytic_therapy     TEXT NOT NULL CHECK (intrapleural_fibrinolytic_therapy IN (
                                          'not_indicated_antibiotics_only',
                                          'tpa_plus_dornase_alfa_twice_daily',
                                          'single_agent_tpa',
                                          'saline_flush_control'
                                        )),
  doses_completed                       INTEGER NOT NULL DEFAULT 0,
  vats_decortication_indicated          INTEGER NOT NULL DEFAULT 0 CHECK (vats_decortication_indicated IN (0, 1)),
  status                                TEXT NOT NULL DEFAULT 'chest_tube_insertion' CHECK (status IN (
                                          'chest_tube_insertion',
                                          'intrapleural_fibrinolysis_active',
                                          'vats_surgical_decortication',
                                          'resolving_drain_removal_phase',
                                          'discharged_complete_resolution'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ped_empyema_patient ON pediatric_empyema_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_ped_empyema_status ON pediatric_empyema_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_empyema_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  empyema_episode_id                    INTEGER NOT NULL REFERENCES pediatric_empyema_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                          TEXT NOT NULL,
  hours_from_drain_placement            REAL NOT NULL,
  chest_drain_output_ml                 REAL NOT NULL,
  drain_effluent_appearance             TEXT NOT NULL CHECK (drain_effluent_appearance IN (
                                          'purulent_thick_pus',
                                          'turbid_serosanguinous',
                                          'serous_straw_colored',
                                          'no_output_blocked'
                                        )),
  air_leak_grade                        TEXT NOT NULL CHECK (air_leak_grade IN (
                                          'none',
                                          'cough_only',
                                          'expiratory',
                                          'continuous'
                                        )),
  temperature_celsius                   REAL NOT NULL,
  respiratory_rate                      INTEGER NOT NULL,
  oxygen_saturation_pct                 REAL NOT NULL,
  fibrinolytic_instilled_dwell_completed INTEGER NOT NULL DEFAULT 0 CHECK (fibrinolytic_instilled_dwell_completed IN (0, 1)),
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ped_empyema_logs_episode ON pediatric_empyema_flowsheet_logs(empyema_episode_id);
