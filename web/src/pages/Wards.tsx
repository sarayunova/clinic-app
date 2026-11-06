import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, type Bed, type BedObservation } from '../api';
import { useAuth } from '../auth';
import { AllergyBadge, ErrorBanner, Field, fieldErrorsOf, formatAge, todayLocal } from '../components/ui';

type FilterMode = 'all' | 'free' | 'occupied' | 'vitals_alert' | 'active_labor' | 'discharging_soon';
type ViewMode = 'floor_plan' | 'list';

/** Evaluates whether an inpatient observation contains abnormal vitals. */
function evaluateVitals(obs?: BedObservation | null) {
  if (!obs) return { hasAbnormal: false, alerts: [] };
  const alerts: string[] = [];
  const sys = obs.systolicMmhg;
  const dia = obs.diastolicMmhg;

  if (sys != null && dia != null) {
    if (sys >= 140 || dia >= 90) alerts.push(`High BP ${sys}/${dia} mmHg`);
    else if (sys < 90 || dia < 60) alerts.push(`Low BP ${sys}/${dia} mmHg`);
  } else if (sys != null) {
    if (sys >= 140) alerts.push(`High Systolic ${sys} mmHg`);
    else if (sys < 90) alerts.push(`Low Systolic ${sys} mmHg`);
  }

  if (obs.pulseBpm != null) {
    if (obs.pulseBpm > 100) alerts.push(`Tachycardia ${obs.pulseBpm} bpm`);
    else if (obs.pulseBpm < 60) alerts.push(`Bradycardia ${obs.pulseBpm} bpm`);
  }

  if (obs.temperatureC != null) {
    if (obs.temperatureC >= 38.0) alerts.push(`Fever ${obs.temperatureC}°C`);
    else if (obs.temperatureC < 36.0) alerts.push(`Hypothermia ${obs.temperatureC}°C`);
  }

  if (obs.spo2Pct != null && obs.spo2Pct < 95) {
    alerts.push(`Low SpO2 ${obs.spo2Pct}%`);
  }

  if (obs.respRate != null) {
    if (obs.respRate > 22) alerts.push(`Tachypnea ${obs.respRate}/min`);
    else if (obs.respRate < 10) alerts.push(`Bradypnea ${obs.respRate}/min`);
  }

  return { hasAbnormal: alerts.length > 0, alerts };
}

/** Evaluates discharge planning timeline relative to today. */
function getDischargeStatus(dateStr: string | null | undefined, today: string) {
  if (!dateStr) return null;
  if (dateStr === today) return { label: 'Discharge Planned: TODAY', type: 'today' as const };
  const dToday = Date.parse(today);
  const dPlanned = Date.parse(dateStr);
  const diffDays = Math.round((dPlanned - dToday) / 86_400_000);
  if (diffDays === 1) return { label: 'Discharge Planned: Tomorrow', type: 'tomorrow' as const };
  if (diffDays < 0) return { label: `Discharge Overdue (${dateStr})`, type: 'overdue' as const };
  return { label: `Planned: ${dateStr}`, type: 'planned' as const };
}

