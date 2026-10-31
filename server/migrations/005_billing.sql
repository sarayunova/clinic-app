-- Billing: itemised invoices, payments, refunds, authorised adjustments. All money is integer paise.

INSERT INTO counters(name, value) VALUES ('invoice', 0), ('receipt', 0), ('refund', 0);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE invoices (
  id             INTEGER PRIMARY KEY,
  invoice_number TEXT UNIQUE,                 -- assigned when issued
  patient_id     INTEGER NOT NULL REFERENCES patients(id),
  visit_id       INTEGER REFERENCES visits(id),
  admission_id   INTEGER REFERENCES admissions(id),
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','cancelled')),
  notes          TEXT,
  issued_at      TEXT,
  cancelled_at   TEXT,
  cancel_reason  TEXT,
  created_by     INTEGER NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  CHECK ((status = 'draft') = (invoice_number IS NULL)),
  CHECK ((status = 'draft') = (issued_at IS NULL)),
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);
CREATE INDEX idx_invoices_patient ON invoices(patient_id, created_at);
CREATE INDEX idx_invoices_status ON invoices(status);
-- Only a draft can be discarded; issued invoices stay forever.
CREATE TRIGGER invoices_delete_draft_only BEFORE DELETE ON invoices
WHEN OLD.status <> 'draft'
BEGIN SELECT RAISE(ABORT, 'issued invoices cannot be deleted'); END;
CREATE TRIGGER invoices_fixed_links BEFORE UPDATE ON invoices
WHEN NEW.patient_id IS NOT OLD.patient_id OR NEW.visit_id IS NOT OLD.visit_id OR NEW.admission_id IS NOT OLD.admission_id
  OR (OLD.status <> 'draft' AND NEW.status = 'draft') OR (OLD.status = 'cancelled')
  OR (OLD.invoice_number IS NOT NULL AND NEW.invoice_number IS NOT OLD.invoice_number)
BEGIN SELECT RAISE(ABORT, 'invoice links, number and status history cannot be changed'); END;

CREATE TABLE invoice_lines (
  id               INTEGER PRIMARY KEY,
  invoice_id       INTEGER NOT NULL REFERENCES invoices(id),
  position         INTEGER NOT NULL,
  category         TEXT NOT NULL CHECK (category IN ('consultation','investigation','procedure','room_bed','other')),
  description      TEXT NOT NULL CHECK (length(trim(description)) >= 1),
  quantity         INTEGER NOT NULL CHECK (quantity >= 1 AND quantity <= 10000),
  unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0 AND unit_price_paise <= 1000000000),
  amount_paise     INTEGER NOT NULL CHECK (amount_paise = quantity * unit_price_paise)
);
CREATE INDEX idx_lines_invoice ON invoice_lines(invoice_id, position);
-- Lines may only change while the invoice is a draft.
CREATE TRIGGER lines_draft_insert BEFORE INSERT ON invoice_lines
WHEN (SELECT status FROM invoices WHERE id = NEW.invoice_id) <> 'draft'
BEGIN SELECT RAISE(ABORT, 'lines of an issued invoice cannot change; use an adjustment'); END;
CREATE TRIGGER lines_draft_update BEFORE UPDATE ON invoice_lines
WHEN (SELECT status FROM invoices WHERE id = OLD.invoice_id) <> 'draft'
BEGIN SELECT RAISE(ABORT, 'lines of an issued invoice cannot change; use an adjustment'); END;
CREATE TRIGGER lines_draft_delete BEFORE DELETE ON invoice_lines
WHEN (SELECT status FROM invoices WHERE id = OLD.invoice_id) <> 'draft'
BEGIN SELECT RAISE(ABORT, 'lines of an issued invoice cannot change; use an adjustment'); END;

-- Money received (kind 'payment') or returned (kind 'refund'). Append-only; a mistake is reversed by a refund.
CREATE TABLE payments (
  id             INTEGER PRIMARY KEY,
  invoice_id     INTEGER NOT NULL REFERENCES invoices(id),
  kind           TEXT NOT NULL CHECK (kind IN ('payment','refund')),
  receipt_number TEXT NOT NULL UNIQUE,         -- R000001 for payments, F000001 for refunds
  amount_paise   INTEGER NOT NULL CHECK (amount_paise > 0 AND amount_paise <= 1000000000),
  method         TEXT NOT NULL CHECK (method IN ('cash','upi','card','bank_transfer','cheque','other')),
  reference      TEXT,
  reason         TEXT,                          -- required for refunds
  paid_at        TEXT NOT NULL,
  received_by    INTEGER NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL,
  CHECK (kind = 'payment' OR (reason IS NOT NULL AND length(trim(reason)) >= 5))
);
CREATE INDEX idx_payments_invoice ON payments(invoice_id, paid_at);
CREATE TRIGGER payments_issued_only BEFORE INSERT ON payments
WHEN (SELECT status FROM invoices WHERE id = NEW.invoice_id) <> 'issued'
BEGIN SELECT RAISE(ABORT, 'payments can only be recorded on an issued invoice'); END;
CREATE TRIGGER payments_no_update BEFORE UPDATE ON payments
BEGIN SELECT RAISE(ABORT, 'payments are append-only'); END;
CREATE TRIGGER payments_no_delete BEFORE DELETE ON payments
BEGIN SELECT RAISE(ABORT, 'payments are append-only'); END;

-- Authorised changes to an issued invoice. Negative reduces the bill (discount, write-off), positive increases it.
CREATE TABLE adjustments (
  id            INTEGER PRIMARY KEY,
  invoice_id    INTEGER NOT NULL REFERENCES invoices(id),
  amount_paise  INTEGER NOT NULL CHECK (amount_paise <> 0 AND amount_paise BETWEEN -1000000000 AND 1000000000),
  kind          TEXT NOT NULL CHECK (kind IN ('discount','write_off','correction')),
  reason        TEXT NOT NULL CHECK (length(trim(reason)) >= 5),
  authorised_by INTEGER NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_adjustments_invoice ON adjustments(invoice_id);
CREATE TRIGGER adjustments_issued_only BEFORE INSERT ON adjustments
WHEN (SELECT status FROM invoices WHERE id = NEW.invoice_id) <> 'issued'
BEGIN SELECT RAISE(ABORT, 'adjustments can only be added to an issued invoice'); END;
CREATE TRIGGER adjustments_no_update BEFORE UPDATE ON adjustments
BEGIN SELECT RAISE(ABORT, 'adjustments are append-only'); END;
CREATE TRIGGER adjustments_no_delete BEFORE DELETE ON adjustments
BEGIN SELECT RAISE(ABORT, 'adjustments are append-only'); END;
