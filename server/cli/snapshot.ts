import fs from 'node:fs';
import { ConfigError, loadConfig } from '../config.js';
import { serverIsRunning } from '../restore.js';
import { NoDatabaseError, SnapshotError, snapshotDatabase } from '../snapshot.js';

const usage = `Usage: clinic.exe snapshot [--passphrase-file <file>]
  Takes a verified copy of the clinic database into <data folder>\\pre-upgrade (newest 3 kept).
  Run by the installer just before an upgrade, with the server stopped. Opens the database
  read-only and never creates one.
  Encrypted (a .cbk that "clinic.exe restore" opens) when a backup passphrase is available, from
  --passphrase-file or else CLINIC_BACKUP_PASSPHRASE(_FILE); a plain copy otherwise.
  Exit codes: 0 copy taken and verified; 2 no database yet (nothing to protect); 1 failed.`;

// Wrapped in a function (rather than top-level await) so this file can be bundled as CommonJS
// for the packaged single-executable build — esbuild's CJS output cannot contain top-level await.
async function main() {
  if (process.argv.includes('--help')) {
    console.log(usage);
    return;
  }
  let cfg;
  try {
    cfg = loadConfig();
  } catch (e) {
    console.error(e instanceof ConfigError ? e.message : e);
    process.exit(1);
  }
  if (serverIsRunning(cfg)) {
    console.error('The clinic server is still running. Stop it first (clinic.exe request-stop).');
    process.exit(1);
  }
  // The passphrase is read here, from a file, so it never appears on a command line.
  let passphrase = cfg.backupPassphrase;
  const pi = process.argv.indexOf('--passphrase-file');
  if (pi >= 0) {
    const file = process.argv[pi + 1];
    if (!file) {
      console.error(`--passphrase-file needs a file.\n${usage}`);
      process.exit(1);
    }
    try {
      passphrase = fs.readFileSync(file, 'utf8').replace(/[\r\n]+$/, '');
    } catch (e) {
      console.error(`Could not read the backup passphrase file ${file}: ${(e as Error).message}`);
      process.exit(1);
    }
  }
  try {
    const r = await snapshotDatabase({ dbFile: cfg.dbFile, dataDir: cfg.dataDir, passphrase });
    console.log(
      `Safety copy taken and verified (${r.encrypted ? 'encrypted with the backup passphrase' : `NOT encrypted: ${r.plainReason}`}): ` +
        `${r.file} (${r.sizeBytes} bytes, ${r.verify.patients} patients, ${r.verify.users} users).`,
    );
    if (r.pruned.length) console.log(`Removed older safety copies: ${r.pruned.join(', ')}`);
  } catch (e) {
    if (e instanceof NoDatabaseError) {
      console.log(e.message);
      process.exitCode = 2;
      return;
    }
    console.error(e instanceof SnapshotError ? e.message : e);
    process.exitCode = 1;
  }
}

main();
