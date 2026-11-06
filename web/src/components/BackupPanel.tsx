import { useEffect, useState } from 'react';
import { api, type BackupStatus } from '../api';
import { ErrorBanner } from './ui';

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
const size = (n: number) =>
  n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

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

  async function runAndDownload() {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const r = await api<{ file: string; status: BackupStatus }>('POST', '/api/backups/run');
      setSt(r.status);
      setDone(true);
      // Trigger browser download
      const link = document.createElement('a');
      link.href = `/api/backups/download/${r.file}`;
      link.download = r.file;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
          {st.warnings.map((w) => (
            <div key={w} className="banner warn">{w}</div>
          ))}
          <div>
            {st.lastSuccess ? (
              <>
                Last good backup: <strong>{when(st.lastSuccess.at)}</strong> ({size(st.lastSuccess.sizeBytes)})
              </>
            ) : (
              <strong>No backup yet</strong>
            )}
          </div>
          <div className="muted small">
            Saved to <code>{st.dir}</code>. Taken automatically every {st.intervalHours} hours while the clinic app is running; the newest {st.keep} are kept.
            Each backup is encrypted and is opened again straight after it is written to prove it is readable.
          </div>

          <div className="row wrap" style={{ gap: '0.6rem' }}>
            <button
              type="button"
              className="btn primary"
              onClick={() => void runNow()}
              disabled={busy || !st.configured}
            >
              {busy ? 'Backing up…' : 'Back up now'}
            </button>

            <button
              type="button"
              className="btn"
              onClick={() => void runAndDownload()}
              disabled={busy || !st.configured}
              title="Create a fresh encrypted backup snapshot and download it immediately"
            >
              ⚡ Back up & Download
            </button>

            {st.lastSuccess && (
              <a
                href="/api/backups/download/latest"
                className="btn"
                download={st.lastSuccess.file}
                title="Download the latest encrypted backup file (.cbk)"
              >
                ⬇️ Download Latest Backup
              </a>
            )}
          </div>

          {st.files.length > 0 && (
            <details>
              <summary>Backups on this computer ({st.files.length})</summary>
              <ul className="plain" style={{ marginTop: '0.5rem' }}>
                {st.files.map((f) => (
                  <li
                    key={f.name}
                    className="row wrap"
                    style={{
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.4rem 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <strong>{when(f.at)}</strong> · {size(f.sizeBytes)} ·{' '}
                      <span className="muted small">{f.name}</span>
                    </div>
                    <a
                      href={`/api/backups/download/${f.name}`}
                      className="btn small"
                      download={f.name}
                      title={`Download ${f.name} to USB drive or local computer`}
                    >
                      ⬇️ Download
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="banner info" style={{ marginTop: '0.5rem' }}>
            💡 <strong>Off-site backup tip:</strong> Plug in a USB thumb drive and click{' '}
            <strong>Download Latest Backup</strong> (or <strong>Back up & Download</strong>) at the end of the day.
            The file is completely AES-256-GCM encrypted, so it remains safe even if the USB drive is lost or misplaced.
          </div>

          <p className="muted small" style={{ margin: 0 }}>
            Keep a copy of the backup folder on another disk or USB drive, and keep the backup passphrase written down somewhere safe that is not this computer.
            Without the passphrase a backup cannot be opened by anyone.
          </p>
        </>
      )}
    </section>
  );
}
