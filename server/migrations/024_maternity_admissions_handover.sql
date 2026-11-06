-- Maternity Admission Card & Delivery Ward Handover Board
-- Tracks labor admission, Bishop score, membrane rupture (PROM), SBAR shift handovers, oxytocin titration, and emergency LSCS prep checklist.

CREATE TABLE maternity_admissions (
  id                              INTEGER PRIMARY KEY,
  patient_id                      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  admission_id                    INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  admission_date                  TEXT NOT NULL,            -- YYYY-MM-DD
  
  -- Presentation & Labor Onset
  labor_stage                     TEXT NOT NULL DEFAULT 'latent_phase' CHECK (labor_stage IN ('not_in_labor', 'latent_phase', 'active_phase', 'second_stage', 'third_stage', 'immediate_postpartum')),
  admission_indication            TEXT NOT NULL DEFAULT 'in_labor' CHECK (admission_indication IN ('in_labor', 'prom', 'postdated', 'induction_of_labor', 'pre_eclampsia', 'gdm_monitoring', 'fetal_growth_restriction', 'reduced_fetal_movements', 'antepartum_hemorrhage', 'elective_lscs_planned', 'other')),
  indication_details              TEXT,
  contraction_onset_at            TEXT,                     -- ISO or YYYY-MM-DD HH:MM
  gestational_age_weeks           INTEGER,
  gestational_age_days            INTEGER,
  gravida                         INTEGER,
  para                            INTEGER,
  blood_group                     TEXT,
  allergies_summary               TEXT,
  high_risk_alerts                TEXT,                     -- Comma-separated or short description e.g. "Previous 1 LSCS, GDM on Metformin"

  -- Bishop Score Assessment at Admission
  bishop_dilation                 INTEGER NOT NULL DEFAULT 0 CHECK (bishop_dilation BETWEEN 0 AND 3),     -- 0: closed, 1: 1-2cm, 2: 3-4cm, 3: >=5cm
  bishop_effacement               INTEGER NOT NULL DEFAULT 0 CHECK (bishop_effacement BETWEEN 0 AND 3),   -- 0: 0-30%, 1: 40-50%, 2: 60-70%, 3: >=80%
  bishop_station                  INTEGER NOT NULL DEFAULT 0 CHECK (bishop_station BETWEEN 0 AND 3),      -- 0: -3, 1: -2, 2: -1/0, 3: +1/+2
  bishop_consistency              INTEGER NOT NULL DEFAULT 0 CHECK (bishop_consistency BETWEEN 0 AND 2),  -- 0: firm, 1: medium, 2: soft
  bishop_position                 INTEGER NOT NULL DEFAULT 0 CHECK (bishop_position BETWEEN 0 AND 2),     -- 0: posterior, 1: mid-position, 2: anterior
  bishop_total_score              INTEGER NOT NULL DEFAULT 0 CHECK (bishop_total_score BETWEEN 0 AND 13),
  bishop_interpretation           TEXT NOT NULL DEFAULT 'unfavorable' CHECK (bishop_interpretation IN ('unfavorable', 'intermediate', 'favorable')),

  -- Membrane Status & Rupture Tracker (PROM)
  membrane_status                 TEXT NOT NULL DEFAULT 'intact' CHECK (membrane_status IN ('intact', 'ruptured_clear', 'ruptured_meconium_thin', 'ruptured_meconium_thick', 'ruptured_blood_stained')),
  membrane_ruptured_at            TEXT,                     -- ISO or YYYY-MM-DD HH:MM
  membrane_rupture_hours          REAL,                     -- Duration of rupture in hours at assessment
  prom_antibiotics_given          INTEGER NOT NULL DEFAULT 0, -- 1 if antibiotic prophylaxis administered
  liquor_notes                    TEXT,

  -- Fetal Assessment at Admission
  fetal_heart_rate                INTEGER,                  -- bpm baseline
  fetal_presentation              TEXT NOT NULL DEFAULT 'cephalic_vertex' CHECK (fetal_presentation IN ('cephalic_vertex', 'breech_frank', 'breech_complete', 'transverse_lie', 'compound', 'other')),
  fetal_lie                       TEXT NOT NULL DEFAULT 'longitudinal' CHECK (fetal_lie IN ('longitudinal', 'transverse', 'oblique')),
  fetal_engagement                TEXT NOT NULL DEFAULT 'engaged' CHECK (fetal_engagement IN ('engaged', 'not_engaged', 'deeply_engaged')),
  ctg_category                    TEXT NOT NULL DEFAULT 'category_1' CHECK (ctg_category IN ('category_1', 'category_2', 'category_3', 'not_performed')),

  -- Baseline Maternal Vitals
  bp_systolic                     INTEGER,
  bp_diastolic                    INTEGER,
  pulse                           INTEGER,
  temperature_f                   REAL,
  spo2                            INTEGER,
  urine_protein                   TEXT DEFAULT 'nil' CHECK (urine_protein IN ('nil', 'trace', '1+', '2+', '3+', '4+')),

  -- Current Delivery Ward Location & Active Progress
  current_location                TEXT NOT NULL DEFAULT 'labor_room' CHECK (current_location IN ('triage', 'antenatal_ward', 'labor_room', 'delivery_suite', 'operating_theatre', 'recovery_postnatal')),
  attending_midwife_nurse         TEXT,
  primary_obstetrician            TEXT,
  active_oxytocin_rate            TEXT,                     -- e.g. "4 mU/min (12 drops/min)"
  latest_cervical_dilation_cm     REAL,                     -- e.g. 5.0
  latest_fetal_station            TEXT,                     -- e.g. "-1", "0", "+1"
  status                          TEXT NOT NULL DEFAULT 'in_labor' CHECK (status IN ('in_labor', 'induction', 'transferred_to_ot', 'delivered', 'discharged', 'cancelled')),

  created_by                      INTEGER NOT NULL REFERENCES users(id),
  updated_by                      INTEGER NOT NULL REFERENCES users(id),
  created_at                      TEXT NOT NULL,
  updated_at                      TEXT NOT NULL
);

