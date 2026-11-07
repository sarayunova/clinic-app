import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Patient, type PreeclampsiaScreeningRecord } from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';

export function PreeclampsiaScreeningPrint() {
  const { patientId, id } = useParams();
  const screeningId = Number(id);
  const pId = Number(patientId);

  const { clinic, error: clinicError } = useClinic();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [screening, setScreening] = useState<PreeclampsiaScreeningRecord | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    if (!screeningId || !pId) return;

    Promise.all([
      api<{ patient: Patient }>('GET', `/api/patients/${pId}`),
      api<PreeclampsiaScreeningRecord>('GET', `/api/preeclampsia/${screeningId}`),
    ])
      .then(([pRes, sRes]) => {
        setPatient(pRes.patient);
        setScreening(sRes);
      })
      .catch(setError);
  }, [pId, screeningId]);

  const handlePrint = async () => {
    try {
      await api('POST', `/api/preeclampsia/${screeningId}/audit-print`);
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

  if (!clinic || !patient || !screening) {
    return (
      <div className="page narrow stack">
        <p className="muted">Loading pre-eclampsia screening report…</p>
      </div>
    );
  }

  const isHighRisk = screening.overallRiskTier === 'high_risk';

  return (
    <Sheet
      clinic={clinic}
      title="FIRST-TRIMESTER PRE-ECLAMPSIA SCREENING & PROPHYLAXIS REPORT"
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
          Combined 11–13⁺⁶ Weeks Screening (FMF Algorithm &amp; ASPRE Prophylaxis Trial)
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
          Maternal History • Mean Arterial Pressure (MAP) • Mean Uterine Artery PI • Placental Growth Factor (PlGF)
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
              <td style={{ padding: '4px', color: '#64748b' }}>Age / Ethnicity:</td>
              <td style={{ padding: '4px' }}>
                {screening.maternalAge} yrs • {screening.ethnicity.replace('_', ' ').toUpperCase()}
              </td>
              <td style={{ padding: '4px', color: '#64748b' }}>Assessment Date:</td>
              <td style={{ padding: '4px', fontWeight: 700 }}>{screening.assessmentDate} {screening.assessmentTime || ''}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px', color: '#64748b' }}>Gestational Age:</td>
              <td style={{ padding: '4px', fontWeight: 700 }}>
                {screening.gestationalAgeWeeks} Weeks {screening.gestationalAgeDays} Days
              </td>
              <td style={{ padding: '4px', color: '#64748b' }}>CRL / Parity:</td>
              <td style={{ padding: '4px' }}>
                {screening.crlMm ? `${screening.crlMm} mm` : '—'} • {screening.parity.replace(/_/g, ' ')}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '4px', color: '#64748b' }}>Maternal BMI:</td>
              <td style={{ padding: '4px' }}>
                {screening.bmi.toFixed(1)} kg/m² ({screening.maternalWeightKg || '—'} kg / {screening.maternalHeightCm || '—'} cm)
              </td>
              <td style={{ padding: '4px', color: '#64748b' }}>Conception:</td>
              <td style={{ padding: '4px' }}>{screening.conceptionMethod.replace('_', ' ').toUpperCase()}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* RISK STRATIFICATION BADGE */}
      <div
        style={{
          border: isHighRisk ? '2px solid #dc2626' : '2px solid #16a34a',
          backgroundColor: isHighRisk ? '#fef2f2' : '#f0fdf4',
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
            Combined Screening Result (&lt;37 Weeks Pre-eclampsia)
          </div>
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: isHighRisk ? '#991b1b' : '#166534',
              marginTop: '2px',
            }}
          >
            {isHighRisk ? '🚨 HIGH RISK (Aspirin 150 mg Prophylaxis Indicated)' : '✅ LOW RISK (&lt; 1:100)'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Calculated FMF Preterm PE Risk:</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: isHighRisk ? '#b91c1c' : '#15803d' }}>
            {screening.fmfRiskRatio}
          </div>
        </div>
      </div>

      {/* BIOPHYSICAL & BIOCHEMICAL MARKERS TABLE */}
      <section className="sheet-block" style={{ marginBottom: '1rem' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px' }}>
          Biophysical &amp; Biochemical Parameters
        </h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
              <th style={{ padding: '6px', textAlign: 'left' }}>Parameter</th>
              <th style={{ padding: '6px', textAlign: 'center' }}>Measured Value</th>
              <th style={{ padding: '6px', textAlign: 'center' }}>MoM</th>
              <th style={{ padding: '6px', textAlign: 'left' }}>Reference Range / Clinical Significance</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px', fontWeight: 600 }}>Mean Arterial Pressure (MAP)</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>
                {screening.meanArterialPressure.toFixed(1)} mmHg
              </td>
              <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700 }}>
                {screening.mapMom.toFixed(2)} MoM
              </td>
              <td style={{ padding: '6px', color: '#475569' }}>
                Dual-arm protocol. Normal MoM ~1.00 (Elevated if &gt; 1.05 MoM or &gt; 90 mmHg)
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px', fontWeight: 600 }}>Mean Uterine Artery PI (UtA PI)</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>
                {screening.utaPiMean.toFixed(2)}
                {screening.utaBilateralNotching ? ' (Bilat Notch)' : ''}
              </td>
              <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700 }}>
                {screening.utaPiMom.toFixed(2)} MoM
              </td>
              <td style={{ padding: '6px', color: '#475569' }}>
                Expected median ~1.63 at 12w. High resistance indicates impaired trophoblastic invasion.
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px', fontWeight: 600 }}>Serum Placental Growth Factor (PlGF)</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>
                {screening.serumPlgfPgMl ? `${screening.serumPlgfPgMl} pg/mL` : '—'}
              </td>
              <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700 }}>
                {screening.plgfMom ? `${screening.plgfMom.toFixed(2)} MoM` : '—'}
              </td>
              <td style={{ padding: '6px', color: '#475569' }}>
                {screening.plgfMom && screening.plgfMom < 0.6 ? 'Markedly reduced (< 0.6 MoM), indicates placental ischemia' : 'Pro-angiogenic trophoblast marker'}
              </td>
            </tr>
            {screening.pappaMom && (
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>Serum PAPP-A</td>
                <td style={{ padding: '6px', textAlign: 'center' }}>{screening.serumPappaIuL ?? '—'}</td>
                <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700 }}>{screening.pappaMom.toFixed(2)} MoM</td>
                <td style={{ padding: '6px', color: '#475569' }}>Syncytiotrophoblast glycoprotein</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* CLINICAL MANAGEMENT & ASPIRIN PROPHYLAXIS PLAN */}
      <section className="sheet-block" style={{ marginBottom: '1.2rem', padding: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#fafafa' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
          Aspirin Prophylaxis &amp; Maternal Surveillance Directives
        </h4>
        <div style={{ fontSize: '0.85rem', lineHeight: '1.5', color: '#334155' }}>
          {screening.aspirinIndicated ? (
            <>
              <p style={{ fontWeight: 700, color: '#991b1b', marginBottom: '4px' }}>
                💊 ASPIRIN PRESCRIPTION: Acetylsalicylic acid {screening.aspirinDoseMg} mg PO once daily at bedtime.
              </p>
              <p style={{ marginBottom: '4px' }}>
                • <b>Initiation Window:</b> Start immediately (strictly before 16⁺⁰ weeks). Continue daily until 36⁺⁰ weeks or delivery.
              </p>
              <p style={{ marginBottom: '4px' }}>
                • <b>Calcium Supplementation:</b> {screening.calciumDoseMg} mg/day elemental calcium divided with meals (separate from iron by &gt; 2 hours).
              </p>
              <p style={{ marginBottom: '4px' }}>
                • <b>Blood Pressure &amp; Urinalysis Surveillance:</b> {screening.surveillanceInterval}
              </p>
              <p style={{ marginBottom: '4px' }}>
                • <b>Ultrasound Follow-up:</b> {screening.repeatScanWeeks}
              </p>
            </>
          ) : (
            <p style={{ color: '#166534', fontWeight: 600 }}>
              Low-risk screening result. Standard antenatal care schedule with routine blood pressure monitoring and standard nutritional counseling.
            </p>
          )}

          {screening.clinicalNotes && (
            <p style={{ marginTop: '6px', fontStyle: 'italic', color: '#475569' }}>
              Clinical Notes: {screening.clinicalNotes}
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
        signatoryName={screening.reviewedByName || clinic.doctorName}
        designation="Consultant Obstetrician &amp; Fetal Medicine Specialist"
        subtext="Certified First-Trimester Pre-eclampsia Screening"
        date={screening.assessmentDate}
      />
    </Sheet>
  );
}
