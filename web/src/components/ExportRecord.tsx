import { useState } from 'react';
import { api } from '../api';
import { ErrorBanner } from './ui';

/** Doctor-only: downloads one patient's complete record as a JSON file. Every download is audited by the server. */
export function ExportRecord({ patientId, patientNumber }: { patientId: number; patientNumber: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);

  async function download() {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const doc = await api<unknown>('GET', `/api/patients/${patientId}/export`);
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patient-${patientNumber.replace(/[^A-Za-z0-9_-]/g, '')}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDone(true);
      setConfirming(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack">
      <h2 style={{ margin: 0 }}>Full copy of this record</h2>
      <p className="muted small" style={{ margin: 0 }}>
        Downloads everything held about this patient (details, consultations, admissions, bills) as one file. The file is not
        encrypted: keep it somewhere safe and delete it when no longer needed. Each download is recorded in the audit log.
      </p>
      <ErrorBanner error={error} />
      {done && <div className="banner ok">Downloaded. This has been recorded in the audit log.</div>}
      <div className="row">
        {!confirming ? (
          <button className="btn" onClick={() => setConfirming(true)}>Download full record…</button>
        ) : (
          <>
            <button className="btn primary" disabled={busy} onClick={() => void download()}>{busy ? 'Preparing…' : 'Confirm download'}</button>
            <button className="btn" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
          </>
        )}
      </div>
    </section>
  );
}
