import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getNeonatalPolycythemiaEpisode, NeonatalPolycythemiaRecord, NeonatalPolycythemiaFlowsheetRecord } from '../api';

export const NeonatalPolycythemiaPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<NeonatalPolycythemiaRecord | null>(null);
  const [logs, setLogs] = useState<NeonatalPolycythemiaFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getNeonatalPolycythemiaEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: 32 }}>Loading printable polycythemia dossier...</div>;
  if (!episode) return <div style={{ padding: 32 }}>Episode not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1, color: '#991b1b' }}>
            Neonatal Intensive Care & Hematology
          </h2>
          <h3 style={{ margin: '4px 0 0', color: '#111' }}>
            Neonatal Polycythemia, Hyperviscosity & Partial Exchange Transfusion (PET) Dossier
          </h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: AAP Guidelines & Gomella's Neonatology (8th Ed)
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
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Diagnosis Date:</strong> {new Date(episode.diagnosis_datetime).toLocaleString()}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Gestation:</strong> {episode.gestational_age_weeks} weeks</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Birth Weight:</strong> {episode.birth_weight_grams} g</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Age:</strong> {episode.chronological_age_hours} hours | <strong>Weight:</strong> {episode.current_weight_kg} kg</td>
          </tr>
          <tr>
            <td colSpan={3} style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Sampling Site:</strong> {episode.sampling_site.replace(/_/g, ' ').toUpperCase()} | <strong>Status:</strong> {episode.status.replace(/_/g, ' ').toUpperCase()}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Hematocrit & Hyperviscosity Staging Box */}
      <div style={{ background: '#fef2f2', borderLeft: '4px solid #ef4444', padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#991b1b' }}>
          Biochemical Staging & Hyperviscosity Risk Synthesis
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Venous Hematocrit</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: episode.venous_hematocrit_pct >= 65 ? '#dc2626' : '#16a34a' }}>
              {episode.venous_hematocrit_pct}%
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Diagnostic Cutoff: ≥ 65%</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Target Hematocrit</div>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>{episode.target_hematocrit_pct}%</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Blood Vol: {episode.blood_volume_ml_kg} mL/kg</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Symptoms & Appearance</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: episode.symptoms_present ? '#dc2626' : '#16a34a' }}>
              {episode.symptoms_present ? episode.symptom_details.replace(/_/g, ' ').toUpperCase() : 'ASYMPTOMATIC'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {episode.serum_glucose_mg_dl ? `Blood Glucose: ${episode.serum_glucose_mg_dl} mg/dL` : 'No glucose logged'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>PET Recommendation</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: episode.partial_exchange_indicated ? '#dc2626' : '#16a34a' }}>
              {episode.partial_exchange_indicated ? 'PET INDICATED' : 'CONSERVATIVE HYDRATION'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {episode.exchange_volume_ml > 0 ? `Vol: ${episode.exchange_volume_ml} mL NS` : 'Close monitoring'}
            </div>
          </div>
        </div>
      </div>

      {/* Partial Exchange Transfusion Protocol Box */}
      {episode.partial_exchange_indicated ? (
        <div style={{ border: '1px solid #fecaca', borderRadius: 6, padding: 16, marginBottom: 24, background: '#fff5f5' }}>
          <h4 style={{ margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#991b1b' }}>
            Partial Exchange Transfusion (PET) Calculation & Administration Plan
          </h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #fee2e2' }}>
                <td style={{ padding: '8px 4px', fontWeight: 600, width: '30%' }}>Formula Applied:</td>
                <td style={{ padding: '8px 4px' }}>
                  Volume = [Weight ({episode.current_weight_kg} kg) × Blood Vol ({episode.blood_volume_ml_kg} mL/kg) × ({episode.venous_hematocrit_pct}% - {episode.target_hematocrit_pct}%)] ÷ {episode.venous_hematocrit_pct}%
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #fee2e2' }}>
                <td style={{ padding: '8px 4px', fontWeight: 600 }}>Total Exchange Volume:</td>
                <td style={{ padding: '8px 4px', fontSize: 16, fontWeight: 'bold', color: '#dc2626' }}>
                  {episode.exchange_volume_ml} mL Normal Saline 0.9%
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #fee2e2' }}>
                <td style={{ padding: '8px 4px', fontWeight: 600 }}>Aliquot Size & Strategy:</td>
                <td style={{ padding: '8px 4px' }}>
                  ~{episode.aliquot_size_ml} mL per pass (~5 mL/kg) administered over 2 to 4 minutes per cycle to maintain isovolemia
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px 4px', fontWeight: 600 }}>Clinical Directives:</td>
                <td style={{ padding: '8px 4px', color: '#991b1b' }}>
                  Withhold oral feeds for 4-6 hours post-PET to avoid NEC risk. Re-check venous hematocrit and blood glucose at 2 and 6 hours.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: 16, marginBottom: 24, background: '#f8fafc' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#166534' }}>Conservative Management Protocol</h4>
          <p style={{ margin: 0, fontSize: 13 }}>
            Patient does not currently meet criteria for partial exchange transfusion. Increase maintenance fluid intake by 20-30 mL/kg/day to encourage hemodilution. Re-evaluate venous hematocrit in 6 to 8 hours and monitor for developing lethargy or hypoglycemia.
          </p>
        </div>
      )}

      {/* Procedural Aliquot Flowsheet */}
      <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Procedural Aliquot Execution Log ({logs.length} entries)
      </h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
            <th style={{ padding: 6, textAlign: 'left' }}>Time / Delta</th>
            <th style={{ padding: 6, textAlign: 'center' }}>Aliquot #</th>
            <th style={{ padding: 6, textAlign: 'right' }}>Withdrawn</th>
            <th style={{ padding: 6, textAlign: 'right' }}>Infused</th>
            <th style={{ padding: 6, textAlign: 'right' }}>Cumulative</th>
            <th style={{ padding: 6, textAlign: 'center' }}>Hct (%)</th>
            <th style={{ padding: 6, textAlign: 'center' }}>HR / RR</th>
            <th style={{ padding: 6, textAlign: 'left' }}>Complications</th>
            <th style={{ padding: 6, textAlign: 'left' }}>Logged By</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ padding: 12, textAlign: 'center', color: '#64748b' }}>
                No procedural exchange aliquots logged.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: 6 }}>
                  {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (+{log.hours_from_triage}h)
                </td>
                <td style={{ padding: 6, textAlign: 'center', fontWeight: 'bold' }}>#{log.aliquot_number}</td>
                <td style={{ padding: 6, textAlign: 'right' }}>{log.volume_withdrawn_ml} mL</td>
                <td style={{ padding: 6, textAlign: 'right' }}>{log.volume_infused_ml} mL</td>
                <td style={{ padding: 6, textAlign: 'right', fontWeight: 700 }}>{log.cumulative_exchanged_ml} mL</td>
                <td style={{ padding: 6, textAlign: 'center' }}>{log.current_hematocrit_pct ? `${log.current_hematocrit_pct}%` : '-'}</td>
                <td style={{ padding: 6, textAlign: 'center' }}>{log.heart_rate_bpm} / {log.respiratory_rate}</td>
                <td style={{ padding: 6 }}>{log.adverse_events_observed.replace(/_/g, ' ')}</td>
                <td style={{ padding: 6 }}>{log.logged_by_name || 'Staff'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Attending Sign-Off */}
      <div style={{ marginTop: 40, borderTop: '1px solid #94a3b8', paddingTop: 16, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 'bold' }}>Attending Neonatologist / Pediatrician</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Dr. {episode.consultant_name || 'Designated Neonatologist'}</div>
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
            backgroundColor: '#991b1b',
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
