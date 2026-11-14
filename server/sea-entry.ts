// Entry point for the packaged single-executable build only (see scripts/build-exe.mjs).
// `npm start` still runs server/index.ts directly and is unaffected by this file.
// No top-level await (esbuild's CJS output format cannot contain it).
async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'backup':
      process.argv.splice(2, 1);
      await import('./cli/backup.js');
      break;
    case 'restore':
      process.argv.splice(2, 1);
      await import('./cli/restore.js');
      break;
    case 'cert':
      process.argv.splice(2, 1);
      await import('./cli/cert.js');
      break;
    case 'migrate-data-dir':
      process.argv.splice(2, 1);
      await import('./cli/migrateDataDir.js');
      break;
    case 'request-stop':
      process.argv.splice(2, 1);
      await import('./cli/requestStop.js');
      break;
    case 'snapshot':
      process.argv.splice(2, 1);
      await import('./cli/snapshot.js');
      break;
    case 'health':
      process.argv.splice(2, 1);
      await import('./cli/health.js');
      break;
    case '--version':
    case 'version': {
      const { APP_VERSION } = await import('./version.js');
      console.log(APP_VERSION);
      process.exit(0);
      break;
    }
    case '--help':
    case '-h':
    case 'help':
      console.log(`Clinic App - Desktop & Inpatient Management System

Usage:
  clinic.exe [options]           Start the clinic web server
  clinic.exe backup              Run a verified encrypted backup snapshot
  clinic.exe restore <file.cbk>  Verify or restore a backup snapshot (--replace)
  clinic.exe cert [options]      Configure TLS certificates & CA
  clinic.exe migrate-data-dir    Copy an existing per-user database to the machine-wide location (--yes)
  clinic.exe request-stop        Ask a running server to stop gracefully (--timeout <seconds>)
  clinic.exe snapshot            Verified copy of the database before an upgrade (server must be stopped)
  clinic.exe health              Wait for this computer's server to answer and check its version (--timeout <seconds>)
  clinic.exe version             Print this program's version

Options for server:
  Set environment variables CLINIC_DATA_DIR, PORT, HOST, CLINIC_BACKUP_DIR, etc.
  See docs/ for full configuration and deployment options.`);
      process.exit(0);
      break;
    default:
      await import('./index.js');
  }
}

main();
