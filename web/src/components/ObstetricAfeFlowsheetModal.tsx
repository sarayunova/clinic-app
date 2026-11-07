import React, { useState } from 'react';
import { logObstetricAfeFlowsheet } from '../api';

interface Props {
  episodeId: number;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricAfeFlowsheetModal: React.FC<Props> = ({
  episodeId,
  onClose,
  onSaved,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [minutesFromArrest, setMinutesFromArrest] = useState(15);
  const [sbp, setSbp] = useState<number | ''>(85);
  const [dbp, setDbp] = useState<number | ''>(50);
  const [hr, setHr] = useState<number | ''>(125);
  const [spo2, setSpo2] = useState<number | ''>(91);
  const [etco2, setEtco2] = useState<number | ''>(24);
  const [vasopressor, setVasopressor] = useState<'none' | 'epinephrine' | 'norepinephrine' | 'vasopressin' | 'multiple'>('norepinephrine');
  const [fibrinogen, setFibrinogen] = useState<number | ''>(110);
  const [platelets, setPlatelets] = useState<number | ''>(65000);
  const [inr, setInr] = useState<number | ''>(2.2);
  const [qbl, setQbl] = useState<number | ''>(2200);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await logObstetricAfeFlowsheet(episodeId, {
        logDatetime,
        minutesFromArrest: Number(minutesFromArrest),
        sbpMmhg: sbp === '' ? undefined : Number(sbp),
        dbpMmhg: dbp === '' ? undefined : Number(dbp),
        hrBpm: hr === '' ? undefined : Number(hr),
        spo2Percent: spo2 === '' ? undefined : Number(spo2),
        etco2Mmhg: etco2 === '' ? undefined : Number(etco2),
        vasopressorActive: vasopressor,
        fibrinogenMgDl: fibrinogen === '' ? undefined : Number(fibrinogen),
        plateletCount: platelets === '' ? undefined : Number(platelets),
        inr: inr === '' ? undefined : Number(inr),
        qblTotalMl: qbl === '' ? undefined : Number(qbl),
        notes,
      });
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>⏱️ Log AFE Resuscitation Checkpoint</h3>
          <button type="button" className="btn small" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="stack">
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
              <label>Minutes from Arrest</label>
              <input
                type="number"
                min="0"
                value={minutesFromArrest}
                onChange={(e) => setMinutesFromArrest(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>Systolic BP (mmHg)</label>
              <input
                type="number"
                placeholder="Target >= 90"
                value={sbp}
                onChange={(e) => setSbp(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label>Diastolic BP (mmHg)</label>
              <input
                type="number"
                placeholder="e.g. 50"
                value={dbp}
                onChange={(e) => setDbp(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label>Heart Rate (bpm)</label>
              <input
                type="number"
                placeholder="e.g. 120"
                value={hr}
                onChange={(e) => setHr(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label>SpO2 (%)</label>
              <input
                type="number"
                placeholder="e.g. 92"
                value={spo2}
                onChange={(e) => setSpo2(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label>EtCO2 (mmHg) [Quality of CPR / Perfusion]</label>
              <input
                type="number"
                placeholder="Target > 20 mmHg"
                value={etco2}
                onChange={(e) => setEtco2(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label>Active Vasopressor Support</label>
              <select value={vasopressor} onChange={(e) => setVasopressor(e.target.value as any)}>
                <option value="none">None</option>
                <option value="norepinephrine">Norepinephrine (First-line)</option>
                <option value="vasopressin">Vasopressin (PVR sparing)</option>
                <option value="epinephrine">Epinephrine (Arrest dose / Infusion)</option>
                <option value="multiple">Multiple Inotropes / Vasopressors</option>
              </select>
            </div>
            <div>
              <label>Fibrinogen (mg/dL)</label>
              <input
                type="number"
                placeholder="Target >= 200"
                value={fibrinogen}
                onChange={(e) => setFibrinogen(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label>Platelet Count (/uL)</label>
              <input
                type="number"
                placeholder="Target >= 50,000"
                value={platelets}
                onChange={(e) => setPlatelets(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label>PT / INR</label>
              <input
                type="number"
                step="0.1"
                placeholder="Target < 1.5"
                value={inr}
                onChange={(e) => setInr(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label>Cumulative QBL (mL)</label>
              <input
                type="number"
                placeholder="e.g. 2500"
                value={qbl}
                onChange={(e) => setQbl(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label>Notes</label>
            <input
              type="text"
              placeholder="e.g. ROSC achieved. Transfusing 2nd MTP pack with 10 units Cryo..."
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
