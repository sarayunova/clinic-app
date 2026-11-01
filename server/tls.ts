import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import forge from 'node-forge';
import type { Config } from './config.js';

/**
 * Private HTTPS for the clinic network.
 *
 * A small "clinic CA" is created once. Its certificate (ca.crt) is installed on each staff device so the
 * browser trusts the server. The server itself only needs server.crt + server.key, issued by that CA and
 * valid for the computer name and IP address. The CA private key is stored encrypted (ca.key.enc) and is
 * only needed to issue or renew the server certificate: keep a copy of the folder, and its passphrase, off the server.
 */
export const MIN_CA_PASSPHRASE = 12;
const CA_YEARS = 10;
const SERVER_DAYS = 730;

export class TlsError extends Error {}

export const tlsFiles = (dir: string) => ({
  caCert: path.join(dir, 'ca.crt'),
  caKey: path.join(dir, 'ca.key.enc'),
  cert: path.join(dir, 'server.crt'),
  key: path.join(dir, 'server.key'),
});

const forgePrivate = (k: crypto.KeyObject) => forge.pki.privateKeyFromPem(k.export({ type: 'pkcs8', format: 'pem' }) as string);
const forgePublic = (k: crypto.KeyObject) => forge.pki.publicKeyFromPem(crypto.createPublicKey(k).export({ type: 'spki', format: 'pem' }) as string);
const serial = () => '0' + crypto.randomBytes(15).toString('hex'); // positive, 16 bytes
const newKey = () => crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;

export interface CertNames {
  dns: string[];
  ips: string[];
}

/** The computer name and its LAN addresses: what staff devices will type to reach it. */
export function defaultNames(): CertNames {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  return { dns: [os.hostname().toLowerCase()], ips };
}

export function createCa(passphrase: string, commonName = 'Clinic Local CA'): { certPem: string; encryptedKeyPem: string } {
  if (passphrase.length < MIN_CA_PASSPHRASE) throw new TlsError(`The CA passphrase must be at least ${MIN_CA_PASSPHRASE} characters`);
  const key = newKey();
  const cert = forge.pki.createCertificate();
  cert.publicKey = forgePublic(key);
  cert.serialNumber = serial();
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + CA_YEARS * 365 * 86_400_000);
  const subject = [
    { name: 'commonName', value: commonName },
    { name: 'organizationName', value: 'Clinic (private network)' },
  ];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.setExtensions([
    { name: 'basicConstraints', cA: true, pathLenConstraint: 0, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    { name: 'subjectKeyIdentifier' },
  ]);
  cert.sign(forgePrivate(key), forge.md.sha256.create());
  return {
    certPem: forge.pki.certificateToPem(cert),
    encryptedKeyPem: key.export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase }) as string,
  };
}

export function issueServerCert(caCertPem: string, caKeyEncryptedPem: string, caPassphrase: string, names: CertNames): { certPem: string; keyPem: string } {
  if (names.dns.length + names.ips.length === 0) throw new TlsError('Give at least one computer name or IP address for the certificate');
  let caKey: crypto.KeyObject;
  try {
    caKey = crypto.createPrivateKey({ key: caKeyEncryptedPem, passphrase: caPassphrase });
  } catch {
    throw new TlsError('Could not open the CA key: wrong CA passphrase');
  }
  const caCert = forge.pki.certificateFromPem(caCertPem);
  const key = newKey();
  const cert = forge.pki.createCertificate();
  cert.publicKey = forgePublic(key);
  cert.serialNumber = serial();
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + SERVER_DAYS * 86_400_000);
  const cn = names.dns[0] ?? names.ips[0]!;
  cert.setSubject([{ name: 'commonName', value: cn }]);
  cert.setIssuer(caCert.subject.attributes);
  const altNames = [...names.dns.map((value) => ({ type: 2, value })), ...names.ips.map((ip) => ({ type: 7, ip }))];
  cert.setExtensions([
    { name: 'basicConstraints', cA: false, critical: true },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames },
    { name: 'subjectKeyIdentifier' },
    { name: 'authorityKeyIdentifier', keyIdentifier: caCert.generateSubjectKeyIdentifier().getBytes() },
  ]);
  cert.sign(forgePrivate(caKey), forge.md.sha256.create());
  return { certPem: forge.pki.certificateToPem(cert), keyPem: key.export({ type: 'pkcs8', format: 'pem' }) as string };
}

export interface SetupResult {
  createdCa: boolean;
  files: ReturnType<typeof tlsFiles>;
  names: CertNames;
}

/** Creates the CA if missing and (re)issues the server certificate. */
export function setupTls(dir: string, passphrase: string, names: CertNames): SetupResult {
  fs.mkdirSync(dir, { recursive: true });
  const f = tlsFiles(dir);
  let createdCa = false;
  if (!fs.existsSync(f.caCert) || !fs.existsSync(f.caKey)) {
    const ca = createCa(passphrase);
    fs.writeFileSync(f.caCert, ca.certPem);
    fs.writeFileSync(f.caKey, ca.encryptedKeyPem, { mode: 0o600 });
    createdCa = true;
  }
  const server = issueServerCert(fs.readFileSync(f.caCert, 'utf8'), fs.readFileSync(f.caKey, 'utf8'), passphrase, names);
  fs.writeFileSync(f.cert, server.certPem);
  fs.writeFileSync(f.key, server.keyPem, { mode: 0o600 });
  return { createdCa, files: f, names };
}

