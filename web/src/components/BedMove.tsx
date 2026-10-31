import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, type Admission, type Bed } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, Field, fieldErrorsOf, todayLocal } from './ui';

/** Where this patient has been, and (while admitted) a form to move them to a free bed. */
export function BedMove({ adm, onMoved }: { adm: Admission; onMoved: (a: Admission) => void }) {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const active = adm.status === 'admitted';
  const transfers = adm.transfers ?? [];
  if (!(active && can('bed:transfer')) && transfers.length === 0) return null;

  return (
    <section className="card stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Bed</h2>
        {active && can('bed:transfer') && !open && (
          <button className="btn small" onClick={() => setOpen(true)}>Move to another bed…</button>
        )}
      </div>
      <div>
        Now: <strong>{adm.bedRoom} / Bed {adm.bedLabel}</strong>
      </div>
      {open && (
        <MoveForm
          adm={adm}
          onCancel={() => setOpen(false)}
          onDone={(a) => {
            setOpen(false);
            onMoved(a);
          }}
        />
      )}
      {transfers.length > 0 && (
        <div>
          <div className="muted small">Moves so far</div>
          <ul className="list">
            {transfers.map((t) => (
              <li key={t.id} className="small">
                <strong>{t.date} {t.time}</strong> · {t.fromRoom} / {t.fromLabel} → {t.toRoom} / {t.toLabel}
                <span className="muted"> · {t.reason} · {t.byName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function MoveForm({ adm, onDone, onCancel }: { adm: Admission; onDone: (a: Admission) => void; onCancel: () => void }) {
  const [beds, setBeds] = useState<Bed[] | null>(null);
  const [toBedId, setToBedId] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fe = fieldErrorsOf(error);

  useEffect(() => {
    api<Bed[]>('GET', '/api/beds').then(setBeds, setError);
  }, []);
  const free = useMemo(() => (beds ?? []).filter((b) => b.active && !b.occupied), [beds]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onDone(
        await api<Admission>('POST', `/api/admissions/${adm.id}/transfer`, {
          toBedId: Number(toBedId),
          reason,
          version: adm.version,
          ...(date || time ? { transferDate: date, transferTime: time } : {}),
        }),
      );
    } catch (err) {
      setError(err);
      // The ward may have changed while the form was open: show the beds as they are now.
      api<Bed[]>('GET', '/api/beds').then(setBeds, () => {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <ErrorBanner error={error} />
      <Field label="Move to" error={fe.toBedId}>
        <select value={toBedId} onChange={(e) => setToBedId(e.target.value)} required>
          <option value="">{beds === null ? 'Loading…' : free.length ? 'Choose a free bed' : 'No free beds'}</option>
          {free.map((b) => (
            <option key={b.id} value={b.id}>{b.room} / {b.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Reason for the move" error={fe.reason} hint="For example: needs isolation, moved to a private room, patient request">
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} required />
      </Field>
      <div className="grid2">
        <Field label="Moved on (leave blank for now)" error={fe.transferDate}>
          <input type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="At" error={fe.transferTime}>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <div className="row">
        <button className="btn primary" disabled={busy || !toBedId || reason.trim().length < 2}>{busy ? 'Moving…' : 'Move patient'}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
