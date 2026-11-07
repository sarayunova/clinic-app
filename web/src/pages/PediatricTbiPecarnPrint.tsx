import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPediatricTbiPrint } from '../api';

export const PediatricTbiPecarnPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      void getPediatricTbiPrint(parseInt(id, 10))
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <p className="center muted">Loading printable TBI dossier...</p>;
  if (!data || !data.episode) return <p className="center muted">TBI episode record not found.</p>;

  const { episode, patient, logs } = data;

  return (
    <div className="print-dossier" style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333', paddingBottom: '0.5rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>EMERGENCY NEURO-CRITICAL DOSSIER: PEDIATRIC TBI & PECARN</h2>
          <p style={{ margin: 0 }} className="muted">PECARN Head Trauma Rule, Pediatric GCS & Raised ICP Resuscitation Protocol</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h3 style={{ margin: 0 }}>{episode.episode_code}</h3>
          <p style={{ margin: 0 }} className="muted">Generated: {new Date().toLocaleString()}</p>
        </div>
      </div>

      <div className="grid col-2 gap-1" style={{ marginTop: '1rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>
        <div>
          <p><strong>Patient Name:</strong> {patient?.fullName || `Patient #${episode.patient_id}`}</p>
          <p><strong>Age & Weight:</strong> {episode.age_months} months ({episode.age_bracket === 'under_2_years' ? '< 2 Years' : '≥ 2 Years'}) · {episode.weight_kg} kg</p>
          <p><strong>Mechanism of Injury:</strong> {episode.injury_mechanism.replace(/_/g, ' ')}</p>
        </div>
        <div>
          <p><strong>Injury Datetime:</strong> {episode.injury_datetime.replace('T', ' ')}</p>
          <p><strong>Initial pGCS:</strong> <strong>{episode.gcs_score} / 15</strong></p>
          <p><strong>PECARN Risk Category:</strong> <span style={{ fontWeight: 'bold', color: '#c00' }}>{episode.pecarn_risk_category.replace(/_/g, ' ').toUpperCase()}</span></p>
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <h4>Neuro-Imaging & Raised ICP Management</h4>
        <div className="grid col-2 gap-1" style={{ background: '#f9f9f9', padding: '0.75rem', borderRadius: '4px' }}>
          <div>
            <div><strong>Head CT Performed:</strong> {episode.ct_performed ? 'Yes' : 'No'}</div>
            <div><strong>CT Findings:</strong> {episode.ct_findings.replace(/_/g, ' ')}</div>
            <div><strong>Raised ICP Suspected:</strong> {episode.raised_icp_suspected ? 'Yes' : 'No'}</div>
          </div>
          <div>
            <div><strong>ICP Management Tier:</strong> {episode.icp_management_tier.replace(/_/g, ' ')}</div>
            <div><strong>Hyperosmolar Agent:</strong> {episode.hyperosmolar_agent.replace(/_/g, ' ')}</div>
            <div><strong>Airway Status:</strong> {episode.intubation_status.replace(/_/g, ' ')}</div>
          </div>
        </div>
      </div>

      {episode.clinical_notes && (
        <div style={{ marginTop: '1rem' }}>
          <h4>Emergency & Neuro-Intensive Physician Notes</h4>
          <p style={{ fontStyle: 'italic', background: '#fafafa', padding: '0.5rem' }}>{episode.clinical_notes}</p>
        </div>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <h4>Serial Pediatric GCS, Pupillometry & ICP Flowsheet</h4>
        {logs && logs.length > 0 ? (
          <table className="table compact" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #999', textAlign: 'left' }}>
                <th>Time</th>
                <th>+Min</th>
                <th>GCS (E+V+M)</th>
                <th>Pupils</th>
                <th>Vitals SBP/DBP (HR)</th>
                <th>ICP</th>
                <th>CPP</th>
                <th>Hyperosmolar Rx</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l: any) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td>{l.log_datetime.slice(11, 16)}</td>
                  <td>+{l.minutes_from_injury}m</td>
                  <td><strong>{l.gcs_total}/15</strong> ({l.gcs_eye}+{l.gcs_verbal}+{l.gcs_motor})</td>
                  <td>{l.pupil_reactivity.replace(/_/g, ' ')}</td>
                  <td>{l.vitals_sbp && l.vitals_dbp ? `${l.vitals_sbp}/${l.vitals_dbp}` : '-'} ({l.vitals_hr ? `${l.vitals_hr}` : '-'})</td>
                  <td>{l.icp_mmhg ? `${l.icp_mmhg} mmHg` : '-'}</td>
                  <td><strong>{l.calculated_cpp_mmhg ? `${l.calculated_cpp_mmhg} mmHg` : '-'}</strong></td>
                  <td>{l.hyperosmolar_bolus_given.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No neuro-check logs recorded.</p>
        )}
      </div>

      <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <p>___________________________________<br />Attending Pediatric Emergency / Intensivist</p>
        </div>
        <div>
          <p>___________________________________<br />Pediatric Neurosurgeon</p>
        </div>
      </div>
    </div>
  );
};
