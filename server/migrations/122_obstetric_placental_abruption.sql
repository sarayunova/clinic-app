-- Migration 122: Obstetric Placental Abruption (Abruptio Placentae) & Consumptive Coagulopathy Protocol
-- Reference: ACOG Practice Bulletin No. 183 / RCOG Green-top Guideline on Antepartum Hemorrhage

CREATE TABLE IF NOT EXISTS obstetric_placental_abruption_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  presentation_datetime                 TEXT NOT NULL,
  gestational_age_weeks                 REAL NOT NULL,
  maternal_parity                       INTEGER NOT NULL DEFAULT 0,
  vaginal_bleeding_severity             TEXT NOT NULL CHECK (vaginal_bleeding_severity IN (
                                          'concealed_no_external_bleeding',
                                          'mild_spotting',
                                          'moderate_bleeding',
                                          'severe_massive_hemorrhage'
                                        )),
  abdominal_pain_character              TEXT NOT NULL CHECK (abdominal_pain_character IN (
                                          'none',
                                          'mild_cramping',
                                          'severe_constant_knife_like'
                                        )),
  uterine_tonus                         TEXT NOT NULL CHECK (uterine_tonus IN (
                                          'normal_soft',
                                          'increased_hypertonic',
                                          'tetanic_woody_hard'
                                        )),
  fetal_heart_rate_status               TEXT NOT NULL CHECK (fetal_heart_rate_status IN (
                                          'reassuring_category_1',
                                          'indeterminate_category_2',
                                          'severe_bradycardia_category_3',
                                          'intrauterine_fetal_demise_confirmed'
                                        )),
  maternal_systolic_bp                  INTEGER NOT NULL,
  maternal_diastolic_bp                 INTEGER NOT NULL,
  maternal_heart_rate                   INTEGER NOT NULL,
  serum_fibrinogen_mg_dl                REAL NOT NULL,
  platelet_count                        INTEGER NOT NULL,
  hemoglobin_g_dl                       REAL NOT NULL,
  pt_inr                                REAL,
  kleihauer_betke_sent                  INTEGER NOT NULL DEFAULT 0 CHECK (kleihauer_betke_sent IN (0, 1)),
  ultrasound_retroplacental_hematoma    TEXT NOT NULL CHECK (ultrasound_retroplacental_hematoma IN (
                                          'none_visualized_abruption_not_excluded',
                                          'marginal_collection',
                                          'retroplacental_hematoma_present',
                                          'couvelaire_uterus_suspected'
                                        )),
  page_classification_grade             TEXT NOT NULL CHECK (page_classification_grade IN (
                                          'grade_0_retrospective_asymptomatic',
                                          'grade_1_mild_no_fetal_compromise',
                                          'grade_2_moderate_fetal_distress_live',
                                          'grade_3_severe_maternal_shock_demise_or_dic'
                                        )),
  mtp_activated                         INTEGER NOT NULL DEFAULT 0 CHECK (mtp_activated IN (0, 1)),
  prbc_units_transfused                 INTEGER NOT NULL DEFAULT 0,
  ffp_units_transfused                  INTEGER NOT NULL DEFAULT 0,
  cryoprecipitate_pools_transfused      INTEGER NOT NULL DEFAULT 0,
  delivery_mode_indicated               TEXT NOT NULL CHECK (delivery_mode_indicated IN (
                                          'emergent_crash_cesarean',
                                          'urgent_cesarean_transfer',
                                          'augmented_vaginal_delivery_under_monitoring',
                                          'conservative_surveillance_preterm'
                                        )),
  status                                TEXT NOT NULL DEFAULT 'emergent_stabilization' CHECK (status IN (
                                          'emergent_stabilization',
                                          'crash_cesarean_in_progress',
                                          'postpartum_dic_resuscitation',
                                          'stabilized_ward_observation',
                                          'resolved_discharged'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_abruption_patient ON obstetric_placental_abruption_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_abruption_status ON obstetric_placental_abruption_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_placental_abruption_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  abruption_episode_id                  INTEGER NOT NULL REFERENCES obstetric_placental_abruption_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                          TEXT NOT NULL,
  minutes_from_presentation             REAL NOT NULL,
  maternal_heart_rate                   INTEGER NOT NULL,
  maternal_blood_pressure_sys           INTEGER NOT NULL,
  maternal_blood_pressure_dia           INTEGER NOT NULL,
  fetal_heart_rate                      INTEGER,
  uterine_tone_assessment               TEXT NOT NULL CHECK (uterine_tone_assessment IN (
                                          'soft_relaxed_between_contractions',
                                          'tense_hypertonic',
                                          'woody_rigid'
                                        )),
  vaginal_blood_loss_ml                 REAL,
  fibrinogen_mg_dl                      REAL,
  blood_products_infused                TEXT,
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_abruption_logs_episode ON obstetric_placental_abruption_flowsheet_logs(abruption_episode_id);
