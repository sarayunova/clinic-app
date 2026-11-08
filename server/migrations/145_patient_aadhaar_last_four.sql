-- Adds last 4 digits of Aadhaar to patients for fast, regulatory-compliant patient lookups.
ALTER TABLE patients ADD COLUMN aadhaar_last_four TEXT;
CREATE INDEX IF NOT EXISTS idx_patients_aadhaar_last_four ON patients(aadhaar_last_four);
