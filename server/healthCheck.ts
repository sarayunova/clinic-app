import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import type { Config } from './config.js';
import { tlsFiles } from './tls.js';

export interface HealthTarget {
  url: string;
  /** The clinic CA, when HTTPS is set up: the server's certificate must chain to it. */
  ca?: Buffer;
}

/**
 * Where this computer's own clinic server answers. Always a loopback or the configured local address,
 * never anything else. Uses HTTPS (verified against the clinic CA) when a certificate is set up.
 */
export function localHealthTarget(cfg: Pick<Config, 'host' | 'port' | 'tlsDir'>): HealthTarget {
  const anyAddress = cfg.host === '0.0.0.0' || cfg.host === '::' || cfg.host === '';
  const host = anyAddress ? '127.0.0.1' : cfg.host.includes(':') ? `[${cfg.host}]` : cfg.host;
  const f = tlsFiles(cfg.tlsDir);
  const tlsOn = fs.existsSync(f.cert) && fs.existsSync(f.key);
  return {
    url: `${tlsOn ? 'https' : 'http'}://${host}:${cfg.port}/api/health`,
    ca: tlsOn && fs.existsSync(f.caCert) ? fs.readFileSync(f.caCert) : undefined,
  };
}

function getOnce(t: HealthTarget, timeoutMs: number): Promise<{ ok: boolean; version: string | null }> {
  return new Promise((resolve, reject) => {
    const isHttps = t.url.startsWith('https:');
    const opts: https.RequestOptions = { timeout: timeoutMs };
    if (isHttps) {
      // The certificate must be issued by the clinic CA. Its host name is not checked: this only ever
      // connects to this computer's own loopback/local address, which need not be one of the names on it.
      Object.assign(opts, t.ca ? { ca: t.ca, checkServerIdentity: () => undefined } : { rejectUnauthorized: false });
    }
    const req = (isHttps ? https : http).get(t.url, opts, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(body) as { ok?: unknown; version?: unknown };
          resolve({ ok: res.statusCode === 200 && j.ok === true, version: typeof j.version === 'string' ? j.version : null });
        } catch {
          resolve({ ok: false, version: null });
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

export type HealthOutcome =
  | { status: 'up'; version: string | null }
  | { status: 'wrong-version'; version: string | null }
  | { status: 'down'; lastError: string };

/**
 * Polls the server's /api/health until it answers ok or the time runs out. With expectVersion set, an
 * answer from a different version (an old process still running after an upgrade) keeps polling, and is
 * reported as 'wrong-version' if it is still the case at the end.
 */
export async function waitForHealthy(t: HealthTarget, opts: { timeoutMs: number; pollMs?: number; expectVersion?: string }): Promise<HealthOutcome> {
  const deadline = Date.now() + opts.timeoutMs;
  const pollMs = opts.pollMs ?? 1000;
  let last: HealthOutcome = { status: 'down', lastError: 'no answer yet' };
  for (;;) {
    try {
      const r = await getOnce(t, Math.min(5000, Math.max(500, deadline - Date.now())));
      if (r.ok) {
        if (!opts.expectVersion || r.version === opts.expectVersion) return { status: 'up', version: r.version };
        last = { status: 'wrong-version', version: r.version };
      } else {
        last = { status: 'down', lastError: 'the server answered but did not report itself healthy' };
      }
    } catch (e) {
      last = { status: 'down', lastError: (e as Error).message };
    }
    if (Date.now() + pollMs > deadline) return last;
    await new Promise((r) => setTimeout(r, pollMs));
  }
}
