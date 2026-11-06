-- Postpartum Hemorrhage (PPH) Early Warning, Quantitative Blood Loss (QBL) & Resuscitation Protocol
-- Tracks gravimetric/volumetric blood loss, Obstetric Shock Index (OSI), 4T etiology,
-- stage-based uterotonics checklist, transfusion protocol (MTP), and surgical tamponade.

CREATE TABLE pph_assessments (
  id                              INTEGER PRIMARY KEY,
  patient_id                      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  maternity_admission_id          INTEGER REFERENCES maternity_admissions(id) ON DELETE SET NULL,
  
  -- Delivery Context & Timing
  delivery_mode                   TEXT NOT NULL DEFAULT 'vaginal' CHECK (delivery_mode IN ('vaginal', 'cesarean', 'assisted_vacuum_forceps')),
  delivery_timestamp              TEXT NOT NULL,            -- ISO or YYYY-MM-DD HH:MM
  assessment_timestamp            TEXT NOT NULL,            -- ISO or YYYY-MM-DD HH:MM
  
  -- PPH Staging & 4T Etiology
  pph_stage                       TEXT NOT NULL DEFAULT 'stage_0_routine' CHECK (pph_stage IN (
                                    'stage_0_routine',
                                    'stage_1_alert',
                                    'stage_2_moderate',
                                    'stage_3_severe_mtp'
                                  )),
  primary_etiology_4t             TEXT NOT NULL DEFAULT 'tone_atony' CHECK (primary_etiology_4t IN (
                                    'tone_atony',
                                    'trauma_laceration',
                                    'tissue_retained',
                                    'thrombin_coagulopathy',
                                    'mixed_unclear'
                                  )),
  etiology_details                TEXT,                     -- e.g. "Uterine atony with cervical tear"
  uterine_tone                    TEXT NOT NULL DEFAULT 'soft_boggy' CHECK (uterine_tone IN (
                                    'well_contracted_firm',
                                    'soft_boggy',
                                    'relaxing_between_massage',
                                    'uncontracted'
                                  )),
  
  -- Quantitative Blood Loss (QBL) Calculator Components
  qbl_total_ml                    INTEGER NOT NULL DEFAULT 0,
  qbl_calibrated_drape_ml         INTEGER NOT NULL DEFAULT 0, -- Under-buttocks V-drape collection
  qbl_suction_canister_ml         INTEGER NOT NULL DEFAULT 0, -- Total canister minus amniotic/irrigation
  qbl_sponges_wet_weight_g        INTEGER NOT NULL DEFAULT 0, -- Total wet weight of sponges & pads (g)
  qbl_sponges_dry_weight_g        INTEGER NOT NULL DEFAULT 0, -- Tare weight of dry sponges (g)
  qbl_clots_weighed_g             INTEGER NOT NULL DEFAULT 0, -- Weighed vaginal/retroplacental clots (1g = 1mL)
  ebl_visual_estimate_ml          INTEGER,                    -- Estimated visual blood loss for comparison
  
  -- Hemodynamics & Obstetric Shock Index (OSI)
  maternal_pulse                  INTEGER,                    -- Heart rate (bpm)
  maternal_bp_systolic            INTEGER,                    -- SBP (mmHg)
  maternal_bp_diastolic           INTEGER,                    -- DBP (mmHg)
  shock_index                     REAL,                       -- Pulse / SBP
  shock_index_severity            TEXT NOT NULL DEFAULT 'normal' CHECK (shock_index_severity IN (
                                    'normal',                 -- < 0.9
                                    'early_warning',          -- 0.9 - 0.99
                                    'high_risk',              -- 1.0 - 1.39
                                    'critical_collapse'       -- >= 1.4
                                  )),
  mean_arterial_pressure          INTEGER,                    -- DBP + (SBP - DBP)/3
  spo2_pct                        INTEGER,                    -- Oxygen saturation (%)
  temperature_c                   REAL,
  
  -- Stage-Based Medical Resuscitation & Uterotonics Checklist
  bimanual_compression_done      INTEGER NOT NULL DEFAULT 0,
  bladder_catheterized            INTEGER NOT NULL DEFAULT 0, -- Foley inserted to empty bladder & track urine output
  iv_access_two_wide_bore         INTEGER NOT NULL DEFAULT 0, -- 14G or 16G cannulae in situ
  crystalloids_infused_ml         INTEGER NOT NULL DEFAULT 0, -- Ringer's Lactate / NS volume
  
  oxytocin_given                  INTEGER NOT NULL DEFAULT 0,
  oxytocin_dose_route             TEXT,                       -- e.g. "10 IU IM + 20 IU in 500mL NS @ 250mL/hr"
  
  tranexamic_acid_given           INTEGER NOT NULL DEFAULT 0, -- 1g IV over 10m within 3h (WOMAN trial)
  txa_given_at                    TEXT,
  
  methylergometrine_given         INTEGER NOT NULL DEFAULT 0, -- Methergine 0.2mg IM
  methergine_contraindicated      INTEGER NOT NULL DEFAULT 0, -- 1 if hypertensive / pre-eclampsia
  
  carboprost_given                INTEGER NOT NULL DEFAULT 0, -- PGF2alpha 250mcg IM
  carboprost_doses_count          INTEGER NOT NULL DEFAULT 0,
  carboprost_contraindicated      INTEGER NOT NULL DEFAULT 0, -- 1 if bronchial asthma
  
  misoprostol_given               INTEGER NOT NULL DEFAULT 0, -- PGE1 (600 - 800mcg sublingual / rectal)
  misoprostol_dose_mcg            INTEGER DEFAULT 0,
  
  -- Advanced Tamponade, Transfusion & Surgical Interventions
  uterine_tamponade_balloon_used  INTEGER NOT NULL DEFAULT 0, -- Bakri / condom catheter balloon
  balloon_fill_volume_ml          INTEGER DEFAULT 0,
  
  mtp_activated                   INTEGER NOT NULL DEFAULT 0, -- Massive Transfusion Protocol (1:1:1)
  blood_units_transfused          INTEGER NOT NULL DEFAULT 0, -- PRBC
  ffp_units_transfused            INTEGER NOT NULL DEFAULT 0, -- FFP
  platelet_units_transfused       INTEGER NOT NULL DEFAULT 0, -- Platelets
  cryoprecipitate_units_transfused INTEGER NOT NULL DEFAULT 0, -- Cryoprecipitate
  
  surgical_intervention           TEXT NOT NULL DEFAULT 'none' CHECK (surgical_intervention IN (
                                    'none',
                                    'compression_sutures_b_lynch',
                                    'uterine_artery_ligation',
                                    'internal_iliac_ligation',
                                    'peripartum_hysterectomy',
                                    'examination_under_anesthesia'
                                  )),
  
  -- Outcome & Resolution
  outcome_status                  TEXT NOT NULL DEFAULT 'bleeding_controlled' CHECK (outcome_status IN (
                                    'bleeding_controlled',
                                    'stable_under_observation',
                                    'transferred_to_ot',
                                    'transferred_to_icu',
                                    'critical_unstable'
                                  )),
  attending_obstetrician          TEXT,
  attending_anesthetist           TEXT,
  nurse_in_charge                 TEXT,
  notes                           TEXT,
  
  created_by                      INTEGER NOT NULL REFERENCES users(id),
  updated_by                      INTEGER NOT NULL REFERENCES users(id),
  created_at                      TEXT NOT NULL,
  updated_at                      TEXT NOT NULL
);