export interface TlsInfo {
  names: string[];
  notAfter: string;
  daysLeft: number;
}

export interface LoadedTls {
  key: Buffer;
  cert: Buffer;
  info: TlsInfo;
}

/** Reads the server certificate, or returns null if HTTPS has not been set up. Throws if it is set up but unusable. */
export function loadTls(cfg: Pick<Config, 'tlsDir'>): LoadedTls | null {
  const f = tlsFiles(cfg.tlsDir);
  if (!fs.existsSync(f.cert) && !fs.existsSync(f.key)) return null;
  if (!fs.existsSync(f.cert) || !fs.existsSync(f.key)) throw new TlsError(`HTTPS is half set up: both ${f.cert} and ${f.key} are needed`);
  const cert = fs.readFileSync(f.cert);
  const key = fs.readFileSync(f.key);
  let x: crypto.X509Certificate;
  try {
    x = new crypto.X509Certificate(cert);
    if (!x.checkPrivateKey(crypto.createPrivateKey(key))) throw new Error('mismatch');
  } catch {
    throw new TlsError('The HTTPS certificate and key do not match or cannot be read. Run "npm run cert" again.');
  }
  const notAfter = new Date(x.validTo);
  if (notAfter.getTime() < Date.now()) throw new TlsError(`The HTTPS certificate expired on ${notAfter.toDateString()}. Run "npm run cert" to issue a new one.`);
  const names = (x.subjectAltName ?? '')
    .split(',')
    .map((s) => s.trim().replace(/^(DNS|IP Address):/, ''))
    .filter(Boolean);
  return { key, cert, info: { names, notAfter: notAfter.toISOString(), daysLeft: Math.floor((notAfter.getTime() - Date.now()) / 86_400_000) } };
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

/** Refuses to expose patient data to the network without HTTPS, unless explicitly overridden. Returns a warning if overridden. */
export function checkListenSafety(host: string, tlsActive: boolean, allowInsecure: boolean): string | null {
  if (LOCAL_HOSTS.has(host) || tlsActive) return null;
  if (allowInsecure) {
    return 'WARNING: listening on the network WITHOUT HTTPS (CLINIC_ALLOW_INSECURE_LAN=1). Passwords and patient records can be read by anyone on the network. Do not use with real patient data.';
  }
  throw new TlsError(
    `Refusing to listen on ${host} without HTTPS: passwords and patient records would cross the network unencrypted.\n` +
      'Set up HTTPS first ("npm run cert"; see docs/HTTPS-SETUP.md), or set HOST=127.0.0.1 to use this computer only.',
  );
}

export interface SecurityStatus {
  https: boolean;
  reachableFromNetwork: boolean;
  cert: TlsInfo | null;
  warnings: string[];
}

export function tlsStatus(loaded: LoadedTls | null, host: string): SecurityStatus {
  const warnings: string[] = [];
  const reachable = !LOCAL_HOSTS.has(host);
  if (loaded && loaded.info.daysLeft < 30) warnings.push(`The HTTPS certificate expires in ${loaded.info.daysLeft} days. Run "npm run cert" to renew it before then.`);
  if (!loaded && reachable) warnings.push('The app is reachable from the network without HTTPS.');
  return { https: !!loaded, reachableFromNetwork: reachable, cert: loaded?.info ?? null, warnings };
}

// ---------- Plain-HTTP to HTTPS redirect ----------

/** The host name in a Host header, lower-cased, without port or IPv6 brackets. */
function hostnameOf(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^(\[[0-9a-f:.]+\]|[^:/\s]+)(?::\d+)?$/i.exec(header.trim());
  return m ? m[1]!.replace(/^\[|\]$/g, '').toLowerCase() : null;
}

/**
 * Answers every plain-HTTP request with a redirect to the same address over HTTPS. It only redirects to a name the
 * certificate is valid for, so a forged Host header cannot send someone to another site. Nothing else is served over HTTP.
 */
export function redirectHandler(certNames: string[], httpsPort: number): http.RequestListener {
  const allowed = new Set(certNames.map((n) => n.toLowerCase()));
  return (req, res) => {
    const host = hostnameOf(req.headers.host);
    if (!host || !allowed.has(host)) {
      res.writeHead(400, { 'content-type': 'text/plain' }).end('Use the clinic computer\'s https:// address.');
      return;
    }
    const target = `https://${host.includes(':') ? `[${host}]` : host}${httpsPort === 443 ? '' : `:${httpsPort}`}${req.url ?? '/'}`;
    // 308 keeps the request method; the location is built from validated parts only.
    res.writeHead(308, { location: target, 'content-type': 'text/plain' }).end(`Moved to ${target}`);
  };
}

export function startHttpRedirect(host: string, port: number, certNames: string[], httpsPort: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(redirectHandler(certNames, httpsPort));
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}
