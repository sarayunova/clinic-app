import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getNeonatalIvhEpisode, NeonatalIvhRecord, NeonatalIvhFlowsheetRecord } from '../api';

export const NeonatalIvhPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<NeonatalIvhRecord | null>(null);
  const [logs, setLogs] = useState<NeonatalIvhFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getNeonatalIvhEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: 32 }}>Loading printable IVH dossier...</div>;
  if (!episode) return <div style={{ padding: 32 }}>Episode not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Neonatal Intensive Care & Pediatric Neurosurgery</h2>
          <h3 style={{ margin: '4px 0 0', color: '#1e3a8a' }}>Intraventricular Hemorrhage (IVH) & Levene PHH Clinical Dossier</h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: Papile / Volpe Ultrasound Staging & Levene Ventricular Curve (ELVIS Protocol)
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
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Scan Date:</strong> {new Date(episode.scan_datetime).toLocaleString()}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Birth GA:</strong> {episode.gestational_age_weeks} weeks</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Birth Weight:</strong> {episode.birth_weight_grams} g</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Age / PMA:</strong> Day {episode.chronological_age_days} ({episode.current_pma_weeks}w PMA)</td>
          </tr>
          <tr>
            <td colSpan={3} style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Clinical Indication:</strong> {episode.cranial_ultrasound_indication}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Papile & Morphometry Summary */}
      <div style={{ background: '#eff6ff', borderLeft: '4px solid #3b82f6', padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#1e40af' }}>
          Papile Ultrasound Staging & Ventricular Morphometry
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Papile Grade</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#1e40af' }}>
              {episode.papile_grade.replace(/_/g, ' ').toUpperCase()}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{episode.hemorrhage_laterality.replace(/_/g, ' ')}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Max Ventricular Index</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: Math.max(episode.ventricular_index_left_mm, episode.ventricular_index_right_mm) >= episode.levene_action_line_threshold_mm ? '#dc2626' : '#1e40af' }}>
              {Math.max(episode.ventricular_index_left_mm, episode.ventricular_index_right_mm)} mm
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>L: {episode.ventricular_index_left_mm} | R: {episode.ventricular_index_right_mm} mm</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Davies Action Line (+4mm)</div>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>{episode.levene_action_line_threshold_mm} mm</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>97th Centile: {episode.levene_97th_percentile_mm} mm</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>PHH Status</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: episode.phh_intervention_threshold_crossed ? '#dc2626' : '#16a34a' }}>
              {episode.phh_intervention_threshold_crossed ? 'ACTION LINE CROSSED' : 'STABLE SURVEILLANCE'}
            </div>
          </div>
        </div>

        {evalResult && (
          <div style={{ marginTop: 12, fontSize: 14, color: '#334155' }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 'bold' }}>{evalResult.summary}</p>
            <p style={{ margin: 0, fontSize: 13 }}>
              <strong>Neurosurgical Guidance:</strong> {evalResult.interventionGuidance}
            </p>
          </div>
        )}
      </div>

      {/* Intervention & Shunt Table */}
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Modality / Parameter</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Clinical Finding</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Protocol Guideline & Readiness Criteria</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Active Intervention</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{episode.intervention_status.replace(/_/g, ' ').toUpperCase()}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Reservoir aspiration (10-15 mL/kg) or Subgaleal shunt if weight &lt; 2000g; permanent VP shunt once CSF protein &lt; 1.5 g/L and weight &gt; 2.0 kg.</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Head Circumference</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{episode.head_circumference_cm} cm (Growth: {episode.head_circumference_growth_cm_week} cm/wk)</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Growth velocity &gt; 1.5 cm/week indicates excessive post-hemorrhagic expansion.</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>CSF Protein & RBCs</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              Protein: {episode.csf_protein_g_l !== null ? `${episode.csf_protein_g_l} g/L` : 'N/A'} | RBCs: {episode.csf_rbc_count ?? 'N/A'}
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Target CSF protein &lt; 1.5 g/L is required to prevent distal VP shunt catheter occlusion.</td>
          </tr>
        </tbody>
      </table>

      {/* Bedside Flowsheet */}
      <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Bedside Cranial Ultrasound & Decompression Flowsheet
      </h4>
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Date / Day</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>VI (mm)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>AHW (mm)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>HC (cm)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Fontanelle</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>CSF Tapped</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Apneas</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Logged By</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
                No serial cranial ultrasound flowsheet checkpoints logged.
              </td>
            </tr>
          ) : (
            logs.map((l) => (
              <tr key={l.id}>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{new Date(l.log_datetime).toLocaleDateString()} (+{l.days_from_baseline}d)</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 600, color: l.ventricular_index_mm >= episode.levene_action_line_threshold_mm ? '#dc2626' : 'inherit' }}>
                  {l.ventricular_index_mm} mm
                </td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.anterior_horn_width_mm} mm</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.head_circumference_cm} cm</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.fontanelle_tension}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{l.csf_volume_tapped_ml} mL</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.apneic_episodes_24h}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.logged_by_name || 'Staff Nurse'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Clinical Notes */}
      {episode.clinical_notes && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: 12, marginBottom: 24, background: '#f8fafc' }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 4 }}>CLINICAL NOTES & NEUROSURGERY STRATEGY</div>
          <div style={{ fontSize: 14 }}>{episode.clinical_notes}</div>
        </div>
      )}

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, paddingTop: 16, borderTop: '1px dashed #cbd5e1' }}>
        <div>
          <div style={{ fontSize: 13, color: '#666' }}>Consultant Neonatologist:</div>
          <div style={{ marginTop: 24, borderTop: '1px solid #333', width: 220, textAlign: 'center', fontSize: 13, paddingTop: 4 }}>
            {episode.consultant_name || 'Attending Neonatologist'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: '#666' }}>Pediatric Neurosurgeon Sign-Off:</div>
          <div style={{ marginTop: 24, borderTop: '1px solid #333', width: 220, textAlign: 'center', fontSize: 13, paddingTop: 4 }}>
            Consultant Pediatric Neurosurgeon
          </div>
        </div>
      </div>
    </div>
  );
};
