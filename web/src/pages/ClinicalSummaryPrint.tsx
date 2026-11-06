import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  api,
  type ClinicalSummaryResponse,
} from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { ErrorBanner, formatAge } from '../components/ui';

type PrintMode = 'antenatal_card' | 'referral_letter' | 'health_summary';

function Allergy({ status, details }: { status: 'unknown' | 'none' | 'known'; details: string | null }) {
  return (
    <div>
      <strong>Allergies: </strong>
      {status === 'known' ? <span style={{ color: 'var(--color-danger, #b00020)', fontWeight: 600 }}>{details || 'Known allergies'}</span> : status === 'none' ? 'None known' : 'Not recorded'}
    </div>
  );
}

function Section({ title, children, badge }: { title: string; children: ReactNode; badge?: ReactNode }) {
  return (
    <section className="sheet-block" style={{ marginTop: '0.8rem' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {badge}
      </div>
      <div>{children}</div>
    </section>
  );
}

function Signature({ name, reg }: { name: string; reg?: string }) {
  return (
    <div className="signature" style={{ marginTop: '1.5rem' }}>
      <div className="signature-line" />
      <div><strong>{name}</strong></div>
      {reg && <div className="small muted">Reg. no. {reg}</div>}
    </div>
  );
}

export function ClinicalSummaryPrint() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const patientId = Number(id);
  const { clinic, error: clinicError } = useClinic();

  const [data, setData] = useState<ClinicalSummaryResponse | null>(null);
  const [error, setError] = useState<unknown>(null);

  // Document customisation state
  const initialMode = (searchParams.get('mode') as PrintMode) || 'antenatal_card';
  const [mode, setMode] = useState<PrintMode>(initialMode);
  const [showAntenatalMatrix, setShowAntenatalMatrix] = useState(true);
  const [showVitals, setShowVitals] = useState(true);
  const [showMedicines, setShowMedicines] = useState(true);
  const [showVisits, setShowVisits] = useState(true);

  // Referral specific fields
  const [referredTo, setReferredTo] = useState('District Hospital / Tertiary Maternity Center');
  const [urgency, setUrgency] = useState<'Routine' | 'Urgent' | 'Emergency'>('Urgent');
  const [referralReason, setReferralReason] = useState('');
  const [preReferralTreatment, setPreReferralTreatment] = useState('');
  const [referralNotes, setReferralNotes] = useState('');

  useEffect(() => {
    if (!patientId) return;
    api<ClinicalSummaryResponse>('GET', `/api/patients/${patientId}/clinical-summary`)
      .then((res) => {
        setData(res);
        if (res.pregnancy.highRiskFlags.length > 0) {
          setReferralReason(res.pregnancy.highRiskFlags.join('; '));
        } else if (res.pregnancy.isMaternity) {
          setReferralReason('Safe confinement / Delivery management');
        }
      })
      .catch(setError);
  }, [patientId]);

  if (error || clinicError) {
    return (
      <div className="page narrow">
        <ErrorBanner error={error ?? clinicError} />
      </div>
    );
  }

  if (!data || !clinic) {
    return <p className="muted" style={{ padding: '2rem' }}>Loading clinical summary…</p>;
  }

  const { patient, pregnancy, latestVitals, antenatalTests, recentVisits, activeMedicines, latestAdmission } = data;

  const handlePrint = () => {
    const kind = mode === 'referral_letter' ? 'referral_card' : 'antenatal_summary';
    void api('POST', '/api/print-log', { kind, id: patientId }).catch(() => {});
  };

  const title =
    mode === 'referral_letter'
      ? 'PATIENT REFERRAL & TRANSFER CARD'
      : mode === 'antenatal_card'
      ? 'ANTENATAL DISCHARGE & LABOR ADMISSION CARD'
      : 'COMPREHENSIVE CLINICAL HEALTH SUMMARY';

  const controls = (
    <div className="card stack" style={{ marginBottom: '1.2rem', padding: '0.8rem 1rem' }}>
      <div className="row wrap" style={{ gap: '0.8rem', alignItems: 'center' }}>
        <strong>Document Type:</strong>
        <div className="row wrap" style={{ gap: '0.3rem' }}>
          <button
            type="button"
            className={`btn small ${mode === 'antenatal_card' ? 'primary' : ''}`}
            onClick={() => setMode('antenatal_card')}
          >
            🤰 Antenatal Discharge / Labor Card
          </button>
          <button
            type="button"
            className={`btn small ${mode === 'referral_letter' ? 'primary' : ''}`}
            onClick={() => setMode('referral_letter')}
          >
            🚑 Referral & Transfer Letter
          </button>
          <button
            type="button"
            className={`btn small ${mode === 'health_summary' ? 'primary' : ''}`}
            onClick={() => setMode('health_summary')}
          >
            📋 Comprehensive Health Summary
          </button>
        </div>
      </div>

      <div className="row wrap" style={{ gap: '1rem', marginTop: '0.3rem' }}>
        <label className="row" style={{ gap: '0.35rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showAntenatalMatrix}
            onChange={(e) => setShowAntenatalMatrix(e.target.checked)}
            style={{ width: 'auto', minHeight: 'auto' }}
          />
          <span>Antenatal Test Matrix</span>
        </label>
        <label className="row" style={{ gap: '0.35rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showVitals}
            onChange={(e) => setShowVitals(e.target.checked)}
            style={{ width: 'auto', minHeight: 'auto' }}
          />
          <span>MEOWS Vitals</span>
        </label>
        <label className="row" style={{ gap: '0.35rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showMedicines}
            onChange={(e) => setShowMedicines(e.target.checked)}
            style={{ width: 'auto', minHeight: 'auto' }}
          />
          <span>Prescriptions</span>
        </label>
        <label className="row" style={{ gap: '0.35rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showVisits}
            onChange={(e) => setShowVisits(e.target.checked)}
            style={{ width: 'auto', minHeight: 'auto' }}
          />
          <span>Consultation History</span>
        </label>
      </div>

      {mode === 'referral_letter' && (
        <fieldset className="card stack" style={{ marginTop: '0.5rem', background: '#fafafa' }}>
          <legend>Referral Letter Details (Editable prior to print)</legend>
          <div className="grid2">
            <div>
              <label className="small">Referred to (Hospital / Specialist):</label>
              <input
                type="text"
                value={referredTo}
                onChange={(e) => setReferredTo(e.target.value)}
                placeholder="Hospital name or department"
              />
            </div>
            <div>
              <label className="small">Urgency Level:</label>
              <select value={urgency} onChange={(e) => setUrgency(e.target.value as typeof urgency)}>
                <option value="Emergency">🚨 Emergency (Immediate transfer)</option>
                <option value="Urgent">⚠️ Urgent (Within 24 hours)</option>
                <option value="Routine">ℹ️ Routine (Elective consultation)</option>
              </select>
            </div>
            <div className="span2">
              <label className="small">Indication / Reason for Referral:</label>
              <input
                type="text"
                value={referralReason}
                onChange={(e) => setReferralReason(e.target.value)}
                placeholder="Reason for referral"
              />
            </div>
            <div className="span2">
              <label className="small">Pre-Referral Treatment / Stabilization Given:</label>
              <input
                type="text"
                value={preReferralTreatment}
                onChange={(e) => setPreReferralTreatment(e.target.value)}
                placeholder="e.g. Loading dose MgSO4, IV Labetalol, Ringers Lactate, Left lateral tilt"
              />
            </div>
            <div className="span2">
              <label className="small">Doctor's Clinical Handover Notes:</label>
              <textarea
                rows={2}
                value={referralNotes}
                onChange={(e) => setReferralNotes(e.target.value)}
                placeholder="Additional notes for receiving clinical team..."
              />
            </div>
          </div>
        </fieldset>
      )}
    </div>
  );

  return (
    <Sheet
      clinic={clinic}
      title={title}
      back={`/patients/${patient.id}`}
      onPrint={handlePrint}
      controls={controls}
    >
      {/* Patient Demographics Banner */}
      <dl className="sheet-meta">
        <div><dt>Patient</dt><dd><strong>{patient.fullName}</strong></dd></div>
        <div><dt>Patient no.</dt><dd>{patient.patientNumber}</dd></div>
        <div><dt>Age</dt><dd>{formatAge(patient.ageYears, patient.ageIsEstimated)}</dd></div>
        <div><dt>Phone</dt><dd>{patient.phone || '—'}</dd></div>
        <div>
          <dt>Blood Group</dt>
          <dd>
            {patient.bloodGroup ? (
              <span style={{ fontWeight: 700, color: patient.bloodGroup.includes('-') ? '#b00020' : 'inherit' }}>
                {patient.bloodGroup} {patient.bloodGroup.includes('-') && '⚠️ (Rh-Negative)'}
              </span>
            ) : (
              'Not recorded'
            )}
          </dd>
        </div>
        {patient.emergencyContactName && (
          <div><dt>Emergency Contact</dt><dd>{patient.emergencyContactName} ({patient.emergencyContactPhone || '—'})</dd></div>
        )}
      </dl>

      <Allergy status={patient.allergyStatus} details={patient.allergyDetails} />

      {/* Referral Banner (if in referral mode) */}
      {mode === 'referral_letter' && (
        <div
          style={{
            margin: '0.8rem 0',
            padding: '0.6rem 0.8rem',
            border: '2px solid #b00020',
            borderRadius: '4px',
            background: urgency === 'Emergency' ? '#fff0f0' : '#fffdf5',
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: urgency === 'Emergency' ? '#b00020' : '#854d0e' }}>
              REFERRAL: {urgency.toUpperCase()}
            </span>
            <span><strong>To: </strong>{referredTo}</span>
          </div>
          <div style={{ marginTop: '0.35rem' }}>
            <strong>Indication: </strong>{referralReason || 'Clinical referral'}
          </div>
          {preReferralTreatment && (
            <div style={{ marginTop: '0.25rem' }}>
              <strong>Pre-referral Treatment Given: </strong>{preReferralTreatment}
            </div>
          )}
          {referralNotes && (
            <div style={{ marginTop: '0.25rem' }}>
              <strong>Handover Notes: </strong>{referralNotes}
            </div>
          )}
        </div>
      )}

      {/* Obstetric & Pregnancy Profile */}
      {pregnancy.isMaternity && (
        <Section
          title="Obstetric & Maternal Profile"
          badge={
            pregnancy.trimester && (
              <span className="chip" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                {pregnancy.trimester}
              </span>
            )
          }
        >
          <dl className="sheet-meta" style={{ marginTop: '0.2rem' }}>
            {pregnancy.gpalFormatted && (
              <div><dt>Obstetric Index</dt><dd><strong>{pregnancy.gpalFormatted}</strong></dd></div>
            )}
            <div><dt>LMP</dt><dd>{pregnancy.lmp || '—'}</dd></div>
            <div><dt>EDD (Expected Delivery)</dt><dd><strong>{pregnancy.edd || '—'}</strong></dd></div>
            <div>
              <dt>Gestational Age</dt>
              <dd><strong>{pregnancy.gestationalAgeFormatted ? `${pregnancy.gestationalAgeFormatted} (${pregnancy.gestationalWeeks}w ${pregnancy.gestationalDays}d)` : '—'}</strong></dd>
            </div>
          </dl>

          {/* High-Risk Clinical Flags */}
          {pregnancy.highRiskFlags.length > 0 && (
            <div
              style={{
                marginTop: '0.4rem',
                padding: '0.4rem 0.6rem',
                background: '#fef2f2',
                borderLeft: '4px solid #ef4444',
                borderRadius: '2px',
              }}
            >
              <strong style={{ color: '#991b1b', fontSize: '0.9rem' }}>⚠️ High-Risk Pregnancy Factors:</strong>
              <ul style={{ margin: '0.2rem 0 0 1.2rem', padding: 0 }}>
                {pregnancy.highRiskFlags.map((flag, idx) => (
                  <li key={idx} style={{ color: '#b91c1c', fontWeight: 600, fontSize: '0.85rem' }}>
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* Clinical History & Ongoing Notes */}
      {(patient.medicalHistory || patient.surgicalHistory || patient.obstetricHistory) && (
        <Section title="Clinical Background & Medical History">
          <dl className="sheet-meta">
            {patient.medicalHistory && <div><dt>Medical History</dt><dd>{patient.medicalHistory}</dd></div>}
            {patient.surgicalHistory && <div><dt>Surgical History</dt><dd>{patient.surgicalHistory}</dd></div>}
            {patient.obstetricHistory && <div><dt>Past Obstetric History</dt><dd>{patient.obstetricHistory}</dd></div>}
          </dl>
        </Section>
      )}

      {/* Latest Vitals & MEOWS Alert Status */}
      {showVitals && latestVitals && (
        <Section
          title="Latest Clinical Observations & MEOWS"
          badge={
            <span
              className="chip"
              style={{
                fontWeight: 700,
                background: latestVitals.meowsLevel === 'red' ? '#fee2e2' : latestVitals.meowsLevel === 'yellow' ? '#fef3c7' : '#ecfdf5',
                color: latestVitals.meowsLevel === 'red' ? '#991b1b' : latestVitals.meowsLevel === 'yellow' ? '#92400e' : '#065f46',
                border: `1px solid ${latestVitals.meowsLevel === 'red' ? '#f87171' : latestVitals.meowsLevel === 'yellow' ? '#fbbf24' : '#34d399'}`,
              }}
            >
              MEOWS: {latestVitals.meowsLevel.toUpperCase()} ({latestVitals.meowsScore} pts)
            </span>
          }
        >
          <dl className="sheet-meta" style={{ marginTop: '0.2rem' }}>
            <div>
              <dt>Blood Pressure</dt>
              <dd>
                <strong>
                  {latestVitals.systolic != null && latestVitals.diastolic != null
                    ? `${latestVitals.systolic}/${latestVitals.diastolic} mmHg`
                    : '—'}
                </strong>
              </dd>
            </div>
            <div>
              <dt>Pulse / Heart Rate</dt>
              <dd><strong>{latestVitals.heartRate != null ? `${latestVitals.heartRate} bpm` : '—'}</strong></dd>
            </div>
            <div>
              <dt>Temperature</dt>
              <dd>{latestVitals.temperatureC != null ? `${latestVitals.temperatureC}°C` : '—'}</dd>
            </div>
            <div>
              <dt>Respiratory Rate</dt>
              <dd>{latestVitals.respiratoryRate != null ? `${latestVitals.respiratoryRate}/min` : '—'}</dd>
            </div>
            <div>
              <dt>Oxygen Saturation (SpO₂)</dt>
              <dd><strong>{latestVitals.spo2 != null ? `${latestVitals.spo2}%` : '—'}</strong></dd>
            </div>
            {latestVitals.weightKg != null && (
              <div><dt>Weight</dt><dd>{latestVitals.weightKg} kg</dd></div>
            )}
            {latestVitals.urineProtein && (
              <div><dt>Urine Protein</dt><dd><strong>{latestVitals.urineProtein}</strong></dd></div>
            )}
            {latestVitals.urineGlucose && (
              <div><dt>Urine Glucose</dt><dd>{latestVitals.urineGlucose}</dd></div>
            )}
          </dl>
          {latestVitals.meowsTriggers.length > 0 && (
            <div style={{ marginTop: '0.3rem', fontSize: '0.85rem', color: '#b91c1c' }}>
              <strong>Early warning triggers: </strong>{latestVitals.meowsTriggers.join(' · ')}
            </div>
          )}
          <div className="small muted" style={{ marginTop: '0.2rem' }}>
            Recorded on {latestVitals.recordedAt.slice(0, 16).replace('T', ' ')} ({latestVitals.source.toUpperCase()})
          </div>
        </Section>
      )}

      {/* Routine Antenatal Test Matrix */}
      {showAntenatalMatrix && antenatalTests && antenatalTests.items.length > 0 && (
        <Section
          title="Antenatal Routine Investigation Matrix"
          badge={
            <span className="small muted">
              {antenatalTests.done} of {antenatalTests.total} done
            </span>
          }
        >
          <table className="table" style={{ marginTop: '0.3rem', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Test / Screening</th>
                <th style={{ width: '15%' }}>Recommended</th>
                <th style={{ width: '12%' }}>Status</th>
                <th style={{ width: '18%' }}>Result / Value</th>
                <th style={{ width: '25%' }}>Notes / Document</th>
              </tr>
            </thead>
            <tbody>
              {antenatalTests.items.map((t) => {
                const isCompleted = t.status === 'completed';
                return (
                  <tr key={t.testKey} style={{ background: isCompleted ? 'transparent' : '#fafafa' }}>
                    <td>
                      <strong>{t.testName}</strong>
                      {t.isMandatory && <span style={{ color: '#ef4444', marginLeft: '0.2rem' }}>*</span>}
                    </td>
                    <td className="small muted">{t.recommendedWeeks}</td>
                    <td>
                      <span
                        className="small"
                        style={{
                          fontWeight: 600,
                          color: isCompleted ? '#059669' : t.status === 'ordered' ? '#2563eb' : '#6b7280',
                        }}
                      >
                        {isCompleted ? '✓ Done' : t.status === 'ordered' ? 'Ordered' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      <strong>{t.resultValue || (isCompleted ? 'Completed' : '—')}</strong>
                      {t.completedDate && <div className="small muted">{t.completedDate}</div>}
                    </td>
                    <td className="small">
                      {t.notes || '—'}
                      {t.attachmentTitle && <div className="muted">📎 {t.attachmentTitle}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      )}

      {/* Active Prescription & Regimens */}
      {showMedicines && (activeMedicines.length > 0 || patient.ongoingMedicines) && (
        <Section title="Current Medication & Regimen">
          {activeMedicines.length > 0 ? (
            <table className="table" style={{ marginTop: '0.3rem', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Medicine</th>
                  <th>Dose</th>
                  <th>Frequency</th>
                  <th>Duration</th>
                  <th>Prescribed Date</th>
                </tr>
              </thead>
              <tbody>
                {activeMedicines.map((m, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      <strong>{m.medicine}</strong>{m.strength ? ` ${m.strength}` : ''}
                      {m.route && <div className="small muted">Route: {m.route}</div>}
                      {m.instructions && <div className="small">{m.instructions}</div>}
                    </td>
                    <td>{m.dose || '—'}</td>
                    <td>{m.frequency || '—'}</td>
                    <td>{m.duration || '—'}</td>
                    <td className="small muted">{m.prescribedDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted small">No active consultation prescriptions.</p>
          )}

          {patient.ongoingMedicines && (
            <div style={{ marginTop: '0.4rem', fontSize: '0.9rem' }}>
              <strong>Self-reported / ongoing medicines: </strong>{patient.ongoingMedicines}
            </div>
          )}
        </Section>
      )}

      {/* Recent Consultation History */}
      {showVisits && recentVisits.length > 0 && (
        <Section title="Recent Consultation Notes">
          <div className="stack" style={{ gap: '0.5rem', marginTop: '0.3rem' }}>
            {recentVisits.slice(0, 3).map((v) => (
              <div
                key={v.id}
                style={{
                  borderLeft: '3px solid #cbd5e1',
                  paddingLeft: '0.6rem',
                  fontSize: '0.85rem',
                }}
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{v.visitDate} · {v.status === 'final' ? 'Finalised' : 'Draft'}</strong>
                  {v.doctorName && <span className="small muted">By {v.doctorName}</span>}
                </div>
                {v.complaints && <div><strong>Complaints: </strong>{v.complaints}</div>}
                {v.assessment && <div><strong>Assessment / Diagnosis: </strong>{v.assessment}</div>}
                {v.advice && <div><strong>Advice: </strong>{v.advice}</div>}
                {v.followUpDate && <div><strong>Advised Follow-up: </strong>{v.followUpDate}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Recent Inpatient Admission (if applicable) */}
      {latestAdmission && (
        <Section title="Hospital Admission Summary">
          <dl className="sheet-meta">
            <div><dt>Admission no.</dt><dd>{latestAdmission.admissionNumber}</dd></div>
            <div><dt>Admitted</dt><dd>{latestAdmission.admittedDate}</dd></div>
            <div><dt>Discharged</dt><dd>{latestAdmission.dischargedDate || 'Currently Inpatient'}</dd></div>
            {latestAdmission.reason && <div><dt>Reason</dt><dd>{latestAdmission.reason}</dd></div>}
            {latestAdmission.finalDiagnosis && <div><dt>Diagnosis</dt><dd>{latestAdmission.finalDiagnosis}</dd></div>}
            {latestAdmission.conditionAtDischarge && <div><dt>Condition at Discharge</dt><dd>{latestAdmission.conditionAtDischarge}</dd></div>}
          </dl>
        </Section>
      )}

      {/* Signature and Verification */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1.5rem' }}>
        <div className="small muted">
          Clinical decision support sheet · Confidential medical record · Generated from electronic clinic register
        </div>
        <Signature name={clinic.doctorName || 'Attending Physician'} reg={clinic.registrationNo} />
      </div>
    </Sheet>
  );
}