CREATE INDEX idx_pph_patient ON pph_assessments(patient_id, assessment_timestamp DESC);
CREATE INDEX idx_pph_stage ON pph_assessments(pph_stage);

-- Chronological QBL & Vitals Increments during Active Resuscitation
CREATE TABLE pph_qbl_timeline_entries (
  id                              INTEGER PRIMARY KEY,
  pph_assessment_id               INTEGER NOT NULL REFERENCES pph_assessments(id) ON DELETE CASCADE,
  logged_at                       TEXT NOT NULL,            -- ISO timestamp
  
  drape_increment_ml              INTEGER NOT NULL DEFAULT 0,
  sponge_increment_g              INTEGER NOT NULL DEFAULT 0,
  clots_increment_g               INTEGER NOT NULL DEFAULT 0,
  cumulative_qbl_ml               INTEGER NOT NULL,
  
  pulse                           INTEGER,
  bp_systolic                     INTEGER,
  bp_diastolic                    INTEGER,
  shock_index                     REAL,
  
  action_taken                    TEXT,                     -- e.g. "TXA 1g IV administered; Bimanual compression continued"
  logged_by                       INTEGER NOT NULL REFERENCES users(id),
  created_at                      TEXT NOT NULL
);

CREATE INDEX idx_pph_timeline_assessment ON pph_qbl_timeline_entries(pph_assessment_id, logged_at ASC);
