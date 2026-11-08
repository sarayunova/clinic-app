-- Migration 137: Obstetric Perimortem Cesarean Delivery (PMCD) / Resuscitative Hysterotomy Protocol
-- Reference: AHA Guidelines for CPR in Pregnancy / SOAP / RCOG Green-top Guideline No. 56

CREATE TABLE IF NOT EXISTS obstetric_pmcd_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  arrest_datetime                       TEXT NOT NULL,
  gestational_age_weeks                 REAL NOT NULL,
  initial_arrest_rhythm                 TEXT NOT NULL CHECK (initial_arrest_rhythm IN (
                                          'asystole',
                                          'pea',
                                          'ventricular_fibrillation',
                                          'pulseless_vt'
                                        )),
  cpr_initiated_datetime                TEXT NOT NULL,
  continuous_left_uterine_displacement  INTEGER NOT NULL DEFAULT 1 CHECK (continuous_left_uterine_displacement IN (0, 1)),
  pmcd_decision_minute                  REAL NOT NULL DEFAULT 4.0,
  incision_datetime                     TEXT,
  infant_delivery_datetime              TEXT,
  elapsed_arrest_to_delivery_minutes    REAL,
  rosc_achieved_post_delivery           INTEGER NOT NULL DEFAULT 1 CHECK (rosc_achieved_post_delivery IN (0, 1)),
  rosc_datetime                         TEXT,
  primary_etiology_beau_chops           TEXT NOT NULL CHECK (primary_etiology_beau_chops IN (
                                          'bleeding_dic',
                                          'embolism_afe_pte',
                                          'anesthetic_complication_last',
                                          'uterine_atony',
                                          'cardiac_underlying',
                                          'hypertension_preeclampsia',
                                          'other_toxic_metabolic',
                                          'placenta_abruption_accreta',
                                          'sepsis_shock'
                                        )),
  uterine_closure_method                TEXT NOT NULL DEFAULT 'rapid_single_layer_in_situ' CHECK (uterine_closure_method IN (
                                          'rapid_single_layer_in_situ',
                                          'hemostatic_packing_temporary_closure',
                                          'emergent_hysterectomy'
                                        )),
  maternal_survival_status              TEXT NOT NULL DEFAULT 'active_icu_targeted_temperature_management' CHECK (maternal_survival_status IN (
                                          'active_icu_targeted_temperature_management',
                                          'post_cardiac_arrest_stable',
                                          'neurologically_intact_recovery',
                                          'maternal_demise'
                                        )),
  neonatal_survival_status              TEXT NOT NULL DEFAULT 'nicu_active_hypothermia_hie' CHECK (neonatal_survival_status IN (
                                          'nicu_active_hypothermia_hie',
                                          'stable_nicu_survivor',
                                          'neonatal_demise'
                                        )),
  status                                TEXT NOT NULL DEFAULT 'cardiac_arrest_resuscitation' CHECK (status IN (
                                          'cardiac_arrest_resuscitation',
                                          'hysterotomy_evacuation_active',
                                          'post_rosc_intensive_care',
                                          'surgical_hemostasis_icu',
                                          'convalescent_rehabilitation',
                                          'case_closed'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pmcd_patient ON obstetric_pmcd_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_pmcd_status ON obstetric_pmcd_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_pmcd_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  pmcd_episode_id                       INTEGER NOT NULL REFERENCES obstetric_pmcd_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                          TEXT NOT NULL,
  minutes_post_arrest                   REAL NOT NULL,
  heart_rate_bpm                        INTEGER NOT NULL,
  systolic_bp                           INTEGER NOT NULL,
  diastolic_bp                          INTEGER NOT NULL,
  end_tidal_co2_mmhg                    REAL NOT NULL,
  pupillary_response                    TEXT NOT NULL CHECK (pupillary_response IN (
                                          'reactive_equal',
                                          'sluggish',
                                          'fixed_dilated'
                                        )),
  chest_compressions_quality            TEXT NOT NULL CHECK (chest_compressions_quality IN (
                                          'optimal_etco2_gt_20',
                                          'suboptimal_etco2_lt_10',
                                          'rosc_sustained'
                                        )),
  epinephrine_cumulative_doses          INTEGER NOT NULL DEFAULT 0,
  defibrillation_shocks_count           INTEGER NOT NULL DEFAULT 0,
  blood_products_transfused_units       INTEGER NOT NULL DEFAULT 0,
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pmcd_flowsheet_episode ON obstetric_pmcd_flowsheet_logs(pmcd_episode_id);
CREATE INDEX IF NOT EXISTS idx_pmcd_flowsheet_patient ON obstetric_pmcd_flowsheet_logs(patient_id);
