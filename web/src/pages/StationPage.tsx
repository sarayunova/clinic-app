import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { AllergyBadge, ErrorBanner } from '../components/ui';

type Allergy = 'unknown' | 'none' | 'known';
interface Stamp { at: string; date: string; time: string }
interface OpdRow {
  appointmentId: number;
  status: 'waiting' | 'in_consultation';
  scheduledTime: string;
  reason: string;
  patientId: number;
  patientName: string;
  patientNumber: string;
  allergyStatus: Allergy;
  allergyDetails: string | null;
  visitId: number | null;
  visitStatus: 'draft' | 'final' | null;
  hasVitals: boolean;
  vitalsAt: Stamp | null;
}
interface Medicine {
  orderId: number;
  medicine: string;
  strength: string | null;
  dose: string;
  route: string | null;
  frequency: string;
  instructions: string | null;
  state: 'may_be_due' | 'not_yet' | 'starts_later' | 'unknown';
  last: (Stamp & { outcome: 'given' | 'withheld' | 'refused'; reason: string | null }) | null;
}
interface WardRow {
  admissionId: number;
  admissionNumber: string;
  patientName: string;
  patientNumber: string;
  allergyStatus: Allergy;
  allergyDetails: string | null;
  bedRoom: string;
  bedLabel: string;
  lastObservation:
    | (Stamp & { systolicMmhg: number | null; diastolicMmhg: number | null; pulseBpm: number | null; temperatureC: number | null; spo2Pct: number | null; respRate: number | null })
    | null;
  medicines: Medicine[];
}
interface Station { now: string; date: string; opd: OpdRow[]; ward: WardRow[] }

