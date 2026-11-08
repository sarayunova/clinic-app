import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPediatricSvtEpisode, PediatricSvtRecord, PediatricSvtFlowsheetRecord } from '../api';

export const PediatricSvtPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<PediatricSvtRecord | null>(null);
  const [logs, setLogs] = useState<PediatricSvtFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getPediatricSvtEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: 32 }}>Loading printable pediatric SVT resuscitation dossier...</div>;
  if (!episode) return <div style={{ padding: 32 }}>Episode not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1, color: '#dc2626' }}>
            Pediatric Emergency & Critical Care Medicine
          </h2>
          <h3 style={{ margin: '4px 0 0', color: '#111' }}>
            Supraventricular Tachycardia (SVT) & Emergency Dysrhythmia Dossier
          </h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: AHA / AAP Pediatric Advanced Life Support (PALS 2020) & PACES Guidelines
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
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Age:</strong> {episode.age_months} months ({episode.age_months < 12 ? 'Infant' : 'Child'})</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Weight:</strong> {episode.weight_kg} kg</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Status:</strong> {episode.status.replace(/_/g, ' ').toUpperCase()}</td>
          </tr>
          <tr>
            <td colSpan={3} style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Hemodynamic Stability:</strong>{' '}
              <span style={{ fontWeight: 'bold', color: episode.hemodynamic_stability === 'unstable_decompensated_shock' ? '#dc2626' : '#16a34a' }}>
                {episode.hemodynamic_stability === 'unstable_decompensated_shock' ? 'UNSTABLE DECOMPENSATED SHOCK (IMMEDIATE CARDIOVERSION)' : 'STABLE COMPENSATED PERFUSION'}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Rhythm Diagnosis & Emergency Dosing Box */}
      <div style={{ background: '#fef2f2', borderLeft: '4px solid #ef4444', padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#991b1b' }}>
          Diagnostic Rhythm Analysis & PALS Emergency Interventions
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Heart Rate</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#dc2626' }}>
              {episode.heart_rate_bpm} bpm
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Cutoff: {episode.age_months < 12 ? '≥ 220 (Infant)' : '≥ 180 (Child)'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>QRS Duration</div>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>{episode.qrs_duration_ms} ms</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{episode.qrs_morphology === 'narrow_complex_le_0_09s' ? 'Narrow (≤0.09s)' : 'Wide Aberrancy'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Adenosine 1st Dose</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1e40af' }}>{episode.adenosine_first_dose_mg} mg</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>0.1 mg/kg (max 6 mg)</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Defibrillator Energy</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b45309' }}>
              {evalResult?.initialCardioversionJoules ?? episode.synchronized_cardioversion_joules ?? Math.round(episode.weight_kg * 1.0)} Joules
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              1.0 J/kg (2nd: {evalResult?.secondCardioversionJoules ?? Math.round(episode.weight_kg * 2.0)} J)
            </div>
          </div>
        </div>

        {evalResult && (
          <div style={{ marginTop: 12, fontSize: 14, color: '#334155' }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 'bold' }}>{evalResult.summary}</p>
            <p style={{ margin: '0 0 6px 0', fontSize: 13 }}>
              <strong>Adenosine Protocol:</strong> {evalResult.adenosineAdministrationProtocol}
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>
              <strong>Cardioversion Guidance:</strong> {evalResult.cardioversionGuidance}
            </p>
          </div>
        )}
      </div>

      {/* Resuscitation Milestones Delivered */}
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Intervention Pathway</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Administered?</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Result / Clinical Response</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Vagal Maneuver ({episode.vagal_maneuver_attempted.replace(/_/g, ' ')})</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>
              {episode.vagal_maneuver_attempted !== 'none_unstable' ? 'YES' : 'NO'}
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              {episode.vagal_maneuver_successful ? '✅ Converted to Sinus Rhythm' : 'Failed / Refractory'}
            </td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Adenosine 1st Dose ({episode.adenosine_first_dose_mg} mg)</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>
              {episode.adenosine_first_dose_given ? 'YES' : 'NO'}
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              {episode.adenosine_first_dose_successful ? '✅ Converted to Sinus Rhythm' : 'Failed / Refractory'}
            </td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Adenosine 2nd Dose ({episode.adenosine_second_dose_mg} mg)</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>
              {episode.adenosine_second_dose_given ? 'YES' : 'NO'}
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              {episode.adenosine_second_dose_successful ? '✅ Converted to Sinus Rhythm' : 'Failed / Refractory'}
            </td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              Synchronized Electrical Cardioversion ({evalResult?.initialCardioversionJoules ?? episode.synchronized_cardioversion_joules ?? Math.round(episode.weight_kg * 1.0)} - {evalResult?.secondCardioversionJoules ?? Math.round(episode.weight_kg * 2.0)} J)
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>
              {episode.synchronized_cardioversion_delivered ? 'YES' : 'NO'}
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              {episode.cardioversion_successful ? '✅ Shock Converted to Sinus Rhythm' : 'Not required or Refractory'}
            </td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Maintenance Antiarrhythmic</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1', fontWeight: 'bold' }} colSpan={2}>
              {episode.maintenance_antiarrhythmic.replace(/_/g, ' ').toUpperCase()}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Bedside Flowsheet */}
      <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Bedside PALS Resuscitation Flowsheet
      </h4>
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Time (+Mins)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Heart Rate</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Rhythm State</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>BP (mmHg)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>CRT / SpO2</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Intervention</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Notes</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Logged By</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
                No serial flowsheet checkpoints logged during resuscitation.
              </td>
            </tr>
          ) : (
            logs.map((l) => (
              <tr key={l.id}>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>
                  {new Date(l.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (+{l.minutes_from_triage}m)
                </td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 600, color: l.heart_rate_bpm >= 200 ? '#dc2626' : '#16a34a' }}>
                  {l.heart_rate_bpm} bpm
                </td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.rhythm_state.replace(/_/g, ' ')}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.sbp_mmhg} {l.dbp_mmhg ? `/ ${l.dbp_mmhg}` : ''}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.capillary_refill_seconds}s | {l.spo2_percent}%</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{l.intervention_administered.replace(/_/g, ' ')}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.notes || '—'}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.logged_by_name || 'Code Team Nurse'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Clinical Notes */}
      {episode.clinical_notes && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: 12, marginBottom: 24, background: '#f8fafc' }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 4 }}>CLINICAL NOTES & PICU SUMMARY</div>
          <div style={{ fontSize: 14 }}>{episode.clinical_notes}</div>
        </div>
      )}

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, paddingTop: 16, borderTop: '1px dashed #cbd5e1' }}>
        <div>
          <div style={{ fontSize: 13, color: '#666' }}>Resuscitation Team Leader:</div>
          <div style={{ marginTop: 24, borderTop: '1px solid #333', width: 220, textAlign: 'center', fontSize: 13, paddingTop: 4 }}>
            {episode.consultant_name || 'Attending Emergency Physician'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: '#666' }}>Pediatric Cardiologist / Intensivist Sign-Off:</div>
          <div style={{ marginTop: 24, borderTop: '1px solid #333', width: 220, textAlign: 'center', fontSize: 13, paddingTop: 4 }}>
            Consultant Pediatric Electrophysiology / PICU
          </div>
        </div>
      </div>
    </div>
  );
};
