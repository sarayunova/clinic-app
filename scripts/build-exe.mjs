// Bundles server/sea-entry.ts into dist-exe/clinic.exe: a single executable that runs the
// clinic server (or its backup/restore/cert subcommands) with no Node.js install, npm, or
// node_modules needed on the machine it's copied to. Run after `npm run build` (the web UI
// and migrations still ship as plain folders next to the exe, not embedded in it).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'dist-exe');
// CLINIC_BUILD_VERSION is for test builds only (e.g. a 0.1.1-sandbox build to rehearse an upgrade).
const version = process.env.CLINIC_BUILD_VERSION || JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(root, 'server', 'sea-entry.ts')],
  outfile: path.join(outDir, 'bundle.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  logLevel: 'info',
  // Baked in so `clinic.exe` (and /api/health) report the version they were built as - see server/version.ts.
  define: { __APP_VERSION__: JSON.stringify(version) },
});

execFileSync(process.execPath, ['--experimental-sea-config', path.join(root, 'sea-config.json')], {
  stdio: 'inherit',
  cwd: root,
});

const exePath = path.join(outDir, 'clinic.exe');
fs.copyFileSync(process.execPath, exePath);

execFileSync(
  process.execPath,
  [
    path.join(root, 'node_modules', 'postject', 'dist', 'cli.js'),
    exePath,
    'NODE_SEA_BLOB',
    path.join(outDir, 'sea-prep.blob'),
    '--sentinel-fuse',
    'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  ],
  { stdio: 'inherit', cwd: root },
);

console.log(`\nBuilt ${exePath}`);
