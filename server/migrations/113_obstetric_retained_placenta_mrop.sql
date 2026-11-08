-- Migration 113: Obstetric Retained Placenta & Emergent Manual Removal (MROP) Protocol
-- Reference: RCOG Green-top Guideline / WHO Recommendations on Prevention and Treatment of Postpartum Haemorrhage

CREATE TABLE IF NOT EXISTS obstetric_retained_placenta_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                        TEXT NOT NULL UNIQUE,
  delivery_datetime                   TEXT NOT NULL,
  third_stage_duration_minutes        INTEGER NOT NULL,
  active_management_third_stage       INTEGER NOT NULL DEFAULT 1 CHECK (active_management_third_stage IN (0, 1)),
  estimated_blood_loss_ml             INTEGER NOT NULL DEFAULT 200,
  hemodynamic_stability               TEXT NOT NULL CHECK (hemodynamic_stability IN (
                                        'stable',
                                        'borderline_tachycardic',
                                        'decompensated_hypotensive_shock'
                                      )),
  bladder_catheterized                INTEGER NOT NULL DEFAULT 1 CHECK (bladder_catheterized IN (0, 1)),
  retained_placenta_type              TEXT NOT NULL CHECK (retained_placenta_type IN (
                                        'placenta_adherens',
                                        'trapped_incarcerated_placenta',
                                        'partial_accreta_suspected'
                                      )),
  iuv_oxytocin_attempted              INTEGER NOT NULL DEFAULT 0 CHECK (iuv_oxytocin_attempted IN (0, 1)),
  iuv_oxytocin_dose_iu                INTEGER DEFAULT 20,
  iuv_oxytocin_successful             INTEGER NOT NULL DEFAULT 0 CHECK (iuv_oxytocin_successful IN (0, 1)),
  mrop_indicated                      INTEGER NOT NULL DEFAULT 1 CHECK (mrop_indicated IN (0, 1)),
  mrop_performed                      INTEGER NOT NULL DEFAULT 0 CHECK (mrop_performed IN (0, 1)),
  mrop_datetime                       TEXT,
  anesthesia_type                     TEXT CHECK (anesthesia_type IN (
                                        'spinal_regional',
                                        'epidural_topup',
                                        'general_anesthesia',
                                        'iv_sedation_analgesia'
                                      )),
  placenta_complete_post_removal      INTEGER NOT NULL DEFAULT 1 CHECK (placenta_complete_post_removal IN (0, 1)),
  prophylactic_antibiotics_given      INTEGER NOT NULL DEFAULT 1 CHECK (prophylactic_antibiotics_given IN (0, 1)),
  post_removal_oxytocin_infusion      INTEGER NOT NULL DEFAULT 1 CHECK (post_removal_oxytocin_infusion IN (0, 1)),
  status                              TEXT NOT NULL DEFAULT 'under_conservative_management' CHECK (status IN (
                                        'under_conservative_management',
                                        'iuv_oxytocin_in_progress',
                                        'mrop_in_theater',
                                        'post_removal_recovery',
                                        'resolved_discharged',
                                        'escalated_to_laparotomy_hysterectomy'
                                      )),
  consultant_id                       INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_retained_placenta_patient ON obstetric_retained_placenta_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_obstetric_retained_placenta_status ON obstetric_retained_placenta_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_retained_placenta_flowsheet_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  retained_episode_id                 INTEGER NOT NULL REFERENCES obstetric_retained_placenta_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_datetime                        TEXT NOT NULL,
  minutes_from_delivery               INTEGER NOT NULL,
  blood_pressure_sys                  INTEGER,
  blood_pressure_dia                  INTEGER,
  heart_rate                          INTEGER,
  cumulative_blood_loss_ml            INTEGER NOT NULL,
  uterine_fundus_tone                 TEXT NOT NULL CHECK (uterine_fundus_tone IN (
                                        'firm_contracted',
                                        'soft_boggy',
                                        'contracted_with_lower_spasm'
                                      )),
  active_vaginal_bleeding             TEXT NOT NULL CHECK (active_vaginal_bleeding IN (
                                        'minimal_trickle',
                                        'moderate_lochia',
                                        'brisk_hemorrhage'
                                      )),
  cord_lengthening_observed           INTEGER NOT NULL DEFAULT 0 CHECK (cord_lengthening_observed IN (0, 1)),
  intervention_applied                TEXT,
  notes                               TEXT,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_retained_placenta_logs_episode ON obstetric_retained_placenta_flowsheet_logs(retained_episode_id);
