import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api, type Admission, type CareEntry, type EntryType } from '../api';
import { useAuth } from '../auth';
import { Medicines } from '../components/Medicines';
import { Discharge } from '../components/Discharge';
import { AllergyBadge, ErrorBanner, Field, fieldErrorsOf, formatAge, todayLocal } from '../components/ui';

const TYPE_LABEL: Record<EntryType, string> = {
  doctor_round: 'Doctor round',
  nursing_note: 'Nursing note',
  observation: 'Observation',
  procedure: 'Procedure',
  investigation: 'Investigation',
};
const CLINICAL_TYPES: EntryType[] = ['doctor_round', 'procedure', 'investigation'];
const NURSING_TYPES: EntryType[] = ['nursing_note', 'observation'];

const MEASURES = [
  { key: 'systolicMmhg', label: 'Systolic BP (mmHg)', step: '1' },
  { key: 'diastolicMmhg', label: 'Diastolic BP (mmHg)', step: '1' },
  { key: 'pulseBpm', label: 'Pulse (beats/min)', step: '1' },
  { key: 'temperatureC', label: 'Temperature (°C)', step: '0.1' },
  { key: 'spo2Pct', label: 'Oxygen saturation (%)', step: '1' },
  { key: 'respRate', label: 'Respiratory rate (breaths/min)', step: '1' },
] as const;
type MeasureKey = (typeof MEASURES)[number]['key'];

function fmtObs(e: CareEntry): string {
  const p: string[] = [];
  if (e.systolicMmhg != null) p.push(`BP ${e.systolicMmhg}/${e.diastolicMmhg} mmHg`);
  if (e.pulseBpm != null) p.push(`Pulse ${e.pulseBpm} bpm`);
  if (e.temperatureC != null) p.push(`Temp ${e.temperatureC} °C`);
  if (e.spo2Pct != null) p.push(`SpO₂ ${e.spo2Pct}%`);
  if (e.respRate != null) p.push(`Resp ${e.respRate}/min`);
  return p.join(' · ');
}

const toBody = (vals: Record<string, string>, keys: readonly string[]) => {
  const out: Record<string, string | number> = {};
  for (const k of keys) {
    const v = (vals[k] ?? '').trim();
    if (v === '') continue;
    out[k] = k === 'content' ? v : Number(v);
  }
  return out;
};

