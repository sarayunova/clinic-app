import { useState, type FormEvent } from 'react';
import { api, type Admission, type MedRecord, type MedicineOrder } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, Field, fieldErrorsOf, todayLocal } from './ui';

const OUTCOME_LABEL = { given: 'Given', withheld: 'Withheld', refused: 'Refused' } as const;

/** Optional "this happened earlier" date and time inputs. */
function WhenFields({ prefix, value, onChange, errors }: { prefix: string; value: { date: string; time: string }; onChange: (v: { date: string; time: string }) => void; errors: Record<string, string> }) {
  return (
    <div className="grid2">
      <Field label="Date" error={errors[`${prefix}Date`]}>
        <input type="date" max={todayLocal()} value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} required />
      </Field>
      <Field label="Time">
        <input type="time" value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} required />
      </Field>
    </div>
  );
}

export function Medicines({ adm, onChanged, onNotice }: { adm: Admission; onChanged: () => Promise<void>; onNotice: (s: string) => void }) {
  const { can } = useAuth();
  const active = adm.status === 'admitted';
  const orders = adm.orders ?? [];
  const [adding, setAdding] = useState(false);
  return (
    <section>
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <h2>Medicines</h2>
        {active && can('order:write') && !adding && <button className="btn" onClick={() => setAdding(true)}>+ Order a medicine</button>}
      </div>
      {adding && <OrderForm adm={adm} onDone={async () => { setAdding(false); await onChanged(); onNotice('Medicine ordered.'); }} onCancel={() => setAdding(false)} />}
      {orders.length === 0 && !adding && <div className="empty"><p>No medicines ordered.</p></div>}
      <ul className="cards">
        {[...orders].reverse().map((o) => (
          <OrderCard key={o.id} adm={adm} o={o} active={active} onChanged={async (m) => { await onChanged(); onNotice(m); }} />
        ))}
      </ul>
      <p className="muted small">The doctor orders; the nurse records what was actually given, withheld or refused. The system does not check doses or interactions.</p>
    </section>
  );
}

