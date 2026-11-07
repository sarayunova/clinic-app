import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getObstetricAfeEpisode, ObstetricAfeRecord, ObstetricAfeFlowsheetRecord } from '../api';

export const ObstetricAfePrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: ObstetricAfeRecord;
    logs: ObstetricAfeFlowsheetRecord[];
    evalResult: any;
  } | null>(null);

  useEffect(() => {
    if (id) {
      void getObstetricAfeEpisode(Number(id)).then(setData);
    }
  }, [id]);

  if (!data) return <div style={{ padding: 24 }}>Loading clinical dossier...</div>;

  const { episode, logs, evalResult } = data;

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>MATERNAL CRITICAL CARE DOSSIER: AMNIOTIC FLUID EMBOLISM (AFE)</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
            Clark 4-Criteria Diagnostic Case Definition, A-OK Pharmacologic Resuscitation & MTP Protocol (SMFM 2016)
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13 }}>
          <div><strong>Episode:</strong> {episode.episode_code}</div>
          <div><strong>Date:</strong> {new Date(episode.arrest_onset_datetime).toLocaleDateString()}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, margin: '16px 0', fontSize: 13, background: '#f8fafc', padding: 12, borderRadius: 6 }}>
        <div>
          <div><strong>Patient Name:</strong> {episode.patient_name}</div>
          <div><strong>MRN:</strong> {episode.patient_number}</div>
          <div><strong>Date of Birth:</strong> {episode.date_of_birth}</div>
          <div><strong>Gestational Age:</strong> {episode.gestation_weeks} weeks</div>
        </div>
        <div>
          <div><strong>Timing Relation:</strong> {episode.timing_relation.replace(/_/g, ' ')}</div>
          <div><strong>Consultant:</strong> {episode.consultant_name ?? 'Lead Obstetrician'}</div>
          <div><strong>Current Status:</strong> {episode.status.replace(/_/g, ' ')}</div>
          <div><strong>Printed:</strong> {new Date().toLocaleString()}</div>
        </div>
      </div>

      <div style={{ border: '1px solid #dc2626', borderRadius: 6, padding: 14, margin: '16px 0', background: '#fef2f2' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#991b1b' }}>
          Diagnostic Case Definition: {evalResult.clarkCriteriaMet ? 'Clark 4-Criteria Validated AFE' : `Criteria Score: ${evalResult.criteriaMetCount} of 4`}
        </h3>
        <div style={{ fontSize: 13, margin: '6px 0' }}>
          <div>1. Sudden Cardiorespiratory Arrest / Profound Hypotension: <strong>{episode.cardiorespiratory_collapse ? 'Present' : 'Absent'}</strong></div>
          <div>2. Overt Consumptive DIC: <strong>{episode.overt_dic_present ? 'Present' : 'Absent'}</strong></div>
          <div>3. Clinical Onset Temporal Link (Labor/Delivery): <strong>{episode.timing_relation.replace(/_/g, ' ')}</strong></div>
          <div>4. Absence of Pre-Arrest Clinical Fever (&ge; 38°C): <strong>{episode.absence_of_fever ? 'Confirmed (Fever Absent)' : 'Fever Present (Evaluate Sepsis)'}</strong></div>
        </div>
      </div>

      <div style={{ border: '1px solid #d97706', borderRadius: 6, padding: 14, margin: '16px 0', background: '#fffbeb' }}>
        <h4 style={{ margin: '0 0 6px', fontSize: 15, color: '#b45309' }}>A-OK Pharmacologic Resuscitation Regimen</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: 13 }}>
          <div>
            <strong>Atropine (1.0 mg IV):</strong> {episode.atropine_given ? '✓ Administered' : 'Pending'}
          </div>
          <div>
            <strong>Ondansetron (8 mg IV):</strong> {episode.ondansetron_given ? '✓ Administered' : 'Pending'}
          </div>
          <div>
            <strong>Ketorolac (30 mg IV):</strong> {episode.ketorolac_given ? '✓ Administered' : 'Pending'}
          </div>
        </div>
      </div>

      <div style={{ margin: '20px 0' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 15 }}>Evidence-Based Multidisciplinary Action Plan</h4>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
          {evalResult.clinicalActionPlan.map((action: string, i: number) => (
            <li key={i}>{action}</li>
          ))}
        </ul>
      </div>

      <div style={{ margin: '20px 0' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 15 }}>Serial Bedside Observations & Hemodynamic Flowsheet</h4>
        {logs.length === 0 ? (
          <p style={{ fontSize: 13, color: '#64748b' }}>No bedside flowsheet observations recorded.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>Min / Datetime</th>
                <th style={{ padding: '6px 8px' }}>BP (mmHg)</th>
                <th style={{ padding: '6px 8px' }}>HR</th>
                <th style={{ padding: '6px 8px' }}>SpO2 / EtCO2</th>
                <th style={{ padding: '6px 8px' }}>Vasopressor</th>
                <th style={{ padding: '6px 8px' }}>Fibrinogen</th>
                <th style={{ padding: '6px 8px' }}>Platelets</th>
                <th style={{ padding: '6px 8px' }}>INR</th>
                <th style={{ padding: '6px 8px' }}>QBL (mL)</th>
                <th style={{ padding: '6px 8px' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px' }}>+{l.minutes_from_arrest}m ({new Date(l.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</td>
                  <td style={{ padding: '6px 8px' }}>{l.sbp_mmhg != null && l.dbp_mmhg != null ? `${l.sbp_mmhg}/${l.dbp_mmhg}` : '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{l.hr_bpm ?? '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{l.spo2_percent != null ? `${l.spo2_percent}%` : '—'} / {l.etco2_mmhg != null ? `${l.etco2_mmhg}` : '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{l.vasopressor_active.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '6px 8px', color: (l.fibrinogen_mg_dl ?? 200) < 200 ? '#b91c1c' : 'inherit', fontWeight: (l.fibrinogen_mg_dl ?? 200) < 200 ? 'bold' : 'normal' }}>
                    {l.fibrinogen_mg_dl != null ? `${l.fibrinogen_mg_dl}` : '—'}
                  </td>
                  <td style={{ padding: '6px 8px' }}>{l.platelet_count ?? '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{l.inr ?? '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{l.qbl_total_ml ?? '—'}</td>
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
          <div>Recorded by: <strong>{episode.consultant_name ?? 'Lead Obstetrician'}</strong></div>
          <div style={{ color: '#64748b' }}>Obstetric Critical Care Lead / Maternal-Fetal Medicine</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>Physician Signature: ___________________________</div>
          <div style={{ color: '#64748b' }}>Date & Time: {new Date().toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
};