CREATE INDEX idx_maternity_admissions_patient ON maternity_admissions(patient_id, admission_date DESC);
CREATE INDEX idx_maternity_admissions_status ON maternity_admissions(status);

-- SBAR Shift Handover Entries
CREATE TABLE maternity_handover_entries (
  id                              INTEGER PRIMARY KEY,
  maternity_admission_id          INTEGER NOT NULL REFERENCES maternity_admissions(id) ON DELETE CASCADE,
  shift_name                      TEXT NOT NULL CHECK (shift_name IN ('morning', 'evening', 'night')),
  handover_at                     TEXT NOT NULL,            -- ISO timestamp
  outgoing_staff                  TEXT NOT NULL,
  incoming_staff                  TEXT NOT NULL,

  -- SBAR Components
  situation                       TEXT NOT NULL,            -- Location, active problem, hours in labor
  background                      TEXT NOT NULL,            -- Parity, GA, high risk flags, allergies
  assessment                      TEXT NOT NULL,            -- Cervical dilation, contractions, FHR, liquor, vitals
  recommendation                  TEXT NOT NULL,            -- Next VE time, oxytocin plan, CTG review, labs pending
  urgency_level                   TEXT NOT NULL DEFAULT 'routine' CHECK (urgency_level IN ('routine', 'watch_closely', 'immediate_attention')),

  created_by                      INTEGER NOT NULL REFERENCES users(id),
  created_at                      TEXT NOT NULL
);

CREATE INDEX idx_maternity_handover_admission ON maternity_handover_entries(maternity_admission_id, handover_at DESC);

-- Oxytocin Infusion Titration Log
CREATE TABLE oxytocin_titration_logs (
  id                              INTEGER PRIMARY KEY,
  maternity_admission_id          INTEGER NOT NULL REFERENCES maternity_admissions(id) ON DELETE CASCADE,
  logged_at                       TEXT NOT NULL,            -- ISO timestamp
  infusion_rate_mU_min            REAL NOT NULL,            -- mU/min
  drops_per_min                   INTEGER,
  contractions_per_10min          INTEGER NOT NULL,
  contraction_duration_sec        INTEGER NOT NULL,
  contraction_intensity           TEXT NOT NULL DEFAULT 'moderate' CHECK (contraction_intensity IN ('mild', 'moderate', 'strong')),
  fetal_heart_rate                INTEGER NOT NULL,
  maternal_pulse                  INTEGER,
  maternal_bp_systolic            INTEGER,
  maternal_bp_diastolic           INTEGER,
  hyperstimulation_noted          INTEGER NOT NULL DEFAULT 0, -- 1 if tachysystole (>5 in 10 min or >90s)
  action_taken                    TEXT,                     -- e.g. "Rate stepped up", "Infusion paused"
  logged_by                       INTEGER NOT NULL REFERENCES users(id),
  logged_by_name                  TEXT,
  created_at                      TEXT NOT NULL
);

CREATE INDEX idx_oxytocin_logs_admission ON oxytocin_titration_logs(maternity_admission_id, logged_at DESC);

-- Emergency LSCS Preparation Checklist
CREATE TABLE emergency_lscs_checklists (
  id                              INTEGER PRIMARY KEY,
  maternity_admission_id          INTEGER NOT NULL UNIQUE REFERENCES maternity_admissions(id) ON DELETE CASCADE,
  decision_at                     TEXT NOT NULL,            -- ISO timestamp
  decision_to_delivery_target_mins INTEGER NOT NULL DEFAULT 30, -- 30 mins (Cat 1) or 75 mins (Cat 2)
  lscs_category                   TEXT NOT NULL DEFAULT 'category_1_immediate_threat' CHECK (lscs_category IN ('category_1_immediate_threat', 'category_2_maternal_fetal_compromise', 'category_3_early_delivery', 'category_4_elective')),
  surgical_indication             TEXT NOT NULL,
  operating_surgeon               TEXT,
  anesthetist_notified            INTEGER NOT NULL DEFAULT 0,
  anesthetist_name                TEXT,
  pediatrician_notified           INTEGER NOT NULL DEFAULT 0,
  pediatrician_name               TEXT,
  consent_signed                  INTEGER NOT NULL DEFAULT 0,
  consent_type                    TEXT,                     -- e.g. "Obstetric high-risk + Anesthesia"
  npo_solid_hours                 INTEGER,
  npo_clear_fluids_hours          INTEGER,
  wide_bore_iv_access             INTEGER NOT NULL DEFAULT 0, -- 16G or 18G
  blood_arranged                  INTEGER NOT NULL DEFAULT 0,
  blood_units_arranged            INTEGER DEFAULT 0,
  preop_antacid_given             INTEGER NOT NULL DEFAULT 0, -- Ranitidine/Pantoprazole + Metoclopramide
  antibiotic_prophylaxis_given    INTEGER NOT NULL DEFAULT 0, -- Cefazolin 2g IV
  antibiotic_name_time            TEXT,
  foley_catheter_inserted         INTEGER NOT NULL DEFAULT 0,
  abdominal_prep_done             INTEGER NOT NULL DEFAULT 0,
  ot_ready                        INTEGER NOT NULL DEFAULT 0,
  shifted_to_ot_at                TEXT,
  notes                           TEXT,
  updated_by                      INTEGER NOT NULL REFERENCES users(id),
  updated_at                      TEXT NOT NULL
);
