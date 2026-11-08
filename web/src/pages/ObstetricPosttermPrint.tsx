import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getObstetricPosttermEpisode, ObstetricPosttermRecord, ObstetricPosttermFlowsheetRecord } from '../api';

export const ObstetricPosttermPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<ObstetricPosttermRecord | null>(null);
  const [logs, setLogs] = useState<ObstetricPosttermFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getObstetricPosttermEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: 32 }}>Loading printable post-term dossier...</div>;
  if (!episode) return <div style={{ padding: 32 }}>Episode not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1, color: '#047857' }}>
            Obstetrics & Maternal-Fetal Medicine
          </h2>
          <h3 style={{ margin: '4px 0 0', color: '#111' }}>
            Post-Term Pregnancy, Oligohydramnios & Bishop Cervical Ripening Dossier
          </h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: ACOG Practice Bulletin No. 146 (2021) & SMFM Induction Guidelines
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
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Assessment Date:</strong> {new Date(episode.assessment_datetime).toLocaleString()}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Gestational Age:</strong> {episode.gestational_age_weeks} weeks ({episode.postterm_classification === 'post_term_ge_42_0' ? 'Post-Term ≥42w' : 'Late-Term 41w'})
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Dating Method:</strong> {episode.dating_method.replace(/_/g, ' ')}
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Prior Cesarean:</strong> {episode.prior_cesarean_section ? 'YES (Uterine Scar Present)' : 'No (Unscarred)'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Amniotic Fluid & Bishop Summary Box */}
      <div style={{ background: '#ecfdf5', borderLeft: '4px solid #10b981', padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#065f46' }}>
          Amniotic Fluid & Cervical Ripening Synthesis
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>AFI / SDP</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: episode.oligohydramnios_present ? '#dc2626' : '#047857' }}>
              {episode.amniotic_fluid_index_cm} cm / {episode.single_deepest_pocket_cm} cm
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{episode.oligohydramnios_present ? 'Oligohydramnios (≤5cm)' : 'Normal Fluid'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Modified Bishop Score</div>
            <div style={{ fontSize: 20, fontWeight: 'bold' }}>{episode.bishop_score_total} / 13</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{episode.cervix_favorable ? 'Favorable (>6)' : 'Unfavorable (≤6)'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Fetal Surveillance</div>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>{episode.non_stress_test_result.toUpperCase()}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{episode.biophysical_profile_score !== null ? `BPP: ${episode.biophysical_profile_score}/10` : 'BPP: N/A'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Ripening Pathway</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#047857' }}>
              {episode.recommended_ripening_method.replace(/_/g, ' ').toUpperCase()}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{episode.status.replace(/_/g, ' ')}</div>
          </div>
        </div>

        {evalResult && (
          <div style={{ marginTop: 12, fontSize: 14, color: '#334155' }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 'bold' }}>{evalResult.summary}</p>
            <p style={{ margin: '0 0 6px 0', fontSize: 13 }}>
              <strong>Clinical Guidance:</strong> {evalResult.ripeningGuidance}
            </p>
            {evalResult.contraindicationsNote && (
              <p style={{ margin: 0, fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>
                {evalResult.contraindicationsNote}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bishop Score Components Breakdown Table */}
      <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Modified Bishop Score Pelvic Examination Details
      </h4>
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Parameter</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Clinical Finding</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Scoring Criteria</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Cervical Dilation</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{episode.cervical_dilation_cm} cm</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>0 cm = 0 pt | 1-2 cm = 1 pt | 3-4 cm = 2 pt | ≥5 cm = 3 pt</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Cervical Effacement</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{episode.cervical_effacement_pct}%</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>0-30% = 0 pt | 40-50% = 1 pt | 60-70% = 2 pt | ≥80% = 3 pt</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Fetal Station</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>
              {episode.fetal_station >= 0 ? `+${episode.fetal_station}` : episode.fetal_station}
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>-3 = 0 pt | -2 = 1 pt | -1, 0 = 2 pt | +1, +2 = 3 pt</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Cervical Consistency</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{episode.cervical_consistency.toUpperCase()}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Firm = 0 pt | Medium = 1 pt | Soft = 2 pt</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Cervical Position</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{episode.cervical_position.toUpperCase()}</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>Posterior = 0 pt | Midposition = 1 pt | Anterior = 2 pt</td>
          </tr>
        </tbody>
      </table>

      {/* Bedside Flowsheet */}
      <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Bedside Cervical Ripening & Labor Flowsheet
      </h4>
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Time (+Hours)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Bishop</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Dilation / Effacement</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Contractions</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>FHR & CTG</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Action Taken</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Notes</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Logged By</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
                No serial ripening flowsheet checkpoints logged.
              </td>
            </tr>
          ) : (
            logs.map((l) => (
              <tr key={l.id}>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>
                  {new Date(l.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (+{l.hours_from_ripening_start}h)
                </td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{l.bishop_score_current}/13</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.dilation_cm} cm | {l.effacement_pct}%</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', color: l.contractions_per_10min > 5 ? '#dc2626' : 'inherit' }}>
                  {l.contractions_per_10min}/10m {l.tachysystole_present ? '(Tachysystole)' : ''}
                </td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.fetal_heart_rate_bpm} bpm ({l.fhr_category.replace(/_/g, ' ')})</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 600 }}>{l.action_taken.replace(/_/g, ' ')}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.notes || '—'}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.logged_by_name || 'L&D Nurse'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Clinical Notes */}
      {episode.clinical_notes && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: 12, marginBottom: 24, background: '#f8fafc' }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 4 }}>CLINICAL NOTES & DELIVERY DECISION</div>
          <div style={{ fontSize: 14 }}>{episode.clinical_notes}</div>
        </div>
      )}

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, paddingTop: 16, borderTop: '1px dashed #cbd5e1' }}>
        <div>
          <div style={{ fontSize: 13, color: '#666' }}>Attending Obstetrician:</div>
          <div style={{ marginTop: 24, borderTop: '1px solid #333', width: 220, textAlign: 'center', fontSize: 13, paddingTop: 4 }}>
            {episode.consultant_name || 'Consultant Obstetrician'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: '#666' }}>Labor Ward Registrar / Fellow:</div>
          <div style={{ marginTop: 24, borderTop: '1px solid #333', width: 220, textAlign: 'center', fontSize: 13, paddingTop: 4 }}>
            Senior Resident / Obstetric Fellow
          </div>
        </div>
      </div>
    </div>
  );
};
