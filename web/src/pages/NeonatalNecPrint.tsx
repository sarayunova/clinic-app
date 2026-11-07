import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getNeonatalNecPrint } from '../api';

export const NeonatalNecPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      void getNeonatalNecPrint(parseInt(id, 10))
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <p className="center muted">Loading printable NEC dossier...</p>;
  if (!data || !data.episode) return <p className="center muted">Episode record not found.</p>;

  const { episode, patient, logs } = data;

  return (
    <div className="print-dossier" style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333', paddingBottom: '0.5rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>CLINICAL DOSSIER: NEONATAL NECROTIZING ENTEROCOLITIS (NEC)</h2>
          <p style={{ margin: 0 }} className="muted">Modified Bell Staging, Decompression Surveillance & Surgical Audit</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h3 style={{ margin: 0 }}>{episode.episode_code}</h3>
          <p style={{ margin: 0 }} className="muted">Generated: {new Date().toLocaleString()}</p>
        </div>
      </div>

      <div className="grid col-2 gap-1" style={{ marginTop: '1rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>
        <div>
          <p><strong>Patient Name:</strong> {patient?.fullName || `Patient #${episode.patient_id}`}</p>
          <p><strong>Gestational Age:</strong> {episode.gestational_age_weeks} weeks</p>
          <p><strong>Birth / Current Weight:</strong> {episode.birth_weight_grams}g / {episode.current_weight_grams}g</p>
        </div>
        <div>
          <p><strong>Onset Datetime:</strong> {episode.onset_datetime.replace('T', ' ')}</p>
          <p><strong>Current Status:</strong> {episode.status.toUpperCase()}</p>
          <p><strong>Modified Bell Stage:</strong> <span style={{ fontWeight: 'bold', color: '#c00' }}>{episode.bell_stage.replace(/_/g, ' ').toUpperCase()}</span></p>
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <h4>Medical Management & Supportive Therapy</h4>
        <div className="grid col-2 gap-1" style={{ background: '#f9f9f9', padding: '0.75rem', borderRadius: '4px' }}>
          <div>
            <div><strong>NPO Status:</strong> {episode.npo_active ? 'Strict NPO Active' : 'Enteral Feeds'}</div>
            <div><strong>NG Decompression:</strong> {episode.ng_decompression_active ? 'Replogle Continuous Wall Suction' : 'No tube'}</div>
            <div><strong>Broad Spectrum IV Antibiotics:</strong> {episode.broad_spectrum_antibiotics_active ? 'Active' : 'No'}</div>
          </div>
          <div>
            <div><strong>Total Parenteral Nutrition (TPN):</strong> {episode.tpn_support_active ? 'Active Infusion' : 'None'}</div>
            <div><strong>Vasoactive / Inotrope Support:</strong> {episode.inotrope_support_active ? 'Active' : 'None'}</div>
            <div><strong>Surgical Consult Status:</strong> {episode.surgical_consult_status.replace(/_/g, ' ')}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <h4>Laboratory & Radiographic Markers</h4>
        <p>
          ABG pH: <strong>{episode.abg_ph ?? 'N/A'}</strong> | Base Excess: <strong>{episode.base_excess ?? 'N/A'}</strong> | Platelets: <strong>{episode.platelet_count ? `${episode.platelet_count}/uL` : 'N/A'}</strong> | Serum Lactate: <strong>{episode.serum_lactate_mmol_l ? `${episode.serum_lactate_mmol_l} mmol/L` : 'N/A'}</strong>
        </p>
      </div>

      {episode.clinical_notes && (
        <div style={{ marginTop: '1rem' }}>
          <h4>Attending Neonatologist Notes</h4>
          <p style={{ fontStyle: 'italic', background: '#fafafa', padding: '0.5rem' }}>{episode.clinical_notes}</p>
        </div>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <h4>Serial Abdominal Girth & Decompression Flowsheet</h4>
        {logs && logs.length > 0 ? (
          <table className="table compact" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #999', textAlign: 'left' }}>
                <th>Time</th>
                <th>+Hours</th>
                <th>Girth (cm)</th>
                <th>Residual</th>
                <th>Residual Char</th>
                <th>Bowel Sounds</th>
                <th>Abdominal Wall</th>
                <th>pH / Plt</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l: any) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td>{l.log_datetime.slice(11, 16)}</td>
                  <td>+{l.hours_from_onset}h</td>
                  <td><strong>{l.abdominal_girth_cm ?? '-'}</strong></td>
                  <td>{l.gastric_residual_volume_ml ? `${l.gastric_residual_volume_ml} mL` : '-'}</td>
                  <td>{l.gastric_residual_character}</td>
                  <td>{l.bowel_sounds}</td>
                  <td>{l.abdominal_wall_appearance.replace(/_/g, ' ')}</td>
                  <td>{l.abg_ph ? `pH ${l.abg_ph}` : ''} {l.platelet_count ? `· ${l.platelet_count}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No flowsheet logs recorded.</p>
        )}
      </div>

      <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <p>___________________________________<br />Attending Neonatologist / Surgeon</p>
        </div>
        <div>
          <p>___________________________________<br />NICU Nurse In-Charge</p>
        </div>
      </div>
    </div>
  );
};
