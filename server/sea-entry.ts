// Entry point for the packaged single-executable build only (see scripts/build-exe.mjs).
// `npm start` still runs server/index.ts directly and is unaffected by this file.
// No top-level await (esbuild's CJS output format cannot contain it).
async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'backup':
      await import('./cli/backup.js');
      break;
    case 'restore':
      await import('./cli/restore.js');
      break;
    case 'cert':
      await import('./cli/cert.js');
      break;
    default:
      await import('./index.js');
  }
}

main();
