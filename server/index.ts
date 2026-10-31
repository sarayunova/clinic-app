import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { buildApp } from './app.js';
import { startBackupScheduler } from './backup.js';
import { pidFile, serverIsRunning } from './restore.js';

const cfg = loadConfig();
if (serverIsRunning(cfg)) {
  console.error('Another clinic server is already running on this data directory.');
  process.exit(1);
}
const db = openDb(cfg.dbFile);
fs.writeFileSync(pidFile(cfg), String(process.pid));
const webRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'web');
const hasUi = fs.existsSync(path.join(webRoot, 'index.html'));
if (!hasUi) console.warn('Web UI not built (run `npm run build`). Serving the API only.');
const app = await buildApp({ db, cfg, secureCookies: process.env.CLINIC_HTTPS === '1', webRoot: hasUi ? webRoot : undefined });

await app.listen({ host: cfg.host, port: cfg.port });
console.log(`Clinic app listening on http://${cfg.host}:${cfg.port}`);
console.log(`Data directory: ${cfg.dataDir}`);
if (cfg.host !== '127.0.0.1' && cfg.host !== 'localhost') {
  console.warn('WARNING: listening beyond this computer. HTTPS is not set up yet - do not use with real patient data.');
}

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
