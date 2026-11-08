import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getObstetricDkaEpisode, ObstetricDkaRecord, ObstetricDkaFlowsheetRecord } from '../api';

export const ObstetricDkaPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<ObstetricDkaRecord | null>(null);
  const [logs, setLogs] = useState<ObstetricDkaFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getObstetricDkaEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: 32 }}>Loading printable obstetric DKA dossier...</div>;
  if (!episode) return <div style={{ padding: 32 }}>Episode not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Obstetric Critical Care & Maternal-Fetal Medicine</h2>
          <h3 style={{ margin: '4px 0 0', color: '#991b1b' }}>Obstetric DKA & Euglycemic Acidosis Resuscitation Dossier</h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: ACOG Practice Bulletin / Sibai & Viteri Protocol
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
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Presentation:</strong> {new Date(episode.presentation_datetime).toLocaleString()}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Gestation:</strong> {episode.gestation_weeks} weeks</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Diabetes Type:</strong> {episode.diabetes_type.replace(/_/g, ' ').toUpperCase()}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Trigger:</strong> {episode.precipitating_trigger.replace(/_/g, ' ').toUpperCase()}</td>
          </tr>
        </tbody>
      </table>

      {/* Acid-Base & Metabolic Summary */}
      <div style={{ background: '#fef2f2', borderLeft: '4px solid #dc2626', padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#991b1b' }}>
          Biochemical & Anion Gap Staging
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Blood Glucose</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: episode.is_euglycemic_dka ? '#c2410c' : '#b91c1c' }}>
              {episode.blood_glucose_mg_dl} mg/dL
            </div>
            {episode.is_euglycemic_dka ? <span className="badge badge-warning" style={{ fontSize: 11 }}>EUGLYCEMIC DKA</span> : null}
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Venous / Arterial pH</div>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>{episode.arterial_or_venous_ph}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Serum HCO3</div>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>{episode.serum_bicarbonate_meq_l} mEq/L</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Anion Gap</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: episode.calculated_anion_gap > 12 ? '#dc2626' : '#16a34a' }}>
              {episode.calculated_anion_gap} mEq/L
            </div>
          </div>
        </div>

        {evalResult && (
          <div style={{ marginTop: 12, fontSize: 14, color: '#334155' }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 'bold' }}>{evalResult.severityLabel}</p>
            <p style={{ margin: '0 0 6px 0' }}>{evalResult.summary}</p>
            <div className="alert alert-warning" style={{ margin: 0, padding: 8, fontSize: 13 }}>
              {evalResult.fetalResuscitationGuidance}
            </div>
          </div>
        )}
      </div>

      {/* Resuscitation Regimens */}
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Parameter / Protocol</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Target / Infusion Rate</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Clinical Guideline</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Regular Insulin IV Infusion</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{episode.insulin_infusion_rate_units_hr} units/hr</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Weight-based titration (0.1 U/kg/hr, or 0.05 U/kg/hr if euglycemic). Target glucose drop 50-75 mg/dL/hr.</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>IV Fluid Replacement</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>1000 mL bolus, then 250-500 mL/hr</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Isotonic saline/Plasmalyte. Add D5W/D10W when glucose &lt; 200 mg/dL to maintain insulin infusion for anion gap closure.</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Potassium Management</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Target K+ 4.0 - 5.0 mEq/L</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{evalResult?.potassiumReplacementAdvice}</td>
          </tr>
        </tbody>
      </table>

      {/* Bedside Flowsheet */}
      <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Bedside Glycemic & Fetal Heart Rate Surveillance Log
      </h4>
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Time (+hrs)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Glucose</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Insulin</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>IV Fluid</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>pH / HCO3</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Anion Gap</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>K+</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>FHR Baseline</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Logged By</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
                No serial flowsheet checkpoints logged.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id}>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>+{log.hours_from_presentation}h</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 600 }}>{log.blood_glucose_mg_dl} mg/dL</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.insulin_rate_units_hr} U/h</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.iv_fluid_rate_ml_hr} mL/h</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.vbg_ph ?? '-'} / {log.serum_bicarbonate_meq_l ?? '-'}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 600, color: (log.calculated_anion_gap ?? 0) <= 12 ? '#16a34a' : '#dc2626' }}>
                  {log.calculated_anion_gap ?? '-'}
                </td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.serum_potassium_meq_l}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.fhr_baseline_bpm ? `${log.fhr_baseline_bpm} bpm` : '-'}</td>
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
          <div><strong>Consultant Obstetrician / MFM Specialist:</strong> {episode.consultant_name || 'Attending Physician'}</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Department of Obstetrics & Maternal-Fetal Medicine</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ borderBottom: '1px solid #333', width: 220, marginBottom: 4, height: 28 }}></div>
          <div style={{ fontSize: 12, color: '#666' }}>Attending Signature & Date</div>
        </div>
      </div>
    </div>
  );
};
