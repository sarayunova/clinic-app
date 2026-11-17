import fs from 'node:fs';
import path from 'node:path';

// Replaced with the package.json version at build time by scripts/build-exe.mjs (esbuild `define`).
declare const __APP_VERSION__: string | undefined;

function fromPackageJson(): string {
  // Running from source (npm start / tests): read it from the repository.
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as { name?: string; version?: string };
    if (pkg.name === 'clinic-app' && pkg.version) return pkg.version;
  } catch {
    /* fall through */
  }
  return 'unknown';
}

/** This build's version. The installer compares it with what a running server reports to confirm an upgrade took effect. */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : fromPackageJson();
