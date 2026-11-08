import React, { useState } from 'react';
import { addObstetricPpcmFlowsheet } from '../api';

interface ObstetricPpcmFlowsheetModalProps {
  episodeId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ObstetricPpcmFlowsheetModal: React.FC<ObstetricPpcmFlowsheetModalProps> = ({
  episodeId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromPresentation, setHoursFromPresentation] = useState(4);
  const [heartRateBpm, setHeartRateBpm] = useState(104);
  const [bloodPressureSys, setBloodPressureSys] = useState(116);
  const [bloodPressureDia, setBloodPressureDia] = useState(72);
  const [respiratoryRate, setRespiratoryRate] = useState(24);
  const [spo2Percent, setSpo2Percent] = useState(96.0);
  const [oxygenRequirementLMin, setOxygenRequirementLMin] = useState(3.0);
  const [urineOutputMlHr, setUrineOutputMlHr] = useState(65.0);
  const [fluidBalanceCumulativeMl, setFluidBalanceCumulativeMl] = useState(-850);
  const [orthopneaPillows, setOrthopneaPillows] = useState(2);
  const [inotropicSupport, setInotropicSupport] = useState<string>('none');
  const [notes, setNotes] = useState('Diuresis effective post-IV Furosemide 40 mg. Lungs clearing at bases. Bromocriptine dose #1 tolerated.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await addObstetricPpcmFlowsheet(episodeId, {
        logDatetime: new Date(logDatetime).toISOString(),
        hoursFromPresentation: Number(hoursFromPresentation),
        heartRateBpm: Number(heartRateBpm),
        bloodPressureSys: Number(bloodPressureSys),
        bloodPressureDia: Number(bloodPressureDia),
        respiratoryRate: Number(respiratoryRate),
        spo2Percent: Number(spo2Percent),
        oxygenRequirementLMin: Number(oxygenRequirementLMin),
        urineOutputMlHr: Number(urineOutputMlHr),
        fluidBalanceCumulativeMl: Number(fluidBalanceCumulativeMl),
        orthopneaPillows: Number(orthopneaPillows),
        inotropicSupport,
        notes,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to log PPCM flowsheet checkpoint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal card" style={{ maxWidth: 640, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#e11d48' }}>⏱️ Record PPCM Hemodynamic Flowsheet Checkpoint</h3>
          <button className="button small" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Patient: <strong>{patientName}</strong> | Cardiopulmonary, Fluid Balance &amp; Inotrope Monitoring
        </p>

        {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label>Log Datetime *</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Hours from Presentation *</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={hoursFromPresentation}
                onChange={(e) => setHoursFromPresentation(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
            <div>
              <label>HR (bpm) *</label>
              <input
                type="number"
                min="30"
                max="220"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>BP Systolic *</label>
              <input
                type="number"
                min="50"
                max="250"
                value={bloodPressureSys}
                onChange={(e) => setBloodPressureSys(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>BP Diastolic *</label>
              <input
                type="number"
                min="20"
                max="160"
                value={bloodPressureDia}
                onChange={(e) => setBloodPressureDia(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>RR (/min) *</label>
              <input
                type="number"
                min="5"
                max="70"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
            <div>
              <label>SpO2 (%) *</label>
              <input
                type="number"
                step="0.1"
                min="40"
                max="100"
                value={spo2Percent}
                onChange={(e) => setSpo2Percent(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>O2 Flow (L/min)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={oxygenRequirementLMin}
                onChange={(e) => setOxygenRequirementLMin(Number(e.target.value))}
              />
            </div>
            <div>
              <label>Urine (mL/hr)</label>
              <input
                type="number"
                min="0"
                value={urineOutputMlHr}
                onChange={(e) => setUrineOutputMlHr(Number(e.target.value))}
              />
            </div>
            <div>
              <label>Cumulative Fluid (mL)</label>
              <input
                type="number"
                value={fluidBalanceCumulativeMl}
                onChange={(e) => setFluidBalanceCumulativeMl(Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label>Orthopnea Elevation (Pillows)</label>
              <input
                type="number"
                min="1"
                max="5"
                value={orthopneaPillows}
                onChange={(e) => setOrthopneaPillows(Number(e.target.value))}
              />
            </div>
            <div>
              <label>Inotropic Support</label>
              <select value={inotropicSupport} onChange={(e) => setInotropicSupport(e.target.value)}>
                <option value="none">None (Euvolemic / Stable)</option>
                <option value="dobutamine">Dobutamine Infusion</option>
                <option value="milrinone">Milrinone (Inodilator)</option>
                <option value="norepinephrine">Norepinephrine Infusion</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>Observations & Clinical Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Diuresis response, lung sounds, JVP, peripheral perfusion..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="button secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={loading}>
              {loading ? 'Logging...' : 'Save Flowsheet Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
