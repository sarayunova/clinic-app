-- Laboratory Investigation Orders & Results Tracking
CREATE TABLE patient_lab_orders (
  id                    INTEGER PRIMARY KEY,
  patient_id            INTEGER NOT NULL REFERENCES patients(id),
  visit_id              INTEGER REFERENCES visits(id),
  order_number          TEXT NOT NULL UNIQUE,
  order_date            TEXT NOT NULL,
  priority              TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat')),
  status                TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'sample_collected', 'sent_to_lab', 'completed', 'cancelled')),
  clinical_notes        TEXT,
  panel_name            TEXT,
  ordered_by            INTEGER NOT NULL REFERENCES users(id),
  cancelled_by          INTEGER REFERENCES users(id),
  cancellation_reason   TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

CREATE TABLE patient_lab_results (
  id                    INTEGER PRIMARY KEY,
  order_id              INTEGER NOT NULL REFERENCES patient_lab_orders(id) ON DELETE CASCADE,
  patient_id            INTEGER NOT NULL REFERENCES patients(id),
  test_name             TEXT NOT NULL,
  category              TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('hematology', 'biochemistry', 'serology', 'urine', 'microbiology', 'hormones', 'general')),
  result_value          TEXT,
  numeric_value         REAL,
  unit                  TEXT,
  reference_range       TEXT,
  flag                  TEXT DEFAULT 'normal' CHECK (flag IN ('normal', 'low', 'high', 'critical', 'abnormal', 'pending')),
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes                 TEXT,
  reported_date         TEXT,
  attachment_id         INTEGER REFERENCES attachments(id),
  reviewed_by           INTEGER REFERENCES users(id),
  reviewed_at           TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

CREATE INDEX idx_lab_orders_patient ON patient_lab_orders(patient_id);
CREATE INDEX idx_lab_orders_status ON patient_lab_orders(status);
CREATE INDEX idx_lab_orders_date ON patient_lab_orders(order_date);
CREATE INDEX idx_lab_results_order ON patient_lab_results(order_id);
CREATE INDEX idx_lab_results_patient ON patient_lab_results(patient_id);
