import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getNeonatalHypocalcemiaEpisode, NeonatalHypocalcemiaRecord, NeonatalHypocalcemiaFlowsheetRecord } from '../api';

export const NeonatalHypocalcemiaPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<NeonatalHypocalcemiaRecord | null>(null);
  const [logs, setLogs] = useState<NeonatalHypocalcemiaFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getNeonatalHypocalcemiaEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div style={{ padding: 32 }}>Loading printable hypocalcemia dossier...</div>;
  if (!episode) return <div style={{ padding: 32 }}>Episode not found.</div>;

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: 1, color: '#b45309' }}>
            Neonatal Intensive Care & Metabolic Medicine
          </h2>
          <h3 style={{ margin: '4px 0 0', color: '#111' }}>
            Neonatal Hypocalcemia, Hypomagnesemia & Electrolyte Emergency Dossier
          </h3>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Reference: AAP / NICE Clinical Guidelines & Gomella's Neonatology (8th Ed)
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
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Diagnosis Date:</strong> {new Date(episode.diagnosis_datetime).toLocaleString()}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Gestation:</strong> {episode.gestational_age_weeks} weeks</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Birth Weight:</strong> {episode.birth_weight_grams} g</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}><strong>Age:</strong> {episode.chronological_age_hours} hours ({episode.onset_timing === 'early_onset_le_72h' ? 'Early Onset ≤72h' : 'Late Onset >72h'})</td>
          </tr>
          <tr>
            <td colSpan={3} style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              <strong>Etiology Category:</strong> {episode.etiology_category.replace(/_/g, ' ').toUpperCase()} | <strong>Status:</strong> {episode.status.replace(/_/g, ' ').toUpperCase()}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Electrolyte & ECG Staging Box */}
      <div style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: 16, marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5, color: '#b45309' }}>
          Biochemical Staging & Neuromuscular Findings
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Ionized Calcium</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: episode.ionized_calcium_mmol_l < 1.0 ? '#dc2626' : '#16a34a' }}>
              {episode.ionized_calcium_mmol_l} mmol/L
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Ref: 1.10 - 1.35 mmol/L</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Total Calcium</div>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>{episode.total_calcium_mg_dl} mg/dL</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Cutoff: {episode.gestational_age_weeks < 37 ? '< 7.0 (preterm)' : '< 8.0 (term)'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Serum Magnesium</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: episode.serum_magnesium_mg_dl < 1.5 ? '#dc2626' : '#16a34a' }}>
              {episode.serum_magnesium_mg_dl} mg/dL
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{episode.concurrent_hypomagnesemia ? 'LOW (Refractory Ca Risk)' : 'Normal'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Symptoms & ECG</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: episode.symptoms_present ? '#dc2626' : '#16a34a' }}>
              {episode.symptom_details.replace(/_/g, ' ').toUpperCase()}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {episode.ecg_qtc_seconds ? `QTc: ${episode.ecg_qtc_seconds}s ${episode.ecg_prolonged_qtc ? '(Prolonged)' : ''}` : 'No ECG documented'}
            </div>
          </div>
        </div>

        {evalResult && (
          <div style={{ marginTop: 12, fontSize: 14, color: '#334155' }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 'bold' }}>{evalResult.summary}</p>
            <p style={{ margin: '0 0 6px 0', fontSize: 13 }}>
              <strong>Administration Protocol:</strong> {evalResult.administrationProtocol}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#b91c1c' }}>
              <strong>Safety Warning:</strong> {evalResult.bradycardiaWarning}
            </p>
          </div>
        )}
      </div>

      {/* Dosing & Replacement Guidance Table */}
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Intervention</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Prescribed Dose / Volume</th>
            <th style={{ padding: 8, border: '1px solid #cbd5e1' }}>Protocol Instructions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>10% Calcium Gluconate IV Bolus</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1', fontWeight: 'bold', color: '#1e40af' }}>
              {episode.calcium_gluconate_10pct_bolus_ml} mL
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              Dilute 1:1 with 5% Dextrose (total {Math.round(episode.calcium_gluconate_10pct_bolus_ml * 2 * 10) / 10} mL). Infuse over 10-30 min with continuous ECG. Stop if HR &lt; 100 bpm.
            </td>
          </tr>
          <tr>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>10% Calcium Gluconate Maintenance</td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1', fontWeight: 'bold' }}>
              {episode.calcium_gluconate_maintenance_mg_kg_day} mg/kg/day ({evalResult?.calciumGluconateMaintenanceMlPerDay ?? Math.round((episode.birth_weight_grams / 1000) * 4 * 10) / 10} mL/day)
            </td>
            <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
              Continuous IV infusion via confirmed patent peripheral line. Never co-infuse with Bicarbonate or Ceftriaxone.
            </td>
          </tr>
          {episode.concurrent_hypomagnesemia === 1 && (
            <tr>
              <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>50% Magnesium Sulfate Replacement</td>
              <td style={{ padding: 8, border: '1px solid #cbd5e1', fontWeight: 'bold', color: '#b45309' }}>
                {episode.magnesium_sulfate_50pct_dose_ml ?? '0.2 mL/kg'} mL
              </td>
              <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
                Administer 100 mg/kg (0.2 mL/kg) slow IV over 1-2 hours or deep IM. Corrects impaired PTH release.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Bedside Flowsheet */}
      <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Bedside Calcium Infusion & Electrolyte Flowsheet
      </h4>
      <table style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Time (+Hours)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>HR (bpm)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>iCa (mmol/L)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Rate (mL/hr)</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Line Patency</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Tone / Jitteriness</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>ECG Rhythm</th>
            <th style={{ padding: 6, border: '1px solid #cbd5e1' }}>Logged By</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
                No serial flowsheet checkpoints logged during infusion.
              </td>
            </tr>
          ) : (
            logs.map((l) => (
              <tr key={l.id}>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>
                  {new Date(l.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (+{l.hours_from_initiation}h)
                </td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 600, color: l.heart_rate_bpm < 100 ? '#dc2626' : 'inherit' }}>
                  {l.heart_rate_bpm} bpm
                </td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1', fontWeight: 'bold', color: l.ionized_calcium_mmol_l < 1.0 ? '#dc2626' : '#16a34a' }}>
                  {l.ionized_calcium_mmol_l}
                </td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.calcium_infusion_rate_ml_hr} mL/hr</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.iv_site_condition.replace(/_/g, ' ')}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.clinical_neuromuscular_state.replace(/_/g, ' ')}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.ecg_rhythm_strip.replace(/_/g, ' ')}</td>
                <td style={{ padding: 6, border: '1px solid #cbd5e1' }}>{l.logged_by_name || 'NICU Nurse'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Clinical Notes */}
      {episode.clinical_notes && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: 12, marginBottom: 24, background: '#f8fafc' }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 4 }}>CLINICAL NOTES & WEANING PLAN</div>
          <div style={{ fontSize: 14 }}>{episode.clinical_notes}</div>
        </div>
      )}

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, paddingTop: 16, borderTop: '1px dashed #cbd5e1' }}>
        <div>
          <div style={{ fontSize: 13, color: '#666' }}>Attending Neonatologist:</div>
          <div style={{ marginTop: 24, borderTop: '1px solid #333', width: 220, textAlign: 'center', fontSize: 13, paddingTop: 4 }}>
            {episode.consultant_name || 'Consultant Neonatologist'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: '#666' }}>NICU Resuscitation Lead:</div>
          <div style={{ marginTop: 24, borderTop: '1px solid #333', width: 220, textAlign: 'center', fontSize: 13, paddingTop: 4 }}>
            Senior Neonatal Fellow / Registrar
          </div>
        </div>
      </div>
    </div>
  );
};
