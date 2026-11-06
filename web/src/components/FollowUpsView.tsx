import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type FollowUpItem } from '../api';
import { useAuth } from '../auth';
import { BookAppointment } from './BookAppointment';
import { CommunicationModal } from './CommunicationModal';
import { AllergyBadge, ErrorBanner, todayLocal } from './ui';

function daysBetween(fromStr: string, toStr: string): number {
  const from = new Date(`${fromStr}T00:00:00Z`).getTime();
  const to = new Date(`${toStr}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

function FollowUpBadge({ dateStr, isOverdue }: { dateStr: string; isOverdue: boolean }) {
  const today = todayLocal();
  const diff = daysBetween(today, dateStr);

  if (isOverdue) {
    const days = Math.abs(diff);
    return (
      <span className="badge danger">
        ⚠ Overdue by {days} {days === 1 ? 'day' : 'days'} ({dateStr})
      </span>
    );
  }
  if (diff === 0) return <span className="badge warn">Due today</span>;
  if (diff === 1) return <span className="badge">Due tomorrow</span>;
  return <span className="badge">Due in {diff} days ({dateStr})</span>;
}

export function FollowUpsView() {
  const { can } = useAuth();
  const [daysAhead, setDaysAhead] = useState<number>(14);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'all' | 'booked'>('pending');
  const [items, setItems] = useState<FollowUpItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [bookingTarget, setBookingTarget] = useState<{
    patient: { id: number; name: string };
    defaultDate: string;
  } | null>(null);
  const [commTarget, setCommTarget] = useState<FollowUpItem | null>(null);

  const load = useCallback(async () => {
    try {
      const today = todayLocal();
      const target = new Date();
      target.setDate(target.getDate() + daysAhead);
      const toDate = target.toISOString().slice(0, 10);

      // Include past 7 days to surface overdue ones
      const past = new Date();
      past.setDate(past.getDate() - 14);
      const fromDate = past.toISOString().slice(0, 10);

      const rows = await api<FollowUpItem[]>(
        'GET',
        `/api/appointments/follow-ups?from=${fromDate}&to=${toDate}&status=${filterStatus}`,
      );
      setItems(rows);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [daysAhead, filterStatus]);

  useEffect(() => {
    setItems(null);
    void load();
  }, [load]);

  const overdueCount = items?.filter((i) => i.isOverdue).length ?? 0;
  const pendingCount = items?.filter((i) => !i.appointmentId).length ?? 0;

  return (
    <div className="stack" style={{ marginTop: '1rem' }}>
      <div className="stats">
        <div className="stat">
          <b style={{ color: overdueCount > 0 ? 'var(--danger)' : undefined }}>{overdueCount}</b>
          <span>Overdue follow-ups</span>
        </div>
        <div className="stat">
          <b>{pendingCount}</b>
          <span>Pending booking</span>
        </div>
        <div className="stat">
          <b>{items?.length ?? 0}</b>
          <span>Total follow-up records</span>
        </div>
      </div>

      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem' }}>
        <div className="row wrap" style={{ gap: '0.4rem', alignItems: 'center' }}>
          <span className="muted small">Timeframe:</span>
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              type="button"
              className={`btn small ${daysAhead === d ? 'primary' : ''}`}
              onClick={() => setDaysAhead(d)}
            >
              Next {d} days
            </button>
          ))}
        </div>

        <div className="row wrap" style={{ gap: '0.4rem', alignItems: 'center' }}>
          <span className="muted small">Show:</span>
          {(['pending', 'all', 'booked'] as const).map((st) => (
            <button
              key={st}
              type="button"
              className={`btn small ${filterStatus === st ? 'primary' : ''}`}
              onClick={() => setFilterStatus(st)}
            >
              {st === 'pending' ? 'Pending booking' : st === 'booked' ? 'Booked' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {bookingTarget && (
        <BookAppointment
          patient={bookingTarget.patient}
          defaultDate={bookingTarget.defaultDate}
          defaultReason="Follow-up consultation"
          onCancel={() => setBookingTarget(null)}
          onBooked={() => {
            setBookingTarget(null);
            void load();
          }}
        />
      )}

      <ErrorBanner error={error} />
      {items === null && !error && <p className="muted">Loading follow-ups…</p>}

      {items !== null && items.length === 0 && (
        <div className="empty">
          <p>No follow-ups found for this filter.</p>
          <p className="muted small">
            When doctors advise a follow-up date during an OPD consultation, patients appear here until their appointment is booked.
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="cards">
          {items.map((it) => (
            <li key={it.visitId} className={`card appt ${it.isOverdue ? 'absent' : ''}`}>
              <div className="appt-main">
                <div>
                  <div className="row wrap" style={{ gap: '0.5rem', alignItems: 'center' }}>
                    <Link to={`/patients/${it.patientId}`} className="appt-name">
                      {it.patientName}
                    </Link>
                    <FollowUpBadge dateStr={it.followUpDate} isOverdue={it.isOverdue} />
                  </div>

                  <div className="muted small" style={{ marginTop: '0.2rem' }}>
                    {it.patientNumber}
                    {it.patientPhone && (
                      <>
                        {' · '}
                        <a href={`tel:${it.patientPhone}`} style={{ color: 'inherit' }}>
                          📞 {it.patientPhone}
                        </a>
                      </>
                    )}
                    {' · '}Consultation on {it.visitDate}
                  </div>

                  {it.assessment && (
                    <div className="small" style={{ marginTop: '0.3rem' }}>
                      <strong>Assessment:</strong> {it.assessment}
                    </div>
                  )}

                  <div className="chips" style={{ marginTop: '0.4rem' }}>
                    {it.appointmentId ? (
                      <span className="badge ok">
                        ✓ Appointment booked: {it.appointmentDate} {it.appointmentTime} ({it.appointmentStatus})
                      </span>
                    ) : (
                      <span className="badge warn">Pending appointment</span>
                    )}
                    <AllergyBadge status={it.allergyStatus} details={it.allergyDetails} />
                  </div>
                </div>
              </div>

              <div className="row wrap" style={{ marginTop: '0.4rem', gap: '0.4rem' }}>
                {can('appointment:create') && !it.appointmentId && (
                  <button
                    type="button"
                    className="btn primary small"
                    onClick={() =>
                      setBookingTarget({
                        patient: { id: it.patientId, name: it.patientName },
                        defaultDate: it.followUpDate,
                      })
                    }
                  >
                    + Book appointment
                  </button>
                )}
                {can('patient:read_basic') && (
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => setCommTarget(it)}
                    title="Send WhatsApp or SMS recall reminder"
                  >
                    💬 Remind
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {commTarget && (
        <CommunicationModal
          open={true}
          onClose={() => setCommTarget(null)}
          patientId={commTarget.patientId}
          patientName={commTarget.patientName}
          patientPhone={commTarget.patientPhone}
          defaultType={commTarget.appointmentId ? 'appointment_reminder' : 'antenatal_recall'}
          appointmentData={
            commTarget.appointmentId
              ? {
                  appointmentDate: commTarget.appointmentDate ?? commTarget.followUpDate,
                  appointmentTime: commTarget.appointmentTime ?? '10:00 AM',
                }
              : undefined
          }
          antenatalData={{
            nextVisitDate: commTarget.followUpDate,
            customNote: commTarget.assessment ? `Previous assessment: ${commTarget.assessment}` : undefined,
          }}
        />
      )}
    </div>
  );
}
