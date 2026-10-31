import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api, type PrescriptionItem, type Visit, type VitalsEntry } from '../api';
import { useAuth } from '../auth';
import { AllergyBadge, ErrorBanner, Field, fieldErrorsOf, formatAge } from '../components/ui';

const TEXT_FIELDS = [
  { key: 'complaints', label: 'Presenting complaints' },
  { key: 'history', label: 'Relevant history' },
  { key: 'examination', label: 'Examination findings' },
  { key: 'assessment', label: 'Assessment / diagnosis' },
  { key: 'antenatalNotes', label: 'Pregnancy / antenatal observations (if relevant)' },
  { key: 'investigations', label: 'Investigations requested / report notes' },
  { key: 'advice', label: 'Advice' },
] as const;
type TextKey = (typeof TEXT_FIELDS)[number]['key'];
type FormKey = TextKey | 'followUpDate';
const FORM_KEYS: FormKey[] = [...TEXT_FIELDS.map((f) => f.key), 'followUpDate'];
const LABEL: Record<string, string> = {
  ...Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, f.label])),
  followUpDate: 'Follow-up date',
  prescriptionItems: 'Prescription',
};

type ItemForm = Record<keyof PrescriptionItem, string>;
const ITEM_FIELDS: { key: keyof PrescriptionItem; label: string; wide?: boolean; placeholder?: string }[] = [
  { key: 'medicine', label: 'Medicine', wide: true },
  { key: 'strength', label: 'Strength', placeholder: 'e.g. 500 mg' },
  { key: 'dose', label: 'Dose', placeholder: 'e.g. 1 tablet' },
  { key: 'route', label: 'Route', placeholder: 'e.g. oral' },
  { key: 'frequency', label: 'Frequency', placeholder: 'e.g. twice daily' },
  { key: 'duration', label: 'Duration', placeholder: 'e.g. 5 days' },
  { key: 'instructions', label: 'Instructions', wide: true },
];
const emptyItem = (): ItemForm => ({ medicine: '', strength: '', dose: '', route: '', frequency: '', duration: '', instructions: '' });

const toForm = (v: Pick<Visit, FormKey>): Record<FormKey, string> =>
  Object.fromEntries(FORM_KEYS.map((k) => [k, v[k] ?? ''])) as Record<FormKey, string>;
const toItemsForm = (items: PrescriptionItem[]): ItemForm[] =>
  items.map((i) => Object.fromEntries(ITEM_FIELDS.map((f) => [f.key, i[f.key] ?? ''])) as ItemForm);
/** Drops untouched blank rows and converts empty strings to null, matching what the server stores. */
const normItems = (items: ItemForm[]): PrescriptionItem[] =>
  items
    .filter((i) => Object.values(i).some((x) => x.trim() !== ''))
    .map((i) => Object.fromEntries(ITEM_FIELDS.map((f) => [f.key, i[f.key].trim() === '' ? null : i[f.key].trim()])) as unknown as PrescriptionItem);

function fmtVitals(v: VitalsEntry): string {
  const parts: string[] = [];
  if (v.systolicMmhg != null) parts.push(`BP ${v.systolicMmhg}/${v.diastolicMmhg} mmHg`);
  if (v.pulseBpm != null) parts.push(`Pulse ${v.pulseBpm} bpm`);
  if (v.temperatureC != null) parts.push(`Temp ${v.temperatureC} °C`);
  if (v.weightKg != null) parts.push(`Weight ${v.weightKg} kg`);
  if (v.heightCm != null) parts.push(`Height ${v.heightCm} cm`);
  return parts.join(' · ');
}

