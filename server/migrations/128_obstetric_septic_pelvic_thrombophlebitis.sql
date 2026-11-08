-- Migration 128: Obstetric Septic Pelvic Thrombophlebitis (SPT) & Heparin Challenge Protocol
-- Reference: ACOG Practice Bulletin / SMFM Consults / CDC & WHO Postpartum Sepsis Guidelines

CREATE TABLE IF NOT EXISTS obstetric_spt_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  delivery_datetime                     TEXT NOT NULL,
  delivery_mode                         TEXT NOT NULL CHECK (delivery_mode IN (
                                          'cesarean_section',
                                          'operative_vaginal',
                                          'spontaneous_vaginal'
                                        )),
  postpartum_day                        INTEGER NOT NULL,
  spt_phenotype                         TEXT NOT NULL CHECK (spt_phenotype IN (
                                          'ovarian_vein_thrombosis',
                                          'deep_septic_pelvic_thrombophlebitis',
                                          'undifferentiated_refractory_fever'
                                        )),
  affected_vein                         TEXT NOT NULL CHECK (affected_vein IN (
                                          'right_ovarian_vein',
                                          'left_ovarian_vein',
                                          'bilateral_ovarian_veins',
                                          'internal_iliac_plexus',
                                          'not_visualized_clinical_diagnosis'
                                        )),
  peak_temperature_celsius              REAL NOT NULL,
  hours_refractory_triple_antibiotics   INTEGER NOT NULL DEFAULT 48,
  pelvic_ct_mri_findings                TEXT NOT NULL CHECK (pelvic_ct_mri_findings IN (
                                          'thrombus_with_rim_enhancement',
                                          'pelvic_phlebitis_perivascular_stranding',
                                          'negative_no_thrombus_seen',
                                          'imaging_pending'
                                        )),
  pelvic_abscess_ruled_out              INTEGER NOT NULL DEFAULT 1 CHECK (pelvic_abscess_ruled_out IN (0, 1)),
  heparin_challenge_initiated           INTEGER NOT NULL DEFAULT 1 CHECK (heparin_challenge_initiated IN (0, 1)),
  heparin_challenge_start_datetime      TEXT,
  anticoagulant_regimen                 TEXT NOT NULL CHECK (anticoagulant_regimen IN (
                                          'iv_unfractionated_heparin_infusion',
                                          'therapeutic_lmwh_weight_based',
                                          'transition_to_oral_anticoagulation'
                                        )),
  target_aptt_seconds                   TEXT NOT NULL DEFAULT '60-85s (1.5-2.5x control)',
  defervescence_hours                   REAL,
  heparin_challenge_response            TEXT NOT NULL CHECK (heparin_challenge_response IN (
                                          'pending_under_48h',
                                          'positive_defervescence_within_48_72h',
                                          'refractory_persistent_fever',
                                          'alternative_pathology_identified'
                                        )),
  status                                TEXT NOT NULL DEFAULT 'heparin_challenge_eval' CHECK (status IN (
                                          'heparin_challenge_eval',
                                          'active_therapeutic_anticoagulation',
                                          'afebrile_antibiotic_completion',
                                          'outpatient_anticoagulation_bridge',
                                          'resolved_thrombus_recanalized'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_spt_patient ON obstetric_spt_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_spt_status ON obstetric_spt_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_spt_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  spt_episode_id                        INTEGER NOT NULL REFERENCES obstetric_spt_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                          TEXT NOT NULL,
  hours_since_heparin_start             REAL NOT NULL,
  temperature_celsius                   REAL NOT NULL,
  heart_rate                            INTEGER NOT NULL,
  systolic_bp                           INTEGER NOT NULL,
  diastolic_bp                          INTEGER NOT NULL,
  aptt_seconds                          REAL,
  anti_xa_activity_iu_ml                REAL,
  heparin_infusion_rate_units_hr        REAL,
  bleeding_signs                        TEXT NOT NULL CHECK (bleeding_signs IN (
                                          'none',
                                          'mild_lochia_rubra',
                                          'wound_hematoma',
                                          'major_pelvic_hemorrhage'
                                        )),
  flank_abdominal_pain_score            INTEGER NOT NULL DEFAULT 0 CHECK (flank_abdominal_pain_score BETWEEN 0 AND 10),
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_spt_logs_episode ON obstetric_spt_flowsheet_logs(spt_episode_id);
