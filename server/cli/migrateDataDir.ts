import path from 'node:path';
import { ConfigError, defaultMachineDataDir, loadConfig } from '../config.js';
import { MigrationError, migrateDataDir } from '../dataMigration.js';
import { serverIsRunning } from '../restore.js';

const usage = `Usage: npm run migrate-data-dir [-- --yes]
  Finds an existing database at the old per-user location and copies it (never moves it) to the
  standard machine-wide location, verifying record counts match before accepting the copy.
  Without --yes this only reports what would happen; nothing is changed.
  The clinic server must be stopped first. The original data is never modified or deleted.`;

// Wrapped in a function (rather than top-level await) so this file can be bundled as CommonJS
// for the packaged single-executable build — esbuild's CJS output cannot contain top-level await.
async function main() {
  if (process.argv.includes('--help')) {
    console.log(usage);
    return;
  }
  const confirmed = process.argv.includes('--yes');

  let cfg;
  try {
    cfg = loadConfig();
  } catch (e) {
    console.error(e instanceof ConfigError ? e.message : e);
    process.exit(1);
  }

  if (cfg.dataDirSource === 'machine-default-existing') {
    console.log(`Nothing to migrate: already using the standard machine-wide location (${cfg.dataDir}).`);
    return;
  }
  if (cfg.dataDirSource === 'machine-default-fresh') {
    console.log(`Nothing to migrate: no existing database was found anywhere. A fresh install uses ${cfg.dataDir} directly.`);
    return;
  }
  // dataDirSource is 'explicit' here if CLINIC_DATA_DIR/an override pinned a path; migrating that
  // deliberate choice is outside this tool's job, so only 'legacy-fallback' proceeds.
  if (cfg.dataDirSource !== 'legacy-fallback') {
    console.log(`Data directory was explicitly set to ${cfg.dataDir}; this tool only migrates an auto-detected legacy location. Nothing done.`);
    return;
  }

  const destDir = defaultMachineDataDir();
  const destDbFile = path.join(destDir, 'clinic.sqlite');
  console.log(`Source location      : ${cfg.dataDir}`);
  console.log(`Destination location : ${destDir}`);

  if (serverIsRunning(cfg)) {
    console.error('\nThe clinic server is running against the source location. Stop it first, then run this again.');
    process.exit(1);
  }
  if (!confirmed) {
    console.log('\nThis will copy the database to the machine-wide location and verify it matches exactly. The original is left untouched.\nRe-run with --yes to proceed.');
    return;
  }

  try {
    const r = await migrateDataDir({ sourceDbFile: cfg.dbFile, destDir, destDbFile });
    console.log(`\nVerified copy written: ${r.destDbFile}`);
    console.log(`Patients: ${r.destVerify.patients}, Users: ${r.destVerify.users}, Migrations: ${r.destVerify.migrations}. Integrity: ${r.destVerify.integrity}.`);
    console.log(`\nThe original data at ${cfg.dataDir} has NOT been changed or deleted.`);
    console.log('Next: point the service at the new location (set CLINIC_DATA_DIR, or remove any pinned override so the standard default applies), confirm the app works correctly after a restart, then archive the old folder yourself once satisfied.');
  } catch (e) {
    console.error(e instanceof MigrationError ? e.message : e);
    process.exitCode = 1;
  }
}

main();