export function VisitPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [form, setForm] = useState<Record<FormKey, string>>(() => toForm({ complaints: null, history: null, examination: null, assessment: null, antenatalNotes: null, investigations: null, advice: null, followUpDate: null }));
  const [items, setItems] = useState<ItemForm[]>([]);
  const [amending, setAmending] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmFinalise, setConfirmFinalise] = useState(false);
  const [viewing, setViewing] = useState<{ no: number; snapshot: Record<string, unknown> & { prescriptionItems: PrescriptionItem[] } } | null>(null);

  const adopt = useCallback((v: Visit) => {
    setVisit(v);
    setForm(toForm(v));
    setItems(toItemsForm(v.prescriptionItems));
  }, []);

  const load = useCallback(async () => {
    try {
      adopt(await api<Visit>('GET', `/api/visits/${id}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e);
    }
  }, [id, adopt]);

  useEffect(() => {
    setVisit(null);
    setAmending(false);
    setViewing(null);
    setError(null);
    setNotice(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (error) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [error]);

  const base = useMemo(() => (visit ? toForm(visit) : null), [visit]);
  const changes = useMemo(() => {
    const out: Record<string, string | null | PrescriptionItem[]> = {};
    if (!visit || !base) return out;
    for (const k of FORM_KEYS) if (form[k] !== base[k]) out[k] = form[k].trim() === '' ? null : form[k].trim();
    const now = normItems(items);
    if (JSON.stringify(now) !== JSON.stringify(visit.prescriptionItems)) out.prescriptionItems = now;
    return out;
  }, [visit, base, form, items]);
  const dirty = Object.keys(changes).length > 0;

  if (loadError) return <div className="page narrow"><ErrorBanner error={loadError} /><Link to="/">Back to Today</Link></div>;
  if (!visit) return <p className="muted">Loading…</p>;

  const isDraft = visit.status === 'draft';
  const editable = (isDraft && can('visit:write')) || amending;
  const fe = fieldErrorsOf(error);
  const conflict = error instanceof ApiError && error.status === 409;

  async function run(fn: () => Promise<Visit | void>, okMsg?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const v = await fn();
      if (v) adopt(v);
      if (okMsg) setNotice(okMsg);
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const saveDraft = () => run(() => api<Visit>('PATCH', `/api/visits/${visit.id}`, { version: visit.version, ...changes }), 'Draft saved.');

  async function finalise() {
    setConfirmFinalise(false);
    await run(async () => {
      let v = visit!;
      if (dirty) v = await api<Visit>('PATCH', `/api/visits/${v.id}`, { version: v.version, ...changes });
      return api<Visit>('POST', `/api/visits/${v.id}/finalise`, { version: v.version });
    }, 'Consultation finalised. The notes are now locked; later corrections need a reason and are recorded.');
  }

  async function submitAmendment(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() => api<Visit>('POST', `/api/visits/${visit!.id}/amend`, { version: visit!.version, reason, ...changes }), 'Amendment recorded.');
    if (ok) {
      setAmending(false);
      setReason('');
    }
  }

  async function viewRevision(no: number) {
    if (viewing?.no === no) return setViewing(null);
    try {
      setViewing(await api('GET', `/api/visits/${visit!.id}/revisions/${no}`).then((r) => ({ no, snapshot: (r as { snapshot: never }).snapshot })));
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div className="page narrow">
      <p>
        <Link to="/">← Today</Link> · <Link to={`/patients/${visit.patientId}`}>Patient record</Link>
      </p>
      <header className="patient-head">
        <div>
          <h1>{visit.patientName}</h1>
          <div className="muted">
            {visit.patientNumber} · {formatAge(visit.ageYears, visit.ageIsEstimated)} · Visit {visit.visitDate} {visit.visitTime}
          </div>
        </div>
        <span className={`badge ${isDraft ? 'warn' : 'ok'}`}>{isDraft ? 'Draft' : `Finalised${visit.finalisedByName ? ` by ${visit.finalisedByName}` : ''}`}</span>
      </header>
      <div className={`allergy-banner ${visit.allergyStatus}`}>
        <AllergyBadge status={visit.allergyStatus} details={visit.allergyDetails} />
      </div>

      <ErrorBanner error={error} />
      {conflict && (
        <button className="btn" onClick={() => { setError(null); void load(); }}>
          Reload the latest version (your unsaved changes will be lost)
        </button>
      )}
      {notice && <div className="banner ok" role="status">{notice}</div>}

      <VitalsCard visit={visit} canAdd={isDraft && can('vitals:write')} onAdded={adopt} />

      <form onSubmit={(e) => { e.preventDefault(); if (isDraft) void saveDraft(); }} className="stack">
        <fieldset className="card" disabled={!editable}>
          <legend>Consultation{!editable && <span className="muted small"> (read only)</span>}</legend>
          <div className="stack">
            {TEXT_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} error={fe[f.key]}>
                <textarea rows={3} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              </Field>
            ))}
            <Field label="Follow-up date" error={fe.followUpDate}>
              <input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="card" disabled={!editable}>
          <legend>Prescription{!editable && <span className="muted small"> (read only)</span>}</legend>
          {items.length === 0 && <p className="muted">{editable ? 'No medicines added.' : 'No medicines prescribed.'}</p>}
          <div className="stack">
            {items.map((it, i) => (
              <div key={i} className="rx-item">
                <div className="rx-head">
                  <strong>#{i + 1}</strong>
                  {editable && (
                    <button type="button" className="btn small" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid2">
                  {ITEM_FIELDS.map((f) => (
                    <div key={f.key} className={f.wide ? 'span2' : ''}>
                      <Field label={f.label} error={fe[`prescriptionItems.${i}.${f.key}`]}>
                        <input
                          value={it[f.key]}
                          placeholder={editable ? f.placeholder : undefined}
                          onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))}
                        />
                      </Field>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {editable && items.length < 30 && (
            <p>
              <button type="button" className="btn" onClick={() => setItems([...items, emptyItem()])}>
                + Add medicine
              </button>
            </p>
          )}
          {editable && <p className="muted small">Doses and medicines are entered by the doctor; the system never suggests them.</p>}
        </fieldset>

        {amending && (
          <div className="card stack">
            <h2>Amendment</h2>
            <p className="muted">The original finalised version stays on record. Say why you are changing it.</p>
            <Field label="Reason for amendment" error={fe.reason}>
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            </Field>
          </div>
        )}

        <div className="sticky-actions">
          {isDraft && can('visit:write') && (
            <>
              <button className="btn" disabled={busy || !dirty}>
                {busy ? 'Saving…' : 'Save draft'}
              </button>
              {can('visit:finalise') &&
                (confirmFinalise ? (
                  <>
                    <button type="button" className="btn primary" disabled={busy} onClick={() => void finalise()}>
                      Confirm: finalise and lock
                    </button>
                    <button type="button" className="btn" onClick={() => setConfirmFinalise(false)}>
                      Not yet
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn primary" disabled={busy} onClick={() => setConfirmFinalise(true)}>
                    Finalise consultation
                  </button>
                ))}
              {dirty && <span className="muted small">Unsaved changes</span>}
            </>
          )}
          {!isDraft && can('visit:finalise') && !amending && (
            <button type="button" className="btn" onClick={() => setAmending(true)}>
              Amend (with reason)
            </button>
          )}
          {amending && (
            <>
              <button type="button" className="btn primary" disabled={busy || !dirty || reason.trim().length < 5} onClick={(e) => void submitAmendment(e as unknown as FormEvent)}>
                {busy ? 'Saving…' : 'Save amendment'}
              </button>
              <button type="button" className="btn" onClick={() => { setAmending(false); setReason(''); adopt(visit); }}>
                Cancel
              </button>
            </>
          )}
        </div>
      </form>

      {visit.revisions.length > 0 && (
        <section className="card stack">
          <h2>History of this record</h2>
          <ul className="cards">
            {visit.revisions.map((r) => (
              <li key={r.revisionNo}>
                <div className="row wrap">
                  <strong>{r.kind === 'final' ? 'Finalised' : `Amendment ${r.revisionNo - 1}`}</strong>
                  <span className="muted">
                    {r.authorName} · {r.atDate} {r.atTime}
                  </span>
                  <button type="button" className="link" onClick={() => void viewRevision(r.revisionNo)}>
                    {viewing?.no === r.revisionNo ? 'hide this version' : 'view this version'}
                  </button>
                </div>
                {r.reason && <div>Reason: {r.reason}</div>}
                {r.changes && <div className="muted small">Changed: {Object.keys(r.changes).map((k) => LABEL[k] ?? k).join(', ')}</div>}
                {viewing?.no === r.revisionNo && <Snapshot snapshot={viewing.snapshot} />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Snapshot({ snapshot }: { snapshot: Record<string, unknown> & { prescriptionItems: PrescriptionItem[] } }) {
  return (
    <div className="snapshot">
      {TEXT_FIELDS.map((f) => (
        <p key={f.key}><strong>{f.label}:</strong> {(snapshot[f.key] as string | null) ?? '—'}</p>
      ))}
      <p><strong>Follow-up date:</strong> {(snapshot.followUpDate as string | null) ?? '—'}</p>
      <p><strong>Prescription:</strong></p>
      {snapshot.prescriptionItems.length === 0 ? <p>—</p> : (
        <ol>
          {snapshot.prescriptionItems.map((i, n) => (
            <li key={n}>{[i.medicine, i.strength, i.dose, i.route, i.frequency, i.duration, i.instructions].filter(Boolean).join(' · ')}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

function VitalsCard({ visit, canAdd, onAdded }: { visit: Visit; canAdd: boolean; onAdded: (v: Visit) => void }) {
  const empty = { systolicMmhg: '', diastolicMmhg: '', pulseBpm: '', temperatureC: '', weightKg: '', heightCm: '', note: '' };
  const [f, setF] = useState(empty);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fe = fieldErrorsOf(error);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: Record<string, number | string | null> = {};
    for (const [k, val] of Object.entries(f)) {
      if (val.trim() === '') continue;
      body[k] = k === 'note' ? val.trim() : Number(val);
    }
    try {
      onAdded(await api<Visit>('POST', `/api/visits/${visit.id}/vitals`, body));
      setF(empty);
      setOpen(false);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const num = (key: keyof typeof empty, label: string, step = '1') => (
    <Field label={label} error={fe[key]}>
      <input type="number" inputMode="decimal" step={step} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
    </Field>
  );

  return (
    <section className="card stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h2 style={{ margin: 0 }}>Vitals</h2>
        {canAdd && !open && (
          <button className="btn primary" onClick={() => setOpen(true)}>
            + Record vitals
          </button>
        )}
      </div>
      {visit.vitals.length === 0 && !open && <p className="muted">No vitals recorded yet.</p>}
      <ul className="cards">
        {visit.vitals.map((v) => (
          <li key={v.id}>
            <div>{fmtVitals(v)}</div>
            <div className="muted small">
              {v.recordedTime} · {v.recordedByName}
              {v.note ? ` · ${v.note}` : ''}
            </div>
          </li>
        ))}
      </ul>
      {open && (
        <form onSubmit={submit} className="stack">
          <ErrorBanner error={error} />
          <div className="grid2">
            {num('systolicMmhg', 'Systolic BP (mmHg)')}
            {num('diastolicMmhg', 'Diastolic BP (mmHg)')}
            {num('pulseBpm', 'Pulse (beats/min)')}
            {num('temperatureC', 'Temperature (°C)', '0.1')}
            {num('weightKg', 'Weight (kg)', '0.1')}
            {num('heightCm', 'Height (cm)', '0.1')}
          </div>
          <Field label="Note (optional)" error={fe.note}>
            <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={500} />
          </Field>
          <div className="row">
            <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save reading'}</button>
            <button type="button" className="btn" onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
          </div>
          <p className="muted small">Each reading is saved as its own entry with your name and time. To correct a value, add a new reading.</p>
        </form>
      )}
    </section>
  );
}
