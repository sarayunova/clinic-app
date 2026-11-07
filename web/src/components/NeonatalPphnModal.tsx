import React, { useState, useEffect } from 'react';
import { calculateNeonatalPphn, createNeonatalPphnEpisode } from '../api';

interface Props {
  patientId: number;
  gestationalAgeWeeks?: number;
  birthWeightGrams?: number;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalPphnModal: React.FC<Props> = ({
  patientId,
  gestationalAgeWeeks = 38,
  birthWeightGrams = 3100,
  onClose,
  onSaved,
}) => {
  const [gestAge, setGestAge] = useState(gestationalAgeWeeks);
  const [birthWeight, setBirthWeight] = useState(birthWeightGrams);
  const [onsetDatetime, setOnsetDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [etiology, setEtiology] = useState('meconium_aspiration_syndrome');

  // Respiratory & Blood Gas Parameters
  const [preductalSpo2, setPreductalSpo2] = useState(90);
  const [postductalSpo2, setPostductalSpo2] = useState(78);
  const [meanAirwayPressure, setMeanAirwayPressure] = useState(14);
  const [fio2, setFio2] = useState(100);
  const [pao2, setPao2] = useState(50);

  // Echocardiography
  const [trVelocity, setTrVelocity] = useState<number | ''>(3.8);
  const [rvsp, setRvsp] = useState<number | ''>(65);
  const [shuntDirection, setShuntDirection] = useState<'right_to_left' | 'bidirectional' | 'left_to_right'>('right_to_left');

  // Vasodilator & iNO therapy
  const [inoActive, setInoActive] = useState(true);
  const [inoDose, setInoDose] = useState(20);
  const [metHb, setMetHb] = useState<number | ''>(1.2);
  const [sildenafil, setSildenafil] = useState(false);
  const [milrinone, setMilrinone] = useState(false);
  const [status, setStatus] = useState('active_ino_therapy');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    void calculateNeonatalPphn({
      gestationalAgeWeeks: gestAge,
      birthWeightGrams: birthWeight,
      primaryEtiology: etiology,
      preductalSpo2,
      postductalSpo2,
      meanAirwayPressureCmh2o: meanAirwayPressure,
      fio2Percent: fio2,
      pao2Mmhg: pao2,
      echoTrJetVelocityMs: trVelocity === '' ? undefined : Number(trVelocity),
      echoEstimatedRvspMmhg: rvsp === '' ? undefined : Number(rvsp),
      echoShuntDirection: shuntDirection,
      inoDosePpm: inoDose,
      methemoglobinPercent: metHb === '' ? undefined : Number(metHb),
    }).then((res) => setPreview(res.evalResult));
  }, [
    gestAge,
    birthWeight,
    etiology,
    preductalSpo2,
    postductalSpo2,
    meanAirwayPressure,
    fio2,
    pao2,
    trVelocity,
    rvsp,
    shuntDirection,
    inoDose,
    metHb,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createNeonatalPphnEpisode({
        patientId,
        onsetDatetime,
        gestationalAgeWeeks: Number(gestAge),
        birthWeightGrams: Number(birthWeight),
        primaryEtiology: etiology,
        preductalSpo2: Number(preductalSpo2),
        postductalSpo2: Number(postductalSpo2),
        meanAirwayPressureCmh2o: Number(meanAirwayPressure),
        fio2Percent: Number(fio2),
        pao2Mmhg: Number(pao2),
        echoTrJetVelocityMs: trVelocity === '' ? undefined : Number(trVelocity),
        echoEstimatedRvspMmhg: rvsp === '' ? undefined : Number(rvsp),
        echoShuntDirection: shuntDirection,
        inoActive,
        inoDosePpm: Number(inoDose),
        methemoglobinPercent: metHb === '' ? undefined : Number(metHb),
        sildenafilActive: sildenafil,
        milrinoneActive: milrinone,
        status,
        clinicalNotes: notes,
      });
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save PPHN episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 840, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>🫁 Neonatal PPHN & Inhaled Nitric Oxide (iNO) Protocol</h2>
          <button type="button" className="btn small" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="stack">
          {preview && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                backgroundColor:
                  preview.severityTier === 'critical_ecmo_oi_40_plus'
                    ? '#fee2e2'
                    : preview.severityTier === 'severe_oi_25_39'
                    ? '#ffedd5'
                    : '#e0f2fe',
                borderLeft: `5px solid ${
                  preview.severityTier === 'critical_ecmo_oi_40_plus'
                    ? '#dc2626'
                    : preview.severityTier === 'severe_oi_25_39'
                    ? '#f97316'
                    : '#0284c7'
                }`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 16 }}>{preview.severityTitle}</strong>
                <span className="badge" style={{ fontSize: 14, fontWeight: 'bold' }}>
                  OI: {preview.calculatedOi} · Gradient: {preview.spo2Gradient}%
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 13 }}>{preview.ductalShuntInterpretation}</p>
              {preview.inoRecommended && (
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#0369a1', fontWeight: 600 }}>
                  ✓ Recommended iNO Starting Dose: {preview.recommendedInoDosePpm} ppm
                </p>
              )}
              {preview.ecmoReferralIndicated && (
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#b91c1c', fontWeight: 700 }}>
                  🚨 CRITICAL: Oxygenation Index $\ge 40$. Immediate Neonatal ECMO team notification indicated!
                </p>
              )}
            </div>
          )}

          <fieldset className="card">
            <legend>Infant Demographics & Onset</legend>
            <div className="grid2">
              <div>
                <label>Gestational Age (weeks)</label>
                <input
                  type="number"
                  step="0.1"
                  min="22"
                  max="44"
                  value={gestAge}
                  onChange={(e) => setGestAge(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label>Birth Weight (grams)</label>
                <input
                  type="number"
                  min="300"
                  max="6000"
                  value={birthWeight}
                  onChange={(e) => setBirthWeight(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label>Onset Datetime</label>
                <input
                  type="datetime-local"
                  value={onsetDatetime}
                  onChange={(e) => setOnsetDatetime(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Primary Etiology</label>
                <select value={etiology} onChange={(e) => setEtiology(e.target.value)}>
                  <option value="meconium_aspiration_syndrome">Meconium Aspiration Syndrome (MAS)</option>
                  <option value="idiopathic">Idiopathic Persistent Pulmonary HTN</option>
                  <option value="respiratory_distress_syndrome">Severe RDS with PPHN</option>
                  <option value="congenital_diaphragmatic_hernia">Congenital Diaphragmatic Hernia (CDH)</option>
                  <option value="neonatal_pneumonia_sepsis">Neonatal Sepsis / GBS Pneumonia</option>
                  <option value="pulmonary_hypoplasia">Oligohydramnios / Pulmonary Hypoplasia</option>
                  <option value="other">Other / Unclassified</option>
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset className="card">
            <legend>Blood Gas & Oxygenation Parameters</legend>
            <div className="grid2">
              <div>
                <label>Pre-ductal SpO2 (%) [Right Hand]</label>
                <input
                  type="number"
                  min="30"
                  max="100"
                  value={preductalSpo2}
                  onChange={(e) => setPreductalSpo2(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label>Post-ductal SpO2 (%) [Lower Limb]</label>
                <input
                  type="number"
                  min="30"
                  max="100"
                  value={postductalSpo2}
                  onChange={(e) => setPostductalSpo2(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label>Mean Airway Pressure (MAP, cmH2O)</label>
                <input
                  type="number"
                  step="0.5"
                  min="4"
                  max="35"
                  value={meanAirwayPressure}
                  onChange={(e) => setMeanAirwayPressure(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label>Fraction of Inspired Oxygen (FiO2 %)</label>
                <input
                  type="number"
                  min="21"
                  max="100"
                  value={fio2}
                  onChange={(e) => setFio2(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label>PaO2 (arterial blood gas, mmHg)</label>
                <input
                  type="number"
                  min="15"
                  max="350"
                  value={pao2}
                  onChange={(e) => setPao2(Number(e.target.value))}
                  required
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="card">
            <legend>Echocardiography & Ductal Shunting</legend>
            <div className="grid2">
              <div>
                <label>TR Jet Velocity (m/s)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 3.8"
                  value={trVelocity}
                  onChange={(e) => setTrVelocity(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <label>Estimated RVSP (mmHg)</label>
                <input
                  type="number"
                  placeholder="e.g. 65"
                  value={rvsp}
                  onChange={(e) => setRvsp(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <label>Ductal / Foramen Ovale Shunt Direction</label>
                <select value={shuntDirection} onChange={(e) => setShuntDirection(e.target.value as any)}>
                  <option value="right_to_left">Right-to-Left (Severe Suprasystemic HTN)</option>
                  <option value="bidirectional">Bidirectional (Equisystemic HTN)</option>
                  <option value="left_to_right">Left-to-Right (Normal / Subsystemic)</option>
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset className="card">
            <legend>Inhaled Nitric Oxide & Secondary Vasodilators</legend>
            <div className="grid2">
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={inoActive}
                    onChange={(e) => setInoActive(e.target.checked)}
                  />
                  <strong>Inhaled Nitric Oxide (iNO) Active</strong>
                </label>
              </div>
              <div>
                <label>iNO Dose (ppm)</label>
                <input
                  type="number"
                  min="0"
                  max="80"
                  disabled={!inoActive}
                  value={inoDose}
                  onChange={(e) => setInoDose(Number(e.target.value))}
                />
              </div>
              <div>
                <label>Methemoglobin (%)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Normal < 2.5%"
                  value={metHb}
                  onChange={(e) => setMetHb(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={sildenafil}
                    onChange={(e) => setSildenafil(e.target.checked)}
                  />
                  <span>IV Sildenafil (PDE-5 Inhibitor) Active</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={milrinone}
                    onChange={(e) => setMilrinone(e.target.checked)}
                  />
                  <span>IV Milrinone (Inodilator) Active</span>
                </label>
              </div>
              <div>
                <label>Episode Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="evaluating">Evaluating / Pre-iNO</option>
                  <option value="active_ino_therapy">Active iNO Therapy</option>
                  <option value="weaning_ino">Weaning iNO</option>
                  <option value="ecmo_referred">Referred for ECMO</option>
                  <option value="resolved_weaned">Resolved / Successfully Weaned</option>
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset className="card">
            <legend>Clinical Notes</legend>
            <textarea
              rows={3}
              placeholder="Record ventilator settings, inotrope infusions, response to iNO titration..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </fieldset>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving...' : 'Initiate PPHN Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