function OrderForm({ adm, onDone, onCancel }: { adm: Admission; onDone: () => Promise<void>; onCancel: () => void }) {
  const [f, setF] = useState({ medicine: '', strength: '', dose: '', route: '', frequency: '', instructions: '' });
  const [later, setLater] = useState(false);
  const [when, setWhen] = useState({ date: '', time: '' });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fe = fieldErrorsOf(error);
  const text = (k: keyof typeof f, label: string, required = false, hint?: string) => (
    <Field label={label} error={fe[k]} hint={hint}>
      <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} required={required} maxLength={200} />
    </Field>
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: Record<string, string> = {};
    for (const [k, v] of Object.entries(f)) if (v.trim()) body[k] = v.trim();
    if (later) Object.assign(body, { startDate: when.date, startTime: when.time });
    try {
      await api('POST', `/api/admissions/${adm.id}/orders`, body);
      await onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card stack">
      <ErrorBanner error={error} />
      <div className="grid2">
        {text('medicine', 'Medicine', true)}
        {text('strength', 'Strength')}
        {text('dose', 'Dose', true, 'e.g. 1 tablet, 100 mg')}
        {text('route', 'Route', false, 'e.g. oral, IV')}
        {text('frequency', 'Frequency', true, 'e.g. every 8 hours')}
      </div>
      <Field label="Instructions" error={fe.instructions}>
        <input value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} maxLength={500} />
      </Field>
      <label className="row">
        <input type="checkbox" style={{ width: 'auto', minHeight: 'auto' }} checked={later} onChange={(e) => setLater(e.target.checked)} />
        <span>Started earlier (set the actual time)</span>
      </label>
      {later && <WhenFields prefix="start" value={when} onChange={setWhen} errors={fe} />}
      <div className="row">
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save order'}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function OrderCard({ adm, o, active, onChanged }: { adm: Admission; o: MedicineOrder; active: boolean; onChanged: (notice: string) => Promise<void> }) {
  const { can } = useAuth();
  const [mode, setMode] = useState<'none' | 'record' | 'stop'>('none');
  const [correcting, setCorrecting] = useState<number | null>(null);
  const live = active && o.active;
  const records = [...o.records].reverse();
  return (
    <li className={`card ${o.active ? '' : 'inactive'}`}>
      <div className="row wrap">
        <strong>{o.medicine}</strong>
        {o.strength && <span>{o.strength}</span>}
        <span className={`badge ${o.active ? 'ok' : ''}`}>{o.active ? 'Active' : 'Stopped'}</span>
      </div>
      <div>
        {o.dose}
        {o.route ? ` · ${o.route}` : ''} · {o.frequency}
      </div>
      {o.instructions && <div className="muted">{o.instructions}</div>}
      <div className="muted small">
        Ordered by {o.orderedByName} · from {o.startDate} {o.startTime}
        {!o.active && ` · stopped ${o.stoppedDate} ${o.stoppedTime}${o.stopReason ? ` (${o.stopReason})` : ''}`}
      </div>

      {live && mode === 'none' && (
        <div className="row wrap">
          {can('med:administer') && <button className="btn small primary" onClick={() => setMode('record')}>Record dose</button>}
          {can('order:write') && <button className="btn small" onClick={() => setMode('stop')}>Stop</button>}
        </div>
      )}
      {live && mode === 'record' && <RecordForm adm={adm} o={o} onDone={async () => { setMode('none'); await onChanged('Recorded.'); }} onCancel={() => setMode('none')} />}
      {live && mode === 'stop' && <StopForm adm={adm} o={o} onDone={async () => { setMode('none'); await onChanged('Medicine stopped.'); }} onCancel={() => setMode('none')} />}

      {records.length > 0 && (
        <ul className="plain">
          {records.map((r) => (
            <li key={r.id}>
              <RecordView r={r} superseded={r.corrections.length > 0} />
              {r.corrections.map((c) => (
                <div key={c.id} className="correction">
                  <div className="muted small"><strong>Correction</strong> · {c.recordedByName} · recorded {c.createdDate} {c.createdTime}</div>
                  <div>Reason: {c.correctionReason}</div>
                  <RecordView r={c} bare />
                </div>
              ))}
              {active && r.canCorrect && correcting !== r.id && <button className="link" onClick={() => setCorrecting(r.id)}>Correct this record</button>}
              {correcting === r.id && (
                <RecordForm
                  adm={adm}
                  o={o}
                  correct={r.corrections[r.corrections.length - 1] ?? r}
                  correctId={r.id}
                  onDone={async () => { setCorrecting(null); await onChanged('Correction recorded.'); }}
                  onCancel={() => setCorrecting(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function RecordView({ r, superseded = false, bare = false }: { r: MedRecord; superseded?: boolean; bare?: boolean }) {
  return (
    <div className={superseded ? 'superseded' : ''}>
      <div className="row wrap">
        <span className={`badge ${r.outcome === 'given' ? 'ok' : 'warn'}`}>{OUTCOME_LABEL[r.outcome]}</span>
        <strong>{r.givenDate} {r.givenTime}</strong>
        {r.doseGiven && <span>{r.doseGiven}</span>}
        {!bare && <span className="muted">{r.recordedByName}</span>}
        {r.scheduledDate && <span className="muted small">due {r.scheduledDate} {r.scheduledTime}</span>}
        {superseded && <span className="badge warn">Corrected below</span>}
      </div>
      {r.reason && <div className="muted">{r.reason}</div>}
    </div>
  );
}

function RecordForm({ adm, o, correct, correctId, onDone, onCancel }: { adm: Admission; o: MedicineOrder; correct?: MedRecord; correctId?: number; onDone: () => Promise<void>; onCancel: () => void }) {
  const [outcome, setOutcome] = useState<MedRecord['outcome']>(correct?.outcome ?? 'given');
  const [dose, setDose] = useState(correct?.doseGiven ?? o.dose);
  const [reason, setReason] = useState(correct?.reason ?? '');
  const [fix, setFix] = useState('');
  const [later, setLater] = useState(false);
  const [when, setWhen] = useState({ date: correct?.givenDate ?? '', time: correct?.givenTime ?? '' });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fe = fieldErrorsOf(error);
  const isFix = correctId != null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { outcome };
    if (outcome === 'given' && dose.trim()) body.dose = dose.trim();
    if (outcome !== 'given') body.reason = reason.trim();
    if (isFix) {
      body.correctionReason = fix.trim();
      body.givenDate = when.date;
      body.givenTime = when.time;
    } else if (later) {
      body.givenDate = when.date;
      body.givenTime = when.time;
    }
    const url = isFix ? `/api/admissions/${adm.id}/orders/${o.id}/records/${correctId}/correct` : `/api/admissions/${adm.id}/orders/${o.id}/records`;
    try {
      await api('POST', url, body);
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
      {isFix && <p className="muted small">Enter the full corrected record. The original stays on record.</p>}
      <Field label="What happened">
        <select value={outcome} onChange={(e) => setOutcome(e.target.value as MedRecord['outcome'])}>
          <option value="given">Given</option>
          <option value="withheld">Withheld (not given)</option>
          <option value="refused">Refused by patient</option>
        </select>
      </Field>
      {outcome === 'given' ? (
        <Field label="Dose given" error={fe.dose}>
          <input value={dose} onChange={(e) => setDose(e.target.value)} maxLength={100} required />
        </Field>
      ) : (
        <Field label="Reason" error={fe.reason}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
        </Field>
      )}
      {!isFix && (
        <label className="row">
          <input type="checkbox" style={{ width: 'auto', minHeight: 'auto' }} checked={later} onChange={(e) => setLater(e.target.checked)} />
          <span>This happened earlier (set the actual time)</span>
        </label>
      )}
      {(later || isFix) && <WhenFields prefix="given" value={when} onChange={setWhen} errors={fe} />}
      {isFix && (
        <Field label="Reason for correction" error={fe.correctionReason}>
          <input value={fix} onChange={(e) => setFix(e.target.value)} maxLength={500} required />
        </Field>
      )}
      <div className="row">
        <button className="btn primary" disabled={busy || (isFix && fix.trim().length < 5)}>{busy ? 'Saving…' : isFix ? 'Save correction' : 'Save'}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function StopForm({ adm, o, onDone, onCancel }: { adm: Admission; o: MedicineOrder; onDone: () => Promise<void>; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('POST', `/api/admissions/${adm.id}/orders/${o.id}/stop`, { reason: reason.trim() });
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
      <Field label="Reason for stopping" error={fieldErrorsOf(error).reason}>
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
      </Field>
      <div className="row">
        <button className="btn primary" disabled={busy || reason.trim().length < 3}>{busy ? 'Saving…' : 'Stop medicine'}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
