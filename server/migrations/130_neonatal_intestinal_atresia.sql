-- Migration 130: Neonatal Intestinal Atresia (Duodenal & Jejunoileal) Protocol
-- Reference: AAP / APSA (American Pediatric Surgical Association) / BAPS Consensus Guidelines

CREATE TABLE IF NOT EXISTS neonatal_intestinal_atresia_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  onset_datetime                        TEXT NOT NULL,
  age_hours                             INTEGER NOT NULL,
  weight_kg                             REAL NOT NULL,
  atresia_level                         TEXT NOT NULL CHECK (atresia_level IN (
                                          'duodenal_atresia_complete',
                                          'duodenal_web_stenosis',
                                          'jejunoileal_atresia_type_1_membrane',
                                          'jejunoileal_atresia_type_2_cord',
                                          'jejunoileal_atresia_type_3a_gap',
                                          'jejunoileal_atresia_type_3b_apple_peel',
                                          'jejunoileal_atresia_type_4_multiple'
                                        )),
  polyhydramnios_antenatal              INTEGER NOT NULL DEFAULT 0 CHECK (polyhydramnios_antenatal IN (0, 1)),
  bilious_emesis_present                INTEGER NOT NULL DEFAULT 1 CHECK (bilious_emesis_present IN (0, 1)),
  abdominal_distension_pattern          TEXT NOT NULL CHECK (abdominal_distension_pattern IN (
                                          'scaphoid_epigastric_fullness_only',
                                          'generalized_distension_visible_loops',
                                          'soft_non_distended'
                                        )),
  radiographic_gas_pattern              TEXT NOT NULL CHECK (radiographic_gas_pattern IN (
                                          'double_bubble_sign_gasless_distal',
                                          'triple_bubble_sign',
                                          'multiple_dilated_loops_air_fluid_levels',
                                          'microcolon_on_contrast_enema'
                                        )),
  down_syndrome_features_present        INTEGER NOT NULL DEFAULT 0 CHECK (down_syndrome_features_present IN (0, 1)),
  karyotype_trisomy_21_confirmed        INTEGER NOT NULL DEFAULT 0 CHECK (karyotype_trisomy_21_confirmed IN (0, 1)),
  echocardiogram_cardiac_defect         INTEGER NOT NULL DEFAULT 0 CHECK (echocardiogram_cardiac_defect IN (0, 1)),
  replogle_decompression_active         INTEGER NOT NULL DEFAULT 1 CHECK (replogle_decompression_active IN (0, 1)),
  surgical_procedure_planned            TEXT NOT NULL CHECK (surgical_procedure_planned IN (
                                          'duodenoduodenostomy_diamond_anastomosis',
                                          'duodenojejunostomy',
                                          'primary_end_to_oblique_anastomosis',
                                          'tapering_enteroplasty_anastomosis',
                                          'temporary_enterostomy_stoma'
                                        )),
  transanastomotic_tube_placed          INTEGER NOT NULL DEFAULT 0 CHECK (transanastomotic_tube_placed IN (0, 1)),
  tpn_central_line_in_situ              INTEGER NOT NULL DEFAULT 0 CHECK (tpn_central_line_in_situ IN (0, 1)),
  status                                TEXT NOT NULL DEFAULT 'preop_nasogastric_decompression' CHECK (status IN (
                                          'preop_nasogastric_decompression',
                                          'contrast_imaging_enema_workup',
                                          'in_operating_room_reconstruction',
                                          'postop_transanastomotic_tube_tpn',
                                          'resolved_full_enteral_nutrition'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_intestinal_atresia_patient ON neonatal_intestinal_atresia_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_intestinal_atresia_status ON neonatal_intestinal_atresia_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_intestinal_atresia_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  atresia_episode_id                    INTEGER NOT NULL REFERENCES neonatal_intestinal_atresia_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                          TEXT NOT NULL,
  hours_from_admission                  REAL NOT NULL,
  nasogastric_output_ml                 REAL NOT NULL,
  nasogastric_aspirate_character        TEXT NOT NULL CHECK (nasogastric_aspirate_character IN (
                                          'clear_gastric',
                                          'bilious_dark_green',
                                          'feculent_stasis'
                                        )),
  abdominal_girth_cm                    REAL NOT NULL,
  enteral_feed_rate_ml_hr               REAL NOT NULL DEFAULT 0.0,
  stool_passage_observed                INTEGER NOT NULL DEFAULT 0 CHECK (stool_passage_observed IN (0, 1)),
  stool_character                       TEXT NOT NULL CHECK (stool_character IN (
                                          'none',
                                          'pale_mucus_plug',
                                          'transitional_meconium',
                                          'normal_yellow_breastmilk_stool'
                                        )),
  heart_rate                            INTEGER NOT NULL,
  respiratory_rate                      INTEGER NOT NULL,
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_intestinal_atresia_logs_episode ON neonatal_intestinal_atresia_flowsheet_logs(atresia_episode_id);
