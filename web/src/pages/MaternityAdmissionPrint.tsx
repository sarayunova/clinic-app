import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type MaternityAdmission } from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';
import {
  calculateRuptureHours,
  isProlongedProm,
} from '../maternityScoring';
import {
  LABOR_STAGE_LABELS,
  INDICATION_LABELS,
  MEMBRANE_STATUS_LABELS,
  LOCATION_LABELS,
} from '../components/MaternityAdmissionManager';

export function MaternityAdmissionPrint() {
  const { id } = useParams();
  const admissionId = Number(id);
  const { clinic, error: clinicError } = useClinic();

  const [admission, setAdmission] = useState<MaternityAdmission | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!admissionId) return;
    api<MaternityAdmission>('GET', `/api/maternity-admissions/${admissionId}`)
      .then(setAdmission)
      .catch(setError);
  }, [admissionId]);

  if (clinicError || error) {
    return (
      <div className="page narrow stack">
        <ErrorBanner error={clinicError || error} />
        <p>
          <Link to="/delivery-ward" className="btn small">
            ← Back to Delivery Ward
          </Link>
        </p>
      </div>
    );
  }

  if (!clinic || !admission) {
    return (
      <div className="page narrow stack">
        <p className="muted">Loading maternity admission & handover sheet…</p>
      </div>
    );
  }

  const promDuration = calculateRuptureHours(admission.membraneRupturedAt);
  const isProlonged = isProlongedProm(promDuration);

  return (
    <Sheet
      clinic={clinic}
      title="Maternity Admission Card & Delivery Ward Handover Record"
      back={`/patients/${admission.patientId}`}
      onPrint={() => window.print()}
    >
      {/* Subhead Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #0f172a',
          paddingBottom: '0.4rem',
          marginBottom: '0.8rem',
        }}
      >
        <div>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Labor & Delivery Ward Management
          </span>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>
            {LOCATION_LABELS[admission.currentLocation] || admission.currentLocation} · {LABOR_STAGE_LABELS[admission.laborStage] || admission.laborStage}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Admission Date</div>
          <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{admission.admissionDate}</strong>
        </div>
      </div>

      {/* Patient Demographics Box */}
      <section className="sheet-block" style={{ marginBottom: '0.8rem' }}>
        <dl
          className="grid-meta"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.5rem 1rem',
            margin: 0,
            background: '#f8fafc',
            padding: '0.6rem 0.8rem',
            borderRadius: '4px',
            border: '1px solid #e2e8f0',
            fontSize: '0.85rem',
          }}
        >
          <div>
            <dt style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Mother's Name</dt>
            <dd style={{ margin: 0, fontWeight: 700 }}>{admission.patientName || '—'}</dd>
          </div>
          <div>
            <dt style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Patient ID</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{admission.patientNumber || '—'}</dd>
          </div>
          <div>
            <dt style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Parity / GA</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>
              G{admission.gravida || 1} P{admission.para || 0} · {admission.gestationalAgeWeeks ? `${admission.gestationalAgeWeeks}w ${admission.gestationalAgeDays || 0}d` : 'Term'}
            </dd>
          </div>
          <div>
            <dt style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Bed / Room</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>
              {admission.bedRoom && admission.bedLabel ? `${admission.bedRoom} / ${admission.bedLabel}` : 'Labor Suite'}
            </dd>
          </div>
        </dl>
      </section>

      {/* High-Risk Alerts Warning if active */}
      {admission.highRiskAlerts && (
        <section
          className="sheet-block"
          style={{
            marginBottom: '0.8rem',
            background: '#fff5f5',
            border: '1.5px solid #ef4444',
            borderRadius: '4px',
            padding: '0.5rem 0.75rem',
            fontSize: '0.85rem',
          }}
        >
          <strong style={{ color: '#991b1b' }}>⚠️ HIGH-RISK OBSTETRIC ALERTS: </strong>
          <span style={{ color: '#7f1d1d' }}>{admission.highRiskAlerts}</span>
        </section>
      )}

      {/* 1. Admission Indication & Baseline Status */}
      <section className="sheet-block" style={{ marginBottom: '0.8rem' }}>
        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.2rem', color: '#1e293b' }}>
          1. Admission Indication & Fetal Status
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: '#64748b' }}>Admission Reason: </span>
            <strong>{INDICATION_LABELS[admission.admissionIndication] || admission.admissionIndication}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Contraction Onset: </span>
            <strong>{admission.contractionOnsetAt || 'Spontaneous onset'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Blood Group / Rh: </span>
            <strong>{admission.bloodGroup || 'Recorded'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Fetal Presentation: </span>
            <strong>{admission.fetalPresentation.replace('_', ' ').toUpperCase()} ({admission.fetalLie})</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>FHR Baseline: </span>
            <strong>{admission.fetalHeartRate ? `${admission.fetalHeartRate} bpm` : '—'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>CTG Category: </span>
            <strong>{admission.ctgCategory.toUpperCase()}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Baseline BP / Pulse: </span>
            <strong>{admission.bpSystolic || '—'}/{admission.bpDiastolic || '—'} mmHg, {admission.pulse ? `${admission.pulse} bpm` : '—'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Attending Obstetrician: </span>
            <strong>{admission.primaryObstetrician || 'Attending Obstetrician'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Attending Nurse/Midwife: </span>
            <strong>{admission.attendingMidwifeNurse || 'Duty Midwife'}</strong>
          </div>
        </div>
      </section>

      {/* 2. Modified Bishop Score Assessment at Admission */}
      <section className="sheet-block" style={{ marginBottom: '0.8rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.2rem', marginBottom: '0.4rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b' }}>
            2. Cervical Assessment & Modified Bishop Score
          </h4>
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor:
                admission.bishopInterpretation === 'favorable'
                  ? '#dcfce7'
                  : admission.bishopInterpretation === 'intermediate'
                  ? '#fef3c7'
                  : '#fee2e2',
              color:
                admission.bishopInterpretation === 'favorable'
                  ? '#166534'
                  : admission.bishopInterpretation === 'intermediate'
                  ? '#92400e'
                  : '#991b1b',
            }}
          >
            Bishop Score: {admission.bishopTotalScore} / 13 ({admission.bishopInterpretation.toUpperCase()})
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', fontSize: '0.8rem', textAlign: 'center' }}>
          <div style={{ background: '#f8fafc', padding: '0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#64748b' }}>Dilation</div>
            <strong>{admission.bishopDilation} pts</strong>
          </div>
          <div style={{ background: '#f8fafc', padding: '0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#64748b' }}>Effacement</div>
            <strong>{admission.bishopEffacement} pts</strong>
          </div>
          <div style={{ background: '#f8fafc', padding: '0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#64748b' }}>Station</div>
            <strong>{admission.bishopStation} pts</strong>
          </div>
          <div style={{ background: '#f8fafc', padding: '0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#64748b' }}>Consistency</div>
            <strong>{admission.bishopConsistency} pts</strong>
          </div>
          <div style={{ background: '#f8fafc', padding: '0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#64748b' }}>Position</div>
            <strong>{admission.bishopPosition} pts</strong>
          </div>
        </div>
      </section>

      {/* 3. Membrane Status & Rupture Tracker (PROM) */}
      <section className="sheet-block" style={{ marginBottom: '0.8rem' }}>
        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.2rem', color: '#1e293b' }}>
          3. Membrane Status & Rupture Tracker (PROM)
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: '#64748b' }}>Membrane Status: </span>
            <strong style={{ color: isProlonged ? '#dc2626' : undefined }}>
              {MEMBRANE_STATUS_LABELS[admission.membraneStatus] || admission.membraneStatus}
            </strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Rupture Time / Duration: </span>
            <span>
              {admission.membraneRupturedAt || 'Intact'}{' '}
              {promDuration != null ? `(${promDuration} hrs)` : ''}
            </span>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Antibiotic Prophylaxis: </span>
            <strong>{admission.promAntibioticsGiven ? '✓ Administered' : '✗ Not Indicated / Pending'}</strong>
          </div>
        </div>
        {isProlonged && (
          <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: '#991b1b', background: '#fee2e2', padding: '3px 8px', borderRadius: '4px' }}>
            ⚠️ <strong>PROLONGED PROM (&gt;18 Hours):</strong> Neonatal sepsis risk elevated. Maternal IV antibiotic prophylaxis (Ampicillin/Cefazolin) indicated. Notify pediatrician upon delivery.
          </div>
        )}
      </section>

      {/* 4. Active Labor Progress & Oxytocin Titration */}
      <section className="sheet-block" style={{ marginBottom: '0.8rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.2rem', marginBottom: '0.4rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b' }}>
            4. Oxytocin Titration & Uterine Activity Flow
          </h4>
          <span style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600 }}>
            Current Rate: {admission.activeOxytocinRate || 'No Oxytocin Infusion'}
          </span>
        </div>

        {(!admission.oxytocinLogs || admission.oxytocinLogs.length === 0) ? (
          <p className="muted small" style={{ margin: 0 }}>No oxytocin infusion titration steps logged for this labor.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1', textAlign: 'left' }}>
                <th style={{ padding: '4px 6px' }}>Time</th>
                <th style={{ padding: '4px 6px' }}>Rate (mU/min)</th>
                <th style={{ padding: '4px 6px' }}>Drops/min</th>
                <th style={{ padding: '4px 6px' }}>Contractions / 10m</th>
                <th style={{ padding: '4px 6px' }}>Duration (s)</th>
                <th style={{ padding: '4px 6px' }}>FHR (bpm)</th>
                <th style={{ padding: '4px 6px' }}>Action & Observations</th>
                <th style={{ padding: '4px 6px' }}>Staff</th>
              </tr>
            </thead>
            <tbody>
              {admission.oxytocinLogs.map((o) => (
                <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px 6px' }}>{o.loggedAt.slice(11, 16) || o.loggedAt}</td>
                  <td style={{ padding: '4px 6px', fontWeight: 700 }}>{o.infusionRateMUPerMin}</td>
                  <td style={{ padding: '4px 6px' }}>{o.dropsPerMin ?? '—'}</td>
                  <td style={{ padding: '4px 6px' }}>
                    {o.contractionsPer10min}
                    {o.hyperstimulationNoted && <span style={{ color: '#dc2626', fontWeight: 700 }}> (Tachysystole)</span>}
                  </td>
                  <td style={{ padding: '4px 6px' }}>{o.contractionDurationSec}s ({o.contractionIntensity})</td>
                  <td style={{ padding: '4px 6px' }}>{o.fetalHeartRate}</td>
                  <td style={{ padding: '4px 6px' }}>{o.actionTaken || '—'}</td>
                  <td style={{ padding: '4px 6px' }}>{o.loggedByName || 'Staff'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 5. SBAR Shift Handover Records */}
      <section className="sheet-block" style={{ marginBottom: '0.8rem' }}>
        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.95rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.2rem', color: '#1e293b' }}>
          5. SBAR Shift Handover Log
        </h4>

        {(!admission.handovers || admission.handovers.length === 0) ? (
          <p className="muted small" style={{ margin: 0 }}>No shift handover notes logged for this admission.</p>
        ) : (
          <div className="stack" style={{ gap: '0.5rem' }}>
            {admission.handovers.map((h) => (
              <div key={h.id} style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.5rem', background: '#f8fafc', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <strong>{h.shiftName.toUpperCase()} SHIFT ({h.handoverAt}) — Outgoing: {h.outgoingStaff} → Incoming: {h.incomingStaff}</strong>
                  <span style={{ fontWeight: 700, color: h.urgencyLevel === 'immediate_attention' ? '#dc2626' : '#2563eb' }}>
                    [{h.urgencyLevel.replace('_', ' ').toUpperCase()}]
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <div><strong>S:</strong> {h.situation}</div>
                  <div><strong>B:</strong> {h.background}</div>
                  <div><strong>A:</strong> {h.assessment}</div>
                  <div><strong>R:</strong> {h.recommendation}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 6. Emergency LSCS Surgical Readiness Checklist (if present) */}
      {admission.emergencyLscsChecklist && (
        <section
          className="sheet-block"
          style={{
            marginBottom: '1rem',
            border: '1.5px solid #dc2626',
            borderRadius: '4px',
            padding: '0.6rem',
            background: '#fff5f5',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#991b1b' }}>
              6. Emergency LSCS Surgical Readiness Checklist
            </h4>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#991b1b' }}>
              Decision: {admission.emergencyLscsChecklist.decisionAt} (Target: ≤ {admission.emergencyLscsChecklist.decisionToDeliveryTargetMins} mins)
            </span>
          </div>

          <div style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}>
            <strong>Indication: </strong>{admission.emergencyLscsChecklist.surgicalIndication} · <strong>Surgeon: </strong>{admission.emergencyLscsChecklist.operatingSurgeon || 'Duty Obstetrician'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem 0.5rem', fontSize: '0.75rem' }}>
            <div>Anesthetist: <strong>{admission.emergencyLscsChecklist.anesthetistNotified ? '✓ Notified' : '✗ Pending'}</strong></div>
            <div>Pediatrician: <strong>{admission.emergencyLscsChecklist.pediatricianNotified ? '✓ Notified' : '✗ Pending'}</strong></div>
            <div>Consent: <strong>{admission.emergencyLscsChecklist.consentSigned ? '✓ Signed' : '✗ Pending'}</strong></div>
            <div>IV Access: <strong>{admission.emergencyLscsChecklist.wideBoreIvAccess ? '✓ 16G/18G Patent' : '✗ Pending'}</strong></div>
            <div>Blood: <strong>{admission.emergencyLscsChecklist.bloodArranged ? `✓ Arranged (${admission.emergencyLscsChecklist.bloodUnitsArranged || 2}u)` : '✗ Pending'}</strong></div>
            <div>Antacid Prophylaxis: <strong>{admission.emergencyLscsChecklist.preopAntacidGiven ? '✓ Given' : '✗ Pending'}</strong></div>
            <div>Antibiotic Prophylaxis: <strong>{admission.emergencyLscsChecklist.antibioticProphylaxisGiven ? '✓ Given' : '✗ Pending'}</strong></div>
            <div>Foley Catheter: <strong>{admission.emergencyLscsChecklist.foleyCatheterInserted ? '✓ Inserted' : '✗ Pending'}</strong></div>
            <div>Abdominal Prep: <strong>{admission.emergencyLscsChecklist.abdominalPrepDone ? '✓ Completed' : '✗ Pending'}</strong></div>
            <div>OT Readiness: <strong style={{ color: admission.emergencyLscsChecklist.otReady ? '#16a34a' : '#dc2626' }}>{admission.emergencyLscsChecklist.otReady ? '✓ OT READY' : '✗ PENDING'}</strong></div>
          </div>
        </section>
      )}

      {/* Dual Signature Blocks */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2rem',
          marginTop: '1.5rem',
          paddingTop: '0.5rem',
        }}
      >
        <SignatureBlock
          clinic={clinic}
          signatoryName={admission.attendingMidwifeNurse || 'Duty Labor Room Midwife'}
          designation="Labor Room In-Charge / Registered Midwife"
          hideSignatureImage
        />
        <SignatureBlock
          clinic={clinic}
          signatoryName={admission.primaryObstetrician || admission.createdByName || 'Attending Obstetrician'}
          designation="Consultant Obstetrician & Gynecologist"
        />
      </div>
    </Sheet>
  );
}
