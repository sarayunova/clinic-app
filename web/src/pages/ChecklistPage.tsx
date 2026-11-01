import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ErrorBanner } from '../components/ui';

interface Item {
  key: string;
  title: string;
  detail: string;
  done: boolean;
  doneDate: string | null;
  doneByName: string | null;
  note: string | null;
}

/** The doctor's list of one-time jobs before real patients. The app cannot check most of them; it records who ticked what and when. */
export function ChecklistPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = () => api<Item[]>('GET', '/api/checklist').then(setItems, setError);
  useEffect(() => {
    void load();
  }, []);

  const done = items?.filter((i) => i.done).length ?? 0;
  return (
    <div className="page narrow">
      <p><Link to="/settings">← Clinic details</Link></p>
      <h1>Ready for real patients</h1>
      <p className="muted">
        One-time jobs that cannot be checked by the app. Tick each one when it has really been done; the date and your name are kept.
        {items && <> <strong>{done} of {items.length} done.</strong></>}
      </p>
      <ErrorBanner error={error} />
      {items === null && !error && <p className="muted">Loading…</p>}
      <ul className="list">
        {items?.map((i) => <Row key={i.key} item={i} onChanged={load} />)}
      </ul>
    </div>
  );
}

function Row({ item, onChanged }: { item: Item; onChanged: () => Promise<unknown> }) {
  const [note, setNote] = useState(item.note ?? '');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function save(done: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api('PUT', `/api/checklist/${item.key}`, { done, note: done ? note.trim() : undefined });
      await onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card stack">
      <ErrorBanner error={error} />
      <label className="row" style={{ alignItems: 'flex-start' }}>
        <input type="checkbox" checked={item.done} disabled={busy} onChange={(e) => void save(e.target.checked)} />
        <span>
          <strong>{item.title}</strong>
          <span className="muted small" style={{ display: 'block' }}>{item.detail}</span>
        </span>
      </label>
      {item.done ? (
        <div className="small muted">Done {item.doneDate} by {item.doneByName}{item.note ? ` · ${item.note}` : ''}</div>
      ) : (
        <input aria-label={`Note for: ${item.title}`} placeholder="Note (optional), saved when you tick" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
      )}
    </li>
  );
}
