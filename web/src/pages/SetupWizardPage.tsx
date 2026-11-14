import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, type BackupStatus, type ClinicSettings } from '../api';
import { useMe } from '../auth';
import { ErrorBanner, Field } from '../components/ui';

interface ChecklistItem {
  key: string;
  done: boolean;
  note: string | null;
}
interface StaffUser {
  id: number;
  username: string;
  fullName: string;
  role: string;
  active: boolean;
}
interface SelfTestResult {
  ok: boolean;
  backup: { file: string; sizeBytes: number };
  restoreVerify: { patients: number; users: number };
}

const STEPS = ['Clinic details', 'Emergency doctor account', 'Backup passphrase', 'Prove backups work', 'Finish'] as const;
const MIN_PASSWORD_LENGTH = 10; // matches server/auth.ts; the server re-checks

const tick = (key: string, note?: string) => api('PUT', `/api/checklist/${key}`, { done: true, note });

/**
 * Guided first-run setup for the doctor. Everything here goes through the same endpoints the Clinic and Staff
 * pages use; the wizard only orders the jobs and records progress on the setup checklist. Backup encryption is
 * deliberately not configurable from the browser: the installer generates the passphrase, and this page only
 * confirms it was written down and then proves a backup can really be restored.
 */
export function SetupWizardPage() {
  const [step, setStep] = useState(0);
  const [checklist, setChecklist] = useState<ChecklistItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  const loadChecklist = () => api<ChecklistItem[]>('GET', '/api/checklist').then(setChecklist, setError);
  useEffect(() => {
    void loadChecklist();
  }, []);

  const isDone = (key: string) => !!checklist?.find((c) => c.key === key)?.done;
  const next = async () => {
    await loadChecklist();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  return (
    <div className="page narrow">
      <p><Link to="/settings">← Clinic details</Link></p>
      <h1>First-run setup</h1>
      <p className="muted">
        Five short steps before the clinic starts using the app. You can leave and come back; finished steps are remembered.
      </p>
      <ol className="row wrap" aria-label="Setup steps" style={{ listStyle: 'none', padding: 0, gap: '0.4rem' }}>
        {STEPS.map((label, i) => (
          <li key={label}>
            <button type="button" className={`btn small ${i === step ? 'primary' : ''}`} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>
      <ErrorBanner error={error} />
      {checklist === null && !error && <p className="muted">Loading…</p>}
      {checklist && (
        <div className="card stack">
          {step === 0 && <ClinicStep done={isDone('clinic_details')} onDone={next} />}
          {step === 1 && <DoctorStep done={isDone('second_doctor_account')} onDone={next} />}
          {step === 2 && <PassphraseStep done={isDone('backup_passphrase')} onDone={next} />}
          {step === 3 && <SelfTestStep onDone={next} />}
          {step === 4 && <FinishStep checklist={checklist} onFinished={loadChecklist} goTo={setStep} />}
        </div>
      )}
    </div>
  );
}

function useBusy() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

function DoneNote({ done, what }: { done: boolean; what: string }) {
  if (!done) return null;
  return <div className="banner ok" role="status">{what} is already done. You can change it here or move on.</div>;
}

function ClinicStep({ done, onDone }: { done: boolean; onDone: () => Promise<void> }) {
  const [f, setF] = useState<ClinicSettings | null>(null);
  const { busy, error, setError, run } = useBusy();
  useEffect(() => {
    api<ClinicSettings>('GET', '/api/settings').then(setF, setError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!f) return <><ErrorBanner error={error} />{!error && <p className="muted">Loading…</p>}</>;

  const set = (k: keyof ClinicSettings) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api('PUT', '/api/settings', f);
      await tick('clinic_details', 'Entered in the setup wizard');
      await onDone();
    });
  };

  return (
    <form className="stack" onSubmit={save}>
      <h2>1. Clinic details</h2>
      <p className="muted small">These print on every prescription, invoice and summary. Logo, signature and letterhead can be added later on the Clinic page.</p>
      <DoneNote done={done} what="Clinic details" />
      <ErrorBanner error={error} />
      <Field label="Clinic / hospital name"><input required maxLength={300} value={f.clinicName || ''} onChange={set('clinicName')} /></Field>
      <Field label="Address"><textarea required rows={3} maxLength={600} value={f.address || ''} onChange={set('address')} /></Field>
      <Field label="Phone"><input required maxLength={150} value={f.phone || ''} onChange={set('phone')} /></Field>
      <Field label="Doctor's name (as printed)"><input required maxLength={300} value={f.doctorName || ''} onChange={set('doctorName')} /></Field>
      <Field label="Medical council registration number"><input required maxLength={150} value={f.registrationNo || ''} onChange={set('registrationNo')} /></Field>
      <div><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save and continue'}</button></div>
    </form>
  );
}

function DoctorStep({ done, onDone }: { done: boolean; onDone: () => Promise<void> }) {
  const me = useMe();
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [form, setForm] = useState({ username: '', fullName: '', password: '', confirm: '', keptAt: '' });
  const { busy, error, setError, run } = useBusy();
  useEffect(() => {
    api<StaffUser[]>('GET', '/api/users').then(setUsers, setError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const otherDoctors = users?.filter((u) => u.role === 'doctor' && u.active && u.id !== me.id) ?? [];
  const tooShort = form.password && form.password.length < MIN_PASSWORD_LENGTH ? `At least ${MIN_PASSWORD_LENGTH} characters` : undefined;
  const mismatch = form.confirm && form.password !== form.confirm ? 'The two passwords do not match' : undefined;
  const pwProblem = tooShort ?? mismatch;

  const create = (e: FormEvent) => {
    e.preventDefault();
    if (pwProblem || form.password !== form.confirm) return;
    void run(async () => {
      await api('POST', '/api/users', { username: form.username.trim(), fullName: form.fullName.trim(), role: 'doctor', password: form.password });
      await tick('second_doctor_account', form.keptAt.trim() ? `Kept at: ${form.keptAt.trim()}` : undefined);
      setForm({ username: '', fullName: '', password: '', confirm: '', keptAt: '' });
      await onDone();
    });
  };
  const useExisting = () => void run(async () => {
    await tick('second_doctor_account', form.keptAt.trim() ? `Kept at: ${form.keptAt.trim()}` : `Existing account: ${otherDoctors[0]!.username}`);
    await onDone();
  });

  return (
    <div className="stack">
      <h2>2. Emergency doctor account</h2>
      <p className="muted small">
        Only a doctor can reset passwords. If the only doctor account is locked out, nobody can fix it from inside the app. Create a
        second doctor account, write its password on paper, seal it in an envelope and keep it somewhere safe. The account will be asked
        to choose a new password the first time it is used.
      </p>
      <DoneNote done={done} what="The emergency doctor account" />
      <ErrorBanner error={error} />
      {users === null && !error && <p className="muted">Loading…</p>}
      {otherDoctors.length > 0 && (
        <div className="banner" role="status">
          Another active doctor account already exists ({otherDoctors.map((u) => `${u.fullName} – ${u.username}`).join(', ')}). If that is the
          sealed emergency account, you can use it instead of creating a new one.
          <div style={{ marginTop: '0.5rem' }}>
            <button type="button" className="btn small" disabled={busy} onClick={useExisting}>Use the existing account and continue</button>
          </div>
        </div>
      )}
      <form className="stack" onSubmit={create}>
        <Field label="Username" hint="Letters, numbers, dot, dash or underscore"><input required minLength={3} maxLength={40} pattern="[A-Za-z0-9._\-]+" autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
        <Field label="Full name"><input required minLength={2} maxLength={100} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
        <Field label="Password" error={tooShort}><input required type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <Field label="Password again" error={mismatch}><input required type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></Field>
        <Field label="Where the sealed envelope is kept (optional)" hint="Saved on the setup checklist. Never write the password here."><input maxLength={250} value={form.keptAt} onChange={(e) => setForm({ ...form, keptAt: e.target.value })} /></Field>
        <div><button className="btn primary" disabled={busy || !!pwProblem}>{busy ? 'Creating…' : 'Create account and continue'}</button></div>
      </form>
    </div>
  );
}

function PassphraseStep({ done, onDone }: { done: boolean; onDone: () => Promise<void> }) {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [keptAt, setKeptAt] = useState('');
  const { busy, error, setError, run } = useBusy();
  useEffect(() => {
    api<BackupStatus>('GET', '/api/backups').then(setStatus, setError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = () => void run(async () => {
    await tick('backup_passphrase', keptAt.trim() ? `Kept at: ${keptAt.trim()}` : undefined);
    await onDone();
  });

  return (
    <div className="stack">
      <h2>3. Backup passphrase</h2>
      <DoneNote done={done} what="Writing down the backup passphrase" />
      <ErrorBanner error={error} />
      {status === null && !error && <p className="muted">Checking backups…</p>}
      {status && !status.configured && (
        <div className="banner warn" role="alert">
          Backup encryption is not set up on this computer, so no backups are being taken. The Windows installer sets this up
          automatically; on a computer set up another way, follow "One-time setup" in docs/BACKUP-AND-RESTORE.md, restart the app,
          then come back to this step. For safety the passphrase can never be entered or shown in the browser.
        </div>
      )}
      {status?.configured && (
        <>
          <p>
            Backups are switched on: every {status.intervalHours} hours, keeping the newest {status.keep}, in <code>{status.dir}</code>.
          </p>
          <p className="muted small">
            Backups are locked with a passphrase. <strong>Without it no backup can be opened by anyone.</strong> It must be written on
            paper and kept away from this computer. If this computer was set up with the Windows installer, the installer showed the
            passphrase once on screen; if it was not written down then, an administrator can read it from{' '}
            <code>%ProgramData%\ClinicApp\secrets\backup-passphrase.txt</code>. Otherwise it is in the passphrase file chosen when
            backups were set up (see docs/BACKUP-AND-RESTORE.md). It is never shown in the app.
          </p>
          <label className="row" style={{ alignItems: 'flex-start' }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>The backup passphrase is written down and kept somewhere other than this computer.</span>
          </label>
          <Field label="Where it is kept (optional)" hint="For example: sealed envelope in the doctor's home safe. Never write the passphrase itself here.">
            <input maxLength={250} value={keptAt} onChange={(e) => setKeptAt(e.target.value)} />
          </Field>
          <div><button type="button" className="btn primary" disabled={busy || !confirmed} onClick={confirm}>Continue</button></div>
        </>
      )}
    </div>
  );
}

function SelfTestStep({ onDone }: { onDone: () => Promise<void> }) {
  const [result, setResult] = useState<SelfTestResult | null>(null);
  const { busy, error, run } = useBusy();
  const runTest = () => void run(async () => {
    setResult(null);
    setResult(await api<SelfTestResult>('POST', '/api/backups/self-test'));
  });

  return (
    <div className="stack">
      <h2>4. Prove backups work</h2>
      <p className="muted small">
        This takes a backup now, then restores it to a temporary copy the same way a real recovery would, checks the records inside
        and deletes the copy. The live records are not touched. It can take a minute on a large database.
      </p>
      <ErrorBanner error={error} />
      {result?.ok && (
        <div className="banner ok" role="status">
          Backup taken and restored successfully: {result.restoreVerify.patients} patients and {result.restoreVerify.users} staff
          accounts were read back from <code>{result.backup.file}</code>.
        </div>
      )}
      <div className="row wrap" style={{ gap: '0.5rem' }}>
        <button type="button" className="btn primary" disabled={busy} onClick={runTest}>
          {busy ? 'Testing…' : result ? 'Run the test again' : 'Run the backup test'}
        </button>
        {result?.ok && <button type="button" className="btn" onClick={() => void onDone()}>Continue</button>}
      </div>
    </div>
  );
}

const REQUIRED = [
  { key: 'clinic_details', step: 0, label: 'Clinic details entered' },
  { key: 'second_doctor_account', step: 1, label: 'Emergency doctor account' },
  { key: 'backup_passphrase', step: 2, label: 'Backup passphrase written down' },
] as const;

function FinishStep({ checklist, onFinished, goTo }: { checklist: ChecklistItem[]; onFinished: () => Promise<unknown>; goTo: (s: number) => void }) {
  const [testedNow, setTestedNow] = useState(false);
  const { busy, error, run } = useBusy();
  const done = (key: string) => !!checklist.find((c) => c.key === key)?.done;
  const missing = REQUIRED.filter((r) => !done(r.key));
  const finished = done('first_run_wizard');

  // The self-test is not a checklist item (the "practice restore" item is a person doing it by hand), so it is
  // re-run here rather than trusted from an earlier visit: finishing always means a backup restored just now.
  const finish = () => void run(async () => {
    const r = await api<SelfTestResult>('POST', '/api/backups/self-test');
    if (!r.ok) throw new Error('The backup test did not pass.');
    setTestedNow(true);
    await tick('first_run_wizard', `Backup test passed (${r.restoreVerify.patients} patients, ${r.restoreVerify.users} staff)`);
    await onFinished();
  });

  return (
    <div className="stack">
      <h2>5. Finish</h2>
      <ErrorBanner error={error} />
      <ul className="list">
        {REQUIRED.map((r) => (
          <li key={r.key} className="row">
            <span aria-hidden>{done(r.key) ? '✅' : '⬜'}</span>
            <span>{r.label}<span className="muted small">{done(r.key) ? ' – done' : ' – not done yet'}</span></span>
            {!done(r.key) && <button type="button" className="btn small" onClick={() => goTo(r.step)}>Go to step {r.step + 1}</button>}
          </li>
        ))}
      </ul>
      {finished ? (
        <div className="banner ok" role="status">
          {testedNow ? 'Setup finished.' : 'Setup has been finished.'} The rest of the jobs before real patients are on the{' '}
          <Link to="/settings/checklist">setup checklist</Link>, including copying backups off this computer and a practice restore by hand.
        </div>
      ) : (
        <>
          <p className="muted small">Finishing runs the backup test once more, then marks setup as done on the checklist.</p>
          <div>
            <button type="button" className="btn primary" disabled={busy || missing.length > 0} onClick={finish}>
              {busy ? 'Testing backup…' : 'Finish setup'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
