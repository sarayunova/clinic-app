import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type PphAssessment } from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';
import { FOUR_T_ETIOLOGY_INFO } from '../pphScoring';

export function PphAssessmentPrint() {
  const { id } = useParams();
  const assessmentId = Number(id);
  const { clinic, error: clinicError } = useClinic();

  const [assessment, setAssessment] = useState<PphAssessment | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!assessmentId) return;
    setLoading(true);
    api<PphAssessment>('GET', `/api/pph-assessments/${assessmentId}`)
      .then((res) => {
        setAssessment(res);
        setError(null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [assessmentId]);

  if (clinicError || error) {
    return (
      <div className="page narrow stack">
        <ErrorBanner error={clinicError || error} />
        <p>
          <Link to={`/patients/${assessment?.patientId || ''}`} className="btn small">
            ← Back to Patient Record
          </Link>
        </p>
      </div>
    );
  }

  if (loading || !clinic || !assessment) {
    return (
      <div className="page narrow stack">
        <p className="muted">Loading PPH resuscitation audit sheet…</p>
      </div>
    );
  }

  const e4t = FOUR_T_ETIOLOGY_INFO[assessment.primaryEtiology4t];

  return (
    <Sheet
      clinic={clinic}
      title="POSTPARTUM HEMORRHAGE (PPH) & QUANTITATIVE BLOOD LOSS (QBL) AUDIT"
      back={`/patients/${assessment.patientId}`}
    >
      <div className="stack" style={{ gap: '1rem', fontSize: '0.85rem' }}>
        {/* Patient Demographics & Delivery Summary Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.6rem',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '0.8rem',
          }}
        >
          <div>
            <span className="muted small">Patient Name:</span>
            <div><strong style={{ fontSize: '1rem' }}>{assessment.patientName || '—'}</strong></div>
          </div>
          <div>
            <span className="muted small">Patient Number / ID:</span>
            <div><strong>{assessment.patientNumber || '—'}</strong></div>
          </div>
          <div>
            <span className="muted small">Delivery Mode:</span>
            <div><strong style={{ textTransform: 'uppercase' }}>{assessment.deliveryMode.replace('_', ' ')}</strong></div>
          </div>
          <div>
            <span className="muted small">Blood Group:</span>
            <div><strong>{assessment.patientBloodGroup || 'Not recorded'}</strong></div>
          </div>

          <div>
            <span className="muted small">Delivery Timestamp:</span>
            <div><strong>{assessment.deliveryTimestamp.replace('T', ' ')}</strong></div>
          </div>
          <div>
            <span className="muted small">PPH Staging:</span>
            <div>
              <strong style={{ color: assessment.pphStage === 'stage_3_severe_mtp' ? '#dc2626' : '#b45309' }}>
                {assessment.pphStage.toUpperCase().replace('_', ' ')}
              </strong>
            </div>
          </div>
          <div>
            <span className="muted small">Attending Obstetrician:</span>
            <div><strong>{assessment.attendingObstetrician || '—'}</strong></div>
          </div>
          <div>
            <span className="muted small">Attending Anesthetist:</span>
            <div><strong>{assessment.attendingAnesthetist || '—'}</strong></div>
          </div>
        </div>

        {/* Severity Banner */}
        <div
          style={{
            background: assessment.pphStage === 'stage_3_severe_mtp' ? '#fef2f2' : '#fffbeb',
            border: `1.5px solid ${assessment.pphStage === 'stage_3_severe_mtp' ? '#dc2626' : '#d97706'}`,
            borderRadius: '6px',
            padding: '0.75rem 1rem',
          }}
        >
          <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ fontSize: '1rem', color: assessment.pphStage === 'stage_3_severe_mtp' ? '#991b1b' : '#92400e' }}>
                Total Cumulative QBL: {assessment.qblTotalMl} mL
              </strong>
              {assessment.eblVisualEstimateMl && (
                <span className="muted small" style={{ marginLeft: '0.8rem' }}>
                  (Visual EBL was estimated at {assessment.eblVisualEstimateMl} mL)
                </span>
              )}
            </div>

            <div className="row wrap" style={{ gap: '0.5rem', alignItems: 'center' }}>
              <span className="badge" style={{ fontWeight: 'bold' }}>
                Obstetric Shock Index: {assessment.shockIndex ?? '—'}
              </span>
              <span className={`badge ${assessment.shockIndexSeverity === 'critical_collapse' || assessment.shockIndexSeverity === 'high_risk' ? 'err' : 'ok'}`}>
                {assessment.shockIndexSeverity.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* QBL Breakdown & 4T Etiology Card Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.8rem' }}>
          {/* QBL Breakdown */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.8rem', background: '#f8fafc' }}>
            <strong style={{ color: '#0f172a', display: 'block', marginBottom: '0.4rem' }}>
              ⚖️ Quantitative Blood Loss (QBL) Measurement Audit
            </strong>
            <div className="stack" style={{ gap: '0.3rem', fontSize: '0.82rem' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">• Calibrated Under-Buttocks V-Drape:</span>
                <strong>{assessment.qblCalibratedDrapeMl} mL</strong>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">• Suction Canister Volume:</span>
                <strong>{assessment.qblSuctionCanisterMl} mL</strong>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">• Sponges Net Blood ({assessment.qblSpongesWetWeightG}g wet − {assessment.qblSpongesDryWeightG}g dry):</span>
                <strong>{Math.max(0, assessment.qblSpongesWetWeightG - assessment.qblSpongesDryWeightG)} mL</strong>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">• Weighed Retroplacental Clots (1g = 1mL):</span>
                <strong>{assessment.qblClotsWeighedG} mL</strong>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '0.3rem', marginTop: '0.2rem' }}>
                <span><strong>Total Cumulative Measured QBL:</strong></span>
                <strong style={{ color: '#dc2626', fontSize: '0.95rem' }}>{assessment.qblTotalMl} mL</strong>
              </div>
            </div>
          </div>

          {/* 4T Etiology Assessment */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.8rem', background: '#f8fafc' }}>
            <strong style={{ color: '#0f172a', display: 'block', marginBottom: '0.4rem' }}>
              🎯 Primary 4T Etiology: {e4t?.name || assessment.primaryEtiology4t}
            </strong>
            <div className="stack" style={{ gap: '0.3rem', fontSize: '0.82rem' }}>
              <div>
                <span className="muted">Uterine Tone:</span> <strong>{assessment.uterineTone.replace('_', ' ').toUpperCase()}</strong>
              </div>
              <div>
                <span className="muted">Etiology Details:</span> {assessment.etiologyDetails || 'Uterine atony with delayed third stage response.'}
              </div>
              <div>
                <span className="muted">Clinical Presentation:</span> {e4t?.findings || '—'}
              </div>
              <div>
                <span className="muted">Interventions:</span> {e4t?.keyInterventions || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Resuscitation, Uterotonics & Transfusions Protocol Table */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ background: '#0f172a', color: '#ffffff', padding: '0.4rem 0.75rem', fontWeight: 'bold', fontSize: '0.88rem' }}>
            💉 STAGE-BASED MEDICAL RESUSCITATION &amp; UTEROTONICS AUDIT
          </div>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <td style={{ padding: '0.4rem 0.6rem', width: '25%' }}><strong>Bimanual Uterine Compression</strong></td>
                <td style={{ padding: '0.4rem 0.6rem', width: '25%' }}>
                  <strong>{assessment.bimanualCompressionDone ? 'PERFORMED' : 'NOT DONE'}</strong>
                </td>
                <td style={{ padding: '0.4rem 0.6rem', width: '25%' }}><strong>Foley Catheter Bladder Drainage</strong></td>
                <td style={{ padding: '0.4rem 0.6rem', width: '25%' }}>
                  <strong>{assessment.bladderCatheterized ? 'INSERTED' : 'NOT DONE'}</strong>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>IV Wide-Bore Cannulae (14G/16G)</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  <strong>{assessment.ivAccessTwoWideBore ? 'TWO LINES SECURED' : 'ONE LINE'}</strong>
                </td>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>IV Crystalloids Infused</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  <strong>{assessment.crystalloidsInfusedMl} mL</strong>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>Oxytocin Infusion</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  <strong>{assessment.oxytocinGiven ? (assessment.oxytocinDoseRoute || 'GIVEN') : 'NOT GIVEN'}</strong>
                </td>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>Tranexamic Acid (TXA 1g IV)</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  <strong style={{ color: assessment.tranexamicAcidGiven ? '#16a34a' : '#64748b' }}>
                    {assessment.tranexamicAcidGiven ? `GIVEN at ${assessment.txaGivenAt || 'early'}` : 'NOT GIVEN'}
                  </strong>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>Methylergometrine (0.2mg IM)</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  {assessment.methergineContraindicated ? (
                    <strong style={{ color: '#dc2626' }}>CONTRAINDICATED (Hypertension / Pre-eclampsia)</strong>
                  ) : assessment.methylergometrineGiven ? (
                    <strong>ADMINISTERED</strong>
                  ) : (
                    <span className="muted">Omitted</span>
                  )}
                </td>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>Carboprost PGF2α (250mcg IM)</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  {assessment.carboprostContraindicated ? (
                    <strong style={{ color: '#dc2626' }}>CONTRAINDICATED (Bronchial Asthma)</strong>
                  ) : assessment.carboprostGiven ? (
                    <strong>{assessment.carboprostDosesCount || 1} DOSE(S) GIVEN</strong>
                  ) : (
                    <span className="muted">Omitted</span>
                  )}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>Misoprostol (PGE1)</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  <strong>{assessment.misoprostolGiven ? `${assessment.misoprostolDoseMcg} mcg Sublingual/Rectal` : 'NOT GIVEN'}</strong>
                </td>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>Intrauterine Tamponade Balloon</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  <strong>{assessment.uterineTamponadeBalloonUsed ? `Bakri/Condom Balloon (${assessment.balloonFillVolumeMl} mL)` : 'None'}</strong>
                </td>
              </tr>
              <tr style={{ background: '#f8fafc' }}>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>Massive Transfusion (MTP)</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  {assessment.mtpActivated ? (
                    <strong style={{ color: '#dc2626' }}>
                      ACTIVATED: PRBC {assessment.bloodUnitsTransfused}u, FFP {assessment.ffpUnitsTransfused}u, Plt {assessment.plateletUnitsTransfused}u
                    </strong>
                  ) : (
                    <span>PRBC: {assessment.bloodUnitsTransfused}u (MTP Not Activated)</span>
                  )}
                </td>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>Surgical Intervention / Outcome</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  <strong>{assessment.surgicalIntervention.replace('_', ' ').toUpperCase()}</strong> · {assessment.outcomeStatus.replace('_', ' ').toUpperCase()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Timeline increments table if logged */}
        {assessment.timelineEntries && assessment.timelineEntries.length > 0 && (
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ background: '#334155', color: '#ffffff', padding: '0.35rem 0.75rem', fontWeight: 'bold', fontSize: '0.82rem' }}>
              ⏱️ RESUSCITATION TIMELINE &amp; SERIAL SHOCK INDEX READINGS
            </div>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: '0.4rem' }}>Timestamp</th>
                  <th style={{ padding: '0.4rem' }}>Cumulative QBL</th>
                  <th style={{ padding: '0.4rem' }}>Pulse / BP</th>
                  <th style={{ padding: '0.4rem' }}>Shock Index</th>
                  <th style={{ padding: '0.4rem' }}>Action Taken</th>
                  <th style={{ padding: '0.4rem' }}>Staff</th>
                </tr>
              </thead>
              <tbody>
                {assessment.timelineEntries.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.35rem 0.4rem' }}>{t.loggedAt.replace('T', ' ').slice(0, 16)}</td>
                    <td style={{ padding: '0.35rem 0.4rem' }}><strong>{t.cumulativeQblMl} mL</strong></td>
                    <td style={{ padding: '0.35rem 0.4rem' }}>{t.pulse ? `${t.pulse} bpm` : '—'} · {t.bpSystolic && t.bpDiastolic ? `${t.bpSystolic}/${t.bpDiastolic}` : '—'}</td>
                    <td style={{ padding: '0.35rem 0.4rem' }}><strong>{t.shockIndex ?? '—'}</strong></td>
                    <td style={{ padding: '0.35rem 0.4rem' }}>{t.actionTaken || '—'}</td>
                    <td style={{ padding: '0.35rem 0.4rem', color: '#64748b' }}>{t.loggedByName || 'Staff'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Dual Signatures: Attending Obstetrician & Anesthetist */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
          <SignatureBlock
            clinic={clinic}
            signatoryName={assessment.attendingObstetrician || clinic.doctorName}
            designation="Attending Obstetrician &amp; Gynecologist"
            subtext="Certified PPH Clinical Resuscitation Audit"
            alignment="left"
          />
          <SignatureBlock
            clinic={clinic}
            signatoryName={assessment.attendingAnesthetist || 'Consultant Anesthesiologist'}
            designation="Consultant Anesthesiologist"
            subtext="Hemodynamic &amp; Transfusion Sign-off"
            alignment="right"
          />
        </div>
      </div>
    </Sheet>
  );
}
