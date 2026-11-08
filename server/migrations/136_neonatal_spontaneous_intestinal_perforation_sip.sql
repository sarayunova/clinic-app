-- Migration 136: Neonatal Spontaneous Intestinal Perforation (SIP) & Primary Peritoneal Drainage Protocol
-- Reference: AAP Section on Surgery / APSA (American Pediatric Surgical Association) / VON Guidelines

CREATE TABLE IF NOT EXISTS neonatal_sip_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  onset_datetime                        TEXT NOT NULL,
  age_days                              INTEGER NOT NULL,
  birth_weight_grams                    INTEGER NOT NULL,
  gestational_age_weeks                 REAL NOT NULL,
  antenatal_or_early_steroids_exposed   INTEGER NOT NULL DEFAULT 0 CHECK (antenatal_or_early_steroids_exposed IN (0, 1)),
  indomethacin_or_ibuprofen_pda_exposed INTEGER NOT NULL DEFAULT 0 CHECK (indomethacin_or_ibuprofen_pda_exposed IN (0, 1)),
  pneumoperitoneum_confirmed            INTEGER NOT NULL DEFAULT 1 CHECK (pneumoperitoneum_confirmed IN (0, 1)),
  pneumatosis_intestinalis_absent       INTEGER NOT NULL DEFAULT 1 CHECK (pneumatosis_intestinalis_absent IN (0, 1)),
  portal_venous_gas_absent              INTEGER NOT NULL DEFAULT 1 CHECK (portal_venous_gas_absent IN (0, 1)),
  abdominal_wall_bluish_discoloration   INTEGER NOT NULL DEFAULT 0 CHECK (abdominal_wall_bluish_discoloration IN (0, 1)),
  peritoneal_drainage_performed         INTEGER NOT NULL DEFAULT 1 CHECK (peritoneal_drainage_performed IN (0, 1)),
  drain_type                            TEXT NOT NULL DEFAULT 'penrose_drain' CHECK (drain_type IN (
                                          'penrose_drain',
                                          'chest_tube_10fr',
                                          'pigtail_catheter',
                                          'none_laparotomy_primary'
                                        )),
  peritoneal_fluid_yeast_candida_positive INTEGER NOT NULL DEFAULT 0 CHECK (peritoneal_fluid_yeast_candida_positive IN (0, 1)),
  surgical_approach                     TEXT NOT NULL DEFAULT 'bedside_primary_peritoneal_drainage' CHECK (surgical_approach IN (
                                          'bedside_primary_peritoneal_drainage',
                                          'urgent_exploratory_laparotomy',
                                          'delayed_laparotomy_post_drain_failure'
                                        )),
  status                                TEXT NOT NULL DEFAULT 'acute_perforation_triage' CHECK (status IN (
                                          'acute_perforation_triage',
                                          'bedside_peritoneal_drain_active',
                                          'laparotomy_resection_enterostomy',
                                          'drain_weaning_resolution',
                                          'convalescent_enteral_feeding',
                                          'resolved_discharged_home'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sip_patient ON neonatal_sip_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_sip_status ON neonatal_sip_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_sip_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  sip_episode_id                        INTEGER NOT NULL REFERENCES neonatal_sip_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                          TEXT NOT NULL,
  hours_from_intervention               INTEGER NOT NULL,
  drain_output_ml_24h                   REAL NOT NULL,
  drain_output_character                TEXT NOT NULL CHECK (drain_output_character IN (
                                          'serosanguinous',
                                          'bilious',
                                          'feculent_meconium',
                                          'purulent',
                                          'minimal_clear'
                                        )),
  abdominal_girth_cm                    REAL NOT NULL,
  mean_airway_pressure_cmh2o            REAL NOT NULL,
  inotropic_support_active              INTEGER NOT NULL DEFAULT 0 CHECK (inotropic_support_active IN (0, 1)),
  platelet_count_k_ul                   INTEGER NOT NULL,
  crp_mg_l                              REAL NOT NULL,
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sip_flowsheet_episode ON neonatal_sip_flowsheet_logs(sip_episode_id);
CREATE INDEX IF NOT EXISTS idx_sip_flowsheet_patient ON neonatal_sip_flowsheet_logs(patient_id);
