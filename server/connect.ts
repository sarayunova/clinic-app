import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import type { Config } from './config.js';
import { tlsFiles, type LoadedTls } from './tls.js';

/**
 * Staff-device onboarding: which addresses other devices on the clinic network can use to reach this server.
 *
 * Only private addresses are ever offered (and so ever put in a QR code): this app must never be pointed at,
 * or advertise, anything reachable from the internet. An address is offered only if it is on the server
 * certificate (so the browser will trust it once the clinic CA is installed) and is private:
 *  - IPv4 in 10/8, 172.16/12 or 192.168/16 (RFC 1918). Loopback is excluded: it means "this device" on the
 *    tablet, not the clinic computer. Link-local (169.254/16) is excluded: it changes when the network does.
 *  - A single-label computer name (e.g. "clinic-pc") or a name under a local-only suffix (.local, .lan,
 *    .home.arpa, .internal). Any other dotted name could be a public DNS name and is not offered.
 * IPv6 is not offered (clinic routers hand out changing addresses, and they are hard to type).
 */

const LOCAL_SUFFIXES = ['.local', '.lan', '.home.arpa', '.internal'];

export function isPrivateIPv4(ip: string): boolean {
  if (net.isIPv4(ip) === false) return false;
  const [a, b] = ip.split('.').map(Number) as [number, number, number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function isLocalHostname(name: string): boolean {
  const n = name.toLowerCase().replace(/\.$/, '');
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/.test(n)) return false;
  if (n === 'localhost' || n.endsWith('.localhost')) return false;
  if (!n.includes('.')) return true;
  return LOCAL_SUFFIXES.some((s) => n.endsWith(s));
}

export interface ConnectUrl {
  url: string;
  kind: 'ip' | 'name';
}

/** The private https:// addresses for the given certificate names, IP addresses first (they work on every device). */
export function privateConnectUrls(certNames: string[], port: number): ConnectUrl[] {
  const portPart = port === 443 ? '' : `:${port}`;
  const ips = certNames.filter(isPrivateIPv4).map((h) => ({ url: `https://${h}${portPart}`, kind: 'ip' as const }));
  const names = certNames
    .filter((n) => !net.isIP(n) && isLocalHostname(n))
    .map((h) => ({ url: `https://${h.toLowerCase()}${portPart}`, kind: 'name' as const }));
  const seen = new Set<string>();
  return [...ips, ...names].filter((u) => (seen.has(u.url) ? false : (seen.add(u.url), true)));
}

export interface CaFingerprint {
  sha256: string;
  /** Windows' certificate dialog shows only this one ("Thumbprint"), so it is given too. */
  sha1: string;
}

/**
 * Fingerprints of the clinic CA certificate (colon-separated upper-case hex, as Windows, Android and iOS show
 * them), so a person can confirm the file a device downloaded is the real one and not a substitute.
 */
export function caFingerprint(tlsDir: string): CaFingerprint | null {
  const file = tlsFiles(tlsDir).caCert;
  if (!fs.existsSync(file)) return null;
  const x = new crypto.X509Certificate(fs.readFileSync(file));
  return { sha256: x.fingerprint256, sha1: x.fingerprint };
}

export interface ConnectInfo {
  ready: boolean;
  /** Why devices cannot connect yet, when not ready. */
  reason: string | null;
  urls: ConnectUrl[];
  caFingerprint: CaFingerprint | null;
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

export function connectInfo(cfg: Pick<Config, 'host' | 'port' | 'tlsDir'>, tls: LoadedTls | null): ConnectInfo {
  const fingerprint = caFingerprint(cfg.tlsDir);
  const notReady = (reason: string): ConnectInfo => ({ ready: false, reason, urls: [], caFingerprint: fingerprint });
  if (!tls) return notReady('HTTPS is not set up yet, so other devices cannot connect safely. Follow docs/HTTPS-SETUP.md on this computer first.');
  if (LOOPBACK.has(cfg.host)) {
    return notReady('The app only accepts connections from this computer. To let staff devices connect, start it listening on the network (see "Start the app listening on the network" in docs/HTTPS-SETUP.md).');
  }
  if (!fingerprint) return notReady('The clinic certificate (ca.crt) is missing from the tls folder, so devices cannot be set up to trust this server. Run the cert command again.');
  const urls = privateConnectUrls(tls.info.names, cfg.port);
  if (urls.length === 0) {
    return notReady("The HTTPS certificate does not name any private network address of this computer. Re-run the cert command with this computer's reserved address (--ip) and restart.");
  }
  return { ready: true, reason: null, urls, caFingerprint: fingerprint };
}
