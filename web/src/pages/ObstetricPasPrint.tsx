import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getObstetricPasPrint } from '../api';

export const ObstetricPasPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      void getObstetricPasPrint(parseInt(id, 10))
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <p className="center muted">Loading printable PAS dossier...</p>;
  if (!data || !data.episode) return <p className="center muted">PAS protocol record not found.</p>;

  const { episode, patient, logs } = data;

  return (
    <div className="print-dossier" style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333', paddingBottom: '0.5rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>MULTIDISCIPLINARY SURGICAL DOSSIER: PLACENTA ACCRETA SPECTRUM</h2>
          <p style={{ margin: 0 }} className="muted">FIGO / SMFM Staging, Hemorrhage Protocols & Planned Cesarean Hysterectomy</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h3 style={{ margin: 0 }}>{episode.episode_code}</h3>
          <p style={{ margin: 0 }} className="muted">Generated: {new Date().toLocaleString()}</p>
        </div>
      </div>

      <div className="grid col-2 gap-1" style={{ marginTop: '1rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>
        <div>
          <p><strong>Patient Name:</strong> {patient?.fullName || `Patient #${episode.patient_id}`}</p>
          <p><strong>Current Gestation:</strong> {episode.gestation_weeks} weeks</p>
          <p><strong>Obstetric History:</strong> {episode.previous_cesareans_count} Prior Cesarean Deliveries</p>
          <p><strong>Placenta Previa:</strong> {episode.placenta_previa_present ? 'Confirmed Previa (High Risk)' : 'No Previa'}</p>
        </div>
        <div>
          <p><strong>Planned Delivery Timing:</strong> <strong>{episode.planned_delivery_weeks} weeks</strong> (SMFM Target: 34w0d–35w6d)</p>
          <p><strong>PAS Grade:</strong> <span style={{ fontWeight: 'bold', color: '#c00' }}>{episode.pas_grade.replace(/_/g, ' ').toUpperCase()}</span></p>
          <p><strong>Planned Surgical Approach:</strong> {episode.surgical_approach.replace(/_/g, ' ')}</p>
          <p><strong>Protocol Status:</strong> {episode.status.toUpperCase()}</p>
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <h4>Color Doppler Ultrasound & MRI Diagnostic Staging</h4>
        <div className="grid col-2 gap-1" style={{ background: '#f9f9f9', padding: '0.75rem', borderRadius: '4px' }}>
          <div>
            <div><strong>Loss of Clear Zone:</strong> {episode.loss_of_clear_zone ? 'Yes' : 'No'}</div>
            <div><strong>Myometrial Thinning (&lt;1mm):</strong> {episode.myometrial_thickness_less_1mm ? 'Yes' : 'No'}</div>
            <div><strong>Lacunae Grade:</strong> Grade {episode.lacunae_grade} (turbulent confluent flow)</div>
          </div>
          <div>
            <div><strong>Subplacental Hypervascularity:</strong> {episode.subplacental_hypervascularity ? 'Yes' : 'No'}</div>
            <div><strong>Bladder Bridging Vessels:</strong> {episode.bridging_vessels_to_bladder ? 'YES (Percreta alert)' : 'No'}</div>
            <div><strong>MRI Pelvis Performed:</strong> {episode.mri_performed ? `Yes (${episode.mri_findings || 'See PACS'})` : 'No'}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <h4>Multidisciplinary Team (MDT) Surgical Checklist</h4>
        <div style={{ background: '#fff5f5', border: '1px solid #ebccd1', padding: '0.75rem', borderRadius: '4px' }}>
          <p><strong>Blood Bank Pre-Arrangement:</strong> {episode.prbc_units_reserved} units PRBC, {episode.ffp_units_reserved} units FFP, {episode.platelet_units_reserved} units Platelets in OR.</p>
          <p><strong>Interventional Radiology (IR):</strong> {episode.ir_embolization_planned ? 'Bilateral Internal Iliac / Uterine Artery Balloon Occlusion Planned' : 'Not requested'}</p>
          <p><strong>Urology:</strong> {episode.ureteral_stents_planned ? 'Preoperative Rigid Cystoscopy with Bilateral Ureteral Stenting Planned' : 'Not requested'}</p>
          <p><strong>Intraoperative Autologous Blood Salvage (Cell Saver):</strong> {episode.cell_saver_requested ? 'Confirmed Active' : 'No'}</p>
          <p style={{ color: '#a94442', fontWeight: 'bold' }}>
            CRITICAL DIRECTIVE: Deliver fetus via high fundal hysterotomy avoiding placental tissue. LEAVE PLACENTA IN SITU without traction. Proceed directly with Cesarean Hysterectomy.
          </p>
        </div>
      </div>

      {episode.clinical_notes && (
        <div style={{ marginTop: '1rem' }}>
          <h4>Lead Surgeon & MFM Consultation Notes</h4>
          <p style={{ fontStyle: 'italic', background: '#fafafa', padding: '0.5rem' }}>{episode.clinical_notes}</p>
        </div>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <h4>Antenatal Bleeding Episodes & Hemodynamic Flowsheet</h4>
        {logs && logs.length > 0 ? (
          <table className="table compact" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #999', textAlign: 'left' }}>
                <th>Date & Time</th>
                <th>Gestation</th>
                <th>Bleeding Episode</th>
                <th>Maternal BP / HR</th>
                <th>CTG Category</th>
                <th>Hemoglobin</th>
                <th>Crossmatch</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l: any) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td>{l.log_datetime.slice(0, 16).replace('T', ' ')}</td>
                  <td>{l.gestation_weeks}w</td>
                  <td>{l.antenatal_bleeding_episode ? `${l.vaginal_bleeding_ml} mL` : 'None'}</td>
                  <td>{l.maternal_sbp && l.maternal_dbp ? `${l.maternal_sbp}/${l.maternal_dbp}` : '-'} ({l.maternal_hr ? `${l.maternal_hr} bpm` : ''})</td>
                  <td>{l.ctg_category.replace(/_/g, ' ')}</td>
                  <td>{l.hemoglobin_g_dl ? `${l.hemoglobin_g_dl} g/dL` : '-'}</td>
                  <td>{l.crossmatch_units_confirmed ? 'Verified' : 'Pending'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No antenatal bleeding logs recorded.</p>
        )}
      </div>

      <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <p>___________________________________<br />Lead Obstetrician / MFM Specialist</p>
        </div>
        <div>
          <p>___________________________________<br />Obstetric Anesthesiologist</p>
        </div>
      </div>
    </div>
  );
};
