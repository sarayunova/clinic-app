-- The doctor's "ready for real patients" checklist: which one-time setup jobs have been done, when and by whom.
-- Only a record of what people say they did; the app cannot check most of these itself.
CREATE TABLE setup_checks (
  key        TEXT PRIMARY KEY,
  done_by    INTEGER NOT NULL REFERENCES users(id),
  done_at    TEXT NOT NULL,
  note       TEXT
);
