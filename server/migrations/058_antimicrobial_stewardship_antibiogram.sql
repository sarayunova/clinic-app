-- Migration 058: Pediatric & Neonatal Antimicrobial Stewardship (AMS), Antibiogram & Timeout Engine
-- Reference: WHO AWaRe Classification (Access, Watch, Reserve), CDC 48-72h Antibiotic Timeout,
-- and CLSI M39 Cumulative Antibiogram reporting guidelines.

CREATE TABLE IF NOT EXISTS ams_prescriptions (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  admission_id                        INTEGER REFERENCES admissions(id) ON DELETE SET NULL,
  prescribed_by_id                    INTEGER NOT NULL REFERENCES users(id),
  prescribed_datetime                 TEXT NOT NULL,
  drug_name                           TEXT NOT NULL,
  aware_tier                          TEXT NOT NULL CHECK (aware_tier IN ('access', 'watch', 'reserve')),
  route                               TEXT NOT NULL CHECK (route IN ('iv', 'oral', 'im', 'ip')),
  dosage                              TEXT NOT NULL,
  frequency                           TEXT NOT NULL,
  indication                          TEXT NOT NULL CHECK (indication IN (
                                        'empiric_early_onset_sepsis', 'empiric_late_onset_sepsis',
                                        'ventilator_associated_pneumonia', 'urinary_tract_infection',
                                        'surgical_prophylaxis', 'meningitis', 'necrotizing_enterocolitis',
                                        'culture_proven_pathogen', 'other'
                                      )),
  suspected_focus                     TEXT,
  baseline_wbc                        REAL,
  baseline_crp_mg_l                   REAL,
  baseline_procalcitonin_ng_ml        REAL,
  cultures_sent                       INTEGER NOT NULL DEFAULT 1, -- 0 or 1
  culture_specimen_types              TEXT, -- JSON array of specimens e.g. ["blood", "urine"]
  planned_duration_days               INTEGER NOT NULL DEFAULT 7,
  status                              TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
                                        'active', 'de_escalated', 'switched_oral', 'completed', 'discontinued'
                                      )),
  restricted_approval_by_id           INTEGER REFERENCES users(id),
  restricted_approval_notes           TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ams_presc_patient ON ams_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_ams_presc_status ON ams_prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_ams_presc_tier ON ams_prescriptions(aware_tier);

-- 48-72 Hour Antibiotic Timeout Reviews
CREATE TABLE IF NOT EXISTS ams_timeout_reviews (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  ams_prescription_id                 INTEGER NOT NULL REFERENCES ams_prescriptions(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  reviewed_by_id                      INTEGER NOT NULL REFERENCES users(id),
  review_datetime                     TEXT NOT NULL,
  hours_since_initiation              REAL NOT NULL,
  timeout_action                      TEXT NOT NULL CHECK (timeout_action IN (
                                        'de_escalate', 'targeted_switch', 'discontinue',
                                        'continue_unchanged', 'iv_to_oral_switch'
                                      )),
  culture_result_summary              TEXT NOT NULL CHECK (culture_result_summary IN (
                                        'pathogen_isolated_sensitivities_available',
                                        'no_growth_sterile', 'contaminant_suspected', 'culture_pending'
                                      )),
  clinical_response                   TEXT NOT NULL CHECK (clinical_response IN (
                                        'improving_afebrile', 'stable_persistent_markers', 'deteriorating_septic_shock'
                                      )),
  justification_notes                 TEXT NOT NULL,
  new_antimicrobial_regimen           TEXT,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ams_timeout_presc ON ams_timeout_reviews(ams_prescription_id);

-- Microbiology Isolates & Antibiogram Registry
CREATE TABLE IF NOT EXISTS ams_microbiology_isolates (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  ams_prescription_id                 INTEGER REFERENCES ams_prescriptions(id) ON DELETE SET NULL,
  collection_datetime                 TEXT NOT NULL,
  specimen_type                       TEXT NOT NULL CHECK (specimen_type IN (
                                        'blood', 'csf', 'urine', 'eta_respiratory',
                                        'peritoneal_fluid', 'wound_pus', 'other'
                                      )),
  pathogen_isolated                   TEXT NOT NULL,
  colony_count_cfu_ml                 TEXT,
  sensitivities_json                  TEXT NOT NULL, -- JSON map e.g. {"Amikacin": "S", "Meropenem": "R"}
  multidrug_resistant                 INTEGER NOT NULL DEFAULT 0, -- 1 if resistant to >=3 drug classes
  reported_at                         TEXT NOT NULL,
  created_at                          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ams_micro_pathogen ON ams_microbiology_isolates(pathogen_isolated);
CREATE INDEX IF NOT EXISTS idx_ams_micro_specimen ON ams_microbiology_isolates(specimen_type);
