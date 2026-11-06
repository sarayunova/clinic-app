import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Patient, VisitSummary } from '../api';
import { calculateEdd, calculateGestationalAge, formatGpal, getTrimester } from '../pregnancy';
import { VitalsAlertBadges } from './VitalsBadges';
import { evaluateVitalsAlerts } from '../vitalsAlerts';

interface Props {
  patient: Patient;
  visits: VisitSummary[];
  onOpenChecklist?: () => void;
}

export function AntenatalFlowsheet({ patient, visits, onOpenChecklist }: Props) {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const lmp = typeof patient.lastMenstrualPeriod === 'string' ? patient.lastMenstrualPeriod : null;
  const edd = calculateEdd(lmp);
  const currentGa = calculateGestationalAge(lmp);
  const gpalText = formatGpal({
    gravida: patient.gravida,
    para: patient.para,
    abortions: patient.abortions,
    living: patient.living,
  });

  // Sort visits chronologically (asc) or newest-first (desc)
  const sorted = [...visits].sort((a, b) => {
    const diff = (a.visitDate || '').localeCompare(b.visitDate || '');
    return sortOrder === 'asc' ? diff : -diff;
  });

  // Determine baseline (booking) weight from earliest visit chronologically
  const chronological = [...visits].sort((a, b) => (a.visitDate || '').localeCompare(b.visitDate || ''));
  const firstWithWeight = chronological.find((v) => v.vitals?.weightKg != null);
  const bookingWeight = firstWithWeight?.vitals?.weightKg ?? null;

  // Latest recorded weight
  const latestWithWeight = [...chronological].reverse().find((v) => v.vitals?.weightKg != null);
  const currentWeight = latestWithWeight?.vitals?.weightKg ?? null;
  const totalWeightGain =
    bookingWeight != null && currentWeight != null ? Math.round((currentWeight - bookingWeight) * 10) / 10 : null;

  return (
    <div className="antenatal-flowsheet stack" style={{ marginTop: '0.5rem' }}>
      {/* Obstetric & Maternity Status Overview Card */}
      <div
        className="card"
        style={{
          background: 'var(--surface)',
          borderLeft: '4px solid var(--primary)',
          padding: '1rem 1.25rem',
        }}
      >
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🤰 Antenatal Maternity Summary</span>
              {gpalText && <span className="badge">{gpalText}</span>}
              {onOpenChecklist && (
                <button
                  type="button"
                  className="chip-btn pill-add"
                  onClick={onOpenChecklist}
                  style={{ fontSize: '0.78rem' }}
                >
                  🧪 Lab & Scan Checklist
                </button>
              )}
            </h3>
            <div className="muted small" style={{ marginTop: '0.35rem' }}>
              {lmp ? (
                <>
                  <strong>LMP:</strong> {lmp} · <strong>EDD:</strong> {edd ?? '—'}
                  {currentGa && (
                    <span>
                      {' '}
                      · <strong>Current GA:</strong> {currentGa.formatted} ({getTrimester(currentGa.weeks).label})
                    </span>
                  )}
                </>
              ) : (
                <span>No LMP recorded for this patient.</span>
              )}
            </div>
          </div>

          {bookingWeight != null && (
            <div className="row wrap" style={{ gap: '1rem', alignItems: 'center' }}>
              <div className="stat" style={{ padding: '0.35rem 0.75rem', minWidth: 'auto' }}>
                <span style={{ fontSize: '0.75rem' }}>Booking weight</span>
                <b style={{ fontSize: '1.1rem' }}>{bookingWeight} kg</b>
              </div>
              {currentWeight != null && totalWeightGain != null && (
                <div className="stat" style={{ padding: '0.35rem 0.75rem', minWidth: 'auto' }}>
                  <span style={{ fontSize: '0.75rem' }}>Total Gain</span>
                  <b style={{ fontSize: '1.1rem', color: totalWeightGain >= 0 ? '#16a34a' : '#d97706' }}>
                    {totalWeightGain >= 0 ? `+${totalWeightGain}` : totalWeightGain} kg
                  </b>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action / Controls Bar */}
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="muted small">
          Showing {sorted.length} {sorted.length === 1 ? 'consultation' : 'consultations'}
        </div>
        <div className="row no-print" style={{ gap: '0.5rem' }}>
          <button
            type="button"
            className="btn small"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title="Toggle chronological vs newest-first order"
          >
            {sortOrder === 'asc' ? '⬆️ Chronological (Booking first)' : '⬇️ Newest First'}
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() => window.print()}
            title="Print maternity flowsheet table"
          >
            🖨️ Print Flowsheet
          </button>
          <Link
            className="btn small"
            to={`/patients/${patient.id}/summary/print?mode=antenatal_card`}
            title="Generate & print Antenatal Discharge & Referral Card"
          >
            📄 Antenatal / Referral Card
          </Link>
        </div>
      </div>

      {/* Flowsheet Table */}
      {sorted.length === 0 ? (
        <p className="muted">No consultations recorded for this patient yet.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '0.6rem 0.75rem' }}>Date / Visit</th>
                <th style={{ padding: '0.6rem 0.75rem' }}>Gestation (GA)</th>
                <th style={{ padding: '0.6rem 0.75rem' }}>Weight</th>
                <th style={{ padding: '0.6rem 0.75rem' }}>BP (mmHg)</th>
                <th style={{ padding: '0.6rem 0.75rem' }}>Pulse / Temp</th>
                <th style={{ padding: '0.6rem 0.75rem' }}>Antenatal Observations</th>
                <th style={{ padding: '0.6rem 0.75rem' }}>Investigations / Urine</th>
                <th style={{ padding: '0.6rem 0.75rem' }}>Assessment & Plan</th>
                <th style={{ padding: '0.6rem 0.75rem' }}>Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((v) => {
                const ga = calculateGestationalAge(lmp, v.visitDate);
                const trimester = ga ? getTrimester(ga.weeks) : null;
                const alerts = v.vitals ? evaluateVitalsAlerts(v.vitals) : [];

                const w = v.vitals?.weightKg ?? null;
                const weightDiff =
                  w != null && bookingWeight != null ? Math.round((w - bookingWeight) * 10) / 10 : null;

                const sys = v.vitals?.systolicMmhg;
                const dia = v.vitals?.diastolicMmhg;
                const bpText = sys != null && dia != null ? `${sys}/${dia}` : sys != null ? `${sys}/—` : dia != null ? `—/${dia}` : '—';

                const pulse = v.vitals?.pulseBpm;
                const temp = v.vitals?.temperatureC;
                const ptText = [
                  pulse != null ? `${pulse} bpm` : null,
                  temp != null ? `${temp}°C` : null,
                ].filter(Boolean).join(' · ');

                return (
                  <tr
                    key={v.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      verticalAlign: 'top',
                    }}
                  >
                    {/* Date / Link */}
                    <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                      <Link to={`/visits/${v.id}`} style={{ fontWeight: 600 }}>
                        {v.visitDate}
                      </Link>
                      <div className="muted small" style={{ fontSize: '0.75rem' }}>
                        {v.status === 'draft' ? 'Draft' : 'Final'}
                        {v.amendments > 0 ? ` · ${v.amendments}×` : ''}
                      </div>
                    </td>

                    {/* Gestational Age */}
                    <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                      {ga ? (
                        <div>
                          <strong>{ga.formatted}</strong>
                          {trimester && (
                            <span
                              className="badge info"
                              style={{ marginLeft: '0.35rem', fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}
                            >
                              T{trimester.trimester}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>

                    {/* Weight & Weight Gain */}
                    <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                      {w != null ? (
                        <div>
                          <strong>{w} kg</strong>
                          {weightDiff != null && (
                            <div className="muted small" style={{ fontSize: '0.75rem' }}>
                              {weightDiff >= 0 ? `+${weightDiff}` : weightDiff} kg
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>

                    {/* Blood Pressure & Alert Badges */}
                    <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: bpText !== '—' ? 600 : 'normal' }}>{bpText}</div>
                      {alerts.some((a) => a.parameter === 'bp') && (
                        <div style={{ marginTop: '0.2rem' }}>
                          <VitalsAlertBadges alerts={alerts.filter((a) => a.parameter === 'bp')} />
                        </div>
                      )}
                    </td>

                    {/* Pulse / Temperature */}
                    <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                      {ptText ? <span>{ptText}</span> : <span className="muted">—</span>}
                      {alerts.some((a) => a.parameter === 'pulse' || a.parameter === 'temperature') && (
                        <div style={{ marginTop: '0.2rem' }}>
                          <VitalsAlertBadges
                            alerts={alerts.filter((a) => a.parameter === 'pulse' || a.parameter === 'temperature')}
                          />
                        </div>
                      )}
                    </td>

                    {/* Antenatal Observations / Fundal Height */}
                    <td style={{ padding: '0.6rem 0.75rem', minWidth: '150px' }}>
                      {v.antenatalNotes || v.examination ? (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{v.antenatalNotes ?? v.examination}</div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>

                    {/* Investigations / Urine */}
                    <td style={{ padding: '0.6rem 0.75rem', minWidth: '140px' }}>
                      {v.investigations ? (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{v.investigations}</div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>

                    {/* Assessment & Advice */}
                    <td style={{ padding: '0.6rem 0.75rem', minWidth: '150px' }}>
                      {v.assessment || v.advice ? (
                        <div>
                          {v.assessment && <div><strong>{v.assessment}</strong></div>}
                          {v.advice && <div className="muted small">{v.advice}</div>}
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>

                    {/* Follow-up Date */}
                    <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                      {v.followUpDate ? (
                        <span className="badge">{v.followUpDate}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
