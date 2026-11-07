-- Migration 042: Pre-eclampsia First-Trimester Screening (FMF Triad) & Aspirin Prophylaxis Calculator
-- Combined first-trimester screening at 11-13+6 weeks using Maternal Risk Factors, Mean Arterial Pressure (MAP),
-- Mean Uterine Artery Pulsatility Index (UtA PI), and Serum Biomarkers (PlGF, PAPP-A) per FMF / FIGO 2019 / ASPRE trial.

CREATE TABLE IF NOT EXISTS preeclampsia_screenings (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  visit_id                            INTEGER REFERENCES visits(id) ON DELETE SET NULL,
  ultrasound_report_id                INTEGER REFERENCES patient_ultrasound_reports(id) ON DELETE SET NULL,
  assessment_date                     TEXT NOT NULL, -- YYYY-MM-DD
  assessment_time                     TEXT, -- HH:MM
  gestational_age_weeks               INTEGER NOT NULL, -- 11 to 14
  gestational_age_days                INTEGER NOT NULL DEFAULT 0,
  crl_mm                              REAL, -- 45 - 84 mm

  -- Maternal Characteristics & Medical History
  maternal_age                        INTEGER NOT NULL,
  maternal_weight_kg                  REAL,
  maternal_height_cm                  REAL,
  bmi                                 REAL,
  ethnicity                           TEXT NOT NULL DEFAULT 'south_asian' CHECK (ethnicity IN ('south_asian', 'caucasian', 'afro_caribbean', 'east_asian', 'other')),
  parity                              TEXT NOT NULL DEFAULT 'nulliparous' CHECK (parity IN ('nulliparous', 'multiparous_no_pe', 'multiparous_prior_pe')),
  prior_pe_onset_gestation            TEXT CHECK (prior_pe_onset_gestation IS NULL OR prior_pe_onset_gestation IN ('early_lt_34', 'preterm_34_37', 'term_gt_37')),
  conception_method                   TEXT NOT NULL DEFAULT 'spontaneous' CHECK (conception_method IN ('spontaneous', 'ivf_art', 'ovulation_induction')),
  smoking_status                      TEXT NOT NULL DEFAULT 'non_smoker' CHECK (smoking_status IN ('non_smoker', 'smoker', 'cessation_early_pregnancy')),
  family_history_pe                   INTEGER NOT NULL DEFAULT 0 CHECK (family_history_pe IN (0, 1)),
  chronic_hypertension                INTEGER NOT NULL DEFAULT 0 CHECK (chronic_hypertension IN (0, 1)),
  pregestational_diabetes             INTEGER NOT NULL DEFAULT 0 CHECK (pregestational_diabetes IN (0, 1)),
  systemic_lupus_or_aps               INTEGER NOT NULL DEFAULT 0 CHECK (systemic_lupus_or_aps IN (0, 1)),
  chronic_kidney_disease              INTEGER NOT NULL DEFAULT 0 CHECK (chronic_kidney_disease IN (0, 1)),
  interpregnancy_interval_years       REAL,

  -- Biophysical: Mean Arterial Pressure (MAP)
  sbp_right                           REAL,
  dbp_right                           REAL,
  sbp_left                            REAL,
  dbp_left                            REAL,
  mean_arterial_pressure              REAL NOT NULL, -- in mmHg
  map_mom                             REAL NOT NULL,

  -- Biophysical: Uterine Artery Doppler (UtA PI)
  uta_pi_left                         REAL,
  uta_pi_right                        REAL,
  uta_pi_mean                         REAL NOT NULL,
  uta_pi_mom                          REAL NOT NULL,
  uta_bilateral_notching              INTEGER NOT NULL DEFAULT 0 CHECK (uta_bilateral_notching IN (0, 1)),

  -- Biochemical Markers (Optional / when available)
  serum_plgf_pg_ml                    REAL,
  plgf_mom                            REAL,
  serum_pappa_iu_l                    REAL,
  pappa_mom                           REAL,

  -- Risk Outputs & Stratification
  background_risk_ratio               TEXT NOT NULL, -- e.g. "1:350"
  background_risk_numeric             REAL NOT NULL,
  fmf_risk_ratio                      TEXT NOT NULL, -- e.g. "1:65"
  fmf_risk_numeric                    REAL NOT NULL, -- e.g. 0.01538
  fmf_risk_category                   TEXT NOT NULL CHECK (fmf_risk_category IN ('high_risk', 'low_risk')),
  clinical_risk_category              TEXT NOT NULL CHECK (clinical_risk_category IN ('high_risk', 'moderate_risk', 'low_risk')),
  overall_risk_tier                   TEXT NOT NULL CHECK (overall_risk_tier IN ('high_risk', 'low_risk')),

  -- Aspirin Prophylaxis & Management Plan
  aspirin_indicated                   INTEGER NOT NULL CHECK (aspirin_indicated IN (0, 1)),
  aspirin_dose_mg                     INTEGER NOT NULL DEFAULT 150,
  aspirin_timing_rationale            TEXT,
  calcium_indicated                   INTEGER NOT NULL DEFAULT 1 CHECK (calcium_indicated IN (0, 1)),
  calcium_dose_mg                     INTEGER NOT NULL DEFAULT 1500,
  surveillance_interval               TEXT NOT NULL,
  repeat_scan_weeks                   TEXT,

  clinical_notes                      TEXT,
  performed_by                        TEXT,
  reviewed_by                         INTEGER NOT NULL REFERENCES users(id),
  created_by                          INTEGER NOT NULL REFERENCES users(id),
  updated_by                          INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL,
  updated_at                          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pe_screen_patient ON preeclampsia_screenings(patient_id);
CREATE INDEX IF NOT EXISTS idx_pe_screen_date ON preeclampsia_screenings(assessment_date);
CREATE INDEX IF NOT EXISTS idx_pe_screen_tier ON preeclampsia_screenings(overall_risk_tier);
