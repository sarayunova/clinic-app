-- Migration 053: Teleconsultation & Video Follow-up Gateway with Digitally Signed E-Prescription
-- Compliant with National Medical Commission (NMC) Telemedicine Practice Guidelines.
-- Supports scheduled remote video follow-ups, automated WhatsApp invite deep links, WebRTC/Jitsi room links,
-- telemedicine informed consent, and cryptographic SHA-256 digital signature stamps on e-prescriptions.

CREATE TABLE IF NOT EXISTS teleconsultations (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id                           INTEGER NOT NULL REFERENCES users(id),
  scheduled_at                        TEXT NOT NULL, -- YYYY-MM-DDTHH:MM:SS
  status                              TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN (
                                        'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'
                                      )),
  consult_type                        TEXT NOT NULL DEFAULT 'FOLLOW_UP' CHECK (consult_type IN (
                                        'FIRST_CONSULT', 'FOLLOW_UP', 'REPORT_REVIEW', 'POST_OP_CHECK', 'EMERGENCY_TRIAGE'
                                      )),
  video_platform                      TEXT NOT NULL DEFAULT 'WHATSAPP_VIDEO' CHECK (video_platform IN (
                                        'WHATSAPP_VIDEO', 'JITSI', 'PHONE_CALL', 'OTHER'
                                      )),
  meeting_link                        TEXT,
  meeting_room_id                     TEXT,
  chief_complaint                     TEXT NOT NULL,
  clinical_notes                      TEXT,
  provisional_diagnosis               TEXT,
  advice_instructions                 TEXT,
  prescription_medicines              TEXT, -- JSON string array of medicines
  investigations_advised              TEXT, -- Text or JSON array
  telemedicine_consent_obtained       INTEGER NOT NULL DEFAULT 1 CHECK (telemedicine_consent_obtained IN (0, 1)),
  emergency_disclaimer_acknowledged   INTEGER NOT NULL DEFAULT 1 CHECK (emergency_disclaimer_acknowledged IN (0, 1)),
  
  -- Cryptographic Digital Signature & Verification Block
  digital_signature_hash              TEXT,
  signed_by_doctor_name               TEXT,
  doctor_reg_number                   TEXT,
  doctor_qualifications               TEXT,
  signed_at                           TEXT,
  
  whatsapp_invite_sent_at             TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_teleconsultations_patient ON teleconsultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_teleconsultations_doctor ON teleconsultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_teleconsultations_scheduled ON teleconsultations(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_teleconsultations_status ON teleconsultations(status);
