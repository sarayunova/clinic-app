import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPediatricAsthmaEpisode, PediatricAsthmaStatusRecord, PediatricAsthmaStatusFlowsheetRecord } from '../api';

export const PediatricAsthmaStatusPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: PediatricAsthmaStatusRecord;
    logs: PediatricAsthmaStatusFlowsheetRecord[];
    evalResult: any;
  } | null>(null);

  useEffect(() => {
    if (id) {
      void getPediatricAsthmaEpisode(Number(id)).then(setData);
    }
  }, [id]);

  if (!data) return <div style={{ padding: 24 }}>Loading clinical dossier...</div>;

  const { episode, logs, evalResult } = data;

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>PICU / PEDIATRIC ED CLINICAL DOSSIER: STATUS ASTHMATICUS</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
            Modified Wood's Clinical Asthma Score (M-WCAS) & Stepwise Pharmacologic Escalation (GINA / BTS / AAP)
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13 }}>
          <div><strong>Episode:</strong> {episode.episode_code}</div>
          <div><strong>Date:</strong> {new Date(episode.onset_datetime).toLocaleDateString()}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, margin: '16px 0', fontSize: 13, background: '#f8fafc', padding: 12, borderRadius: 6 }}>
        <div>
          <div><strong>Patient Name:</strong> {episode.patient_name}</div>
          <div><strong>MRN:</strong> {episode.patient_number}</div>
          <div><strong>Date of Birth:</strong> {episode.date_of_birth}</div>
          <div><strong>Age / Weight:</strong> {episode.age_months} months · {episode.weight_kg} kg</div>
        </div>
        <div>
          <div><strong>SpO2 on Room Air:</strong> {episode.spo2_room_air_percent}%</div>
          <div><strong>Consultant:</strong> {episode.consultant_name ?? 'Attending Pediatric Intensivist'}</div>
          <div><strong>Current Status:</strong> {episode.status.replace(/_/g, ' ')}</div>
          <div><strong>Printed:</strong> {new Date().toLocaleString()}</div>
        </div>
      </div>

      <div style={{ border: '1px solid #059669', borderRadius: 6, padding: 14, margin: '16px 0', background: '#ecfdf5' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#047857' }}>
          Diagnostic Severity: {evalResult.severityTitle}
        </h3>
        <div style={{ display: 'flex', gap: 24, fontSize: 14, margin: '8px 0' }}>
          <span>M-WCAS Score: <strong>{episode.total_mwcas_score} / 10</strong></span>
          <span>Wheezing: <strong>{episode.wheezing_score}/2</strong></span>
          <span>Retractions: <strong>{episode.retractions_score}/2</strong></span>
          <span>Air Entry: <strong>{episode.air_entry_score}/2</strong></span>
          <span>Mental State: <strong>{episode.mental_state_score}/2</strong></span>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 13 }}><strong>Blood Gas Assessment:</strong> {evalResult.vbgInterpretation}</p>
      </div>

      <div style={{ margin: '20px 0' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 15 }}>Weight-Calibrated Drug Prescriptions</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
          <div style={{ padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <strong>{evalResult.albuterolContinuous.agent}</strong>
            <div>Dose: <strong>{evalResult.albuterolContinuous.recommendedDose}</strong></div>
            <div className="muted small">{evalResult.albuterolContinuous.instructions}</div>
          </div>
          <div style={{ padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <strong>{evalResult.ivMagnesiumSulfate.agent}</strong>
            <div>Dose: <strong>{evalResult.ivMagnesiumSulfate.recommendedDose}</strong></div>
            <div className="muted small">{evalResult.ivMagnesiumSulfate.instructions}</div>
          </div>
          <div style={{ padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <strong>{evalResult.ivTerbutaline.agent}</strong>
            <div>Dose: <strong>{evalResult.ivTerbutaline.recommendedDose}</strong></div>
            <div className="muted small">{evalResult.ivTerbutaline.instructions}</div>
          </div>
          <div style={{ padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <strong>{evalResult.systemicSteroids.agent}</strong>
            <div>Dose: <strong>{evalResult.systemicSteroids.recommendedDose}</strong></div>
            <div className="muted small">{evalResult.systemicSteroids.instructions}</div>
          </div>
        </div>
      </div>

      <div style={{ margin: '20px 0' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 15 }}>Evidence-Based Clinical Action Plan</h4>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
          {evalResult.clinicalActionPlan.map((action: string, i: number) => (
            <li key={i}>{action}</li>
          ))}
        </ul>
      </div>

      <div style={{ margin: '20px 0' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 15 }}>Serial Bedside Observations & M-WCAS Flowsheet</h4>
        {logs.length === 0 ? (
          <p style={{ fontSize: 13, color: '#64748b' }}>No bedside flowsheet observations recorded.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>Min / Datetime</th>
                <th style={{ padding: '6px 8px' }}>RR (/min)</th>
                <th style={{ padding: '6px 8px' }}>HR (bpm)</th>
                <th style={{ padding: '6px 8px' }}>SpO2 (FiO2)</th>
                <th style={{ padding: '6px 8px' }}>M-WCAS</th>
                <th style={{ padding: '6px 8px' }}>Albuterol (mg/h)</th>
                <th style={{ padding: '6px 8px' }}>Terbutaline</th>
                <th style={{ padding: '6px 8px' }}>BiPAP</th>
                <th style={{ padding: '6px 8px' }}>VBG pH/pCO2</th>
                <th style={{ padding: '6px 8px' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px' }}>+{l.minutes_from_triage}m ({new Date(l.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</td>
                  <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{l.respiratory_rate}</td>
                  <td style={{ padding: '6px 8px' }}>{l.heart_rate}</td>
                  <td style={{ padding: '6px 8px' }}>{l.spo2_percent}% ({l.fio2_percent}%)</td>
                  <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{l.total_mwcas_score} / 10</td>
                  <td style={{ padding: '6px 8px' }}>{l.albuterol_rate_mg_hr != null ? `${l.albuterol_rate_mg_hr}` : '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{l.terbutaline_rate_mcg_kg_min != null ? `${l.terbutaline_rate_mcg_kg_min}` : '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{l.bipap_settings ?? '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{l.vbg_ph != null && l.vbg_pco2_mmhg != null ? `${l.vbg_ph} / ${l.vbg_pco2_mmhg}` : '—'}</td>
                  <td style={{ padding: '6px 8px', color: '#475569' }}>{l.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {episode.clinical_notes && (
        <div style={{ margin: '16px 0', fontSize: 13, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
          <strong>Clinical Notes:</strong>
          <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{episode.clinical_notes}</p>
        </div>
      )}

      <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid #94a3b8', paddingTop: 16 }}>
        <div>
          <div>Recorded by: <strong>{episode.consultant_name ?? 'Attending Pediatric Intensivist'}</strong></div>
          <div style={{ color: '#64748b' }}>PICU Consultant / Pediatric Emergency Medicine</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>Physician Signature: ___________________________</div>
          <div style={{ color: '#64748b' }}>Date & Time: {new Date().toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
};
