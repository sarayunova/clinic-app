-- Migration 124: Neonatal Esophageal Atresia (EA) & Tracheoesophageal Fistula (TEF) Protocol
-- Reference: AAP Section on Surgery / BAPS / ESPGHAN-NASPGHAN Consensus Guidelines

CREATE TABLE IF NOT EXISTS neonatal_ea_tef_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  onset_datetime                        TEXT NOT NULL,
  age_hours                             INTEGER NOT NULL,
  weight_kg                             REAL NOT NULL,
  frothy_oral_secretions                INTEGER NOT NULL DEFAULT 1 CHECK (frothy_oral_secretions IN (0, 1)),
  choking_cyanosis_with_feed            INTEGER NOT NULL DEFAULT 1 CHECK (choking_cyanosis_with_feed IN (0, 1)),
  og_tube_coiling_distance_cm           REAL NOT NULL,
  gross_classification_type             TEXT NOT NULL CHECK (gross_classification_type IN (
                                          'type_a_isolated_ea_no_fistula',
                                          'type_b_ea_with_proximal_tef',
                                          'type_c_ea_with_distal_tef',
                                          'type_d_ea_with_both_fistulas',
                                          'type_e_isolated_h_type_tef'
                                        )),
  abdominal_gas_pattern                 TEXT NOT NULL CHECK (abdominal_gas_pattern IN (
                                          'gasless_abdomen_no_distal_fistula',
                                          'aerated_gastrointestinal_tract',
                                          'massive_gastric_distension'
                                        )),
  replogle_tube_in_situ                 INTEGER NOT NULL DEFAULT 1 CHECK (replogle_tube_in_situ IN (0, 1)),
  replogle_suction_pressure_mmhg        INTEGER NOT NULL DEFAULT 25,
  gap_length_classification             TEXT NOT NULL CHECK (gap_length_classification IN (
                                          'short_gap_primary_anastomosis',
                                          'intermediate_gap_1_to_3_cm',
                                          'long_gap_greater_3_cm_or_vertebrae'
                                        )),
  vacterl_vertebral_anomaly             INTEGER NOT NULL DEFAULT 0 CHECK (vacterl_vertebral_anomaly IN (0, 1)),
  vacterl_anorectal_malformation        INTEGER NOT NULL DEFAULT 0 CHECK (vacterl_anorectal_malformation IN (0, 1)),
  vacterl_cardiac_anomaly               INTEGER NOT NULL DEFAULT 0 CHECK (vacterl_cardiac_anomaly IN (0, 1)),
  vacterl_right_aortic_arch             INTEGER NOT NULL DEFAULT 0 CHECK (vacterl_right_aortic_arch IN (0, 1)),
  vacterl_renal_ultrasound_abnormal     INTEGER NOT NULL DEFAULT 0 CHECK (vacterl_renal_ultrasound_abnormal IN (0, 1)),
  vacterl_limb_radial_anomaly           INTEGER NOT NULL DEFAULT 0 CHECK (vacterl_limb_radial_anomaly IN (0, 1)),
  head_of_bed_elevated_30deg            INTEGER NOT NULL DEFAULT 1 CHECK (head_of_bed_elevated_30deg IN (0, 1)),
  surgical_procedure_planned            TEXT NOT NULL CHECK (surgical_procedure_planned IN (
                                          'primary_extrapleural_repair_fistula_ligation',
                                          'thoracoscopic_repair_fistula_ligation',
                                          'staged_gastrostomy_delayed_anastomosis',
                                          'cervical_esophagostomy'
                                        )),
  status                                TEXT NOT NULL DEFAULT 'preop_replogle_sump_decompression' CHECK (status IN (
                                          'preop_replogle_sump_decompression',
                                          'in_operating_room_thoracotomy',
                                          'postop_transanastomotic_tube_recovery',
                                          'esophagram_contrast_clearance',
                                          'resolved_full_oral_feeding'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ea_tef_patient ON neonatal_ea_tef_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_ea_tef_status ON neonatal_ea_tef_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_ea_tef_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  ea_tef_episode_id                     INTEGER NOT NULL REFERENCES neonatal_ea_tef_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                          TEXT NOT NULL,
  hours_from_admission                  REAL NOT NULL,
  replogle_saline_flushed               INTEGER NOT NULL DEFAULT 1 CHECK (replogle_saline_flushed IN (0, 1)),
  replogle_aspirate_volume_ml           REAL,
  replogle_aspirate_character           TEXT NOT NULL CHECK (replogle_aspirate_character IN (
                                          'clear_saliva',
                                          'frothy_mucus',
                                          'blood_tinged',
                                          'bilious_reflux'
                                        )),
  heart_rate                            INTEGER NOT NULL,
  respiratory_rate                      INTEGER NOT NULL,
  oxygen_saturation_pct                 REAL NOT NULL,
  abdominal_girth_cm                    REAL,
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ea_tef_logs_episode ON neonatal_ea_tef_flowsheet_logs(ea_tef_episode_id);
