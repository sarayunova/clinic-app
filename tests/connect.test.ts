import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../server/app.js';
import { loadConfig, type Config } from '../server/config.js';
import { connectInfo, isLocalHostname, isPrivateIPv4, privateConnectUrls } from '../server/connect.js';
import { openDb } from '../server/db.js';
import { loadTls, setupTls, tlsFiles } from '../server/tls.js';

const CA_PASS = 'a long clinic CA passphrase';
const PW = 'correct-horse-battery';

describe('which addresses may be offered to staff devices', () => {
  it('accepts only RFC 1918 IPv4, never loopback, link-local or public addresses', () => {
    for (const ip of ['10.0.0.5', '172.16.0.1', '172.31.255.254', '192.168.1.20']) expect(isPrivateIPv4(ip), ip).toBe(true);
    for (const ip of ['127.0.0.1', '169.254.10.1', '172.15.0.1', '172.32.0.1', '8.8.8.8', '192.169.1.1', '::1', 'fd00::1', 'clinic-pc'])
      expect(isPrivateIPv4(ip), ip).toBe(false);
  });

  it('accepts single-label computer names and local-only suffixes, never public-looking DNS names or localhost', () => {
    for (const n of ['clinic-pc', 'CLINIC-PC', 'clinic-pc.local', 'reception.lan', 'pc.home.arpa', 'srv.internal']) expect(isLocalHostname(n), n).toBe(true);
    for (const n of ['localhost', 'clinic.example.com', 'clinic.in', 'evil.local.example.com', 'bad_name', '-x', '']) expect(isLocalHostname(n), n).toBe(false);
  });

  it('builds https URLs, IP addresses first, dropping anything not private and omitting :443', () => {
    const names = ['clinic-pc', '127.0.0.1', '192.168.1.20', 'clinic.example.com', '8.8.8.8', '::1'];
    expect(privateConnectUrls(names, 3080)).toEqual([
      { url: 'https://192.168.1.20:3080', kind: 'ip' },
      { url: 'https://clinic-pc:3080', kind: 'name' },
    ]);
    expect(privateConnectUrls(['192.168.1.20'], 443)).toEqual([{ url: 'https://192.168.1.20', kind: 'ip' }]);
  });
});

describe('connect info', () => {
  let dir: string;
  let cfg: Config;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clinic-connect-test-'));
    cfg = loadConfig({ dataDir: dir, dbFile: ':memory:', tlsDir: path.join(dir, 'tls'), host: '0.0.0.0', port: 3080 });
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('offers nothing without HTTPS, or when listening only on this computer', () => {
    const noTls = connectInfo(cfg, null);
    expect(noTls).toMatchObject({ ready: false, urls: [] });
    expect(noTls.reason).toMatch(/HTTPS is not set up/);

    setupTls(cfg.tlsDir, CA_PASS, { dns: ['clinic-pc'], ips: ['192.168.1.20'] });
    const loopback = connectInfo({ ...cfg, host: '127.0.0.1' }, loadTls(cfg));
    expect(loopback).toMatchObject({ ready: false, urls: [] });
    expect(loopback.reason).toMatch(/only accepts connections from this computer/);
  });

  it('offers nothing when the certificate names no private address', () => {
    setupTls(cfg.tlsDir, CA_PASS, { dns: ['clinic.example.com'], ips: ['127.0.0.1'] });
    const r = connectInfo(cfg, loadTls(cfg));
    expect(r).toMatchObject({ ready: false, urls: [] });
    expect(r.reason).toMatch(/does not name any private network address/);
  });

  it('offers the private certificate addresses and the real CA fingerprints', () => {
    setupTls(cfg.tlsDir, CA_PASS, { dns: ['clinic-pc'], ips: ['127.0.0.1', '192.168.1.20'] });
    const r = connectInfo(cfg, loadTls(cfg));
    expect(r.ready).toBe(true);
    expect(r.urls.map((u) => u.url)).toEqual(['https://192.168.1.20:3080', 'https://clinic-pc:3080']);
    const ca = new crypto.X509Certificate(fs.readFileSync(tlsFiles(cfg.tlsDir).caCert));
    expect(r.caFingerprint).toEqual({ sha256: ca.fingerprint256, sha1: ca.fingerprint });
    expect(r.caFingerprint!.sha256).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  });

  it('is shown to the doctor only', async () => {
    setupTls(cfg.tlsDir, CA_PASS, { dns: ['clinic-pc'], ips: ['192.168.1.20'] });
    const app = await buildApp({ db: openDb(':memory:'), cfg, secureCookies: false, tls: loadTls(cfg) });
    try {
      expect((await app.inject({ method: 'GET', url: '/api/connect-info' })).statusCode).toBe(401);
      const setup = await app.inject({ method: 'POST', url: '/api/setup', payload: { username: 'dr.rao', fullName: 'Dr Rao', password: PW } });
      const doctor = String(setup.headers['set-cookie']).split(';')[0]!;
      const res = await app.inject({ method: 'GET', url: '/api/connect-info', headers: { cookie: doctor } });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toMatchObject({ ready: true, urls: [{ url: 'https://192.168.1.20:3080' }, { url: 'https://clinic-pc:3080' }] });

      await app.inject({ method: 'POST', url: '/api/users', headers: { cookie: doctor }, payload: { username: 'desk', fullName: 'Front Desk', role: 'attender', password: PW } });
      const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'desk', password: PW } });
      const desk = String(login.headers['set-cookie']).split(';')[0]!;
      // Change the first-login password, so the 403 below is the permission check and not "change your password first".
      const changed = await app.inject({ method: 'POST', url: '/api/auth/change-password', headers: { cookie: desk }, payload: { currentPassword: PW, newPassword: 'another-long-password-9' } });
      expect(changed.statusCode).toBe(200);
      const denied = await app.inject({ method: 'GET', url: '/api/connect-info', headers: { cookie: desk } });
      expect(denied.statusCode).toBe(403);
      expect(denied.body).not.toMatch(/password_change_required/);
    } finally {
      await app.close();
    }
  });
});
