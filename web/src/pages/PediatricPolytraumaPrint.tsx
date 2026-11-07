import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPediatricPolytraumaEpisode, PediatricPolytraumaRecord, PediatricPolytraumaFlowsheetRecord } from '../api';

export const PediatricPolytraumaPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<PediatricPolytraumaRecord | null>(null);
  const [logs, setLogs] = useState<PediatricPolytraumaFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getPediatricPolytraumaEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult((res as any).evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: 32 }}>Loading printable trauma resuscitation dossier...</div>;
  if (!episode) return <div style={{ padding: 32 }}>Trauma activation episode not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Emergency Trauma Center / PICU</h2>
          <h3 style={{ margin: '4px 0 0', color: '#b91c1c' }}>Pediatric Polytrauma Resuscitation & PTS Dossier</h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: ACS-COT / ATLS 10th Edition / Tepas et al. Pediatric Trauma Score Protocol
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
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Trauma Datetime:</strong> {new Date(episode.trauma_datetime).toLocaleString()}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Age:</strong> {episode.age_months} months</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Body Weight:</strong> {episode.weight_kg} kg</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Mechanism:</strong> {episode.trauma_mechanism.replace(/_/g, ' ').toUpperCase()}</td>
          </tr>
        </tbody>
      </table>

      {/* PTS Scoring Summary */}
      <div style={{ background: '#fef2f2', borderLeft: '4px solid #dc2626', padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#991b1b' }}>
          Pediatric Trauma Score (PTS) Assessment
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Total PTS Score</div>
            <div style={{ fontSize: 22, fontWeight: 'bold', color: episode.total_pts_score <= 8 ? '#dc2626' : '#059669' }}>
              {episode.total_pts_score > 0 ? `+${episode.total_pts_score}` : episode.total_pts_score} / 12
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Mortality Risk Tier</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {episode.pts_mortality_tier.replace(/_/g, ' ').toUpperCase()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>FAST Exam</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: episode.fast_exam_positive ? '#dc2626' : '#16a34a' }}>
              {episode.fast_exam_positive ? 'POSITIVE' : 'NEGATIVE'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Pelvic Binder</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {episode.pelvic_binder_placed ? 'PLACED' : 'NOT PLACED'}
            </div>
          </div>
        </div>

        {/* Component breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginTop: 14, background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #fca5a5', textAlign: 'center', fontSize: 12 }}>
          <div><strong>Weight:</strong> {episode.weight_score > 0 ? `+${episode.weight_score}` : episode.weight_score}</div>
          <div><strong>Airway:</strong> {episode.airway_score > 0 ? `+${episode.airway_score}` : episode.airway_score}</div>
          <div><strong>SBP:</strong> {episode.systolic_bp_score > 0 ? `+${episode.systolic_bp_score}` : episode.systolic_bp_score}</div>
          <div><strong>CNS:</strong> {episode.cns_score > 0 ? `+${episode.cns_score}` : episode.cns_score}</div>
          <div><strong>Skeletal:</strong> {episode.skeletal_score > 0 ? `+${episode.skeletal_score}` : episode.skeletal_score}</div>
          <div><strong>Cutaneous:</strong> {episode.cutaneous_score > 0 ? `+${episode.cutaneous_score}` : episode.cutaneous_score}</div>
        </div>

        {evalResult && (
          <div style={{ marginTop: 12, fontSize: 14, color: '#334155' }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 'bold' }}>{evalResult.tierLabel} ({evalResult.mortalityEstimate})</p>
            {evalResult.traumaCenterLevel1Mandatory && (
              <p style={{ margin: '0 0 6px 0', color: '#b91c1c', fontWeight: 'bold' }}>
                🚨 Immediate Level 1 Pediatric Trauma Center & Pediatric Surgery activation mandatory.
              </p>
            )}
            <p style={{ margin: 0 }}>{evalResult.hypothermiaPreventionAlert}</p>
          </div>
        )}
      </div>

      {/* Resuscitation Regimens & Transfusion Parameters */}
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Parameter / Regimen</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Administered / Target</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Weight-Adjusted Dosing Guideline</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Initial Isotonic Crystalloid</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              {evalResult ? `${evalResult.initialCrystalloidBolusMl} mL` : `${episode.weight_kg * 20} mL`}
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>20 mL/kg Plasmalyte or Normal Saline bolus over 10-15 min</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Pediatric MTP Activation</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              {episode.pediatric_mtp_activated ? 'ACTIVATED' : 'Not Activated'}
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              PRBC {episode.prbc_volume_ml} mL | FFP {episode.ffp_volume_ml} mL | Platelets {episode.platelets_volume_ml} mL (1:1:1 balanced ratio)
            </td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Tranexamic Acid (TXA)</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              {episode.txa_administered ? `${episode.txa_dose_mg || 0} mg given` : 'Not Administered'}
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              Loading: {evalResult?.txaLoadingDoseMg || Math.min(1000, Math.round(episode.weight_kg * 20))} mg IV over 10 min, then {evalResult?.txaMaintenanceDoseMgHr || Math.round(episode.weight_kg * 2)} mg/hr over 8 hrs
            </td>
          </tr>
        </tbody>
      </table>

      {/* Bedside Resuscitation Flowsheet */}
      <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Bedside Resuscitation Vital Signs & Fluid Log
      </h4>
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Time (+min)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>GCS</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>BP</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>HR / RR</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>SpO2 / Temp</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Crystalloid</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>PRBC / FFP / Plt</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Pupils</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Logged By</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
                No vital signs or resuscitation checkpoints logged.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id}>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>
                  +{log.minutes_from_arrival}m ({new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                </td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 600 }}>{log.gcs_total}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.sbp_mmhg} / {log.dbp_mmhg ?? '-'}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.heart_rate_bpm} / {log.respiratory_rate}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.spo2_percent}% / {log.temperature_celsius}°C</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.cumulative_crystalloid_ml} mL</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.cumulative_prbc_ml} / {log.cumulative_ffp_ml} / {log.cumulative_platelets_ml} mL</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{log.pupil_status.replace(/_/g, ' ')}</td>
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
          <div><strong>Trauma Team Leader:</strong> {episode.consultant_name || 'Attending Physician'}</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Department of Pediatric Emergency Medicine / Surgery</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ borderBottom: '1px solid #333', width: 220, marginBottom: 4, height: 28 }}></div>
          <div style={{ fontSize: 12, color: '#666' }}>Attending Signature & Date</div>
        </div>
      </div>
    </div>
  );
};
