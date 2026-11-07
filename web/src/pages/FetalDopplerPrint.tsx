import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Patient, type FetalDopplerAssessment } from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';

export function FetalDopplerPrint() {
  const { patientId, id } = useParams();
  const assessmentId = Number(id);
  const pId = Number(patientId);

  const { clinic, error: clinicError } = useClinic();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [assessment, setAssessment] = useState<FetalDopplerAssessment | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    if (!assessmentId || !pId) return;

    Promise.all([
      api<{ patient: Patient }>('GET', `/api/patients/${pId}`),
      api<FetalDopplerAssessment>('GET', `/api/patients/${pId}/doppler/${assessmentId}`),
    ])
      .then(([pRes, aRes]) => {
        setPatient(pRes.patient);
        setAssessment(aRes);
      })
      .catch(setError);
  }, [pId, assessmentId]);

  const handlePrint = async () => {
    try {
      await api('POST', `/api/patients/${pId}/doppler/${assessmentId}/audit-print`);
      setPrinted(true);
    } catch {
      // non-blocking
    }
    window.print();
  };

  if (clinicError || error) {
    return (
      <div className="page narrow stack">
        <ErrorBanner error={clinicError || error} />
        <p>
          <Link to={`/patients/${pId}`} className="btn small">
            ← Back to Patient
          </Link>
        </p>
      </div>
    );
  }

  if (!clinic || !patient || !assessment) {
    return (
      <div className="page narrow stack">
        <p className="muted">Loading Doppler report…</p>
      </div>
    );
  }

  const stageBadgeInfo = {
    stage_4: { label: 'STAGE IV: CRITICAL ACIDEMIA', bg: '#450a0a', text: '#fecaca', border: '#dc2626' },
    stage_3: { label: 'STAGE III: ADVANCED BREAKDOWN (REDV / DV)', bg: '#fee2e2', text: '#991b1b', border: '#f87171' },
    stage_2: { label: 'STAGE II: SEVERE INSUFFICIENCY (AEDV)', bg: '#ffedd5', text: '#9a3412', border: '#fb923c' },
    stage_1: { label: 'STAGE I: MILD INSUFFICIENCY / BRAIN SPARING', bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
    stage_0: { label: 'STAGE 0: NORMAL HEMODYNAMICS / AGA', bg: '#dcfce7', text: '#166534', border: '#86efac' },
  }[assessment.barcelonaStage] || { label: assessment.barcelonaStage.toUpperCase(), bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };

  return (
    <Sheet
      clinic={clinic}
      title="FETAL DOPPLER VELOCIMETRY & CPR REPORT"
      back={`/patients/${pId}`}
      onPrint={() => void handlePrint()}
    >
      {/* Subhead with scan classification */}
      <div
        style={{
          textAlign: 'center',
          borderBottom: '2px solid #0f172a',
          paddingBottom: '0.4rem',
          marginBottom: '0.8rem',
        }}
      >
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase' }}>
          Hemodynamic Doppler Velocimetry &amp; Fetal Growth Restriction Staging
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
          Protocols compliant with ISUOG Practice Guidelines &amp; FIGO 2020 Consensus Criteria
        </div>
      </div>

      {/* Patient & Pregnancy Demographics */}
      <section className="sheet-block" style={{ marginBottom: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <tbody>
            <tr>
              <td style={{ padding: '3px 6px', width: '25%', color: '#64748b' }}>Patient Name:</td>
              <td style={{ padding: '3px 6px', width: '25%', fontWeight: 700 }}>{patient.fullName}</td>
              <td style={{ padding: '3px 6px', width: '25%', color: '#64748b' }}>Patient MRN:</td>
              <td style={{ padding: '3px 6px', width: '25%', fontWeight: 700 }}>{patient.patientNumber}</td>
            </tr>
            <tr>
              <td style={{ padding: '3px 6px', color: '#64748b' }}>Gestational Age:</td>
              <td style={{ padding: '3px 6px', fontWeight: 600 }}>
                {assessment.gestationalAgeWeeks} weeks {assessment.gestationalAgeDays || 0} days
              </td>
              <td style={{ padding: '3px 6px', color: '#64748b' }}>Assessment Date:</td>
              <td style={{ padding: '3px 6px', fontWeight: 600 }}>
                {assessment.assessmentDate} {assessment.assessmentTime ? `(${assessment.assessmentTime})` : ''}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '3px 6px', color: '#64748b' }}>Estimated Fetal Weight:</td>
              <td style={{ padding: '3px 6px' }}>
                {assessment.estimatedFetalWeightG ? `${assessment.estimatedFetalWeightG} g` : '—'}{' '}
                {assessment.efwPercentile ? `(${assessment.efwPercentile}th centile)` : ''}
              </td>
              <td style={{ padding: '3px 6px', color: '#64748b' }}>FIGO FGR Category:</td>
              <td style={{ padding: '3px 6px', fontWeight: 600, textTransform: 'uppercase' }}>
                {assessment.fgrClassification.replace(/_/g, ' ')}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '3px 6px', color: '#64748b' }}>Sonologist / Examiner:</td>
              <td style={{ padding: '3px 6px' }}>{assessment.performedBy || clinic.doctorName || 'Attending Physician'}</td>
              <td style={{ padding: '3px 6px', color: '#64748b' }}>Reviewed By:</td>
              <td style={{ padding: '3px 6px' }}>{assessment.reviewedByName || clinic.doctorName || 'Doctor'}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Primary Doppler Velocimetry Findings */}
      <section className="sheet-block" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem 0', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
          Doppler Velocimetry Indices &amp; Reference Centiles
        </h3>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
              <th style={{ textAlign: 'left', padding: '6px' }}>Vessel / Parameter</th>
              <th style={{ textAlign: 'center', padding: '6px' }}>Measured Index</th>
              <th style={{ textAlign: 'center', padding: '6px' }}>Centile (%)</th>
              <th style={{ textAlign: 'center', padding: '6px' }}>Reference Range (5th–95th)</th>
              <th style={{ textAlign: 'left', padding: '6px' }}>Hemodynamic Assessment</th>
            </tr>
          </thead>
          <tbody>
            {/* Umbilical Artery */}
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px', fontWeight: 700 }}>Umbilical Artery (UA) PI</td>
              <td
                style={{
                  padding: '6px',
                  textAlign: 'center',
                  fontWeight: 700,
                  color: assessment.uaPiStatus === 'elevated_above_95th' ? '#dc2626' : 'inherit',
                }}
              >
                {assessment.uaPi}
              </td>
              <td style={{ padding: '6px', textAlign: 'center', fontWeight: 600 }}>{assessment.uaPiCentile}th</td>
              <td style={{ padding: '6px', textAlign: 'center', color: '#64748b' }}>&lt; 95th centile</td>
              <td style={{ padding: '6px' }}>
                <span style={{ fontWeight: 600, color: assessment.uaPiStatus === 'elevated_above_95th' ? '#dc2626' : '#166534' }}>
                  {assessment.uaEndDiastolicFlow === 'redf_reversed'
                    ? 'REVERSED End-Diastolic Flow (REDV)'
                    : assessment.uaEndDiastolicFlow === 'aedf_absent'
                    ? 'ABSENT End-Diastolic Flow (AEDV)'
                    : assessment.uaPiStatus === 'elevated_above_95th'
                    ? 'High Resistance (>95th percentile)'
                    : 'Normal Low Resistance Flow'}
                </span>
                {assessment.uaRi ? ` · RI ${assessment.uaRi}` : ''}
                {assessment.uaSdRatio ? ` · S/D ${assessment.uaSdRatio}` : ''}
              </td>
            </tr>

            {/* Middle Cerebral Artery */}
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px', fontWeight: 700 }}>Middle Cerebral Artery (MCA) PI</td>
              <td
                style={{
                  padding: '6px',
                  textAlign: 'center',
                  fontWeight: 700,
                  color: assessment.mcaBrainSparing !== 'none' ? '#dc2626' : 'inherit',
                }}
              >
                {assessment.mcaPi}
              </td>
              <td style={{ padding: '6px', textAlign: 'center', fontWeight: 600 }}>{assessment.mcaPiCentile}th</td>
              <td style={{ padding: '6px', textAlign: 'center', color: '#64748b' }}>&gt; 5th centile</td>
              <td style={{ padding: '6px' }}>
                <span style={{ fontWeight: 600, color: assessment.mcaBrainSparing !== 'none' ? '#dc2626' : '#166534' }}>
                  {assessment.mcaBrainSparing === 'vasodilation_below_5th'
                    ? 'Cerebral Vasodilation (<5th centile)'
                    : 'Normal Cerebral Impedance'}
                </span>
                {assessment.mcaPsvCmS ? ` · PSV ${assessment.mcaPsvCmS} cm/s` : ''}
                {assessment.mcaPsvMom ? ` (${assessment.mcaPsvMom} MoM)` : ''}
              </td>
            </tr>

            {/* Cerebroplacental Ratio */}
            <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#faf5ff' }}>
              <td style={{ padding: '6px', fontWeight: 800, color: '#6b21a8' }}>
                Cerebroplacental Ratio (CPR)
              </td>
              <td
                style={{
                  padding: '6px',
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  color: assessment.cprStatus === 'brain_sparing_redistribution' ? '#dc2626' : '#166534',
                }}
              >
                {assessment.cprRatio}
              </td>
              <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700 }}>{assessment.cprCentile}th</td>
              <td style={{ padding: '6px', textAlign: 'center', color: '#64748b' }}>&ge; 5th centile (&ge; 1.05)</td>
              <td style={{ padding: '6px' }}>
                <span
                  style={{
                    backgroundColor: assessment.cprStatus === 'brain_sparing_redistribution' ? '#fee2e2' : '#dcfce7',
                    color: assessment.cprStatus === 'brain_sparing_redistribution' ? '#991b1b' : '#166534',
                    border: `1px solid ${assessment.cprStatus === 'brain_sparing_redistribution' ? '#fca5a5' : '#86efac'}`,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                  }}
                >
                  {assessment.cprStatus === 'brain_sparing_redistribution'
                    ? 'BRAIN-SPARING REDISTRIBUTION'
                    : 'REASSURING FETAL PERFUSION'}
                </span>
              </td>
            </tr>

            {/* Uterine Artery */}
            {assessment.utaMeanPi != null && (
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>Uterine Artery (UtA) Mean PI</td>
                <td style={{ padding: '6px', textAlign: 'center', fontWeight: 600 }}>{assessment.utaMeanPi}</td>
                <td style={{ padding: '6px', textAlign: 'center' }}>{assessment.utaMeanPiCentile ?? '—'}th</td>
                <td style={{ padding: '6px', textAlign: 'center', color: '#64748b' }}>&lt; 95th centile</td>
                <td style={{ padding: '6px' }}>
                  Notching: <strong>{assessment.utaNotching.toUpperCase()}</strong>
                  {assessment.utaNotching === 'bilateral' ? ' (Defective trophoblastic invasion)' : ''}
                </td>
              </tr>
            )}

            {/* Ductus Venosus */}
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px', fontWeight: 600 }}>Ductus Venosus (DV)</td>
              <td style={{ padding: '6px', textAlign: 'center', fontWeight: 600 }}>
                {assessment.dvPiv ? `PIV ${assessment.dvPiv}` : '—'}
              </td>
              <td style={{ padding: '6px', textAlign: 'center' }}>{assessment.dvPivCentile ?? '—'}th</td>
              <td style={{ padding: '6px', textAlign: 'center', color: '#64748b' }}>Positive A-wave</td>
              <td style={{ padding: '6px' }}>
                <span style={{ fontWeight: 700, color: assessment.dvAWave === 'reversed' ? '#dc2626' : '#166534' }}>
                  A-Wave: {assessment.dvAWave.toUpperCase()}
                  {assessment.dvAWave === 'reversed' ? ' (Imminent Cardiac Decompensation)' : ''}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Clinical Staging & Delivery Action Protocol */}
      <section className="sheet-block" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem 0', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
          Barcelona FGR Staging &amp; Clinical Management Plan
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.6rem' }}>
          <span
            style={{
              backgroundColor: stageBadgeInfo.bg,
              color: stageBadgeInfo.text,
              border: `1px solid ${stageBadgeInfo.border}`,
              padding: '4px 10px',
              borderRadius: '6px',
              fontWeight: 800,
              fontSize: '0.85rem',
            }}
          >
            {stageBadgeInfo.label}
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <tbody>
            <tr>
              <td style={{ padding: '6px 8px', width: '30%', fontWeight: 700, color: '#334155' }}>
                Delivery Timing Plan:
              </td>
              <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>
                {assessment.deliveryTimingRecommendation}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', fontWeight: 600, color: '#334155' }}>Surveillance Interval:</td>
              <td style={{ padding: '6px 8px' }}>{assessment.monitoringFrequencyRecommendation}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', fontWeight: 600, color: '#334155' }}>Inpatient Medical Directives:</td>
              <td style={{ padding: '6px 8px' }}>
                {assessment.steroidsIndicated ? '💉 Antenatal Corticosteroids (Betamethasone 12mg IM 24h apart) indicated. ' : ''}
                {assessment.mgso4NeuroprotectionIndicated ? '🛡️ Magnesium Sulfate (MgSO4) Fetal Neuroprotection protocol indicated. ' : ''}
                {!assessment.steroidsIndicated && !assessment.mgso4NeuroprotectionIndicated ? 'Routine outpatient surveillance. No immediate steroid/MgSO4 indication.' : ''}
              </td>
            </tr>
            {assessment.clinicalNotes && (
              <tr>
                <td style={{ padding: '6px 8px', fontWeight: 600, color: '#334155' }}>Clinical Remarks:</td>
                <td style={{ padding: '6px 8px' }}>{assessment.clinicalNotes}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Clinical Disclaimer */}
      <section
        style={{
          borderTop: '1px dashed #cbd5e1',
          paddingTop: '0.5rem',
          fontSize: '0.72rem',
          color: '#64748b',
          lineHeight: 1.35,
          marginBottom: '1rem',
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>CLINICAL INTERPRETATION NOTE:</strong> Fetal Doppler velocimetry assesses placental and cerebral hemodynamics to identify fetal hypoxia and guide delivery timing. Brain-sparing redistribution (CPR &lt; 1.05 or &lt; 5th percentile) indicates selective cerebral vasodilation in response to chronic placental insufficiency and carries an increased risk of emergency intrapartum Cesarean delivery for non-reassuring fetal status. In accordance with the PC-PNDT Act, fetal sex determination is strictly prohibited and neither assessed nor recorded.
        </p>
      </section>

      {/* Official Signature Block */}
      <SignatureBlock
        clinic={clinic}
        signatoryName={assessment.reviewedByName || clinic.doctorName}
        designation="Consultant Obstetrician &amp; Fetal Medicine Specialist"
        subtext="Certified Fetal Doppler &amp; Hemodynamics Assessment"
        date={assessment.assessmentDate}
      />
    </Sheet>
  );
}
