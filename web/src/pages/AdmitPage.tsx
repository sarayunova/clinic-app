import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, type Admission, type Bed, type Patient, type PatientSummary } from '../api';
import { PatientPicker } from '../components/PatientPicker';
import { AllergyBadge, ErrorBanner, Field, fieldErrorsOf, formatAge, todayLocal } from '../components/ui';

export function AdmitPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [allergy, setAllergy] = useState<{ status: Patient['allergyStatus']; details: string | null } | null>(null);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [bedId, setBedId] = useState(params.get('bedId') ?? '');
  const [f, setF] = useState({ reason: '', diagnosis: '', initialAssessment: '', treatmentPlan: '', admittedDate: '', admittedTime: '' });
  const [backdate, setBackdate] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fe = fieldErrorsOf(error);

  useEffect(() => {
    api<Bed[]>('GET', '/api/beds').then(setBeds, setError);
    const pid = params.get('patientId');
    if (pid) {
      api<Patient>('GET', `/api/patients/${pid}`).then(
        (p) => setPatient({ id: p.id, patientNumber: p.patientNumber, fullName: p.fullName, phone: (p.phone as string | null) ?? null, ageYears: p.ageYears, ageIsEstimated: p.ageIsEstimated, allergyStatus: p.allergyStatus }),
        setError,
      );
    }
  }, [params]);

  useEffect(() => {
    if (!patient) return setAllergy(null);
    api<Patient>('GET', `/api/patients/${patient.id}`).then((p) => setAllergy({ status: p.allergyStatus, details: p.allergyDetails }), () => setAllergy(null));
  }, [patient]);

  const free = beds.filter((b) => b.active && !b.occupied);
  const rooms = [...new Set(free.map((b) => b.room))];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!patient) return;
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { patientId: patient.id, bedId: Number(bedId), reason: f.reason };
    for (const k of ['diagnosis', 'initialAssessment', 'treatmentPlan'] as const) if (f[k].trim()) body[k] = f[k].trim();
    if (backdate) {
      if (f.admittedDate) body.admittedDate = f.admittedDate;
      if (f.admittedTime) body.admittedTime = f.admittedTime;
    }
    try {
      const a = await api<Admission>('POST', '/api/admissions', body);
      nav(`/admissions/${a.id}`, { replace: true });
    } catch (err) {
      setError(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <p><Link to="/wards">← Wards</Link></p>
      <h1>Admit patient</h1>
      <ErrorBanner error={error} />

      <section className="card stack">
        <h2 style={{ margin: 0 }}>1. Patient</h2>
        {patient ? (
          <div>
            <strong>{patient.fullName}</strong>{' '}
            <span className="muted">{patient.patientNumber} · {formatAge(patient.ageYears, patient.ageIsEstimated)}</span>{' '}
            <button type="button" className="link" onClick={() => setPatient(null)}>change</button>
            {allergy && <div className="chips"><AllergyBadge status={allergy.status} details={allergy.details} /></div>}
          </div>
        ) : (
          <PatientPicker onPick={setPatient} autoFocus />
        )}
        <p className="muted small">A patient can only have one active admission. New patients must be registered first.</p>
      </section>

      <form onSubmit={submit} className="stack" style={{ marginTop: '1rem' }}>
        <section className="card stack">
          <h2 style={{ margin: 0 }}>2. Bed</h2>
          {free.length === 0 && beds.length > 0 && <div className="banner warn">No beds are free right now.</div>}
          <Field label="Available bed">
            <select value={bedId} onChange={(e) => setBedId(e.target.value)} required>
              <option value="">Choose a bed…</option>
              {rooms.map((r) => (
                <optgroup key={r} label={r}>
                  {free.filter((b) => b.room === r).map((b) => (
                    <option key={b.id} value={b.id}>{b.room} / Bed {b.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        </section>

        <section className="card stack">
          <h2 style={{ margin: 0 }}>3. Admission details</h2>
          <Field label="Reason for admission" error={fe.reason}>
            <input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} maxLength={500} required />
          </Field>
          <Field label="Diagnosis (if known)" error={fe.diagnosis}>
            <input value={f.diagnosis} onChange={(e) => setF({ ...f, diagnosis: e.target.value })} maxLength={1000} />
          </Field>
          <Field label="Initial assessment" error={fe.initialAssessment}>
            <textarea rows={3} value={f.initialAssessment} onChange={(e) => setF({ ...f, initialAssessment: e.target.value })} />
          </Field>
          <Field label="Treatment plan" error={fe.treatmentPlan}>
            <textarea rows={3} value={f.treatmentPlan} onChange={(e) => setF({ ...f, treatmentPlan: e.target.value })} />
          </Field>
          <label className="row">
            <input type="checkbox" style={{ width: 'auto', minHeight: 'auto' }} checked={backdate} onChange={(e) => setBackdate(e.target.checked)} />
            <span>Admitted earlier (enter the actual date and time)</span>
          </label>
          {backdate && (
            <div className="grid2">
              <Field label="Admission date" error={fe.admittedDate}>
                <input type="date" max={todayLocal()} value={f.admittedDate} onChange={(e) => setF({ ...f, admittedDate: e.target.value })} required />
              </Field>
              <Field label="Admission time">
                <input type="time" value={f.admittedTime} onChange={(e) => setF({ ...f, admittedTime: e.target.value })} required />
              </Field>
            </div>
          )}
        </section>

        <div className="sticky-actions">
          <button className="btn primary" disabled={busy || !patient || !bedId}>
            {busy ? 'Admitting…' : 'Admit patient'}
          </button>
        </div>
      </form>
    </div>
  );
}
