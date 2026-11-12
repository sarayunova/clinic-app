// Automates full compilation of the Windows installer (ClinicAppSetup-0.1.0.exe)
// Run with: npm run build:installer
// Optional flag: --full to re-run web build and SEA binary packaging from scratch.
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const isFull = process.argv.includes('--full');

function findIscc() {
  const candidates = [
    process.env.ISCC_PATH,
    path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
    'C:\\InnoSetup\\ISCC.exe',
  ].filter(Boolean);

  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }

  try {
    const res = execSync('where.exe ISCC', { encoding: 'utf8' }).trim().split('\r\n')[0];
    if (res && fs.existsSync(res)) return res;
  } catch {
    // ignore
  }

  return null;
}

const iscc = findIscc();
if (!iscc) {
  console.error('Error: Inno Setup 6 compiler (ISCC.exe) not found.');
  console.error('Please download Inno Setup 6 from https://jrsoftware.org/isdl.php');
  process.exit(1);
}

const webIndex = path.join(root, 'dist', 'web', 'index.html');
const clinicExe = path.join(root, 'dist-exe', 'clinic.exe');

if (isFull || !fs.existsSync(webIndex)) {
  console.log('Building Vite web frontend (npm run build)...');
  execSync('npm run build', { stdio: 'inherit', cwd: root });
}

if (isFull || !fs.existsSync(clinicExe)) {
  console.log('Building Single Executable Application binary (npm run build:exe)...');
  execSync('npm run build:exe', { stdio: 'inherit', cwd: root });
}

const issPath = path.join(root, 'installer', 'clinic-app.iss');
console.log(`Compiling Inno Setup installer using: ${iscc}`);
execFileSync(iscc, [issPath], { stdio: 'inherit', cwd: root });

const outExe = path.join(root, 'installer', 'output', 'ClinicAppSetup-0.1.0.exe');
if (fs.existsSync(outExe)) {
  const stats = fs.statSync(outExe);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n✅ Installer successfully compiled:`);
  console.log(`   Path: ${outExe}`);
  console.log(`   Size: ${sizeMb} MB`);
} else {
  console.error('Installer output file not found at expected location.');
  process.exit(1);
}
