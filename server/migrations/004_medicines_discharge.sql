-- Inpatient care, part 2: medicine orders, administration records, discharge summary.

-- An order is what the doctor prescribed. It never changes except to be stopped (once).
CREATE TABLE medicine_orders (
  id            INTEGER PRIMARY KEY,
  admission_id  INTEGER NOT NULL REFERENCES admissions(id),
  medicine      TEXT NOT NULL,
  strength      TEXT,
  dose          TEXT NOT NULL,
  route         TEXT,
  frequency     TEXT NOT NULL,
  instructions  TEXT,
  start_at      TEXT NOT NULL,
  ordered_by    INTEGER NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL,
  stopped_at    TEXT,
  stopped_by    INTEGER REFERENCES users(id),
  stop_reason   TEXT,
  CHECK ((stopped_at IS NULL) = (stopped_by IS NULL)),
  CHECK ((stopped_at IS NULL) = (stop_reason IS NULL)),
  CHECK (stopped_at IS NULL OR stopped_at >= start_at)
);
CREATE INDEX idx_orders_admission ON medicine_orders(admission_id, start_at);
CREATE TRIGGER orders_limited_update BEFORE UPDATE ON medicine_orders
WHEN OLD.stopped_at IS NOT NULL
  OR NEW.admission_id IS NOT OLD.admission_id OR NEW.medicine IS NOT OLD.medicine OR NEW.strength IS NOT OLD.strength
  OR NEW.dose IS NOT OLD.dose OR NEW.route IS NOT OLD.route OR NEW.frequency IS NOT OLD.frequency
  OR NEW.instructions IS NOT OLD.instructions OR NEW.start_at IS NOT OLD.start_at OR NEW.ordered_by IS NOT OLD.ordered_by
  OR NEW.created_at IS NOT OLD.created_at
BEGIN SELECT RAISE(ABORT, 'a medicine order can only be stopped, once'); END;
CREATE TRIGGER orders_no_delete BEFORE DELETE ON medicine_orders
BEGIN SELECT RAISE(ABORT, 'medicine orders cannot be deleted'); END;

-- An administration record is what the nurse actually did. Append-only; a correction points at the original.
CREATE TABLE medication_records (
  id            INTEGER PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES medicine_orders(id),
  outcome       TEXT NOT NULL CHECK (outcome IN ('given','withheld','refused')),
  scheduled_at  TEXT,                 -- when it was due (optional)
  given_at      TEXT NOT NULL,        -- when it was given / the decision was made
  dose_given    TEXT,
  reason        TEXT,                 -- required unless given
  recorded_by   INTEGER NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL,
  corrects_id       INTEGER REFERENCES medication_records(id),
  correction_reason TEXT,
  CHECK ((corrects_id IS NULL) = (correction_reason IS NULL)),
  CHECK (outcome <> 'given' OR dose_given IS NOT NULL),
  CHECK (outcome = 'given' OR (reason IS NOT NULL AND length(trim(reason)) >= 2))
);
CREATE INDEX idx_medrec_order ON medication_records(order_id, given_at);
CREATE TRIGGER medrec_no_update BEFORE UPDATE ON medication_records
BEGIN SELECT RAISE(ABORT, 'medication records are append-only'); END;
CREATE TRIGGER medrec_no_delete BEFORE DELETE ON medication_records
BEGIN SELECT RAISE(ABORT, 'medication records are append-only'); END;

-- One discharge summary per admission, written when the doctor discharges the patient. Immutable.
CREATE TABLE discharge_summaries (
  id                 INTEGER PRIMARY KEY,
  admission_id       INTEGER NOT NULL UNIQUE REFERENCES admissions(id),
  final_diagnosis    TEXT NOT NULL,
  findings           TEXT,
  course             TEXT,
  procedures         TEXT,
  condition_at_discharge TEXT NOT NULL,
  discharge_medicines TEXT,
  instructions       TEXT,
  warning_signs      TEXT,
  follow_up          TEXT,
  written_by         INTEGER NOT NULL REFERENCES users(id),
  finalised_at       TEXT NOT NULL
);
CREATE TRIGGER dsum_no_update BEFORE UPDATE ON discharge_summaries
BEGIN SELECT RAISE(ABORT, 'discharge summaries cannot be edited; add an addendum'); END;
CREATE TRIGGER dsum_no_delete BEFORE DELETE ON discharge_summaries
BEGIN SELECT RAISE(ABORT, 'discharge summaries cannot be deleted'); END;

-- Later additions to a finalised summary.
CREATE TABLE discharge_addenda (
  id           INTEGER PRIMARY KEY,
  admission_id INTEGER NOT NULL REFERENCES admissions(id),
  content      TEXT NOT NULL,
  reason       TEXT NOT NULL CHECK (length(trim(reason)) >= 5),
  author_id    INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL
);
CREATE TRIGGER addenda_no_update BEFORE UPDATE ON discharge_addenda
BEGIN SELECT RAISE(ABORT, 'addenda are append-only'); END;
CREATE TRIGGER addenda_no_delete BEFORE DELETE ON discharge_addenda
BEGIN SELECT RAISE(ABORT, 'addenda are append-only'); END;
