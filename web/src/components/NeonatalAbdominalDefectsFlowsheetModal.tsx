import React, { useState } from 'react';
import {
  addNeonatalAbdominalDefectsFlowsheet,
  type NeonatalAbdominalDefectRecord,
} from '../api';

interface Props {
  episode: NeonatalAbdominalDefectRecord;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalAbdominalDefectsFlowsheetModal: React.FC<Props> = ({
  episode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [dayOfReduction, setDayOfReduction] = useState<number>(1);
  const [siloHeightReducedCm, setSiloHeightReducedCm] = useState<number>(1.0);
  const [residualSiloHeightCm, setResidualSiloHeightCm] = useState<number>(
    Math.max(0, (episode.silo_height_cm ?? 8.0) - 1.0)
  );
  const [bladderPressureMmHg, setBladderPressureMmHg] = useState<number>(
    episode.current_bladder_pressure_mmhg ?? 8.0
  );
  const [peakInspiratoryPressureCmH2O, setPeakInspiratoryPressureCmH2O] = useState<number>(
    episode.peak_inspiratory_pressure_cmh2o ?? 16.0
  );
  const [urineOutputMlKgHr, setUrineOutputMlKgHr] = useState<number>(2.5);
  const [lowerExtremityPerfusion, setLowerExtremityPerfusion] = useState<
    'warm_pink_pulses_brisk' | 'sluggish_cap_refill_delayed' | 'pale_cool_pulses_diminished'
  >('warm_pink_pulses_brisk');
  const [bowelVisceralColor, setBowelVisceralColor] = useState<
    'pink_viable' | 'hyperemic_mild_edema' | 'dusky_venous_congestion' | 'ischemic_black'
  >('pink_viable');
  const [heartRate, setHeartRate] = useState<number>(142);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(44);
  const [meanArterialPressureMmHg, setMeanArterialPressureMmHg] = useState<number>(45);
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await addNeonatalAbdominalDefectsFlowsheet(episode.id, {
        logDatetime,
        dayOfReduction: Number(dayOfReduction),
        siloHeightReducedCm: Number(siloHeightReducedCm),
        residualSiloHeightCm: Number(residualSiloHeightCm),
        bladderPressureMmHg: Number(bladderPressureMmHg),
        peakInspiratoryPressureCmH2O: Number(peakInspiratoryPressureCmH2O),
        urineOutputMlKgHr: Number(urineOutputMlKgHr),
        lowerExtremityPerfusion,
        bowelVisceralColor,
        heartRate: Number(heartRate),
        respiratoryRate: Number(respiratoryRate),
        meanArterialPressureMmHg: Number(meanArterialPressureMmHg),
        notes: notes.trim() || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record flowsheet log.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card wide" style={{ maxWidth: '780px' }}>
        <div className="modal-header">
          <h2>📊 Bedside Silo Reduction & Compartment Flowsheet Log</h2>
          <button type="button" className="btn-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Log Date & Time</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={logDatetime}
                  onChange={(e) => setLogDatetime(e.target.value)}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Day of Reduction</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  className="form-control"
                  value={dayOfReduction}
                  onChange={(e) => setDayOfReduction(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Silo Height Reduced (cm today)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="5"
                  className="form-control"
                  value={siloHeightReducedCm}
                  onChange={(e) => setSiloHeightReducedCm(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Residual Silo Height (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="25"
                  className="form-control"
                  value={residualSiloHeightCm}
                  onChange={(e) => setResidualSiloHeightCm(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Bladder Pressure (mmHg)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="40"
                  className="form-control"
                  value={bladderPressureMmHg}
                  onChange={(e) => setBladderPressureMmHg(Number(e.target.value))}
                  required
                />
                <small className="text-muted">&lt;10 Normal, 10-15 Watch, &gt;15 ACS Risk</small>
              </div>

              <div className="col-md-6">
                <label className="form-label">Peak Inspiratory Pressure (PIP cmH2O)</label>
                <input
                  type="number"
                  step="1"
                  min="5"
                  max="50"
                  className="form-control"
                  value={peakInspiratoryPressureCmH2O}
                  onChange={(e) => setPeakInspiratoryPressureCmH2O(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Urine Output (mL/kg/hr)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="15"
                  className="form-control"
                  value={urineOutputMlKgHr}
                  onChange={(e) => setUrineOutputMlKgHr(Number(e.target.value))}
                  required
                />
                <small className="text-muted">&lt;1.0 mL/kg/h indicates renal oliguria</small>
              </div>

              <div className="col-md-6">
                <label className="form-label">Lower Extremity Perfusion</label>
                <select
                  className="form-select"
                  value={lowerExtremityPerfusion}
                  onChange={(e) => setLowerExtremityPerfusion(e.target.value as any)}
                >
                  <option value="warm_pink_pulses_brisk">Warm, Pink, Femoral Pulses Brisk</option>
                  <option value="sluggish_cap_refill_delayed">Sluggish / Cap Refill &gt; 3s</option>
                  <option value="pale_cool_pulses_diminished">Pale, Cool, Pulses Diminished (ACS!)</option>
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">Bowel Visceral Color</label>
                <select
                  className="form-select"
                  value={bowelVisceralColor}
                  onChange={(e) => setBowelVisceralColor(e.target.value as any)}
                >
                  <option value="pink_viable">Pink &amp; Viable</option>
                  <option value="hyperemic_mild_edema">Hyperemic / Mild Edema</option>
                  <option value="dusky_venous_congestion">Dusky (Venous Congestion)</option>
                  <option value="ischemic_black">Black / Frank Ischemia</option>
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">Mean Arterial Pressure (MAP mmHg)</label>
                <input
                  type="number"
                  step="1"
                  min="20"
                  max="100"
                  className="form-control"
                  value={meanArterialPressureMmHg}
                  onChange={(e) => setMeanArterialPressureMmHg(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Heart Rate (bpm)</label>
                <input
                  type="number"
                  min="60"
                  max="220"
                  className="form-control"
                  value={heartRate}
                  onChange={(e) => setHeartRate(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Respiratory Rate (breaths/min)</label>
                <input
                  type="number"
                  min="15"
                  max="100"
                  className="form-control"
                  value={respiratoryRate}
                  onChange={(e) => setRespiratoryRate(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-12">
                <label className="form-label">Bedside Notes &amp; Observations</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="e.g. 1.0 cm reduction tolerated well, soft abdomen, good femoral pulses, urine output brisk."
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
