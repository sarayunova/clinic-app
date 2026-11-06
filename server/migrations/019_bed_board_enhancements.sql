-- Inpatient Bed Board & Ward Occupancy Enhancements
-- Adds expected discharge date for clinical discharge planning

ALTER TABLE admissions ADD COLUMN expected_discharge_date TEXT;
CREATE INDEX IF NOT EXISTS idx_admissions_expected_discharge ON admissions(expected_discharge_date);
