import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type Role, type UserRow } from '../api';
import { useMe } from '../auth';
import { ErrorBanner, Field, fieldErrorsOf } from '../components/ui';

const ROLE_LABEL: Record<Role, string> = { doctor: 'Doctor', nurse: 'Nurse', attender: 'Attender (reception)' };

export function UsersPage() {
  const me = useMe();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [adding, setAdding] = useState(false);
  const [resetFor, setResetFor] = useState<number | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await api<UserRow[]>('GET', '/api/users'));
    } catch (e) {
      setError(e);
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function patch(u: UserRow, body: object) {
    setError(null);
    try {
      await api('PATCH', `/api/users/${u.id}`, body);
      await load();
    } catch (e) {
      setError(e);
    }
  }

  async function reset(u: UserRow) {
    setError(null);
    try {
      await api('POST', `/api/users/${u.id}/reset-password`, { password: resetPw });
      setNotice(`Temporary password set for ${u.fullName}. They must choose a new one at next login.`);
      setResetFor(null);
      setResetPw('');
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div className="page narrow">
      <header className="page-head">
        <h1>Staff accounts</h1>
        <button className="btn primary" onClick={() => setAdding(true)}>+ Add staff</button>
      </header>
      <ErrorBanner error={error} />
      {notice && <div className="banner ok">{notice}</div>}
      {adding && <AddUser onDone={() => { setAdding(false); void load(); }} />}

      <ul className="cards">
        {users?.map((u) => (
          <li key={u.id} className={`card ${u.active ? '' : 'inactive'}`}>
            <div>
              <strong>{u.fullName}</strong> <span className="muted">@{u.username}</span>
              <div className="chips">
                <span className="badge">{ROLE_LABEL[u.role]}</span>
                {!u.active && <span className="badge warn">Deactivated</span>}
                {u.mustChangePassword && <span className="badge warn">Has not set own password</span>}
              </div>
            </div>
            {u.id !== me.id && (
              <div className="row wrap">
                <button className="btn" onClick={() => void patch(u, { active: !u.active })}>
                  {u.active ? 'Deactivate' : 'Reactivate'}
                </button>
                <button className="btn" onClick={() => { setResetFor(resetFor === u.id ? null : u.id); setResetPw(''); }}>
                  Reset password
                </button>
              </div>
            )}
            {resetFor === u.id && (
              <div className="row wrap">
                <input type="text" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="Temporary password (10+ characters)" autoComplete="off" />
                <button className="btn primary" disabled={resetPw.length < 10} onClick={() => void reset(u)}>Set</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddUser({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ fullName: '', username: '', role: 'attender' as Role, password: '' });
  const [error, setError] = useState<unknown>(null);
  const fe = fieldErrorsOf(error);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('POST', '/api/users', form);
      onDone();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <form onSubmit={submit} className="card stack">
      <h2>Add staff member</h2>
      <ErrorBanner error={error} />
      <Field label="Full name" error={fe.fullName}>
        <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
      </Field>
      <Field label="Username" error={fe.username}>
        <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoCapitalize="none" required />
      </Field>
      <Field label="Role">
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
      </Field>
      <Field label="Temporary password" hint="At least 10 characters. They will be asked to choose their own at first login.">
        <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="off" required />
      </Field>
      <div className="row">
        <button className="btn primary">Create</button>
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}