/** "3 h 10 min ago", measured against the server's clock so a wrong clock on this tablet cannot mislead. */
function ago(nowIso: string, thenIso: string): string {
  const mins = Math.max(0, Math.round((Date.parse(nowIso) - Date.parse(thenIso)) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 48) return `${Math.floor(h / 24)} days ago`;
  return m ? `${h} h ${m} min ago` : `${h} h ago`;
}

function Observation({ o, now }: { o: WardRow['lastObservation']; now: string }) {
  if (!o) return <div className="muted small">No observations recorded yet.</div>;
  const parts = [
    o.systolicMmhg != null && o.diastolicMmhg != null ? `BP ${o.systolicMmhg}/${o.diastolicMmhg}` : null,
    o.pulseBpm != null ? `Pulse ${o.pulseBpm}` : null,
    o.temperatureC != null ? `Temp ${o.temperatureC}°C` : null,
    o.spo2Pct != null ? `SpO₂ ${o.spo2Pct}%` : null,
    o.respRate != null ? `Resp ${o.respRate}` : null,
  ].filter(Boolean);
  return (
    <div className="small">
      <strong>Last observation:</strong> {parts.join(' · ') || 'recorded'}{' '}
      <span className="muted">at {o.time} ({ago(now, o.at)})</span>
    </div>
  );
}

function MedicineLine({ m, now }: { m: Medicine; now: string }) {
  const verb = m.last?.outcome === 'given' ? 'Last given' : m.last?.outcome === 'withheld' ? 'Last withheld' : 'Last refused';
  return (
    <li className={`station-med ${m.state}`}>
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <span>
          <strong>{m.medicine}</strong>
          {m.strength ? ` ${m.strength}` : ''} · {m.dose}
          {m.route ? ` · ${m.route}` : ''} · {m.frequency}
        </span>
        {m.state === 'may_be_due' && <span className="badge warn">May be due</span>}
        {m.state === 'starts_later' && <span className="badge">Starts later</span>}
        {m.state === 'unknown' && <span className="badge">Check chart</span>}
      </div>
      <div className="muted small">
        {m.last ? `${verb} ${m.last.time} (${ago(now, m.last.at)})` : 'Not recorded as given yet'}
        {m.instructions ? ` · ${m.instructions}` : ''}
      </div>
    </li>
  );
}

export function StationPage() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState<Station | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async (poll: boolean) => {
    try {
      setData(await api<Station>('GET', `/api/station${poll ? '?poll=1' : ''}`));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const t = window.setInterval(() => {
      if (!document.hidden) void load(true);
    }, 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  async function openVisit(r: OpdRow) {
    try {
      const v = r.visitId ? { id: r.visitId } : await api<{ id: number }>('POST', '/api/visits', { patientId: r.patientId, appointmentId: r.appointmentId });
      nav(`/visits/${v.id}`);
    } catch (e) {
      setError(e);
    }
  }

  const needVitals = data?.opd.filter((o) => !o.hasVitals).length ?? 0;
  const maybeDue = data?.ward.reduce((n, w) => n + w.medicines.filter((m) => m.state === 'may_be_due').length, 0) ?? 0;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Nurse station</h1>
        <button className="btn" onClick={() => void load(false)}>Refresh</button>
      </header>

      <ErrorBanner error={error} />
      {!data && !error && <p className="muted">Loading…</p>}

      {data && (
        <>
          <div className="stats">
            <div className="stat"><b>{needVitals}</b><span>Outpatients without vitals</span></div>
            <div className="stat"><b>{data.opd.length}</b><span>Outpatients here</span></div>
            <div className="stat"><b>{data.ward.length}</b><span>Inpatients</span></div>
            <div className="stat"><b>{maybeDue}</b><span>Medicines that may be due</span></div>
          </div>

          <section>
            <h2>Outpatients here now <span className="muted">({data.opd.length})</span></h2>
            {data.opd.length === 0 && <p className="muted">No one is waiting or being seen.</p>}
            <ul className="cards">
              {data.opd.map((r) => (
                <li key={r.appointmentId} className="card appt">
                  <div className="appt-main">
                    <div className="appt-time">{r.scheduledTime}</div>
                    <div>
                      <Link to={`/patients/${r.patientId}`} className="appt-name">{r.patientName}</Link>
                      <div className="muted">{r.patientNumber} · {r.reason}</div>
                      <div className="chips">
                        <span className="badge">{r.status === 'waiting' ? 'Waiting' : 'In consultation'}</span>
                        {r.hasVitals ? (
                          <span className="badge ok">Vitals taken {r.vitalsAt?.time}</span>
                        ) : (
                          <span className="badge warn">Vitals not taken</span>
                        )}
                        <AllergyBadge status={r.allergyStatus} details={r.allergyDetails} />
                      </div>
                    </div>
                  </div>
                  {can('visit:read') && (
                    <div className="row wrap">
                      <button className={`btn ${r.hasVitals ? '' : 'primary'}`} onClick={() => void openVisit(r)}>
                        {r.hasVitals ? 'Open consultation' : 'Take vitals'}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Ward <span className="muted">({data.ward.length})</span></h2>
            {data.ward.length === 0 && <p className="muted">No inpatients at the moment.</p>}
            <ul className="cards">
              {data.ward.map((w) => (
                <li key={w.admissionId} className="card stack">
                  <div className="row wrap" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <span className="bed-label">{w.bedRoom} · {w.bedLabel}</span>{' '}
                      <Link to={`/admissions/${w.admissionId}`} className="appt-name">{w.patientName}</Link>
                      <div className="muted small">{w.patientNumber} · {w.admissionNumber}</div>
                    </div>
                    <AllergyBadge status={w.allergyStatus} details={w.allergyDetails} />
                  </div>
                  <Observation o={w.lastObservation} now={data.now} />
                  {w.medicines.length === 0 ? (
                    <div className="muted small">No active medicines.</div>
                  ) : (
                    <ul className="station-meds">
                      {w.medicines.map((m) => (
                        <MedicineLine key={m.orderId} m={m} now={data.now} />
                      ))}
                    </ul>
                  )}
                  <div className="row">
                    <Link className="btn small" to={`/admissions/${w.admissionId}`}>Open chart</Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <p className="muted small">
            “May be due” is only a reminder worked out from the wording of the frequency (for example “every 8 hours” or “TDS”) and the last
            record. It is not a schedule. Always check the chart and the doctor’s order. Medicines with other wording show “Check chart”.
            Updated {new Date(data.now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}; refreshes every minute.
          </p>
        </>
      )}
    </div>
  );
}
