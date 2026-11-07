-- Migration 063: Pediatric Respiratory Severity (PRAM) & Anaphylaxis Emergency Action Plan
-- Reference: Pediatric Respiratory Assessment Measure (PRAM), GINA Acute Asthma Pathway,
-- and World Allergy Organization (WAO) Pediatric Anaphylaxis Protocols.

CREATE TABLE IF NOT EXISTS pediatric_pram_assessments (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  assessment_code                     TEXT NOT NULL UNIQUE,
  assessment_datetime                 TEXT NOT NULL,
  oxygen_saturation_pct               REAL NOT NULL,
  o2_score                            INTEGER NOT NULL CHECK (o2_score IN (0, 1, 2)),
  suprasternal_retractions_score      INTEGER NOT NULL CHECK (suprasternal_retractions_score IN (0, 2)),
  scalene_muscle_contraction_score    INTEGER NOT NULL CHECK (scalene_muscle_contraction_score IN (0, 2)),
  air_entry_score                     INTEGER NOT NULL CHECK (air_entry_score IN (0, 1, 2, 3)),
  wheezing_score                      INTEGER NOT NULL CHECK (wheezing_score IN (0, 1, 2, 3)),
  total_pram_score                    INTEGER NOT NULL, -- 0 to 12
  severity_tier                       TEXT NOT NULL CHECK (severity_tier IN (
                                        'mild_0_3', 'moderate_4_7', 'impending_respiratory_failure_8_12'
                                      )),
  response_to_burst_saba              TEXT NOT NULL DEFAULT 'good_response' CHECK (response_to_burst_saba IN (
                                        'good_response', 'partial_response', 'poor_deteriorating'
                                      )),
  systemic_steroid_given              INTEGER NOT NULL DEFAULT 0,
  iv_magnesium_given                  INTEGER NOT NULL DEFAULT 0,
  assessed_by_id                      INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pram_patient ON pediatric_pram_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_pram_severity ON pediatric_pram_assessments(severity_tier);

CREATE TABLE IF NOT EXISTS pediatric_anaphylaxis_action_plans (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  plan_code                           TEXT NOT NULL UNIQUE,
  diagnosis_date                      TEXT NOT NULL,
  known_allergens                     TEXT NOT NULL, -- JSON array of strings
  child_weight_kg                     REAL NOT NULL,
  epinephrine_im_dose_mg              REAL NOT NULL,
  epinephrine_im_volume_ml            REAL NOT NULL, -- 1:1,000 concentration (1 mg/mL)
  autoinjector_type                   TEXT NOT NULL CHECK (autoinjector_type IN (
                                        'epipen_jr_0_15mg', 'epipen_adult_0_30mg', 'ampoule_syringe_drawn'
                                      )),
  injection_site                      TEXT NOT NULL DEFAULT 'anterolateral_right_thigh',
  antihistamine_prescribed            TEXT,
  steroid_prescribed                  TEXT,
  school_health_action_plan_shared    INTEGER NOT NULL DEFAULT 1,
  emergency_contact_name              TEXT NOT NULL,
  emergency_contact_phone             TEXT NOT NULL,
  attending_physician_id              INTEGER NOT NULL REFERENCES users(id),
  clinical_instructions               TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_anaphylaxis_patient ON pediatric_anaphylaxis_action_plans(patient_id);
