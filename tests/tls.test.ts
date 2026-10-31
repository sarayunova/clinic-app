import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app.js';
import { loadConfig, type Config } from '../server/config.js';
import { openDb } from '../server/db.js';
import { TlsError, checkListenSafety, loadTls, setupTls, tlsFiles, tlsStatus } from '../server/tls.js';

const CA_PASS = 'a long clinic CA passphrase';
const PW = 'correct-horse-battery';
const NAMES = { dns: ['clinic-pc'], ips: ['127.0.0.1', '192.168.1.20'] };

let dir: string;
let cfg: Config;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clinic-tls-test-'));
  cfg = loadConfig({ dataDir: dir, dbFile: ':memory:', tlsDir: path.join(dir, 'tls') });
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('certificate authority and server certificate', () => {
  it('issues a server certificate that chains to the clinic CA and names the right hosts', () => {
    const r = setupTls(cfg.tlsDir, CA_PASS, NAMES);
    expect(r.createdCa).toBe(true);
    const f = tlsFiles(cfg.tlsDir);
    const ca = new crypto.X509Certificate(fs.readFileSync(f.caCert));
    const server = new crypto.X509Certificate(fs.readFileSync(f.cert));
    expect(ca.ca).toBe(true);
    expect(server.ca).toBe(false);
    expect(server.checkIssued(ca)).toBe(true);
    expect(server.verify(ca.publicKey)).toBe(true);
    expect(server.checkPrivateKey(crypto.createPrivateKey(fs.readFileSync(f.key)))).toBe(true);
    expect(server.subjectAltName).toContain('DNS:clinic-pc');
    expect(server.subjectAltName).toContain('IP Address:192.168.1.20');
    expect(server.checkHost('clinic-pc')).toBeTruthy();
    expect(server.checkHost('someone-else.example')).toBeUndefined();
    const days = (new Date(server.validTo).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(700);
    expect(days).toBeLessThan(740);
  });

  it('stores the CA key encrypted, and only the server key unencrypted', () => {
    setupTls(cfg.tlsDir, CA_PASS, NAMES);
    const f = tlsFiles(cfg.tlsDir);
    expect(fs.readFileSync(f.caKey, 'utf8')).toContain('BEGIN ENCRYPTED PRIVATE KEY');
    expect(() => crypto.createPrivateKey(fs.readFileSync(f.caKey))).toThrow();
    expect(fs.readFileSync(f.caCert, 'utf8')).not.toContain('PRIVATE KEY');
  });

  it('renews under the same CA, so devices that trust the CA keep working', () => {
    setupTls(cfg.tlsDir, CA_PASS, NAMES);
    const f = tlsFiles(cfg.tlsDir);
    const caBefore = fs.readFileSync(f.caCert, 'utf8');
    const certBefore = fs.readFileSync(f.cert, 'utf8');
    const r = setupTls(cfg.tlsDir, CA_PASS, { dns: ['clinic-pc', 'reception-pc'], ips: [] });
    expect(r.createdCa).toBe(false);
    expect(fs.readFileSync(f.caCert, 'utf8')).toBe(caBefore);
    expect(fs.readFileSync(f.cert, 'utf8')).not.toBe(certBefore);
    const ca = new crypto.X509Certificate(caBefore);
    const server = new crypto.X509Certificate(fs.readFileSync(f.cert));
    expect(server.verify(ca.publicKey)).toBe(true);
    expect(server.checkHost('reception-pc')).toBeTruthy();
  });

  it('refuses a wrong CA passphrase when renewing, a short passphrase, and an empty name list', () => {
    expect(() => setupTls(cfg.tlsDir, 'short', NAMES)).toThrow(TlsError);
    setupTls(cfg.tlsDir, CA_PASS, NAMES);
    expect(() => setupTls(cfg.tlsDir, 'not the right passphrase', NAMES)).toThrow(/wrong CA passphrase/);
    expect(() => setupTls(cfg.tlsDir, CA_PASS, { dns: [], ips: [] })).toThrow(TlsError);
  });
});

describe('loading and safety checks', () => {
  it('reports no HTTPS before setup and loads the certificate after', () => {
    expect(loadTls(cfg)).toBeNull();
    setupTls(cfg.tlsDir, CA_PASS, NAMES);
    const t = loadTls(cfg)!;
    expect(t.info.names).toEqual(expect.arrayContaining(['clinic-pc', '192.168.1.20']));
    expect(t.info.daysLeft).toBeGreaterThan(700);
  });

  it('rejects a half-set-up folder and a certificate that does not match its key', () => {
    setupTls(cfg.tlsDir, CA_PASS, NAMES);
    const f = tlsFiles(cfg.tlsDir);
    const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
    fs.writeFileSync(f.key, other);
    expect(() => loadTls(cfg)).toThrow(/do not match/);
    fs.rmSync(f.key);
    expect(() => loadTls(cfg)).toThrow(/half set up/);
  });

  it('refuses to listen on the network without HTTPS unless explicitly overridden', () => {
    expect(checkListenSafety('127.0.0.1', false, false)).toBeNull();
    expect(checkListenSafety('localhost', false, false)).toBeNull();
    expect(checkListenSafety('0.0.0.0', true, false)).toBeNull();
    expect(() => checkListenSafety('0.0.0.0', false, false)).toThrow(/Refusing to listen/);
    expect(() => checkListenSafety('192.168.1.20', false, false)).toThrow(TlsError);
    expect(checkListenSafety('0.0.0.0', false, true)).toMatch(/WITHOUT HTTPS/);
  });

  it('warns about network exposure without HTTPS and about a certificate close to expiry', () => {
    expect(tlsStatus(null, '0.0.0.0').warnings[0]).toMatch(/without HTTPS/);
    expect(tlsStatus(null, '127.0.0.1').warnings).toEqual([]);
    setupTls(cfg.tlsDir, CA_PASS, NAMES);
    const t = loadTls(cfg)!;
    expect(tlsStatus(t, '0.0.0.0').warnings).toEqual([]);
    expect(tlsStatus({ ...t, info: { ...t.info, daysLeft: 10 } }, '0.0.0.0').warnings[0]).toMatch(/expires in 10 days/);
  });
});

describe('serving over HTTPS', () => {
  let app: FastifyInstance;
  let port: number;
  let caPem: string;
  beforeEach(async () => {
    setupTls(cfg.tlsDir, CA_PASS, NAMES);
    caPem = fs.readFileSync(tlsFiles(cfg.tlsDir).caCert, 'utf8');
    const tls = loadTls(cfg)!;
    app = await buildApp({ db: openDb(':memory:'), cfg, secureCookies: true, tls });
    await app.listen({ host: '127.0.0.1', port: 0 });
    port = (app.server.address() as { port: number }).port;
  });
  afterEach(async () => {
    await app.close();
  });

  const get = (opts: https.RequestOptions, urlPath = '/api/health') =>
    new Promise<{ status: number; headers: Record<string, unknown>; body: string }>((resolve, reject) => {
      https
        .get({ host: '127.0.0.1', port, path: urlPath, ...opts }, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
        })
        .on('error', reject);
    });

  it('is trusted by a client that has installed the clinic CA, for both the name and the IP address', async () => {
    const byName = await get({ ca: caPem, servername: 'clinic-pc' });
    expect(byName.status).toBe(200);
    expect(byName.headers['strict-transport-security']).toBe('max-age=86400');
    expect((await get({ ca: caPem })).status).toBe(200); // by IP address
  });

  it('is not trusted without the CA, under a different CA, or for a name it was not issued for', async () => {
    await expect(get({})).rejects.toThrow(/self[- ]signed|unable to|certificate/i);
    const otherDir = path.join(dir, 'other');
    setupTls(otherDir, CA_PASS, NAMES);
    const otherCa = fs.readFileSync(tlsFiles(otherDir).caCert, 'utf8');
    await expect(get({ ca: otherCa, servername: 'clinic-pc' })).rejects.toThrow();
    await expect(get({ ca: caPem, servername: 'evil.example' })).rejects.toThrow(/altnames|hostname|match/i);
  });

  it('does not accept plain HTTP on the same port', async () => {
    const http = await import('node:http');
    await expect(
      new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port, path: '/api/health' }, resolve).on('error', reject);
      }),
    ).rejects.toThrow();
  });

  it('marks the session cookie Secure', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/setup', payload: { username: 'dr.rao', fullName: 'Dr Rao', password: PW } });
    expect(String(res.headers['set-cookie'])).toMatch(/Secure/);
    expect(String(res.headers['set-cookie'])).toMatch(/HttpOnly/);
  });

  it('serves only the public CA certificate for download, and security status to the doctor only', async () => {
    const ca = await app.inject({ method: 'GET', url: '/api/tls/ca.crt' });
    expect(ca.statusCode).toBe(200);
    expect(ca.body).toBe(caPem);
    expect(ca.body).not.toContain('PRIVATE KEY');

    expect((await app.inject({ method: 'GET', url: '/api/security' })).statusCode).toBe(401);
    const setup = await app.inject({ method: 'POST', url: '/api/setup', payload: { username: 'dr.rao', fullName: 'Dr Rao', password: PW } });
    const cookie = String(setup.headers['set-cookie']).split(';')[0]!;
    const st = JSON.parse((await app.inject({ method: 'GET', url: '/api/security', headers: { cookie } })).body);
    expect(st).toMatchObject({ https: true, caAvailable: true });
    expect(st.cert.names).toContain('clinic-pc');
  });
});
