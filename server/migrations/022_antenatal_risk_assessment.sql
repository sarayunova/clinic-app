-- Antenatal High-Risk Assessment & Scoring Engine
-- Implements NICE/ACOG Pre-eclampsia, RCOG VTE Thromboprophylaxis, and DIPSI/FIGO GDM stratification.

CREATE TABLE antenatal_risk_assessments (
  id                          INTEGER PRIMARY KEY,
  patient_id                  INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  assessment_date             TEXT NOT NULL,            -- YYYY-MM-DD
  gestational_age_weeks       INTEGER,
  gestational_age_days        INTEGER,
  assessed_by                 INTEGER NOT NULL REFERENCES users(id),

  -- Pre-eclampsia (PE) Risk Stratification (NICE/ACOG)
  pe_factors_json             TEXT NOT NULL DEFAULT '[]', -- JSON array of selected factor keys
  pe_risk_level               TEXT NOT NULL DEFAULT 'low' CHECK (pe_risk_level IN ('low', 'moderate', 'high')),
  pe_aspirin_indicated        INTEGER NOT NULL DEFAULT 0,
  pe_aspirin_prescribed       INTEGER NOT NULL DEFAULT 0,
  pe_aspirin_dosage           TEXT,
  pe_calcium_indicated        INTEGER NOT NULL DEFAULT 0,
  pe_calcium_prescribed       INTEGER NOT NULL DEFAULT 0,

  -- VTE Thromboprophylaxis Risk (RCOG Green-top 37a)
  vte_factors_json            TEXT NOT NULL DEFAULT '[]', -- JSON array of selected factor keys
  vte_score                   INTEGER NOT NULL DEFAULT 0,
  vte_risk_level              TEXT NOT NULL DEFAULT 'low' CHECK (vte_risk_level IN ('low', 'low_moderate', 'intermediate', 'high')),
  vte_prophylaxis_recommended TEXT,
  vte_lmwh_prescribed         INTEGER NOT NULL DEFAULT 0,
  vte_lmwh_dosage             TEXT,

  -- Gestational Diabetes Mellitus (GDM) Stratification (DIPSI/FIGO)
  gdm_factors_json            TEXT NOT NULL DEFAULT '[]', -- JSON array of selected factor keys
  gdm_risk_level              TEXT NOT NULL DEFAULT 'standard' CHECK (gdm_risk_level IN ('standard', 'high')),
  gdm_screening_timing        TEXT,
  gdm_diagnosis_status        TEXT NOT NULL DEFAULT 'not_tested' CHECK (gdm_diagnosis_status IN ('not_tested', 'pending', 'normal', 'gdm_confirmed')),
  gdm_fasting_mgdl            REAL,
  gdm_1hr_mgdl                REAL,
  gdm_2hr_mgdl                REAL,
  gdm_management_plan         TEXT,

  -- Preterm Birth (PTB) & Cervical Insufficiency
  ptb_factors_json            TEXT NOT NULL DEFAULT '[]',
  ptb_risk_level              TEXT NOT NULL DEFAULT 'low' CHECK (ptb_risk_level IN ('low', 'high')),
  ptb_progesterone_indicated  INTEGER NOT NULL DEFAULT 0,
  ptb_progesterone_prescribed INTEGER NOT NULL DEFAULT 0,
  ptb_cerclage_advised        INTEGER NOT NULL DEFAULT 0,

  -- Overall Categorization & Plan
  overall_risk_level          TEXT NOT NULL DEFAULT 'low_risk' CHECK (overall_risk_level IN ('low_risk', 'moderate_risk', 'high_risk')),
  high_risk_reasons           TEXT,
  clinical_action_plan        TEXT,
  consultant_notes            TEXT,
  next_review_date            TEXT,

  created_at                  TEXT NOT NULL,
  updated_at                  TEXT NOT NULL
);

CREATE INDEX idx_risk_assessments_patient ON antenatal_risk_assessments(patient_id, assessment_date DESC);
