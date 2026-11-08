import { BackupError, checkPassphrase } from '../backup.js';
import { loadConfig } from '../config.js';
import { restoreBackup } from '../restore.js';

// Wrapped in a function (rather than top-level await) so this file can be bundled as CommonJS
// for the packaged single-executable build — esbuild's CJS output cannot contain top-level await.
async function main() {
  const args = process.argv.slice(2);
  const replace = args.includes('--replace');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Usage: npm run restore -- <backup-file.cbk> [--replace]\n  Without --replace the backup is only decrypted and checked, as a new file next to the database.\n  With --replace the current database is moved aside and the backup becomes the live database (stop the server first).');
    process.exit(2);
  }
  const cfg = loadConfig();
  try {
    const r = await restoreBackup({ file, passphrase: checkPassphrase(cfg.backupPassphrase), cfg, replace });
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
