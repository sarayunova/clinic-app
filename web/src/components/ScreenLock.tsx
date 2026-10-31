import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth, useMe } from '../auth';
import { ErrorBanner } from './ui';

/** Covers the whole app while the screen is locked. The page underneath is hidden and inert, and the server refuses all requests. */
export function ScreenLock() {
  const me = useMe();
  const { locked, unlock, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (locked) input.current?.focus();
    else {
      setPassword('');
      setError(null);
    }
  }, [locked]);

  if (!locked) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await unlock(password);
      setPassword('');
    } catch (err) {
      setError(err);
      setPassword('');
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lock-overlay" role="dialog" aria-modal="true" aria-labelledby="lock-title">
      <form className="card stack lock-card" onSubmit={submit}>
        <h1 id="lock-title">Screen locked</h1>
        <p className="muted">
          {me.fullName} ({me.role}) is signed in. Enter your password to continue. Anything you were typing is kept.
        </p>
        <ErrorBanner error={error} />
        <label>
          <span className="label">Password</span>
          <input ref={input} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <div className="row">
          <button className="btn primary" disabled={busy || !password}>{busy ? 'Checking…' : 'Unlock'}</button>
          <button type="button" className="btn" onClick={() => void logout()}>Not you? Log out</button>
        </div>
      </form>
    </div>
  );
}
