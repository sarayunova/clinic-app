import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPediatricForeignBodyEpisode, PediatricForeignBodyRecord, PediatricForeignBodyFlowsheetRecord } from '../api';

export const PediatricForeignBodyPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<PediatricForeignBodyRecord | null>(null);
  const [logs, setLogs] = useState<PediatricForeignBodyFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getPediatricForeignBodyEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: 32 }}>Loading printable foreign body choking dossier...</div>;
  if (!episode) return <div style={{ padding: 32 }}>Episode not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1, color: '#dc2626' }}>
            Pediatric Emergency & Critical Care Medicine
          </h2>
          <h3 style={{ margin: '4px 0 0', color: '#111' }}>
            Foreign Body Airway Obstruction (FBAO) & Choking Emergency Dossier
          </h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: AAP / AHA PALS Guidelines for Airway Obstruction & ILCOR Pediatric Resuscitation
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
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Choking Event:</strong> {new Date(episode.incident_datetime).toLocaleString()}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Age:</strong> {episode.age_months} months ({episode.age_months < 12 ? 'Infant < 1 yr' : 'Child ≥ 1 yr'})</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Weight:</strong> {episode.weight_kg} kg</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Witnessed Episode:</strong> {episode.witnessed_choking_episode ? 'YES' : 'NO / Unwitnessed'}</td>
          </tr>
          <tr>
            <td colSpan={3} style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Suspected Object:</strong> {episode.suspected_foreign_body_nature.replace(/_/g, ' ').toUpperCase()} | <strong>Clinical Status:</strong> {episode.status.replace(/_/g, ' ').toUpperCase()}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Obstruction & Respiratory Distress Box */}
      <div style={{ background: '#fef2f2', borderLeft: '4px solid #dc2626', padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#991b1b' }}>
          Airway Compromise & Vital Signs at Presentation
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Obstruction Severity</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#b91c1c' }}>
              {episode.obstruction_severity.replace(/_/g, ' ').toUpperCase()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>SpO2 / HR / RR</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: episode.spo2_percent < 92 ? '#dc2626' : '#16a34a' }}>
              {episode.spo2_percent}% | {episode.heart_rate_bpm} bpm
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>RR: {episode.respiratory_rate} /min</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Clinical Signs</div>
            <div style={{ fontSize: 13, fontWeight: 'bold' }}>
              {episode.stridor_or_aphonia ? 'Stridor/Aphonia' : 'No Stridor'}, {episode.cyanosis_present ? 'Cyanosis (+)' : 'No Cyanosis'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Silent Chest: {episode.silent_chest_noted ? 'YES (Complete)' : 'No'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Blind Sweep Audit</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: episode.blind_finger_sweep_avoided ? '#16a34a' : '#dc2626' }}>
              {episode.blind_finger_sweep_avoided ? 'STRICTLY AVOIDED' : 'VIOLATION'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Contraindicated</div>
          </div>
        </div>
      </div>

      {/* Algorithmic Clinical Guidance */}
      {evalResult && (
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: 16, marginBottom: 24, borderRadius: 4 }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>PALS Guideline Maneuver & Urgency Stratification</h4>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 'bold', color: '#0284c7' }}>Airway Urgency Tier: </span>
            <span style={{ fontWeight: 'bold' }}>{evalResult.airwayUrgencyLabel}</span>
            <span style={{ marginLeft: 16, fontWeight: 'bold', color: '#7c3aed' }}>Bronchoscopy Urgency: </span>
            <span>{evalResult.bronchoscopyUrgency.replace(/_/g, ' ').toUpperCase()}</span>
          </div>

          <div style={{ background: '#fff', padding: 12, border: '1px solid #e2e8f0', borderRadius: 4, marginBottom: 12 }}>
            <div style={{ fontWeight: 'bold', color: '#b91c1c', marginBottom: 4 }}>Recommended Resuscitation Maneuver:</div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>{evalResult.maneuverDescription}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, color: '#dc2626' }}>Critical Action Plan:</div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.4 }}>
                {evalResult.criticalActionPlan.map((action: string, idx: number) => (
                  <li key={idx}>{action}</li>
                ))}
              </ul>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, color: '#0369a1' }}>Clinical Safety Directives:</div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.4 }}>
                {evalResult.clinicalSafetyDirectives.map((dir: string, idx: number) => (
                  <li key={idx}>{dir}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Interventions Applied & Procedural Status */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
          Maneuver Outcome & Surgical Escalation Details
        </h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <tbody>
            <tr>
              <td style={{ padding: '6px 8px', width: '30%', color: '#64748b' }}>Primary Maneuver Executed:</td>
              <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{episode.intervention_applied.replace(/_/g, ' ')}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', color: '#64748b' }}>Foreign Body Expelled:</td>
              <td style={{ padding: '6px 8px', fontWeight: 'bold', color: episode.foreign_body_expelled ? '#16a34a' : '#b45309' }}>
                {episode.foreign_body_expelled ? 'YES - Foreign Body Successfully Expelled' : 'NO - Foreign Body Retained'}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', color: '#64748b' }}>Spontaneous Respiration:</td>
              <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>
                {episode.spontaneous_respiration_restored ? 'Restored & Stable' : 'Absent / CPR or Mechanical Ventilation Required'}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', color: '#64748b' }}>Rigid Bronchoscopy:</td>
              <td style={{ padding: '6px 8px' }}>
                {episode.rigid_bronchoscopy_required ? (
                  <span style={{ fontWeight: 'bold', color: '#dc2626' }}>
                    YES — Location: {episode.bronchoscopy_location?.replace(/_/g, ' ').toUpperCase() || 'Pending OR'}
                  </span>
                ) : (
                  'Not Required / Managed Conservatively'
                )}
              </td>
            </tr>
            {episode.clinical_notes && (
              <tr>
                <td style={{ padding: '6px 8px', color: '#64748b' }}>Clinical Summary & Notes:</td>
                <td style={{ padding: '6px 8px', fontStyle: 'italic' }}>{episode.clinical_notes}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Flowsheet Log Table */}
      <div style={{ marginBottom: 32 }}>
        <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: 4 }}>
          Emergency Resuscitation & Airway Flowsheet Logs ({logs.length})
        </h4>
        {logs.length === 0 ? (
          <div style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic', padding: 8 }}>
            No serial flowsheet entries logged during resuscitation.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: 6, textAlign: 'left' }}>Time</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Intervention Cycle</th>
                <th style={{ padding: 6, textAlign: 'left' }}>SpO2 / HR / RR</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Airway Patency</th>
                <th style={{ padding: 6, textAlign: 'left' }}>FB Visualized/Removed?</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Logged By</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Observations</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: 6 }}>{new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                  <td style={{ padding: 6, fontWeight: 'bold' }}>{log.intervention_cycle.replace(/_/g, ' ')}</td>
                  <td style={{ padding: 6 }}>
                    {log.spo2_percent ?? '-'}% | {log.heart_rate_bpm ?? '-'} bpm | {log.respiratory_rate ?? '-'} /min
                  </td>
                  <td style={{ padding: 6 }}>{log.airway_patency.replace(/_/g, ' ')}</td>
                  <td style={{ padding: 6 }}>{log.foreign_object_visualized_or_removed ? 'YES (+)' : 'No'}</td>
                  <td style={{ padding: 6 }}>{log.logged_by_name || 'Staff'}</td>
                  <td style={{ padding: 6 }}>{log.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Attending Provider Sign-Off */}
      <div style={{ borderTop: '2px solid #333', paddingTop: 20, marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
        <div>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 28 }}>
            Attending Pediatrician / Resuscitator
          </div>
          <div style={{ borderBottom: '1px solid #000', marginBottom: 4 }} />
          <div style={{ fontSize: 13, fontWeight: 'bold' }}>{episode.consultant_name || 'Attending Physician'}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Date & Time: ________________________</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 28 }}>
            Pediatric ENT Surgeon / Anesthesiologist (if OR Escalated)
          </div>
          <div style={{ borderBottom: '1px solid #000', marginBottom: 4 }} />
          <div style={{ fontSize: 13, fontWeight: 'bold' }}>Consulting Specialist Signature</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Reg / License No: ____________________</div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 32 }} className="no-print">
        <button
          onClick={() => window.print()}
          style={{
            background: '#dc2626',
            color: '#fff',
            border: 'none',
            padding: '10px 24px',
            fontSize: 15,
            fontWeight: 'bold',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          🖨️ Print Foreign Body Clinical Dossier
        </button>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; }
        }
      `}</style>
    </div>
  );
};
