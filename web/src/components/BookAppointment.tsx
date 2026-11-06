import { useState, type FormEvent } from 'react';
import { api, type PatientSummary } from '../api';
import { ErrorBanner, Field, fieldErrorsOf, todayLocal } from './ui';
import { PatientPicker } from './PatientPicker';

function nextHalfHour(): string {
  const d = new Date(Date.now() + 15 * 60_000);
  const m = d.getMinutes() < 30 ? '00' : '30';
  const h = d.getMinutes() < 30 ? d.getHours() : d.getHours() + 1;
  return `${String(h % 24).padStart(2, '0')}:${m}`;
}

/** Books an appointment. Pass `patient` to fix the patient, or omit to search for one. */
export function BookAppointment({
  patient,
  defaultDate,
  defaultReason,
  onBooked,
  onCancel,
}: {
  patient?: { id: number; name: string };
  defaultDate?: string;
  defaultReason?: string;
  onBooked: () => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<PatientSummary | null>(null);
  const [date, setDate] = useState(defaultDate && defaultDate >= todayLocal() ? defaultDate : todayLocal());
  const [time, setTime] = useState(nextHalfHour());
  const [reason, setReason] = useState(defaultReason ?? '');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fe = fieldErrorsOf(error);

  const target = patient ?? (picked ? { id: picked.id, name: picked.fullName } : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/api/appointments', { patientId: target.id, date, time, reason });
      onBooked();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card stack">
      <h2>Book appointment</h2>
      {!patient && !picked && <PatientPicker onPick={setPicked} autoFocus />}
      {target && (
        <p>
          Patient: <strong>{target.name}</strong>
          {!patient && (
            <>
              {' '}
              <button type="button" className="link" onClick={() => setPicked(null)}>
                change
              </button>
            </>
          )}
        </p>
      )}
      <ErrorBanner error={error} />
      {target && (
        <>
          <div className="grid2">
            <Field label="Date" error={fe.date}>
              <input type="date" value={date} min={todayLocal()} onChange={(e) => setDate(e.target.value)} required />
            </Field>
            <Field label="Time" error={fe.time}>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </Field>
          </div>
          <Field label="Reason for visit" error={fe.reason}>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
          </Field>
        </>
      )}
      <div className="row">
        <button className="btn primary" disabled={!target || busy}>
          {busy ? 'Booking…' : 'Book'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
