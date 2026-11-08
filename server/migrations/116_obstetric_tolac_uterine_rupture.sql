-- Migration 116: Obstetric Trial of Labor After Cesarean (TOLAC) & Impending Uterine Rupture Protocol
-- Reference: ACOG Practice Bulletin No. 205 / RCOG Green-top Guideline No. 45

CREATE TABLE IF NOT EXISTS obstetric_tolac_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  assessment_datetime                 TEXT NOT NULL,
  gestational_age_weeks               REAL NOT NULL,
  maternal_age                        INTEGER NOT NULL,
  maternal_bmi                        REAL NOT NULL,
  prior_cesarean_count                INTEGER NOT NULL DEFAULT 1,
  prior_uterine_incision_type         TEXT NOT NULL CHECK (prior_uterine_incision_type IN (
                                        'low_transverse',
                                        'unknown_low_transverse_presumed',
                                        'classical_vertical',
                                        'inverted_t_or_j',
                                        'prior_transmural_myomectomy'
                                      )),
  prior_vaginal_delivery              TEXT NOT NULL CHECK (prior_vaginal_delivery IN (
                                        'prior_vbac',
                                        'prior_vaginal_before_cesarean',
                                        'no_prior_vaginal_delivery'
                                      )),
  indication_for_prior_cesarean       TEXT NOT NULL,
  interdelivery_interval_months       INTEGER NOT NULL, -- < 18-24 months is higher risk
  bishop_score                        INTEGER NOT NULL DEFAULT 5,
  grobman_vbac_success_pct            REAL NOT NULL,
  contraindications_present           INTEGER NOT NULL DEFAULT 0 CHECK (contraindications_present IN (0, 1)),
  efm_abnormality                     TEXT NOT NULL CHECK (efm_abnormality IN (
                                        'normal_category_1',
                                        'indeterminate_category_2',
                                        'variable_decelerations_recurrent',
                                        'prolonged_deceleration',
                                        'persistent_bradycardia_lt_90'
                                      )),
  iupc_loss_of_uterine_tone           INTEGER NOT NULL DEFAULT 0 CHECK (iupc_loss_of_uterine_tone IN (0, 1)),
  acute_scar_tenderness               INTEGER NOT NULL DEFAULT 0 CHECK (acute_scar_tenderness IN (0, 1)),
  vaginal_bleeding_fresh              INTEGER NOT NULL DEFAULT 0 CHECK (vaginal_bleeding_fresh IN (0, 1)),
  cessation_of_contractions           INTEGER NOT NULL DEFAULT 0 CHECK (cessation_of_contractions IN (0, 1)),
  presenting_part_retraction          INTEGER NOT NULL DEFAULT 0 CHECK (presenting_part_retraction IN (0, 1)),
  rupture_risk_tier                   TEXT NOT NULL CHECK (rupture_risk_tier IN (
                                        'standard_tolac_candidate',
                                        'elevated_rupture_risk',
                                        'impending_or_active_uterine_rupture'
                                      )),
  status                              TEXT NOT NULL DEFAULT 'eligible_tolac_counseled' CHECK (status IN (
                                        'eligible_tolac_counseled',
                                        'active_labor_efm_monitoring',
                                        'impending_rupture_detected',
                                        'crash_cesarean_transfer',
                                        'successful_vbac',
                                        'elective_repeat_cesarean'
                                      )),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_tolac_patient ON obstetric_tolac_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_obstetric_tolac_status ON obstetric_tolac_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_tolac_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  tolac_episode_id                    INTEGER NOT NULL REFERENCES obstetric_tolac_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                        TEXT NOT NULL,
  hours_in_active_labor               REAL NOT NULL,
  cervical_dilation_cm                REAL NOT NULL,
  fetal_heart_rate_baseline           INTEGER NOT NULL,
  efm_category                        TEXT NOT NULL CHECK (efm_category IN (
                                        'category_1_normal',
                                        'category_2_indeterminate',
                                        'category_3_abnormal'
                                      )),
  contractions_per_10min              INTEGER NOT NULL,
  resting_uterine_tone_mmhg           INTEGER,
  lower_segment_scar_pain             INTEGER NOT NULL DEFAULT 0 CHECK (lower_segment_scar_pain IN (0, 1)),
  intervention_applied                TEXT,
  notes                               TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tolac_logs_episode ON obstetric_tolac_flowsheet_logs(tolac_episode_id);
