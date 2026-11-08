import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getNeonatalHspdaEpisode, NeonatalHspdaRecord, NeonatalHspdaFlowsheetRecord } from '../api';

export const NeonatalHspdaPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<NeonatalHspdaRecord | null>(null);
  const [logs, setLogs] = useState<NeonatalHspdaFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getNeonatalHspdaEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: 32 }}>Loading printable hsPDA dossier...</div>;
  if (!episode) return <div style={{ padding: 32 }}>Episode not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Neonatal Intensive Care Unit (NICU)</h2>
          <h3 style={{ margin: '4px 0 0', color: '#1e3a8a' }}>Hemodynamically Significant PDA (hsPDA) Echocardiographic Dossier</h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: McNamara & Sehgal (2007) / El-Khuffash et al. (2015) Staging Protocol
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
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Echo Date:</strong> {new Date(episode.echo_datetime).toLocaleString()}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Birth GA:</strong> {episode.gestational_age_weeks} weeks</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Birth Weight:</strong> {episode.birth_weight_grams} g</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Age / Current Wt:</strong> Day {episode.chronological_age_days} ({episode.current_weight_grams} g)</td>
          </tr>
        </tbody>
      </table>

      {/* Echocardiographic Staging */}
      <div style={{ background: '#eff6ff', borderLeft: '4px solid #3b82f6', padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#1e40af' }}>
          McNamara & Sehgal Echocardiographic Assessment
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Transductal Diameter</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: episode.ductal_diameter_mm >= 2.0 ? '#dc2626' : '#1e40af' }}>
              {episode.ductal_diameter_mm} mm
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>LA : Ao Ratio</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: episode.la_ao_ratio >= 1.5 ? '#dc2626' : '#1e40af' }}>
              {episode.la_ao_ratio}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Aortic Flow Pattern</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {episode.descending_aorta_diastolic_flow.replace(/_/g, ' ').toUpperCase()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>hsPDA Diagnostic Status</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: episode.hspda_confirmed ? '#dc2626' : '#16a34a' }}>
              {episode.hspda_confirmed ? 'CONFIRMED' : 'NON-SIGNIFICANT'}
            </div>
          </div>
        </div>

        {evalResult && (
          <div style={{ marginTop: 12, fontSize: 14, color: '#334155' }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 'bold' }}>{evalResult.summary}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <div><strong>Echo Stage:</strong> {evalResult.echoStageLabel}</div>
              <div><strong>Clinical Stage:</strong> {evalResult.clinicalStageLabel}</div>
            </div>
            {evalResult.surgicalOrCatheterReferralIndicated && (
              <p style={{ margin: '6px 0 0 0', color: '#b91c1c', fontWeight: 'bold' }}>
                🚨 {evalResult.interventionalGuidance}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Pharmacotherapy Regimens */}
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Modality / Drug</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Selected Status</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Weight-Adjusted Regimen & Monitoring</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>IV Ibuprofen</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{episode.pharmacotherapy_selected === 'iv_ibuprofen' ? 'ACTIVE' : 'Not Selected'}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{evalResult?.ibuprofenRegimen}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>IV Paracetamol</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{episode.pharmacotherapy_selected === 'iv_paracetamol' ? 'ACTIVE' : 'Not Selected'}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{evalResult?.paracetamolRegimen}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Interventional Closure</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{episode.interventional_referral.toUpperCase()}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Catheter Piccolo device vs. surgical ligation if refractory to medical therapy</td>
          </tr>
        </tbody>
      </table>

      {/* Bedside Flowsheet */}
      <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Bedside Hemodynamic & Renal Surveillance Log
      </h4>
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Time (+hrs)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>HR</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>BP (SBP/DBP)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Pulse Pressure</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>MAP</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Ventilator / FiO2</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Urine (mL/kg/h)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Platelets</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Logged By</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
                No vital signs or hemodynamic checkpoints logged.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id}>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>+{log.hours_from_initiation}h</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.heart_rate_bpm}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.sbp_mmhg} / {log.dbp_mmhg}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 600 }}>{log.pulse_pressure_mmhg} mmHg</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.map_mmhg}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.respiratory_support_type} ({log.fio2_percent}%)</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.urine_output_ml_kg_hr ?? '-'}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.platelet_count?.toLocaleString() ?? '-'}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.logged_by_name || 'Staff'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {episode.clinical_notes && (
        <div style={{ marginBottom: 24 }}>
          <strong>Clinical Notes:</strong>
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>{episode.clinical_notes}</p>
        </div>
      )}

      {/* Signature Section */}
      <div style={{ marginTop: 40, borderTop: '1px solid #cbd5e1', paddingTop: 16, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div><strong>Consultant Neonatologist / Pediatric Cardiologist:</strong> {episode.consultant_name || 'Attending Physician'}</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Department of Neonatology & Pediatric Cardiology</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ borderBottom: '1px solid #333', width: 220, marginBottom: 4, height: 28 }}></div>
          <div style={{ fontSize: 12, color: '#666' }}>Attending Signature & Date</div>
        </div>
      </div>
    </div>
  );
};
