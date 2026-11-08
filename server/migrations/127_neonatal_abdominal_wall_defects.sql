-- Migration 127: Neonatal Omphalocele vs Gastroschisis Staged Silo Reduction Protocol
-- Reference: APSA / AAP Section on Surgery / BAPS Consensus Guidelines

CREATE TABLE IF NOT EXISTS neonatal_wall_defect_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  defect_type                           TEXT NOT NULL CHECK (defect_type IN (
                                          'gastroschisis',
                                          'omphalocele_intact',
                                          'omphalocele_ruptured'
                                        )),
  defect_diameter_cm                    REAL NOT NULL,
  cord_insertion_site                   TEXT NOT NULL CHECK (cord_insertion_site IN (
                                          'normal_left_of_defect',
                                          'sac_apex',
                                          'disrupted'
                                        )),
  membrane_sac_present                  INTEGER NOT NULL DEFAULT 0 CHECK (membrane_sac_present IN (0, 1)),
  eviscerated_organs                    TEXT NOT NULL CHECK (eviscerated_organs IN (
                                          'small_and_large_bowel',
                                          'bowel_and_liver',
                                          'bowel_liver_spleen_gonads'
                                        )),
  bowel_condition                       TEXT NOT NULL CHECK (bowel_condition IN (
                                          'healthy_normal_peristalsis',
                                          'edematous_fibrin_peel',
                                          'ischemic_gangrenous',
                                          'perforated_atresia'
                                        )),
  closure_approach                      TEXT NOT NULL CHECK (closure_approach IN (
                                          'primary_bedside_sutureless',
                                          'primary_operative_closure',
                                          'staged_silo_reduction',
                                          'delayed_escharotic_paint_and_wait'
                                        )),
  silo_type                             TEXT NOT NULL CHECK (silo_type IN (
                                          'none',
                                          'preformed_spring_loaded_bedside',
                                          'surgically_fashioned_dacron_silo'
                                        )),
  silo_height_cm                        REAL,
  current_bladder_pressure_mmhg         REAL NOT NULL DEFAULT 8.0,
  peak_inspiratory_pressure_cmh2o       REAL NOT NULL DEFAULT 16.0,
  beckwith_wiedemann_suspected          INTEGER NOT NULL DEFAULT 0 CHECK (beckwith_wiedemann_suspected IN (0, 1)),
  cardiac_echo_completed                INTEGER NOT NULL DEFAULT 0 CHECK (cardiac_echo_completed IN (0, 1)),
  associated_anomalies_note             TEXT,
  status                                TEXT NOT NULL DEFAULT 'initial_stabilization_silo_placement' CHECK (status IN (
                                          'initial_stabilization_silo_placement',
                                          'active_daily_serial_reduction',
                                          'ready_for_fascial_closure',
                                          'post_closure_compartment_monitoring',
                                          'resolved_enteral_feeds_established'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wall_defect_patient ON neonatal_wall_defect_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_wall_defect_status ON neonatal_wall_defect_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_wall_defect_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  wall_defect_episode_id                INTEGER NOT NULL REFERENCES neonatal_wall_defect_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                          TEXT NOT NULL,
  day_of_reduction                      INTEGER NOT NULL DEFAULT 1,
  silo_height_reduced_cm                REAL NOT NULL DEFAULT 0.0,
  residual_silo_height_cm               REAL NOT NULL,
  bladder_pressure_mmhg                 REAL NOT NULL,
  peak_inspiratory_pressure_cmh2o       REAL NOT NULL,
  urine_output_ml_kg_hr                 REAL NOT NULL,
  lower_extremity_perfusion             TEXT NOT NULL CHECK (lower_extremity_perfusion IN (
                                          'warm_pink_pulses_brisk',
                                          'sluggish_cap_refill_delayed',
                                          'pale_cool_pulses_diminished'
                                        )),
  bowel_visceral_color                  TEXT NOT NULL CHECK (bowel_visceral_color IN (
                                          'pink_viable',
                                          'hyperemic_mild_edema',
                                          'dusky_venous_congestion',
                                          'ischemic_black'
                                        )),
  heart_rate                            INTEGER NOT NULL,
  respiratory_rate                      INTEGER NOT NULL,
  mean_arterial_pressure_mmhg           REAL NOT NULL,
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wall_defect_logs_episode ON neonatal_wall_defect_flowsheet_logs(wall_defect_episode_id);
