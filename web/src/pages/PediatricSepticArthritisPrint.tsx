import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPediatricSepticArthritisEpisode, PediatricSepticArthritisRecord, PediatricSepticArthritisFlowsheetRecord } from '../api';

export const PediatricSepticArthritisPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<PediatricSepticArthritisRecord | null>(null);
  const [logs, setLogs] = useState<PediatricSepticArthritisFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getPediatricSepticArthritisEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: 32 }}>Loading printable septic arthritis dossier...</div>;
  if (!episode) return <div style={{ padding: 32 }}>Episode not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1, color: '#b91c1c' }}>
            Pediatric Orthopedic Surgery &amp; Infectious Disease
          </h2>
          <h3 style={{ margin: '4px 0 0', color: '#111' }}>
            Septic Arthritis &amp; Kocher Criteria Diagnostic Clinical Dossier
          </h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: Kocher MS et al. (J Bone Joint Surg Am) &amp; AAP Pediatric Musculoskeletal Infection Guidelines
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
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Evaluated:</strong> {new Date(episode.evaluation_datetime).toLocaleString()}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Age:</strong> {episode.age_months} months</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Weight:</strong> {episode.weight_kg} kg</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Affected Joint:</strong> {episode.affected_joint.replace(/_/g, ' ').toUpperCase()}
            </td>
          </tr>
          <tr>
            <td colSpan={3} style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Clinical Status:</strong> {episode.status.replace(/_/g, ' ').toUpperCase()} | <strong>Consultant:</strong> {episode.consultant_name || 'Pediatric Orthopedic Surgeon'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Kocher Criteria Box */}
      <div style={{ background: '#fef2f2', borderLeft: '4px solid #b91c1c', padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#991b1b' }}>
          The 4 Kocher Clinical &amp; Laboratory Predictors
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Weight-Bearing</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: episode.non_weight_bearing ? '#dc2626' : '#16a34a' }}>
              {episode.non_weight_bearing ? 'REFUSAL / ANTALGIC' : 'Full Weight-Bearing'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Criterion 1 (+1)</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Fever (&gt; 38.5°C)</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: episode.temperature_celsius > 38.5 ? '#dc2626' : '#16a34a' }}>
              {episode.temperature_celsius}°C ({episode.temperature_celsius > 38.5 ? 'YES' : 'No'})
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Criterion 2 (+1)</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>ESR (≥ 40 mm/hr)</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: episode.esr_mm_hr >= 40 ? '#dc2626' : '#16a34a' }}>
              {episode.esr_mm_hr} mm/hr ({episode.esr_mm_hr >= 40 ? 'YES' : 'No'})
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Criterion 3 (+1)</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>WBC (&gt; 12,000 /μL)</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: episode.wbc_count_per_microliter > 12000 ? '#dc2626' : '#16a34a' }}>
              {episode.wbc_count_per_microliter} /μL ({episode.wbc_count_per_microliter > 12000 ? 'YES' : 'No'})
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Criterion 4 (+1)</div>
          </div>
        </div>
      </div>

      {/* Algorithmic Clinical Guidance */}
      {evalResult && (
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: 16, marginBottom: 24, borderRadius: 4 }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>Kocher Statistical Risk &amp; Pediatric Orthopedic Guidance</h4>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 'bold', color: '#b91c1c' }}>Kocher Score: </span>
            <span style={{ fontWeight: 'bold', fontSize: 16 }}>{evalResult.kocherResult.criteriaMetCount} / 4 Criteria Met</span>
            <span style={{ marginLeft: 16, fontWeight: 'bold', color: '#0369a1' }}>Probability of Septic Arthritis: </span>
            <span style={{ fontWeight: 'bold', fontSize: 16 }}>{evalResult.kocherResult.predictedProbabilityPercent}%</span>
          </div>

          <div style={{ background: '#fff', padding: 12, border: '1px solid #e2e8f0', borderRadius: 4, marginBottom: 12 }}>
            <div style={{ fontWeight: 'bold', color: '#b91c1c', marginBottom: 4 }}>Orthopedic Consultation Urgency:</div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              {evalResult.orthopedicConsultUrgency.replace(/_/g, ' ').toUpperCase()} — {evalResult.kocherResult.probabilityLabel}
            </div>
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
              <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, color: '#0369a1' }}>Safety &amp; AVN Prevention Directives:</div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.4 }}>
                {evalResult.clinicalSafetyDirectives.map((dir: string, idx: number) => (
                  <li key={idx}>{dir}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Ultrasound, Arthrocentesis & Surgical Details */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
          Diagnostic Joint Aspiration &amp; Operative Management
        </h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <tbody>
            <tr>
              <td style={{ padding: '6px 8px', width: '30%', color: '#64748b' }}>Hip/Joint Ultrasound:</td>
              <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>
                {episode.ultrasound_effusion_detected ? 'Capsular Effusion Detected (> 2 mm asymmetry)' : 'No Significant Effusion'}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', color: '#64748b' }}>Synovial Fluid Findings:</td>
              <td style={{ padding: '6px 8px' }}>
                {episode.arthrocentesis_performed ? (
                  <span>
                    WBC: {episode.synovial_wbc_count ?? '-'} /μL | PMN: {episode.synovial_pmb_pct ?? '-'}% | Gram Stain: {episode.synovial_gram_stain.replace(/_/g, ' ')}
                  </span>
                ) : (
                  'Arthrocentesis not performed / deferred'
                )}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', color: '#64748b' }}>Surgical Approach:</td>
              <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>
                {episode.surgical_approach.replace(/_/g, ' ')} {episode.surgical_drainage_required ? '(Urgent Drainage)' : ''}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', color: '#64748b' }}>Empiric Antibiotics:</td>
              <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>
                {episode.empiric_antibiotic_regimen.replace(/_/g, ' ')}
              </td>
            </tr>
            {episode.clinical_notes && (
              <tr>
                <td style={{ padding: '6px 8px', color: '#64748b' }}>Clinical Summary &amp; Notes:</td>
                <td style={{ padding: '6px 8px', fontStyle: 'italic' }}>{episode.clinical_notes}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Flowsheet Log Table */}
      <div style={{ marginBottom: 32 }}>
        <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: 4 }}>
          Serial Joint Examination, ROM &amp; Drain Surveillance ({logs.length})
        </h4>
        {logs.length === 0 ? (
          <div style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic', padding: 8 }}>
            No serial flowsheet entries logged.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: 6, textAlign: 'left' }}>Time</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Hours</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Temp</th>
                <th style={{ padding: 6, textAlign: 'left' }}>HR</th>
                <th style={{ padding: 6, textAlign: 'left' }}>CRP</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Range of Motion</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Weight-Bearing</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Drain (mL)</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Logged By</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Observations</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: 6 }}>{new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ padding: 6 }}>+{log.hours_from_triage}h</td>
                  <td style={{ padding: 6 }}>{log.temperature_celsius}°C</td>
                  <td style={{ padding: 6 }}>{log.heart_rate_bpm}</td>
                  <td style={{ padding: 6 }}>{log.crp_mg_l ?? '-'}</td>
                  <td style={{ padding: 6 }}>{log.joint_range_of_motion.replace(/_/g, ' ')}</td>
                  <td style={{ padding: 6 }}>{log.weight_bearing_ability.replace(/_/g, ' ')}</td>
                  <td style={{ padding: 6 }}>{log.drain_output_ml_24h}</td>
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
            Attending Pediatric Orthopedic Surgeon
          </div>
          <div style={{ borderBottom: '1px solid #000', marginBottom: 4 }} />
          <div style={{ fontSize: 13, fontWeight: 'bold' }}>{episode.consultant_name || 'Orthopedic Surgeon'}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Date &amp; Time: ________________________</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 28 }}>
            Pediatric Infectious Disease Specialist
          </div>
          <div style={{ borderBottom: '1px solid #000', marginBottom: 4 }} />
          <div style={{ fontSize: 13, fontWeight: 'bold' }}>Consultant Signature</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Reg / License No: ____________________</div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 32 }} className="no-print">
        <button
          onClick={() => window.print()}
          style={{
            background: '#b91c1c',
            color: '#fff',
            border: 'none',
            padding: '10px 24px',
            fontSize: 15,
            fontWeight: 'bold',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          🖨️ Print Septic Arthritis Clinical Dossier
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
