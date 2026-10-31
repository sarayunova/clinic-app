import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, Field, fieldErrorsOf } from '../components/ui';

export function AuthScreens({ forceChange = false }: { forceChange?: boolean }) {
  const { state } = useAuth();
  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1>Clinic</h1>
        {forceChange ? <ChangePasswordForm forced /> : state.status === 'needs-setup' ? <SetupForm /> : <LoginForm />}
      </div>
    </div>
  );
}

function LoginForm() {
  const { state, refresh } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const notice = state.status === 'logged-out' ? state.notice : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/api/auth/login', { username, password });
      setPassword('');
      await refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <h2>Log in</h2>
      {notice && <div className="banner info">{notice}</div>}
      <ErrorBanner error={error} />
      <Field label="Username">
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" required />
      </Field>
      <Field label="Password">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </Field>
      <button className="btn primary" disabled={busy}>
        {busy ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  );
}

function SetupForm() {
  const { refresh } = useAuth();
  const [form, setForm] = useState({ fullName: '', username: '', password: '' });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fe = fieldErrorsOf(error);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/api/setup', form);
      await refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <h2>First-time setup</h2>
      <p className="muted">Create the doctor's account. You can add the nurse and reception accounts afterwards.</p>
      <ErrorBanner error={error} />
      <Field label="Doctor's full name" error={fe.fullName}>
        <input value={form.fullName} onChange={set('fullName')} required />
      </Field>
      <Field label="Username" error={fe.username} hint="Letters, numbers, dot, dash, underscore">
        <input value={form.username} onChange={set('username')} autoCapitalize="none" autoComplete="username" required />
      </Field>
      <Field label="Password" hint="At least 10 characters">
        <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" required />
      </Field>
      <button className="btn primary" disabled={busy}>
        {busy ? 'Creating…' : 'Create account'}
      </button>
    </form>
  );
}

function ChangePasswordForm({ forced = false }: { forced?: boolean }) {
  const { refresh, logout } = useAuth();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (newPassword !== confirm) return setError(new Error('The two new passwords do not match'));
    setBusy(true);
    try {
      await api('POST', '/api/auth/change-password', { currentPassword, newPassword });
      setCurrent('');
      setNew('');
      setConfirm('');
      setDone(true);
      await refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <h2>{forced ? 'Choose your own password' : 'Change password'}</h2>
      {forced && <p className="muted">Your account was created with a temporary password. Set a new one to continue.</p>}
      <ErrorBanner error={error} />
      {done && !forced && <div className="banner ok">Password changed.</div>}
      <Field label="Current password">
        <input type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </Field>
      <Field label="New password" hint="At least 10 characters">
        <input type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" required />
      </Field>
      <Field label="Repeat new password">
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </Field>
      <div className="row">
        <button className="btn primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
        {forced && (
          <button type="button" className="btn" onClick={() => void logout()}>
            Log out
          </button>
        )}
      </div>
    </form>
  );
}

export function ChangePasswordPage() {
  return (
    <div className="page narrow">
      <h1>Account</h1>
      <div className="card">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
