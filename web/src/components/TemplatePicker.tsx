import { useEffect, useState } from 'react';
import { api, type PrescriptionItem, type PrescriptionTemplate } from '../api';
import { ErrorBanner } from './ui';

interface Props {
  onInsert: (items: PrescriptionItem[], mode: 'append' | 'replace') => void;
  onClose: () => void;
}

export function TemplatePicker({ onInsert, onClose }: Props) {
  const [templates, setTemplates] = useState<PrescriptionTemplate[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<'append' | 'replace'>('append');

  useEffect(() => {
    api<PrescriptionTemplate[]>('GET', '/api/prescription-templates')
      .then((rows) => {
        setTemplates(rows);
        if (rows.length > 0 && rows[0]) setSelectedId(rows[0].id);
      })
      .catch(setError);
  }, []);

  const filtered = (templates ?? []).filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.items.some((i) => i.medicine.toLowerCase().includes(q))
    );
  });

  const selected = templates?.find((t) => t.id === selectedId) ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        className="card stack"
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--surface)',
        }}
      >
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Insert prescription template</h2>
          <button type="button" className="btn small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <ErrorBanner error={error} />
        {templates === null && !error && <p className="muted">Loading templates…</p>}

        {templates !== null && templates.length === 0 && (
          <p className="muted">
            No prescription templates found. You can configure standard regimens in Clinic &gt; Prescription templates.
          </p>
        )}

        {templates !== null && templates.length > 0 && (
          <>
            <input
              type="search"
              placeholder="Filter templates or medicines…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '1rem', minHeight: '220px' }}>
              <div style={{ borderRight: '1px solid var(--border)', paddingRight: '0.6rem', maxHeight: '300px', overflowY: 'auto' }}>
                <ul className="list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {filtered.map((t) => (
                    <li key={t.id} style={{ marginBottom: '0.3rem' }}>
                      <button
                        type="button"
                        className={`btn ${selectedId === t.id ? 'primary' : ''}`}
                        style={{ width: '100%', textAlign: 'left', padding: '0.4rem 0.6rem', justifyContent: 'flex-start' }}
                        onClick={() => setSelectedId(t.id)}
                      >
                        <div>
                          <div><strong>{t.name}</strong></div>
                          <div className="muted small">{t.category} · {t.items.length} {t.items.length === 1 ? 'item' : 'items'}</div>
                        </div>
                      </button>
                    </li>
                  ))}
                  {filtered.length === 0 && <p className="muted small">No matches.</p>}
                </ul>
              </div>

              <div>
                {selected ? (
                  <div className="stack">
                    <div>
                      <h3 style={{ margin: '0 0 0.2rem' }}>{selected.name}</h3>
                      <span className="badge small">{selected.category}</span>
                    </div>

                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <table className="table small" style={{ width: '100%' }}>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Medicine</th>
                            <th>Dose</th>
                            <th>Freq</th>
                            <th>Dur</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.items.map((it, idx) => (
                            <tr key={idx}>
                              <td>{idx + 1}</td>
                              <td>
                                <strong>{it.medicine}</strong>
                                {it.strength ? ` ${it.strength}` : ''}
                                {it.instructions ? <div className="muted">{it.instructions}</div> : null}
                              </td>
                              <td>{it.dose ?? '-'}</td>
                              <td>{it.frequency ?? '-'}</td>
                              <td>{it.duration ?? '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="row wrap" style={{ gap: '1rem', marginTop: '0.5rem' }}>
                      <label className="row" style={{ alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="mode"
                          checked={mode === 'append'}
                          onChange={() => setMode('append')}
                          style={{ minHeight: 'auto', width: 'auto' }}
                        />
                        <span className="small">Append to draft</span>
                      </label>
                      <label className="row" style={{ alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="mode"
                          checked={mode === 'replace'}
                          onChange={() => setMode('replace')}
                          style={{ minHeight: 'auto', width: 'auto' }}
                        />
                        <span className="small">Replace current items</span>
                      </label>
                    </div>

                    <div className="row wrap" style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <button type="button" className="btn" onClick={onClose}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => onInsert(selected.items, mode)}
                      >
                        Insert {selected.items.length} medicines
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="muted">Select a template to preview its medicines.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
