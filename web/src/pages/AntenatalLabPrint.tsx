import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type Patient,
  type AntenatalLabTrend,
  type AntenatalLabTrendsResponse,
  type AntenatalSerologyMatrix,
  type AntenatalSerologyResponse,
} from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';
import { calculateGestationalAge, calculateEdd } from '../pregnancyCalc';
import { classifyAnemia, classifyThrombocytopenia, evaluateAntenatalReminders } from '../antenatalLabScoring';

export function AntenatalLabPrint() {
  const { id } = useParams();
  const patientId = Number(id);
  const { clinic, error: clinicError } = useClinic();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [trends, setTrends] = useState<AntenatalLabTrend[]>([]);
  const [serology, setSerology] = useState<AntenatalSerologyMatrix | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    Promise.all([
      api<Patient>('GET', `/api/patients/${patientId}`),
      api<AntenatalLabTrendsResponse>('GET', `/api/patients/${patientId}/antenatal-lab-trends`),
      api<AntenatalSerologyResponse>('GET', `/api/patients/${patientId}/antenatal-serology`),
    ])
      .then(([pt, tr, sero]) => {
        setPatient(pt);
        setTrends(tr.allTrends || []);
        setSerology(sero.serology);
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
        <p className="muted">Loading antenatal lab trends and serology summary…</p>
      </div>
    );
  }

  const lmp = typeof patient.lastMenstrualPeriod === 'string' ? patient.lastMenstrualPeriod : null;
  const currentGa = calculateGestationalAge(lmp);
  const edd = calculateEdd(lmp);

  // Group trends by parameter
  const latestHb = trends.filter((t) => t.parameterKey === 'hb').slice(-1)[0];
  const latestPlatelets = trends.filter((t) => t.parameterKey === 'platelets').slice(-1)[0];
  const anemiaAlert = latestHb ? classifyAnemia(latestHb.numericValue, latestHb.trimester) : null;
  const thrombocytopeniaAlert = latestPlatelets ? classifyThrombocytopenia(latestPlatelets.numericValue) : null;
  const reminders = evaluateAntenatalReminders(currentGa?.weeks ?? null);

  return (
    <Sheet
      clinic={clinic}
      title="ANTENATAL LONGITUDINAL LAB TRENDS & SEROLOGY REPORT"
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
            <span className="muted small">Blood Group &amp; Rh:</span>
            <div>
              <strong>
                {serology?.bloodGroupAbo ? `${serology.bloodGroupAbo} ${serology.rhFactor === 'positive' ? 'Rh+' : serology.rhFactor === 'negative' ? 'Rh Negative' : ''}` : (patient.bloodGroup as string) || 'Not tested'}
              </strong>
            </div>
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

        {/* Clinical Alert Banner on Printout if Anemia or Thrombocytopenia */}
        {(anemiaAlert || thrombocytopeniaAlert) && (
          <div style={{ border: '1.5px solid #dc2626', background: '#fef2f2', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
            <div style={{ fontWeight: 'bold', color: '#991b1b', marginBottom: '0.2rem' }}>⚠️ High-Risk Antenatal Hematologic Flags</div>
            {anemiaAlert && <div style={{ color: '#b91c1c' }}>• {anemiaAlert}</div>}
            {thrombocytopeniaAlert && <div style={{ color: '#b91c1c' }}>• {thrombocytopeniaAlert}</div>}
          </div>
        )}

        {/* Maternal Infectious Disease & Serology Matrix */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ background: '#0f172a', color: '#ffffff', padding: '0.4rem 0.75rem', fontWeight: 'bold', fontSize: '0.88rem' }}>
            🛡️ MATERNAL INFECTIOUS DISEASE &amp; SEROLOGY SCREENING MATRIX
          </div>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <td style={{ padding: '0.4rem 0.6rem', width: '25%' }}><strong>HIV 1 &amp; 2 (Tridot / ELISA)</strong></td>
                <td style={{ padding: '0.4rem 0.6rem', width: '25%' }}>
                  <strong style={{ color: serology?.hivStatus === 'reactive' ? '#dc2626' : serology?.hivStatus === 'non_reactive' ? '#16a34a' : '#64748b' }}>
                    {(serology?.hivStatus || 'not_tested').toUpperCase()}
                  </strong>
                </td>
                <td style={{ padding: '0.4rem 0.6rem', width: '25%' }}><strong>HBsAg (Hepatitis B Surface Ag)</strong></td>
                <td style={{ padding: '0.4rem 0.6rem', width: '25%' }}>
                  <strong style={{ color: serology?.hbsagStatus === 'reactive' ? '#dc2626' : serology?.hbsagStatus === 'non_reactive' ? '#16a34a' : '#64748b' }}>
                    {(serology?.hbsagStatus || 'not_tested').toUpperCase()}
                  </strong>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>HCV (Hepatitis C Antibody)</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  <strong style={{ color: serology?.hcvStatus === 'reactive' ? '#dc2626' : serology?.hcvStatus === 'non_reactive' ? '#16a34a' : '#64748b' }}>
                    {(serology?.hcvStatus || 'not_tested').toUpperCase()}
                  </strong>
                </td>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>VDRL / RPR (Syphilis) &amp; Titer</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  <strong style={{ color: serology?.vdrlRprStatus === 'reactive' ? '#dc2626' : serology?.vdrlRprStatus === 'non_reactive' ? '#16a34a' : '#64748b' }}>
                    {(serology?.vdrlRprStatus || 'not_tested').toUpperCase()} {serology?.vdrlRprTiter ? `(Titer: ${serology.vdrlRprTiter})` : ''}
                  </strong>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>Rubella IgG Immunity Status</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  <strong style={{ color: serology?.rubellaIggStatus === 'immune' ? '#16a34a' : serology?.rubellaIggStatus === 'non_immune' ? '#d97706' : '#64748b' }}>
                    {(serology?.rubellaIggStatus || 'not_tested').toUpperCase()} {serology?.rubellaIggValue != null ? `(${serology.rubellaIggValue} IU/mL)` : ''}
                  </strong>
                </td>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>GBS Culture Swab (35–37w)</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  <strong style={{ color: serology?.gbsCultureStatus === 'positive' ? '#dc2626' : serology?.gbsCultureStatus === 'negative' ? '#16a34a' : '#64748b' }}>
                    {(serology?.gbsCultureStatus || 'not_tested').toUpperCase()}
                  </strong>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>Urine Culture (Bacteriuria)</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  <strong>{(serology?.urineCultureStatus || 'not_tested').toUpperCase()}</strong>
                  {serology?.urineCultureOrganism ? ` — ${serology.urineCultureOrganism}` : ''}
                </td>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>Hb HPLC (Hemoglobinopathy)</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  <strong>{(serology?.hemoglobinopathyHplc || 'not_tested').toUpperCase()}</strong>
                  {serology?.hplcHba2Pct != null ? ` (HbA2: ${serology.hplcHba2Pct}%)` : ''}
                </td>
              </tr>
              <tr style={{ background: '#f8fafc' }}>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>Indirect Coombs Test (Booking &amp; 28w)</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  Booking: <strong>{serology?.indirectCoombsTestBooking || 'not_done'}</strong> · 28w: <strong>{serology?.indirectCoombsTest28w || 'not_done'}</strong>
                </td>
                <td style={{ padding: '0.4rem 0.6rem' }}><strong>Anti-D Prophylaxis Administered</strong></td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  {serology?.rhFactor === 'negative' ? (
                    serology.antiDGiven ? (
                      <strong style={{ color: '#16a34a' }}>GIVEN on {serology.antiDGivenDate || ''} ({serology.antiDBatchDose || '300mcg'})</strong>
                    ) : (
                      <strong style={{ color: '#dc2626' }}>NOT ADMINISTERED (Required at 28w)</strong>
                    )
                  ) : (
                    <span className="muted">Not Indicated (Rh Positive)</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          {serology?.consultantReviewNotes && (
            <div style={{ padding: '0.5rem 0.75rem', background: '#f1f5f9', borderTop: '1px solid #cbd5e1', fontSize: '0.8rem' }}>
              <strong>Consultant Remarks:</strong> {serology.consultantReviewNotes}
            </div>
          )}
        </div>

        {/* Longitudinal Antenatal Lab Trends Table */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ background: '#0f172a', color: '#ffffff', padding: '0.4rem 0.75rem', fontWeight: 'bold', fontSize: '0.88rem' }}>
            📈 LONGITUDINAL ANTENATAL LAB OBSERVATIONS &amp; TRENDS
          </div>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '0.45rem', textAlign: 'left' }}>Test Date</th>
                <th style={{ padding: '0.45rem', textAlign: 'left' }}>Gestational Age</th>
                <th style={{ padding: '0.45rem', textAlign: 'left' }}>Trimester</th>
                <th style={{ padding: '0.45rem', textAlign: 'left' }}>Parameter</th>
                <th style={{ padding: '0.45rem', textAlign: 'left' }}>Observed Result</th>
                <th style={{ padding: '0.45rem', textAlign: 'left' }}>Reference Range</th>
                <th style={{ padding: '0.45rem', textAlign: 'left' }}>Flag</th>
                <th style={{ padding: '0.45rem', textAlign: 'left' }}>Clinical Action / Plan</th>
              </tr>
            </thead>
            <tbody>
              {trends.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>
                    No antenatal lab observations recorded.
                  </td>
                </tr>
              ) : (
                trends.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.4rem 0.45rem' }}><strong>{t.testDate}</strong></td>
                    <td style={{ padding: '0.4rem 0.45rem' }}>
                      {t.gestationalAgeWeeks != null ? `${t.gestationalAgeWeeks}w ${t.gestationalAgeDays || 0}d` : '—'}
                    </td>
                    <td style={{ padding: '0.4rem 0.45rem' }}>{t.trimester.toUpperCase()}</td>
                    <td style={{ padding: '0.4rem 0.45rem' }}><strong>{t.parameterName}</strong></td>
                    <td style={{ padding: '0.4rem 0.45rem' }}>
                      <strong style={{ fontSize: '0.9rem' }}>{t.numericValue}</strong> {t.unit}
                    </td>
                    <td style={{ padding: '0.4rem 0.45rem', color: '#475569', fontSize: '0.78rem' }}>
                      {t.referenceRange || '—'}
                    </td>
                    <td style={{ padding: '0.4rem 0.45rem' }}>
                      <span
                        style={{
                          fontWeight: 'bold',
                          color: t.abnormalFlag === 'critical' ? '#dc2626' : t.abnormalFlag === 'normal' ? '#16a34a' : '#d97706',
                        }}
                      >
                        {t.abnormalFlag.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '0.4rem 0.45rem', fontSize: '0.8rem', color: t.clinicalAction ? '#0f172a' : '#94a3b8' }}>
                      {t.clinicalAction || 'None'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Milestone Screening Compliance Review */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.6rem 0.8rem', background: '#f8fafc' }}>
          <strong style={{ fontSize: '0.85rem', color: '#0f172a', display: 'block', marginBottom: '0.4rem' }}>
            ⏰ Trimester Milestone Screenings (Universal Protocol Review)
          </strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
            {reminders.map((r) => (
              <div key={r.key} style={{ fontSize: '0.78rem', background: '#ffffff', padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                <div style={{ fontWeight: 'bold', color: '#334155' }}>{r.title}</div>
                <div className="muted" style={{ fontSize: '0.72rem' }}>Due: {r.dueWeeks}</div>
                <div style={{ marginTop: '0.2rem', fontWeight: '500', color: r.isDue ? '#16a34a' : r.isOverdue ? '#dc2626' : '#64748b' }}>
                  Status: {r.isDue ? 'DUE AT PRESENT VISIT' : r.isOverdue ? 'ACTION REQUIRED (OVERDUE)' : 'Upcoming'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Consultant Signature Block */}
        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
          <SignatureBlock
            clinic={clinic}
            designation="Consultant Obstetrician &amp; Gynecologist"
            subtext="Certified Antenatal Lab Trends &amp; Maternal Serology Record"
          />
        </div>
      </div>
    </Sheet>
  );
}
