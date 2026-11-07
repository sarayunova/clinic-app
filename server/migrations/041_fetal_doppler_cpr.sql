-- Migration 041: Fetal Doppler Assessment & Cerebroplacental Ratio (CPR) Nomogram
-- Longitudinal tracking of Umbilical Artery (UA), Middle Cerebral Artery (MCA), Cerebroplacental Ratio (CPR),
-- Uterine Artery (UtA), and Ductus Venosus (DV), with FIGO / ISUOG & Barcelona FGR Staging.

CREATE TABLE IF NOT EXISTS fetal_doppler_assessments (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  ultrasound_report_id                INTEGER REFERENCES patient_ultrasound_reports(id) ON DELETE SET NULL,
  assessment_date                     TEXT NOT NULL, -- YYYY-MM-DD
  assessment_time                     TEXT, -- HH:MM
  gestational_age_weeks               INTEGER NOT NULL,
  gestational_age_days                INTEGER NOT NULL DEFAULT 0,

  -- Biometry Context
  estimated_fetal_weight_g            INTEGER,
  efw_percentile                      REAL,
  abdominal_circumference_mm          REAL,
  ac_percentile                       REAL,

  -- Umbilical Artery (UA) Velocimetry
  ua_pi                               REAL NOT NULL,
  ua_ri                               REAL,
  ua_sd_ratio                         REAL,
  ua_end_diastolic_flow               TEXT NOT NULL DEFAULT 'normal_positive' CHECK (ua_end_diastolic_flow IN ('normal_positive', 'reduced', 'aedf_absent', 'redf_reversed')),
  ua_pi_centile                       REAL NOT NULL,
  ua_pi_status                        TEXT NOT NULL CHECK (ua_pi_status IN ('normal', 'elevated_above_95th')),

  -- Middle Cerebral Artery (MCA) Velocimetry
  mca_pi                              REAL NOT NULL,
  mca_ri                              REAL,
  mca_psv_cm_s                        REAL,
  mca_psv_mom                         REAL,
  mca_pi_centile                      REAL NOT NULL,
  mca_brain_sparing                   TEXT NOT NULL CHECK (mca_brain_sparing IN ('none', 'vasodilation_below_5th')),
  fetal_anemia_risk                   TEXT DEFAULT 'none' CHECK (fetal_anemia_risk IN ('none', 'mild', 'moderate_to_severe')),

  -- Cerebroplacental Ratio (CPR = MCA PI / UA PI)
  cpr_ratio                           REAL NOT NULL,
  cpr_centile                         REAL NOT NULL,
  cpr_status                          TEXT NOT NULL CHECK (cpr_status IN ('normal', 'brain_sparing_redistribution')),

  -- Uterine Artery (UtA) Velocimetry
  uta_left_pi                         REAL,
  uta_right_pi                        REAL,
  uta_mean_pi                         REAL,
  uta_mean_pi_centile                 REAL,
  uta_notching                        TEXT DEFAULT 'none' CHECK (uta_notching IN ('none', 'unilateral', 'bilateral')),

  -- Ductus Venosus (DV) Velocimetry
  dv_piv                              REAL,
  dv_piv_centile                      REAL,
  dv_a_wave                           TEXT DEFAULT 'positive' CHECK (dv_a_wave IN ('positive', 'absent', 'reversed', 'not_performed')),
  dv_status                           TEXT DEFAULT 'normal' CHECK (dv_status IN ('normal', 'elevated_above_95th', 'reversed_a_wave', 'not_performed')),

  -- Clinical Staging (ISUOG / FIGO 2020 & Barcelona Staging System)
  fgr_classification                  TEXT NOT NULL CHECK (fgr_classification IN ('aga', 'sga', 'early_fgr', 'late_fgr')),
  barcelona_stage                     TEXT NOT NULL CHECK (barcelona_stage IN ('stage_0', 'stage_1', 'stage_2', 'stage_3', 'stage_4')),
  monitoring_frequency_recommendation TEXT NOT NULL,
  delivery_timing_recommendation      TEXT NOT NULL,
  steroids_indicated                  INTEGER DEFAULT 0 CHECK (steroids_indicated IN (0, 1)),
  mgso4_neuroprotection_indicated     INTEGER DEFAULT 0 CHECK (mgso4_neuroprotection_indicated IN (0, 1)),

  clinical_notes                      TEXT,
  performed_by                        TEXT,
  reviewed_by                         INTEGER NOT NULL REFERENCES users(id),

  created_by                          INTEGER NOT NULL REFERENCES users(id),
  updated_by                          INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL,
  updated_at                          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_doppler_patient ON fetal_doppler_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_doppler_date ON fetal_doppler_assessments(assessment_date);
CREATE INDEX IF NOT EXISTS idx_doppler_stage ON fetal_doppler_assessments(barcelona_stage);
