import React, { useState } from 'react';
import {
  addObstetricSptFlowsheet,
  type ObstetricSptRecord,
} from '../api';

interface Props {
  episode: ObstetricSptRecord;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricSptFlowsheetModal: React.FC<Props> = ({
  episode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [hoursSinceHeparinStart, setHoursSinceHeparinStart] = useState<number>(12);
  const [temperatureCelsius, setTemperatureCelsius] = useState<number>(
    episode.peak_temperature_celsius ?? 38.6
  );
  const [heartRate, setHeartRate] = useState<number>(92);
  const [systolicBp, setSystolicBp] = useState<number>(118);
  const [diastolicBp, setDiastolicBp] = useState<number>(74);
  const [apttSeconds, setApttSeconds] = useState<number | ''>(68);
  const [antiXaActivityIuMl, setAntiXaActivityIuMl] = useState<number | ''>('');
  const [heparinInfusionRateUnitsHr, setHeparinInfusionRateUnitsHr] = useState<number | ''>(1200);
  const [bleedingSigns, setBleedingSigns] = useState<
    'none' | 'mild_lochia_rubra' | 'wound_hematoma' | 'major_pelvic_hemorrhage'
  >('none');
  const [flankAbdominalPainScore, setFlankAbdominalPainScore] = useState<number>(3);
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await addObstetricSptFlowsheet(episode.id, {
        logDatetime,
        hoursSinceHeparinStart: Number(hoursSinceHeparinStart),
        temperatureCelsius: Number(temperatureCelsius),
        heartRate: Number(heartRate),
        systolicBp: Number(systolicBp),
        diastolicBp: Number(diastolicBp),
        apttSeconds: apttSeconds !== '' ? Number(apttSeconds) : null,
        antiXaActivityIuMl: antiXaActivityIuMl !== '' ? Number(antiXaActivityIuMl) : null,
        heparinInfusionRateUnitsHr: heparinInfusionRateUnitsHr !== '' ? Number(heparinInfusionRateUnitsHr) : null,
        bleedingSigns,
        flankAbdominalPainScore: Number(flankAbdominalPainScore),
        notes: notes.trim() || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record SPT flowsheet log.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card wide" style={{ maxWidth: '780px' }}>
        <div className="modal-header">
          <h2>📊 Heparin Challenge &amp; Defervescence Flowsheet Log</h2>
          <button type="button" className="btn-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Log Date &amp; Time</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={logDatetime}
                  onChange={(e) => setLogDatetime(e.target.value)}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Hours Since Heparin Started</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="240"
                  className="form-control"
                  value={hoursSinceHeparinStart}
                  onChange={(e) => setHoursSinceHeparinStart(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  min="35"
                  max="43"
                  className="form-control"
                  value={temperatureCelsius}
                  onChange={(e) => setTemperatureCelsius(Number(e.target.value))}
                  required
                />
                <small className="text-muted">&lt; 37.8°C indicates defervescence response</small>
              </div>

              <div className="col-md-6">
                <label className="form-label">Heart Rate (bpm)</label>
                <input
                  type="number"
                  min="40"
                  max="200"
                  className="form-control"
                  value={heartRate}
                  onChange={(e) => setHeartRate(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Blood Pressure (Systolic / Diastolic mmHg)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    min="60"
                    max="220"
                    className="form-control"
                    placeholder="Sys"
                    value={systolicBp}
                    onChange={(e) => setSystolicBp(Number(e.target.value))}
                    required
                  />
                  <input
                    type="number"
                    min="40"
                    max="140"
                    className="form-control"
                    placeholder="Dia"
                    value={diastolicBp}
                    onChange={(e) => setDiastolicBp(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="col-md-6">
                <label className="form-label">aPTT (seconds)</label>
                <input
                  type="number"
                  step="0.5"
                  min="20"
                  max="180"
                  className="form-control"
                  placeholder="Target 60-85s"
                  value={apttSeconds}
                  onChange={(e) => setApttSeconds(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Heparin Infusion Rate (units/hr)</label>
                <input
                  type="number"
                  step="50"
                  min="0"
                  max="3000"
                  className="form-control"
                  placeholder="e.g. 1200 units/hr"
                  value={heparinInfusionRateUnitsHr}
                  onChange={(e) => setHeparinInfusionRateUnitsHr(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Flank / Pelvic Pain Score (0 - 10)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  className="form-control"
                  value={flankAbdominalPainScore}
                  onChange={(e) => setFlankAbdominalPainScore(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Bleeding Signs / Hemorrhage Surveillance</label>
                <select
                  className="form-select"
                  value={bleedingSigns}
                  onChange={(e) => setBleedingSigns(e.target.value as any)}
                >
                  <option value="none">None (Stable Hemostasis)</option>
                  <option value="mild_lochia_rubra">Mild Expected Lochia Rubra</option>
                  <option value="wound_hematoma">Wound / Episiotomy Hematoma</option>
                  <option value="major_pelvic_hemorrhage">Major Bleeding / Transfusion Needed</option>
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">Anti-Xa Activity (IU/mL, if LMWH)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="2.0"
                  className="form-control"
                  placeholder="Target 0.6 - 1.0 IU/mL"
                  value={antiXaActivityIuMl}
                  onChange={(e) => setAntiXaActivityIuMl(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="col-md-12">
                <label className="form-label">Bedside Notes &amp; Observations</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="e.g. Defervesced to 37.2°C at hour 32 post-heparin. Flank pain improved from 6/10 to 2/10. No lochia excess."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Logging...' : 'Save Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
