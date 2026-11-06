import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type AntenatalRiskAssessment } from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';
import {
  PE_FACTORS,
  VTE_FACTORS,
  GDM_FACTORS,
  PTB_FACTORS,
} from '../antenatalRiskScoring';

export function RiskAssessmentPrint() {
  const { id } = useParams();
  const assessmentId = Number(id);
  const { clinic, error: clinicError } = useClinic();

  const [assessment, setAssessment] = useState<AntenatalRiskAssessment | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!assessmentId) return;
    api<AntenatalRiskAssessment>('GET', `/api/risk-assessments/${assessmentId}`)
      .then(setAssessment)
      .catch(setError);
  }, [assessmentId]);

  if (clinicError || error) {
    return (
      <div className="page narrow stack">
        <ErrorBanner error={clinicError || error} />
        <p>
          <Link to="/patients" className="btn small">
            ← Back to Patients
          </Link>
        </p>
      </div>
    );
  }

  if (!clinic || !assessment) {
    return (
      <div className="page narrow stack">
        <p className="muted">Loading risk assessment protocol…</p>
      </div>
    );
  }

  const peLabelMap = Object.fromEntries(PE_FACTORS.map((f) => [f.key, f.label]));
  const vteLabelMap = Object.fromEntries(VTE_FACTORS.map((f) => [f.key, `${f.label} (+${f.points})`]));
  const gdmLabelMap = Object.fromEntries(GDM_FACTORS.map((f) => [f.key, f.label]));
  const ptbLabelMap = Object.fromEntries(PTB_FACTORS.map((f) => [f.key, f.label]));

  const isHighRisk = assessment.overallRiskLevel === 'high_risk';
  const isModerateRisk = assessment.overallRiskLevel === 'moderate_risk';

  return (
    <Sheet
      clinic={clinic}
      title="Antenatal High-Risk Assessment & Prophylaxis Protocol"
      back={`/patients/${assessment.patientId}`}
      onPrint={() => window.print()}
    >
      {/* Subhead with Stratification Classification */}
      <div
        style={{
          textAlign: 'center',
          borderBottom: '2px solid #0f172a',
          paddingBottom: '0.4rem',
          marginBottom: '0.8rem',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '4px 14px',
            borderRadius: '4px',
            fontWeight: 700,
            fontSize: '1rem',
            letterSpacing: '0.5px',
            backgroundColor: isHighRisk ? '#fee2e2' : isModerateRisk ? '#fef3c7' : '#dcfce7',
            color: isHighRisk ? '#991b1b' : isModerateRisk ? '#92400e' : '#166534',
            border: `1.5px solid ${isHighRisk ? '#b91c1c' : isModerateRisk ? '#d97706' : '#15803d'}`,
          }}
        >
          {isHighRisk
            ? '⚠️ HIGH-RISK PREGNANCY PROTOCOL'
            : isModerateRisk
            ? '⚡ MODERATE-RISK PREGNANCY PROTOCOL'
            : '✅ LOW-RISK PREGNANCY (Standard Antenatal Pathway)'}
        </div>
      </div>

      {/* Patient & Assessment Details Grid */}
      <section className="sheet-block">
        <dl
          className="grid-meta"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '0.4rem 1rem',
            margin: 0,
            fontSize: '0.85rem',
            lineHeight: 1.35,
          }}
        >
          <div>
            <dt className="muted small">Patient Name</dt>
            <dd><strong>{assessment.patientName}</strong></dd>
          </div>
          <div>
            <dt className="muted small">Patient ID / MRN</dt>
            <dd>{assessment.patientNumber || `P-${assessment.patientId}`}</dd>
          </div>
          <div>
            <dt className="muted small">Obstetric GPAL</dt>
            <dd>
              G{assessment.gravida ?? '—'} P{assessment.para ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="muted small">LMP Date</dt>
            <dd>{assessment.lastMenstrualPeriod || 'Not recorded'}</dd>
          </div>
          <div>
            <dt className="muted small">Assessment Date</dt>
            <dd><strong>{assessment.assessmentDate}</strong></dd>
          </div>
          <div>
            <dt className="muted small">Gestational Age</dt>
            <dd>
              {assessment.gestationalAgeWeeks != null
                ? `${assessment.gestationalAgeWeeks}w ${assessment.gestationalAgeDays ?? 0}d`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="muted small">Evaluating Clinician</dt>
            <dd>{assessment.assessedByName || 'Staff Obstetrician'}</dd>
          </div>
          {assessment.nextReviewDate && (
            <div>
              <dt className="muted small">Next Review Date</dt>
              <dd><strong>{assessment.nextReviewDate}</strong></dd>
            </div>
          )}
        </dl>
      </section>

      {/* Primary High-Risk Rationale */}
      {assessment.highRiskReasons && (
        <section
          className="sheet-block"
          style={{
            background: isHighRisk ? '#fff5f5' : '#f8fafc',
            border: `1.5px solid ${isHighRisk ? '#fca5a5' : '#cbd5e1'}`,
            borderRadius: '4px',
            padding: '0.5rem 0.8rem',
            marginTop: '0.6rem',
            fontSize: '0.85rem',
          }}
        >
          <strong style={{ color: isHighRisk ? '#991b1b' : '#334155' }}>
            Primary High-Risk Factors &amp; Clinical Rationale:
          </strong>
          <div style={{ marginTop: '0.2rem', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
            {assessment.highRiskReasons}
          </div>
        </section>
      )}

      {/* 4-Domain Clinical Stratification Grid */}
      <section
        className="sheet-block"
        style={{
          marginTop: '0.8rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.8rem',
        }}
      >
        {/* 1. Pre-eclampsia Stratification */}
        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            padding: '0.6rem 0.8rem',
            background: '#ffffff',
          }}
        >
          <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>
              1. Pre-eclampsia (NICE / ACOG)
            </strong>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '3px',
                backgroundColor: assessment.peRiskLevel === 'high' ? '#fee2e2' : assessment.peRiskLevel === 'moderate' ? '#fef3c7' : '#f1f5f9',
                color: assessment.peRiskLevel === 'high' ? '#991b1b' : assessment.peRiskLevel === 'moderate' ? '#92400e' : '#475569',
              }}
            >
              {assessment.peRiskLevel.toUpperCase()} RISK
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
            <div style={{ marginBottom: '0.3rem' }}>
              <span className="muted">Factors: </span>
              {assessment.peFactors.length > 0 ? (
                <span>{assessment.peFactors.map((k) => peLabelMap[k] || k).join('; ')}</span>
              ) : (
                <span className="muted">None identified</span>
              )}
            </div>

            <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '0.3rem', marginTop: '0.3rem' }}>
              <div>
                <strong>Aspirin Prophylaxis: </strong>
                {assessment.peAspirinIndicated ? (
                  <span style={{ color: '#0284c7', fontWeight: 600 }}>
                    Indicated {assessment.peAspirinPrescribed ? '✅ Prescribed' : '⚠️ Pending Rx'}
                  </span>
                ) : (
                  <span>Not strictly indicated</span>
                )}
              </div>
              {assessment.peAspirinDosage && (
                <div className="muted small" style={{ marginTop: '2px' }}>
                  Dosage: {assessment.peAspirinDosage}
                </div>
              )}
              {assessment.peCalciumIndicated && (
                <div style={{ marginTop: '2px' }}>
                  <strong>Calcium: </strong>
                  {assessment.peCalciumPrescribed ? '✅ Prescribed (1.0–1.5g daily)' : 'Recommended'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. VTE Thromboprophylaxis (RCOG) */}
        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            padding: '0.6rem 0.8rem',
            background: '#ffffff',
          }}
        >
          <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>
              2. VTE Risk (RCOG Green-top 37a)
            </strong>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '3px',
                backgroundColor: assessment.vteScore >= 3 ? '#fee2e2' : assessment.vteScore === 2 ? '#fef3c7' : '#f1f5f9',
                color: assessment.vteScore >= 3 ? '#991b1b' : assessment.vteScore === 2 ? '#92400e' : '#475569',
              }}
            >
              SCORE: {assessment.vteScore} ({assessment.vteRiskLevel.toUpperCase()})
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
            <div style={{ marginBottom: '0.3rem' }}>
              <span className="muted">Factors: </span>
              {assessment.vteFactors.length > 0 ? (
                <span>{assessment.vteFactors.map((k) => vteLabelMap[k] || k).join('; ')}</span>
              ) : (
                <span className="muted">None identified</span>
              )}
            </div>

            <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '0.3rem', marginTop: '0.3rem' }}>
              <div>
                <strong>LMWH Prophylaxis: </strong>
                {assessment.vteProphylaxisRecommended || (assessment.vteScore >= 3 ? 'Indicated' : 'Mobilization only')}
              </div>
              {assessment.vteLmwhPrescribed && (
                <div style={{ color: '#16a34a', fontWeight: 600, marginTop: '2px' }}>
                  ✅ LMWH Prescribed: {assessment.vteLmwhDosage || 'Enoxaparin 40mg SC daily'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. GDM Screening & Tracking */}
        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            padding: '0.6rem 0.8rem',
            background: '#ffffff',
          }}
        >
          <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>
              3. Gestational Diabetes (DIPSI / FIGO)
            </strong>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '3px',
                backgroundColor: assessment.gdmDiagnosisStatus === 'gdm_confirmed' ? '#fee2e2' : assessment.gdmRiskLevel === 'high' ? '#fef3c7' : '#f1f5f9',
                color: assessment.gdmDiagnosisStatus === 'gdm_confirmed' ? '#991b1b' : assessment.gdmRiskLevel === 'high' ? '#92400e' : '#475569',
              }}
            >
              {assessment.gdmDiagnosisStatus === 'gdm_confirmed'
                ? 'GDM CONFIRMED'
                : `${assessment.gdmRiskLevel.toUpperCase()} RISK`}
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
            <div>
              <span className="muted">Screening Advice: </span>
              {assessment.gdmScreeningTiming || (assessment.gdmRiskLevel === 'high' ? 'Early 75g OGTT at 12–16w' : 'Standard 24–28w OGTT')}
            </div>

            {(assessment.gdmFastingMgdl != null || assessment.gdm2hrMgdl != null) && (
              <div style={{ background: '#f8fafc', padding: '3px 6px', borderRadius: '3px', marginTop: '0.3rem' }}>
                <strong>OGTT Values: </strong>
                {assessment.gdmFastingMgdl != null && <span>Fasting: <strong>{assessment.gdmFastingMgdl} mg/dL</strong> </span>}
                {assessment.gdm1hrMgdl != null && <span>1-hr: <strong>{assessment.gdm1hrMgdl} mg/dL</strong> </span>}
                {assessment.gdm2hrMgdl != null && <span>2-hr: <strong>{assessment.gdm2hrMgdl} mg/dL</strong></span>}
              </div>
            )}

            {assessment.gdmManagementPlan && (
              <div style={{ marginTop: '0.3rem' }}>
                <strong>Plan: </strong>{assessment.gdmManagementPlan}
              </div>
            )}
          </div>
        </div>

        {/* 4. Preterm Birth & Cervical Surveillance */}
        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            padding: '0.6rem 0.8rem',
            background: '#ffffff',
          }}
        >
          <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>
              4. Preterm Birth &amp; Cervical Insufficiency
            </strong>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '3px',
                backgroundColor: assessment.ptbRiskLevel === 'high' ? '#fee2e2' : '#f1f5f9',
                color: assessment.ptbRiskLevel === 'high' ? '#991b1b' : '#475569',
              }}
            >
              {assessment.ptbRiskLevel.toUpperCase()} RISK
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
            <div style={{ marginBottom: '0.3rem' }}>
              <span className="muted">Factors: </span>
              {assessment.ptbFactors.length > 0 ? (
                <span>{assessment.ptbFactors.map((k) => ptbLabelMap[k] || k).join('; ')}</span>
              ) : (
                <span className="muted">None identified</span>
              )}
            </div>

            <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '0.3rem', marginTop: '0.3rem' }}>
              <div>
                <strong>Vaginal Progesterone: </strong>
                {assessment.ptbProgesteroneIndicated ? (
                  <span style={{ color: '#0284c7', fontWeight: 600 }}>
                    Indicated {assessment.ptbProgesteronePrescribed ? '✅ Prescribed' : '⚠️ Pending Rx'}
                  </span>
                ) : (
                  <span>Routine care</span>
                )}
              </div>
              {assessment.ptbCerclageAdvised && (
                <div style={{ color: '#dc2626', fontWeight: 600, marginTop: '2px' }}>
                  ⚠️ Cervical Cerclage / Encirclage Consultation Advised
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Clinical Management Plan Box */}
      <section
        className="sheet-block"
        style={{
          marginTop: '0.9rem',
          padding: '0.65rem 0.85rem',
          background: '#f8fafc',
          border: '1.5px solid #0f172a',
          borderRadius: '4px',
        }}
      >
        <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '0.95rem', color: '#0f172a' }}>
          CLINICAL ACTION PLAN &amp; MONITORING ORDERS
        </h3>
        <div style={{ fontSize: '0.88rem', lineHeight: 1.45, fontWeight: 500, whiteSpace: 'pre-wrap' }}>
          {assessment.clinicalActionPlan || 'Standard antenatal care and surveillance protocol.'}
        </div>

        {assessment.consultantNotes && (
          <div style={{ marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px dashed #cbd5e1' }}>
            <strong style={{ fontSize: '0.82rem', color: '#334155' }}>Consultant / Specialist Notes:</strong>
            <div style={{ fontSize: '0.82rem', marginTop: '0.15rem' }}>{assessment.consultantNotes}</div>
          </div>
        )}
      </section>

      {/* Signature & Disclaimer Block */}
      <div
        style={{
          marginTop: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          paddingTop: '0.5rem',
        }}
      >
        <div className="muted small" style={{ maxWidth: '360px', fontSize: '0.72rem', lineHeight: 1.3 }}>
          * Risk stratification conforms to NICE NG133, ACOG Guidelines, and RCOG Green-top Guideline No. 37a. Regular clinical re-evaluation is advised.
        </div>

        <SignatureBlock
          clinic={clinic}
          signatoryName={assessment.assessedByName || clinic.doctorName}
          designation="Consultant Obstetrician &amp; Gynecologist"
          style={{ marginTop: 0 }}
        />
      </div>
    </Sheet>
  );
}
