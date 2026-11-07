-- Migration 052: Live Inpatient Ward Board, Critical Deterioration Alerts & Bedside SBAR Handover Console
-- Supports real-time bedside shift handover notes (SBAR: Situation, Background, Assessment, Recommendation)
-- and tracks critical maternal/neonatal deterioration alerts with nurse acknowledgement.

CREATE TABLE IF NOT EXISTS ward_handover_notes (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  admission_id                        INTEGER NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  shift_type                          TEXT NOT NULL CHECK (shift_type IN ('morning', 'evening', 'night')),
  shift_date                          TEXT NOT NULL, -- YYYY-MM-DD
  nurse_id                            INTEGER NOT NULL REFERENCES users(id),
  nurse_name                          TEXT NOT NULL,
  situation                           TEXT NOT NULL,
  background                          TEXT NOT NULL,
  assessment                          TEXT NOT NULL,
  recommendation                      TEXT NOT NULL,
  pending_tasks                       TEXT, -- JSON array of string tasks
  iv_fluids_status                    TEXT,
  dietary_order                       TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ward_handover_admission ON ward_handover_notes(admission_id);
CREATE INDEX IF NOT EXISTS idx_ward_handover_shift ON ward_handover_notes(shift_date, shift_type);

CREATE TABLE IF NOT EXISTS ward_critical_alerts (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  admission_id                        INTEGER NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  patient_id                          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  alert_type                          TEXT NOT NULL CHECK (alert_type IN (
                                        'MEOWS_CRITICAL', 'SEPSIS_RISK', 'SEVERE_HYPERTENSION',
                                        'NEONATAL_RESPIRATORY_DISTRESS', 'DESATURATION', 'FETAL_DISTRESS', 'OTHER'
                                      )),
  severity                            TEXT NOT NULL CHECK (severity IN ('RED', 'YELLOW')),
  trigger_reason                      TEXT NOT NULL,
  vital_values_json                   TEXT,
  status                              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')),
  acknowledged_by_user_id             INTEGER REFERENCES users(id),
  acknowledged_at                     TEXT,
  resolution_notes                    TEXT,
  created_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ward_critical_alerts_status ON ward_critical_alerts(status);
CREATE INDEX IF NOT EXISTS idx_ward_critical_alerts_admission ON ward_critical_alerts(admission_id);
