import { BackupError, checkPassphrase } from '../backup.js';
import { ConfigError, loadConfig } from '../config.js';
import { checkBackup, restoreBackup } from '../restore.js';

const usage = `Usage: clinic.exe restore <backup-file.cbk> [--check | --replace]
  --check    Only decrypt and check the backup, show what is in it, and leave nothing behind.
  (neither)  Decrypt and check, and write the restored copy next to the database for inspection.
  --replace  Make the backup the live database. The server must be stopped first; the current
             database is moved aside (never deleted), and put back if the restored one fails to open.
             Refused for a backup made by a newer version of the app.
  The passphrase comes from CLINIC_BACKUP_PASSPHRASE_FILE (or CLINIC_BACKUP_PASSPHRASE).`;

// Wrapped in a function (rather than top-level await) so this file can be bundled as CommonJS
// for the packaged single-executable build — esbuild's CJS output cannot contain top-level await.
async function main() {
  const args = process.argv.slice(2);
  const replace = args.includes('--replace');
  const check = args.includes('--check');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file || (replace && check) || args.includes('--help')) {
    console.error(usage);
    process.exit(2);
  }
  let cfg;
  try {
    cfg = loadConfig();
  } catch (e) {
    console.error(e instanceof ConfigError ? e.message : e);
    process.exit(1);
  }
  try {
    const passphrase = checkPassphrase(cfg.backupPassphrase);
    if (check) {
      const c = await checkBackup({ file, passphrase, cfg });
      console.log(`Backup is sound: ${c.verify.patients} patients, ${c.verify.users} users, ${c.verify.migrations} migrations. Integrity: ${c.verify.integrity}.`);
      console.log(`Taken: ${c.takenAt}. Last change recorded in it: ${c.newestActivityAt ?? 'unknown'}.`);
      if (!c.canRestoreHere) {
        console.log(`This backup was made by a NEWER version of the app (${c.newerMigrations.length} unknown database update(s)); this version cannot restore it.`);
        process.exitCode = 3;
      }
      return;
    }
    const r = await restoreBackup({ file, passphrase, cfg, replace });
    console.log(`Backup is sound: ${r.verify.patients} patients, ${r.verify.users} users, ${r.verify.migrations} migrations. Integrity: ${r.verify.integrity}.`);
    if (r.replaced) {
      console.log(`Restored. The live database is now the backup. The previous database was kept as: ${r.keptOldAs ?? '(there was none)'}`);
    } else {
      console.log(`Restored copy written to: ${r.restoredFile}\nThe live database was NOT changed. Re-run with --replace to use this backup.`);
    }
  } catch (e) {
    console.error(e instanceof BackupError ? e.message : e);
    process.exitCode = 1;
  }
}

main();
