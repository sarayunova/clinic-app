-- Migration 140: Obstetric Massive Pulmonary Embolism (PE) & Acute Right Heart Failure Protocol
-- Reference: RCOG Green-top Guideline No. 37b / ESC Guidelines on PE in Pregnancy / AHA Guidelines

CREATE TABLE IF NOT EXISTS obstetric_massive_pe_episodes (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  admission_id                          INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  episode_code                          TEXT NOT NULL UNIQUE,
  onset_datetime                        TEXT NOT NULL,
  gestational_age_weeks                 REAL NOT NULL,
  clinical_setting                      TEXT NOT NULL CHECK (clinical_setting IN (
                                          'antenatal_antepartum',
                                          'intrapartum_labor',
                                          'immediate_postpartum_puerperium',
                                          'post_cesarean_section'
                                        )),
  systolic_bp_mmhg                      INTEGER NOT NULL,
  heart_rate_bpm                        INTEGER NOT NULL,
  respiratory_rate                      INTEGER NOT NULL,
  spo2_percent                          REAL NOT NULL,
  hemodynamic_instability_shock         INTEGER NOT NULL DEFAULT 1 CHECK (hemodynamic_instability_shock IN (0, 1)),
  rv_dysfunction_echo_confirmed         INTEGER NOT NULL DEFAULT 1 CHECK (rv_dysfunction_echo_confirmed IN (0, 1)),
  cardiac_biomarkers_elevated           INTEGER NOT NULL DEFAULT 1 CHECK (cardiac_biomarkers_elevated IN (0, 1)),
  pe_risk_stratification                TEXT NOT NULL CHECK (pe_risk_stratification IN (
                                          'high_risk_massive_pe',
                                          'intermediate_high_risk_submassive',
                                          'intermediate_low_risk',
                                          'low_risk_nonmassive'
                                        )),
  thrombolytic_therapy_administered     INTEGER NOT NULL DEFAULT 0 CHECK (thrombolytic_therapy_administered IN (0, 1)),
  thrombolytic_agent_dose               TEXT NOT NULL DEFAULT 'none_contraindicated_or_surgical' CHECK (thrombolytic_agent_dose IN (
                                          'alteplase_100mg_over_2hr',
                                          'alteplase_50mg_rapid_cardiac_arrest',
                                          'alteplase_0_6mg_kg_bolus_15min',
                                          'none_contraindicated_or_surgical'
                                        )),
  systemic_ufh_infusion_active          INTEGER NOT NULL DEFAULT 1 CHECK (systemic_ufh_infusion_active IN (0, 1)),
  target_aptt_seconds                   REAL NOT NULL DEFAULT 70.0,
  catheter_directed_or_surgical_embolectomy INTEGER NOT NULL DEFAULT 0 CHECK (catheter_directed_or_surgical_embolectomy IN (0, 1)),
  inferior_vena_cava_filter_placed      INTEGER NOT NULL DEFAULT 0 CHECK (inferior_vena_cava_filter_placed IN (0, 1)),
  status                                TEXT NOT NULL DEFAULT 'acute_massive_pe_resuscitation' CHECK (status IN (
                                          'acute_massive_pe_resuscitation',
                                          'thrombolytic_infusion_icu',
                                          'therapeutic_heparin_titration',
                                          'catheter_embolectomy_surgical',
                                          'subacute_transition_lmwh',
                                          'convalescent_anticoagulation_plan',
                                          'maternal_demise'
                                        )),
  consultant_id                         INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                        TEXT,
  created_at                            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_massive_pe_patient ON obstetric_massive_pe_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_massive_pe_status ON obstetric_massive_pe_episodes(status);

CREATE TABLE IF NOT EXISTS obstetric_massive_pe_flowsheet_logs (
  id                                    INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id                            INTEGER NOT NULL REFERENCES obstetric_massive_pe_episodes(id) ON DELETE CASCADE,
  patient_id                            INTEGER NOT NULL REFERENCES patients(id),
  log_datetime                          TEXT NOT NULL,
  hours_from_presentation               REAL NOT NULL,
  systolic_bp_mmhg                      INTEGER NOT NULL,
  diastolic_bp_mmhg                     INTEGER NOT NULL,
  heart_rate_bpm                        INTEGER NOT NULL,
  spo2_percent                          REAL NOT NULL,
  aptt_seconds                          REAL NOT NULL,
  heparin_infusion_rate_units_hr        REAL NOT NULL,
  vasopressor_norepinephrine_mcg_min    REAL NOT NULL DEFAULT 0.0,
  bleeding_complication_observed        INTEGER NOT NULL DEFAULT 0 CHECK (bleeding_complication_observed IN (0, 1)),
  notes                                 TEXT,
  logged_by_id                          INTEGER NOT NULL REFERENCES users(id),
  created_at                            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_massive_pe_flowsheet_ep ON obstetric_massive_pe_flowsheet_logs(episode_id);
CREATE INDEX IF NOT EXISTS idx_massive_pe_flowsheet_pat ON obstetric_massive_pe_flowsheet_logs(patient_id);
