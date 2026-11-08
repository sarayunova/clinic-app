-- Migration 142: Non-Immune Fetal Hydrops (NIHF) & Maternal Mirror Syndrome Protocol
-- References: Society for Maternal-Fetal Medicine (SMFM) Consult Series #37 / RCOG / ISUOG

CREATE TABLE IF NOT EXISTS fetal_hydrops_episodes (
  id                                            INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                                    INTEGER NOT NULL REFERENCES patients(id),
  admission_id                                  INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                                  TEXT NOT NULL UNIQUE,
  diagnosis_datetime                            TEXT NOT NULL,
  gestational_age_weeks                         REAL NOT NULL,
  fetal_compartments_involved_count             INTEGER NOT NULL DEFAULT 2,
  ascites_present                               INTEGER NOT NULL DEFAULT 0 CHECK (ascites_present IN (0, 1)),
  pleural_effusion_present                      INTEGER NOT NULL DEFAULT 0 CHECK (pleural_effusion_present IN (0, 1)),
  pericardial_effusion_present                  INTEGER NOT NULL DEFAULT 0 CHECK (pericardial_effusion_present IN (0, 1)),
  skin_edema_present                            INTEGER NOT NULL DEFAULT 0 CHECK (skin_edema_present IN (0, 1)),
  placental_edema_present                       INTEGER NOT NULL DEFAULT 0 CHECK (placental_edema_present IN (0, 1)),
  polyhydramnios_present                        INTEGER NOT NULL DEFAULT 0 CHECK (polyhydramnios_present IN (0, 1)),
  mca_psv_mom                                   REAL NOT NULL DEFAULT 1.0,
  suspected_etiology_category                   TEXT NOT NULL CHECK (suspected_etiology_category IN (
                                                  'cardiovascular_structural_or_arrhythmia',
                                                  'fetal_anemia_parvovirus_or_hemoglobinopathy',
                                                  'chromosomal_genetic_aneuploidy',
                                                  'thoracic_lymphatic_cpam_chylothorax',
                                                  'twin_transfusion_ttts_or_taps',
                                                  'inborn_errors_metabolism_lysosomal',
                                                  'idiopathic_unexplained'
                                                )),
  fetal_arrhythmia_detected                     INTEGER NOT NULL DEFAULT 0 CHECK (fetal_arrhythmia_detected IN (0, 1)),
  maternal_mirror_syndrome_suspected            INTEGER NOT NULL DEFAULT 0 CHECK (maternal_mirror_syndrome_suspected IN (0, 1)),
  maternal_systolic_bp_mmhg                     INTEGER NOT NULL DEFAULT 120,
  maternal_diastolic_bp_mmhg                    INTEGER NOT NULL DEFAULT 80,
  maternal_proteinuria_grade                    TEXT NOT NULL DEFAULT 'nil' CHECK (maternal_proteinuria_grade IN ('nil', 'trace', '1_plus', '2_plus', '3_plus', '4_plus')),
  maternal_generalized_anasarca                 INTEGER NOT NULL DEFAULT 0 CHECK (maternal_generalized_anasarca IN (0, 1)),
  in_utero_intervention_planned                 TEXT NOT NULL DEFAULT 'conservative_surveillance' CHECK (in_utero_intervention_planned IN (
                                                  'intrauterine_blood_transfusion_iut',
                                                  'fetal_thoracocentesis_or_pigtail_shunt',
                                                  'antiarrhythmic_transplacental_therapy',
                                                  'amnioreduction_serial',
                                                  'conservative_surveillance',
                                                  'emergent_delivery_indicated'
                                                )),
  status                                        TEXT NOT NULL DEFAULT 'diagnostic_workup' CHECK (status IN (
                                                  'diagnostic_workup',
                                                  'in_utero_intervention_active',
                                                  'mirror_syndrome_monitoring',
                                                  'fetal_hydrops_resolving',
                                                  'preterm_emergency_delivery',
                                                  'intrauterine_fetal_demise',
                                                  'resolved_neonatal_transition'
                                                )),
  consultant_id                                 INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                                TEXT,
  created_at                                    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                                    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fetal_hydrops_patient ON fetal_hydrops_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_fetal_hydrops_status ON fetal_hydrops_episodes(status);

CREATE TABLE IF NOT EXISTS fetal_hydrops_flowsheet_logs (
  id                                            INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id                                    INTEGER NOT NULL REFERENCES fetal_hydrops_episodes(id) ON DELETE CASCADE,
  patient_id                                    INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                                  TEXT NOT NULL,
  gestational_age_weeks                         REAL NOT NULL,
  fetal_heart_rate_bpm                          INTEGER NOT NULL,
  mca_psv_cm_s                                  REAL NOT NULL,
  mca_psv_mom                                   REAL NOT NULL,
  pleural_effusion_depth_mm                     REAL NOT NULL DEFAULT 0.0,
  ascites_depth_mm                              REAL NOT NULL DEFAULT 0.0,
  maternal_bp_systolic                          INTEGER NOT NULL,
  maternal_bp_diastolic                         INTEGER NOT NULL,
  maternal_weight_kg                            REAL NOT NULL,
  notes                                         TEXT,
  logged_by_id                                  INTEGER NOT NULL REFERENCES users(id),
  created_at                                    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fetal_hydrops_flowsheet_ep ON fetal_hydrops_flowsheet_logs(episode_id);
CREATE INDEX IF NOT EXISTS idx_fetal_hydrops_flowsheet_pat ON fetal_hydrops_flowsheet_logs(patient_id);
