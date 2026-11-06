import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, type PrescriptionItem, type PrescriptionTemplate } from '../api';
import { ErrorBanner, Field, fieldErrorsOf } from '../components/ui';
import { QuickMedPicker } from '../components/QuickMedPicker';
import {
  applyQuickMedication,
  findStandardDirections,
  ROUTE_CHIPS,
  MEDICINE_SUGGESTIONS,
} from '../medicationCatalog';

const FREQ_OPTIONS = [
  { label: '1-0-0', val: '1-0-0 (once daily)' },
  { label: '1-0-1', val: '1-0-1 (twice daily)' },
  { label: '1-1-1', val: '1-1-1 (thrice daily)' },
  { label: '0-0-1', val: '0-0-1 (bedtime)' },
  { label: 'SOS', val: 'SOS (when needed)' },
  { label: 'QID', val: '1-1-1-1 (four times daily)' },
  { label: 'Weekly', val: 'Once weekly' },
];

const DUR_OPTIONS = [
  { label: '3 d', val: '3 days' },
  { label: '5 d', val: '5 days' },
  { label: '7 d', val: '7 days' },
  { label: '14 d', val: '14 days' },
  { label: '30 d', val: '30 days' },
  { label: 'Till delivery', val: 'Till delivery' },
];

const ROUTE_OPTIONS = ['oral', 'IV', 'IM', 'per vaginal', 'topical', 'sublingual'];

const INSTR_OPTIONS = ['After food', 'Before food', 'Empty stomach', 'At bedtime', 'With milk'];

const CATEGORIES = ['Antenatal', 'Gynaecology', 'Post-op', 'General'] as const;

type ItemForm = Record<keyof PrescriptionItem, string>;

const emptyItem = (): ItemForm => ({
  medicine: '',
  strength: '',
  dose: '',
  route: '',
  frequency: '',
  duration: '',
  instructions: '',
});

const ITEM_FIELDS: { key: keyof PrescriptionItem; label: string; placeholder?: string; wide?: boolean }[] = [
  { key: 'medicine', label: 'Medicine', placeholder: 'e.g. Paracetamol' },
  { key: 'strength', label: 'Strength', placeholder: 'e.g. 650 mg' },
  { key: 'dose', label: 'Dose', placeholder: 'e.g. 1 tablet' },
  { key: 'route', label: 'Route', placeholder: 'e.g. oral' },
  { key: 'frequency', label: 'Frequency', placeholder: 'e.g. TDS / twice daily' },
  { key: 'duration', label: 'Duration', placeholder: 'e.g. 5 days' },
  { key: 'instructions', label: 'Instructions', wide: true, placeholder: 'e.g. after food' },
];

