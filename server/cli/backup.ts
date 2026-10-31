import path from 'node:path';
import { BackupError, runBackup } from '../backup.js';
import { loadConfig } from '../config.js';
import { openDb } from '../db.js';

const cfg = loadConfig();
const db = openDb(cfg.dbFile);
try {
  const r = await runBackup(db, cfg);
  console.log(`Backup written and verified: ${path.join(cfg.backupDir, r.file)} (${r.sizeBytes} bytes)`);
  console.log(`Contains ${r.verify.patients} patients and ${r.verify.users} users. Integrity: ${r.verify.integrity}.`);
} catch (e) {
  console.error(e instanceof BackupError ? e.message : e);
  process.exitCode = 1;
} finally {
  db.close();
}
