import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import { localHealthTarget, waitForHealthy } from '../server/healthCheck.js';
import { NoDatabaseError, SNAPSHOT_DIR_NAME, snapshotDatabase } from '../server/snapshot.js';
import { loadTls, setupTls } from '../server/tls.js';
import { APP_VERSION } from '../server/version.js';
import { verifyBackup } from '../server/backup.js';

const PASS = 'a long backup passphrase 42';
let dir: string;
let dbFile: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clinic-upgrade-test-'));
  dbFile = path.join(dir, 'clinic.sqlite');
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const seed = (patients: number) => {
  const db = openDb(dbFile);
  db.prepare(
    "INSERT INTO users(username, full_name, role, password_hash, must_change_password, active, created_at, updated_at) VALUES ('dr','Dr','doctor','x',0,1,'2026-01-01','2026-01-01')",
  ).run();
  for (let i = 1; i <= patients; i++) {
    db.prepare("INSERT INTO patients(patient_number, full_name, created_by, created_at, updated_at) VALUES (?, ?, 1, '2026-01-01', '2026-01-01')").run(`P${i}`, `Patient ${i}`);
  }
  return db;
};

describe('pre-upgrade snapshot', () => {
  it('takes a verified copy with the same records and leaves the live database byte-for-byte unchanged', async () => {
    seed(3).close();
    const before = fs.readFileSync(dbFile);
    const r = await snapshotDatabase({ dbFile, dataDir: dir });
    expect(r.file.startsWith(path.join(dir, SNAPSHOT_DIR_NAME))).toBe(true);
    expect(r.verify).toMatchObject({ integrity: 'ok', patients: 3, users: 1 });
    expect(fs.readFileSync(dbFile).equals(before)).toBe(true);
    expect(fs.readdirSync(path.join(dir, SNAPSHOT_DIR_NAME)).filter((n) => n.endsWith('.partial'))).toEqual([]);
  });

  it('copies what is still in the WAL journal, not just the main file (a server that did not shut down cleanly)', async () => {
    const live = seed(2); // left open: the inserts sit in clinic.sqlite-wal
    try {
      expect(fs.existsSync(`${dbFile}-wal`)).toBe(true);
      const r = await snapshotDatabase({ dbFile, dataDir: dir });
      expect(r.verify.patients).toBe(2);
    } finally {
      live.close();
    }
  });

  it('encrypts the copy with the backup passphrase when there is one, and the result restores', async () => {
    seed(4).close();
    const r = await snapshotDatabase({ dbFile, dataDir: dir, passphrase: PASS });
    expect(r).toMatchObject({ encrypted: true, plainReason: null });
    expect(r.file.endsWith('.cbk')).toBe(true);
    expect(r.verify).toMatchObject({ integrity: 'ok', patients: 4, users: 1 });
    // It is really encrypted: no SQLite header, and no patient name in the bytes.
    const bytes = fs.readFileSync(r.file);
    expect(bytes.includes(Buffer.from('SQLite format 3'))).toBe(false);
    expect(bytes.includes(Buffer.from('Patient 1'))).toBe(false);
    // Opens with the passphrase (the same check `clinic.exe restore` runs), and not with another one.
    expect((await verifyBackup(r.file, PASS)).patients).toBe(4);
    await expect(verifyBackup(r.file, 'some other long passphrase')).rejects.toThrow();
    // No plain intermediate left behind.
    expect(fs.readdirSync(path.join(dir, SNAPSHOT_DIR_NAME))).toEqual([path.basename(r.file)]);
  });

  it('falls back to a plain copy, and says why, when there is no usable passphrase', async () => {
    seed(1).close();
    const none = await snapshotDatabase({ dbFile, dataDir: dir, now: new Date(Date.UTC(2026, 10, 14, 9, 0)) });
    expect(none).toMatchObject({ encrypted: false, plainReason: expect.stringMatching(/no backup passphrase/) });
    expect(none.file.endsWith('.sqlite')).toBe(true);
    const short = await snapshotDatabase({ dbFile, dataDir: dir, passphrase: 'short', now: new Date(Date.UTC(2026, 10, 14, 9, 1)) });
    expect(short).toMatchObject({ encrypted: false, plainReason: expect.stringMatching(/shorter than/) });
  });

  it('counts encrypted and plain copies together when keeping the newest three', async () => {
    seed(1).close();
    for (let i = 0; i < 4; i++) {
      await snapshotDatabase({ dbFile, dataDir: dir, passphrase: i % 2 ? PASS : null, now: new Date(Date.UTC(2026, 10, 14, 8, i)) });
    }
    const left = fs.readdirSync(path.join(dir, SNAPSHOT_DIR_NAME)).sort();
    expect(left).toHaveLength(3);
    expect(left[0]).toMatch(/T080100Z\.cbk$/);
  });

  it('never creates a database when there is none (a fresh install)', async () => {
    await expect(snapshotDatabase({ dbFile, dataDir: dir })).rejects.toBeInstanceOf(NoDatabaseError);
    expect(fs.existsSync(dbFile)).toBe(false);
    expect(fs.existsSync(path.join(dir, SNAPSHOT_DIR_NAME))).toBe(false);
  });

  it('keeps the newest three, deleting older ones only after the new copy is verified', async () => {
    seed(1).close();
    const names: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await snapshotDatabase({ dbFile, dataDir: dir, now: new Date(Date.UTC(2026, 10, 14, 10, i)) });
      names.push(path.basename(r.file));
    }
    expect(fs.readdirSync(path.join(dir, SNAPSHOT_DIR_NAME)).sort()).toEqual(names.slice(2));
  });

  it('refuses a damaged database and writes no copy', async () => {
    seed(1).close();
    const buf = fs.readFileSync(dbFile);
    buf.fill(0x41, 4096, 8192); // overwrite a page with junk
    fs.writeFileSync(dbFile, buf);
    await expect(snapshotDatabase({ dbFile, dataDir: dir })).rejects.toThrow();
    const snaps = fs.existsSync(path.join(dir, SNAPSHOT_DIR_NAME)) ? fs.readdirSync(path.join(dir, SNAPSHOT_DIR_NAME)) : [];
    expect(snaps).toEqual([]);
  });
});

