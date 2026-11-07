-- Migration 039: Statutory PC-PNDT Act Form 'F' Registry & Monthly Return
-- Proviso to Section 4(3), Rule 9(5) and Rule 10(1A) of the PC-PNDT Act, 1994

CREATE TABLE IF NOT EXISTS pndt_form_f_records (
  id                              INTEGER PRIMARY KEY AUTOINCREMENT,
  form_f_number                   TEXT NOT NULL UNIQUE,
  patient_id                      INTEGER NOT NULL REFERENCES patients(id),
  ultrasound_report_id            INTEGER REFERENCES patient_ultrasound_reports(id) ON DELETE SET NULL,
  visit_id                        INTEGER REFERENCES visits(id) ON DELETE SET NULL,
  scan_date                       TEXT NOT NULL, -- YYYY-MM-DD
  scan_time                       TEXT,          -- HH:MM
  clinic_pndt_reg_no              TEXT NOT NULL,
  doctor_id                       INTEGER REFERENCES users(id),
  doctor_name                     TEXT NOT NULL,
  doctor_reg_no                   TEXT NOT NULL,
  machine_model_serial            TEXT NOT NULL,

  -- Section A: Patient particulars & Living Children
  patient_name                    TEXT NOT NULL,
  patient_age                     INTEGER NOT NULL,
  husband_or_father_name          TEXT NOT NULL,
  full_address                    TEXT NOT NULL,
  contact_phone                   TEXT,
  num_living_male_children        INTEGER NOT NULL DEFAULT 0,
  male_children_ages              TEXT,          -- e.g. "4, 7"
  num_living_female_children      INTEGER NOT NULL DEFAULT 0,
  female_children_ages            TEXT,          -- e.g. "2, 5"
  total_living_children           INTEGER NOT NULL DEFAULT 0,
  lmp                             TEXT,          -- YYYY-MM-DD
  gestational_age_weeks           INTEGER NOT NULL,
  gestational_age_days            INTEGER NOT NULL DEFAULT 0,

  -- Section B: Referral Particulars
  referral_type                   TEXT NOT NULL CHECK (referral_type IN ('self_referred', 'doctor_referred')),
  referring_doctor_name           TEXT,
  referring_doctor_reg_no         TEXT,
  referring_clinic_address        TEXT,
  referral_slip_date              TEXT,          -- YYYY-MM-DD
  self_referral_reason            TEXT,

  -- Section C: Statutory Indications (PC-PNDT Rule 9(5))
  indication_codes                TEXT NOT NULL, -- JSON array of string codes e.g. ["GA_ESTIMATION", "ANOMALY_DETECTION"]
  other_indication_detail         TEXT,
  invasive_procedure_done         INTEGER NOT NULL DEFAULT 0 CHECK (invasive_procedure_done IN (0, 1)),
  invasive_procedure_details      TEXT,

  -- Section D & E: Mandatory Declarations
  pregnant_woman_declaration_signed INTEGER NOT NULL DEFAULT 1 CHECK (pregnant_woman_declaration_signed IN (0, 1)),
  pregnant_woman_declaration_time   TEXT NOT NULL,
  pregnant_woman_signature_name     TEXT NOT NULL,
  doctor_declaration_signed         INTEGER NOT NULL DEFAULT 1 CHECK (doctor_declaration_signed IN (0, 1)),
  doctor_declaration_time           TEXT NOT NULL,
  doctor_declaration_name           TEXT NOT NULL,

  -- Clinical Diagnostic Findings
  fetal_number                    TEXT DEFAULT 'single' CHECK (fetal_number IN ('single', 'twins', 'triplets', 'multiple')),
  cardiac_activity                TEXT DEFAULT 'present' CHECK (cardiac_activity IN ('present', 'absent', 'not_applicable')),
  congenital_anomaly_detected     INTEGER NOT NULL DEFAULT 0 CHECK (congenital_anomaly_detected IN (0, 1)),
  congenital_anomaly_details      TEXT,
  scan_result_summary             TEXT,

  -- Audit & Metadata
  created_by                      INTEGER NOT NULL REFERENCES users(id),
  updated_by                      INTEGER NOT NULL REFERENCES users(id),
  created_at                      TEXT NOT NULL,
  updated_at                      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pndt_patient ON pndt_form_f_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_pndt_scan_date ON pndt_form_f_records(scan_date);
CREATE INDEX IF NOT EXISTS idx_pndt_form_f_number ON pndt_form_f_records(form_f_number);
CREATE INDEX IF NOT EXISTS idx_pndt_usg_report ON pndt_form_f_records(ultrasound_report_id);

INSERT OR IGNORE INTO counters(name, value) VALUES ('pndt_form_f', 0);
