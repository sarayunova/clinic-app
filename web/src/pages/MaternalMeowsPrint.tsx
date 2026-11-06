import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type MaternalMeowsEpisode } from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';

export function MaternalMeowsPrint() {
  const { id } = useParams();
  const episodeId = Number(id);
  const { clinic, error: clinicError } = useClinic();

  const [episode, setEpisode] = useState<MaternalMeowsEpisode | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!episodeId) return;
    setLoading(true);
    api<MaternalMeowsEpisode>('GET', `/api/meows-episodes/${episodeId}`)
      .then((res) => {
        setEpisode(res);
        setError(null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [episodeId]);

  if (clinicError || error) {
    return (
      <div className="page narrow stack">
        <ErrorBanner error={clinicError || error} />
        <p>
          <Link to={`/patients/${episode?.patientId || ''}`} className="btn small">
            ← Back to Patient Record
          </Link>
        </p>
      </div>
    );
  }

  if (loading || !clinic || !episode) {
    return (
      <div className="page narrow stack">
        <p className="muted">Loading MEOWS audit chart…</p>
      </div>
    );
  }

  return (
    <Sheet
      clinic={clinic}
      title="MATERNAL EARLY OBSTETRIC WARNING SYSTEM (MEOWS) & SEPSIS AUDIT"
      back={`/patients/${episode.patientId}`}
    >
      <div className="stack" style={{ gap: '1rem', fontSize: '0.85rem' }}>
        {/* Patient Demographics & Episode Summary Grid */}
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
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Patient Name</div>
            <div style={{ fontWeight: 'bold' }}>{episode.patientName || 'Unknown'}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>MRN: {episode.patientNumber || '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Episode Phase & Started</div>
            <div style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
              {episode.episodeType.replace(/_/g, ' ')}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {new Date(episode.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Clinical Indication</div>
            <div style={{ fontWeight: 'bold' }}>{episode.clinicalIndication || episode.primaryDiagnosis || 'Routine'}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Diagnosis: {episode.primaryDiagnosis || '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Episode Status</div>
            <div style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
              {episode.status.replace(/_/g, ' ')}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Flags: {episode.highRiskFlags || 'None'}</div>
          </div>
        </div>

        {/* Section 1: Standard MEOWS Physiological Criteria Summary */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.6rem 0.8rem', background: '#fafafa', fontSize: '0.78rem' }}>
          <strong>RCOG/MBRRACE-UK Trigger Thresholds:</strong>
          <span style={{ marginLeft: '0.5rem' }}>
            <strong>Yellow:</strong> RR 10 or 21-25 • SpO2 94-95% • Temp 35.1-35.9 / 37.5-37.9°C • SBP 90-99 / 140-149 • DBP 90-99 • HR 50-59 / 100-119 • Oliguria &lt;30mL/h • Prot 1+
          </span>
          <br />
          <span style={{ color: '#b91c1c' }}>
            <strong>Red:</strong> RR &lt;10 or &gt;25 • SpO2 &lt;94% • Temp &lt;35 or &gt;=38°C • SBP &lt;90 or &gt;=150 • DBP &lt;50 or &gt;=100 • HR &lt;50 or &gt;=120 • Pain/Unresponsive • Hemorrhage • Anuria &lt;15mL/h • Prot &gt;=2+
          </span>
        </div>

        {/* Section 2: Chronological MEOWS Bedside Flowsheet */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.8rem' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#1e293b' }}>
            SERIAL MEOWS OBSERVATIONS &amp; SEPSIS (SOS) TRACK-AND-TRIGGER FLOWSHEET
          </div>
          {(!episode.observations || episode.observations.length === 0) ? (
            <p style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.8rem' }}>
              No bedside observations recorded for this episode.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.76rem' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '0.35rem' }}>Time</th>
                  <th style={{ padding: '0.35rem' }}>RR</th>
                  <th style={{ padding: '0.35rem' }}>SpO2 / O2</th>
                  <th style={{ padding: '0.35rem' }}>Temp (°C)</th>
                  <th style={{ padding: '0.35rem' }}>BP (mmHg)</th>
                  <th style={{ padding: '0.35rem' }}>HR</th>
                  <th style={{ padding: '0.35rem' }}>AVPU</th>
                  <th style={{ padding: '0.35rem' }}>Lochia / Urine</th>
                  <th style={{ padding: '0.35rem' }}>Prot</th>
                  <th style={{ padding: '0.35rem' }}>Triggers</th>
                  <th style={{ padding: '0.35rem' }}>SOS</th>
                  <th style={{ padding: '0.35rem' }}>Action Taken &amp; Staff</th>
                </tr>
              </thead>
              <tbody>
                {episode.observations.map((obs) => {
                  let badgeColor = '#15803d'; // Green
                  if (obs.overallAlertLevel === 'critical_multiple_red') badgeColor = '#b91c1c';
                  else if (obs.overallAlertLevel === 'urgent_two_yellow_one_red') badgeColor = '#b45309';
                  else if (obs.overallAlertLevel === 'single_yellow') badgeColor = '#ca8a04';

                  return (
                    <tr key={obs.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.35rem', fontWeight: 600 }}>
                        {new Date(obs.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '0.35rem', color: obs.rrTrigger === 'red' ? '#b91c1c' : obs.rrTrigger === 'yellow' ? '#b45309' : 'inherit' }}>
                        {obs.respiratoryRate ?? '-'}
                      </td>
                      <td style={{ padding: '0.35rem', color: obs.spo2Trigger === 'red' ? '#b91c1c' : obs.spo2Trigger === 'yellow' ? '#b45309' : 'inherit' }}>
                        {obs.spo2Percent != null ? `${obs.spo2Percent}%` : '-'}
                        {obs.supplementalO2 && ' (+O2)'}
                      </td>
                      <td style={{ padding: '0.35rem', color: obs.tempTrigger === 'red' ? '#b91c1c' : obs.tempTrigger === 'yellow' ? '#b45309' : 'inherit' }}>
                        {obs.temperatureC != null ? `${obs.temperatureC}°C` : '-'}
                      </td>
                      <td style={{ padding: '0.35rem', color: obs.bpTrigger === 'red' ? '#b91c1c' : obs.bpTrigger === 'yellow' ? '#b45309' : 'inherit' }}>
                        {obs.bpSystolic ?? '-'}/{obs.bpDiastolic ?? '-'}
                      </td>
                      <td style={{ padding: '0.35rem', color: obs.hrTrigger === 'red' ? '#b91c1c' : obs.hrTrigger === 'yellow' ? '#b45309' : 'inherit' }}>
                        {obs.heartRate ?? '-'}
                      </td>
                      <td style={{ padding: '0.35rem', textTransform: 'capitalize' }}>
                        {obs.avpuConsciousness}
                      </td>
                      <td style={{ padding: '0.35rem', textTransform: 'capitalize' }}>
                        {obs.lochiaStatus.replace(/_/g, ' ')} • {obs.urineOutputMlHr != null ? `${obs.urineOutputMlHr}mL/h` : '-'}
                      </td>
                      <td style={{ padding: '0.35rem' }}>{obs.proteinuria}</td>
                      <td style={{ padding: '0.35rem', fontWeight: 'bold', color: badgeColor }}>
                        {obs.redTriggersCount > 0 ? `${obs.redTriggersCount}R ` : ''}
                        {obs.yellowTriggersCount > 0 ? `${obs.yellowTriggersCount}Y` : obs.redTriggersCount === 0 ? 'Normal' : ''}
                      </td>
                      <td style={{ padding: '0.35rem', fontWeight: obs.sosScore >= 4 ? 'bold' : 'normal', color: obs.sosScore >= 6 ? '#b91c1c' : obs.sosScore >= 4 ? '#b45309' : 'inherit' }}>
                        {obs.sosScore}
                      </td>
                      <td style={{ padding: '0.35rem' }}>
                        {obs.actionTaken || obs.actionRequired || 'Routine monitoring'} ({obs.recordedByName || 'Staff'})
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Section 3: Sepsis Bundle Execution Note (if active) */}
        {episode.observations?.some(o => o.sosScore >= 4 || o.bundleBloodCulturesTaken) && (
          <div style={{ border: '1px solid #fbcfe8', background: '#fdf2f8', borderRadius: '6px', padding: '0.6rem 0.8rem', fontSize: '0.78rem', color: '#831843' }}>
            <strong>Maternal Sepsis 1-Hour Bundle Documentation:</strong>
            <div style={{ marginTop: '0.2rem' }}>
              Blood cultures, serum lactate, empiric broad-spectrum IV antibiotics, IV crystalloid resuscitation, and Foley catheterization hourly urine output audit.
            </div>
          </div>
        )}

        {/* Section 4: Clinical Attestation & Signature */}
        <div style={{ marginTop: '0.5rem' }}>
          <SignatureBlock
            clinic={clinic}
            signatoryName={clinic.doctorName}
            designation="Attending Obstetrician &amp; Gynecologist"
            subtext={`MEOWS Surveillance Audit • Documented on ${new Date(episode.createdAt).toLocaleString()}`}
            alignment="right"
          />
        </div>
      </div>
    </Sheet>
  );
}
