-- Migration 045: Perinatal Loss & Stillbirth / Intrauterine Fetal Demise (IUFD) Workup Registry
-- Standardized investigation protocol compliant with RCOG Green-top 55 / ACOG PB 200,
-- ReCoDe / CODAC etiology classification, diagnostic laboratory checklist, and bereavement care.

CREATE TABLE IF NOT EXISTS perinatal_loss_episodes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  loss_type                           TEXT NOT NULL CHECK (loss_type IN ('early_miscarriage_lt_12w', 'late_miscarriage_12_20w', 'stillbirth_antepartum', 'stillbirth_intrapartum', 'neonatal_death_early', 'medical_termination_anomaly')),
  diagnosis_date                      TEXT NOT NULL, -- YYYY-MM-DD
  delivery_date                       TEXT, -- YYYY-MM-DD
  delivery_time                       TEXT,
  gestational_age_weeks               INTEGER NOT NULL,
  gestational_age_days                INTEGER NOT NULL DEFAULT 0,
  parity_prior                        TEXT,

  -- Delivery & Fetal Presentation
  mode_of_delivery                    TEXT NOT NULL CHECK (mode_of_delivery IN ('spontaneous_vaginal', 'induced_vaginal', 'emergency_cesarean', 'elective_cesarean', 'surgical_evacuation_d_and_e')),
  fetal_presentation                  TEXT CHECK (fetal_presentation IS NULL OR fetal_presentation IN ('cephalic', 'breech', 'transverse', 'other')),
  fetal_birth_weight_g                INTEGER,
  fetal_weight_centile                REAL,
  fetal_appearance                    TEXT NOT NULL DEFAULT 'fresh_stillbirth' CHECK (fetal_appearance IN ('fresh_stillbirth', 'macerated_slight_peeling', 'macerated_moderate', 'macerated_severe', 'gross_anomalies_present')),
  apparent_dysmorphic_features        TEXT,

  -- Etiology & Classification (ReCoDe & CODAC)
  primary_cause_category              TEXT NOT NULL CHECK (primary_cause_category IN ('fetal_anomaly_genetic', 'umbilical_cord_accident', 'placental_insufficiency_infarction', 'placental_abruption', 'chorioamnionitis_infection', 'maternal_medical_preeclampsia', 'maternal_medical_diabetes', 'maternal_cholestasis_icp', 'intrapartum_asphyxia', 'unexplained_idiopathic')),
  primary_cause_details               TEXT NOT NULL,
  contributing_factors                TEXT,

  -- Diagnostic Workup Checklist JSON
  diagnostic_workup_json              TEXT NOT NULL DEFAULT '{}',

  -- Bereavement & Post-Loss Care
  maternal_blood_group                TEXT,
  anti_d_administered                 INTEGER NOT NULL DEFAULT 0 CHECK (anti_d_administered IN (0, 1)),
  anti_d_dose_mcg                     INTEGER,
  lactation_suppression_given         INTEGER NOT NULL DEFAULT 1 CHECK (lactation_suppression_given IN (0, 1)),
  lactation_suppression_details       TEXT DEFAULT 'Cabergoline 1 mg PO single dose administered within 24 hours',
  memory_box_offered                  INTEGER NOT NULL DEFAULT 1 CHECK (memory_box_offered IN (0, 1)),
  memory_box_accepted                 INTEGER NOT NULL DEFAULT 1 CHECK (memory_box_accepted IN (0, 1)),
  bereavement_counselor_contacted     INTEGER NOT NULL DEFAULT 1 CHECK (bereavement_counselor_contacted IN (0, 1)),

  -- Future Pregnancy Recurrence & Plan
  recurrence_risk_category            TEXT NOT NULL CHECK (recurrence_risk_category IN ('low_less_than_1_pct', 'moderate_2_to_5_pct', 'high_gt_5_pct', 'dependent_on_genetics')),
  future_pregnancy_plan               TEXT NOT NULL,
  counseling_notes                    TEXT,

  consultant_name                     TEXT,
  reviewed_by                         INTEGER NOT NULL REFERENCES users(id),
  created_by                          INTEGER NOT NULL REFERENCES users(id),
  updated_by                          INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL,
  updated_at                          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_loss_patient ON perinatal_loss_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_loss_date ON perinatal_loss_episodes(diagnosis_date);
CREATE INDEX IF NOT EXISTS idx_loss_cause ON perinatal_loss_episodes(primary_cause_category);
