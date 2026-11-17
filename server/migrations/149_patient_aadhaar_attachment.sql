-- Links an uploaded copy of Aadhaar card / ID proof to the patient record.
ALTER TABLE patients ADD COLUMN aadhaar_attachment_id INTEGER REFERENCES attachments(id);
CREATE INDEX IF NOT EXISTS idx_patients_aadhaar_attachment_id ON patients(aadhaar_attachment_id);
