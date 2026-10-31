-- Patient documents (scan reports, ultrasound images, referral letters ...).
-- The file bytes live in the database itself so that every backup and restore carries them automatically.
-- Files are never edited or deleted: a wrong or unwanted document is "voided" with a reason and hidden.
CREATE TABLE attachments (
  id            INTEGER PRIMARY KEY,
  patient_id    INTEGER NOT NULL REFERENCES patients(id),
  visit_id      INTEGER REFERENCES visits(id),
  admission_id  INTEGER REFERENCES admissions(id),
  doc_type      TEXT NOT NULL CHECK (doc_type IN ('lab_report','ultrasound','imaging','referral','consent','outside_record','other')),
  title         TEXT NOT NULL CHECK (length(trim(title)) >= 2),
  document_date TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime          TEXT NOT NULL CHECK (mime IN ('application/pdf','image/jpeg','image/png')),
  size_bytes    INTEGER NOT NULL CHECK (size_bytes > 0),
  sha256        TEXT NOT NULL,
  uploaded_by   INTEGER NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL,
  voided_at     TEXT,
  voided_by     INTEGER REFERENCES users(id),
  void_reason   TEXT CHECK (void_reason IS NULL OR length(trim(void_reason)) >= 5),
  CHECK (visit_id IS NULL OR admission_id IS NULL),
  CHECK ((voided_at IS NULL) = (voided_by IS NULL) AND (voided_at IS NULL) = (void_reason IS NULL))
);
CREATE INDEX idx_attachments_patient ON attachments(patient_id, id);

CREATE TABLE attachment_blobs (
  attachment_id INTEGER PRIMARY KEY REFERENCES attachments(id),
  data          BLOB NOT NULL
);

-- Only the "void" columns may ever change, and only once.
CREATE TRIGGER attachments_limited_update BEFORE UPDATE ON attachments
WHEN OLD.voided_at IS NOT NULL
  OR NEW.id IS NOT OLD.id OR NEW.patient_id IS NOT OLD.patient_id OR NEW.visit_id IS NOT OLD.visit_id
  OR NEW.admission_id IS NOT OLD.admission_id OR NEW.doc_type IS NOT OLD.doc_type OR NEW.title IS NOT OLD.title
  OR NEW.document_date IS NOT OLD.document_date OR NEW.original_name IS NOT OLD.original_name OR NEW.mime IS NOT OLD.mime
  OR NEW.size_bytes IS NOT OLD.size_bytes OR NEW.sha256 IS NOT OLD.sha256 OR NEW.uploaded_by IS NOT OLD.uploaded_by
  OR NEW.created_at IS NOT OLD.created_at
BEGIN SELECT RAISE(ABORT, 'documents cannot be edited; void the document and upload a corrected one'); END;
CREATE TRIGGER attachments_no_delete BEFORE DELETE ON attachments
BEGIN SELECT RAISE(ABORT, 'documents cannot be deleted; void them instead'); END;
CREATE TRIGGER attachment_blobs_no_update BEFORE UPDATE ON attachment_blobs
BEGIN SELECT RAISE(ABORT, 'document files cannot be changed'); END;
CREATE TRIGGER attachment_blobs_no_delete BEFORE DELETE ON attachment_blobs
BEGIN SELECT RAISE(ABORT, 'document files cannot be deleted'); END;
