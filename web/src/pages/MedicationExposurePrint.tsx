import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type Patient,
  type AntenatalMedicationExposure,
  type MedicationExposuresResponse,
} from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';
import { calculateGestationalAge, calculateEdd } from '../pregnancyCalc';

export function MedicationExposurePrint() {
  const { id } = useParams();
  const patientId = Number(id);
  const { clinic, error: clinicError } = useClinic();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [exposures, setExposures] = useState<AntenatalMedicationExposure[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    Promise.all([
      api<Patient>('GET', `/api/patients/${patientId}`),
      api<MedicationExposuresResponse>('GET', `/api/patients/${patientId}/medication-exposures`),
    ])
      .then(([pt, exp]) => {
        setPatient(pt);
        setExposures(exp.exposures || []);
        setError(null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [patientId]);

  if (clinicError || error) {
    return (
      <div className="page narrow stack">
        <ErrorBanner error={clinicError || error} />
        <p>
          <Link to={`/patients/${patientId}`} className="btn small">
            ← Back to Patient Record
          </Link>
        </p>
      </div>
    );
  }

  if (loading || !clinic || !patient) {
    return (
      <div className="page narrow stack">
        <p className="muted">Loading antenatal medication safety &amp; exposure record…</p>
      </div>
    );
  }

  const lmp = typeof patient.lastMenstrualPeriod === 'string' ? patient.lastMenstrualPeriod : null;
  const currentGa = calculateGestationalAge(lmp);
  const edd = calculateEdd(lmp);

  return (
    <Sheet
      clinic={clinic}
      title="ANTENATAL MEDICATION SAFETY & TERATOGENIC EXPOSURE RECORD"
      back={`/patients/${patientId}`}
    >
      <div className="stack" style={{ gap: '1rem', fontSize: '0.85rem' }}>
        {/* Patient Demographics & Obstetric Summary Grid */}
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
            <div><strong style={{ fontSize: '1rem' }}>{patient.fullName as string}</strong></div>
          </div>
          <div>
            <span className="muted small">Patient Number / ID:</span>
            <div><strong>{patient.patientNumber as string}</strong></div>
          </div>
          <div>
            <span className="muted small">Age / Contact:</span>
            <div>
              {patient.dateOfBirth ? `${patient.dateOfBirth} (${patient.gender as string})` : (patient.gender as string)}
              {patient.phone ? ` · ${patient.phone}` : ''}
            </div>
          </div>
          <div>
            <span className="muted small">Blood Group:</span>
            <div><strong>{(patient.bloodGroup as string) || 'Not recorded'}</strong></div>
          </div>

          <div>
            <span className="muted small">Obstetric History:</span>
            <div>
              <strong>
                G{patient.gravida != null ? patient.gravida : 1} P{patient.para != null ? patient.para : 0} A{patient.abortions != null ? patient.abortions : 0} L{patient.living != null ? patient.living : 0}
              </strong>
            </div>
          </div>
          <div>
            <span className="muted small">Last Menstrual Period (LMP):</span>
            <div><strong>{lmp || 'Not recorded'}</strong></div>
          </div>
          <div>
            <span className="muted small">Estimated Due Date (EDD):</span>
            <div><strong style={{ color: '#0369a1' }}>{edd || '—'}</strong></div>
          </div>
          <div>
            <span className="muted small">Current Gestational Age:</span>
            <div><strong style={{ color: '#15803d' }}>{currentGa ? currentGa.formatted : '—'}</strong></div>
          </div>
        </div>

        {/* Clinical Overview / Alert Notice */}
        <div style={{ background: '#fff7ed', border: '1px solid #f97316', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
          <strong style={{ color: '#c2410c' }}>Clinical Context &amp; Purpose of this Record:</strong>
          <div style={{ marginTop: '0.2rem', color: '#7c2d12', fontSize: '0.8rem', lineHeight: '1.4' }}>
            This document certifies maternal medication history and evaluates teratogenic exposure risks during pregnancy.
            Baseline background risk of major congenital malformations in any pregnancy is 2–3%. Exposure during embryonic
            organogenesis (weeks 3–10 post-LMP) carries heightened vulnerability requiring targeted fetal anatomy surveillance.
          </div>
        </div>

        {/* Exposure Registry Table */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ background: '#0f172a', color: '#ffffff', padding: '0.4rem 0.75rem', fontWeight: 'bold', fontSize: '0.88rem' }}>
            🛡️ DOCUMENTED MATERNAL DRUG EXPOSURES &amp; TERATOGENIC RISK ASSESSMENT
          </div>

          {exposures.length === 0 ? (
            <div style={{ padding: '1.2rem', textAlign: 'center', color: '#64748b', background: '#ffffff' }}>
              No maternal teratogenic or high-risk drug exposures documented for this pregnancy.
            </div>
          ) : (
            <div className="stack" style={{ gap: '0', background: '#ffffff' }}>
              {exposures.map((exp, idx) => (
                <div
                  key={exp.id}
                  style={{
                    padding: '0.85rem',
                    borderBottom: idx === exposures.length - 1 ? 'none' : '1px solid #e2e8f0',
                  }}
                >
                  <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <div className="row wrap" style={{ gap: '0.4rem', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{exp.medicineName}</strong>
                      {exp.genericName && <span className="muted small">({exp.genericName})</span>}
                      <span className="badge" style={{ fontWeight: 'bold' }}>FDA Cat: {exp.fdaCategory}</span>
                      <span
                        style={{
                          fontWeight: 'bold',
                          color: exp.riskLevel === 'contraindicated' ? '#dc2626' : exp.riskLevel === 'high_risk' ? '#ea580c' : '#ca8a04',
                          textTransform: 'uppercase',
                        }}
                      >
                        [{exp.riskLevel}]
                      </span>
                    </div>
                    <span className="muted small">
                      Exposure Timing: <strong>{exp.trimesterExposure.replace('_', ' ').toUpperCase()}</strong>{' '}
                      {exp.gestationalAgeWeeks != null ? `(${exp.gestationalAgeWeeks}w ${exp.gestationalAgeDays || 0}d)` : ''}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                    <div>
                      <span className="muted small">Dose &amp; Duration:</span>
                      <div>{exp.exposureDose || 'Not specified'} {exp.exposureStartDate ? ` (${exp.exposureStartDate} to ${exp.exposureEndDate || 'ongoing'})` : ''}</div>
                    </div>
                    <div>
                      <span className="muted small">Targeted Surveillance Schedule:</span>
                      <div className="row wrap" style={{ gap: '0.3rem', marginTop: '0.1rem' }}>
                        {exp.anomalyScanIndicated && <strong>• Level II Targeted Anatomy Scan (18–20w)</strong>}
                        {exp.fetalEchoIndicated && <strong>• Targeted Fetal Echocardiography (20–22w)</strong>}
                        {!exp.anomalyScanIndicated && !exp.fetalEchoIndicated && <span>Routine Sonography</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '0.5rem 0.7rem', borderRadius: '4px', fontSize: '0.8rem', lineHeight: '1.35' }}>
                    <div style={{ marginBottom: '0.2rem' }}>
                      <strong>Documented Fetal Risks:</strong> {exp.fetalRiskSummary}
                    </div>
                    {exp.counselingNotes && (
                      <div style={{ marginBottom: '0.2rem' }}>
                        <strong>Parental Counseling:</strong> {exp.counselingNotes}
                      </div>
                    )}
                    {exp.actionPlan && (
                      <div style={{ color: '#0369a1', fontWeight: '500' }}>
                        <strong>Action Plan:</strong> {exp.actionPlan}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Key Pharmacotherapy Principles in Obstetrics */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.6rem 0.8rem', background: '#f8fafc' }}>
          <strong style={{ fontSize: '0.85rem', color: '#0f172a', display: 'block', marginBottom: '0.3rem' }}>
            📋 Standard Obstetric Pharmacotherapy Principles
          </strong>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
            <li><strong>Analgesia:</strong> Paracetamol is the first-line antipyretic/analgesic throughout pregnancy. NSAIDs are strictly contraindicated in the 3rd trimester (≥28w) to avoid premature ductus arteriosus closure.</li>
            <li><strong>Hypertension:</strong> ACE inhibitors and ARBs are contraindicated due to severe renal dysgenesis. Labetalol, Methyldopa, and Nifedipine are first-line.</li>
            <li><strong>Antibiotics:</strong> Beta-lactams (Amoxicillin, Cefuroxime) and Azithromycin are safe in all trimesters. Tetracyclines and Fluoroquinolones should be avoided.</li>
            <li><strong>Anticoagulation:</strong> Low Molecular Weight Heparin (Enoxaparin) is the gold standard because it does not cross the placental barrier. Warfarin is contraindicated.</li>
          </ul>
        </div>

        {/* Consultant Signature Block */}
        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
          <SignatureBlock
            clinic={clinic}
            designation="Consultant Obstetrician &amp; Gynecologist"
            subtext="Certified Teratogenic Risk Counseling &amp; Fetal Surveillance Record"
          />
        </div>
      </div>
    </Sheet>
  );
}