export function PrescriptionTemplatesPage() {
  const [templates, setTemplates] = useState<PrescriptionTemplate[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<PrescriptionTemplate | 'new' | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('Antenatal');
  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);
  const [formError, setFormError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const rows = await api<PrescriptionTemplate[]>('GET', `/api/prescription-templates?all=${showAll ? '1' : '0'}`);
      setTemplates(rows);
      setError(null);
    } catch (e) {
      setError(e);
    }
  };

  useEffect(() => {
    void load();
  }, [showAll]);

  function startCreate() {
    setName('');
    setCategory('Antenatal');
    setItems([emptyItem()]);
    setFormError(null);
    setEditing('new');
  }

  function startEdit(t: PrescriptionTemplate) {
    setName(t.name);
    setCategory(t.category);
    setItems(
      t.items.map((i) => ({
        medicine: i.medicine ?? '',
        strength: i.strength ?? '',
        dose: i.dose ?? '',
        route: i.route ?? '',
        frequency: i.frequency ?? '',
        duration: i.duration ?? '',
        instructions: i.instructions ?? '',
      })),
    );
    setFormError(null);
    setEditing(t);
  }

  async function saveTemplate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setBusy(true);

    const cleanItems = items
      .filter((i) => i.medicine.trim() !== '')
      .map((i) => ({
        medicine: i.medicine.trim(),
        strength: i.strength.trim() || null,
        dose: i.dose.trim() || null,
        route: i.route.trim() || null,
        frequency: i.frequency.trim() || null,
        duration: i.duration.trim() || null,
        instructions: i.instructions.trim() || null,
      }));

    if (cleanItems.length === 0) {
      setFormError(new Error('Add at least one medicine with a name.'));
      setBusy(false);
      return;
    }

    try {
      if (editing === 'new') {
        await api('POST', '/api/prescription-templates', {
          name: name.trim(),
          category: category.trim(),
          items: cleanItems,
        });
      } else if (editing) {
        await api('PATCH', `/api/prescription-templates/${editing.id}`, {
          name: name.trim(),
          category: category.trim(),
          items: cleanItems,
        });
      }
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(t: PrescriptionTemplate) {
    try {
      await api('PATCH', `/api/prescription-templates/${t.id}`, { active: !t.active });
      await load();
    } catch (e) {
      setError(e);
    }
  }

  const fe = fieldErrorsOf(formError);

  // Group by category
  const groups: Record<string, PrescriptionTemplate[]> = {};
  for (const t of templates ?? []) {
    groups[t.category] = groups[t.category] ?? [];
    groups[t.category]!.push(t);
  }

  return (
    <div className="page narrow">
      <p>
        <Link to="/settings">← Clinic details</Link>
      </p>

      <div className="page-head">
        <div>
          <h1>Prescription templates</h1>
          <p className="muted">Standard medication regimens to insert into consultation drafts in one click.</p>
        </div>
        <button type="button" className="btn primary" onClick={startCreate}>
          + New template
        </button>
      </div>

      <div className="row wrap" style={{ marginBottom: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <label className="row" style={{ alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            style={{ width: 'auto', minHeight: 'auto' }}
          />
          <span>Show switched-off templates</span>
        </label>
      </div>

      <ErrorBanner error={error} />
      {templates === null && !error && <p className="muted">Loading templates…</p>}

      {editing && (
        <form onSubmit={saveTemplate} className="card stack" style={{ marginBottom: '1.5rem', border: '2px solid var(--border)' }}>
          <h2>{editing === 'new' ? 'New prescription template' : `Edit: ${editing.name}`}</h2>
          <ErrorBanner error={formError} />

          <div className="grid2">
            <Field label="Template name" error={fe.name} hint="e.g. Antenatal Routine Prophylaxis">
              <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </Field>

            <Field label="Category" error={fe.category}>
              <input
                list="template-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Pick or type a category"
                required
              />
              <datalist id="template-categories">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          </div>

          <fieldset className="card stack">
            <legend>Medicines in this template</legend>
            <QuickMedPicker onSelect={(qm) => setItems((curr) => applyQuickMedication(curr, qm))} />
            {items.map((it, idx) => (
              <div key={idx} className="rx-item">
                <div className="rx-head">
                  <strong>#{idx + 1}</strong>
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => setItems(items.filter((_, j) => j !== idx))}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid2">
                  {ITEM_FIELDS.map((f) => (
                    <div key={f.key} className={f.wide ? 'span2' : ''}>
                      <Field label={f.label} error={fe[`items.${idx}.${f.key}`]}>
                        <input
                          value={it[f.key]}
                          placeholder={f.placeholder}
                          onChange={(e) =>
                            setItems(items.map((x, j) => (j === idx ? { ...x, [f.key]: e.target.value } : x)))
                          }
                          required={f.key === 'medicine'}
                          list={f.key === 'medicine' ? 'rx-tmpl-medicine-suggestions' : f.key === 'route' ? 'rx-tmpl-route-suggestions' : undefined}
                        />
                        {f.key === 'medicine' && it.medicine && (() => {
                          const std = findStandardDirections(it.medicine);
                          if (!std) return null;
                          return (
                            <div style={{ marginTop: '0.25rem' }}>
                              <button
                                type="button"
                                className="chip-btn pill-add"
                                onClick={() =>
                                  setItems(
                                    items.map((x, j) =>
                                      j === idx
                                        ? {
                                            ...x,
                                            medicine: std.medicine,
                                            strength: std.strength,
                                            dose: std.dose,
                                            route: std.route,
                                            frequency: std.frequency,
                                            duration: std.duration,
                                            instructions: std.instructions,
                                          }
                                        : x
                                    )
                                  )
                                }
                              >
                                ⚡ Fill standard directions ({std.strength}, {std.frequency})
                              </button>
                            </div>
                          );
                        })()}
                        {f.key === 'frequency' && (
                          <div className="chips rx-chips">
                            {FREQ_OPTIONS.map((c) => (
                              <button
                                key={c.label}
                                type="button"
                                className={`chip-btn ${it.frequency === c.val ? 'active' : ''}`}
                                onClick={() => setItems(items.map((x, j) => (j === idx ? { ...x, frequency: c.val } : x)))}
                              >
                                {c.label}
                              </button>
                            ))}
                          </div>
                        )}
                        {f.key === 'duration' && (
                          <div className="chips rx-chips">
                            {DUR_OPTIONS.map((d) => (
                              <button
                                key={d.label}
                                type="button"
                                className={`chip-btn ${it.duration === d.val ? 'active' : ''}`}
                                onClick={() => setItems(items.map((x, j) => (j === idx ? { ...x, duration: d.val } : x)))}
                              >
                                {d.label}
                              </button>
                            ))}
                          </div>
                        )}
                        {f.key === 'route' && (
                          <div className="chips rx-chips">
                            {ROUTE_OPTIONS.map((r) => (
                              <button
                                key={r}
                                type="button"
                                className={`chip-btn ${it.route === r ? 'active' : ''}`}
                                onClick={() => setItems(items.map((x, j) => (j === idx ? { ...x, route: r } : x)))}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        )}
                        {f.key === 'instructions' && (
                          <div className="chips rx-chips">
                            {INSTR_OPTIONS.map((ins) => (
                              <button
                                key={ins}
                                type="button"
                                className="chip-btn"
                                onClick={() =>
                                  setItems(
                                    items.map((x, j) =>
                                      j === idx
                                        ? {
                                            ...x,
                                            instructions: x.instructions ? `${x.instructions}; ${ins}` : ins,
                                          }
                                        : x
                                    )
                                  )
                                }
                              >
                                + {ins}
                              </button>
                            ))}
                          </div>
                        )}
                      </Field>

                    </div>
                  ))}
                </div>
              </div>
            ))}

            {items.length < 30 && (
              <p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setItems([...items, emptyItem()])}
                >
                  + Add another medicine
                </button>
              </p>
            )}
            <datalist id="rx-tmpl-medicine-suggestions">
              {MEDICINE_SUGGESTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <datalist id="rx-tmpl-route-suggestions">
              {ROUTE_CHIPS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </fieldset>

          <div className="row wrap">
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save template'}
            </button>
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {templates !== null && templates.length === 0 && !editing && (
        <p className="muted">No prescription templates configured yet. Click "+ New template" to create one.</p>
      )}

      {Object.entries(groups).map(([cat, list]) => (
        <section key={cat} style={{ marginBottom: '1.5rem' }}>
          <h2>{cat}</h2>
          <ul className="cards">
            {list.map((t) => (
              <li key={t.id} className="card stack" style={{ opacity: t.active ? 1 : 0.65 }}>
                <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.2rem' }}>{t.name}</h3>
                    <div className="muted small">
                      {t.items.length} {t.items.length === 1 ? 'medicine' : 'medicines'}
                      {!t.active && ' · Switched off'}
                    </div>
                  </div>
                  <div className="row wrap">
                    <button type="button" className="btn small" onClick={() => startEdit(t)}>
                      Edit
                    </button>
                    <button type="button" className="btn small" onClick={() => void toggleActive(t)}>
                      {t.active ? 'Switch off' : 'Switch on'}
                    </button>
                  </div>
                </div>

                <table className="table small">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Medicine</th>
                      <th>Dose</th>
                      <th>Frequency</th>
                      <th>Duration</th>
                      <th>Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.items.map((it, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>
                          <strong>{it.medicine}</strong>
                          {it.strength ? ` ${it.strength}` : ''}
                        </td>
                        <td>{it.dose ?? '-'}</td>
                        <td>{it.frequency ?? '-'}</td>
                        <td>{it.duration ?? '-'}</td>
                        <td>{it.instructions ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
