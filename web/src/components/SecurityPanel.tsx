import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type SecurityStatus } from '../api';
import { ErrorBanner } from './ui';

export function SecurityPanel() {
  const [st, setSt] = useState<SecurityStatus | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api<SecurityStatus>('GET', '/api/security').then(setSt, setError);
  }, []);
  return (
    <section className="card stack">
      <h2 style={{ margin: 0 }}>Secure connection (HTTPS)</h2>
      <ErrorBanner error={error} />
      {st && (
        <>
          {st.warnings.map((w) => <div key={w} className="banner warn">{w}</div>)}
          {st.https && st.cert ? (
            <div>
              <span className="badge ok">HTTPS is on</span> Certificate valid until <strong>{new Date(st.cert.notAfter).toDateString()}</strong> ({st.cert.daysLeft} days).
              <div className="muted small">Staff open: {st.cert.names.map((n) => `https://${n}`).join('  or  ')} (add the port number if it is not 443).</div>
            </div>
          ) : (
            <div>
              <span className="badge warn">HTTPS is off</span>{' '}
              {st.reachableFromNetwork ? 'This app can be reached from the network without encryption.' : 'The app only accepts connections from this computer, which is safe.'}
            </div>
          )}
          {st.https && st.caAvailable && (
            <>
              <div className="row wrap" style={{ gap: '0.5rem' }}>
                <Link className="btn primary" to="/settings/connect">Connect a staff device (QR code)</Link>
                <a className="btn" href="/api/tls/ca.crt" download="clinic-ca.crt">Download the clinic certificate</a>
              </div>
              <p className="muted small">
                Install this file once on each phone, tablet or computer that will open the app, so the browser trusts it and shows no warning.
                It only identifies this clinic's server; it contains no secrets. Steps are in <code>docs/HTTPS-SETUP.md</code>.
              </p>
            </>
          )}
          {!st.https && <p className="muted small">To turn HTTPS on, follow <code>docs/HTTPS-SETUP.md</code> on the clinic computer.</p>}
        </>
      )}
    </section>
  );
}
