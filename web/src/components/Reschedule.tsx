import { useState, type FormEvent } from 'react';
import { api, type Appointment } from '../api';
import { ErrorBanner, Field, fieldErrorsOf, todayLocal } from './ui';

/** Moves a scheduled appointment to another date/time (and optionally changes the reason). */
export function Reschedule({ appointment, onDone, onCancel }: { appointment: Appointment; onDone: () => void; onCancel: () => void }) {
  const [date, setDate] = useState(appointment.scheduledDate);
  const [time, setTime] = useState(appointment.scheduledTime);
  const [reason, setReason] = useState(appointment.reason);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fe = fieldErrorsOf(error);
  const unchanged = date === appointment.scheduledDate && time === appointment.scheduledTime && reason === appointment.reason;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('PATCH', `/api/appointments/${appointment.id}/reschedule`, { date, time, reason, version: appointment.version });
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack" style={{ marginTop: '0.6rem' }}>
      <ErrorBanner error={error} />
      <div className="grid2">
        <Field label="New date" error={fe.date}>
          <input type="date" value={date} min={todayLocal()} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="New time" error={fe.time}>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
      </div>
      <Field label="Reason for visit" error={fe.reason}>
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
      </Field>
      <div className="row">
        <button className="btn primary" disabled={busy || unchanged}>{busy ? 'Saving…' : 'Move appointment'}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
