-- Migration 143: Obstetric Cerebral Venous Sinus Thrombosis (CVST) & Puerperal Encephalopathy Protocol
-- References: European Stroke Organisation (ESO) Guidelines on CVST / AHA/ASA Stroke in Pregnancy & Postpartum

CREATE TABLE IF NOT EXISTS obstetric_cvst_episodes (
  id                                            INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                                    INTEGER NOT NULL REFERENCES patients(id),
  admission_id                                  INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                                  TEXT NOT NULL UNIQUE,
  onset_datetime                                TEXT NOT NULL,
  gestational_age_weeks                         REAL NOT NULL,
  clinical_timing                               TEXT NOT NULL CHECK (clinical_timing IN (
                                                  'antepartum_first_trimester',
                                                  'antepartum_second_trimester',
                                                  'antepartum_third_trimester',
                                                  'early_postpartum_puerperium',
                                                  'late_postpartum'
                                                )),
  presenting_headache_type                      TEXT NOT NULL CHECK (presenting_headache_type IN (
                                                  'thunderclap_sudden_severe',
                                                  'progressive_unremitting_subacute',
                                                  'postural_headache_mimicking_pdph',
                                                  'mild_intermittent'
                                                )),
  seizures_present                              INTEGER NOT NULL DEFAULT 0 CHECK (seizures_present IN (0, 1)),
  papilledema_present                           INTEGER NOT NULL DEFAULT 0 CHECK (papilledema_present IN (0, 1)),
  focal_neurological_deficit                    INTEGER NOT NULL DEFAULT 0 CHECK (focal_neurological_deficit IN (0, 1)),
  altered_mental_status_coma                    INTEGER NOT NULL DEFAULT 0 CHECK (altered_mental_status_coma IN (0, 1)),
  thrombosed_sinus_locations_json               TEXT NOT NULL DEFAULT '[]',
  intracranial_hemorrhagic_venous_infarct       INTEGER NOT NULL DEFAULT 0 CHECK (intracranial_hemorrhagic_venous_infarct IN (0, 1)),
  therapeutic_anticoagulation_active            INTEGER NOT NULL DEFAULT 1 CHECK (therapeutic_anticoagulation_active IN (0, 1)),
  anticoagulant_agent                           TEXT NOT NULL DEFAULT 'therapeutic_lmwh_enoxaparin_1mg_kg_q12h' CHECK (anticoagulant_agent IN (
                                                  'therapeutic_lmwh_enoxaparin_1mg_kg_q12h',
                                                  'therapeutic_ufh_continuous_infusion',
                                                  'withheld_severe_mass_effect_neurosurgery',
                                                  'other'
                                                )),
  intracranial_hypertension_management          TEXT NOT NULL DEFAULT 'elevate_head_bed_and_osmotherapy' CHECK (intracranial_hypertension_management IN (
                                                  'elevate_head_bed_and_osmotherapy',
                                                  'mannitol_or_hypertonic_saline_infusion',
                                                  'decompressive_hemicraniectomy_eval',
                                                  'conservative_monitoring'
                                                )),
  antiepileptic_therapy_active                  INTEGER NOT NULL DEFAULT 0 CHECK (antiepileptic_therapy_active IN (0, 1)),
  status                                        TEXT NOT NULL DEFAULT 'acute_cvst_inpatient_resuscitation' CHECK (status IN (
                                                  'acute_cvst_inpatient_resuscitation',
                                                  'therapeutic_anticoagulation_active',
                                                  'elevated_icp_critical_monitoring',
                                                  'endovascular_or_surgical_intervention',
                                                  'subacute_neurological_rehabilitation',
                                                  'convalescent_long_term_anticoagulation',
                                                  'maternal_demise'
                                                )),
  consultant_id                                 INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                                TEXT,
  created_at                                    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                                    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_cvst_patient ON obstetric_cvst_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_obstetric_cvst_status ON obstetric_cvst_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_cvst_flowsheet_logs (
  id                                            INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id                                    INTEGER NOT NULL REFERENCES obstetric_cvst_episodes(id) ON DELETE CASCADE,
  patient_id                                    INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                                  TEXT NOT NULL,
  gcs_score                                     INTEGER NOT NULL,
  pupillary_reactivity                          TEXT NOT NULL CHECK (pupillary_reactivity IN ('equal_and_reactive', 'sluggish', 'unilateral_dilated', 'bilateral_fixed')),
  headache_severity_nrs                         INTEGER NOT NULL CHECK (headache_severity_nrs BETWEEN 0 AND 10),
  systolic_bp_mmhg                              INTEGER NOT NULL,
  diastolic_bp_mmhg                             INTEGER NOT NULL,
  heart_rate_bpm                                INTEGER NOT NULL,
  anti_xa_or_aptt_level                         REAL NOT NULL DEFAULT 0.0,
  seizure_activity_observed                     INTEGER NOT NULL DEFAULT 0 CHECK (seizure_activity_observed IN (0, 1)),
  notes                                         TEXT,
  logged_by_id                                  INTEGER NOT NULL REFERENCES users(id),
  created_at                                    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obstetric_cvst_flowsheet_ep ON obstetric_cvst_flowsheet_logs(episode_id);
CREATE INDEX IF NOT EXISTS idx_obstetric_cvst_flowsheet_pat ON obstetric_cvst_flowsheet_logs(patient_id);
