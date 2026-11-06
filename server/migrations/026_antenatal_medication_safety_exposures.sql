-- Antenatal Medication Safety & Teratogenic Exposure Registry
-- Tracks maternal drug exposures, teratogenic risk assessment, FDA/TGA categories,
-- fetal counseling logs, targeted ultrasound recommendations, and clinical actions.

CREATE TABLE antenatal_medication_exposures (
  id                              INTEGER PRIMARY KEY,
  patient_id                      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  
  -- Medication Identification
  medicine_name                   TEXT NOT NULL,
  generic_name                    TEXT,
  fda_category                    TEXT NOT NULL CHECK (fda_category IN ('A', 'B', 'C', 'D', 'X', 'N/A')),
  risk_level                      TEXT NOT NULL CHECK (risk_level IN ('safe', 'caution', 'high_risk', 'contraindicated')),
  
  -- Gestational Timing & Dose
  trimester_exposure              TEXT NOT NULL CHECK (trimester_exposure IN ('preconception', 't1_organogenesis', 't2', 't3', 'multiple_unknown')),
  gestational_age_weeks           INTEGER,
  gestational_age_days            INTEGER,
  exposure_start_date             TEXT,            -- YYYY-MM-DD
  exposure_end_date               TEXT,            -- YYYY-MM-DD
  exposure_dose                   TEXT,            -- e.g. "40mg once daily for 10 days"
  
  -- Risk & Fetal Implications
  fetal_risk_summary              TEXT NOT NULL,   -- e.g. "Neural tube defects, cardiac clefts, renal dysgenesis"
  teratogenic_mechanism           TEXT,            -- e.g. "Folate antagonist, disruption of organogenesis"
  
  -- Obstetric Surveillance Plan
  anomaly_scan_indicated          INTEGER NOT NULL DEFAULT 0, -- 1 if Level II targeted anatomy scan required
  fetal_echo_indicated            INTEGER NOT NULL DEFAULT 0, -- 1 if targeted fetal echocardiography recommended
  counseling_notes                TEXT,            -- Documentation of parental risk counseling & informed consent
  action_plan                     TEXT,            -- e.g. "Immediate cessation; switched to Labetalol; Level II scan at 18w"
  
  -- Audit & Metadata
  counseled_by                    INTEGER NOT NULL REFERENCES users(id),
  created_at                      TEXT NOT NULL,
  updated_at                      TEXT NOT NULL
);

CREATE INDEX idx_med_exposures_patient ON antenatal_medication_exposures(patient_id, created_at DESC);
