-- Migration 139: Pediatric Acute Ingestion & Toxic Exposure Protocol
-- Reference: AAP Committee on Drugs / American College of Medical Toxicology (ACMT) / Rumack-Matthew Nomogram

CREATE TABLE IF NOT EXISTS pediatric_toxic_ingestion_episodes (
  id                                            INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                                    INTEGER NOT NULL REFERENCES patients(id),
  admission_id                                  INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                                  TEXT NOT NULL UNIQUE,
  ingestion_datetime                            TEXT NOT NULL,
  presentation_datetime                         TEXT NOT NULL,
  age_years                                     REAL NOT NULL,
  weight_kg                                     REAL NOT NULL,
  substance_category                            TEXT NOT NULL CHECK (substance_category IN (
                                                  'acetaminophen_paracetamol',
                                                  'iron_elemental_supplement',
                                                  'organophosphate_carbamate',
                                                  'caustic_alkali_acid_battery',
                                                  'hydrocarbon_petroleum',
                                                  'other_unidentified_toxin'
                                                )),
  ingested_dose_mg_kg                           REAL NOT NULL DEFAULT 0.0,
  hours_post_ingestion                          REAL NOT NULL,
  serum_level_value                             REAL NOT NULL DEFAULT 0.0,
  rumack_matthew_line_breached                  INTEGER NOT NULL DEFAULT 0 CHECK (rumack_matthew_line_breached IN (0, 1)),
  alt_u_l                                       REAL NOT NULL DEFAULT 20.0,
  ast_u_l                                       REAL NOT NULL DEFAULT 22.0,
  total_bilirubin_mg_dl                         REAL NOT NULL DEFAULT 0.6,
  prothrombin_time_inr                          REAL NOT NULL DEFAULT 1.0,
  antidote_indicated                            INTEGER NOT NULL DEFAULT 0 CHECK (antidote_indicated IN (0, 1)),
  antidote_administered                         TEXT NOT NULL DEFAULT 'supportive_care_only' CHECK (antidote_administered IN (
                                                  'iv_n_acetylcysteine_nac_protocol',
                                                  'iv_deferoxamine_chelation',
                                                  'atropine_pralidoxime_regimen',
                                                  'activated_charcoal_single_dose',
                                                  'whole_bowel_irrigation_peg',
                                                  'supportive_care_only'
                                                )),
  gastric_decontamination_contraindicated       INTEGER NOT NULL DEFAULT 0 CHECK (gastric_decontamination_contraindicated IN (0, 1)),
  status                                        TEXT NOT NULL DEFAULT 'acute_poisoning_triage' CHECK (status IN (
                                                  'acute_poisoning_triage',
                                                  'antidote_infusion_active',
                                                  'picu_organ_support_monitoring',
                                                  'toxic_levels_clearing',
                                                  'convalescent_hepatic_recovery',
                                                  'resolved_discharged_home'
                                                )),
  consultant_id                                 INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                                TEXT,
  created_at                                    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                                    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_toxic_ingestion_patient ON pediatric_toxic_ingestion_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_toxic_ingestion_status ON pediatric_toxic_ingestion_episodes(status);

CREATE TABLE IF NOT EXISTS pediatric_toxic_ingestion_flowsheet_logs (
  id                                            INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id                                    INTEGER NOT NULL REFERENCES pediatric_toxic_ingestion_episodes(id) ON DELETE CASCADE,
  patient_id                                    INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                                  TEXT NOT NULL,
  hours_from_ingestion                          REAL NOT NULL,
  heart_rate_bpm                                INTEGER NOT NULL,
  systolic_bp_mmhg                              INTEGER NOT NULL,
  respiratory_rate                              INTEGER NOT NULL,
  spo2_percent                                  REAL NOT NULL,
  alt_u_l                                       REAL NOT NULL,
  ast_u_l                                       REAL NOT NULL,
  toxin_serum_level                             REAL NOT NULL DEFAULT 0.0,
  vin_rose_urine_observed                       INTEGER NOT NULL DEFAULT 0 CHECK (vin_rose_urine_observed IN (0, 1)),
  notes                                         TEXT,
  logged_by_id                                  INTEGER NOT NULL REFERENCES users(id),
  created_at                                    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_toxic_ingestion_flowsheet_ep ON pediatric_toxic_ingestion_flowsheet_logs(episode_id);
CREATE INDEX IF NOT EXISTS idx_toxic_ingestion_flowsheet_pat ON pediatric_toxic_ingestion_flowsheet_logs(patient_id);
