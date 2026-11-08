import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getObstetricPpromEpisode, ObstetricPpromRecord, ObstetricPpromFlowsheetRecord } from '../api';

export const ObstetricPpromPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<ObstetricPpromRecord | null>(null);
  const [logs, setLogs] = useState<ObstetricPpromFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getObstetricPpromEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: 32 }}>Loading printable PPROM dossier...</div>;
  if (!episode) return <div style={{ padding: 32 }}>Episode not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Obstetric Critical Care & Maternal-Fetal Medicine</h2>
          <h3 style={{ margin: '4px 0 0', color: '#991b1b' }}>Preterm Premature Rupture of Membranes (PPROM) & Triple I Dossier</h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: ACOG Practice Bulletin No. 217 / SMFM / NICHD Triple I Criteria
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
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Gestation:</strong> {episode.gestation_weeks} weeks</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Rupture Date/Time:</strong> {new Date(episode.rupture_datetime).toLocaleString()}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Presentation Date/Time:</strong> {new Date(episode.presentation_datetime).toLocaleString()}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Confirmation:</strong> {episode.rupture_confirmation_method.replace(/_/g, ' ')}</td>
          </tr>
        </tbody>
      </table>

      {/* Triple I Surveillance & Staging */}
      <div style={{ background: episode.triple_i_category.includes('triple_i') ? '#fef2f2' : '#eff6ff', borderLeft: `4px solid ${episode.triple_i_category.includes('triple_i') ? '#dc2626' : '#3b82f6'}`, padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: episode.triple_i_category.includes('triple_i') ? '#991b1b' : '#1e40af' }}>
          Intra-Amniotic Infection (Triple I) Staging & Delivery Strategy
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Triple I Category</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: episode.triple_i_category.includes('triple_i') ? '#b91c1c' : '#1e40af' }}>
              {episode.triple_i_category.replace(/_/g, ' ').toUpperCase()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Maternal Temp / HR</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: episode.maternal_temperature_celsius >= 38.0 ? '#dc2626' : 'inherit' }}>
              {episode.maternal_temperature_celsius}°C / {episode.maternal_heart_rate_bpm} bpm
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Fetal Heart Rate</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: episode.fetal_heart_rate_bpm > 160 ? '#dc2626' : 'inherit' }}>
              {episode.fetal_heart_rate_bpm} bpm
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Delivery Timing Plan</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: episode.triple_i_category.includes('triple_i') ? '#dc2626' : '#15803d' }}>
              {episode.delivery_timing_plan.replace(/_/g, ' ').toUpperCase()}
            </div>
          </div>
        </div>

        {evalResult && (
          <div style={{ marginTop: 12, fontSize: 14, color: '#334155' }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 'bold' }}>{evalResult.summary}</p>
            <p style={{ margin: 0, fontSize: 13 }}>
              <strong>Management Directive:</strong> {evalResult.deliveryTimingGuidance}
            </p>
          </div>
        )}
      </div>

      {/* Pharmacotherapy & Latency Orders */}
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Pharmacotherapy / Protocol</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Selected Status</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>ACOG Practice Bulletin 217 Protocol</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Latency Antibiotic Regimen</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{episode.latency_antibiotic_regimen.replace(/_/g, ' ').toUpperCase()}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              7-Day Protocol: IV Ampicillin (2g q6h) + Oral Azithromycin (1g) x 48h, followed by Oral Amoxicillin (500mg q8h) for 5 days.
            </td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Antenatal Corticosteroids</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{episode.antenatal_corticosteroid_status.replace(/_/g, ' ').toUpperCase()}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Betamethasone 12 mg IM q24h for 2 doses indicated for 24+0 to 33+6 weeks.</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>MgSO4 Fetal Neuroprotection</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{episode.mgso4_neuroprotection_active ? 'ACTIVE' : 'Not Active'}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Indicated if delivery is imminent or anticipated before 32 weeks of gestation.</td>
          </tr>
        </tbody>
      </table>

      {/* Bedside Flowsheet */}
      <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Bedside Latency & Infection Surveillance Flowsheet
      </h4>
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Time (+hrs)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Maternal Temp</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Maternal HR</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>BP</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>FHR (bpm)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Fluid Character</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>CTG Category</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Logged By</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
                No serial flowsheet checkpoints logged.
              </td>
            </tr>
          ) : (
            logs.map((l) => (
              <tr key={l.id}>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>+{l.hours_from_admission}h ({new Date(l.log_datetime).toLocaleTimeString()})</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 600, color: l.maternal_temp_c >= 38.0 ? '#dc2626' : 'inherit' }}>
                  {l.maternal_temp_c}°C
                </td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.maternal_hr_bpm}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.maternal_bp_sbp}/{l.maternal_bp_dbp}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 600, color: l.fetal_hr_bpm > 160 ? '#dc2626' : 'inherit' }}>
                  {l.fetal_hr_bpm}
                </td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.amniotic_fluid_character}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.ctg_category.replace(/_/g, ' ')}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.logged_by_name || 'Staff Nurse'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Clinical Notes */}
      {episode.clinical_notes && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: 12, marginBottom: 24, background: '#f8fafc' }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 4 }}>CLINICAL NOTES & DISPOSITION PLAN</div>
          <div style={{ fontSize: 14 }}>{episode.clinical_notes}</div>
        </div>
      )}

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, paddingTop: 16, borderTop: '1px dashed #cbd5e1' }}>
        <div>
          <div style={{ fontSize: 13, color: '#666' }}>Managing Obstetrician:</div>
          <div style={{ marginTop: 24, borderTop: '1px solid #333', width: 220, textAlign: 'center', fontSize: 13, paddingTop: 4 }}>
            {episode.consultant_name || 'Attending Obstetrician'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: '#666' }}>Maternal-Fetal Medicine Sign-Off:</div>
          <div style={{ marginTop: 24, borderTop: '1px solid #333', width: 220, textAlign: 'center', fontSize: 13, paddingTop: 4 }}>
            MFM Consultant
          </div>
        </div>
      </div>
    </div>
  );
};
