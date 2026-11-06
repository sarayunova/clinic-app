import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type NeonatalResuscitationEvent } from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';
import { calculateApgarScore, calculateSilvermanScore } from '../neonatalScoring';

export function NeonatalResuscitationPrint() {
  const { id } = useParams();
  const eventId = Number(id);
  const { clinic, error: clinicError } = useClinic();

  const [event, setEvent] = useState<NeonatalResuscitationEvent | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    api<NeonatalResuscitationEvent>('GET', `/api/neonatal-resuscitations/${eventId}`)
      .then((res) => {
        setEvent(res);
        setError(null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [eventId]);

  if (clinicError || error) {
    return (
      <div className="page narrow stack">
        <ErrorBanner error={clinicError || error} />
        <p>
          <Link to={`/patients/${event?.patientId || ''}`} className="btn small">
            ← Back to Patient Record
          </Link>
        </p>
      </div>
    );
  }

  if (loading || !clinic || !event) {
    return (
      <div className="page narrow stack">
        <p className="muted">Loading neonatal resuscitation record…</p>
      </div>
    );
  }

  const apgar1mInfo = calculateApgarScore({
    heartRate: event.apgar1mHeartRate,
    respiratoryEffort: event.apgar1mRespiratoryEffort,
    muscleTone: event.apgar1mMuscleTone,
    reflexIrritability: event.apgar1mReflexIrritability,
    color: event.apgar1mColor,
  });

  const apgar5mInfo = calculateApgarScore({
    heartRate: event.apgar5mHeartRate,
    respiratoryEffort: event.apgar5mRespiratoryEffort,
    muscleTone: event.apgar5mMuscleTone,
    reflexIrritability: event.apgar5mReflexIrritability,
    color: event.apgar5mColor,
  });

  const sasInfo = calculateSilvermanScore({
    thoracoabdominalMovement: event.sasThoracoabdominalMovement,
    intercostalRetraction: event.sasIntercostalRetraction,
    xiphoidRetraction: event.sasXiphoidRetraction,
    naresDilation: event.sasNaresDilation,
    expiratoryGrunt: event.sasExpiratoryGrunt,
  });

  return (
    <Sheet
      clinic={clinic}
      title="NEONATAL RESUSCITATION PROGRAM (NRP) & NEW-S CHART"
      back={`/patients/${event.patientId}`}
    >
      <div className="stack" style={{ gap: '1rem', fontSize: '0.85rem' }}>
        {/* Patient / Mother Demographics & Birth Profile */}
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
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Mother's Name</div>
            <div style={{ fontWeight: 'bold' }}>{event.motherName || 'Unknown'}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>MRN: {event.motherPatientNumber || '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Delivery Timestamp</div>
            <div style={{ fontWeight: 'bold' }}>
              {new Date(event.deliveryTimestamp).toLocaleDateString([], {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}{' '}
              {new Date(event.deliveryTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Mode: {event.deliveryMode.toUpperCase()}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Infant Gender & Weight</div>
            <div style={{ fontWeight: 'bold' }}>
              <span style={{ textTransform: 'capitalize' }}>{event.babyGender}</span> • {event.birthWeightGrams ? `${event.birthWeightGrams} g` : 'Weight not recorded'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Gestation: {event.gestationalAgeWeeks ? `${event.gestationalAgeWeeks}w ${event.gestationalAgeDays || 0}d` : '-'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Primary Disposition</div>
            <div style={{ fontWeight: 'bold', color: '#0f172a', textTransform: 'capitalize' }}>
              {event.primaryResuscitationOutcome.replace(/_/g, ' ')}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Liquor: {event.liquorAppearance.replace(/_/g, ' ')}</div>
          </div>
        </div>

        {/* Section 1: APGAR & Silverman-Anderson Retraction Scores */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.8rem' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#1e293b' }}>
            1. PHYSIOLOGICAL TRANSITION & RESPIRATORY RETRACTION SCORES
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '0.4rem' }}>Assessment Metric</th>
                <th style={{ padding: '0.4rem' }}>1-Minute</th>
                <th style={{ padding: '0.4rem' }}>5-Minute</th>
                <th style={{ padding: '0.4rem' }}>10-Minute</th>
                <th style={{ padding: '0.4rem' }}>Clinical Interpretation</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.4rem', fontWeight: 600 }}>Heart Rate</td>
                <td style={{ padding: '0.4rem' }}>{event.apgar1mHeartRate} / 2</td>
                <td style={{ padding: '0.4rem' }}>{event.apgar5mHeartRate} / 2</td>
                <td style={{ padding: '0.4rem' }}>{event.apgar10mHeartRate ?? '-'}</td>
                <td style={{ padding: '0.4rem' }}>0: Absent, 1: &lt;100 bpm, 2: &gt;=100 bpm</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.4rem', fontWeight: 'bold' }}>Respiratory Effort</td>
                <td style={{ padding: '0.4rem' }}>{event.apgar1mRespiratoryEffort} / 2</td>
                <td style={{ padding: '0.4rem' }}>{event.apgar5mRespiratoryEffort} / 2</td>
                <td style={{ padding: '0.4rem' }}>{event.apgar10mRespiratoryEffort ?? '-'}</td>
                <td style={{ padding: '0.4rem' }}>0: Absent, 1: Slow/irregular, 2: Vigorous cry</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.4rem', fontWeight: 'bold' }}>Muscle Tone</td>
                <td style={{ padding: '0.4rem' }}>{event.apgar1mMuscleTone} / 2</td>
                <td style={{ padding: '0.4rem' }}>{event.apgar5mMuscleTone} / 2</td>
                <td style={{ padding: '0.4rem' }}>{event.apgar10mMuscleTone ?? '-'}</td>
                <td style={{ padding: '0.4rem' }}>0: Flaccid, 1: Some flexion, 2: Well flexed</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.4rem', fontWeight: 'bold' }}>Reflex Irritability</td>
                <td style={{ padding: '0.4rem' }}>{event.apgar1mReflexIrritability} / 2</td>
                <td style={{ padding: '0.4rem' }}>{event.apgar5mReflexIrritability} / 2</td>
                <td style={{ padding: '0.4rem' }}>{event.apgar10mReflexIrritability ?? '-'}</td>
                <td style={{ padding: '0.4rem' }}>0: None, 1: Grimace, 2: Cry/cough/sneeze</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.4rem', fontWeight: 'bold' }}>Color</td>
                <td style={{ padding: '0.4rem' }}>{event.apgar1mColor} / 2</td>
                <td style={{ padding: '0.4rem' }}>{event.apgar5mColor} / 2</td>
                <td style={{ padding: '0.4rem' }}>{event.apgar10mColor ?? '-'}</td>
                <td style={{ padding: '0.4rem' }}>0: Blue/pale, 1: Acrocyanosis, 2: Pink</td>
              </tr>
              <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                <td style={{ padding: '0.5rem' }}>TOTAL APGAR SCORE</td>
                <td style={{ padding: '0.5rem', color: '#1e293b' }}>{event.apgar1mTotal} / 10</td>
                <td style={{ padding: '0.5rem', color: '#047857' }}>{event.apgar5mTotal} / 10</td>
                <td style={{ padding: '0.5rem', color: '#4338ca' }}>
                  {event.apgar10mTotal != null ? `${event.apgar10mTotal} / 10` : 'Not indicated'}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  1m: {apgar1mInfo.label} • 5m: {apgar5mInfo.label}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Silverman-Anderson Retraction Breakdown */}
          <div style={{ marginTop: '0.8rem', padding: '0.6rem', background: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: '4px' }}>
            <div style={{ fontWeight: 'bold', color: '#831843' }}>
              Silverman-Anderson Retraction Score (SAS): {event.sasTotalScore} / 10 ({sasInfo.label})
            </div>
            <div style={{ fontSize: '0.78rem', color: '#701a75', marginTop: '0.2rem' }}>
              Thoracoabdominal: {event.sasThoracoabdominalMovement}/2 • Intercostal: {event.sasIntercostalRetraction}/2 • Xiphoid: {event.sasXiphoidRetraction}/2 • Nares Flaring: {event.sasNaresDilation}/2 • Grunt: {event.sasExpiratoryGrunt}/2
            </div>
          </div>
        </div>

        {/* Section 2: NRP 8th Edition Resuscitation Actions */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.8rem' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#1e293b' }}>
            2. NRP 8TH EDITION GOLDEN MINUTE & RESUSCITATION INTERVENTIONS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8rem', fontSize: '0.8rem' }}>
            <div>
              <div style={{ fontWeight: 'bold', color: '#475569' }}>Initial Steps & Thermal Care:</div>
              <div>• Initial steps completed: {event.initialStepsCompleted ? 'Yes' : 'No'}</div>
              <div>• Delayed cord clamping: {event.delayedCordClampingSeconds || 0} seconds</div>
              <div>• Temperature method: {event.temperatureControlMethod.replace(/_/g, ' ')}</div>
              <div>• Initial Temperature: {event.initialTemperatureC ? `${event.initialTemperatureC} °C` : 'N/A'}</div>
              <div>• Meconium management: {event.meconiumManagement.replace(/_/g, ' ')}</div>
            </div>

            <div>
              <div style={{ fontWeight: 'bold', color: '#475569' }}>Ventilation & Airway:</div>
              <div>• PPV initiated: {event.ppvInitiated ? `Yes (${event.ppvStartSeconds}s post-delivery)` : 'No'}</div>
              <div>• PPV Device: {event.ppvDevice ? event.ppvDevice.replace(/_/g, ' ') : 'N/A'}</div>
              <div>• FiO2 Target: {event.targetFio2Percent || 21}%</div>
              <div>• MR. SOPA corrective steps: {event.mrSopaStepsRequired ? 'Performed' : 'Not required'}</div>
              <div>• Airway device: {event.laryngealMaskOrEttUsed.replace(/_/g, ' ')}</div>
            </div>

            <div>
              <div style={{ fontWeight: 'bold', color: '#475569' }}>Advanced Resuscitation & Meds:</div>
              <div>• Chest compressions (3:1): {event.chestCompressionsPerformed ? `Yes (${event.chestCompressionsDurationSeconds}s)` : 'No'}</div>
              <div>• Epinephrine (1:10,000): {event.epinephrineGiven ? `Yes (${event.epinephrineDoseMg} mg)` : 'No'}</div>
              <div>• Volume expander: {event.volumeExpanderGiven ? `Yes (${event.volumeExpanderMl} mL NS)` : 'No'}</div>
              <div>• Cord Blood Gas: pH {event.cordBloodGasPh ?? 'N/A'}, BE {event.cordBloodGasBe ? `${event.cordBloodGasBe} mmol/L` : 'N/A'}</div>
            </div>
          </div>

          {event.atRiskHypoglycemia && (
            <div style={{ marginTop: '0.6rem', padding: '0.4rem 0.6rem', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '4px', fontSize: '0.8rem', color: '#581c87' }}>
              <strong>Hypoglycemia Protocol Activated:</strong> {event.hypoglycemiaRiskReason || 'At-Risk Infant'} • Initial BG: {event.initialBloodGlucoseMgDl ? `${event.initialBloodGlucoseMgDl} mg/dL` : 'Pending'} • Action: {event.glucoseManagementAction.replace(/_/g, ' ')}
            </div>
          )}
        </div>

        {/* Section 3: Serial NEW-S Observations Log */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.8rem' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#1e293b' }}>
            3. SERIAL NEWBORN EARLY WARNING SCORE (NEW-S) OBSERVATIONS LOG
          </div>
          {(!event.newsObservations || event.newsObservations.length === 0) ? (
            <p style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>
              No subsequent bedside NEW-S observations recorded for this episode.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '0.35rem' }}>Timestamp / Age</th>
                  <th style={{ padding: '0.35rem' }}>HR (bpm)</th>
                  <th style={{ padding: '0.35rem' }}>RR (/min)</th>
                  <th style={{ padding: '0.35rem' }}>Temp (°C)</th>
                  <th style={{ padding: '0.35rem' }}>SpO2 / O2</th>
                  <th style={{ padding: '0.35rem' }}>Color / Tone / Grunt</th>
                  <th style={{ padding: '0.35rem' }}>Glucose</th>
                  <th style={{ padding: '0.35rem' }}>NEW-S Score</th>
                  <th style={{ padding: '0.35rem' }}>Action Taken & Nurse</th>
                </tr>
              </thead>
              <tbody>
                {event.newsObservations.map((obs) => (
                  <tr key={obs.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.35rem' }}>
                      {new Date(obs.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                      {obs.postnatalAgeHours != null && `(${obs.postnatalAgeHours}h)`}
                    </td>
                    <td style={{ padding: '0.35rem' }}>{obs.heartRateBpm ?? '-'}</td>
                    <td style={{ padding: '0.35rem' }}>{obs.respiratoryRateBpm ?? '-'}</td>
                    <td style={{ padding: '0.35rem' }}>{obs.temperatureC != null ? `${obs.temperatureC}°C` : '-'}</td>
                    <td style={{ padding: '0.35rem' }}>
                      {obs.spo2Percent != null ? `${obs.spo2Percent}%` : '-'} {obs.supplementalOxygen ? '(+O2)' : ''}
                    </td>
                    <td style={{ padding: '0.35rem', textTransform: 'capitalize' }}>
                      {obs.color.replace(/_/g, ' ')} • {obs.toneNeurology.replace(/_/g, ' ')}
                    </td>
                    <td style={{ padding: '0.35rem' }}>
                      {obs.bloodGlucoseMgDl != null ? `${obs.bloodGlucoseMgDl} mg/dL` : '-'}
                    </td>
                    <td style={{ padding: '0.35rem', fontWeight: 'bold' }}>
                      {obs.totalNewsScore} ({obs.alertSeverity.replace(/_/g, ' ').toUpperCase()})
                    </td>
                    <td style={{ padding: '0.35rem' }}>
                      {obs.clinicalActionTaken || 'Routine care'} ({obs.recordedByName || 'Staff'})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Section 4: Clinical Attestation & Signature */}
        <div style={{ marginTop: '0.5rem' }}>
          <SignatureBlock
            clinic={clinic}
            signatoryName={event.pediatricianAttending || event.createdByName || clinic.doctorName}
            designation="Attending Pediatrician / Neonatal Resuscitation Lead"
            subtext={`Resuscitation Nurse: ${event.resuscitationNurse || 'Staff Nurse'} • Documented: ${new Date(event.createdAt).toLocaleString()}`}
            alignment="right"
          />
        </div>
      </div>
    </Sheet>
  );
}
