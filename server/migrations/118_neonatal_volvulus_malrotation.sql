-- Migration 118: Neonatal Bilious Emesis & Malrotation with Midgut Volvulus Protocol
-- Reference: AAP Section on Surgery / Pediatric Surgical Guidelines on Emergent Ladd Procedure

CREATE TABLE IF NOT EXISTS neonatal_volvulus_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  onset_datetime                      TEXT NOT NULL,
  age_days                            INTEGER NOT NULL,
  weight_kg                           REAL NOT NULL,
  emesis_color                        TEXT NOT NULL CHECK (emesis_color IN (
                                        'bilious_dark_green',
                                        'bilious_light_green_yellow',
                                        'non_bilious_gastric'
                                      )),
  abdominal_distension                TEXT NOT NULL CHECK (abdominal_distension IN (
                                        'absent_scaphoid',
                                        'mild_epigastric',
                                        'marked_generalized'
                                      )),
  abdominal_tenderness                INTEGER NOT NULL DEFAULT 1 CHECK (abdominal_tenderness IN (0, 1)),
  rectal_bleeding_melena              INTEGER NOT NULL DEFAULT 0 CHECK (rectal_bleeding_melena IN (0, 1)),
  peritonitis_signs                   INTEGER NOT NULL DEFAULT 0 CHECK (peritonitis_signs IN (0, 1)),
  hemodynamic_shock                   INTEGER NOT NULL DEFAULT 0 CHECK (hemodynamic_shock IN (0, 1)),
  serum_lactate_mmol_l                REAL NOT NULL,
  blood_ph                            REAL,
  base_excess_meq_l                   REAL,
  plain_radiograph_finding            TEXT NOT NULL CHECK (plain_radiograph_finding IN (
                                        'normal_gas_pattern',
                                        'gasless_abdomen',
                                        'double_bubble',
                                        'distended_stomach_scant_distal_gas',
                                        'pneumoperitoneum_free_air'
                                      )),
  upper_gi_contrast_done              INTEGER NOT NULL DEFAULT 1 CHECK (upper_gi_contrast_done IN (0, 1)),
  upper_gi_finding                    TEXT CHECK (upper_gi_finding IN (
                                        'corkscrew_duodenum_positive',
                                        'ligament_of_treitz_right_sided',
                                        'duodenal_beaking_complete_obstruction',
                                        'normal_c_loop_treitz_left',
                                        'deferred_emergency_laparotomy'
                                      )),
  doppler_us_whirlpool_sign           INTEGER NOT NULL DEFAULT 0 CHECK (doppler_us_whirlpool_sign IN (0, 1)),
  doppler_sma_smv_inversion           INTEGER NOT NULL DEFAULT 0 CHECK (doppler_sma_smv_inversion IN (0, 1)),
  urgency_tier                        TEXT NOT NULL CHECK (urgency_tier IN (
                                        'immediate_operating_room_crash',
                                        'emergent_imaging_workup',
                                        'stable_observation'
                                      )),
  ladd_procedure_indicated            INTEGER NOT NULL DEFAULT 1 CHECK (ladd_procedure_indicated IN (0, 1)),
  status                              TEXT NOT NULL DEFAULT 'emergent_surgical_consult' CHECK (status IN (
                                        'emergent_surgical_consult',
                                        'in_operating_room_ladd',
                                        'post_op_bowel_recovery',
                                        'resolved_feeding_tolerated',
                                        'short_bowel_syndrome_care'
                                      )),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_neonatal_volvulus_patient ON neonatal_volvulus_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_neonatal_volvulus_status ON neonatal_volvulus_episodes(status);

CREATE TABLE IF NOT EXISTS neonatal_volvulus_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  volvulus_episode_id                 INTEGER NOT NULL REFERENCES neonatal_volvulus_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                        TEXT NOT NULL,
  hours_from_onset                    REAL NOT NULL,
  serum_lactate_mmol_l                REAL,
  heart_rate                          INTEGER NOT NULL,
  blood_pressure_sys                  INTEGER,
  blood_pressure_dia                  INTEGER,
  capillary_refill_seconds            REAL,
  ng_tube_output_ml                   REAL,
  ng_aspirate_appearance              TEXT,
  abdominal_exam_notes                TEXT,
  notes                               TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_volvulus_logs_episode ON neonatal_volvulus_flowsheet_logs(volvulus_episode_id);
