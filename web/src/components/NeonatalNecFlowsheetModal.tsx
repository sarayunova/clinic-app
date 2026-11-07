import React, { useState } from 'react';
import { logNeonatalNecFlowsheet } from '../api';

interface Props {
  episodeId: number;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalNecFlowsheetModal: React.FC<Props> = ({
  episodeId,
  onClose,
  onSaved,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromOnset, setHoursFromOnset] = useState(6);
  const [girthCm, setGirthCm] = useState<number | ''>(24.5);
  const [residualVolumeMl, setResidualVolumeMl] = useState<number | ''>(8);
  const [residualChar, setResidualChar] = useState('bilious');
  const [bowelSounds, setBowelSounds] = useState('hypoactive');
  const [wallAppearance, setWallAppearance] = useState('distended_soft');
  const [platelets, setPlatelets] = useState<number | ''>(90000);
  const [abgPh, setAbgPh] = useState<number | ''>(7.30);
  const [lactate, setLactate] = useState<number | ''>(2.5);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await logNeonatalNecFlowsheet(episodeId, {
        logDatetime,
        hoursFromOnset: Number(hoursFromOnset),
        abdominalGirthCm: girthCm === '' ? null : Number(girthCm),
        gastricResidualVolumeMl: residualVolumeMl === '' ? null : Number(residualVolumeMl),
        gastricResidualCharacter: residualChar,
        bowelSounds,
        abdominalWallAppearance: wallAppearance,
        plateletCount: platelets === '' ? null : Number(platelets),
        abgPh: abgPh === '' ? null : Number(abgPh),
        lactateMmolL: lactate === '' ? null : Number(lactate),
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
        <h3>📏 Log Serial NEC Abdominal & Vitals Checkpoint</h3>
        <p className="muted">Serial measurement of abdominal circumference, gastric residuals, and metabolic parameters</p>

        <form onSubmit={handleSubmit}>
          <div className="grid col-2 gap-1">
            <div>
              <label>Log Datetime</label>
              <input type="datetime-local" value={logDatetime} onChange={(e) => setLogDatetime(e.target.value)} required />
            </div>
            <div>
              <label>Hours from Onset</label>
              <input type="number" step="0.5" value={hoursFromOnset} onChange={(e) => setHoursFromOnset(parseFloat(e.target.value) || 0)} required />
            </div>
          </div>

          <div className="grid col-2 gap-1" style={{ marginTop: '0.75rem' }}>
            <div>
              <label>Abdominal Girth (cm)</label>
              <input type="number" step="0.1" value={girthCm} onChange={(e) => setGirthCm(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="Measured at umbilicus" />
            </div>
            <div>
              <label>Gastric Residual Volume (mL)</label>
              <input type="number" step="0.5" value={residualVolumeMl} onChange={(e) => setResidualVolumeMl(e.target.value === '' ? '' : parseFloat(e.target.value))} />
            </div>
          </div>

          <div className="grid col-3 gap-1" style={{ marginTop: '0.75rem' }}>
            <div>
              <label>Residual Character</label>
              <select value={residualChar} onChange={(e) => setResidualChar(e.target.value)}>
                <option value="clear">Clear / Saliva</option>
                <option value="curdled_milk">Curdled Milk</option>
                <option value="bilious">Bilious (Dark green)</option>
                <option value="feculent">Feculent (Late)</option>
                <option value="blood_stained">Blood Stained / Coffee Ground</option>
              </select>
            </div>
            <div>
              <label>Bowel Sounds</label>
              <select value={bowelSounds} onChange={(e) => setBowelSounds(e.target.value)}>
                <option value="normal">Normal</option>
                <option value="hypoactive">Hypoactive</option>
                <option value="absent">Absent (Silent / Ileus)</option>
              </select>
            </div>
            <div>
              <label>Abdominal Wall</label>
              <select value={wallAppearance} onChange={(e) => setWallAppearance(e.target.value)}>
                <option value="normal">Normal Soft</option>
                <option value="distended_soft">Distended Soft</option>
                <option value="erythematous">Erythematous / Shiny</option>
                <option value="indurated_tender">Indurated / Tender</option>
                <option value="discolored_bluish">Discolored / Bluish</option>
              </select>
            </div>
          </div>

          <div className="grid col-3 gap-1" style={{ marginTop: '0.75rem' }}>
            <div>
              <label>Platelets (/uL)</label>
              <input type="number" value={platelets} onChange={(e) => setPlatelets(e.target.value === '' ? '' : parseInt(e.target.value, 10))} />
            </div>
            <div>
              <label>ABG pH</label>
              <input type="number" step="0.01" value={abgPh} onChange={(e) => setAbgPh(e.target.value === '' ? '' : parseFloat(e.target.value))} />
            </div>
            <div>
              <label>Lactate (mmol/L)</label>
              <input type="number" step="0.1" value={lactate} onChange={(e) => setLactate(e.target.value === '' ? '' : parseFloat(e.target.value))} />
            </div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <label>Nurse / Fellow Observations</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Replogle tube patency, signs of peritonitis, fluid balance..." />
          </div>

          <div className="actions" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving...' : 'Record Flowsheet'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
