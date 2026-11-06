import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type Appointment, type AppointmentStatus } from '../api';
import { useAuth } from '../auth';
import { BookAppointment } from '../components/BookAppointment';
import { Reschedule } from '../components/Reschedule';
import { FollowUpsView } from '../components/FollowUpsView';
import { CommunicationModal } from '../components/CommunicationModal';
import { AllergyBadge, ErrorBanner, STATUS_LABEL, todayLocal } from '../components/ui';

interface Action {
  to: AppointmentStatus;
  label: string;
  clinical?: boolean;
  destructive?: boolean;
  primary?: boolean;
}

const ACTIONS: Record<AppointmentStatus, Action[]> = {
  scheduled: [
    { to: 'waiting', label: 'Check in', primary: true },
    { to: 'absent', label: 'Mark absent', destructive: true },
    { to: 'cancelled', label: 'Cancel', destructive: true },
  ],
  waiting: [
    { to: 'in_consultation', label: 'Start consultation', clinical: true, primary: true },
    { to: 'absent', label: 'Mark absent', destructive: true },
    { to: 'cancelled', label: 'Cancel', destructive: true },
  ],
  in_consultation: [
    { to: 'completed', label: 'Complete', clinical: true, primary: true },
    { to: 'waiting', label: 'Back to waiting' },
  ],
  completed: [],
  cancelled: [],
  absent: [],
};

const GROUPS: { title: string; statuses: AppointmentStatus[] }[] = [
  { title: 'In consultation', statuses: ['in_consultation'] },
  { title: 'Waiting', statuses: ['waiting'] },
  { title: 'Scheduled', statuses: ['scheduled'] },
  { title: 'Finished', statuses: ['completed', 'cancelled', 'absent'] },
];

