import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ErrorBanner } from '../components/ui';
import { generateQrSvgDataUri } from '../qrSvg';

interface ConnectInfo {
  ready: boolean;
  reason: string | null;
  urls: { url: string; kind: 'ip' | 'name' }[];
  caFingerprint: { sha256: string; sha1: string } | null;
}

/** Breaks a long fingerprint into groups so it can be read aloud and compared by eye. */
function Fingerprint({ value }: { value: string }) {
  const pairs = value.split(':');
  const lines: string[] = [];
  for (let i = 0; i < pairs.length; i += 8) lines.push(pairs.slice(i, i + 8).join(':'));
  return (
    <code style={{ display: 'block', fontSize: '0.95rem', lineHeight: 1.5, wordBreak: 'break-all' }}>
      {lines.map((l) => <span key={l} style={{ display: 'block' }}>{l}</span>)}
    </code>
  );
}

/**
 * For the doctor: how staff devices reach this server. Shows a QR code for a private address on the
 * certificate (the server never offers anything else), and the certificate fingerprint to check against.
 * Printable, so a sheet can be kept by the clinic computer.
 */
export function ConnectDevicesPage() {
  const [info, setInfo] = useState<ConnectInfo | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [chosen, setChosen] = useState(0);
  useEffect(() => {
    api<ConnectInfo>('GET', '/api/connect-info').then(setInfo, setError);
  }, []);

  const target = info?.urls[chosen];
  const welcomeUrl = target ? `${target.url}/welcome` : null;

  return (
    <div className="page narrow">
      <p className="no-print"><Link to="/settings">← Clinic details</Link></p>
      <h1>Connect a staff device</h1>
      <ErrorBanner error={error} />
      {info === null && !error && <p className="muted">Loading…</p>}

      {info && !info.ready && (
        <div className="banner warn" role="alert">
          <strong>Devices cannot connect yet.</strong> {info.reason}
        </div>
      )}

      {info?.ready && target && welcomeUrl && (
        <>
          <p className="muted">
            On the phone or tablet, connect to the clinic Wi-Fi, then scan this code with the camera. It opens a page that walks
            through trusting the clinic certificate. Do this only on devices the clinic controls.
          </p>

          {info.urls.length > 1 && (
            <div className="row wrap no-print" style={{ gap: '0.4rem' }} role="group" aria-label="Address to use">
              {info.urls.map((u, i) => (
                <button key={u.url} type="button" className={`btn small ${i === chosen ? 'primary' : ''}`} aria-pressed={i === chosen} onClick={() => setChosen(i)}>
                  {u.url.replace('https://', '')}
                  {u.kind === 'ip' ? ' (works everywhere)' : ''}
                </button>
              ))}
            </div>
          )}

          <section className="card stack" style={{ textAlign: 'center' }}>
            <img src={generateQrSvgDataUri(welcomeUrl, 260)} width={260} height={260} alt={`QR code for ${welcomeUrl}`} style={{ display: 'block', margin: '0 auto' }} />
            <div>
              <div className="muted small">Or type this address into the browser:</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, wordBreak: 'break-all' }}>{welcomeUrl}</div>
            </div>
          </section>

          {info.caFingerprint && (
            <section className="card stack">
              <h2 style={{ margin: 0 }}>Certificate fingerprint</h2>
              <p className="muted small">
                Before trusting the certificate on a device, compare the fingerprint the device shows with this one. Every character
                must match. Android, iPhone and Mac show SHA-256; Windows shows SHA-1 as &ldquo;Thumbprint&rdquo;.
              </p>
              <div><strong>SHA-256</strong><Fingerprint value={info.caFingerprint.sha256} /></div>
              <div><strong>SHA-1 (Windows &ldquo;Thumbprint&rdquo;)</strong><Fingerprint value={info.caFingerprint.sha1} /></div>
            </section>
          )}

          <div className="row wrap no-print" style={{ gap: '0.5rem' }}>
            <button type="button" className="btn" onClick={() => window.print()}>Print this sheet</button>
            <a className="btn" href="/api/tls/ca.crt" download="clinic-ca.crt">Download the clinic certificate</a>
          </div>
          <p className="muted small">
            Keep a printed copy next to the clinic computer. It contains no passwords or patient information. If the computer&apos;s
            address changes, the certificate must be reissued (docs/HTTPS-SETUP.md) and this sheet printed again.
          </p>
        </>
      )}
    </div>
  );
}
