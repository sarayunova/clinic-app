import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { buildApp } from './app.js';
import { startBackupScheduler } from './backup.js';
import { pidFile, serverIsRunning } from './restore.js';
import { TlsError, checkListenSafety, loadTls } from './tls.js';

const cfg = loadConfig();
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
const webRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'web');
const hasUi = fs.existsSync(path.join(webRoot, 'index.html'));
if (!hasUi) console.warn('Web UI not built (run `npm run build`). Serving the API only.');
const app = await buildApp({ db, cfg, secureCookies: !!tls, tls, webRoot: hasUi ? webRoot : undefined });

await app.listen({ host: cfg.host, port: cfg.port });
const scheme = tls ? 'https' : 'http';
console.log(`Clinic app listening on ${scheme}://${cfg.host}:${cfg.port}${tls ? ` (certificate valid ${tls.info.daysLeft} more days)` : ''}`);
console.log(`Data directory: ${cfg.dataDir}`);

const stopBackups = startBackupScheduler(db, cfg);

const shutdown = async () => {
  stopBackups();
  fs.rmSync(pidFile(cfg), { force: true });
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
