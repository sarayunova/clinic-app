-- Migration 125: Obstetric Vasa Previa & Fetal Exsanguination Emergency Protocol
-- Reference: ACOG Practice Bulletin No. 204 / SMFM Consult Series #67

CREATE TABLE IF NOT EXISTS obstetric_vasa_previa_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  gestational_age_weeks                 REAL NOT NULL,
  vasa_previa_type                      TEXT NOT NULL CHECK (vasa_previa_type IN (
                                          'type_1_velamentous_cord',
                                          'type_2_succenturiate_or_bilobed_lobe',
                                          'undetermined_aberrant_vessel'
                                        )),
  distance_to_internal_os_mm            REAL NOT NULL,
  color_doppler_confirmed               INTEGER NOT NULL DEFAULT 1 CHECK (color_doppler_confirmed IN (0, 1)),
  cervical_length_mm                    REAL,
  vaginal_bleeding_present              INTEGER NOT NULL DEFAULT 0 CHECK (vaginal_bleeding_present IN (0, 1)),
  apt_test_result                       TEXT NOT NULL CHECK (apt_test_result IN (
                                          'not_performed',
                                          'positive_fetal_hemoglobin_pink',
                                          'negative_maternal_hemoglobin_yellow_brown'
                                        )),
  membrane_status                       TEXT NOT NULL CHECK (membrane_status IN (
                                          'intact',
                                          'ruptured_spontaneous',
                                          'artificial_rupture_contraindicated'
                                        )),
  fetal_heart_rate_bpm                  INTEGER,
  ctg_pattern                           TEXT NOT NULL CHECK (ctg_pattern IN (
                                          'category_1_normal',
                                          'category_2_variable_decelerations',
                                          'category_3_sinusoidal_pattern',
                                          'category_3_severe_prolonged_bradycardia'
                                        )),
  corticosteroids_administered          INTEGER NOT NULL DEFAULT 0 CHECK (corticosteroids_administered IN (0, 1)),
  elective_delivery_window_weeks        TEXT NOT NULL CHECK (elective_delivery_window_weeks IN (
                                          '34_0_to_35_6_weeks',
                                          'emergent_crash_cesarean',
                                          'outpatient_surveillance_pre_34w'
                                        )),
  status                                TEXT NOT NULL DEFAULT 'antenatal_surveillance' CHECK (status IN (
                                          'antenatal_surveillance',
                                          'inpatient_rupture_precautions',
                                          'emergent_crash_cesarean_section',
                                          'postpartum_neonatal_resuscitation',
                                          'resolved_maternal_neonatal_discharge'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vasa_previa_patient ON obstetric_vasa_previa_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_vasa_previa_status ON obstetric_vasa_previa_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_vasa_previa_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  vasa_previa_episode_id                INTEGER NOT NULL REFERENCES obstetric_vasa_previa_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                          TEXT NOT NULL,
  gestational_age_weeks                 REAL NOT NULL,
  maternal_systolic_bp                  INTEGER NOT NULL,
  maternal_diastolic_bp                 INTEGER NOT NULL,
  maternal_heart_rate                   INTEGER NOT NULL,
  fetal_heart_rate_bpm                  INTEGER NOT NULL,
  ctg_baseline_variability              TEXT NOT NULL CHECK (ctg_baseline_variability IN (
                                          'normal_moderate',
                                          'minimal',
                                          'absent',
                                          'sinusoidal'
                                        )),
  vaginal_bleeding_severity             TEXT NOT NULL CHECK (vaginal_bleeding_severity IN (
                                          'none',
                                          'spotting_pink_mucus',
                                          'frank_fetal_blood_active',
                                          'massive_hemorrhage'
                                        )),
  uterine_contractions_per_10min        INTEGER NOT NULL DEFAULT 0,
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vasa_previa_logs_episode ON obstetric_vasa_previa_flowsheet_logs(vasa_previa_episode_id);
