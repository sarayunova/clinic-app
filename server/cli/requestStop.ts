import { ConfigError, loadConfig } from '../config.js';
import { requestGracefulStop, serverIsRunning } from '../restore.js';

const usage = `Usage: clinic.exe request-stop [--timeout <seconds>]
  Asks a running clinic server to shut down gracefully (finishes in-flight requests, closes the
  database cleanly) and waits for it to actually stop. Exit code 0 means it stopped in time; a
  non-zero exit code means it did not respond within the timeout - the caller must decide whether
  to escalate (e.g. a force-kill) rather than silently continuing.`;

// Wrapped in a function (rather than top-level await) so this file can be bundled as CommonJS
// for the packaged single-executable build — esbuild's CJS output cannot contain top-level await.
async function main() {
  if (process.argv.includes('--help')) {
    console.log(usage);
    return;
  }
  const timeoutArg = process.argv.indexOf('--timeout');
  const timeoutSeconds = timeoutArg >= 0 ? Number(process.argv[timeoutArg + 1]) : 30;
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

  if (!serverIsRunning(cfg)) {
    console.log(`No clinic server is running on this data directory (${cfg.dataDir}). Nothing to stop.`);
    return;
  }

  console.log(`Asking the clinic server to stop (data: ${cfg.dataDir}). Waiting up to ${timeoutSeconds}s...`);
  const stopped = await requestGracefulStop(cfg, timeoutSeconds * 1000);
  if (stopped) {
    console.log('Stopped cleanly.');
  } else {
    console.error(`The server did not stop within ${timeoutSeconds}s.`);
    process.exitCode = 1;
  }
}

main();
