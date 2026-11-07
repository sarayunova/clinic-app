import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getNeonatalPphnEpisode, NeonatalPphnRecord, NeonatalPphnFlowsheetRecord } from '../api';

export const NeonatalPphnPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: NeonatalPphnRecord;
    logs: NeonatalPphnFlowsheetRecord[];
    evalResult: any;
  } | null>(null);

  useEffect(() => {
    if (id) {
      void getNeonatalPphnEpisode(Number(id)).then(setData);
    }
  }, [id]);

  if (!data) return <div style={{ padding: 24 }}>Loading clinical dossier...</div>;

  const { episode, logs, evalResult } = data;

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>NICU CLINICAL DOSSIER: NEONATAL PPHN & iNO PROTOCOL</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
            Oxygenation Index (OI), Inhaled Nitric Oxide Titration & Echocardiographic Staging (AAP / AHA 2015)
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
          <div><strong>Gestation / Birth Wt:</strong> {episode.gestational_age_weeks} weeks · {episode.birth_weight_grams} g</div>
        </div>
        <div>
          <div><strong>Primary Etiology:</strong> {episode.primary_etiology.replace(/_/g, ' ')}</div>
          <div><strong>Consultant:</strong> {episode.consultant_name ?? 'Attending Neonatologist'}</div>
          <div><strong>Current Status:</strong> {episode.status.replace(/_/g, ' ')}</div>
          <div><strong>Printed:</strong> {new Date().toLocaleString()}</div>
        </div>
      </div>

      <div style={{ border: '1px solid #0284c7', borderRadius: 6, padding: 14, margin: '16px 0', background: '#f0f9ff' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#0369a1' }}>
          Diagnostic Severity: {evalResult.severityTitle}
        </h3>
        <div style={{ display: 'flex', gap: 24, fontSize: 14, margin: '8px 0' }}>
          <span>Calculated OI: <strong>{episode.calculated_oi}</strong></span>
          <span>SpO2 Gradient (Pre - Post): <strong>{episode.spo2_gradient}%</strong></span>
          <span>MAP: <strong>{episode.mean_airway_pressure_cmh2o} cmH2O</strong></span>
          <span>FiO2: <strong>{episode.fio2_percent}%</strong></span>
          <span>PaO2: <strong>{episode.pao2_mmhg} mmHg</strong></span>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 13 }}><strong>Ductal Shunting Interpretation:</strong> {evalResult.ductalShuntInterpretation}</p>
        {evalResult.inoRecommended && (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#0369a1' }}>
            <strong>Inhaled Nitric Oxide Status:</strong> Active at {episode.ino_dose_ppm} ppm. Methemoglobin: {episode.methemoglobin_percent ?? 'Not tested'}% ({evalResult.methemoglobinAdvice})
          </p>
        )}
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
        <h4 style={{ margin: '0 0 8px', fontSize: 15 }}>Serial Bedside Observations & iNO Titration Flowsheet</h4>
        {logs.length === 0 ? (
          <p style={{ fontSize: 13, color: '#64748b' }}>No bedside flowsheet observations recorded.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>Hr / Datetime</th>
                <th style={{ padding: '6px 8px' }}>Pre/Post SpO2</th>
                <th style={{ padding: '6px 8px' }}>Δ SpO2</th>
                <th style={{ padding: '6px 8px' }}>MAP / FiO2</th>
                <th style={{ padding: '6px 8px' }}>PaO2</th>
                <th style={{ padding: '6px 8px' }}>OI</th>
                <th style={{ padding: '6px 8px' }}>iNO ppm</th>
                <th style={{ padding: '6px 8px' }}>MetHb %</th>
                <th style={{ padding: '6px 8px' }}>NO2 ppm</th>
                <th style={{ padding: '6px 8px' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px' }}>+{l.hours_from_onset}h ({new Date(l.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</td>
                  <td style={{ padding: '6px 8px' }}>{l.preductal_spo2}% / {l.postductal_spo2}%</td>
                  <td style={{ padding: '6px 8px', fontWeight: l.spo2_gradient >= 10 ? 'bold' : 'normal' }}>{l.spo2_gradient}%</td>
                  <td style={{ padding: '6px 8px' }}>{l.map_cmh2o} / {l.fio2_percent}%</td>
                  <td style={{ padding: '6px 8px' }}>{l.pao2_mmhg}</td>
                  <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{l.calculated_oi}</td>
                  <td style={{ padding: '6px 8px' }}>{l.ino_dose_ppm}</td>
                  <td style={{ padding: '6px 8px' }}>{l.methemoglobin_percent ?? '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{l.circuit_no2_ppm ?? '—'}</td>
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
          <div>Recorded by: <strong>{episode.consultant_name ?? 'Attending Neonatologist'}</strong></div>
          <div style={{ color: '#64748b' }}>NICU Consultant / Pediatric Intensivist</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>Physician Signature: ___________________________</div>
          <div style={{ color: '#64748b' }}>Date & Time: {new Date().toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
};
