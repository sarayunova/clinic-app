import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type Patient,
  type MultipleGestationAssessment,
  type MultipleGestationPregnancy,
} from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';

export function MultipleGestationPrint() {
  const { patientId, id } = useParams();
  const assessId = Number(id);
  const pId = Number(patientId);

  const { clinic, error: clinicError } = useClinic();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [assessment, setAssessment] = useState<MultipleGestationAssessment | null>(null);
  const [pregnancy, setPregnancy] = useState<MultipleGestationPregnancy | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    if (!assessId || !pId) return;

    Promise.all([
      api<{ patient: Patient }>('GET', `/api/patients/${pId}`),
      api<MultipleGestationAssessment>('GET', `/api/multiple-gestation/assessments/${assessId}`),
      api<MultipleGestationPregnancy[]>('GET', `/api/patients/${pId}/multiple-gestation/pregnancies`),
    ])
      .then(([pRes, aRes, pregList]) => {
        setPatient(pRes.patient);
        setAssessment(aRes);
        const match = pregList.find((p) => p.id === aRes.pregnancyId) || pregList[0] || null;
        setPregnancy(match);
      })
      .catch(setError);
  }, [pId, assessId]);

  const handlePrint = async () => {
    try {
      await api('POST', `/api/multiple-gestation/assessments/${assessId}/audit-print`);
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
        <p className="muted">Loading multiple gestation surveillance report…</p>
      </div>
    );
  }

  const isSignificant = assessment.efwDiscordancePercent >= 20.0;
  const hasTtts = assessment.tttsStage !== 'none';
  const hasSfgr = assessment.sfgrType !== 'none';

  return (
    <Sheet
      clinic={clinic}
      title="MULTIPLE GESTATION ULTRASOUND & SURVEILLANCE REPORT"
      back={`/patients/${pId}`}
      onPrint={() => void handlePrint()}
    >
      {/* Subhead with protocol citation */}
      <div
        style={{
          textAlign: 'center',
          borderBottom: '2px solid #0f172a',
          paddingBottom: '0.4rem',
          marginBottom: '0.8rem',
        }}
      >
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase' }}>
          Twin / Triplet Hemodynamics, Concordance &amp; Complications Surveillance
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
          ISUOG Practice Guidelines • Quintero TTTS Staging • Gratacós sFGR Classification
        </div>
      </div>

      {/* Patient & Gestational Demographics */}
      <section className="sheet-block" style={{ marginBottom: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px', color: '#64748b', width: '22%' }}>Patient Name:</td>
              <td style={{ padding: '4px', fontWeight: 700, width: '28%' }}>{patient.fullName}</td>
              <td style={{ padding: '4px', color: '#64748b', width: '22%' }}>Patient ID / MRN:</td>
              <td style={{ padding: '4px', fontWeight: 700, width: '28%' }}>{patient.patientNumber}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px', color: '#64748b' }}>Plurality / Chorionicity:</td>
              <td style={{ padding: '4px', fontWeight: 700 }}>
                {pregnancy ? `${pregnancy.plurality.toUpperCase()} • ${pregnancy.chorionicity.toUpperCase()} (${pregnancy.amnionicity})` : 'MULTIFETAL'}
              </td>
              <td style={{ padding: '4px', color: '#64748b' }}>Assessment Date:</td>
              <td style={{ padding: '4px', fontWeight: 700 }}>
                {assessment.assessmentDate} {assessment.assessmentTime || ''}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '4px', color: '#64748b' }}>Gestational Age:</td>
              <td style={{ padding: '4px', fontWeight: 700 }}>
                {assessment.gestationalAgeWeeks} Weeks {assessment.gestationalAgeDays} Days
              </td>
              <td style={{ padding: '4px', color: '#64748b' }}>Membrane / Placenta:</td>
              <td style={{ padding: '4px' }}>
                {pregnancy?.firstTrimesterSign ? pregnancy.firstTrimesterSign.replace(/_/g, ' ') : '—'} • {pregnancy?.placentalConfiguration ? pregnancy.placentalConfiguration.replace(/_/g, ' ') : 'Placenta'}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* DISCORDANCE & COMPLICATION SUMMARY BANNER */}
      <div
        style={{
          border: isSignificant || hasTtts || hasSfgr ? '2px solid #dc2626' : '2px solid #16a34a',
          backgroundColor: isSignificant || hasTtts || hasSfgr ? '#fef2f2' : '#f0fdf4',
          borderRadius: '8px',
          padding: '0.8rem',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Inter-Twin Growth Discordance &amp; Hemodynamic Staging
          </div>
          <div
            style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              color: isSignificant || hasTtts || hasSfgr ? '#991b1b' : '#166534',
              marginTop: '2px',
            }}
          >
            {hasTtts
              ? `🚨 TTTS QUINTERO ${assessment.tttsStage.toUpperCase()} DETECTED`
              : hasSfgr
              ? `⚠️ SELECTIVE FGR GRATACÓS ${assessment.sfgrType.toUpperCase()}`
              : isSignificant
              ? `⚠️ SIGNIFICANT GROWTH DISCORDANCE (${assessment.efwDiscordancePercent}%)`
              : '✅ CONCORDANT TWIN PREGNANCY (Normal Growth & Doppler)'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>EFW Discordance:</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: isSignificant ? '#b91c1c' : '#15803d' }}>
            {assessment.efwDiscordancePercent}%
          </div>
        </div>
      </div>

      {/* INDIVIDUAL FETUSES BIOMETRY & DOPPLER COMPARISON */}
      <section className="sheet-block" style={{ marginBottom: '1rem' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px' }}>
          Fetus-by-Fetus Comparative Ultrasound Evaluation
        </h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
              <th style={{ padding: '6px', textAlign: 'left' }}>Parameter</th>
              {assessment.fetuses.map((f, i) => (
                <th key={i} style={{ padding: '6px', textAlign: 'center' }}>
                  {f.label} ({f.presentation.toUpperCase()})
                </th>
              ))}
              <th style={{ padding: '6px', textAlign: 'center' }}>Discordance / Interpretation</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px', fontWeight: 600 }}>Estimated Fetal Weight (EFW)</td>
              {assessment.fetuses.map((f, i) => (
                <td key={i} style={{ padding: '6px', textAlign: 'center', fontWeight: 700 }}>
                  {f.efwG} g {f.efwPercentile ? `(${f.efwPercentile}th %)` : ''}
                </td>
              ))}
              <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700, color: isSignificant ? '#b91c1c' : '#1e293b' }}>
                Δ {assessment.efwDiscordancePercent}%
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px', fontWeight: 600 }}>Abdominal Circumference (AC)</td>
              {assessment.fetuses.map((f, i) => (
                <td key={i} style={{ padding: '6px', textAlign: 'center' }}>
                  {f.acMm ? `${f.acMm} mm` : '—'}
                </td>
              ))}
              <td style={{ padding: '6px', textAlign: 'center' }}>
                Δ {assessment.acDiscordancePercent}%
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px', fontWeight: 600 }}>Deepest Vertical Pocket (DVP)</td>
              {assessment.fetuses.map((f, i) => (
                <td key={i} style={{ padding: '6px', textAlign: 'center', fontWeight: f.dvpCm < 2.0 || f.dvpCm > 8.0 ? 700 : 400, color: f.dvpCm < 2.0 ? '#dc2626' : f.dvpCm > 8.0 ? '#7c3aed' : '#0f172a' }}>
                  {f.dvpCm} cm {f.dvpCm < 2.0 ? '(Oligohydramnios)' : f.dvpCm > 8.0 ? '(Polyhydramnios)' : ''}
                </td>
              ))}
              <td style={{ padding: '6px', textAlign: 'center' }}>
                Δ {assessment.dvpDiscordanceCm} cm
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px', fontWeight: 600 }}>Fetal Urinary Bladder</td>
              {assessment.fetuses.map((f, i) => (
                <td key={i} style={{ padding: '6px', textAlign: 'center' }}>
                  {f.bladderVisualized ? 'Visualized / Filled' : 'EMPTY / NOT VISUALIZED'}
                </td>
              ))}
              <td style={{ padding: '6px', textAlign: 'center' }}>
                {assessment.fetuses.some((f) => !f.bladderVisualized) ? 'Quintero Stage II Flag' : 'Concordant'}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px', fontWeight: 600 }}>Umbilical Artery Flow &amp; PI</td>
              {assessment.fetuses.map((f, i) => (
                <td key={i} style={{ padding: '6px', textAlign: 'center' }}>
                  {f.uaPi ? `PI ${f.uaPi} • ` : ''}{f.uaFlow.replace(/_/g, ' ')}
                </td>
              ))}
              <td style={{ padding: '6px', textAlign: 'center' }}>
                {assessment.sfgrType !== 'none' ? `sFGR ${assessment.sfgrType.toUpperCase()}` : 'Reassuring'}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px', fontWeight: 600 }}>Middle Cerebral Artery (MCA PSV)</td>
              {assessment.fetuses.map((f, i) => (
                <td key={i} style={{ padding: '6px', textAlign: 'center' }}>
                  {f.mcaPsvMom ? `${f.mcaPsvMom} MoM` : '—'}
                </td>
              ))}
              <td style={{ padding: '6px', textAlign: 'center' }}>
                {assessment.tapsStage !== 'none' ? `TAPS ${assessment.tapsStage.toUpperCase()}` : 'No TAPS'}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* CLINICAL MANAGEMENT & SURVEILLANCE DIRECTIVES */}
      <section className="sheet-block" style={{ marginBottom: '1.2rem', padding: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#fafafa' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
          Surveillance Schedule &amp; Delivery Planning Directives
        </h4>
        <div style={{ fontSize: '0.85rem', lineHeight: '1.5', color: '#334155' }}>
          <p style={{ marginBottom: '4px' }}>
            • <b>Surveillance Interval:</b> {assessment.surveillanceIntervalRecommendation}
          </p>
          <p style={{ marginBottom: '4px' }}>
            • <b>Planned Delivery Timing:</b> {assessment.deliveryTimingRecommendation}
          </p>
          <p style={{ marginBottom: '4px' }}>
            • <b>Recommended Delivery Mode:</b> {assessment.deliveryModeRecommendation}
          </p>
          {assessment.corticosteroidsIndicated && (
            <p style={{ fontWeight: 700, color: '#991b1b', marginBottom: '4px' }}>
              💉 Antenatal Corticosteroids indicated: Betamethasone 12 mg IM every 24 hours x 2 doses.
            </p>
          )}
          {assessment.actionPlan && (
            <p style={{ marginTop: '4px', fontWeight: 600, color: '#0f172a' }}>
              Action Plan: {assessment.actionPlan}
            </p>
          )}
          {assessment.clinicalNotes && (
            <p style={{ marginTop: '4px', fontStyle: 'italic', color: '#475569' }}>
              Clinical Notes: {assessment.clinicalNotes}
            </p>
          )}
        </div>
      </section>

      {/* STATUTORY PC-PNDT ACT NON-DISCLOSURE CLAUSE */}
      <div
        style={{
          border: '1px dashed #94a3b8',
          padding: '6px 10px',
          fontSize: '0.75rem',
          color: '#475569',
          textAlign: 'center',
          marginBottom: '1.5rem',
          backgroundColor: '#f8fafc',
        }}
      >
        <strong>MANDATORY PC-PNDT ACT DECLARATION:</strong> Prenatal sex determination is strictly prohibited under Indian law (Pre-Conception and Pre-Natal Diagnostic Techniques Act, 1994). No disclosure of fetal sex was made or implied.
      </div>

      {/* Signature Block */}
      <SignatureBlock
        clinic={clinic}
        signatoryName={assessment.reviewedByName || clinic.doctorName}
        designation="Consultant Obstetrician &amp; Fetal Medicine Specialist"
        subtext="Certified Multiple Gestation Ultrasound &amp; Discordance Surveillance"
        date={assessment.assessmentDate}
      />
    </Sheet>
  );
}