export function AdmissionPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [adm, setAdm] = useState<Admission | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      setAdm(await api<Admission>('GET', `/api/admissions/${id}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e);
    }
  }, [id]);

  useEffect(() => {
    setAdm(null);
    setNotice(null);
    void load();
  }, [load]);

  if (loadError) return <div className="page narrow"><ErrorBanner error={loadError} /><Link to="/wards">Back to wards</Link></div>;
  if (!adm) return <p className="muted">Loading…</p>;

  const clinical = can('ipd:read');
  const active = adm.status === 'admitted';

  return (
    <div className="page narrow">
      <p>
        <Link to="/wards">← Wards</Link> · <Link to={`/patients/${adm.patientId}`}>Patient record</Link>
      </p>
      <header className="patient-head">
        <div>
          <h1>{adm.patientName}</h1>
          <div className="muted">
            {adm.patientNumber} · {formatAge(adm.ageYears, adm.ageIsEstimated)} · {adm.admissionNumber}
          </div>
          <div className="muted">
            {adm.bedRoom} / Bed {adm.bedLabel} · Admitted {adm.admittedDate} {adm.admittedTime}
            {adm.dayNumber ? ` · Day ${adm.dayNumber}` : ''}
          </div>
        </div>
        <span className={`badge ${active ? 'ok' : ''}`}>{active ? 'Admitted' : 'Discharged'}</span>
      </header>
      <div className={`allergy-banner ${adm.allergyStatus}`}>
        <AllergyBadge status={adm.allergyStatus} details={adm.allergyDetails} />
      </div>
      <ErrorBanner error={error} />
      {notice && <div className="banner ok" role="status">{notice}</div>}

      {!clinical && <p className="muted">Clinical details are visible to the doctor and nurses only.</p>}
      {clinical && (
        <>
          <Details adm={adm} canEdit={can('admission:write') && active} onSaved={(a) => { setAdm(a); setNotice('Saved.'); }} onError={setError} />
          {active && <AddEntry adm={adm} onAdded={(a) => { setAdm(a); setNotice('Entry added.'); }} />}
          <Medicines adm={adm} onChanged={load} onNotice={setNotice} />
          <Discharge adm={adm} onChanged={load} onNotice={setNotice} />
          <Timeline adm={adm} onChanged={(a) => { setAdm(a); setNotice('Correction recorded.'); }} />
        </>
      )}
    </div>
  );
}

function Details({ adm, canEdit, onSaved, onError }: { adm: Admission; canEdit: boolean; onSaved: (a: Admission) => void; onError: (e: unknown) => void }) {
  const init = { reason: adm.reason ?? '', diagnosis: adm.diagnosis ?? '', initialAssessment: adm.initialAssessment ?? '', treatmentPlan: adm.treatmentPlan ?? '' };
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => setF(init), [adm.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const keys = Object.keys(init) as (keyof typeof init)[];
  const changed = keys.filter((k) => f[k].trim() !== init[k].trim());
  const conflict = err instanceof ApiError && err.status === 409;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    onError(null);
    const body: Record<string, string | null | number> = { version: adm.version };
    for (const k of changed) body[k] = f[k].trim() === '' ? null : f[k].trim();
    try {
      onSaved(await api<Admission>('PATCH', `/api/admissions/${adm.id}`, body));
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  }

  const field = (k: keyof typeof init, label: string, area = false) => (
    <Field label={label} error={fieldErrorsOf(err)[k]}>
      {area ? (
        <textarea rows={3} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      ) : (
        <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} maxLength={1000} />
      )}
    </Field>
  );

  return (
    <form onSubmit={save} className="stack">
      <fieldset className="card" disabled={!canEdit}>
        <legend>Admission details{!canEdit && <span className="muted small"> (read only)</span>}</legend>
        <div className="stack">
          <ErrorBanner error={err} />
          {conflict && <button type="button" className="btn" onClick={() => window.location.reload()}>Reload the latest version</button>}
          {field('reason', 'Reason for admission')}
          {field('diagnosis', 'Diagnosis')}
          {field('initialAssessment', 'Initial assessment', true)}
          {field('treatmentPlan', 'Treatment plan', true)}
          {canEdit && (
            <div>
              <button className="btn primary" disabled={busy || changed.length === 0}>{busy ? 'Saving…' : 'Save details'}</button>
              <span className="muted small"> Changes to the plan are kept in the audit history.</span>
            </div>
          )}
        </div>
      </fieldset>
    </form>
  );
}

function AddEntry({ adm, onAdded }: { adm: Admission; onAdded: (a: Admission) => void }) {
  const { can } = useAuth();
  const types: EntryType[] = [
    ...(can('care:write_nursing') ? NURSING_TYPES : []),
    ...(can('care:write_clinical') ? CLINICAL_TYPES : []),
  ];
  const [type, setType] = useState<EntryType>(types[0] ?? 'nursing_note');
  const empty: Record<string, string> = { content: '', systolicMmhg: '', diastolicMmhg: '', pulseBpm: '', temperatureC: '', spo2Pct: '', respRate: '' };
  const [v, setV] = useState(empty);
  const [later, setLater] = useState(false);
  const [when, setWhen] = useState({ clinicalDate: '', clinicalTime: '' });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fe = fieldErrorsOf(error);
  if (types.length === 0) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { type, ...toBody(v, ['content', ...(type === 'observation' ? MEASURES.map((m) => m.key) : [])]) };
    if (later) Object.assign(body, when.clinicalDate ? { clinicalDate: when.clinicalDate } : {}, when.clinicalTime ? { clinicalTime: when.clinicalTime } : {});
    try {
      onAdded(await api<Admission>('POST', `/api/admissions/${adm.id}/entries`, body));
      setV(empty);
      setLater(false);
      setWhen({ clinicalDate: '', clinicalTime: '' });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card stack">
      <h2 style={{ margin: 0 }}>Add entry</h2>
      <ErrorBanner error={error} />
      <Field label="Type">
        <select value={type} onChange={(e) => setType(e.target.value as EntryType)}>
          {types.map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t]}</option>
          ))}
        </select>
      </Field>
      {type === 'observation' && (
        <div className="grid2">
          {MEASURES.map((m) => (
            <Field key={m.key} label={m.label} error={fe[m.key]}>
              <input type="number" inputMode="decimal" step={m.step} value={v[m.key]} onChange={(e) => setV({ ...v, [m.key]: e.target.value })} />
            </Field>
          ))}
        </div>
      )}
      <Field label={type === 'observation' ? 'Note (optional)' : 'Entry'} error={fe.content}>
        <textarea rows={type === 'observation' ? 2 : 4} value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} />
      </Field>
      <label className="row">
        <input type="checkbox" style={{ width: 'auto', minHeight: 'auto' }} checked={later} onChange={(e) => setLater(e.target.checked)} />
        <span>This happened earlier (set the actual time)</span>
      </label>
      {later && (
        <div className="grid2">
          <Field label="Date" error={fe.clinicalDate}>
            <input type="date" max={todayLocal()} value={when.clinicalDate} onChange={(e) => setWhen({ ...when, clinicalDate: e.target.value })} required />
          </Field>
          <Field label="Time">
            <input type="time" value={when.clinicalTime} onChange={(e) => setWhen({ ...when, clinicalTime: e.target.value })} required />
          </Field>
        </div>
      )}
      <div><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Add to record'}</button></div>
      <p className="muted small">Entries are saved with your name and cannot be edited later. A mistake is fixed by adding a correction, and the original stays.</p>
    </form>
  );
}

function Timeline({ adm, onChanged }: { adm: Admission; onChanged: (a: Admission) => void }) {
  const entries = [...(adm.entries ?? [])].reverse(); // newest first
  const [correcting, setCorrecting] = useState<number | null>(null);
  return (
    <section>
      <h2>Care record</h2>
      {entries.length === 0 && <div className="empty"><p>No entries yet.</p><p className="muted">Doctor rounds, nursing notes and observations appear here.</p></div>}
      <ul className="cards">
        {entries.map((e) => (
          <li key={e.id} className="card">
            <EntryView e={e} superseded={e.corrections.length > 0} />
            {e.corrections.map((c) => (
              <div key={c.id} className="correction">
                <div className="muted small">
                  <strong>Correction</strong> · {c.authorName} · recorded {c.createdDate} {c.createdTime}
                </div>
                <div>Reason: {c.correctionReason}</div>
                <EntryView e={c} bare />
              </div>
            ))}
            {e.canCorrect && correcting !== e.id && (
              <button className="link" onClick={() => setCorrecting(e.id)}>
                Correct this entry
              </button>
            )}
            {correcting === e.id && (
              <CorrectForm adm={adm} entry={e} onDone={(a) => { setCorrecting(null); onChanged(a); }} onCancel={() => setCorrecting(null)} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EntryView({ e, superseded = false, bare = false }: { e: CareEntry; superseded?: boolean; bare?: boolean }) {
  return (
    <div className={superseded ? 'superseded' : ''}>
      {!bare && (
        <div className="row wrap">
          <span className="badge">{TYPE_LABEL[e.entryType]}</span>
          <strong>{e.clinicalDate} {e.clinicalTime}</strong>
          <span className="muted">{e.authorName}</span>
          {(e.createdDate !== e.clinicalDate || e.createdTime !== e.clinicalTime) && (
            <span className="muted small">recorded {e.createdDate} {e.createdTime}</span>
          )}
          {superseded && <span className="badge warn">Corrected below</span>}
        </div>
      )}
      {fmtObs(e) && <div>{fmtObs(e)}</div>}
      {e.content && <div className="pre">{e.content}</div>}
    </div>
  );
}

function CorrectForm({ adm, entry, onDone, onCancel }: { adm: Admission; entry: CareEntry; onDone: (a: Admission) => void; onCancel: () => void }) {
  const latest = entry.corrections[entry.corrections.length - 1] ?? entry;
  const [v, setV] = useState<Record<string, string>>({
    content: latest.content ?? '',
    ...Object.fromEntries(MEASURES.map((m) => [m.key, latest[m.key as MeasureKey] == null ? '' : String(latest[m.key as MeasureKey])])),
  });
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fe = fieldErrorsOf(error);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = { ...toBody(v, ['content', ...(entry.entryType === 'observation' ? MEASURES.map((m) => m.key) : [])]), reason };
    try {
      onDone(await api<Admission>('POST', `/api/admissions/${adm.id}/entries/${entry.id}/correct`, body));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack correction-form">
      <ErrorBanner error={error} />
      <p className="muted small">Enter the full corrected entry. The original stays on record.</p>
      {entry.entryType === 'observation' && (
        <div className="grid2">
          {MEASURES.map((m) => (
            <Field key={m.key} label={m.label} error={fe[m.key]}>
              <input type="number" inputMode="decimal" step={m.step} value={v[m.key]} onChange={(e) => setV({ ...v, [m.key]: e.target.value })} />
            </Field>
          ))}
        </div>
      )}
      <Field label={entry.entryType === 'observation' ? 'Note' : 'Corrected entry'} error={fe.content}>
        <textarea rows={3} value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} />
      </Field>
      <Field label="Reason for correction" error={fe.reason}>
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
      </Field>
      <div className="row">
        <button className="btn primary" disabled={busy || reason.trim().length < 5}>{busy ? 'Saving…' : 'Save correction'}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
