-- Migration 029: Maternal Early Obstetric Warning Score (MEOWS) & Sepsis in Obstetrics (SOS) Protocol
-- Implements RCOG/MBRRACE-UK MEOWS Track-and-Trigger chart, Sepsis in Obstetrics Score (SOS),
-- and 1-hour maternal sepsis resuscitation bundle.

CREATE TABLE maternal_meows_episodes (
  id                                  INTEGER PRIMARY KEY,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  maternity_admission_id              INTEGER REFERENCES maternity_admissions(id) ON DELETE SET NULL,
  episode_type                        TEXT NOT NULL DEFAULT 'antenatal' CHECK (episode_type IN (
                                        'antenatal',
                                        'intrapartum',
                                        'postpartum',
                                        'post_op_lscs'
                                      )),
  started_at                          TEXT NOT NULL,                            -- ISO-8601
  clinical_indication                 TEXT,                                     -- e.g. "Postpartum day 1 following Emergency LSCS for PROM"
  primary_diagnosis                   TEXT,
  high_risk_flags                     TEXT,                                     -- e.g. "Severe Preeclampsia, Chorioamnionitis, GDM, VTE Risk"
  is_active                           INTEGER NOT NULL DEFAULT 1,
  status                              TEXT NOT NULL DEFAULT 'active_monitoring' CHECK (status IN (
                                        'active_monitoring',
                                        'stepped_down_stable',
                                        'transferred_to_hdu_icu',
                                        'discharged',
                                        'resolved'
                                      )),
  created_by                          INTEGER NOT NULL REFERENCES users(id),
  updated_by                          INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL,
  updated_at                          TEXT NOT NULL
);

CREATE INDEX idx_meows_patient ON maternal_meows_episodes(patient_id);
CREATE INDEX idx_meows_admission ON maternal_meows_episodes(maternity_admission_id);

-- Serial MEOWS & Sepsis Bedside Observations
CREATE TABLE maternal_meows_observations (
  id                                  INTEGER PRIMARY KEY,
  meows_episode_id                    INTEGER NOT NULL REFERENCES maternal_meows_episodes(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  recorded_at                         TEXT NOT NULL,                            -- ISO-8601
  
  -- Core MEOWS Physiological Vitals
  respiratory_rate                    INTEGER,                                  -- Normal: 11-20
  rr_trigger                          TEXT NOT NULL DEFAULT 'green' CHECK (rr_trigger IN ('green', 'yellow', 'red')),
  
  spo2_percent                        INTEGER,                                  -- Normal: >= 96%
  spo2_trigger                        TEXT NOT NULL DEFAULT 'green' CHECK (spo2_trigger IN ('green', 'yellow', 'red')),
  supplemental_o2                     INTEGER NOT NULL DEFAULT 0,
  o2_flow_rate_lpm                    REAL,
  
  temperature_c                       REAL,                                     -- Normal: 36.0 - 37.4 C
  temp_trigger                        TEXT NOT NULL DEFAULT 'green' CHECK (temp_trigger IN ('green', 'yellow', 'red')),
  
  bp_systolic                         INTEGER,                                  -- Normal: 100 - 139 mmHg
  bp_diastolic                        INTEGER,                                  -- Normal: 50 - 89 mmHg
  bp_trigger                          TEXT NOT NULL DEFAULT 'green' CHECK (bp_trigger IN ('green', 'yellow', 'red')),
  
  heart_rate                          INTEGER,                                  -- Normal: 60 - 99 bpm
  hr_trigger                          TEXT NOT NULL DEFAULT 'green' CHECK (hr_trigger IN ('green', 'yellow', 'red')),
  
  avpu_consciousness                  TEXT NOT NULL DEFAULT 'alert' CHECK (avpu_consciousness IN (
                                        'alert',
                                        'voice',
                                        'pain',
                                        'unresponsive',
                                        'confused_agitated'
                                      )),
  neuro_trigger                       TEXT NOT NULL DEFAULT 'green' CHECK (neuro_trigger IN ('green', 'yellow', 'red')),

  -- Obstetric Specific Parameters
  pain_score                          INTEGER NOT NULL DEFAULT 0 CHECK (pain_score BETWEEN 0 AND 3), -- 0=None, 1=Mild, 2=Moderate, 3=Severe non-labor
  lochia_status                       TEXT NOT NULL DEFAULT 'normal' CHECK (lochia_status IN (
                                        'normal',
                                        'scant',
                                        'heavy_foul_smelling',
                                        'excessive_clots_hemorrhage'
                                      )),
  lochia_trigger                      TEXT NOT NULL DEFAULT 'green' CHECK (lochia_trigger IN ('green', 'yellow', 'red')),
  
  urine_output_ml_hr                  REAL,                                     -- Normal: >= 30 mL/hr
  urine_trigger                       TEXT NOT NULL DEFAULT 'green' CHECK (urine_trigger IN ('green', 'yellow', 'red')),
  
  proteinuria                         TEXT NOT NULL DEFAULT 'nil' CHECK (proteinuria IN ('nil', 'trace', '1+', '2+', '3+', '4+')),
  proteinuria_trigger                 TEXT NOT NULL DEFAULT 'green' CHECK (proteinuria_trigger IN ('green', 'yellow', 'red')),

  -- Composite Trigger Summary
  yellow_triggers_count               INTEGER NOT NULL DEFAULT 0,
  red_triggers_count                  INTEGER NOT NULL DEFAULT 0,
  overall_alert_level                 TEXT NOT NULL DEFAULT 'normal_green' CHECK (overall_alert_level IN (
                                        'normal_green',
                                        'single_yellow',
                                        'urgent_two_yellow_one_red',
                                        'critical_multiple_red'
                                      )),
  action_required                     TEXT,
  action_taken                        TEXT,
  escalated_to_doctor                 INTEGER NOT NULL DEFAULT 0,
  escalated_to_name                   TEXT,

  -- Sepsis in Obstetrics Score (SOS)
  suspected_infection_site            TEXT,                                     -- Chorioamnionitis, Endometritis, UTI, Wound, Respiratory
  sos_score                           INTEGER DEFAULT 0,
  sos_risk_level                      TEXT NOT NULL DEFAULT 'low' CHECK (sos_risk_level IN ('low', 'intermediate', 'high_septic_shock')),
  serum_lactate_mmol_l                REAL,
  white_cell_count_k                  REAL,

  -- 1-Hour Maternal Sepsis Resuscitation Bundle
  bundle_blood_cultures_taken         INTEGER NOT NULL DEFAULT 0,
  bundle_lactate_drawn                INTEGER NOT NULL DEFAULT 0,
  bundle_iv_antibiotics_given         INTEGER NOT NULL DEFAULT 0,
  bundle_iv_fluids_bolus_given        INTEGER NOT NULL DEFAULT 0,
  bundle_oxygen_applied               INTEGER NOT NULL DEFAULT 0,
  bundle_foley_urine_hourly           INTEGER NOT NULL DEFAULT 0,
  bundle_notes                        TEXT,

  -- Metadata
  recorded_by                         INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL
);

CREATE INDEX idx_meows_obs_episode ON maternal_meows_observations(meows_episode_id);
CREATE INDEX idx_meows_obs_patient ON maternal_meows_observations(patient_id);
