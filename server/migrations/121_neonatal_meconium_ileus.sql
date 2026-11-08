-- Migration 121: Neonatal Meconium Ileus & Cystic Fibrosis Gastrografin Decompression Protocol
-- Reference: AAP Section on Surgery / Cystic Fibrosis Foundation Guidelines

CREATE TABLE IF NOT EXISTS neonatal_meconium_ileus_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  onset_datetime                        TEXT NOT NULL,
  age_hours                             INTEGER NOT NULL,
  weight_kg                             REAL NOT NULL,
  meconium_passed_yet                   INTEGER NOT NULL DEFAULT 0 CHECK (meconium_passed_yet IN (0, 1)),
  abdominal_distension                  TEXT NOT NULL CHECK (abdominal_distension IN (
                                          'absent',
                                          'mild',
                                          'marked_tense'
                                        )),
  emesis_character                      TEXT NOT NULL CHECK (emesis_character IN (
                                          'none',
                                          'gastric_clear',
                                          'bilious_green'
                                        )),
  palpable_doughy_masses                INTEGER NOT NULL DEFAULT 1 CHECK (palpable_doughy_masses IN (0, 1)),
  family_history_cystic_fibrosis        INTEGER NOT NULL DEFAULT 0 CHECK (family_history_cystic_fibrosis IN (0, 1)),
  plain_abdominal_xray_findings         TEXT NOT NULL CHECK (plain_abdominal_xray_findings IN (
                                          'neuhauser_soap_bubble_sign',
                                          'dilated_loops_no_fluid_levels',
                                          'calcifications_meconium_peritonitis',
                                          'pneumoperitoneum_free_air',
                                          'non_specific_distension'
                                        )),
  contrast_enema_performed              INTEGER NOT NULL DEFAULT 1 CHECK (contrast_enema_performed IN (0, 1)),
  contrast_enema_type                   TEXT NOT NULL CHECK (contrast_enema_type IN (
                                          'gastrografin_dilute',
                                          'omnipaque_water_soluble',
                                          'barium_contraindicated',
                                          'none'
                                        )),
  microcolon_confirmed                  INTEGER NOT NULL DEFAULT 1 CHECK (microcolon_confirmed IN (0, 1)),
  meconium_pellets_visualized           INTEGER NOT NULL DEFAULT 1 CHECK (meconium_pellets_visualized IN (0, 1)),
  complication_present                  TEXT NOT NULL CHECK (complication_present IN (
                                          'uncomplicated_simple_ileus',
                                          'volvulus_gangrene',
                                          'atresia_segmental',
                                          'meconium_peritonitis_pseudocyst',
                                          'perforation_free_air'
                                        )),
  enema_attempts_count                  INTEGER NOT NULL DEFAULT 1,
  enema_success_outcome                 TEXT NOT NULL CHECK (enema_success_outcome IN (
                                          'successful_evacuation_reflux_into_ileum',
                                          'partial_evacuation_repeat_indicated',
                                          'failed_refractory_obstruction',
                                          'procedure_aborted_perforation_risk',
                                          'not_attempted_surgery_first'
                                        )),
  surgery_indicated                     INTEGER NOT NULL DEFAULT 0 CHECK (surgery_indicated IN (0, 1)),
  surgical_procedure_planned            TEXT NOT NULL CHECK (surgical_procedure_planned IN (
                                          'none_medical_decompression',
                                          'bishop_koop_t_tube_enterostomy',
                                          'santulli_enterostomy',
                                          'resection_primary_anastomosis',
                                          'laparotomy_enterotomy_irrigation'
                                        )),
  cftr_gene_mutation_sent               INTEGER NOT NULL DEFAULT 1 CHECK (cftr_gene_mutation_sent IN (0, 1)),
  pancreatic_enzyme_replacement_started INTEGER NOT NULL DEFAULT 0 CHECK (pancreatic_enzyme_replacement_started IN (0, 1)),
  status                                TEXT NOT NULL DEFAULT 'initial_contrast_decompression' CHECK (status IN (
                                          'initial_contrast_decompression',
                                          'repeat_enema_observation',
                                          'in_operating_room_enterostomy',
                                          'post_op_stoma_recovery',
                                          'resolved_normal_stooling'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_meconium_ileus_patient ON neonatal_meconium_ileus_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_meconium_ileus_status ON neonatal_meconium_ileus_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_meconium_ileus_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  meconium_ileus_episode_id             INTEGER NOT NULL REFERENCES neonatal_meconium_ileus_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                          TEXT NOT NULL,
  hours_from_onset                      REAL NOT NULL,
  abdominal_girth_cm                    REAL NOT NULL,
  gastric_aspirate_ml                   REAL,
  gastric_aspirate_color                TEXT,
  meconium_evacuated_amount             TEXT NOT NULL CHECK (meconium_evacuated_amount IN (
                                          'none',
                                          'scant_mucus',
                                          'small_hard_pellets',
                                          'large_thick_meconium_plug',
                                          'copious_liquid_meconium'
                                        )),
  hydration_status                      TEXT NOT NULL CHECK (hydration_status IN (
                                          'euvolemic',
                                          'mild_hypovolemia',
                                          'moderate_dehydration',
                                          'severe_shock'
                                        )),
  urine_output_ml_kg_hr                 REAL,
  serum_sodium_meq_l                    REAL,
  heart_rate                            INTEGER NOT NULL,
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_meconium_logs_episode ON neonatal_meconium_ileus_flowsheet_logs(meconium_ileus_episode_id);
