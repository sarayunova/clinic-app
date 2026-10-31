import { useState, type FormEvent } from 'react';
import { api, type Admission } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, Field, fieldErrorsOf, todayLocal } from './ui';

const LONG: { key: string; label: string }[] = [
  { key: 'findings', label: 'Key findings and investigations' },
  { key: 'course', label: 'Course in hospital' },
  { key: 'procedures', label: 'Procedures done' },
  { key: 'dischargeMedicines', label: 'Medicines to take home' },
  { key: 'instructions', label: 'Instructions to the patient' },
  { key: 'warningSigns', label: 'Warning signs: when to come back' },
];

export function Discharge({ adm, onChanged, onNotice }: { adm: Admission; onChanged: () => Promise<void>; onNotice: (s: string) => void }) {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const d = adm.discharge;

  if (adm.status === 'admitted') {
    if (!can('discharge:write')) return null;
    return (
      <section>
        <h2>Discharge</h2>
        {!open ? (
          <button className="btn" onClick={() => setOpen(true)}>Discharge this patient…</button>
        ) : (
          <DischargeForm adm={adm} onCancel={() => setOpen(false)} onDone={async () => { await onChanged(); onNotice('Patient discharged. The bed is free.'); }} />
        )}
      </section>
    );
  }

  const s = d?.summary;
  return (
    <section>
      <h2>Discharge summary</h2>
      <div className="muted">Discharged {adm.dischargedDate} {adm.dischargedTime}</div>
      {s ? (
        <div className="card stack">
          <div><strong>Final diagnosis</strong><div className="pre">{s.finalDiagnosis}</div></div>
          <div><strong>Condition at discharge</strong><div className="pre">{s.conditionAtDischarge}</div></div>
          {LONG.map(({ key, label }) => {
            const v = (s as unknown as Record<string, string | null>)[key];
            return v ? <div key={key}><strong>{label}</strong><div className="pre">{v}</div></div> : null;
          })}
          {s.followUp && <div><strong>Follow-up</strong><div className="pre">{s.followUp}</div></div>}
          <div className="muted small">Written by {s.writtenByName} · finalised {s.finalisedDate} {s.finalisedTime}. It cannot be edited; later additions are listed below.</div>
        </div>
      ) : (
        <p className="muted">No summary was recorded.</p>
      )}
      {(d?.addenda ?? []).map((a) => (
        <div key={a.id} className="correction">
          <div className="muted small"><strong>Addendum</strong> · {a.authorName} · {a.createdDate} {a.createdTime} · {a.reason}</div>
          <div className="pre">{a.content}</div>
        </div>
      ))}
      {can('discharge:write') && <AddendumForm adm={adm} onDone={async () => { await onChanged(); onNotice('Addendum added.'); }} />}
    </section>
  );
}

function DischargeForm({ adm, onDone, onCancel }: { adm: Admission; onDone: () => Promise<void>; onCancel: () => void }) {
  const running = (adm.orders ?? []).filter((o) => o.active).map((o) => `${o.medicine}${o.strength ? ' ' + o.strength : ''} ${o.dose}, ${o.frequency}`).join('\n');
  const [f, setF] = useState<Record<string, string>>({
    finalDiagnosis: adm.diagnosis ?? '',
    conditionAtDischarge: '',
    findings: '',
    course: '',
    procedures: '',
    dischargeMedicines: running,
    instructions: '',
    warningSigns: '',
    followUp: '',
  });
  const [earlier, setEarlier] = useState(false);
  const [when, setWhen] = useState({ date: '', time: '' });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fe = fieldErrorsOf(error);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!window.confirm('Discharge this patient? This ends the admission and frees the bed. The summary cannot be edited afterwards.')) return;
    setBusy(true);
    setError(null);
    const body: Record<string, string> = {};
    for (const [k, v] of Object.entries(f)) if (v.trim()) body[k] = v.trim();
    if (earlier) Object.assign(body, { dischargeDate: when.date, dischargeTime: when.time });
    try {
      await api('POST', `/api/admissions/${adm.id}/discharge`, body);
      await onDone();
    } catch (err) {
      setError(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card stack">
      <ErrorBanner error={error} />
      <Field label="Final diagnosis" error={fe.finalDiagnosis}>
        <input value={f.finalDiagnosis} onChange={(e) => setF({ ...f, finalDiagnosis: e.target.value })} maxLength={1000} required />
      </Field>
      <Field label="Condition at discharge" error={fe.conditionAtDischarge}>
        <input value={f.conditionAtDischarge} onChange={(e) => setF({ ...f, conditionAtDischarge: e.target.value })} maxLength={1000} required />
      </Field>
      {LONG.map(({ key, label }) => (
        <Field key={key} label={label} error={fe[key]} hint={key === 'dischargeMedicines' && running ? 'Pre-filled from medicines still running; edit to what the patient should actually take.' : undefined}>
          <textarea rows={3} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
        </Field>
      ))}
      <Field label="Follow-up" error={fe.followUp}>
        <input value={f.followUp} onChange={(e) => setF({ ...f, followUp: e.target.value })} maxLength={1000} />
      </Field>
      <label className="row">
        <input type="checkbox" style={{ width: 'auto', minHeight: 'auto' }} checked={earlier} onChange={(e) => setEarlier(e.target.checked)} />
        <span>Left earlier (set the actual date and time)</span>
      </label>
      {earlier && (
        <div className="grid2">
          <Field label="Discharge date" error={fe.dischargeDate}>
            <input type="date" max={todayLocal()} value={when.date} onChange={(e) => setWhen({ ...when, date: e.target.value })} required />
          </Field>
          <Field label="Discharge time">
            <input type="time" value={when.time} onChange={(e) => setWhen({ ...when, time: e.target.value })} required />
          </Field>
        </div>
      )}
      <p className="muted small">Discharging stops any medicine still running. Unpaid bills do not block discharge.</p>
      <div className="row">
        <button className="btn primary" disabled={busy}>{busy ? 'Discharging…' : 'Discharge patient'}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function AddendumForm({ adm, onDone }: { adm: Admission; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fe = fieldErrorsOf(error);
  if (!open) return <div><button className="link" onClick={() => setOpen(true)}>Add an addendum</button></div>;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('POST', `/api/admissions/${adm.id}/addenda`, { content: content.trim(), reason: reason.trim() });
      setContent('');
      setReason('');
      setOpen(false);
      await onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="stack correction-form">
      <ErrorBanner error={error} />
      <Field label="Addendum" error={fe.content}>
        <textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} required />
      </Field>
      <Field label="Reason" error={fe.reason}>
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
      </Field>
      <div className="row">
        <button className="btn primary" disabled={busy || reason.trim().length < 5}>{busy ? 'Saving…' : 'Save addendum'}</button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
