import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getObstetricAflpEpisode, ObstetricAflpRecord, ObstetricAflpFlowsheetRecord } from '../api';

export const ObstetricAflpPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<ObstetricAflpRecord | null>(null);
  const [logs, setLogs] = useState<ObstetricAflpFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getObstetricAflpEpisode(Number(id))
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
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Obstetric High Dependency & Critical Care</h2>
          <h3 style={{ margin: '4px 0 0', color: '#b91c1c' }}>Acute Fatty Liver of Pregnancy (AFLP) Emergency Dossier</h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: Swansea Diagnostic Criteria (Gut 2002; RCOG & EASL Guidelines)
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
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Diagnosis Date:</strong> {new Date(episode.diagnosis_datetime).toLocaleDateString()}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Gestational Age:</strong> {episode.gestation_weeks} weeks</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Swansea Criteria:</strong> {episode.total_swansea_criteria_met} of 14 Met</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Diagnostic Status:</strong>{' '}
              <span style={{ color: episode.aflp_confirmed ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>
                {episode.aflp_confirmed ? 'AFLP CONFIRMED' : 'AFLP UNLIKELY'}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Swansea Checklist Matrix */}
      {evalResult?.criteriaBreakdown && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Swansea 14-Criteria Evaluation</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Criterion #</th>
                <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Diagnostic Parameter</th>
                <th style={{ padding: 6, border: '1px solid #cbd5e1', width: 90 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {evalResult.criteriaBreakdown.map((c: any, idx: number) => (
                <tr key={c.key} style={{ background: c.met ? '#fef2f2' : '#fff' }}>
                  <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{idx + 1}</td>
                  <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{c.label}</td>
                  <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 'bold', color: c.met ? '#dc2626' : '#64748b' }}>
                    {c.met ? 'POSITIVE' : 'Negative'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Emergency Management Directives */}
      <div style={{ background: '#fef2f2', borderLeft: '4px solid #dc2626', padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#b91c1c' }}>EMERGENCY OBSTETRIC DIRECTIVES</h4>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{evalResult?.deliveryRecommendation}</p>
        <p style={{ margin: '0 0 8px 0', fontSize: 14 }}><strong>Glycemic Protocol:</strong> {evalResult?.hypoglycemiaProtocol}</p>
        <p style={{ margin: '0 0 8px 0', fontSize: 14 }}><strong>Coagulopathy:</strong> {evalResult?.coagulopathyManagement}</p>
        <div style={{ padding: 8, background: '#fee2e2', borderRadius: 4, fontWeight: 'bold', color: '#991b1b', fontSize: 13 }}>
          {evalResult?.lchadScreeningAlert}
        </div>
      </div>

      {/* Bedside Flowsheet History */}
      <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Serial Bedside Observations</h4>
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Timestamp</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Hours</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Glucose</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>D10W Rate</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>BP</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Enceph</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>INR</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Blood Products</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ padding: 12, textAlign: 'center', color: '#666' }}>No flowsheet logs recorded.</td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id}>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{new Date(log.log_datetime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>+{log.hours_from_diagnosis}h</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{log.blood_glucose_mg_dl} mg/dL</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.dextrose_infusion_rate_ml_hr} mL/hr (D{log.dextrose_concentration_percent})</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.sbp_mmhg ? `${log.sbp_mmhg}/${log.dbp_mmhg || '-'}` : '-'}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>Grade {log.encephalopathy_grade}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{log.inr ?? '-'}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.blood_products_administered || '-'}</td>
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
            Lead Obstetrician
          </div>
        </div>
        <div>
          <div style={{ borderTop: '1px solid #666', width: 220, paddingTop: 4, textAlign: 'center' }}>
            Consultant Hepatologist / ICU Lead
          </div>
        </div>
      </div>
    </div>
  );
};
