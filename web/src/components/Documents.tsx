import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, type Admission, type VisitSummary } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, Field, todayLocal } from './ui';

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
  ultrasound: 'Ultrasound / scan report',
  lab_report: 'Lab report',
  imaging: 'Imaging (X-ray, MRI, CT)',
  referral: 'Referral letter',
  consent: 'Consent form',
  outside_record: 'Record from another hospital',
  other: 'Other',
};

const QUICK_DOC_TYPES = [
  { key: 'ultrasound', label: 'Ultrasound' },
  { key: 'lab_report', label: 'Lab report' },
  { key: 'imaging', label: 'Imaging' },
  { key: 'referral', label: 'Referral' },
  { key: 'consent', label: 'Consent' },
  { key: 'other', label: 'Other' },
] as const;

export const size = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('The file could not be read'));
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.readAsDataURL(file);
  });
}

interface StagedFile {
  id: string;
  file: File;
  previewUrl: string | null;
  isPdf: boolean;
  title: string;
  docType: string;
  documentDate: string;
  link: string; // "" | "v:ID" | "a:ID"
}

export function Documents({
  patientId,
  visits,
  admissions,
  currentVisitId,
}: {
  patientId: number;
  visits?: VisitSummary[] | null;
  admissions?: Admission[] | null;
  currentVisitId?: number;
}) {
  const { can } = useAuth();
  const [items, setItems] = useState<Attachment[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [filterMode, setFilterMode] = useState<'this_visit' | 'all'>(currentVisitId ? 'this_visit' : 'all');

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

  // Filter items if viewing inside a specific consultation
  const thisVisitItems = currentVisitId && items ? items.filter((a) => a.visitId === currentVisitId) : [];
  const displayedItems = currentVisitId && filterMode === 'this_visit' ? thisVisitItems : (items ?? []);

  return (
    <section className="card stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h2 style={{ margin: 0 }}>
            {currentVisitId ? 'Consultation Documents & Reports' : 'Documents'}
          </h2>
          {currentVisitId && items && items.length > 0 && (
            <div className="row wrap" style={{ gap: '0.4rem', marginTop: '0.4rem' }}>
              <button
                type="button"
                className={`btn small ${filterMode === 'this_visit' ? 'primary' : ''}`}
                onClick={() => setFilterMode('this_visit')}
              >
                📄 This consultation ({thisVisitItems.length})
              </button>
              <button
                type="button"
                className={`btn small ${filterMode === 'all' ? 'primary' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                📁 All patient documents ({items.length})
              </button>
            </div>
          )}
        </div>

        {can('attachment:write') && !adding && (
          <button className="btn primary small" onClick={() => setAdding(true)}>
            + Add document / scan
          </button>
        )}
      </div>

      {adding && (
        <QuickDropzoneUpload
          patientId={patientId}
          visits={visits ?? null}
          admissions={admissions ?? null}
          defaultVisitId={currentVisitId}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            void load();
          }}
        />
      )}

      <ErrorBanner error={error} />
      {items === null && !error && <p className="muted">Loading…</p>}
      {items !== null && displayedItems.length === 0 && !adding && (
        <p className="muted">
          {currentVisitId && filterMode === 'this_visit'
            ? 'No documents attached to this consultation yet.'
            : 'No documents saved for this patient.'}
        </p>
      )}

      <ul className="cards">
        {displayedItems.map((a) => {
          const isImg = a.mime.startsWith('image/');
          const isPdf = a.mime === 'application/pdf';

          return (
            <li key={a.id} className="card">
              <div className="row wrap" style={{ alignItems: 'flex-start', gap: '0.75rem' }}>
                {/* Visual Thumbnail / Icon */}
                <a
                  href={`/api/attachments/${a.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Click to view file"
                >
                  {isImg ? (
                    <img
                      src={`/api/attachments/${a.id}/file`}
                      alt={a.title}
                      className="doc-thumbnail"
                      loading="lazy"
                    />
                  ) : (
                    <div className="doc-icon-badge" style={{ color: isPdf ? '#ef4444' : 'inherit' }}>
                      {isPdf ? 'PDF' : '📄'}
                    </div>
                  )}
                </a>

                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <a
                      href={`/api/attachments/${a.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontWeight: 700, fontSize: '1.05rem', color: 'inherit', textDecoration: 'none' }}
                    >
                      {a.title}
                    </a>
                    <span className="muted small">{a.documentDate}</span>
                  </div>

                  <div className="muted small" style={{ marginTop: '0.2rem' }}>
                    <span className="badge" style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem', marginRight: '0.4rem' }}>
                      {DOC_TYPE_LABEL[a.docType] ?? a.docType}
                    </span>
                    <span>{size(a.sizeBytes)}</span>
                    <span> · added by {a.uploadedByName}</span>
                    {a.visitDate && <span> · consultation of {a.visitDate}</span>}
                    {a.admissionNumber && <span> · admission {a.admissionNumber}</span>}
                  </div>

                  <div className="row wrap" style={{ marginTop: '0.5rem', gap: '0.4rem' }}>
                    <a className="btn small" href={`/api/attachments/${a.id}/file`} target="_blank" rel="noopener noreferrer">
                      🔍 Open
                    </a>
                    <a className="btn small" href={`/api/attachments/${a.id}/file?download=1`}>
                      ⬇️ Download
                    </a>
                    {can('attachment:void') && removing !== a.id && (
                      <button className="btn small" onClick={() => { setRemoving(a.id); setReason(''); }}>
                        Remove…
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {removing === a.id && (
                <div className="stack" style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
                  <Field label="Why is this document being removed? (Recorded in audit log)">
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={500}
                      placeholder="e.g. Uploaded to the wrong patient file"
                      autoFocus
                    />
                  </Field>
                  <div className="row">
                    <button
                      type="button"
                      className="btn danger small"
                      disabled={reason.trim().length < 5}
                      onClick={() => void remove(a)}
                    >
                      Confirm removal
                    </button>
                    <button type="button" className="btn small" onClick={() => setRemoving(null)}>
                      Cancel
                    </button>
                  </div>
                  <p className="muted small" style={{ margin: 0 }}>
                    The document is marked voided and hidden from routine view, but preserved for clinical audit and backups.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Drag & Drop Multi-file Uploader with instant previews */
function QuickDropzoneUpload({
  patientId,
  visits,
  admissions,
  defaultVisitId,
  onDone,
  onCancel,
}: {
  patientId: number;
  visits: VisitSummary[] | null;
  admissions: Admission[] | null;
  defaultVisitId?: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState<unknown>(null);

  // Clean up object URLs when unmounted
  useEffect(() => {
    return () => {
      for (const item of staged) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, [staged]);

  const addFiles = (files: File[]) => {
    setError(null);
    const valid: StagedFile[] = [];

    for (const file of files) {
      if (file.size > MAX_BYTES) {
        setError(
          new Error(
            `"${file.name}" is ${size(file.size)}. The maximum allowed size is 10 MB per file.`,
          ),
        );
        continue;
      }

      const isImg = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const previewUrl = isImg ? URL.createObjectURL(file) : null;
      const cleanTitle = file.name
        .replace(/\.[^.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .trim()
        .slice(0, 150);

      // Guess initial docType from filename keywords
      const lower = file.name.toLowerCase();
      let guessedType = 'other';
      if (lower.includes('scan') || lower.includes('usg') || lower.includes('ultra') || lower.includes('nt') || lower.includes('anomaly')) {
        guessedType = 'ultrasound';
      } else if (lower.includes('lab') || lower.includes('blood') || lower.includes('cbc') || lower.includes('urine') || lower.includes('test')) {
        guessedType = 'lab_report';
      } else if (lower.includes('xray') || lower.includes('ct') || lower.includes('mri')) {
        guessedType = 'imaging';
      } else if (lower.includes('referral')) {
        guessedType = 'referral';
      } else if (lower.includes('consent')) {
        guessedType = 'consent';
      } else {
        guessedType = defaultVisitId ? 'ultrasound' : 'lab_report';
      }

      valid.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl,
        isPdf,
        title: cleanTitle || 'Document',
        docType: guessedType,
        documentDate: todayLocal(),
        link: defaultVisitId ? `v:${defaultVisitId}` : '',
      });
    }

    setStaged((prev) => [...prev, ...valid]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeStaged = (id: string) => {
    setStaged((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  };

  const updateStaged = (id: string, patch: Partial<StagedFile>) => {
    setStaged((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  async function submitAll(e: FormEvent) {
    e.preventDefault();
    if (staged.length === 0) return;
    setBusy(true);
    setError(null);

    try {
      for (let i = 0; i < staged.length; i++) {
        const item = staged[i]!;
        setProgressMsg(`Uploading ${i + 1} of ${staged.length}: "${item.title}"…`);
        const b64 = await toBase64(item.file);

        await api('POST', `/api/patients/${patientId}/attachments`, {
          title: item.title,
          docType: item.docType,
          documentDate: item.documentDate,
          fileName: item.file.name,
          data: b64,
          ...(item.link.startsWith('v:') ? { visitId: Number(item.link.slice(2)) } : {}),
          ...(item.link.startsWith('a:') ? { admissionId: Number(item.link.slice(2)) } : {}),
        });
      }
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  }

  return (
    <form onSubmit={submitAll} className="stack card" style={{ background: 'var(--surface)', border: '2px solid var(--primary)' }}>
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>📁 Attach Ultrasound, Lab or Clinical Documents</h3>
        <span className="muted small">PDF, JPEG, or PNG (up to 10 MB per file)</span>
      </div>

      <ErrorBanner error={error} />

      {/* Drag & Drop Target Area */}
      <div
        className={`dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📤</div>
        <strong style={{ fontSize: '1.1rem', display: 'block' }}>
          Drag & drop report or scan files here, or click to browse
        </strong>
        <span className="muted small">Multiple files supported (e.g. ultrasound scan images + report PDF)</span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              addFiles(Array.from(e.target.files));
            }
          }}
        />
      </div>

      {/* Staged Files Queue */}
      {staged.length > 0 && (
        <div className="stack" style={{ gap: '0.75rem' }}>
          <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Ready to upload ({staged.length} {staged.length === 1 ? 'file' : 'files'}):</strong>
            <button
              type="button"
              className="btn small"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              + Add another file
            </button>
          </div>

          {staged.map((item) => (
            <div key={item.id} className="file-preview-card">
              {/* Preview image or PDF icon */}
              {item.previewUrl ? (
                <img src={item.previewUrl} alt="preview" className="doc-thumbnail" />
              ) : (
                <div className="doc-icon-badge" style={{ color: item.isPdf ? '#ef4444' : 'inherit' }}>
                  {item.isPdf ? 'PDF' : '📄'}
                </div>
              )}

              <div className="stack" style={{ flex: 1, gap: '0.4rem' }}>
                <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="muted small">
                    {item.file.name} ({size(item.file.size)})
                  </span>
                  <button
                    type="button"
                    className="btn small danger"
                    onClick={() => removeStaged(item.id)}
                    disabled={busy}
                    style={{ padding: '0.1rem 0.5rem' }}
                  >
                    ✕ Remove
                  </button>
                </div>

                <div className="grid2" style={{ gap: '0.5rem' }}>
                  <Field label="Title">
                    <input
                      value={item.title}
                      onChange={(e) => updateStaged(item.id, { title: e.target.value })}
                      maxLength={150}
                      disabled={busy}
                      required
                    />
                  </Field>

                  <Field label="Document Date">
                    <input
                      type="date"
                      value={item.documentDate}
                      max={todayLocal()}
                      onChange={(e) => updateStaged(item.id, { documentDate: e.target.value })}
                      disabled={busy}
                      required
                    />
                  </Field>
                </div>

                {/* Quick-pick Doc Type Pills */}
                <div>
                  <label className="muted small" style={{ fontWeight: 600 }}>Type:</label>
                  <div className="doctype-pills">
                    {QUICK_DOC_TYPES.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        className={`doctype-pill ${item.docType === t.key ? 'active' : ''}`}
                        onClick={() => updateStaged(item.id, { docType: t.key })}
                        disabled={busy}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Link to consultation/admission if available and not locked to current visit */}
                {!defaultVisitId && ((visits && visits.length > 0) || (admissions && admissions.length > 0)) && (
                  <Field label="Belongs to (optional)">
                    <select
                      value={item.link}
                      onChange={(e) => updateStaged(item.id, { link: e.target.value })}
                      disabled={busy}
                    >
                      <option value="">Just this patient (General record)</option>
                      {visits?.map((v) => (
                        <option key={`v${v.id}`} value={`v:${v.id}`}>
                          Consultation of {v.visitDate}
                        </option>
                      ))}
                      {admissions?.map((a) => (
                        <option key={`a${a.id}`} value={`a:${a.id}`}>
                          Admission {a.admissionNumber}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Footer */}
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {busy && <strong style={{ color: 'var(--primary)' }}>{progressMsg}</strong>}
        </div>
        <div className="row" style={{ gap: '0.5rem' }}>
          <button
            type="submit"
            className="btn primary"
            disabled={staged.length === 0 || busy}
          >
            {busy ? 'Uploading…' : staged.length === 1 ? 'Upload 1 Document' : `Upload ${staged.length} Documents`}
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
