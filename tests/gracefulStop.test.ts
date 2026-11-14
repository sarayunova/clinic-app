import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, type Config } from '../server/config.js';
import { pidFile, requestGracefulStop, serverIsRunning, shutdownRequestFile } from '../server/restore.js';

let dir: string;
let cfg: Config;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clinic-gracefulstop-test-'));
  cfg = loadConfig({ dataDir: dir, dbFile: path.join(dir, 'clinic.sqlite') });
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('requestGracefulStop', () => {
  it('is a no-op and returns true immediately when nothing is running', async () => {
    expect(serverIsRunning(cfg)).toBe(false);
    const stopped = await requestGracefulStop(cfg, 1000, 20);
    expect(stopped).toBe(true);
    expect(fs.existsSync(shutdownRequestFile(cfg))).toBe(false);
  });

  it('writes the sentinel file and resolves true once the pid file disappears (simulated server exit)', async () => {
    fs.writeFileSync(pidFile(cfg), String(process.pid));
    expect(serverIsRunning(cfg)).toBe(true);

    // Simulate the server noticing the sentinel and exiting cleanly (what server/index.ts's
    // shutdown() does), shortly after the request is made.
    setTimeout(() => fs.rmSync(pidFile(cfg), { force: true }), 150);

    const stopped = await requestGracefulStop(cfg, 2000, 50);
    expect(stopped).toBe(true);
    expect(fs.existsSync(shutdownRequestFile(cfg))).toBe(true);
  });

  it('returns false if the server never stops within the timeout, without touching the pid file itself', async () => {
    fs.writeFileSync(pidFile(cfg), String(process.pid));
    const stopped = await requestGracefulStop(cfg, 300, 50);
    expect(stopped).toBe(false);
    expect(serverIsRunning(cfg)).toBe(true); // this function never force-kills anything
  });
});
