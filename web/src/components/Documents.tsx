import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, type Admission, type VisitSummary } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, Field, fieldErrorsOf, todayLocal } from './ui';

export interface Attachment {
  id: number;
  visitId: number | null;
  admissionId: number | null;
  visitDate: string | null;
  admissionNumber: string | null;
  docType: string;
  title: string;
  documentDate: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
  uploadedByName: string;
  createdAt: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
export const DOC_TYPE_LABEL: Record<string, string> = {
  lab_report: 'Lab report',
  ultrasound: 'Ultrasound / scan report',
  imaging: 'Imaging (X-ray, MRI, CT)',
  referral: 'Referral letter',
  consent: 'Consent form',
  outside_record: 'Record from another hospital',
  other: 'Other',
};

const size = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('The file could not be read'));
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.readAsDataURL(file);
  });
}

/** Uploaded scans, reports and letters for one patient. Files open through the server only, never from a public link. */
export function Documents({ patientId, visits, admissions }: { patientId: number; visits: VisitSummary[] | null; admissions: Admission[] | null }) {
  const { can } = useAuth();
  const [items, setItems] = useState<Attachment[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      setItems(await api<Attachment[]>('GET', `/api/patients/${patientId}/attachments`));
    } catch (e) {
      setError(e);
    }
  }, [patientId]);
  useEffect(() => {
    setItems(null);
    void load();
  }, [load]);

  async function remove(a: Attachment) {
    setError(null);
    try {
      await api('POST', `/api/attachments/${a.id}/void`, { reason });
      setRemoving(null);
      setReason('');
      await load();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <section className="card stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Documents</h2>
        {can('attachment:write') && !adding && (
          <button className="btn small" onClick={() => setAdding(true)}>+ Add document</button>
        )}
      </div>
      {adding && (
        <UploadForm
          patientId={patientId}
          visits={visits}
          admissions={admissions}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            void load();
          }}
        />
      )}
      <ErrorBanner error={error} />
      {items === null && !error && <p className="muted">Loading…</p>}
      {items?.length === 0 && <p className="muted">No documents saved for this patient.</p>}
      <ul className="cards">
        {items?.map((a) => (
          <li key={a.id} className="card">
            <div className="row wrap" style={{ justifyContent: 'space-between' }}>
              <strong>{a.title}</strong>
              <span className="muted small">{a.documentDate}</span>
            </div>
            <div className="muted small">
              {DOC_TYPE_LABEL[a.docType] ?? a.docType} · {size(a.sizeBytes)} · added by {a.uploadedByName}
              {a.visitDate ? ` · consultation of ${a.visitDate}` : ''}
              {a.admissionNumber ? ` · admission ${a.admissionNumber}` : ''}
            </div>
            <div className="row wrap" style={{ marginTop: '0.4rem' }}>
              <a className="btn small" href={`/api/attachments/${a.id}/file`} target="_blank" rel="noopener noreferrer">Open</a>
              <a className="btn small" href={`/api/attachments/${a.id}/file?download=1`}>Download</a>
              {can('attachment:void') && removing !== a.id && (
                <button className="btn small" onClick={() => { setRemoving(a.id); setReason(''); }}>Remove…</button>
              )}
            </div>
            {removing === a.id && (
              <div className="stack" style={{ marginTop: '0.5rem' }}>
                <Field label="Why is this being removed? (kept in the audit log)">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus />
                </Field>
                <div className="row">
                  <button className="btn danger" disabled={reason.trim().length < 5} onClick={() => void remove(a)}>Confirm remove</button>
                  <button className="btn" onClick={() => setRemoving(null)}>Cancel</button>
                </div>
                <p className="muted small" style={{ margin: 0 }}>The document is hidden, not erased: it stays in the database and backups.</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function UploadForm({
  patientId,
  visits,
  admissions,
  onDone,
  onCancel,
}: {
  patientId: number;
  visits: VisitSummary[] | null;
  admissions: Admission[] | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('ultrasound');
  const [date, setDate] = useState(todayLocal());
  const [link, setLink] = useState(''); // "" | "v:ID" | "a:ID"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const fe = fieldErrorsOf(error);

  function pick(f: File | null) {
    setFile(f);
    setError(null);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 150));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(new Error(`That file is ${size(file.size)}. The limit is 10 MB. Try a smaller scan or a lower-resolution photo.`));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await toBase64(file);
      await api('POST', `/api/patients/${patientId}/attachments`, {
        title,
        docType,
        documentDate: date,
        fileName: file.name,
        data,
        ...(link.startsWith('v:') ? { visitId: Number(link.slice(2)) } : {}),
        ...(link.startsWith('a:') ? { admissionId: Number(link.slice(2)) } : {}),
      });
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <ErrorBanner error={error} />
      <Field label="File (PDF, JPEG or PNG, up to 10 MB)" error={fe.data}>
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => pick(e.target.files?.[0] ?? null)} required />
      </Field>
      <Field label="Title" error={fe.title}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} required />
      </Field>
      <div className="grid2">
        <Field label="Type" error={fe.docType}>
          <select value={docType} onChange={(e) => setDocType(e.target.value)}>
            {Object.entries(DOC_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Date on the document" error={fe.documentDate}>
          <input type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} required />
        </Field>
      </div>
      {((visits && visits.length > 0) || (admissions && admissions.length > 0)) && (
        <Field label="Belongs to (optional)">
          <select value={link} onChange={(e) => setLink(e.target.value)}>
            <option value="">Just this patient</option>
            {visits?.map((v) => (
              <option key={`v${v.id}`} value={`v:${v.id}`}>Consultation of {v.visitDate}</option>
            ))}
            {admissions?.map((a) => (
              <option key={`a${a.id}`} value={`a:${a.id}`}>Admission {a.admissionNumber}</option>
            ))}
          </select>
        </Field>
      )}
      <div className="row">
        <button className="btn primary" disabled={!file || busy}>{busy ? 'Uploading…' : 'Save document'}</button>
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
