import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, type ClinicSettings } from '../api';
import { BackupPanel } from '../components/BackupPanel';
import { SecurityPanel } from '../components/SecurityPanel';
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
      <div className="row wrap" style={{ gap: '0.6rem', marginBottom: '1rem' }}>
        <Link className="btn" to="/settings/checklist">Setup checklist: ready for real patients</Link>
        <Link className="btn" to="/settings/prescription-templates">Prescription templates / regimens</Link>
      </div>
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
      <SecurityPanel />
      <BackupPanel />
    </div>
  );
}
