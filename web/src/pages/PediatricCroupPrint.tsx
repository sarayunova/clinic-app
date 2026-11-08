import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPediatricCroupEpisode, PediatricCroupRecord, PediatricCroupFlowsheetRecord } from '../api';

export const PediatricCroupPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<PediatricCroupRecord | null>(null);
  const [logs, setLogs] = useState<PediatricCroupFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getPediatricCroupEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: 32 }}>Loading printable croup dossier...</div>;
  if (!episode) return <div style={{ padding: 32 }}>Episode not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1, color: '#0369a1' }}>
            Pediatric Emergency & Airway Medicine
          </h2>
          <h3 style={{ margin: '4px 0 0', color: '#111' }}>
            Pediatric Croup (Laryngotracheobronchitis) & Upper Airway Clinical Dossier
          </h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: AAP Guidelines & Westley Croup Clinical Scoring Matrix
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 'bold' }}>{episode.episode_code}</div>
          <div style={{ fontSize: 13, color: '#666' }}>Generated: {new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Patient Header */}
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse', background: '#f8fafc' }}>
        <tbody>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Patient Name:</strong> {episode.patient_name || 'N/A'}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>MRN:</strong> {episode.patient_number || 'N/A'}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Triage Time:</strong> {new Date(episode.triage_datetime).toLocaleString()}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Age:</strong> {episode.age_months} months</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Weight:</strong> {episode.weight_kg} kg</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Airway Presentation:</strong> {episode.barking_cough_present ? 'Barking Cough (+)' : 'No Cough'} | {episode.hoarseness_present ? 'Hoarseness (+)' : 'No Hoarseness'}
            </td>
          </tr>
          <tr>
            <td colSpan={3} style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Triage Vitals:</strong> Heart Rate: {episode.heart_rate_bpm} bpm | Resp Rate: {episode.respiratory_rate} /min | SpO₂: {episode.spo2_percent}% | <strong>Status:</strong> {episode.status.replace(/_/g, ' ').toUpperCase()}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Westley Croup Score & Airway Synthesis Box */}
      <div style={{ background: '#f0f9ff', borderLeft: '4px solid #0284c7', padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#0369a1' }}>
          Westley Airway Obstruction Scoring Matrix
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 12 }}>
          <div style={{ background: '#fff', padding: 8, borderRadius: 4, border: '1px solid #bae6fd' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>Inspiratory Stridor</div>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>{episode.inspiratory_stridor_score} / 2</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>
              {episode.inspiratory_stridor_score === 0 ? 'None' : episode.inspiratory_stridor_score === 1 ? 'With Agitation' : 'At Rest'}
            </div>
          </div>
          <div style={{ background: '#fff', padding: 8, borderRadius: 4, border: '1px solid #bae6fd' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>Retractions</div>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>{episode.retractions_score} / 3</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>
              {episode.retractions_score === 0 ? 'None' : episode.retractions_score === 1 ? 'Mild' : episode.retractions_score === 2 ? 'Moderate' : 'Severe'}
            </div>
          </div>
          <div style={{ background: '#fff', padding: 8, borderRadius: 4, border: '1px solid #bae6fd' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>Air Entry</div>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>{episode.air_entry_score} / 2</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>
              {episode.air_entry_score === 0 ? 'Normal' : episode.air_entry_score === 1 ? 'Decreased' : 'Markedly Reduced'}
            </div>
          </div>
          <div style={{ background: '#fff', padding: 8, borderRadius: 4, border: '1px solid #bae6fd' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>Cyanosis</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: episode.cyanosis_score > 0 ? '#dc2626' : '#16a34a' }}>
              {episode.cyanosis_score} / 5
            </div>
            <div style={{ fontSize: 10, color: '#64748b' }}>
              {episode.cyanosis_score === 0 ? 'None' : episode.cyanosis_score === 4 ? 'With Agitation' : 'At Rest'}
            </div>
          </div>
          <div style={{ background: '#fff', padding: 8, borderRadius: 4, border: '1px solid #bae6fd' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>Consciousness</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: episode.consciousness_score > 0 ? '#dc2626' : '#16a34a' }}>
              {episode.consciousness_score} / 5
            </div>
            <div style={{ fontSize: 10, color: '#64748b' }}>
              {episode.consciousness_score === 0 ? 'Normal / Alert' : 'Altered / Lethargic'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#e0f2fe', padding: 12, borderRadius: 6 }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Total Westley Croup Score: </span>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#0369a1' }}>
              {episode.westley_croup_score_total} / 17
            </span>
          </div>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: 4,
            backgroundColor:
              episode.westley_croup_score_total >= 12 ? '#fee2e2' :
              episode.westley_croup_score_total >= 6 ? '#ffedd5' :
              episode.westley_croup_score_total >= 3 ? '#fef3c7' : '#dcfce7',
            color:
              episode.westley_croup_score_total >= 12 ? '#991b1b' :
              episode.westley_croup_score_total >= 6 ? '#9a3412' :
              episode.westley_croup_score_total >= 3 ? '#92400e' : '#166534',
          }}>
            {episode.croup_severity_tier.replace(/_/g, ' ').toUpperCase()}
          </div>
        </div>
      </div>

      {/* Resuscitation & Pharmacotherapy Protocols */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: 16, marginBottom: 24, background: '#f8fafc' }}>
        <h4 style={{ margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#334155' }}>
          Airway Resuscitation & Pharmacotherapy Plan
        </h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px 4px', fontWeight: 600, width: '30%' }}>Dexamethasone Dose:</td>
              <td style={{ padding: '8px 4px' }}>
                <strong>{episode.dexamethasone_dose_mg} mg</strong> ({episode.dexamethasone_route.toUpperCase()}) — {episode.dexamethasone_administered ? '✅ Administered' : '⏳ Pending'}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px 4px', fontWeight: 600 }}>Nebulized L-Epinephrine:</td>
              <td style={{ padding: '8px 4px' }}>
                {episode.nebulized_epinephrine_indicated ? (
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>
                    INDICATED: {episode.epinephrine_nebulization_dose_ml || 0.5} mL 1:1000 in 3 mL NS ({episode.epinephrine_nebulization_administered ? '✅ Administered' : '⏳ Pending'})
                  </span>
                ) : (
                  <span style={{ color: '#16a34a' }}>Not Indicated (Mild Croup / No Stridor at Rest)</span>
                )}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px 4px', fontWeight: 600 }}>Rebound Observation Window:</td>
              <td style={{ padding: '8px 4px' }}>
                <strong>{episode.rebound_observation_hours_required} Hours</strong> mandatory observation post-nebulization prior to discharge consideration
              </td>
            </tr>
            {evalResult?.clinicalGuidance && (
              <tr>
                <td style={{ padding: '8px 4px', fontWeight: 600 }}>Clinical Pathway Directive:</td>
                <td style={{ padding: '8px 4px', color: '#0369a1' }}>{evalResult.clinicalGuidance}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Serial Observation Flowsheet */}
      <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Serial Westley Score & Rebound Observation Log ({logs.length} entries)
      </h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
            <th style={{ padding: 6, textAlign: 'left' }}>Time / Delta</th>
            <th style={{ padding: 6, textAlign: 'center' }}>Westley Score</th>
            <th style={{ padding: 6, textAlign: 'center' }}>HR</th>
            <th style={{ padding: 6, textAlign: 'center' }}>RR</th>
            <th style={{ padding: 6, textAlign: 'center' }}>SpO₂</th>
            <th style={{ padding: 6, textAlign: 'center' }}>Stridor at Rest</th>
            <th style={{ padding: 6, textAlign: 'left' }}>Retractions</th>
            <th style={{ padding: 6, textAlign: 'left' }}>Intervention</th>
            <th style={{ padding: 6, textAlign: 'left' }}>Logged By</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ padding: 12, textAlign: 'center', color: '#64748b' }}>
                No serial observation logs recorded.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: 6 }}>
                  {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (+{log.minutes_from_triage}m)
                </td>
                <td style={{ padding: 6, textAlign: 'center', fontWeight: 'bold' }}>
                  {log.westley_score_current}
                </td>
                <td style={{ padding: 6, textAlign: 'center' }}>{log.heart_rate_bpm}</td>
                <td style={{ padding: 6, textAlign: 'center' }}>{log.respiratory_rate}</td>
                <td style={{ padding: 6, textAlign: 'center' }}>{log.spo2_percent}%</td>
                <td style={{ padding: 6, textAlign: 'center' }}>{log.stridor_at_rest ? '⚠️ YES' : 'None'}</td>
                <td style={{ padding: 6 }}>{log.chest_retractions_severity.replace(/_/g, ' ')}</td>
                <td style={{ padding: 6 }}>{log.intervention_given.replace(/_/g, ' ')}</td>
                <td style={{ padding: 6 }}>{log.logged_by_name || 'Staff'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Attending Sign-Off */}
      <div style={{ marginTop: 40, borderTop: '1px solid #94a3b8', paddingTop: 16, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 'bold' }}>Treating Physician / Pediatrician</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Dr. {episode.consultant_name || 'Designated Pediatrician'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 'bold' }}>Signature & Stamp</div>
          <div style={{ marginTop: 24, borderBottom: '1px solid #333', width: 200 }} />
        </div>
      </div>

      {/* Screen action bar */}
      <div className="no-print" style={{ marginTop: 32, display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: '10px 24px',
            backgroundColor: '#0284c7',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          🖨️ Print Clinical Dossier
        </button>
        <button
          onClick={() => window.history.back()}
          style={{
            padding: '10px 24px',
            backgroundColor: '#64748b',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          ← Return to Console
        </button>
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};