describe('post-install health check', () => {
  let app: FastifyInstance | null = null;
  afterEach(async () => {
    await app?.close();
    app = null;
  });

  it('reports this version from /api/health', async () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    app = await buildApp({ db: openDb(':memory:'), cfg: loadConfig({ dataDir: dir, dbFile: ':memory:' }), secureCookies: false });
    expect(JSON.parse((await app.inject({ method: 'GET', url: '/api/health' })).body)).toEqual({ ok: true, version: APP_VERSION });
  });

  it('finds a plain-HTTP server and confirms the version', async () => {
    app = await buildApp({ db: openDb(':memory:'), cfg: loadConfig({ dataDir: dir, dbFile: ':memory:' }), secureCookies: false });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const port = (app.server.address() as { port: number }).port;
    const target = localHealthTarget({ host: '0.0.0.0', port, tlsDir: path.join(dir, 'no-tls') });
    expect(target.url).toBe(`http://127.0.0.1:${port}/api/health`);
    expect(await waitForHealthy(target, { timeoutMs: 3000, expectVersion: APP_VERSION })).toEqual({ status: 'up', version: APP_VERSION });
    expect(await waitForHealthy(target, { timeoutMs: 600, pollMs: 200, expectVersion: '0.0.0-old' })).toEqual({ status: 'wrong-version', version: APP_VERSION });
  });

  it('uses HTTPS verified against the clinic CA when a certificate is set up', async () => {
    const cfg = loadConfig({ dataDir: dir, dbFile: ':memory:', tlsDir: path.join(dir, 'tls') });
    setupTls(cfg.tlsDir, 'a long clinic CA passphrase', { dns: ['clinic-pc'], ips: ['192.168.1.20'] });
    app = await buildApp({ db: openDb(':memory:'), cfg, secureCookies: true, tls: loadTls(cfg) });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const port = (app.server.address() as { port: number }).port;
    const target = localHealthTarget({ host: '127.0.0.1', port, tlsDir: cfg.tlsDir });
    expect(target.url).toBe(`https://127.0.0.1:${port}/api/health`);
    expect(target.ca).toBeDefined();
    expect((await waitForHealthy(target, { timeoutMs: 3000 })).status).toBe('up');

    // A server whose certificate is from a different CA is not accepted as ours.
    const other = path.join(dir, 'other-tls');
    setupTls(other, 'a long clinic CA passphrase', { dns: ['clinic-pc'], ips: ['192.168.1.20'] });
    const wrongCa = { ...target, ca: fs.readFileSync(path.join(other, 'ca.crt')) };
    expect((await waitForHealthy(wrongCa, { timeoutMs: 600, pollMs: 200 })).status).toBe('down');
  });

  it('reports down, with the reason, when nothing is listening', async () => {
    const r = await waitForHealthy({ url: 'http://127.0.0.1:1/api/health' }, { timeoutMs: 500, pollMs: 200 });
    expect(r.status).toBe('down');
  });
});
