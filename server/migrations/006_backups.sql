-- One row per backup attempt, so the doctor can see whether backups are really happening.
CREATE TABLE backup_runs (
  id          INTEGER PRIMARY KEY,
  started_at  TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  ok          INTEGER NOT NULL CHECK (ok IN (0,1)),
  file        TEXT,
  size_bytes  INTEGER,
  error       TEXT,
  detail      TEXT
);
CREATE INDEX idx_backup_runs_ok ON backup_runs(ok, id);
CREATE TRIGGER backup_runs_no_update BEFORE UPDATE ON backup_runs BEGIN SELECT RAISE(ABORT, 'backup history is append-only'); END;
CREATE TRIGGER backup_runs_no_delete BEFORE DELETE ON backup_runs BEGIN SELECT RAISE(ABORT, 'backup history is append-only'); END;
