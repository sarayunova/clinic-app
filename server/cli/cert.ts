import { ConfigError, loadConfig } from '../config.js';
import { MIN_CA_PASSPHRASE, TlsError, defaultNames, loadTls, setupTls } from '../tls.js';

const args = process.argv.slice(2);
const values = (flag: string) => args.flatMap((a, i) => (a === flag && args[i + 1] ? [args[i + 1]!] : []));
const usage = `Usage: npm run cert -- [--name <computer-name>]... [--ip <address>]...
  Creates (first time) the clinic's private certificate authority and issues the server certificate.
  Without --name/--ip it uses this computer's name and its current network addresses.
  Needs the environment variable CLINIC_CA_PASSPHRASE (at least ${MIN_CA_PASSPHRASE} characters): it protects the CA key.
  Run it again to renew the certificate or to add a new name or address (the same passphrase is required).`;

if (args.includes('--help')) {
  console.log(usage);
  process.exit(0);
}
let cfg;
try {
  cfg = loadConfig();
} catch (e) {
  console.error(e instanceof ConfigError ? e.message : e);
  process.exit(1);
}
const passphrase = process.env.CLINIC_CA_PASSPHRASE;
if (!passphrase) {
  console.error(`CLINIC_CA_PASSPHRASE is not set.\n${usage}`);
  process.exit(2);
}
const def = defaultNames();
const names = {
  dns: values('--name').length ? values('--name') : def.dns,
  ips: values('--ip').length ? values('--ip') : def.ips,
};
try {
  const r = setupTls(cfg.tlsDir, passphrase, names);
  const info = loadTls(cfg)!.info;
  console.log(r.createdCa ? 'Created the clinic certificate authority.' : 'Used the existing clinic certificate authority.');
  console.log(`Server certificate issued for: ${[...names.dns, ...names.ips].join(', ')}`);
  console.log(`Valid until ${new Date(info.notAfter).toDateString()} (${info.daysLeft} days).`);
  console.log(`\nFolder: ${cfg.tlsDir}`);
  console.log('  ca.crt       install this on every staff device (it is public)');
  console.log('  server.crt   used by the app');
  console.log('  server.key   used by the app: keep it private');
  console.log('  ca.key.enc   the CA key, encrypted: copy this folder to a USB drive and keep the passphrase safe; needed only to renew');
  console.log('\nRestart the clinic app. Staff then open  https://' + (names.dns[0] ?? names.ips[0]) + ':' + cfg.port);
  if (names.ips.length === 0) console.log('Note: no IP address was found; devices must use the computer name.');
  console.log('If this computer IP address can change, give it a fixed address in the router, or the certificate will stop matching.');
} catch (e) {
  console.error(e instanceof TlsError ? e.message : e);
  process.exitCode = 1;
}
