import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getObstetricPpcmEpisode, ObstetricPpcmRecord, ObstetricPpcmFlowsheetRecord } from '../api';

export const ObstetricPpcmPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<ObstetricPpcmRecord | null>(null);
  const [logs, setLogs] = useState<ObstetricPpcmFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getObstetricPpcmEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: 32 }}>Loading printable PPCM dossier...</div>;
  if (!episode) return <div style={{ padding: 32 }}>Episode not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1, color: '#e11d48' }}>
            Maternal-Fetal Medicine &amp; Cardio-Obstetrics
          </h2>
          <h3 style={{ margin: '4px 0 0', color: '#111' }}>
            Peripartum Cardiomyopathy (PPCM) &amp; BOARD Protocol Clinical Dossier
          </h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: European Society of Cardiology (ESC) Guidelines &amp; Heart Failure Association PPCM Registry
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
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Presented:</strong> {new Date(episode.presentation_datetime).toLocaleString()}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Clinical Timing:</strong> {episode.timing_category.replace(/_/g, ' ').toUpperCase()}
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Timeline:</strong> {episode.gestational_age_weeks ? `${episode.gestational_age_weeks} weeks GA` : `${episode.days_postpartum ?? 0} days postpartum`}
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Maternal Age:</strong> {episode.maternal_age ? `${episode.maternal_age} years` : 'N/A'}
            </td>
          </tr>
          <tr>
            <td colSpan={3} style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Clinical Status:</strong> {episode.status.replace(/_/g, ' ').toUpperCase()} | <strong>Attending:</strong> {episode.consultant_name || 'Cardiologist/Obstetrician'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Echocardiography & Hemodynamic Box */}
      <div style={{ background: '#fff1f2', borderLeft: '4px solid #e11d48', padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#be123c' }}>
          Echocardiographic Function &amp; Cardiac Biomarkers
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>LV Ejection Fraction</div>
            <div style={{ fontSize: 22, fontWeight: 'bold', color: episode.lvef_percent < 35 ? '#dc2626' : '#e11d48' }}>
              {episode.lvef_percent}%
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Cutoff: &lt; 45% Diagnostic</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>NYHA Class &amp; LVEDD</div>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>
              {episode.nyha_class.replace(/_/g, ' ').toUpperCase()}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              LVEDD: {episode.lvedd_mm ? `${episode.lvedd_mm} mm` : 'N/A'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Cardiac Biomarkers</div>
            <div style={{ fontSize: 14, fontWeight: 'bold' }}>
              NT-proBNP: {episode.nt_probnp_pg_ml ?? '-'} pg/mL
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Trop I: {episode.troponin_i_ng_ml ?? '-'} ng/mL
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Cardiogenic Shock</div>
            <div style={{ fontSize: 14, fontWeight: 'bold', color: episode.cardiogenic_shock_present ? '#dc2626' : '#16a34a' }}>
              {episode.cardiogenic_shock_present ? 'PRESENT (ICU Inotropes)' : 'Compensated'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Pulm Edema: {episode.pulmonary_edema_present ? 'YES' : 'No'}
            </div>
          </div>
        </div>
      </div>

      {/* Algorithmic Clinical Guidance */}
      {evalResult && (
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: 16, marginBottom: 24, borderRadius: 4 }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>BOARD Protocol Staging &amp; Safety Compliance</h4>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 'bold', color: '#be123c' }}>Bromocriptine Protocol: </span>
            <span style={{ fontWeight: 'bold' }}>{evalResult.recommendedBromocriptineRegimen.replace(/_/g, ' ').toUpperCase()}</span>
          </div>

          <div style={{ background: '#fff', padding: 12, border: '1px solid #e2e8f0', borderRadius: 4, marginBottom: 12 }}>
            <div style={{ fontWeight: 'bold', color: '#0369a1', marginBottom: 4 }}>Mechanistic Rationale (16-kDa Prolactin Blockade):</div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>{evalResult.bromocriptineRationale}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, color: '#dc2626' }}>Critical Action Plan:</div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.4 }}>
                {evalResult.criticalActionPlan.map((action: string, idx: number) => (
                  <li key={idx}>{action}</li>
                ))}
              </ul>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, color: '#0369a1' }}>Safety &amp; Anticoagulation Directives:</div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.4 }}>
                {evalResult.clinicalSafetyDirectives.map((dir: string, idx: number) => (
                  <li key={idx}>{dir}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Pharmacotherapy Details */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
          Prescribed Medications &amp; Anticoagulation Status
        </h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <tbody>
            <tr>
              <td style={{ padding: '6px 8px', width: '30%', color: '#64748b' }}>Bromocriptine Regimen:</td>
              <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>
                {episode.bromocriptine_initiated ? `Initiated (${episode.bromocriptine_regimen.replace(/_/g, ' ')})` : 'Deferred'}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', color: '#64748b' }}>Anticoagulation:</td>
              <td style={{ padding: '6px 8px', fontWeight: 'bold', color: episode.anticoagulation_prescribed ? '#16a34a' : '#dc2626' }}>
                {episode.anticoagulation_prescribed ? `Prescribed (${episode.anticoagulation_agent.replace(/_/g, ' ')})` : 'OMISSION / VIOLATION'}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', color: '#64748b' }}>Heart Failure Therapy:</td>
              <td style={{ padding: '6px 8px' }}>
                Loop Diuretic: {episode.loop_diuretic_given ? 'Yes' : 'No'} | Beta-Blocker: {episode.beta_blocker_given ? 'Yes' : 'No'} | Vasodilator: {episode.vasodilator_agent.replace(/_/g, ' ')}
              </td>
            </tr>
            {episode.clinical_notes && (
              <tr>
                <td style={{ padding: '6px 8px', color: '#64748b' }}>Clinical Summary &amp; Notes:</td>
                <td style={{ padding: '6px 8px', fontStyle: 'italic' }}>{episode.clinical_notes}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Flowsheet Log Table */}
      <div style={{ marginBottom: 32 }}>
        <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: 4 }}>
          Hemodynamic &amp; Inotropic Support Flowsheet Logs ({logs.length})
        </h4>
        {logs.length === 0 ? (
          <div style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic', padding: 8 }}>
            No serial flowsheet entries logged.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: 6, textAlign: 'left' }}>Time</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Hours</th>
                <th style={{ padding: 6, textAlign: 'left' }}>HR</th>
                <th style={{ padding: 6, textAlign: 'left' }}>BP</th>
                <th style={{ padding: 6, textAlign: 'left' }}>RR / SpO2</th>
                <th style={{ padding: 6, textAlign: 'left' }}>O2 Flow</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Urine (mL/h)</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Fluid Bal</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Inotrope</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Logged By</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Observations</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: 6 }}>{new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ padding: 6 }}>+{log.hours_from_presentation}h</td>
                  <td style={{ padding: 6 }}>{log.heart_rate_bpm}</td>
                  <td style={{ padding: 6 }}>{log.blood_pressure_sys}/{log.blood_pressure_dia}</td>
                  <td style={{ padding: 6 }}>{log.respiratory_rate} / {log.spo2_percent}%</td>
                  <td style={{ padding: 6 }}>{log.oxygen_requirement_l_min} L/m</td>
                  <td style={{ padding: 6 }}>{log.urine_output_ml_hr}</td>
                  <td style={{ padding: 6 }}>{log.fluid_balance_cumulative_ml} mL</td>
                  <td style={{ padding: 6 }}>{log.inotropic_support}</td>
                  <td style={{ padding: 6 }}>{log.logged_by_name || 'Staff'}</td>
                  <td style={{ padding: 6 }}>{log.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Attending Provider Sign-Off */}
      <div style={{ borderTop: '2px solid #333', paddingTop: 20, marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
        <div>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 28 }}>
            Attending Cardiologist
          </div>
          <div style={{ borderBottom: '1px solid #000', marginBottom: 4 }} />
          <div style={{ fontSize: 13, fontWeight: 'bold' }}>{episode.consultant_name || 'Cardiologist'}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Date &amp; Time: ________________________</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 28 }}>
            Maternal-Fetal Medicine Specialist
          </div>
          <div style={{ borderBottom: '1px solid #000', marginBottom: 4 }} />
          <div style={{ fontSize: 13, fontWeight: 'bold' }}>MFM Consultant Signature</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Reg / License No: ____________________</div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 32 }} className="no-print">
        <button
          onClick={() => window.print()}
          style={{
            background: '#e11d48',
            color: '#fff',
            border: 'none',
            padding: '10px 24px',
            fontSize: 15,
            fontWeight: 'bold',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          🖨️ Print PPCM Clinical Dossier
        </button>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; }
        }
      `}</style>
    </div>
  );
};
