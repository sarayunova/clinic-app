import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getNeonatalHypomagnesemiaEpisode, NeonatalHypomagnesemiaRecord, NeonatalHypomagnesemiaFlowsheetRecord } from '../api';

export const NeonatalHypomagnesemiaPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<NeonatalHypomagnesemiaRecord | null>(null);
  const [logs, setLogs] = useState<NeonatalHypomagnesemiaFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getNeonatalHypomagnesemiaEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: 32 }}>Loading printable hypomagnesemia dossier...</div>;
  if (!episode) return <div style={{ padding: 32 }}>Episode not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1, color: '#0284c7' }}>
            Neonatal Intensive Care & Metabolic Medicine
          </h2>
          <h3 style={{ margin: '4px 0 0', color: '#111' }}>
            Neonatal Hypomagnesemia & Electrolyte-Refractory Seizures Clinical Dossier
          </h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: AAP Neonatal Guidelines & Nelson Textbook of Pediatrics (21st Ed)
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
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Onset:</strong> {new Date(episode.onset_datetime).toLocaleString()}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Gestation:</strong> {episode.gestational_age_weeks} weeks ({episode.gestational_age_weeks < 37 ? 'Preterm' : 'Term'})</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Current Weight:</strong> {episode.current_weight_kg} kg (Birth: {episode.birth_weight_grams} g)</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Age:</strong> {episode.chronological_age_hours} hours of life</td>
          </tr>
          <tr>
            <td colSpan={3} style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Clinical Status:</strong> {episode.status.replace(/_/g, ' ').toUpperCase()} | <strong>Attending:</strong> {episode.consultant_name || 'Staff Neonatologist'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Laboratory Diagnostics & Severity Box */}
      <div style={{ background: '#f0f9ff', borderLeft: '4px solid #0284c7', padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#0369a1' }}>
          Electrolyte Profiling & Neuromuscular Staging
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Serum Magnesium</div>
            <div style={{ fontSize: 22, fontWeight: 'bold', color: episode.serum_magnesium_mg_dl < 1.2 ? '#dc2626' : '#0284c7' }}>
              {episode.serum_magnesium_mg_dl} mg/dL
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Normal: 1.5 - 2.5 mg/dL</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Calcium (Total / Ionized)</div>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>
              {episode.serum_calcium_mg_dl ?? '-'} / {episode.ionized_calcium_mmol_l ? `${episode.ionized_calcium_mmol_l} mmol/L` : '-'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Refractory: {episode.calcium_refractory_tetany ? 'YES (PTH Block)' : 'No'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Neuromuscular Signs</div>
            <div style={{ fontSize: 13, fontWeight: 'bold' }}>
              {episode.neuromuscular_symptoms.replace(/_/g, ' ')}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Seizures: {episode.seizures_observed ? 'OBSERVED (+)' : 'None'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>ECG & Arrhythmia</div>
            <div style={{ fontSize: 13, fontWeight: 'bold' }}>
              {episode.ecg_abnormalities.replace(/_/g, ' ')}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Renal Impairment: {episode.renal_impairment_present ? 'YES (-50% dose)' : 'No'}
            </div>
          </div>
        </div>
      </div>

      {/* Algorithmic Clinical Guidance */}
      {evalResult && (
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: 16, marginBottom: 24, borderRadius: 4 }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>PALS / AAP Clinical Management Protocol</h4>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 'bold', color: '#0284c7' }}>Severity Classification: </span>
            <span style={{ fontWeight: 'bold' }}>{evalResult.severityLabel}</span>
            <span style={{ marginLeft: 16, fontWeight: 'bold', color: '#16a34a' }}>50% MgSO4 Bolus: </span>
            <span style={{ fontWeight: 'bold' }}>{evalResult.doseCalculation.bolusVolume50PctMl} mL ({evalResult.doseCalculation.elementalMgMg} mg)</span>
          </div>

          <div style={{ background: '#fff', padding: 12, border: '1px solid #e2e8f0', borderRadius: 4, marginBottom: 12 }}>
            <div style={{ fontWeight: 'bold', color: '#0369a1', marginBottom: 4 }}>Infusion Guidelines:</div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>{evalResult.doseCalculation.infusionInstructions}</div>
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
              <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, color: '#0369a1' }}>Toxicity Surveillance & Safety:</div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.4 }}>
                {evalResult.toxicityMonitoringAlerts.map((dir: string, idx: number) => (
                  <li key={idx}>{dir}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Pharmacotherapy Details */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
          Magnesium Sulfate Prescription & Treatment Plan
        </h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <tbody>
            <tr>
              <td style={{ padding: '6px 8px', width: '30%', color: '#64748b' }}>Ordered Bolus Dose:</td>
              <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{episode.magnesium_sulfate_bolus_ml} mL of 50% MgSO4</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', color: '#64748b' }}>Administration Route:</td>
              <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{episode.administration_route.replace(/_/g, ' ')}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', color: '#64748b' }}>Cardiopulmonary Monitoring:</td>
              <td style={{ padding: '6px 8px' }}>
                {episode.continuous_ecg_monitored ? 'Continuous ECG lead II & pulse oximetry active' : 'Standard vital sign checks'}
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
          Serial Serum Mg, DTR & Toxicity Surveillance Logs ({logs.length})
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
                <th style={{ padding: 6, textAlign: 'left' }}>Serum Mg</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Ionized Ca</th>
                <th style={{ padding: 6, textAlign: 'left' }}>HR / RR</th>
                <th style={{ padding: 6, textAlign: 'left' }}>DTR Reflexes</th>
                <th style={{ padding: 6, textAlign: 'left' }}>ECG Rhythm</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Rate (mL/h)</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Logged By</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Observations</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: 6 }}>{new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ padding: 6 }}>+{log.hours_from_onset}h</td>
                  <td style={{ padding: 6, fontWeight: 'bold' }}>{log.serum_magnesium_mg_dl ?? '-'}</td>
                  <td style={{ padding: 6 }}>{log.ionized_calcium_mmol_l ?? '-'}</td>
                  <td style={{ padding: 6 }}>{log.heart_rate_bpm} / {log.respiratory_rate}</td>
                  <td style={{ padding: 6 }}>
                    <span style={{ color: log.deep_tendon_reflexes === 'absent_areflexia_toxicity' ? '#dc2626' : '#111827', fontWeight: log.deep_tendon_reflexes === 'absent_areflexia_toxicity' ? 'bold' : 'normal' }}>
                      {log.deep_tendon_reflexes.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: 6 }}>{log.ecg_rhythm_strip.replace(/_/g, ' ')}</td>
                  <td style={{ padding: 6 }}>{log.magnesium_infusion_rate_ml_hr}</td>
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
            Attending Neonatologist / Pediatrician
          </div>
          <div style={{ borderBottom: '1px solid #000', marginBottom: 4 }} />
          <div style={{ fontSize: 13, fontWeight: 'bold' }}>{episode.consultant_name || 'Attending Physician'}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Date & Time: ________________________</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 28 }}>
            NICU Clinical Pharmacist / Charge Nurse
          </div>
          <div style={{ borderBottom: '1px solid #000', marginBottom: 4 }} />
          <div style={{ fontSize: 13, fontWeight: 'bold' }}>Verification & Double Check</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>License No: ________________________</div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 32 }} className="no-print">
        <button
          onClick={() => window.print()}
          style={{
            background: '#0284c7',
            color: '#fff',
            border: 'none',
            padding: '10px 24px',
            fontSize: 15,
            fontWeight: 'bold',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          🖨️ Print Hypomagnesemia Clinical Dossier
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
