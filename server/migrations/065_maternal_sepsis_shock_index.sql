-- Migration 065: Maternal Critical Care Sepsis (SOS / qSOFA) & Obstetric Shock Index (SI)
-- Reference: Sepsis in Obstetrics Score (SOS), Surviving Sepsis Campaign / FIGO / ACOG Guidelines,
-- and Obstetric Shock Index Thresholds for Occult Hemorrhage.

CREATE TABLE IF NOT EXISTS maternal_sepsis_assessments (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  assessment_code                     TEXT NOT NULL UNIQUE,
  assessment_datetime                 TEXT NOT NULL,
  gestational_age_weeks               REAL,
  postpartum_days                     INTEGER,
  suspected_source                    TEXT NOT NULL CHECK (suspected_source IN (
                                        'chorioamnionitis_intrauterine',
                                        'postpartum_endometritis',
                                        'urinary_tract_pyelonephritis',
                                        'respiratory_pneumonia',
                                        'septic_pelvic_thrombophlebitis',
                                        'surgical_site_cesarean_wound',
                                        'mastitis_breast_abscess',
                                        'other_unknown_source'
                                      )),
  temperature_celsius                 REAL NOT NULL,
  systolic_bp_mmhg                    INTEGER NOT NULL,
  diastolic_bp_mmhg                   INTEGER NOT NULL,
  heart_rate_bpm                      INTEGER NOT NULL,
  respiratory_rate_bpm                INTEGER NOT NULL,
  spo2_percent                        REAL NOT NULL,
  wbc_count_per_ul                    REAL,
  immature_bands_percent              REAL,
  serum_lactate_mmol_l                REAL,
  sos_score                           INTEGER NOT NULL, -- Sepsis in Obstetrics Score (0 to 28)
  sos_risk_level                      TEXT NOT NULL CHECK (sos_risk_level IN ('low_risk', 'intermediate_risk', 'severe_septic_shock')),
  obstetric_shock_index               REAL NOT NULL, -- HR / SBP
  shock_index_tier                    TEXT NOT NULL CHECK (shock_index_tier IN ('normal_lt_0_9', 'elevated_warning_0_9_to_1_4', 'critical_shock_gte_1_4')),
  mean_arterial_pressure_mmhg         REAL NOT NULL,
  icu_transfer_recommended            INTEGER NOT NULL DEFAULT 0,
  assessed_by_id                      INTEGER NOT NULL REFERENCES users(id),
  clinical_impression                 TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sepsis_patient ON maternal_sepsis_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_sepsis_risk ON maternal_sepsis_assessments(sos_risk_level);
CREATE INDEX IF NOT EXISTS idx_shock_index ON maternal_sepsis_assessments(shock_index_tier);

CREATE TABLE IF NOT EXISTS maternal_sepsis_bundle_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  sepsis_assessment_id                INTEGER NOT NULL REFERENCES maternal_sepsis_assessments(id) ON DELETE CASCADE,
  log_datetime                        TEXT NOT NULL,
  blood_cultures_drawn                INTEGER NOT NULL DEFAULT 0,
  blood_cultures_drawn_time           TEXT,
  iv_antibiotics_given                INTEGER NOT NULL DEFAULT 0,
  antibiotic_name_regimen             TEXT,
  iv_antibiotics_time                 TEXT,
  antibiotic_within_60m               INTEGER NOT NULL DEFAULT 0,
  fluid_bolus_30ml_per_kg_given       INTEGER NOT NULL DEFAULT 0,
  fluid_bolus_volume_ml               REAL,
  norepinephrine_vasopressor_active   INTEGER NOT NULL DEFAULT 0,
  vasopressor_dose_mcg_min            REAL,
  repeat_lactate_mmol_l               REAL,
  target_map_achieved_gte_65          INTEGER NOT NULL DEFAULT 0,
  urine_output_ml_hr                  REAL,
  logged_by_id                        INTEGER NOT NULL REFERENCES users(id),
  interventions_summary               TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bundle_sepsis ON maternal_sepsis_bundle_logs(sepsis_assessment_id);
