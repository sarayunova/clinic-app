import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSea } from 'node:sea';
import { ConfigError, defaultMachineDataDir, loadConfig } from './config.js';
import { openDb } from './db.js';
import { buildApp } from './app.js';
import { startBackupScheduler } from './backup.js';
import { pidFile, serverIsRunning, shutdownRequestFile } from './restore.js';
import { TlsError, checkListenSafety, loadTls, startHttpRedirect } from './tls.js';
import { restrictToServiceAndAdmins } from './windowsAcl.js';

// Wrapped in a function (rather than top-level await) so this file can be bundled as CommonJS
// for the packaged single-executable build (see server/sea-entry.ts, scripts/build-exe.mjs) —
// esbuild's CJS output cannot contain top-level await. Behavior for `npm start`/tsx is unchanged.
async function main() {
  let cfg;
  try {
    cfg = loadConfig();
  } catch (e) {
    console.error(e instanceof ConfigError ? e.message : e);
    process.exit(1);
  }
  if (cfg.dataDirSource === 'legacy-fallback') {
    console.warn(`Using existing data at ${cfg.dataDir} (not yet moved to the standard location ${defaultMachineDataDir()}). Set CLINIC_DATA_DIR explicitly once this is migrated.`);
  } else if (cfg.dataDirSource === 'machine-default-fresh' && !fs.existsSync(cfg.dataDir)) {
    fs.mkdirSync(cfg.dataDir, { recursive: true });
    restrictToServiceAndAdmins(cfg.dataDir);
  }
  let tls;
  try {
    tls = loadTls(cfg);
    const warning = checkListenSafety(cfg.host, !!tls, cfg.allowInsecureLan);
    if (warning) console.warn(warning);
  } catch (e) {
    console.error(e instanceof TlsError ? e.message : e);
    process.exit(1);
  }
  if (serverIsRunning(cfg)) {
    console.error('Another clinic server is already running on this data directory.');
    process.exit(1);
  }
  const db = openDb(cfg.dbFile);
  fs.writeFileSync(pidFile(cfg), String(process.pid));
  // Packaged as a single executable (Node SEA), there is no source file next to `dist/web` — the
  // built app's own files live beside the .exe instead of beside this module.
  const webRoot = isSea()
    ? (fs.existsSync(path.join(path.dirname(process.execPath), 'dist', 'web'))
        ? path.join(path.dirname(process.execPath), 'dist', 'web')
        : path.join(path.dirname(process.execPath), '..', 'dist', 'web'))
    : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'web');
  const hasUi = fs.existsSync(path.join(webRoot, 'index.html'));
  if (!hasUi) console.warn('Web UI not built (run `npm run build`). Serving the API only.');
  const app = await buildApp({ db, cfg, secureCookies: !!tls, tls, webRoot: hasUi ? webRoot : undefined });

  await app.listen({ host: cfg.host, port: cfg.port });
  const scheme = tls ? 'https' : 'http';
  console.log(`Clinic app listening on ${scheme}://${cfg.host}:${cfg.port}${tls ? ` (certificate valid ${tls.info.daysLeft} more days)` : ''}`);
  console.log(`Data directory: ${cfg.dataDir}`);

  let redirect: Awaited<ReturnType<typeof startHttpRedirect>> | null = null;
  if (tls && cfg.httpRedirectPort > 0) {
    try {
      redirect = await startHttpRedirect(cfg.host, cfg.httpRedirectPort, tls.info.names, cfg.port);
      console.log(`Plain HTTP on port ${cfg.httpRedirectPort} redirects to https (port ${cfg.port})`);
    } catch (e) {
      // The app itself is fine without the redirect, so do not stop it.
      console.warn(`Could not start the http-to-https redirect on port ${cfg.httpRedirectPort}: ${(e as Error).message}`);
    }
  }

  const stopBackups = startBackupScheduler(db, cfg);

  const shutdown = async () => {
    clearInterval(stopRequestPoll);
    stopBackups();
    redirect?.close();
    fs.rmSync(pidFile(cfg), { force: true });
    fs.rmSync(shutdownRequestFile(cfg), { force: true });
    await app.close();
    db.close();
    process.exit(0);
  };
  // Windows cannot reliably deliver SIGTERM to an external process the way POSIX can, so the
  // installer asks for a graceful stop via this sentinel file instead (server/restore.ts).
  const stopRequestPoll = setInterval(() => {
    if (fs.existsSync(shutdownRequestFile(cfg))) void shutdown();
  }, 500);
  stopRequestPoll.unref();
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
