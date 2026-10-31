-- Moving an admitted patient to another bed. The admission keeps pointing at the current bed; this table is the
-- permanent history of every move (append-only, like the care record).
CREATE TABLE bed_transfers (
  id             INTEGER PRIMARY KEY,
  admission_id   INTEGER NOT NULL REFERENCES admissions(id),
  from_bed_id    INTEGER NOT NULL REFERENCES beds(id),
  to_bed_id      INTEGER NOT NULL REFERENCES beds(id),
  transferred_at TEXT NOT NULL,                 -- when the patient was actually moved (UTC)
  reason         TEXT NOT NULL CHECK (length(trim(reason)) >= 2),
  transferred_by INTEGER NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL,                 -- when it was recorded
  CHECK (from_bed_id <> to_bed_id)
);
CREATE INDEX idx_transfers_admission ON bed_transfers(admission_id, transferred_at);
CREATE TRIGGER transfers_no_update BEFORE UPDATE ON bed_transfers
BEGIN SELECT RAISE(ABORT, 'bed transfers are append-only'); END;
CREATE TRIGGER transfers_no_delete BEFORE DELETE ON bed_transfers
BEGIN SELECT RAISE(ABORT, 'bed transfers are append-only'); END;
