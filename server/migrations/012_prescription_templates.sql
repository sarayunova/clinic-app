-- Doctor-managed prescription templates / regimens to streamline writing common prescriptions.
CREATE TABLE prescription_templates (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  category    TEXT NOT NULL DEFAULT 'General',
  items_json  TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_rx_templates_name ON prescription_templates(name COLLATE NOCASE);