export function WardsPage() {
  const { can } = useAuth();
  const [beds, setBeds] = useState<Bed[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('floor_plan');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Bed transfer and discharge planning modal state
  const [transferBed, setTransferBed] = useState<Bed | null>(null);
  const [dischargeBed, setDischargeBed] = useState<Bed | null>(null);

  const manage = can('bed:manage');
  const canTransfer = can('bed:transfer');
  const canDischargePlan = can('admission:write') || can('care:write_nursing') || can('discharge:write');
  const today = todayLocal();

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

  async function setActive(b: Bed, value: boolean) {
    try {
      await api('PATCH', `/api/beds/${b.id}`, { active: value });
      await load();
      setSuccessMessage(`Bed ${b.room} / ${b.label} marked ${value ? 'active' : 'out of use'}.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (e) {
      setError(e);
    }
  }

  // Active and occupied counts
  const activeBeds = useMemo(() => beds?.filter((b) => b.active) ?? [], [beds]);
  const occupiedCount = useMemo(() => activeBeds.filter((b) => b.occupied).length, [activeBeds]);
  const freeCount = activeBeds.length - occupiedCount;
  const inactiveCount = (beds?.length ?? 0) - activeBeds.length;
  const occupancyPct = activeBeds.length > 0 ? Math.round((occupiedCount / activeBeds.length) * 100) : 0;

  // Clinical alert counts
  const vitalsAlertCount = useMemo(() => {
    return (beds ?? []).filter((b) => b.occupied && evaluateVitals(b.lastObservation).hasAbnormal).length;
  }, [beds]);

  const activeLaborCount = useMemo(() => {
    return (beds ?? []).filter((b) => b.occupied && Boolean(b.activeLaborPartograph)).length;
  }, [beds]);

  const dischargingTodayCount = useMemo(() => {
    return (beds ?? []).filter((b) => b.occupied && b.expectedDischargeDate === today).length;
  }, [beds, today]);

  const dosesDueCount = useMemo(() => {
    return (beds ?? []).reduce((acc, b) => acc + (b.occupied && b.mayBeDueCount ? b.mayBeDueCount : 0), 0);
  }, [beds]);

  // Filtered beds
  const filteredBeds = useMemo(() => {
    if (!beds) return [];
    let list = beds;

    // Visibility of inactive beds
    if (!manage) {
      list = list.filter((b) => b.active);
    }

    // Filter by mode
    if (filterMode === 'free') {
      list = list.filter((b) => b.active && !b.occupied);
    } else if (filterMode === 'occupied') {
      list = list.filter((b) => b.occupied);
    } else if (filterMode === 'vitals_alert') {
      list = list.filter((b) => b.occupied && evaluateVitals(b.lastObservation).hasAbnormal);
    } else if (filterMode === 'active_labor') {
      list = list.filter((b) => b.occupied && Boolean(b.activeLaborPartograph));
    } else if (filterMode === 'discharging_soon') {
      list = list.filter((b) => {
        if (!b.occupied || !b.expectedDischargeDate) return false;
        const stat = getDischargeStatus(b.expectedDischargeDate, today);
        return stat?.type === 'today' || stat?.type === 'tomorrow' || stat?.type === 'overdue';
      });
    }

    // Search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((b) => {
        const roomMatch = b.room.toLowerCase().includes(q);
        const labelMatch = b.label.toLowerCase().includes(q);
        const nameMatch = b.patientName?.toLowerCase().includes(q);
        const numMatch = b.patientNumber?.toLowerCase().includes(q);
        const admMatch = b.admissionNumber?.toLowerCase().includes(q);
        const diagMatch = b.admissionDiagnosis?.toLowerCase().includes(q);
        return roomMatch || labelMatch || nameMatch || numMatch || admMatch || diagMatch;
      });
    }

    return list;
  }, [beds, manage, filterMode, searchQuery, today]);

  // Group by room
  const rooms = useMemo(() => {
    const m = new Map<string, Bed[]>();
    for (const b of filteredBeds) {
      m.set(b.room, [...(m.get(b.room) ?? []), b]);
    }
    return [...m.entries()];
  }, [filteredBeds]);

  // All active and free beds for the transfer target selection
  const availableBedsForTransfer = useMemo(() => {
    return (beds ?? []).filter((b) => b.active && !b.occupied);
  }, [beds]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 style={{ margin: 0 }}>Inpatient Bed Board & Ward Grid</h1>
          <p className="muted small" style={{ margin: '0.2rem 0 0' }}>
            Live floor plan, real-time bed occupancy, bedside vital alerts, and labor progress tracking
          </p>
        </div>
        <div className="row wrap">
          <Link className="btn" to="/delivery-ward" style={{ border: '1.5px solid #2563eb', color: '#1e40af' }}>
            👶 Delivery Ward Board
          </Link>
          {can('admission:create') && (
            <Link className="btn primary" to="/admissions/new">
              + Admit Patient
            </Link>
          )}
          {manage && (
            <button className="btn" onClick={() => setAdding((a) => !a)}>
              {adding ? 'Close Bed Form' : '+ Add Bed'}
            </button>
          )}
          <div className="view-toggle row" style={{ gap: '0.25rem', background: 'var(--bg)', padding: '0.2rem', borderRadius: '6px' }}>
            <button
              type="button"
              className={`btn small ${viewMode === 'floor_plan' ? 'primary' : ''}`}
              onClick={() => setViewMode('floor_plan')}
              title="Visual floor plan grouped by hospital rooms"
            >
              🏢 Floor Plan
            </button>
            <button
              type="button"
              className={`btn small ${viewMode === 'list' ? 'primary' : ''}`}
              onClick={() => setViewMode('list')}
              title="Compact list view of all beds"
            >
              📋 Bed List
            </button>
          </div>
        </div>
      </header>

      {/* Ward Occupancy Dashboard Banner */}
      {beds && (
        <section className="card stack" style={{ padding: '1rem', background: 'var(--surface)' }}>
          <div className="row wrap between" style={{ alignItems: 'center' }}>
            <div className="row wrap" style={{ gap: '1.25rem', alignItems: 'center' }}>
              <div className="stat" style={{ padding: 0 }}>
                <b style={{ fontSize: '1.6rem', color: occupancyPct > 90 ? 'var(--danger)' : 'var(--primary)' }}>
                  {occupancyPct}%
                </b>
                <span className="muted small">Occupancy</span>
              </div>
              <div className="stat" style={{ padding: 0 }}>
                <b style={{ fontSize: '1.4rem' }}>{occupiedCount}</b>
                <span className="muted small">Occupied Beds</span>
              </div>
              <div className="stat" style={{ padding: 0 }}>
                <b style={{ fontSize: '1.4rem', color: '#16a34a' }}>{freeCount}</b>
                <span className="muted small">Free Beds</span>
              </div>
              <div className="stat" style={{ padding: 0 }}>
                <b style={{ fontSize: '1.4rem' }}>{activeBeds.length}</b>
                <span className="muted small">Total Beds in Use</span>
              </div>
              {inactiveCount > 0 && (
                <div className="stat" style={{ padding: 0 }}>
                  <b style={{ fontSize: '1.4rem', color: 'var(--muted)' }}>{inactiveCount}</b>
                  <span className="muted small">Maintenance / Out</span>
                </div>
              )}
            </div>

            {/* Quick Alert Badges */}
            <div className="row wrap" style={{ gap: '0.5rem' }}>
              {activeLaborCount > 0 && (
                <button
                  type="button"
                  className="badge"
                  style={{
                    background: '#f3e8ff',
                    color: '#6b21a8',
                    border: '1px solid #d8b4fe',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  onClick={() => setFilterMode('active_labor')}
                  title="Filter to beds with patients in active labor"
                >
                  🟣 {activeLaborCount} in Active Labor
                </button>
              )}
              {vitalsAlertCount > 0 && (
                <button
                  type="button"
                  className="badge danger"
                  style={{ cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => setFilterMode('vitals_alert')}
                  title="Filter to beds with abnormal vital readings"
                >
                  ⚠️ {vitalsAlertCount} Vitals Alert
                </button>
              )}
              {dischargingTodayCount > 0 && (
                <button
                  type="button"
                  className="badge ok"
                  style={{ cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => setFilterMode('discharging_soon')}
                  title="Filter to beds with discharge planned for today"
                >
                  🏁 {dischargingTodayCount} Discharge Today
                </button>
              )}
              {dosesDueCount > 0 && (
                <span
                  className="badge warn"
                  style={{ fontWeight: 600 }}
                  title="Medications due for administration across admitted patients"
                >
                  💊 {dosesDueCount} Dose(s) Due
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar of Ward Occupancy */}
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'var(--bg)',
              borderRadius: '4px',
              overflow: 'hidden',
              marginTop: '0.5rem',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, occupancyPct)}%`,
                height: '100%',
                backgroundColor:
                  occupancyPct >= 90 ? 'var(--danger)' : occupancyPct >= 75 ? '#d97706' : '#16a34a',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </section>
      )}

      {/* Filter and Search Bar */}
      <div className="row wrap between" style={{ alignItems: 'center', gap: '0.75rem' }}>
        <div className="row wrap" style={{ gap: '0.4rem', alignItems: 'center' }}>
          <span className="muted small" style={{ fontWeight: 600 }}>Filter:</span>
          <button
            type="button"
            className={`btn small ${filterMode === 'all' ? 'primary' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            All Beds ({beds?.length ?? 0})
          </button>
          <button
            type="button"
            className={`btn small ${filterMode === 'free' ? 'primary' : ''}`}
            onClick={() => setFilterMode('free')}
          >
            🟢 Free ({freeCount})
          </button>
          <button
            type="button"
            className={`btn small ${filterMode === 'occupied' ? 'primary' : ''}`}
            onClick={() => setFilterMode('occupied')}
          >
            🔵 Occupied ({occupiedCount})
          </button>
          {vitalsAlertCount > 0 && (
            <button
              type="button"
              className={`btn small ${filterMode === 'vitals_alert' ? 'primary' : ''}`}
              onClick={() => setFilterMode('vitals_alert')}
            >
              ⚠️ Vitals Alert ({vitalsAlertCount})
            </button>
          )}
          {activeLaborCount > 0 && (
            <button
              type="button"
              className={`btn small ${filterMode === 'active_labor' ? 'primary' : ''}`}
              onClick={() => setFilterMode('active_labor')}
            >
              🟣 Active Labor ({activeLaborCount})
            </button>
          )}
          <button
            type="button"
            className={`btn small ${filterMode === 'discharging_soon' ? 'primary' : ''}`}
            onClick={() => setFilterMode('discharging_soon')}
          >
            🏁 Discharging Soon
          </button>
        </div>

        <div style={{ minWidth: '240px', flex: '1', maxWidth: '360px' }}>
          <input
            type="search"
            placeholder="Search patient, bed, room, diagnosis…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.9rem' }}
          />
        </div>
      </div>

      <ErrorBanner error={error} />
      {successMessage && (
        <div className="banner ok" role="status" style={{ padding: '0.6rem 1rem' }}>
          {successMessage}
        </div>
      )}

      {adding && (
        <AddBed
          rooms={rooms.map(([r]) => r)}
          onDone={() => {
            setAdding(false);
            void load();
          }}
        />
      )}

      {beds === null && !error && <p className="muted">Loading inpatient ward bed board…</p>}
      {beds?.length === 0 && (
        <div className="empty">
          <p>No hospital beds have been configured yet.</p>
          {manage ? (
            <p className="muted">Use “+ Add Bed” above to establish the clinic's rooms and beds.</p>
          ) : (
            <p className="muted">Ask the administrator or doctor to add rooms and beds.</p>
          )}
        </div>
      )}

      {/* VIEW MODE 1: VISUAL FLOOR PLAN / ROOM MATRIX */}
      {viewMode === 'floor_plan' && (
        <div className="stack" style={{ gap: '1.75rem' }}>
          {rooms.map(([room, list]) => {
            const roomOccupied = list.filter((b) => b.occupied).length;
            const roomActive = list.filter((b) => b.active).length;
            const roomPct = roomActive > 0 ? Math.round((roomOccupied / roomActive) * 100) : 0;
            const isFull = roomOccupied === roomActive && roomActive > 0;
            const isEmpty = roomOccupied === 0;

            return (
              <section
                key={room}
                className="room-section card"
                style={{
                  padding: '1.25rem',
                  borderTop: `4px solid ${isFull ? 'var(--primary)' : isEmpty ? '#16a34a' : '#0284c7'}`,
                  background: 'var(--surface)',
                }}
              >
                <div
                  className="row wrap between"
                  style={{ alignItems: 'center', marginBottom: '0.9rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}
                >
                  <div className="row wrap" style={{ alignItems: 'baseline', gap: '0.75rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{room}</h2>
                    <span className="muted small">
                      {roomOccupied} of {roomActive} beds occupied ({roomPct}%)
                    </span>
                  </div>
                  <div>
                    {isFull ? (
                      <span className="badge danger">Room Full</span>
                    ) : isEmpty ? (
                      <span className="badge ok">All Beds Vacant</span>
                    ) : (
                      <span className="badge info">{roomActive - roomOccupied} Bed(s) Available</span>
                    )}
                  </div>
                </div>

                <div className="bed-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '0.9rem' }}>
                  {list.map((b) => (
                    <BedCard
                      key={b.id}
                      bed={b}
                      today={today}
                      canTransfer={canTransfer}
                      canDischargePlan={canDischargePlan}
                      canAdmit={can('admission:create')}
                      manage={manage}
                      onTransferClick={() => setTransferBed(b)}
                      onDischargePlanClick={() => setDischargeBed(b)}
                      onToggleActive={(val) => void setActive(b, val)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: FLAT BED BOARD LIST */}
      {viewMode === 'list' && (
        <div className="card" style={{ padding: '0.5rem', overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th>Room & Bed</th>
                <th>Status</th>
                <th>Patient Details</th>
                <th>Stay</th>
                <th>Diagnosis / Reason</th>
                <th>Vitals (Latest)</th>
                <th>Discharge Plan</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBeds.map((b) => {
                const { hasAbnormal, alerts } = evaluateVitals(b.lastObservation);
                const dischargeStatus = getDischargeStatus(b.expectedDischargeDate, today);

                return (
                  <tr key={b.id} style={{ background: b.occupied ? undefined : 'rgba(0,0,0,0.015)' }}>
                    <td>
                      <b>{b.room}</b>
                      <div className="muted small">Bed {b.label}</div>
                    </td>
                    <td>
                      {b.occupied ? (
                        <span className="badge info">Occupied</span>
                      ) : b.active ? (
                        <span className="badge ok">Free</span>
                      ) : (
                        <span className="badge muted">Out of Use</span>
                      )}
                    </td>
                    <td>
                      {b.occupied ? (
                        <div>
                          <Link to={`/admissions/${b.admissionId}`} style={{ fontWeight: 600 }}>
                            {b.patientName}
                          </Link>
                          <div className="muted small">
                            {b.patientNumber} · {formatAge(b.patientAgeYears, false)}
                          </div>
                          {b.allergyStatus && <AllergyBadge status={b.allergyStatus} details={b.allergyDetails} />}
                          {b.activeLaborPartograph && (
                            <Link
                              to={`/partographs/${b.activeLaborPartograph.id}/print`}
                              className="badge"
                              style={{ display: 'inline-block', marginTop: '0.2rem', background: '#f3e8ff', color: '#6b21a8' }}
                              title="Active Labor Partograph Curve"
                            >
                              🟣 Labor #{b.activeLaborPartograph.partographNumber}
                            </Link>
                          )}
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {b.occupied && b.dayNumber ? (
                        <span className={`badge ${b.dayNumber >= 7 ? 'warn' : 'info'}`}>
                          Day {b.dayNumber}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {b.occupied ? (
                        <div style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span title={b.admissionDiagnosis ?? b.admissionReason ?? ''}>
                            {b.admissionDiagnosis || b.admissionReason || '—'}
                          </span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {b.occupied && b.lastObservation ? (
                        <div>
                          <div>
                            {b.lastObservation.systolicMmhg && b.lastObservation.diastolicMmhg
                              ? `${b.lastObservation.systolicMmhg}/${b.lastObservation.diastolicMmhg} mmHg`
                              : null}
                            {b.lastObservation.pulseBpm ? ` · ${b.lastObservation.pulseBpm} bpm` : null}
                          </div>
                          {hasAbnormal && (
                            <span className="badge danger small" style={{ display: 'inline-block', marginTop: '0.2rem' }}>
                              ⚠️ {alerts[0]}
                            </span>
                          )}
                        </div>
                      ) : b.occupied ? (
                        <span className="muted small">No vitals yet</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {b.occupied && dischargeStatus ? (
                        <span
                          className={`badge ${
                            dischargeStatus.type === 'today'
                              ? 'ok'
                              : dischargeStatus.type === 'overdue'
                              ? 'danger'
                              : 'info'
                          }`}
                        >
                          {dischargeStatus.label}
                        </span>
                      ) : b.occupied ? (
                        <span className="muted small">Not set</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row wrap" style={{ justifyContent: 'flex-end', gap: '0.3rem' }}>
                        {b.occupied ? (
                          <>
                            {canTransfer && (
                              <button
                                type="button"
                                className="btn small"
                                onClick={() => setTransferBed(b)}
                                title="Move patient to another bed"
                              >
                                🔄 Transfer
                              </button>
                            )}
                            {canDischargePlan && (
                              <button
                                type="button"
                                className="btn small"
                                onClick={() => setDischargeBed(b)}
                                title="Set or update expected discharge date"
                              >
                                🏁 Discharge
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {b.active && can('admission:create') && (
                              <Link className="btn small primary" to={`/admissions/new?bedId=${b.id}`}>
                                Admit
                              </Link>
                            )}
                            {manage && (
                              <button
                                type="button"
                                className="btn small"
                                onClick={() => void setActive(b, !b.active)}
                              >
                                {b.active ? 'Disable' : 'Enable'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* QUICK BED TRANSFER MODAL */}
      {transferBed && (
        <QuickTransferModal
          bed={transferBed}
          availableBeds={availableBedsForTransfer}
          onClose={() => setTransferBed(null)}
          onTransferred={async () => {
            setTransferBed(null);
            await load();
            setSuccessMessage(`Patient successfully transferred to new bed.`);
            setTimeout(() => setSuccessMessage(null), 4000);
          }}
        />
      )}

      {/* QUICK DISCHARGE PLANNING MODAL */}
      {dischargeBed && (
        <QuickDischargeModal
          bed={dischargeBed}
          today={today}
          onClose={() => setDischargeBed(null)}
          onSaved={async () => {
            setDischargeBed(null);
            await load();
            setSuccessMessage(`Discharge plan updated successfully.`);
            setTimeout(() => setSuccessMessage(null), 4000);
          }}
        />
      )}
    </div>
  );
}

/** Bed Card Component with live clinical status, vitals chips, labor badge, and bedside shortcuts */
function BedCard({
  bed,
  today,
  canTransfer,
  canDischargePlan,
  canAdmit,
  manage,
  onTransferClick,
  onDischargePlanClick,
  onToggleActive,
}: {
  bed: Bed;
  today: string;
  canTransfer: boolean;
  canDischargePlan: boolean;
  canAdmit: boolean;
  manage: boolean;
  onTransferClick: () => void;
  onDischargePlanClick: () => void;
  onToggleActive: (val: boolean) => void;
}) {
  const { hasAbnormal, alerts } = evaluateVitals(bed.lastObservation);
  const dischargeStatus = getDischargeStatus(bed.expectedDischargeDate, today);

  const cardBorder = !bed.active
    ? '#94a3b8'
    : bed.activeLaborPartograph
    ? '#9333ea'
    : hasAbnormal
    ? 'var(--danger)'
    : bed.occupied
    ? 'var(--primary)'
    : '#16a34a';

  return (
    <div
      className={`card bed-bay ${bed.occupied ? 'occupied' : 'free'} ${bed.active ? '' : 'inactive'}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '0.85rem',
        borderRadius: '8px',
        border: `1.5px solid ${cardBorder}`,
        background: bed.active ? 'var(--surface)' : 'var(--bg)',
        boxShadow: bed.activeLaborPartograph
          ? '0 0 0 1px #a855f7, 0 4px 12px rgba(168, 85, 247, 0.15)'
          : hasAbnormal
          ? '0 0 0 1px var(--danger), 0 2px 8px rgba(179, 38, 30, 0.1)'
          : 'none',
      }}
    >
      <div>
        {/* Bed Bay Header */}
        <div className="row wrap between" style={{ alignItems: 'center', marginBottom: '0.4rem' }}>
          <div className="bed-label" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
            Bed {bed.label}
          </div>
          <div>
            {bed.occupied ? (
              <span
                className={`badge ${
                  (bed.dayNumber ?? 1) >= 7 ? 'warn' : 'info'
                }`}
                style={{ fontWeight: 600 }}
              >
                Day {bed.dayNumber ?? 1}
              </span>
            ) : bed.active ? (
              <span className="badge ok">🟢 Free</span>
            ) : (
              <span className="badge muted">Out of use</span>
            )}
          </div>
        </div>

        {/* Occupied Patient Clinical Body */}
        {bed.occupied ? (
          <div className="stack" style={{ gap: '0.45rem' }}>
            {/* Patient Identity */}
            <div>
              <Link
                to={`/admissions/${bed.admissionId}`}
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: 'var(--text)',
                  textDecoration: 'none',
                  display: 'block',
                }}
                className="hover-underline"
              >
                {bed.patientName}
              </Link>
              <div className="muted small" style={{ marginTop: '0.1rem' }}>
                {bed.patientNumber} · {bed.admissionNumber}
                {bed.patientAgeYears != null ? ` · ${formatAge(bed.patientAgeYears, false)}` : ''}
              </div>
            </div>

            {/* Allergy Badge if recorded */}
            {bed.allergyStatus && <AllergyBadge status={bed.allergyStatus} details={bed.allergyDetails} />}

            {/* Active Labor Partograph Badge */}
            {bed.activeLaborPartograph && (
              <div
                style={{
                  background: '#f3e8ff',
                  border: '1px solid #d8b4fe',
                  borderRadius: '6px',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.85rem',
                  color: '#581c87',
                }}
              >
                <div className="row wrap between" style={{ alignItems: 'center' }}>
                  <b>🟣 Active Labor</b>
                  <Link
                    to={`/partographs/${bed.activeLaborPartograph.id}/print`}
                    style={{ fontSize: '0.8rem', color: '#6b21a8', fontWeight: 600 }}
                  >
                    View Curve →
                  </Link>
                </div>
                <div className="small" style={{ opacity: 0.85 }}>
                  Partograph #{bed.activeLaborPartograph.partographNumber}
                </div>
              </div>
            )}

            {/* Admission Diagnosis / Reason */}
            {(bed.admissionDiagnosis || bed.admissionReason) && (
              <div
                style={{
                  fontSize: '0.82rem',
                  padding: '0.3rem 0.5rem',
                  background: 'var(--bg)',
                  borderRadius: '4px',
                  borderLeft: '3px solid var(--border)',
                }}
              >
                <span className="muted">Dx: </span>
                <b>{bed.admissionDiagnosis || bed.admissionReason}</b>
              </div>
            )}

            {/* Latest Vitals Chips */}
            {bed.lastObservation ? (
              <div
                style={{
                  padding: '0.35rem 0.5rem',
                  borderRadius: '5px',
                  background: hasAbnormal ? 'var(--danger-bg)' : 'var(--bg)',
                  border: hasAbnormal ? '1px solid var(--danger)' : '1px solid var(--border)',
                  fontSize: '0.82rem',
                }}
              >
                <div className="row wrap between" style={{ alignItems: 'center', marginBottom: '0.2rem' }}>
                  <span className="muted small" style={{ fontWeight: 600 }}>
                    Latest Vitals {bed.lastObservation.time ? `(${bed.lastObservation.time})` : ''}
                  </span>
                  {hasAbnormal && (
                    <span className="badge danger small" style={{ padding: '0.1rem 0.35rem' }}>
                      Alert
                    </span>
                  )}
                </div>

                <div className="row wrap" style={{ gap: '0.35rem' }}>
                  {bed.lastObservation.systolicMmhg != null && bed.lastObservation.diastolicMmhg != null && (
                    <span
                      style={{
                        padding: '0.15rem 0.35rem',
                        borderRadius: '3px',
                        background:
                          bed.lastObservation.systolicMmhg >= 140 || bed.lastObservation.diastolicMmhg >= 90
                            ? 'var(--danger)'
                            : 'var(--surface)',
                        color:
                          bed.lastObservation.systolicMmhg >= 140 || bed.lastObservation.diastolicMmhg >= 90
                            ? '#fff'
                            : 'inherit',
                        fontWeight: 600,
                      }}
                    >
                      BP {bed.lastObservation.systolicMmhg}/{bed.lastObservation.diastolicMmhg}
                    </span>
                  )}

                  {bed.lastObservation.pulseBpm != null && (
                    <span
                      style={{
                        padding: '0.15rem 0.35rem',
                        borderRadius: '3px',
                        background:
                          bed.lastObservation.pulseBpm > 100 || bed.lastObservation.pulseBpm < 60
                            ? '#ea580c'
                            : 'var(--surface)',
                        color:
                          bed.lastObservation.pulseBpm > 100 || bed.lastObservation.pulseBpm < 60 ? '#fff' : 'inherit',
                      }}
                    >
                      HR {bed.lastObservation.pulseBpm}
                    </span>
                  )}

                  {bed.lastObservation.temperatureC != null && (
                    <span
                      style={{
                        padding: '0.15rem 0.35rem',
                        borderRadius: '3px',
                        background: bed.lastObservation.temperatureC >= 38.0 ? '#dc2626' : 'var(--surface)',
                        color: bed.lastObservation.temperatureC >= 38.0 ? '#fff' : 'inherit',
                      }}
                    >
                      {bed.lastObservation.temperatureC}°C
                    </span>
                  )}

                  {bed.lastObservation.spo2Pct != null && (
                    <span
                      style={{
                        padding: '0.15rem 0.35rem',
                        borderRadius: '3px',
                        background: bed.lastObservation.spo2Pct < 95 ? '#dc2626' : 'var(--surface)',
                        color: bed.lastObservation.spo2Pct < 95 ? '#fff' : 'inherit',
                      }}
                    >
                      {bed.lastObservation.spo2Pct}% SpO2
                    </span>
                  )}
                </div>

                {hasAbnormal && alerts.length > 0 && (
                  <div className="small" style={{ color: 'var(--danger)', marginTop: '0.25rem', fontWeight: 600 }}>
                    ⚠️ {alerts.join(' · ')}
                  </div>
                )}
              </div>
            ) : (
              <div className="muted small" style={{ fontStyle: 'italic' }}>
                No vitals recorded yet
              </div>
            )}

            {/* Doses due pill */}
            {bed.mayBeDueCount != null && bed.mayBeDueCount > 0 && (
              <div
                style={{
                  fontSize: '0.8rem',
                  padding: '0.2rem 0.4rem',
                  background: 'var(--warn-bg)',
                  color: 'var(--warn-text)',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}
              >
                💊 {bed.mayBeDueCount} dose(s) may be due
              </div>
            )}

            {/* Discharge Plan Status */}
            {dischargeStatus && (
              <div
                style={{
                  fontSize: '0.8rem',
                  padding: '0.25rem 0.45rem',
                  borderRadius: '4px',
                  background:
                    dischargeStatus.type === 'today'
                      ? 'var(--ok-bg)'
                      : dischargeStatus.type === 'overdue'
                      ? 'var(--danger-bg)'
                      : 'var(--info-bg)',
                  color:
                    dischargeStatus.type === 'today'
                      ? 'var(--ok-text)'
                      : dischargeStatus.type === 'overdue'
                      ? 'var(--danger)'
                      : 'var(--info-text)',
                  fontWeight: 600,
                }}
              >
                🏁 {dischargeStatus.label}
              </div>
            )}
          </div>
        ) : (
          /* Free / Unoccupied Bed State */
          <div style={{ padding: '0.75rem 0', textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
              {bed.active ? 'Available for admission' : 'Bed currently decommissioned'}
            </div>
            {bed.active && canAdmit && (
              <Link className="btn small primary" to={`/admissions/new?bedId=${bed.id}`} style={{ width: '100%' }}>
                + Admit Patient Here
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Bedside Quick Actions Footer */}
      <div
        className="row wrap"
        style={{
          marginTop: '0.75rem',
          paddingTop: '0.5rem',
          borderTop: '1px dashed var(--border)',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.35rem',
        }}
      >
        {bed.occupied ? (
          <>
            <Link to={`/admissions/${bed.admissionId}`} className="btn small" style={{ fontSize: '0.8rem' }}>
              Chart →
            </Link>
            <div className="row wrap" style={{ gap: '0.3rem' }}>
              {canTransfer && (
                <button
                  type="button"
                  className="btn small"
                  style={{ fontSize: '0.8rem' }}
                  onClick={onTransferClick}
                  title="Shift patient to another bed"
                >
                  🔄 Transfer
                </button>
              )}
              {canDischargePlan && (
                <button
                  type="button"
                  className="btn small"
                  style={{ fontSize: '0.8rem' }}
                  onClick={onDischargePlanClick}
                  title="Plan discharge date"
                >
                  🏁 Discharge
                </button>
              )}
            </div>
          </>
        ) : (
          manage && (
            <button
              type="button"
              className="btn small"
              style={{ fontSize: '0.8rem', width: '100%' }}
              onClick={() => onToggleActive(!bed.active)}
            >
              {bed.active ? 'Take Out of Use' : 'Put Back in Use'}
            </button>
          )
        )}
      </div>
    </div>
  );
}

/** 1-Click Bed Transfer Modal */
function QuickTransferModal({
  bed,
  availableBeds,
  onClose,
  onTransferred,
}: {
  bed: Bed;
  availableBeds: Bed[];
  onClose: () => void;
  onTransferred: () => Promise<void>;
}) {
  const [toBedId, setToBedId] = useState<number>(availableBeds[0]?.id ?? 0);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const fe = fieldErrorsOf(error);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!toBedId) {
      setError(new Error('Please select an available destination bed.'));
      return;
    }
    if (!bed.admissionId) return;

    setSubmitting(true);
    setError(null);
    try {
      await api('POST', `/api/admissions/${bed.admissionId}/transfer`, {
        toBedId,
        reason: reason.trim(),
        version: bed.admissionVersion ?? 1,
      });
      await onTransferred();
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card stack"
        style={{
          background: 'var(--surface)',
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        }}
      >
        <div className="row wrap between" style={{ alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>🔄 Transfer Inpatient Bed</h2>
          <button type="button" className="btn small" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ background: 'var(--bg)', padding: '0.75rem', borderRadius: '6px' }}>
          <div>
            <b>{bed.patientName}</b> ({bed.patientNumber})
          </div>
          <div className="muted small">
            Current: {bed.room} / Bed {bed.label} · Admission {bed.admissionNumber}
          </div>
        </div>

        <ErrorBanner error={error} />

        {availableBeds.length === 0 ? (
          <div className="empty" style={{ padding: '1rem 0' }}>
            <p>⚠️ No free beds are currently available in the clinic.</p>
            <p className="muted small">
              To move this patient, either discharge another patient or add/enable an available bed.
            </p>
            <button type="button" className="btn" onClick={onClose} style={{ marginTop: '0.5rem' }}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="stack" style={{ gap: '1rem' }}>
            <Field label="Destination Bed" error={fe.toBedId} hint="Select any active unoccupied bed in the clinic">
              <select
                value={toBedId}
                onChange={(e) => setToBedId(Number(e.target.value))}
                required
                style={{ width: '100%', padding: '0.5rem' }}
              >
                {availableBeds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.room} — Bed {b.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Reason for Transfer"
              error={fe.reason}
              hint="e.g. Shifted to Labor Room for active delivery, Post-Op step down, Private room request"
            >
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                minLength={2}
                maxLength={300}
                rows={3}
                placeholder="State the clinical or administrative reason for this move…"
              />
            </Field>

            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={submitting}>
                {submitting ? 'Transferring…' : 'Confirm Bed Transfer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** 1-Click Expected Discharge Planning Modal */
function QuickDischargeModal({
  bed,
  today,
  onClose,
  onSaved,
}: {
  bed: Bed;
  today: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [dateVal, setDateVal] = useState<string>(bed.expectedDischargeDate ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const fe = fieldErrorsOf(error);

  function addDays(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!bed.admissionId) return;

    setSubmitting(true);
    setError(null);
    try {
      await api('PATCH', `/api/admissions/${bed.admissionId}/discharge-plan`, {
        expectedDischargeDate: dateVal.trim() === '' ? null : dateVal.trim(),
        version: bed.admissionVersion ?? undefined,
      });
      await onSaved();
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card stack"
        style={{
          background: 'var(--surface)',
          maxWidth: '480px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        }}
      >
        <div className="row wrap between" style={{ alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>🏁 Expected Discharge Planning</h2>
          <button type="button" className="btn small" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ background: 'var(--bg)', padding: '0.75rem', borderRadius: '6px' }}>
          <div>
            <b>{bed.patientName}</b> ({bed.patientNumber})
          </div>
          <div className="muted small">
            {bed.room} / Bed {bed.label} · Admission {bed.admissionNumber} · Day {bed.dayNumber ?? 1}
          </div>
        </div>

        <ErrorBanner error={error} />

        <form onSubmit={submit} className="stack" style={{ gap: '1rem' }}>
          <Field
            label="Expected Discharge Date"
            error={fe.expectedDischargeDate}
            hint="Set the estimated date the patient is planned to be discharged"
          >
            <input
              type="date"
              value={dateVal}
              onChange={(e) => setDateVal(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </Field>

          {/* Quick Date Shortcuts */}
          <div>
            <span className="muted small" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              Quick Presets:
            </span>
            <div className="row wrap" style={{ gap: '0.35rem' }}>
              <button
                type="button"
                className="btn small"
                onClick={() => setDateVal(today)}
                title="Planned for today"
              >
                Today
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => setDateVal(addDays(1))}
                title="Planned for tomorrow"
              >
                +1 Day (Tomorrow)
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => setDateVal(addDays(2))}
              >
                +2 Days
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => setDateVal(addDays(3))}
              >
                +3 Days
              </button>
              {dateVal && (
                <button
                  type="button"
                  className="btn small danger"
                  onClick={() => setDateVal('')}
                  title="Clear planned discharge date"
                >
                  Clear Date
                </button>
              )}
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Discharge Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Form to add a new bed and room to the clinic */
function AddBed({ rooms, onDone }: { rooms: string[]; onDone: () => void }) {
  const [room, setRoom] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<unknown>(null);
  const fe = fieldErrorsOf(error);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('POST', '/api/beds', { room: room.trim(), label: label.trim() });
      onDone();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <form onSubmit={submit} className="card stack" style={{ padding: '1.25rem', background: 'var(--surface)' }}>
      <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Add a Hospital Bed</h2>
      <ErrorBanner error={error} />
      <div className="grid2">
        <Field label="Room / Ward" error={fe.room} hint="Choose an existing ward or type a new room name">
          <input
            list="room-names"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            required
            maxLength={40}
            placeholder="e.g. Labor Room, Ward A, ICU"
          />
          <datalist id="room-names">
            {rooms.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <Field label="Bed Label" error={fe.label} hint="e.g. Bed 1, Bed A, Delivery Bed 1">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            maxLength={40}
            placeholder="e.g. 1, 2, A, B"
          />
        </Field>
      </div>
      <div className="row" style={{ gap: '0.5rem' }}>
        <button className="btn primary">Add Bed</button>
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
