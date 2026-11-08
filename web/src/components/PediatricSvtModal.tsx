import React, { useState, useEffect } from 'react';
import { createPediatricSvtEpisode, calculatePediatricSvt } from '../api';

interface PediatricSvtModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const PediatricSvtModal: React.FC<PediatricSvtModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [onsetDatetime, setOnsetDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [ageMonths, setAgeMonths] = useState(8);
  const [weightKg, setWeightKg] = useState(8.5);

  // Dysrhythmia & ECG
  const [heartRateBpm, setHeartRateBpm] = useState(250);
  const [qrsDurationMs, setQrsDurationMs] = useState(70);
  const [qrsMorphology, setQrsMorphology] = useState<string>('narrow_complex_le_0_09s');
  const [rhythmRegularity, setRhythmRegularity] = useState<string>('regular');
  const [pWavesIdentifiable, setPWavesIdentifiable] = useState(false);

  // Hemodynamic Stability
  const [hemodynamicStability, setHemodynamicStability] = useState<string>('stable_compensated');
  const [signsOfShock, setSignsOfShock] = useState<string>('none');

  // Interventions
  const [vagalManeuverAttempted, setVagalManeuverAttempted] = useState<string>('ice_bag_to_face_infant');
  const [vagalManeuverSuccessful, setVagalManeuverSuccessful] = useState(false);

  const [adenosineFirstDoseGiven, setAdenosineFirstDoseGiven] = useState(true);
  const [adenosineFirstDoseSuccessful, setAdenosineFirstDoseSuccessful] = useState(false);
  const [adenosineSecondDoseGiven, setAdenosineSecondDoseGiven] = useState(true);
  const [adenosineSecondDoseSuccessful, setAdenosineSecondDoseSuccessful] = useState(true);

  const [synchronizedCardioversionDelivered, setSynchronizedCardioversionDelivered] = useState(false);
  const [cardioversionSuccessful, setCardioversionSuccessful] = useState(false);
  const [maintenanceAntiarrhythmic, setMaintenanceAntiarrhythmic] = useState<string>('oral_propranolol');

  const [status, setStatus] = useState('converted_sinus_surveillance');
  const [clinicalNotes, setClinicalNotes] = useState('8mo infant presented with sudden onset pallor and lethargy. ECG showed SVT at 250 bpm. Converted to normal sinus rhythm after 2nd dose of rapid IV push Adenosine (0.2 mg/kg).');

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculatePediatricSvt({
      ageMonths,
      weightKg,
      heartRateBpm,
      qrsDurationMs,
      qrsMorphology,
      rhythmRegularity,
      pWavesIdentifiable,
      hemodynamicStability,
      vagalAttempted: vagalManeuverAttempted,
      priorAdenosineDosesGiven: adenosineSecondDoseGiven ? 2 : adenosineFirstDoseGiven ? 1 : 0,
    })
      .then((res) => {
        setPreview(res.evalResult);
        if (res.evalResult.recommendedVagalManeuver && vagalManeuverAttempted === 'none_unstable') {
          setVagalManeuverAttempted(res.evalResult.recommendedVagalManeuver);
        }
      })
      .catch(() => {});
  }, [
    ageMonths,
    weightKg,
    heartRateBpm,
    qrsDurationMs,
    qrsMorphology,
    rhythmRegularity,
    pWavesIdentifiable,
    hemodynamicStability,
    vagalManeuverAttempted,
    adenosineFirstDoseGiven,
    adenosineSecondDoseGiven,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createPediatricSvtEpisode({
        patientId,
        onsetDatetime,
        ageMonths: Number(ageMonths),
        weightKg: Number(weightKg),
        heartRateBpm: Number(heartRateBpm),
        qrsDurationMs: Number(qrsDurationMs),
        qrsMorphology,
        rhythmRegularity,
        pWavesIdentifiable,
        hemodynamicStability,
        signsOfShock,
        vagalManeuverAttempted,
        vagalManeuverSuccessful,
        adenosineFirstDoseGiven,
        adenosineFirstDoseSuccessful,
        adenosineSecondDoseGiven,
        adenosineSecondDoseSuccessful,
        synchronizedCardioversionDelivered,
        cardioversionSuccessful,
        maintenanceAntiarrhythmic,
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to record pediatric SVT episode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="modal-card" style={{ background: '#fff', borderRadius: 8, maxWidth: 880, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
          <div>
            <h3 style={{ margin: 0, color: '#dc2626' }}>⚡ Pediatric SVT & Emergency PALS Resuscitation</h3>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              PALS Vagal Techniques, Weight-Adjusted Adenosine Dosing & Synchronized Cardioversion for {patientName}
            </span>
          </div>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Section 1: Presentation & Demographics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Onset Date/Time</label>
              <input type="datetime-local" className="form-control" value={onsetDatetime} onChange={(e) => setOnsetDatetime(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Age (months)</label>
              <input type="number" className="form-control" value={ageMonths} onChange={(e) => setAgeMonths(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Weight (kg)</label>
              <input type="number" step="0.1" className="form-control" value={weightKg} onChange={(e) => setWeightKg(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Heart Rate (bpm)</label>
              <input type="number" className="form-control" value={heartRateBpm} onChange={(e) => setHeartRateBpm(Number(e.target.value))} required />
            </div>
          </div>

          {/* Section 2: ECG & Rhythm Analysis */}
          <div style={{ background: '#fef2f2', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #fecaca' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#991b1b', fontSize: '0.9rem' }}>ECG Rhythm & Morphometry</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>QRS Duration (ms)</label>
                <input type="number" className="form-control" value={qrsDurationMs} onChange={(e) => setQrsDurationMs(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>QRS Morphology</label>
                <select className="form-control" value={qrsMorphology} onChange={(e) => setQrsMorphology(e.target.value)}>
                  <option value="narrow_complex_le_0_09s">Narrow Complex (&le; 0.09s)</option>
                  <option value="wide_complex_aberrancy_gt_0_09s">Wide Complex / Aberrant (&gt; 0.09s)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Rhythm Regularity</label>
                <select className="form-control" value={rhythmRegularity} onChange={(e) => setRhythmRegularity(e.target.value)}>
                  <option value="regular">Regular</option>
                  <option value="irregular">Irregular</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 18 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={pWavesIdentifiable} onChange={(e) => setPWavesIdentifiable(e.target.checked)} />
                  <strong>P Waves Visible</strong>
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hemodynamic Stability</label>
                <select className="form-control" value={hemodynamicStability} onChange={(e) => setHemodynamicStability(e.target.value)}>
                  <option value="stable_compensated">Stable / Compensated (Good perfusion)</option>
                  <option value="unstable_decompensated_shock">Unstable / Decompensated Shock (Hypotension, AMS)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Signs of Shock</label>
                <select className="form-control" value={signsOfShock} onChange={(e) => setSignsOfShock(e.target.value)}>
                  <option value="none">None (Warm, alert)</option>
                  <option value="poor_perfusion_cap_refill_gt_3s">Delayed Capillary Refill &gt; 3s</option>
                  <option value="hypotension">Hypotension for Age</option>
                  <option value="lethargy_altered_mental_status">Lethargy / Altered Mental Status</option>
                  <option value="pulmonary_congestion">Pulmonary Edema / Crackles</option>
                </select>
              </div>
            </div>
          </div>

          {/* Real-time Calculation Preview Card */}
          {preview && (
            <div style={{ background: preview.synchronizedCardioversionIndicated ? '#fef2f2' : '#eff6ff', border: `1px solid ${preview.synchronizedCardioversionIndicated ? '#f87171' : '#bfdbfe'}`, padding: 12, borderRadius: 6, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: preview.synchronizedCardioversionIndicated ? '#b91c1c' : '#1e40af' }}>
                  {preview.summary}
                </strong>
                <span className={`badge ${preview.synchronizedCardioversionIndicated ? 'badge-danger' : 'badge-primary'}`}>
                  {preview.synchronizedCardioversionIndicated ? 'CARDIOVERSION INDICATED' : 'VAGAL & ADENOSINE'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8, fontSize: '0.85rem' }}>
                <div><strong>Adenosine 1st Dose (0.1 mg/kg):</strong> {preview.adenosineDose1Mg} mg</div>
                <div><strong>Adenosine 2nd Dose (0.2 mg/kg):</strong> {preview.adenosineDose2Mg} mg</div>
                <div><strong>Cardioversion Energy:</strong> {preview.initialCardioversionJoules} J (2nd: {preview.secondCardioversionJoules} J)</div>
              </div>
              <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#334155' }}>
                <p style={{ margin: '0 0 4px 0' }}><strong>Vagal Protocol:</strong> {preview.vagalGuidance}</p>
                <p style={{ margin: 0 }}><strong>Rapid Push Technique:</strong> {preview.adenosineAdministrationProtocol}</p>
              </div>
            </div>
          )}

          {/* Section 3: Interventions Delivered */}
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#334155', fontSize: '0.9rem' }}>Resuscitation Interventions Administered</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Vagal Maneuver</label>
                <select className="form-control" value={vagalManeuverAttempted} onChange={(e) => setVagalManeuverAttempted(e.target.value)}>
                  <option value="ice_bag_to_face_infant">Ice Bag to Face (Infant 15-20s)</option>
                  <option value="modified_valsalva_child">Modified Valsalva (Syringe blow)</option>
                  <option value="none_unstable">None / Unstable Shock</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', marginTop: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={vagalManeuverSuccessful} onChange={(e) => setVagalManeuverSuccessful(e.target.checked)} />
                  Converted on Vagal
                </label>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>IV Adenosine Doses</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={adenosineFirstDoseGiven} onChange={(e) => setAdenosineFirstDoseGiven(e.target.checked)} />
                    Dose 1 Given ({preview?.adenosineDose1Mg ?? 0.8} mg)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={adenosineSecondDoseGiven} onChange={(e) => setAdenosineSecondDoseGiven(e.target.checked)} />
                    Dose 2 Given ({preview?.adenosineDose2Mg ?? 1.6} mg)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={adenosineSecondDoseSuccessful} onChange={(e) => setAdenosineSecondDoseSuccessful(e.target.checked)} />
                    Converted on Adenosine
                  </label>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Electrical Cardioversion</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={synchronizedCardioversionDelivered} onChange={(e) => setSynchronizedCardioversionDelivered(e.target.checked)} />
                    Synchronized Shock Delivered
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={cardioversionSuccessful} onChange={(e) => setCardioversionSuccessful(e.target.checked)} />
                    Converted on Shock
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Maintenance & Disposition */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Maintenance Antiarrhythmic</label>
              <select className="form-control" value={maintenanceAntiarrhythmic} onChange={(e) => setMaintenanceAntiarrhythmic(e.target.value)}>
                <option value="none">None</option>
                <option value="oral_propranolol">Oral Propranolol Prophylaxis</option>
                <option value="amiodarone_infusion">Continuous IV Amiodarone Infusion</option>
                <option value="procainamide_infusion">IV Procainamide Infusion</option>
                <option value="esmolol_infusion">IV Esmolol Titration</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Episode Status</label>
              <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="acute_svt_resuscitation">Acute SVT Resuscitation</option>
                <option value="converted_sinus_surveillance">Converted (Sinus Rhythm Surveillance)</option>
                <option value="refractory_picu_transfer">Refractory (PICU Transfer)</option>
                <option value="discharged_maintenance_therapy">Discharged on Maintenance Therapy</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Notes & Resuscitation Summary</label>
            <textarea className="form-control" rows={2} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Record Pediatric SVT Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
