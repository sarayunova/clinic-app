import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type BackupCheck, type RestorePoint } from '../api';
import { ErrorBanner } from '../components/ui';

const when = (iso: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
const size = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const SOURCE: Record<RestorePoint['source'], string> = { backup: 'Backup', 'pre-upgrade': 'Safety copy before an upgrade' };

/**
 * Restore, step by step. The app only ever CHECKS a backup (in a temporary copy) and shows what it
 * holds next to the live records. Replacing the live database is done by an administrator on the
 * clinic computer with the command shown, because the running server cannot safely swap the
 * database it has open, and a web page must never be able to overwrite patient records.
 */
export function RestorePage() {
  const [points, setPoints] = useState<RestorePoint[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [check, setCheck] = useState<BackupCheck | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<{ points: RestorePoint[] }>('GET', '/api/backups/restore-points').then((r) => setPoints(r.points), setError);
  }, []);

  async function runCheck(p: RestorePoint) {
    setChecking(p.name);
    setCheck(null);
    setError(null);
    setCopied(false);
    try {
      setCheck(await api<BackupCheck>('POST', '/api/backups/check', { source: p.source, name: p.name }));
    } catch (e) {
      setError(e);
    } finally {
      setChecking(null);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false); // clipboard blocked (e.g. plain http): the command is selectable below
    }
  }

  const lost = check?.live ? check.live.patients - check.verify.patients : 0;
  // Every change is audited, so a later last-audited time on the live side means work would be lost.
  const newerLive =
    !!check?.live && (lost > 0 || (!!check.live.newestActivityAt && (!check.newestActivityAt || check.live.newestActivityAt > check.newestActivityAt)));

  return (
    <div className="page narrow">
      <p className="no-print"><Link to="/settings/status">← System status</Link></p>
      <h1>Restore from a backup</h1>
      <p className="muted">
        Use this only to recover from lost or damaged data. First check a backup here: that opens a temporary copy and never
        changes the live records. Then the person who looks after this computer runs the restore on it.
      </p>
      <ErrorBanner error={error} />

      <section className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>1. Choose and check a backup</h2>
        {points === null && !error && <p className="muted">Loading…</p>}
        {points?.length === 0 && <p>No backups found on this computer. A backup on a USB drive can be restored with the command in docs\BACKUP-AND-RESTORE.md.</p>}
        {points && points.length > 0 && (
          <table className="table" style={{ width: '100%' }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Taken</th><th style={{ textAlign: 'left' }}>Kind</th><th style={{ textAlign: 'right' }}>Size</th><th /></tr></thead>
            <tbody>
              {points.map((p) => (
                <tr key={`${p.source}/${p.name}`} style={check?.name === p.name ? { background: '#eff6ff' } : undefined}>
                  <td>{when(p.at)}</td>
                  <td>{SOURCE[p.source]}</td>
                  <td style={{ textAlign: 'right' }}>{size(p.sizeBytes)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn small" onClick={() => void runCheck(p)} disabled={checking !== null}>
                      {checking === p.name ? 'Checking…' : 'Check'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {check && (
        <section className="card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>2. What is in it</h2>
          <div className="banner ok" role="status">The backup opened with this clinic's passphrase and passed its integrity check.</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem' }}>
            <thead><tr><th /><th style={{ textAlign: 'right' }}>In the backup</th><th style={{ textAlign: 'right' }}>Live now</th></tr></thead>
            <tbody>
              <tr><th scope="row" style={{ textAlign: 'left' }}>Patients</th><td style={{ textAlign: 'right' }}>{check.verify.patients}</td><td style={{ textAlign: 'right' }}>{check.live?.patients ?? '–'}</td></tr>
              <tr><th scope="row" style={{ textAlign: 'left' }}>Staff accounts</th><td style={{ textAlign: 'right' }}>{check.verify.users}</td><td style={{ textAlign: 'right' }}>{check.live?.users ?? '–'}</td></tr>
              <tr>
                <th scope="row" style={{ textAlign: 'left' }}>Last change recorded</th>
                <td style={{ textAlign: 'right' }}>{check.newestActivityAt ? when(check.newestActivityAt) : 'unknown'}</td>
                <td style={{ textAlign: 'right' }}>{check.live?.newestActivityAt ? when(check.live.newestActivityAt) : '–'}</td>
              </tr>
            </tbody>
          </table>
          <p className="muted" style={{ marginBottom: 0 }}>Backup taken {when(check.takenAt)}, {size(check.sizeBytes)}.</p>
          {newerLive && (
            <div className="banner warn" role="alert" style={{ marginTop: '0.75rem' }}>
              Changes were made after this backup{lost > 0 ? `, including ${lost} more patient${lost === 1 ? '' : 's'}` : ''}. Restoring it
              means everything entered or changed since {check.newestActivityAt ? when(check.newestActivityAt) : when(check.takenAt)} (visits,
              prescriptions, bills and so on) will no longer appear in the app.
            </div>
          )}
          {!check.canRestoreHere && (
            <div className="banner warn" role="alert" style={{ marginTop: '0.75rem' }}>
              <strong>This backup was made by a newer version of the app.</strong> This version cannot restore it. Install that
              version (or newer) first.
            </div>
          )}
        </section>
      )}

      {check?.canRestoreHere && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>3. Restore it on the clinic computer</h2>
          <ol style={{ paddingLeft: '1.2rem', lineHeight: 1.6 }}>
            <li>Tell everyone to save their work: the app stops for about a minute.</li>
            <li>On the clinic computer, open the Start menu, type <strong>PowerShell</strong>, right-click it and choose <strong>Run as administrator</strong>.</li>
            <li>
              Paste this command and press Enter:
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f1f5f9', padding: '0.6rem', borderRadius: 6, userSelect: 'all' }}>{check.restoreCommand}</pre>
              <button className="btn small no-print" onClick={() => void copy(check.restoreCommand)}>{copied ? 'Copied' : 'Copy command'}</button>
            </li>
            <li>It checks the backup again, then asks you to type <strong>RESTORE</strong>. It stops the app, takes an encrypted safety copy of the current records, restores, and starts the app again.</li>
            <li>Open the app and check a few recent patients. If anything looks wrong, the safety copy it took appears in the list above (as a safety copy) and can be restored the same way.</li>
          </ol>
        </section>
      )}
    </div>
  );
}
