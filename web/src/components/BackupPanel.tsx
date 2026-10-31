import { useEffect, useState } from 'react';
import { api, type BackupStatus } from '../api';
import { ErrorBanner } from './ui';

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
const size = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function BackupPanel() {
  const [st, setSt] = useState<BackupStatus | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    api<BackupStatus>('GET', '/api/backups').then(setSt, setError);
  }, []);

  async function runNow() {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const r = await api<{ status: BackupStatus }>('POST', '/api/backups/run');
      setSt(r.status);
      setDone(true);
    } catch (e) {
      setError(e);
      api<BackupStatus>('GET', '/api/backups').then(setSt, () => {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack">
      <h2 style={{ margin: 0 }}>Backups</h2>
      <ErrorBanner error={error} />
      {done && <div className="banner ok" role="status">Backup taken and checked.</div>}
      {!st && !error && <p className="muted">Loading…</p>}
      {st && (
        <>
          {st.warnings.map((w) => <div key={w} className="banner warn">{w}</div>)}
          <div>
            {st.lastSuccess ? (
              <>Last good backup: <strong>{when(st.lastSuccess.at)}</strong> ({size(st.lastSuccess.sizeBytes)})</>
            ) : (
              <strong>No backup yet</strong>
            )}
          </div>
          <div className="muted small">
            Saved to <code>{st.dir}</code>. Taken automatically every {st.intervalHours} hours while the clinic app is running; the newest {st.keep} are kept.
            Each backup is encrypted and is opened again straight after it is written to prove it is readable.
          </div>
          <div><button className="btn primary" onClick={() => void runNow()} disabled={busy || !st.configured}>{busy ? 'Backing up…' : 'Back up now'}</button></div>
          {st.files.length > 0 && (
            <details>
              <summary>Backups on this computer ({st.files.length})</summary>
              <ul className="plain">
                {st.files.map((f) => <li key={f.name}>{when(f.at)} · {size(f.sizeBytes)} · <span className="muted small">{f.name}</span></li>)}
              </ul>
            </details>
          )}
          <p className="muted small">
            Keep a copy of the backup folder on another disk or USB drive, and keep the backup passphrase written down somewhere safe that is not this computer.
            Without the passphrase a backup cannot be opened by anyone.
          </p>
        </>
      )}
    </section>
  );
}
