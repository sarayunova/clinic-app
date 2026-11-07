-- Migration 068: Maternal Venous Thromboembolism (VTE) Risk Assessment & Thromboprophylaxis
-- Reference: RCOG Green-top Guideline No. 37a (Reducing the Risk of Venous Thromboembolism during Pregnancy and the Puerperium)
-- and ACOG Practice Bulletin No. 196 (Thromboembolism in Pregnancy).

CREATE TABLE IF NOT EXISTS maternal_vte_assessments (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  assessment_type                     TEXT NOT NULL CHECK (assessment_type IN ('antenatal_early', 'antenatal_intrapartum', 'postnatal')),
  assessment_datetime                 TEXT NOT NULL,
  gestational_age_weeks               REAL,
  current_weight_kg                   REAL NOT NULL,
  bmi                                 REAL NOT NULL,
  previous_vte_unprovoked_or_estrogen INTEGER NOT NULL DEFAULT 0,
  previous_vte_provoked               INTEGER NOT NULL DEFAULT 0,
  known_high_risk_thrombophilia       INTEGER NOT NULL DEFAULT 0,
  medical_comorbidities               INTEGER NOT NULL DEFAULT 0,
  surgical_procedure_in_pregnancy     INTEGER NOT NULL DEFAULT 0,
  gross_varicose_veins                INTEGER NOT NULL DEFAULT 0,
  age_over_35                         INTEGER NOT NULL DEFAULT 0,
  parity_geq_3                        INTEGER NOT NULL DEFAULT 0,
  smoker                              INTEGER NOT NULL DEFAULT 0,
  bmi_geq_30                          INTEGER NOT NULL DEFAULT 0,
  bmi_geq_40                          INTEGER NOT NULL DEFAULT 0,
  multiple_pregnancy                  INTEGER NOT NULL DEFAULT 0,
  assisted_reproductive_tech_ivf      INTEGER NOT NULL DEFAULT 0,
  pre_eclampsia                       INTEGER NOT NULL DEFAULT 0,
  cesarean_section_emergency          INTEGER NOT NULL DEFAULT 0,
  cesarean_section_elective           INTEGER NOT NULL DEFAULT 0,
  prolonged_labor_over_24h            INTEGER NOT NULL DEFAULT 0,
  postpartum_hemorrhage_over_1000ml   INTEGER NOT NULL DEFAULT 0,
  preterm_birth_under_37w             INTEGER NOT NULL DEFAULT 0,
  stillbirth_in_this_pregnancy        INTEGER NOT NULL DEFAULT 0,
  systemic_infection_current          INTEGER NOT NULL DEFAULT 0,
  immobility_bedrest_over_3d          INTEGER NOT NULL DEFAULT 0,
  hyperemesis_or_dehydration          INTEGER NOT NULL DEFAULT 0,
  low_risk_thrombophilia              INTEGER NOT NULL DEFAULT 0,
  family_history_vte_first_degree     INTEGER NOT NULL DEFAULT 0,
  total_vte_score                     INTEGER NOT NULL,
  risk_tier                           TEXT NOT NULL CHECK (risk_tier IN ('low_mobilization_hydration', 'intermediate_prophylaxis_indicated', 'high_immediate_prophylaxis_indicated')),
  lmwh_prescribed                     INTEGER NOT NULL DEFAULT 0,
  lmwh_agent                          TEXT CHECK (lmwh_agent IN ('enoxaparin', 'dalteparin', 'tinzaparin', 'unfractionated_heparin')),
  lmwh_daily_dose_mg_or_units         TEXT,
  weight_tier_bracket                 TEXT,
  anti_embolic_stockings_ordered      INTEGER NOT NULL DEFAULT 0,
  neuraxial_anesthesia_eligible       INTEGER NOT NULL DEFAULT 1,
  last_dose_datetime                  TEXT,
  next_safe_neuraxial_datetime        TEXT,
  assessed_by_id                      INTEGER NOT NULL REFERENCES users(id),
  clinical_notes                      TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vte_patient ON maternal_vte_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_vte_tier ON maternal_vte_assessments(risk_tier);

CREATE TABLE IF NOT EXISTS maternal_vte_dose_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id                       INTEGER NOT NULL REFERENCES maternal_vte_assessments(id) ON DELETE CASCADE,
  administered_at                     TEXT NOT NULL,
  agent                               TEXT NOT NULL,
  dose                                TEXT NOT NULL,
  route                               TEXT NOT NULL DEFAULT 'subcutaneous',
  site                                TEXT CHECK (site IN ('abdomen_left', 'abdomen_right', 'thigh_left', 'thigh_right', 'upper_arm')),
  administered_by_id                  INTEGER NOT NULL REFERENCES users(id),
  platelet_count                      REAL,
  anti_xa_level                       REAL,
  bleeding_signs_observed             INTEGER NOT NULL DEFAULT 0,
  notes                               TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vte_dose_assessment ON maternal_vte_dose_logs(assessment_id);
