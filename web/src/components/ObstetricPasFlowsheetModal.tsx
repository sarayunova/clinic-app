import React, { useState } from 'react';
import { logObstetricPasFlowsheet } from '../api';

interface Props {
  episodeId: number;
  gestationWeeks?: number;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricPasFlowsheetModal: React.FC<Props> = ({
  episodeId,
  gestationWeeks = 33,
  onClose,
  onSaved,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [gw, setGw] = useState(gestationWeeks);
  const [bleedingEpisode, setBleedingEpisode] = useState(false);
  const [bleedingMl, setBleedingMl] = useState(0);
  const [sbp, setSbp] = useState<number | ''>(118);
  const [dbp, setDbp] = useState<number | ''>(74);
  const [hr, setHr] = useState<number | ''>(82);
  const [ctgCategory, setCtgCategory] = useState('category_1');
  const [hb, setHb] = useState<number | ''>(11.2);
  const [crossmatchConfirmed, setCrossmatchConfirmed] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await logObstetricPasFlowsheet(episodeId, {
        logDatetime,
        gestationWeeks: Number(gw),
        antenatalBleedingEpisode: bleedingEpisode,
        vaginalBleedingMl: Number(bleedingMl),
        maternalSbp: sbp === '' ? null : Number(sbp),
        maternalDbp: dbp === '' ? null : Number(dbp),
        maternalHr: hr === '' ? null : Number(hr),
        ctgCategory,
        hemoglobinGDl: hb === '' ? null : Number(hb),
        crossmatchUnitsConfirmed: crossmatchConfirmed,
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
        <h3>🩸 Log Antenatal PAS Surveillance Checkpoint</h3>
        <p className="muted">Monitor vaginal bleeding episodes, maternal hemodynamics, CTG status and blood bank reservation</p>

        <form onSubmit={handleSubmit}>
          <div className="grid col-2 gap-1">
            <div>
              <label>Log Datetime</label>
              <input type="datetime-local" value={logDatetime} onChange={(e) => setLogDatetime(e.target.value)} required />
            </div>
            <div>
              <label>Gestation (weeks)</label>
              <input type="number" step="0.1" value={gw} onChange={(e) => setGw(parseFloat(e.target.value) || 0)} required />
            </div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <label className="checkbox">
              <input type="checkbox" checked={bleedingEpisode} onChange={(e) => setBleedingEpisode(e.target.checked)} />
              <strong>Active Vaginal Bleeding Episode</strong>
            </label>
            {bleedingEpisode && (
              <div style={{ marginTop: '0.5rem' }}>
                <label>Measured Bleeding Volume (mL)</label>
                <input type="number" min="0" value={bleedingMl} onChange={(e) => setBleedingMl(parseFloat(e.target.value) || 0)} />
              </div>
            )}
          </div>

          <div className="grid col-3 gap-1" style={{ marginTop: '0.75rem' }}>
            <div>
              <label>Maternal SBP</label>
              <input type="number" value={sbp} onChange={(e) => setSbp(e.target.value === '' ? '' : parseInt(e.target.value, 10))} />
            </div>
            <div>
              <label>Maternal DBP</label>
              <input type="number" value={dbp} onChange={(e) => setDbp(e.target.value === '' ? '' : parseInt(e.target.value, 10))} />
            </div>
            <div>
              <label>Maternal HR (bpm)</label>
              <input type="number" value={hr} onChange={(e) => setHr(e.target.value === '' ? '' : parseInt(e.target.value, 10))} />
            </div>
          </div>

          <div className="grid col-2 gap-1" style={{ marginTop: '0.75rem' }}>
            <div>
              <label>CTG Category</label>
              <select value={ctgCategory} onChange={(e) => setCtgCategory(e.target.value)}>
                <option value="category_1">Category I (Normal / Reactive)</option>
                <option value="category_2">Category II (Indeterminate)</option>
                <option value="category_3">Category III (Abnormal / Fetal Distress)</option>
              </select>
            </div>
            <div>
              <label>Hemoglobin (g/dL)</label>
              <input type="number" step="0.1" value={hb} onChange={(e) => setHb(e.target.value === '' ? '' : parseFloat(e.target.value))} />
            </div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <label className="checkbox">
              <input type="checkbox" checked={crossmatchConfirmed} onChange={(e) => setCrossmatchConfirmed(e.target.checked)} />
              <strong>Blood Bank Crossmatch Units Confirmed & Valid in OR Fridge</strong>
            </label>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <label>Nurse / Fellow Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bleeding stopped after rest, IV access checked, patient reassured..." />
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
