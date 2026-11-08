import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPediatricAnaphylaxisEpisode, PediatricAnaphylaxisRecord, PediatricAnaphylaxisFlowsheetRecord } from '../api';

export const PediatricAnaphylaxisPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<PediatricAnaphylaxisRecord | null>(null);
  const [logs, setLogs] = useState<PediatricAnaphylaxisFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getPediatricAnaphylaxisEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: 32 }}>Loading printable pediatric anaphylaxis dossier...</div>;
  if (!episode) return <div style={{ padding: 32 }}>Episode not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Pediatric Emergency Medicine & Resuscitation</h2>
          <h3 style={{ margin: '4px 0 0', color: '#b91c1c' }}>Pediatric Anaphylaxis & Refractory Shock Resuscitation Dossier</h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: World Allergy Organization (WAO 2020) / EAACI / AAP Guidelines
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
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Triage Time:</strong> {new Date(episode.triage_datetime).toLocaleString()}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Age / Weight:</strong> {episode.age_months >= 24 ? `${Math.floor(episode.age_months / 12)} years` : `${episode.age_months} months`} ({episode.weight_kg} kg)</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Suspected Trigger:</strong> {episode.trigger_type.replace(/_/g, ' ').toUpperCase()}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Attending Consultant:</strong> {episode.consultant_name || `ID #${episode.consultant_id}`}</td>
          </tr>
          {episode.trigger_details && (
            <tr>
              <td colSpan={3} style={{ padding: 8, border: '1px solid #cbd5e1' }}>
                <strong>Trigger Details:</strong> {episode.trigger_details}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* WAO 2020 Anaphylaxis Diagnostic Criteria */}
      <div style={{ background: '#fef2f2', borderLeft: '4px solid #dc2626', padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#991b1b' }}>
          WAO 2020 Diagnostic Presentation & Severity Staging
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Skin / Mucosa</div>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>{episode.skin_mucosal_involvement ? 'PRESENT' : 'Absent'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Respiratory Compromise</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: episode.respiratory_compromise ? '#dc2626' : 'inherit' }}>
              {episode.respiratory_compromise ? 'PRESENT' : 'Absent'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Cardiovascular / Shock</div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: episode.cardiovascular_hypotension ? '#dc2626' : 'inherit' }}>
              {episode.cardiovascular_hypotension ? 'PRESENT' : 'Absent'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Gastrointestinal (Severe)</div>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>{episode.persistent_gastrointestinal ? 'PRESENT' : 'Absent'}</div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, borderTop: '1px solid #fecaca', paddingTop: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Anaphylaxis Confirmed</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: episode.anaphylaxis_criteria_met ? '#dc2626' : '#16a34a' }}>
              {episode.anaphylaxis_criteria_met ? 'CRITERIA MET' : 'CRITERIA NOT MET'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Severity Tier</div>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>{episode.severity_tier.replace(/_/g, ' ').toUpperCase()}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Weight-Adjusted IM Dose</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b91c1c' }}>
              {episode.weight_adjusted_epinephrine_im_dose_mg} mg (1:1,000)
            </div>
          </div>
        </div>

        {evalResult && (
          <div style={{ marginTop: 12, fontSize: 14, color: '#334155' }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 'bold' }}>{evalResult.summary}</p>
            {evalResult.refractoryShockRisk && (
              <p style={{ margin: '0 0 6px 0', color: '#b91c1c', fontWeight: 'bold' }}>
                🚨 REFRACTORY SHOCK WARNING: 2 or more IM doses administered. Continuous IV Epinephrine infusion & crystalloid boluses required.
              </p>
            )}
            <p style={{ margin: 0, fontSize: 13 }}>
              <strong>Surveillance Window:</strong> {evalResult.biphasicWindowGuidance}
            </p>
          </div>
        )}
      </div>

      {/* Resuscitation Regimens */}
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Intervention / Agent</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Administered Status</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Clinical Protocol & Weight-Adjusted Dosing</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>IM Epinephrine (1:1,000)</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>{episode.im_epinephrine_doses_given} dose(s)</strong>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                1st: {new Date(episode.epinephrine_first_dose_datetime).toLocaleTimeString()}
                {episode.epinephrine_second_dose_datetime && ` | 2nd: ${new Date(episode.epinephrine_second_dose_datetime).toLocaleTimeString()}`}
              </div>
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              0.01 mg/kg (max 0.50 mg) anterolateral mid-thigh. Repeat q5-15 min if poor response.
              Device: {episode.autoinjector_recommended.replace(/_/g, ' ').toUpperCase()}.
            </td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Continuous IV Epinephrine</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              {episode.iv_epinephrine_infusion_active ? (
                <span style={{ color: '#b91c1c', fontWeight: 'bold' }}>ACTIVE ({episode.epinephrine_infusion_rate_mcg_kg_min} mcg/kg/min)</span>
              ) : (
                'Not Active'
              )}
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              Start 0.05-0.1 mcg/kg/min; titrate by 0.05 mcg/kg/min q5-10 min (range 0.1-1.0 mcg/kg/min). Central or dedicated large-bore peripheral line with continuous cardiac monitoring.
            </td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Fluid Resuscitation</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{episode.fluid_bolus_volume_ml} mL crystalloid</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              20 mL/kg isotonic saline or Plasmalyte rapid push over 5-10 minutes. Repeat up to 40-60 mL/kg for persistent hypotension.
            </td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Second-Line Medications</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              H1: {episode.second_line_h1_antihistamine_given ? 'YES' : 'No'} | H2: {episode.second_line_h2_antihistamine_given ? 'YES' : 'No'} | Steroid: {episode.systemic_steroid_given ? 'YES' : 'No'}
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              Cetirizine/Diphenhydramine, Famotidine, and Methylprednisolone (1-2 mg/kg IV) do NOT replace epinephrine; adjuncts for cutaneous relief and biphasic prevention.
            </td>
          </tr>
          {episode.glucagon_administered === 1 && (
            <tr>
              <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Glucagon</td>
              <td style={{ padding: 8, border: '1px solid #cbd5e1', color: '#b91c1c', fontWeight: 'bold' }}>ADMINISTERED</td>
              <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
                Indicated for refractory anaphylaxis in patients receiving beta-adrenergic blocker therapy (activates adenylate cyclase bypassing beta-receptors).
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Bedside Flowsheet */}
      <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Bedside Resuscitation & Biphasic Surveillance Flowsheet
      </h4>
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Min (+arr)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>HR</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>BP (SBP/DBP)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>RR</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>SpO2</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Stridor</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Wheeze</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Urticaria</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>IV Epi (mcg/kg/min)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Fluids (mL)</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={10} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
                No vital signs or flowsheet checkpoints logged.
              </td>
            </tr>
          ) : (
            logs.map((l) => (
              <tr key={l.id}>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 600 }}>+{l.minutes_from_arrival}m</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.heart_rate_bpm}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.sbp_mmhg} / {l.dbp_mmhg ?? '-'}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.respiratory_rate}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.spo2_percent}%</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>
                  {l.stridor_present ? <span style={{ color: '#dc2626', fontWeight: 'bold' }}>YES</span> : 'No'}
                </td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.wheeze_severity}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.urticaria_coverage}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>
                  {l.epinephrine_iv_rate_mcg_kg_min ? `${l.epinephrine_iv_rate_mcg_kg_min}` : '-'}
                </td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.cumulative_crystalloid_ml} mL</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Clinical Notes & Disposition */}
      {episode.clinical_notes && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: 12, marginBottom: 24, background: '#f8fafc' }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 4 }}>CLINICAL NOTES & DISPOSITION PLAN</div>
          <div style={{ fontSize: 14 }}>{episode.clinical_notes}</div>
        </div>
      )}

      {/* Sign-off */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, paddingTop: 16, borderTop: '1px dashed #cbd5e1' }}>
        <div>
          <div style={{ fontSize: 13, color: '#666' }}>Resuscitated by:</div>
          <div style={{ marginTop: 24, borderTop: '1px solid #333', width: 220, textAlign: 'center', fontSize: 13, paddingTop: 4 }}>
            Emergency Resuscitation Team Leader
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: '#666' }}>Attending Physician Sign-Off:</div>
          <div style={{ marginTop: 24, borderTop: '1px solid #333', width: 220, textAlign: 'center', fontSize: 13, paddingTop: 4 }}>
            {episode.consultant_name || 'Pediatric Attending Physician'}
          </div>
        </div>
      </div>
    </div>
  );
};
