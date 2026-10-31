import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { PatientPicker } from '../components/PatientPicker';
import { ErrorBanner } from '../components/ui';

interface AuditEvent {
  id: number;
  at: string;
  atDate: string;
  atTime: string;
  action: string;
  label: string;
  entity: string;
  entityId: string | null;
  actor: string | null;
  actorId: number | null;
  patientId: number | null;
  patientName: string | null;
  patientNumber: string | null;
  detail: Record<string, unknown> | null;
}
interface Options {
  actions: { value: string; label: string }[];
  groups: string[];
  actors: { id: number; name: string }[];
}

const PAGE = 50;

const show = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

function isChange(v: unknown): v is { from: unknown; to: unknown } {
  return typeof v === 'object' && v !== null && 'from' in v && 'to' in v;
}

function Detail({ detail }: { detail: Record<string, unknown> | null }) {
  const entries = detail ? Object.entries(detail) : [];
  if (entries.length === 0) return null;
  return (
    <dl className="audit-detail small">
      {entries.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{isChange(v) ? `${show(v.from)} → ${show(v.to)}` : show(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const [options, setOptions] = useState<Options | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [choosing, setChoosing] = useState(false);

  const patientId = params.get('patientId') ?? '';
  const patientLabel = params.get('patient') ?? '';
  const actorId = params.get('actorId') ?? '';
  const action = params.get('action') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  useEffect(() => {
    api<Options>('GET', '/api/audit/options').then(setOptions, setError);
  }, []);

  const query = useCallback(
    (before?: number) => {
      const q = new URLSearchParams({ limit: String(PAGE) });
      if (patientId) q.set('patientId', patientId);
      if (actorId) q.set('actorId', actorId);
      if (action) q.set('action', action);
      if (from) q.set('from', from);
      if (to) q.set('to', to);
      if (before) q.set('before', String(before));
      return `/api/audit?${q}`;
    },
    [patientId, actorId, action, from, to],
  );

  useEffect(() => {
    if (from && to && from > to) {
      setEvents([]);
      setMore(false);
      setLoading(false);
      setError(new Error('The start date is after the end date.'));
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<AuditEvent[]>('GET', query()).then(
      (rows) => {
        if (cancelled) return;
        setEvents(rows);
        setMore(rows.length === PAGE);
        setLoading(false);
      },
      (e) => {
        if (cancelled) return;
        setError(e);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [query, from, to]);

  async function loadMore() {
    const last = events[events.length - 1];
    if (!last) return;
    setLoading(true);
    try {
      const rows = await api<AuditEvent[]>('GET', query(last.id));
      setEvents((prev) => [...prev, ...rows]);
      setMore(rows.length === PAGE);
    } catch (e) {
      setError(e);
    }
    setLoading(false);
  }

  const filtered = Boolean(patientId || actorId || action || from || to);

  return (
    <div className="page">
      <h1>Audit log</h1>
      <p className="muted">
        A permanent record of who did what, and when. Entries cannot be changed or removed. Opening this page is itself recorded.
      </p>

      <section className="card audit-filters">
        <div className="audit-grid">
          <label>
            <span>Person</span>
            <select value={actorId} onChange={(e) => set({ actorId: e.target.value })}>
              <option value="">Anyone</option>
              {options?.actors.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>What they did</span>
            <select value={action} onChange={(e) => set({ action: e.target.value })}>
              <option value="">Anything</option>
              {options?.groups.map((g) => (
                <option key={g} value={`${g}.*`}>All “{g}” actions</option>
              ))}
              <option disabled>──────────</option>
              {options?.actions.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>From</span>
            <input type="date" value={from} onChange={(e) => set({ from: e.target.value })} />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={to} onChange={(e) => set({ to: e.target.value })} />
          </label>
        </div>
        <div className="row wrap" style={{ marginTop: '0.6rem' }}>
          {patientId ? (
            <span className="badge">
              Patient: {patientLabel || `#${patientId}`}{' '}
              <button type="button" className="linklike" onClick={() => set({ patientId: '', patient: '' })} aria-label="Remove patient filter">✕</button>
            </span>
          ) : (
            <button type="button" className="btn small" onClick={() => setChoosing((c) => !c)}>
              {choosing ? 'Cancel' : 'Only one patient…'}
            </button>
          )}
          {filtered && (
            <button type="button" className="btn small" onClick={() => setParams({}, { replace: true })}>
              Clear all filters
            </button>
          )}
        </div>
        {choosing && !patientId && (
          <PatientPicker
            autoFocus
            onPick={(p) => {
              set({ patientId: String(p.id), patient: `${p.fullName} (${p.patientNumber})` });
              setChoosing(false);
            }}
          />
        )}
      </section>

      <ErrorBanner error={error} />
      {!loading && !error && events.length === 0 && <p className="muted">Nothing recorded for these filters.</p>}

      <ul className="cards audit-list">
        {events.map((e) => (
          <li key={e.id} className="card">
            <div className="row wrap" style={{ justifyContent: 'space-between' }}>
              <strong>{e.label}</strong>
              <span className="muted small">{e.atDate} {e.atTime}</span>
            </div>
            <div className="small">
              By <strong>{e.actor ?? 'unknown / not logged in'}</strong>
              {e.patientId && (
                <>
                  {' · '}Patient: <Link to={`/patients/${e.patientId}`}>{e.patientName} ({e.patientNumber})</Link>
                </>
              )}
            </div>
            <Detail detail={e.detail} />
            <div className="muted small">#{e.id} · {e.action}{e.entityId ? ` · ${e.entity} ${e.entityId}` : ''}</div>
          </li>
        ))}
      </ul>
      {loading && <p className="muted">Loading…</p>}
      {more && !loading && (
        <p><button type="button" className="btn" onClick={loadMore}>Load older entries</button></p>
      )}
    </div>
  );
}