export function Dashboard() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [date, setDate] = useState(todayLocal());
  const [tab, setTab] = useState<'schedule' | 'followups'>('schedule');
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [booking, setBooking] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [moving, setMoving] = useState<number | null>(null);
  const [commTarget, setCommTarget] = useState<Appointment | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api<Appointment[]>('GET', `/api/appointments?date=${date}`));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [date]);

  useEffect(() => {
    setItems(null);
    void load();
    const t = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  async function move(a: Appointment, to: AppointmentStatus) {
    setConfirming(null);
    try {
      await api('PATCH', `/api/appointments/${a.id}/status`, { status: to, version: a.version });
      setError(null);
    } catch (e) {
      setError(e);
    }
    await load();
  }

  async function openConsultation(a: Appointment) {
    try {
      const v = a.visitId
        ? { id: a.visitId }
        : await api<{ id: number }>('POST', '/api/visits', { patientId: a.patientId, appointmentId: a.id });
      nav(`/visits/${v.id}`);
    } catch (e) {
      setError(e);
    }
  }

  const count = (s: AppointmentStatus[]) => items?.filter((a) => s.includes(a.status)).length ?? 0;
  const canMove = (a: Appointment) => a.status === 'scheduled' && can('appointment:create');
  const isToday = date === todayLocal();
  /** Consultation button: doctor/nurse, once the patient is checked in or a record already exists. */
  const showVisit = (a: Appointment) =>
    can('visit:read') && (a.visitId != null || (can('visit:create') && (a.status === 'waiting' || a.status === 'in_consultation')));

  return (
    <div className="page">
      <div className="row wrap" style={{ gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          type="button"
          className={`btn ${tab === 'schedule' ? 'primary' : ''}`}
          onClick={() => setTab('schedule')}
        >
          📅 Daily schedule
        </button>
        <button
          type="button"
          className={`btn ${tab === 'followups' ? 'primary' : ''}`}
          onClick={() => setTab('followups')}
        >
          🔔 Upcoming follow-ups (Recall)
        </button>
      </div>

      {tab === 'followups' ? (
        <FollowUpsView />
      ) : (
        <>
          <header className="page-head">
            <h1>{isToday ? 'Today' : 'Appointments'}</h1>
            <div className="row wrap">
              <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
              {!isToday && (
                <button className="btn" onClick={() => setDate(todayLocal())}>
                  Today
                </button>
              )}
              <Link
                to="/tv"
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                title="Open lobby TV display in a new window/tab"
              >
                📺 Lobby TV
              </Link>
            </div>
          </header>

      <div className="stats">
        <div className="stat"><b>{count(['waiting'])}</b><span>Waiting</span></div>
        <div className="stat"><b>{count(['in_consultation'])}</b><span>In consultation</span></div>
        <div className="stat"><b>{count(['scheduled'])}</b><span>Yet to arrive</span></div>
        <div className="stat"><b>{count(['completed'])}</b><span>Completed</span></div>
      </div>

      <div className="row wrap">
        {can('appointment:create') && (
          <button className="btn primary" onClick={() => setBooking(true)}>
            + Book appointment
          </button>
        )}
        {can('patient:write_demographics') && (
          <Link className="btn" to="/patients/new">
            + Register patient
          </Link>
        )}
      </div>

      {booking && (
        <BookAppointment
          defaultDate={date}
          onCancel={() => setBooking(false)}
          onBooked={() => {
            setBooking(false);
            void load();
          }}
        />
      )}

      <ErrorBanner error={error} />
      {items === null && !error && <p className="muted">Loading…</p>}
      {items?.length === 0 && (
        <div className="empty">
          <p>No appointments for this day.</p>
          {can('appointment:create') && <p className="muted">Use “Book appointment” to add the first one.</p>}
        </div>
      )}

      {items &&
        GROUPS.map((g) => {
          const rows = items.filter((a) => g.statuses.includes(a.status));
          if (!rows.length) return null;
          return (
            <section key={g.title}>
              <h2>
                {g.title} <span className="muted">({rows.length})</span>
              </h2>
              <ul className="cards">
                {rows.map((a) => {
                  const actions = ACTIONS[a.status].filter((x) => !x.clinical || can('appointment:status_clinical'));
                  return (
                    <li key={a.id} className={`card appt ${a.status}`}>
                      <div className="appt-main">
                        <div className="appt-time">{a.scheduledTime}</div>
                        <div>
                          <Link to={`/patients/${a.patientId}`} className="appt-name">
                            {a.patientName}
                          </Link>
                          <div className="muted">
                            {a.patientNumber} · {a.reason}
                          </div>
                          <div className="chips">
                            <span className={`badge status-${a.status}`}>{STATUS_LABEL[a.status]}</span>
                            <AllergyBadge status={a.allergyStatus} details={a.allergyDetails} />
                          </div>
                        </div>
                      </div>
                      {(actions.length > 0 || showVisit(a) || canMove(a) || can('patient:read_basic')) && (
                        <div className="row wrap">
                          {showVisit(a) && (
                            <button className="btn" onClick={() => void openConsultation(a)}>
                              {a.visitId && (a.visitStatus === 'final' || a.status === 'completed') ? 'View record' : 'Open consultation'}
                            </button>
                          )}
                          {canMove(a) && (
                            <button className="btn" onClick={() => setMoving(moving === a.id ? null : a.id)}>
                              Reschedule
                            </button>
                          )}
                          {can('patient:read_basic') && (
                            <button
                              type="button"
                              className="btn"
                              onClick={() => setCommTarget(a)}
                              title="Send WhatsApp or SMS reminder"
                            >
                              💬 Remind
                            </button>
                          )}
                          {actions.map((x) => {
                            const key = `${a.id}:${x.to}`;
                            if (x.destructive && confirming !== key) {
                              return (
                                <button key={key} className="btn" onClick={() => setConfirming(key)}>
                                  {x.label}
                                </button>
                              );
                            }
                            return (
                              <button key={key} className={`btn ${x.destructive ? 'danger' : x.primary ? 'primary' : ''}`} onClick={() => void move(a, x.to)}>
                                {x.destructive ? `Confirm: ${x.label}` : x.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {moving === a.id && (
                        <Reschedule
                          appointment={a}
                          onCancel={() => setMoving(null)}
                          onDone={() => {
                            setMoving(null);
                            void load();
                          }}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        </>
      )}

      {commTarget && (
        <CommunicationModal
          open={true}
          onClose={() => setCommTarget(null)}
          patientId={commTarget.patientId}
          patientName={commTarget.patientName}
          patientPhone={commTarget.patientPhone}
          defaultType="appointment_reminder"
          appointmentData={{
            appointmentDate: commTarget.scheduledDate,
            appointmentTime: commTarget.scheduledTime,
          }}
        />
      )}
    </div>
  );
}
