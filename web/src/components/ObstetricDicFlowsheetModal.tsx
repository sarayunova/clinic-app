import React, { useState } from 'react';
import { addObstetricDicFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricDicFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen = true,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().slice(0, 16));
  const [systolicBp, setSystolicBp] = useState<string>('95');
  const [diastolicBp, setDiastolicBp] = useState<string>('58');
  const [heartRateBpm, setHeartRateBpm] = useState<string>('118');
  const [spo2Percent, setSpo2Percent] = useState<string>('98');
  const [hourlyBloodLossMl, setHourlyBloodLossMl] = useState<number>(250);
  const [serialFibrinogenMgDl, setSerialFibrinogenMgDl] = useState<string>('165');
  const [serialPlateletsKUl, setSerialPlateletsKUl] = useState<string>('82');
  const [serialInr, setSerialInr] = useState<string>('1.35');
  const [urineOutputMlHr, setUrineOutputMlHr] = useState<string>('40');
  const [bloodComponentsInfused, setBloodComponentsInfused] = useState<string>('2 PRBC + 2 FFP + 10 Cryo');
  const [clinicalHemostasisState, setClinicalHemostasisState] = useState<
    'uncontrolled_diffuse_ooze' | 'partial_clot_formation' | 'firm_hemostatic_clots' | 'bleeding_controlled'
  >('partial_clot_formation');
  const [nurseNotes, setNurseNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      recordedAt,
      systolicBp: systolicBp ? parseInt(systolicBp) : null,
      diastolicBp: diastolicBp ? parseInt(diastolicBp) : null,
      heartRateBpm: heartRateBpm ? parseInt(heartRateBpm) : null,
      spo2Percent: spo2Percent ? parseFloat(spo2Percent) : null,
      hourlyBloodLossMl,
      serialFibrinogenMgDl: serialFibrinogenMgDl ? parseFloat(serialFibrinogenMgDl) : null,
      serialPlateletsKUl: serialPlateletsKUl ? parseFloat(serialPlateletsKUl) : null,
      serialInr: serialInr ? parseFloat(serialInr) : null,
      urineOutputMlHr: urineOutputMlHr ? parseFloat(urineOutputMlHr) : null,
      bloodComponentsInfused: bloodComponentsInfused || null,
      clinicalHemostasisState,
      nurseNotes: nurseNotes || null,
    };

    try {
      await addObstetricDicFlowsheet(episodeId, payload);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record DIC flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal card" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Add Hourly Hemostasis & Transfusion Checkpoint</h3>
          <button className="btn small" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {error && <div className="alert banner danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label>Log Time *</label>
              <input
                type="datetime-local"
                value={recordedAt}
                onChange={(e) => setRecordedAt(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Hourly Blood Loss (mL) *</label>
              <input
                type="number"
                min="0"
                step="25"
                value={hourlyBloodLossMl}
                onChange={(e) => setHourlyBloodLossMl(parseInt(e.target.value) || 0)}
                required
              />
            </div>
            <div>
              <label>Blood Pressure (Sys / Dia)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number"
                  placeholder="Sys"
                  value={systolicBp}
                  onChange={(e) => setSystolicBp(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Dia"
                  value={diastolicBp}
                  onChange={(e) => setDiastolicBp(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label>Heart Rate (bpm)</label>
              <input
                type="number"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(e.target.value)}
              />
            </div>
            <div>
              <label>Serial Fibrinogen (mg/dL)</label>
              <input
                type="number"
                step="1"
                value={serialFibrinogenMgDl}
                onChange={(e) => setSerialFibrinogenMgDl(e.target.value)}
                placeholder="Target >= 200"
              />
            </div>
            <div>
              <label>Serial Platelets (x10^3/µL)</label>
              <input
                type="number"
                step="1"
                value={serialPlateletsKUl}
                onChange={(e) => setSerialPlateletsKUl(e.target.value)}
              />
            </div>
            <div>
              <label>Serial INR</label>
              <input
                type="number"
                step="0.05"
                value={serialInr}
                onChange={(e) => setSerialInr(e.target.value)}
              />
            </div>
            <div>
              <label>Urine Output (mL/hr)</label>
              <input
                type="number"
                step="5"
                value={urineOutputMlHr}
                onChange={(e) => setUrineOutputMlHr(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Clinical Hemostasis / Clot Formation *</label>
            <select
              value={clinicalHemostasisState}
              onChange={(e) => setClinicalHemostasisState(e.target.value as any)}
            >
              <option value="uncontrolled_diffuse_ooze">Uncontrolled Diffuse Microvascular Ooze</option>
              <option value="partial_clot_formation">Partial Clot Formation (Soft / Friable)</option>
              <option value="firm_hemostatic_clots">Firm Hemostatic Clots Forming</option>
              <option value="bleeding_controlled">Bleeding Completely Controlled</option>
            </select>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Transfusion / Blood Components Infused in Past Hour</label>
            <input
              type="text"
              placeholder="e.g. 2 PRBC, 2 FFP, 10 Cryoprecipitate, 1g Calcium Gluconate"
              value={bloodComponentsInfused}
              onChange={(e) => setBloodComponentsInfused(e.target.value)}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Nurse / Surgical Notes</label>
            <textarea
              rows={2}
              placeholder="Uterine tone, surgical drain output, warming blanket status..."
              value={nurseNotes}
              onChange={(e) => setNurseNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Recording...' : 'Log Transfusion Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
