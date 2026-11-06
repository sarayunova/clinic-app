-- Antenatal Routine Investigation & Screening Checklist Tracker
CREATE TABLE patient_antenatal_tests (
  id              INTEGER PRIMARY KEY,
  patient_id      INTEGER NOT NULL REFERENCES patients(id),
  test_key        TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('first_trimester', 'second_trimester', 'third_trimester')),
  test_name       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'completed', 'not_required')),
  result_value    TEXT,
  notes           TEXT,
  performed_date  TEXT,
  attachment_id   INTEGER REFERENCES attachments(id),
  updated_by      INTEGER NOT NULL REFERENCES users(id),
  updated_at      TEXT NOT NULL,
  UNIQUE(patient_id, test_key)
);

CREATE INDEX idx_antenatal_tests_patient ON patient_antenatal_tests(patient_id);
