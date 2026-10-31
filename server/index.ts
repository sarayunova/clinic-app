import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { buildApp } from './app.js';

const cfg = loadConfig();
const db = openDb(cfg.dbFile);
const app = await buildApp({ db, cfg, secureCookies: process.env.CLINIC_HTTPS === '1' });

await app.listen({ host: cfg.host, port: cfg.port });
console.log(`Clinic app listening on http://${cfg.host}:${cfg.port}`);
console.log(`Data directory: ${cfg.dataDir}`);
if (cfg.host !== '127.0.0.1' && cfg.host !== 'localhost') {
  console.warn('WARNING: listening beyond this computer. HTTPS is not set up yet - do not use with real patient data.');
}

const shutdown = async () => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
