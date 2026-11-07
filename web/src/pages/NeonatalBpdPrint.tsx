import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getNeonatalBpdEpisode, NeonatalBpdRecord, NeonatalBpdFlowsheetRecord } from '../api';

export const NeonatalBpdPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<NeonatalBpdRecord | null>(null);
  const [logs, setLogs] = useState<NeonatalBpdFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getNeonatalBpdEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: 32 }}>Loading printable clinical dossier...</div>;
  if (!episode) return <div style={{ padding: 32 }}>Episode not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Neonatal Intensive Care Unit (NICU)</h2>
          <h3 style={{ margin: '4px 0 0', color: '#2c3e50' }}>Bronchopulmonary Dysplasia (BPD) & Jensen Staging Dossier</h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: Jensen et al. NEJM 2019 / NICHD Neonatal Research Network Protocol
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
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Patient MRN:</strong> {episode.patient_number || 'N/A'}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Evaluation Date:</strong> {new Date(episode.evaluation_datetime).toLocaleDateString()}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Birth GA:</strong> {episode.gestational_age_weeks} weeks</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Birth Weight:</strong> {episode.birth_weight_grams} grams</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Current PMA:</strong> {episode.current_pma_weeks} weeks</td>
          </tr>
        </tbody>
      </table>

      {/* Staging Summary */}
      <div style={{ background: '#f1f5f9', borderLeft: '4px solid #2563eb', padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Jensen 2019 Diagnostic Staging</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Assigned Grade</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1e40af' }}>
              {episode.jensen_bpd_grade.toUpperCase().replace('_', ' ')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Respiratory Support</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {episode.respiratory_support_type.replace(/_/g, ' ').toUpperCase()}
              {episode.cannula_flow_lpm > 0 && ` (${episode.cannula_flow_lpm} L/min)`}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Target SpO2 Range</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>91% - 95% (AAP NeOProM)</div>
          </div>
        </div>
        {evalResult && (
          <div style={{ marginTop: 12, fontSize: 14, color: '#334155' }}>
            <p style={{ margin: '0 0 6px 0' }}>{evalResult.severitySummary}</p>
            <p style={{ margin: 0 }}><strong>Caffeine & Weaning:</strong> {evalResult.caffeineRecommendation}</p>
          </div>
        )}
      </div>

      {/* Active Pharmacotherapy */}
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Therapy Modality</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Active Status</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Clinical Guidance / Regimen</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Caffeine Citrate</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{episode.caffeine_therapy_active ? 'YES' : 'NO'}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Discontinue if &ge; 34-36w PMA and &ge; 5-7 days apnea free</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Diuretic Therapy</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{episode.diuretic_therapy_active ? 'YES' : 'NO'}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Monitor serum electrolytes & urinary calcium/creatinine ratio</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Postnatal Steroids</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{episode.postnatal_steroids_active ? 'YES' : 'NO'}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{episode.steroid_regimen || 'DART Protocol (low-dose dexamethasone taper)'}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Home Oxygen Discharge Plan</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{episode.home_oxygen_planned ? 'YES' : 'NO'}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Family pulse oximeter training & Palivizumab immunoprophylaxis</td>
          </tr>
        </tbody>
      </table>

      {/* Bedside Flowsheet History */}
      <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Serial Bedside Observations</h4>
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Timestamp</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>PMA</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Support</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>FiO2</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>SpO2</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Target Met?</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>A/B Spells</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: 12, textAlign: 'center', color: '#666' }}>No flowsheet logs recorded.</td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id}>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{new Date(log.log_datetime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.pma_weeks}w</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.respiratory_support}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.fio2_percent}%</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{log.spo2_percent}%</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.target_spo2_in_range ? 'YES' : 'NO'}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.apnea_bradycardia_episodes_24h}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.notes || '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Signatures */}
      <div style={{ marginTop: 48, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ borderTop: '1px solid #666', width: 220, paddingTop: 4, textAlign: 'center' }}>
            NICU Attending Physician
          </div>
        </div>
        <div>
          <div style={{ borderTop: '1px solid #666', width: 220, paddingTop: 4, textAlign: 'center' }}>
            Pediatric Pulmonology Consultant
          </div>
        </div>
      </div>
    </div>
  );
};
