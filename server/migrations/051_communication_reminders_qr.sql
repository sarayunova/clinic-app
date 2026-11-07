-- Migration 051: Immunization Recall, Smart Patient Reminders & Emergency QR Passport
-- Automated tracking of communication dispatches (WhatsApp click-to-chat, SMS),
-- vaccine reminders, appointment notices, and emergency medical passport logs.

CREATE TABLE IF NOT EXISTS communication_dispatch_logs (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id),
  communication_type                  TEXT NOT NULL CHECK (communication_type IN ('whatsapp_click_to_chat', 'sms_gateway_draft', 'emergency_qr_access')),
  trigger_event                       TEXT NOT NULL CHECK (trigger_event IN (
                                        'immunization_due', 'antenatal_appointment_reminder',
                                        'ultrasound_scheduled', 'abnormal_lab_recall',
                                        'discharge_instructions', 'general_followup'
                                      )),
  recipient_phone                     TEXT NOT NULL,
  language                            TEXT NOT NULL DEFAULT 'english' CHECK (language IN ('english', 'hindi')),
  message_body                        TEXT NOT NULL,
  deep_link_url                       TEXT,
  sent_by                             INTEGER NOT NULL REFERENCES users(id),
  created_at                          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comm_patient ON communication_dispatch_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_comm_trigger ON communication_dispatch_logs(trigger_event);
