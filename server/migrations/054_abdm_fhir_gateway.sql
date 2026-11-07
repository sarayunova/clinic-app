-- Migration 054: ABDM (Ayushman Bharat Digital Mission) Health ID & FHIR R4 Health Information Bridge
-- Supports Ayushman Bharat Health Account (ABHA) linking, patient identity verification,
-- consent artifact tracking, and standardized FHIR R4 clinical summary bundles (OP Consultation,
-- Discharge Summary, Antenatal Record, and Immunization Record).

CREATE TABLE IF NOT EXISTS abdm_patient_profiles (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  abha_number                         TEXT NOT NULL, -- 14 digits, formatted as '12-3456-7890-1234'
  abha_address                        TEXT NOT NULL, -- e.g. 'anita.patel@abdm'
  status                              TEXT NOT NULL DEFAULT 'VERIFIED' CHECK (status IN ('VERIFIED', 'PENDING_OTP', 'UNLINKED')),
  auth_method                         TEXT NOT NULL DEFAULT 'AADHAAR_OTP' CHECK (auth_method IN ('AADHAAR_OTP', 'MOBILE_OTP', 'DEMOGRAPHIC')),
  kyc_full_name                       TEXT,
  kyc_gender                          TEXT,
  kyc_dob                             TEXT,
  kyc_mobile                          TEXT,
  kyc_address                         TEXT,
  linked_at                           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_abdm_patient ON abdm_patient_profiles(patient_id);
CREATE INDEX IF NOT EXISTS idx_abdm_abha_number ON abdm_patient_profiles(abha_number);
CREATE INDEX IF NOT EXISTS idx_abdm_abha_address ON abdm_patient_profiles(abha_address);

CREATE TABLE IF NOT EXISTS abdm_consent_artifacts (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  consent_id                          TEXT NOT NULL UNIQUE,
  purpose_code                        TEXT NOT NULL DEFAULT 'CARETREE', -- CARETREE, PATRQT, PUBHLTH
  status                              TEXT NOT NULL DEFAULT 'GRANTED' CHECK (status IN ('REQUESTED', 'GRANTED', 'DENIED', 'REVOKED', 'EXPIRED')),
  hi_types                            TEXT NOT NULL DEFAULT 'OPConsultation,DischargeSummary,ImmunizationRecord',
  requester_name                      TEXT NOT NULL,
  requester_hip_id                    TEXT NOT NULL,
  date_range_from                     TEXT NOT NULL,
  date_range_to                       TEXT NOT NULL,
  expiry_at                           TEXT NOT NULL,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_abdm_consent_patient ON abdm_consent_artifacts(patient_id);
CREATE INDEX IF NOT EXISTS idx_abdm_consent_id ON abdm_consent_artifacts(consent_id);

CREATE TABLE IF NOT EXISTS abdm_fhir_bundles (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  bundle_id                           TEXT NOT NULL UNIQUE,
  bundle_type                         TEXT NOT NULL CHECK (bundle_type IN ('OPConsultation', 'DischargeSummary', 'ImmunizationRecord', 'AntenatalRecord')),
  fhir_json                           TEXT NOT NULL,
  bundle_hash                         TEXT NOT NULL, -- SHA-256 integrity hash
  exported_by_user_id                 INTEGER REFERENCES users(id),
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_abdm_fhir_patient ON abdm_fhir_bundles(patient_id);
CREATE INDEX IF NOT EXISTS idx_abdm_fhir_bundle_id ON abdm_fhir_bundles(bundle_id);
