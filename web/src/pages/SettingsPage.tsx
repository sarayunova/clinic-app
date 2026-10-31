import { useEffect, useState, type FormEvent } from 'react';
import { api, type ClinicSettings } from '../api';
import { ErrorBanner, Field } from '../components/ui';

export function SettingsPage() {
  const [f, setF] = useState<ClinicSettings | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    api<ClinicSettings>('GET', '/api/settings').then(setF, setError);
  }, []);
  if (!f) return <p className="muted">{error ? '' : 'Loading…'}<ErrorBanner error={error} /></p>;

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    try {
      await api('PUT', '/api/settings', f);
      setSaved(true);
    } catch (err) {
      setError(err);
    }
  }
  const text = (k: keyof ClinicSettings, label: string, area = false) => (
    <Field label={label}>
      {area ? <textarea rows={3} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} maxLength={300} /> : <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} maxLength={300} />}
    </Field>
  );
  return (
    <div className="page narrow">
      <h1>Clinic details</h1>
      <p className="muted">These are printed at the top of invoices and receipts.</p>
      <ErrorBanner error={error} />
      {saved && <div className="banner ok" role="status">Saved.</div>}
      <form onSubmit={save} className="card stack">
        {text('clinicName', 'Clinic name')}
        {text('address', 'Address', true)}
        {text('phone', 'Phone')}
        {text('doctorName', 'Doctor name')}
        {text('registrationNo', 'Medical registration number')}
        <div><button className="btn primary">Save</button></div>
      </form>
    </div>
  );
}
