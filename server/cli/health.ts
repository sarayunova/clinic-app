import { ConfigError, loadConfig } from '../config.js';
import { localHealthTarget, waitForHealthy } from '../healthCheck.js';
import { APP_VERSION } from '../version.js';

const usage = `Usage: clinic.exe health [--timeout <seconds>] [--any-version]
  Waits for this computer's clinic server to answer, and checks it is this version (${APP_VERSION}).
  Exit codes: 0 running and this version; 1 not answering; 3 answering but a different version
  (an older server is still running). --any-version accepts any version.`;

// Wrapped in a function (rather than top-level await) so this file can be bundled as CommonJS
// for the packaged single-executable build — esbuild's CJS output cannot contain top-level await.
async function main() {
  if (process.argv.includes('--help')) {
    console.log(usage);
    return;
  }
  const i = process.argv.indexOf('--timeout');
  const timeoutSeconds = i >= 0 ? Number(process.argv[i + 1]) : 60;
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    console.error(`Invalid --timeout value.\n${usage}`);
    process.exit(2);
  }
  let cfg;
  try {
    cfg = loadConfig();
  } catch (e) {
    console.error(e instanceof ConfigError ? e.message : e);
    process.exit(1);
  }
  const target = localHealthTarget(cfg);
  const expectVersion = process.argv.includes('--any-version') ? undefined : APP_VERSION;
  const r = await waitForHealthy(target, { timeoutMs: timeoutSeconds * 1000, expectVersion });
  if (r.status === 'up') {
    console.log(`The clinic server is running (version ${r.version ?? 'unknown'}) at ${target.url.replace(/\/api\/health$/, '')}.`);
  } else if (r.status === 'wrong-version') {
    console.error(`A clinic server is answering, but it is version ${r.version ?? 'unknown'}, not ${APP_VERSION}: an older server may still be running.`);
    process.exitCode = 3;
  } else {
    console.error(`The clinic server did not answer at ${target.url} within ${timeoutSeconds}s (${r.lastError}). See the logs folder in ${cfg.dataDir}.`);
    process.exitCode = 1;
  }
}

main();
