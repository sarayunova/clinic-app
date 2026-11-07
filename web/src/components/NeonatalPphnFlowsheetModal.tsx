import React, { useState } from 'react';
import { logNeonatalPphnFlowsheet } from '../api';
import { calculateOxygenationIndex, calculateSpo2Gradient } from '../neonatalPphnEngine';

interface Props {
  episodeId: number;
  lastPreductal?: number;
  lastPostductal?: number;
  lastMap?: number;
  lastFio2?: number;
  lastPao2?: number;
  lastInoDose?: number;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalPphnFlowsheetModal: React.FC<Props> = ({
  episodeId,
  lastPreductal = 92,
  lastPostductal = 84,
  lastMap = 14,
  lastFio2 = 80,
  lastPao2 = 65,
  lastInoDose = 20,
  onClose,
  onSaved,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromOnset, setHoursFromOnset] = useState(4);
  const [preductal, setPreductal] = useState(lastPreductal);
  const [postductal, setPostductal] = useState(lastPostductal);
  const [map, setMap] = useState(lastMap);
  const [fio2, setFio2] = useState(lastFio2);
  const [pao2, setPao2] = useState(lastPao2);
  const [inoDose, setInoDose] = useState(lastInoDose);
  const [metHb, setMetHb] = useState<number | ''>(1.4);
  const [no2Circuit, setNo2Circuit] = useState<number | ''>(0.2);
  const [meanArterialPressure, setMeanArterialPressure] = useState<number | ''>(48);
  const [inotropicScore, setInotropicScore] = useState<number | ''>(10);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const currentGradient = calculateSpo2Gradient(preductal, postductal);
  const currentOi = calculateOxygenationIndex(map, fio2, pao2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await logNeonatalPphnFlowsheet(episodeId, {
        logDatetime,
        hoursFromOnset: Number(hoursFromOnset),
        preductalSpo2: Number(preductal),
        postductalSpo2: Number(postductal),
        mapCmh2o: Number(map),
        fio2Percent: Number(fio2),
        pao2Mmhg: Number(pao2),
        inoDosePpm: Number(inoDose),
        methemoglobinPercent: metHb === '' ? undefined : Number(metHb),
        circuitNo2Ppm: no2Circuit === '' ? undefined : Number(no2Circuit),
        meanArterialPressureMmhg: meanArterialPressure === '' ? undefined : Number(meanArterialPressure),
        inotropicScore: inotropicScore === '' ? undefined : Number(inotropicScore),
        notes,
      });
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to record flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>⏱️ Log PPHN & iNO Titration Observation</h3>
          <button type="button" className="btn small" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="stack">
          <div style={{ padding: '8px 12px', borderRadius: 6, backgroundColor: '#f0f9ff', display: 'flex', justifyContent: 'space-between' }}>
            <span>Calculated Oxygenation Index (OI): <strong>{currentOi}</strong></span>
            <span>SpO2 Gradient: <strong>{currentGradient}%</strong></span>
          </div>

          <div className="grid2">
            <div>
              <label>Log Datetime</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Hours from Onset</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={hoursFromOnset}
                onChange={(e) => setHoursFromOnset(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>Pre-ductal SpO2 (%)</label>
              <input
                type="number"
                min="30"
                max="100"
                value={preductal}
                onChange={(e) => setPreductal(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>Post-ductal SpO2 (%)</label>
              <input
                type="number"
                min="30"
                max="100"
                value={postductal}
                onChange={(e) => setPostductal(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>MAP (cmH2O)</label>
              <input
                type="number"
                step="0.5"
                min="4"
                max="35"
                value={map}
                onChange={(e) => setMap(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>FiO2 (%)</label>
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
              <label>PaO2 (mmHg)</label>
              <input
                type="number"
                min="15"
                max="350"
                value={pao2}
                onChange={(e) => setPao2(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>iNO Dose (ppm)</label>
              <input
                type="number"
                min="0"
                max="80"
                value={inoDose}
                onChange={(e) => setInoDose(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>Methemoglobin (%)</label>
              <input
                type="number"
                step="0.1"
                placeholder="Alert if > 2.5%"
                value={metHb}
                onChange={(e) => setMetHb(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label>Circuit NO2 (ppm)</label>
              <input
                type="number"
                step="0.1"
                placeholder="Must be < 1.0 ppm"
                value={no2Circuit}
                onChange={(e) => setNo2Circuit(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label>Mean Arterial Pressure (MAP, mmHg)</label>
              <input
                type="number"
                placeholder="e.g. 48"
                value={meanArterialPressure}
                onChange={(e) => setMeanArterialPressure(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label>Inotropic Score</label>
              <input
                type="number"
                step="0.5"
                placeholder="Dop + Dob + 100*Epi"
                value={inotropicScore}
                onChange={(e) => setInotropicScore(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label>Notes</label>
            <input
              type="text"
              placeholder="e.g. Weaning step from 20 to 10 ppm tolerated well..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving...' : 'Record Observation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
