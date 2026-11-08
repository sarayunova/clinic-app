import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getObstetricShoulderDystociaEpisode, ObstetricShoulderDystociaRecord, ObstetricShoulderDystociaFlowsheetRecord } from '../api';

export const ObstetricShoulderDystociaPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<ObstetricShoulderDystociaRecord | null>(null);
  const [logs, setLogs] = useState<ObstetricShoulderDystociaFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getObstetricShoulderDystociaEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: 32 }}>Loading printable shoulder dystocia dossier...</div>;
  if (!episode) return <div style={{ padding: 32 }}>Episode not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1, color: '#b91c1c' }}>
            Obstetrics & Maternal-Fetal Emergency Medicine
          </h2>
          <h3 style={{ margin: '4px 0 0', color: '#111' }}>
            Shoulder Dystocia Emergency & HELPERR Protocol Clinical Dossier
          </h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: RCOG Greentop Guideline No. 42 & ACOG Practice Bulletin No. 178
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
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Delivery Date:</strong> {new Date(episode.delivery_datetime).toLocaleString()}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Gestation:</strong> {episode.gestational_age_weeks} weeks</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Birth Weight:</strong> {episode.actual_birth_weight_grams} g ({episode.actual_birth_weight_grams >= 4000 ? 'Macrosomic' : 'AGA'})</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Delivery Mode:</strong> {episode.operative_vaginal_delivery.replace(/_/g, ' ').toUpperCase()}</td>
          </tr>
          <tr>
            <td colSpan={3} style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Gestational Diabetes:</strong> {episode.gestational_diabetes ? 'YES (GDM Positive)' : 'No'} | <strong>Status:</strong> {episode.status.replace(/_/g, ' ').toUpperCase()}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Head-to-Body Interval & Hypoxia Staging Box */}
      <div style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#b45309' }}>
          Head-to-Body Interval & Hypoxia Stratification
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Head-to-Body Time</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: episode.head_to_body_interval_seconds >= 180 ? '#dc2626' : '#b45309' }}>
              {episode.head_to_body_interval_seconds} seconds
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Threshold: &gt; 60 seconds</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Turtle Sign</div>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>{episode.turtle_sign_observed ? 'OBSERVED (+)' : 'No'}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Perineal retraction</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Apgar / Cord pH</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {episode.apgar_1min ?? '-'}/{episode.apgar_5min ?? '-'} (1m/5m)
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {episode.umbilical_arterial_ph ? `Art pH: ${episode.umbilical_arterial_ph}` : 'No cord gas'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Fundal Pressure Safety</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: episode.fundal_pressure_avoided ? '#16a34a' : '#dc2626' }}>
              {episode.fundal_pressure_avoided ? 'STRICTLY AVOIDED' : 'VIOLATION'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Contraindicated</div>
          </div>
        </div>
      </div>

      {/* HELPERR Maneuvers Execution Synthesis Box */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: 16, marginBottom: 24, background: '#f8fafc' }}>
        <h4 style={{ margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#334155' }}>
          HELPERR Maneuver Compliance & Sequence Audit
        </h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px 4px', fontWeight: 600, width: '35%' }}>H: Call for Help:</td>
              <td style={{ padding: '8px 4px' }}>
                {episode.help_called ? '✅ Senior Obstetrician, Pediatrician, and Anesthesiologist mobilized' : '⚠️ Immediate help call not recorded'}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px 4px', fontWeight: 600 }}>E: Evaluate for Episiotomy:</td>
              <td style={{ padding: '8px 4px' }}>
                {episode.episiotomy_performed ? 'Performed to facilitate internal rotational maneuvers' : 'Not performed (bony impaction, soft tissues adequate)'}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px 4px', fontWeight: 600 }}>L: McRoberts Maneuver:</td>
              <td style={{ padding: '8px 4px' }}>
                {episode.mcroberts_maneuver_success ? '✅ Succeeded in delivering shoulders' : 'Attempted; maternal hips hyperflexed and abducted'}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px 4px', fontWeight: 600 }}>P: Suprapubic Pressure (Rubin I):</td>
              <td style={{ padding: '8px 4px' }}>
                {episode.suprapubic_pressure_success ? '✅ Succeeded in disimpacting anterior shoulder' : 'Attempted with downward/lateral pressure from fetal back'}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px 4px', fontWeight: 600 }}>E: Internal Rotation Maneuvers:</td>
              <td style={{ padding: '8px 4px' }}>
                {episode.internal_rotational_maneuver !== 'none' ? (
                  <span>
                    Maneuver: <strong>{episode.internal_rotational_maneuver.replace(/_/g, ' ').toUpperCase()}</strong> — {episode.internal_rotational_success ? '✅ Succeeded' : 'Failed'}
                  </span>
                ) : 'Not required / not attempted'}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '8px 4px', fontWeight: 600 }}>R: Remove Posterior Arm / R: Roll Gaskin:</td>
              <td style={{ padding: '8px 4px' }}>
                Posterior Arm: {episode.posterior_arm_delivery_success ? '✅ Delivered' : 'No'} | All-Fours Gaskin: {episode.gaskin_all_fours_success ? '✅ Delivered' : 'No'}
              </td>
            </tr>
            {evalResult?.clinicalGuidance && (
              <tr>
                <td style={{ padding: '8px 4px', fontWeight: 600 }}>Clinical Directive:</td>
                <td style={{ padding: '8px 4px', color: '#b91c1c' }}>{evalResult.clinicalGuidance}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Maneuver Flowsheet History */}
      <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Procedural Maneuver Execution Log ({logs.length} entries)
      </h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
            <th style={{ padding: 6, textAlign: 'left' }}>Time / Delta</th>
            <th style={{ padding: 6, textAlign: 'center' }}>Elapsed (s)</th>
            <th style={{ padding: 6, textAlign: 'left' }}>Maneuver Executed</th>
            <th style={{ padding: 6, textAlign: 'center' }}>Outcome</th>
            <th style={{ padding: 6, textAlign: 'left' }}>Traction Quality</th>
            <th style={{ padding: 6, textAlign: 'left' }}>Notes</th>
            <th style={{ padding: 6, textAlign: 'left' }}>Logged By</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ padding: 12, textAlign: 'center', color: '#64748b' }}>
                No serial maneuver timestamps logged.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: 6 }}>
                  {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ padding: 6, textAlign: 'center', fontWeight: 'bold' }}>+{log.seconds_from_head_delivery}s</td>
                <td style={{ padding: 6, fontWeight: 600 }}>{log.maneuver_attempted.replace(/_/g, ' ')}</td>
                <td style={{ padding: 6, textAlign: 'center' }}>{log.maneuver_outcome.replace(/_/g, ' ')}</td>
                <td style={{ padding: 6 }}>{log.traction_applied.replace(/_/g, ' ')}</td>
                <td style={{ padding: 6 }}>{log.notes || '-'}</td>
                <td style={{ padding: 6 }}>{log.logged_by_name || 'Staff'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Attending Sign-Off */}
      <div style={{ marginTop: 40, borderTop: '1px solid #94a3b8', paddingTop: 16, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 'bold' }}>Delivering Obstetrician</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Dr. {episode.consultant_name || 'Designated Obstetrician'}</div>
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
            backgroundColor: '#b91c1c',
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
