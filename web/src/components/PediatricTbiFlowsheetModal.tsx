import React, { useState } from 'react';
import { logPediatricTbiFlowsheet } from '../api';

interface Props {
  episodeId: number;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricTbiFlowsheetModal: React.FC<Props> = ({
  episodeId,
  onClose,
  onSaved,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [minutesFromInjury, setMinutesFromInjury] = useState(45);
  const [gcsEye, setGcsEye] = useState(3);
  const [gcsVerbal, setGcsVerbal] = useState(4);
  const [gcsMotor, setGcsMotor] = useState(5);
  const [pupilReactivity, setPupilReactivity] = useState('brisk_bilateral');
  const [pupilRight, setPupilRight] = useState<number | ''>(3.0);
  const [pupilLeft, setPupilLeft] = useState<number | ''>(3.0);

  const [hr, setHr] = useState<number | ''>(110);
  const [sbp, setSbp] = useState<number | ''>(102);
  const [dbp, setDbp] = useState<number | ''>(64);
  const [spo2, setSpo2] = useState<number | ''>(99);
  const [icp, setIcp] = useState<number | ''>('');
  const [sodium, setSodium] = useState<number | ''>(142);
  const [hyperosmolarBolus, setHyperosmolarBolus] = useState('none');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const gcsTotal = gcsEye + gcsVerbal + gcsMotor;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await logPediatricTbiFlowsheet(episodeId, {
        logDatetime,
        minutesFromInjury: Number(minutesFromInjury),
        gcsTotal,
        gcsEye,
        gcsVerbal,
        gcsMotor,
        pupilReactivity,
        pupilSizeRightMm: pupilRight === '' ? null : Number(pupilRight),
        pupilSizeLeftMm: pupilLeft === '' ? null : Number(pupilLeft),
        vitalsHr: hr === '' ? null : Number(hr),
        vitalsSbp: sbp === '' ? null : Number(sbp),
        vitalsDbp: dbp === '' ? null : Number(dbp),
        vitalsSpo2: spo2 === '' ? null : Number(spo2),
        icpMmhg: icp === '' ? null : Number(icp),
        serumSodiumMeqL: sodium === '' ? null : Number(sodium),
        hyperosmolarBolusGiven: hyperosmolarBolus,
        notes: notes || null,
      });
      onSaved();
    } catch (err: any) {
      alert(err.message || 'Error recording flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>🧠 Log Serial Pediatric Neuro-Check & ICP Vitals</h3>
        <p className="muted">Pediatric GCS breakdown, pupillometry, cerebral perfusion pressure & hyperosmolar therapy</p>

        <form onSubmit={handleSubmit}>
          <div className="grid col-2 gap-1">
            <div>
              <label>Log Datetime</label>
              <input type="datetime-local" value={logDatetime} onChange={(e) => setLogDatetime(e.target.value)} required />
            </div>
            <div>
              <label>Minutes from Injury</label>
              <input type="number" min="0" value={minutesFromInjury} onChange={(e) => setMinutesFromInjury(parseInt(e.target.value, 10) || 0)} required />
            </div>
          </div>

          <fieldset style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f5f8ff' }}>
            <legend><strong>Pediatric GCS Breakdown (Total: {gcsTotal}/15)</strong></legend>
            <div className="grid col-3 gap-1">
              <div>
                <label>Eye (1–4)</label>
                <select value={gcsEye} onChange={(e) => setGcsEye(parseInt(e.target.value, 10))}>
                  <option value={4}>4: Spontaneous</option>
                  <option value={3}>3: To speech/sound</option>
                  <option value={2}>2: To painful stimulus</option>
                  <option value={1}>1: None</option>
                </select>
              </div>
              <div>
                <label>Verbal (1–5)</label>
                <select value={gcsVerbal} onChange={(e) => setGcsVerbal(parseInt(e.target.value, 10))}>
                  <option value={5}>5: Coos/babbles/oriented</option>
                  <option value={4}>4: Irritable cry/confused</option>
                  <option value={3}>3: Inappropriate cry/words</option>
                  <option value={2}>2: Incomprehensible moaning</option>
                  <option value={1}>1: None</option>
                </select>
              </div>
              <div>
                <label>Motor (1–6)</label>
                <select value={gcsMotor} onChange={(e) => setGcsMotor(parseInt(e.target.value, 10))}>
                  <option value={6}>6: Spontaneous / Obeys</option>
                  <option value={5}>5: Localizes pain / touch</option>
                  <option value={4}>4: Normal flexion / withdraws</option>
                  <option value={3}>3: Decorticate (Abnormal flex)</option>
                  <option value={2}>2: Decerebrate (Extension)</option>
                  <option value={1}>1: Flaccid / None</option>
                </select>
              </div>
            </div>
          </fieldset>

          <div className="grid col-3 gap-1" style={{ marginTop: '0.75rem' }}>
            <div>
              <label>Pupil Reactivity</label>
              <select value={pupilReactivity} onChange={(e) => setPupilReactivity(e.target.value)}>
                <option value="brisk_bilateral">Brisk Bilateral</option>
                <option value="sluggish_bilateral">Sluggish Bilateral</option>
                <option value="unilateral_fixed_dilated">⚠️ Unilateral Fixed & Dilated (Herniation)</option>
                <option value="bilateral_fixed_dilated">🚨 Bilateral Fixed & Dilated</option>
              </select>
            </div>
            <div>
              <label>Pupil Right (mm)</label>
              <input type="number" step="0.5" value={pupilRight} onChange={(e) => setPupilRight(e.target.value === '' ? '' : parseFloat(e.target.value))} />
            </div>
            <div>
              <label>Pupil Left (mm)</label>
              <input type="number" step="0.5" value={pupilLeft} onChange={(e) => setPupilLeft(e.target.value === '' ? '' : parseFloat(e.target.value))} />
            </div>
          </div>

          <div className="grid col-4 gap-1" style={{ marginTop: '0.75rem' }}>
            <div>
              <label>HR (bpm)</label>
              <input type="number" value={hr} onChange={(e) => setHr(e.target.value === '' ? '' : parseInt(e.target.value, 10))} />
            </div>
            <div>
              <label>SBP (mmHg)</label>
              <input type="number" value={sbp} onChange={(e) => setSbp(e.target.value === '' ? '' : parseInt(e.target.value, 10))} />
            </div>
            <div>
              <label>DBP (mmHg)</label>
              <input type="number" value={dbp} onChange={(e) => setDbp(e.target.value === '' ? '' : parseInt(e.target.value, 10))} />
            </div>
            <div>
              <label>SpO2 (%)</label>
              <input type="number" value={spo2} onChange={(e) => setSpo2(e.target.value === '' ? '' : parseFloat(e.target.value))} />
            </div>
          </div>

          <div className="grid col-3 gap-1" style={{ marginTop: '0.75rem' }}>
            <div>
              <label>ICP (mmHg)</label>
              <input type="number" step="0.5" value={icp} onChange={(e) => setIcp(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="Target < 20" />
            </div>
            <div>
              <label>Serum Na+ (mEq/L)</label>
              <input type="number" step="0.5" value={sodium} onChange={(e) => setSodium(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="Target 145-155" />
            </div>
            <div>
              <label>Hyperosmolar Bolus</label>
              <select value={hyperosmolarBolus} onChange={(e) => setHyperosmolarBolus(e.target.value)}>
                <option value="none">None Given</option>
                <option value="hypertonic_saline_3pct">3% Saline (3 mL/kg IV)</option>
                <option value="mannitol_20pct">20% Mannitol (0.5 g/kg IV)</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <label>Neuro-Critical Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Agitation treated, HOB 30 maintained, CPP calculated..." />
          </div>

          <div className="actions" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving...' : 'Record Checkpoint'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
