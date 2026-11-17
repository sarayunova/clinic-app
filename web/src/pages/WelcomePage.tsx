import { useState } from 'react';

/**
 * The page a new staff device lands on from the QR code (/welcome). It is shown without signing in, because
 * the device cannot sign in safely until it trusts the clinic's certificate. It holds no patient data and
 * only links to the public CA certificate. It deliberately does not show the certificate fingerprint: if this
 * page were being impersonated, a fingerprint shown here would be the impersonator's. The fingerprint to
 * compare against is the one on the clinic computer's screen or the printed sheet.
 */

type Device = 'ios' | 'android' | 'windows' | 'mac' | 'other';

function detectDevice(): Device {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Windows/.test(ua)) return 'windows';
  if (/Macintosh/.test(ua)) return 'mac';
  return 'other';
}

const DEVICE_NAMES: Record<Device, string> = {
  ios: 'iPhone / iPad',
  android: 'Android phone or tablet',
  windows: 'Windows PC',
  mac: 'Mac',
  other: 'Other device',
};

function InstallSteps({ device }: { device: Device }) {
  switch (device) {
    case 'ios':
      return (
        <ol>
          <li>Tap <strong>Download the clinic certificate</strong> above, then <strong>Allow</strong>. It says <em>Profile Downloaded</em>.</li>
          <li>Open <strong>Settings</strong> and tap <strong>Profile Downloaded</strong> near the top.</li>
          <li>Before installing, tap <strong>More Details</strong> → <strong>Clinic Local CA</strong> and compare the <strong>SHA-256</strong> fingerprint. Only if it matches: go back and tap <strong>Install</strong> (enter the device passcode).</li>
          <li>Go to <strong>Settings → General → About → Certificate Trust Settings</strong> and switch on <strong>Clinic Local CA</strong>.</li>
        </ol>
      );
    case 'android':
      return (
        <ol>
          <li>Tap <strong>Download the clinic certificate</strong> above.</li>
          <li>Open <strong>Settings</strong> and search for <strong>CA certificate</strong> (usually <em>Security → Encryption &amp; credentials → Install a certificate → CA certificate</em>).</li>
          <li>Tap <strong>Install anyway</strong>, then choose the downloaded <code>clinic-ca.crt</code>. The warning is expected: you are trusting the clinic&apos;s own certificate.</li>
          <li>
            Android only shows the fingerprint after installing, so check it straight away: <em>Encryption &amp; credentials → Trusted
            credentials → User → Clinic Local CA</em>, SHA-256. If it does not match, tap <strong>Remove</strong> there and stop.
          </li>
        </ol>
      );
    case 'windows':
      return (
        <ol>
          <li>Click <strong>Download the clinic certificate</strong> above and open the downloaded <code>clinic-ca.crt</code>.</li>
          <li>Check the fingerprint first: <strong>Details</strong> tab → <strong>Thumbprint</strong> (this is the SHA-1 fingerprint).</li>
          <li>Back on <strong>General</strong>: <strong>Install Certificate</strong> → <strong>Local Machine</strong> (or Current User) → <strong>Place all certificates in the following store</strong> → <strong>Trusted Root Certification Authorities</strong> → Finish.</li>
        </ol>
      );
    case 'mac':
      return (
        <ol>
          <li>Click <strong>Download the clinic certificate</strong> above and open the downloaded file. It opens in <strong>Keychain Access</strong>; add it to the <strong>System</strong> keychain.</li>
          <li>Double-click <strong>Clinic Local CA</strong>, check the SHA-256 fingerprint, open <strong>Trust</strong> and set <strong>When using this certificate</strong> to <strong>Always Trust</strong>.</li>
        </ol>
      );
    default:
      return <p>Install the downloaded certificate as a trusted <strong>root / CA certificate</strong> using your device&apos;s settings, and check its fingerprint.</p>;
  }
}

function HomeScreenSteps({ device }: { device: Device }) {
  switch (device) {
    case 'ios':
      return <p>In Safari, tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>.</p>;
    case 'android':
      return <p>In Chrome, tap the <strong>⋮</strong> menu, then <strong>Add to Home screen</strong> (or <strong>Install app</strong>).</p>;
    case 'windows':
    case 'mac':
      return <p>In Chrome or Edge, use the <strong>install</strong> icon at the right of the address bar, or the menu → <strong>Apps → Install this site as an app</strong>. Or simply bookmark this address.</p>;
    default:
      return <p>Use your browser&apos;s <strong>Add to Home screen</strong> or bookmark option.</p>;
  }
}

export function WelcomePage() {
  const [device, setDevice] = useState<Device>(detectDevice);
  const here = `${window.location.protocol}//${window.location.host}`;

  return (
    <div className="page narrow" style={{ padding: '1rem' }}>
      <h1>Set up this device for the clinic app</h1>
      <p className="muted">
        This takes about two minutes, once per device. Only do it on a phone, tablet or computer the clinic controls.
      </p>

      <div className="row wrap" style={{ gap: '0.4rem', margin: '0.75rem 0' }} role="group" aria-label="Device type">
        {(Object.keys(DEVICE_NAMES) as Device[]).map((d) => (
          <button key={d} type="button" className={`btn small ${d === device ? 'primary' : ''}`} aria-pressed={d === device} onClick={() => setDevice(d)}>
            {DEVICE_NAMES[d]}
          </button>
        ))}
      </div>

      <section className="card stack">
        <h2>1. Trust the clinic&apos;s certificate</h2>
        <p className="muted small">
          This lets the browser confirm it is talking to the real clinic computer and encrypt everything on the way. The file contains no secrets.
        </p>
        <div><a className="btn primary" href="/api/tls/ca.crt" download="clinic-ca.crt">Download the clinic certificate</a></div>
        <InstallSteps device={device} />
        <div className="banner warn" role="note">
          <strong>Always check the fingerprint.</strong> Compare the fingerprint your device shows with the one on the clinic
          computer&apos;s <em>Connect a device</em> page or the printed setup sheet. If they differ in any character, do not trust (or
          remove) the certificate and tell whoever looks after the clinic computer. Do not go by a fingerprint shown on this page or
          sent in a message.
        </div>
      </section>

      <section className="card stack">
        <h2>2. Reopen the app</h2>
        <p>
          Close the browser completely, open it again and go to <strong>{here}</strong>. There should be a padlock and no warning. If there is
          still a warning, the certificate was not installed as trusted: repeat step 1.
        </p>
      </section>

      <section className="card stack">
        <h2>3. Put it on the home screen (optional)</h2>
        <HomeScreenSteps device={device} />
        <p className="muted small">Nothing is stored on the device for offline use; the app always loads from the clinic computer.</p>
      </section>

      <p><a className="btn" href="/">Go to sign in</a></p>
    </div>
  );
}
