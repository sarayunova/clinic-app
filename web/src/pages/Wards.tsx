import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, type Bed } from '../api';
import { useAuth } from '../auth';
import { AllergyBadge, ErrorBanner, Field, fieldErrorsOf } from '../components/ui';

export function WardsPage() {
  const { can } = useAuth();
  const [beds, setBeds] = useState<Bed[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [adding, setAdding] = useState(false);
  const manage = can('bed:manage');

  const load = useCallback(async () => {
    try {
      setBeds(await api<Bed[]>('GET', '/api/beds'));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  const rooms = useMemo(() => {
    const m = new Map<string, Bed[]>();
    for (const b of beds ?? []) {
      if (!b.active && !manage) continue;
      m.set(b.room, [...(m.get(b.room) ?? []), b]);
    }
    return [...m.entries()];
  }, [beds, manage]);

  const active = beds?.filter((b) => b.active) ?? [];
  const occupied = active.filter((b) => b.occupied).length;

  async function setActive(b: Bed, value: boolean) {
    try {
      await api('PATCH', `/api/beds/${b.id}`, { active: value });
      await load();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Wards</h1>
        <div className="row wrap">
          {can('admission:create') && (
            <Link className="btn primary" to="/admissions/new">
              + Admit patient
            </Link>
          )}
          {manage && (
            <button className="btn" onClick={() => setAdding((a) => !a)}>
              + Add bed
            </button>
          )}
        </div>
      </header>

      {beds && (
        <div className="stats">
          <div className="stat"><b>{occupied}</b><span>Occupied</span></div>
          <div className="stat"><b>{active.length - occupied}</b><span>Free</span></div>
          <div className="stat"><b>{active.length}</b><span>Beds in use</span></div>
        </div>
      )}

      <ErrorBanner error={error} />
      {adding && <AddBed rooms={rooms.map(([r]) => r)} onDone={() => { setAdding(false); void load(); }} />}

      {beds === null && !error && <p className="muted">Loading…</p>}
      {beds?.length === 0 && (
        <div className="empty">
          <p>No beds have been set up yet.</p>
          {manage ? <p className="muted">Use “Add bed” to create the first room and bed.</p> : <p className="muted">Ask the doctor to add the rooms and beds.</p>}
        </div>
      )}

      {rooms.map(([room, list]) => (
        <section key={room}>
          <h2>{room}</h2>
          <ul className="bed-grid">
            {list.map((b) => (
              <li key={b.id} className={`card bed ${b.occupied ? 'occupied' : 'free'} ${b.active ? '' : 'inactive'}`}>
                <div className="bed-label">Bed {b.label}</div>
                {b.occupied ? (
                  <>
                    <Link to={`/admissions/${b.admissionId}`} className="appt-name">
                      {b.patientName}
                    </Link>
                    <div className="muted small">
                      {b.patientNumber} · {b.admissionNumber} · Day {b.dayNumber}
                    </div>
                    {b.allergyStatus && <AllergyBadge status={b.allergyStatus} details={b.allergyDetails} />}
                  </>
                ) : (
                  <>
                    <div className="muted">{b.active ? 'Free' : 'Not in use'}</div>
                    <div className="row wrap">
                      {b.active && can('admission:create') && (
                        <Link className="btn small" to={`/admissions/new?bedId=${b.id}`}>
                          Admit here
                        </Link>
                      )}
                      {manage && (
                        <button className="btn small" onClick={() => void setActive(b, !b.active)}>
                          {b.active ? 'Take out of use' : 'Put back in use'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function AddBed({ rooms, onDone }: { rooms: string[]; onDone: () => void }) {
  const [room, setRoom] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<unknown>(null);
  const fe = fieldErrorsOf(error);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('POST', '/api/beds', { room, label });
      onDone();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <form onSubmit={submit} className="card stack">
      <h2 style={{ margin: 0 }}>Add a bed</h2>
      <ErrorBanner error={error} />
      <div className="grid2">
        <Field label="Room" error={fe.room} hint="Choose an existing room or type a new one">
          <input list="room-names" value={room} onChange={(e) => setRoom(e.target.value)} required maxLength={40} />
          <datalist id="room-names">
            {rooms.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <Field label="Bed label" error={fe.label} hint="e.g. A, B, 1">
          <input value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={40} />
        </Field>
      </div>
      <div className="row">
        <button className="btn primary">Add bed</button>
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}
