import React, { useState } from 'react';
import { logPediatricPolytraumaFlowsheet } from '../api';

interface PediatricPolytraumaFlowsheetModalProps {
  episodeId: number;
  initialWeightKg: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const PediatricPolytraumaFlowsheetModal: React.FC<PediatricPolytraumaFlowsheetModalProps> = ({
  episodeId,
  initialWeightKg,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [minutesFromArrival, setMinutesFromArrival] = useState(15);
  const [gcsTotal, setGcsTotal] = useState(12);
  const [sbpMmhg, setSbpMmhg] = useState(88);
  const [dbpMmhg, setDbpMmhg] = useState<number | ''>(52);
  const [heartRateBpm, setHeartRateBpm] = useState(148);
  const [respiratoryRate, setRespiratoryRate] = useState(32);
  const [spo2Percent, setSpo2Percent] = useState(98);
  const [temperatureCelsius, setTemperatureCelsius] = useState(36.8);
  const [cumulativeCrystalloidMl, setCumulativeCrystalloidMl] = useState(Math.round(initialWeightKg * 20));
  const [cumulativePrbcMl, setCumulativePrbcMl] = useState(0);
  const [cumulativeFfpMl, setCumulativeFfpMl] = useState(0);
  const [cumulativePlateletsMl, setCumulativePlateletsMl] = useState(0);
  const [urineOutputMlKgHr, setUrineOutputMlKgHr] = useState<number | ''>('');
  const [pupilStatus, setPupilStatus] = useState<'equal_reactive' | 'sluggish_asymmetric' | 'unilateral_dilated_fixed' | 'bilateral_fixed_dilated'>('equal_reactive');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await logPediatricPolytraumaFlowsheet(episodeId, {
        logDatetime,
        minutesFromArrival,
        gcsTotal,
        sbpMmhg,
        dbpMmhg: dbpMmhg === '' ? null : Number(dbpMmhg),
        heartRateBpm,
        respiratoryRate,
        spo2Percent,
        temperatureCelsius,
        cumulativeCrystalloidMl,
        cumulativePrbcMl,
        cumulativeFfpMl,
        cumulativePlateletsMl,
        urineOutputMlKgHr: urineOutputMlKgHr === '' ? null : Number(urineOutputMlKgHr),
        pupilStatus,
        notes: notes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to record polytrauma flowsheet log');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 660 }}>
        <div className="modal-header">
          <h4>⏱️ Trauma Bay Vital Signs & Resuscitation Flowsheet</h4>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label>Checkpoint Datetime</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={logDatetime}
                  onChange={(e) => setLogDatetime(e.target.value)}
                  required
                />
              </div>

              <div>
                <label>Minutes from Arrival</label>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  className="form-control"
                  value={minutesFromArrival}
                  onChange={(e) => setMinutesFromArrival(parseInt(e.target.value) || 0)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
              <div>
                <label>GCS Total</label>
                <input
                  type="number"
                  min="3"
                  max="15"
                  className="form-control"
                  value={gcsTotal}
                  onChange={(e) => setGcsTotal(parseInt(e.target.value) || 15)}
                  required
                />
              </div>
              <div>
                <label>SBP (mmHg)</label>
                <input
                  type="number"
                  className="form-control"
                  value={sbpMmhg}
                  onChange={(e) => setSbpMmhg(parseInt(e.target.value) || 90)}
                  required
                />
              </div>
              <div>
                <label>DBP (mmHg)</label>
                <input
                  type="number"
                  className="form-control"
                  value={dbpMmhg}
                  onChange={(e) => setDbpMmhg(e.target.value === '' ? '' : parseInt(e.target.value))}
                />
              </div>
              <div>
                <label>HR (bpm)</label>
                <input
                  type="number"
                  className="form-control"
                  value={heartRateBpm}
                  onChange={(e) => setHeartRateBpm(parseInt(e.target.value) || 100)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
              <div>
                <label>Resp Rate</label>
                <input
                  type="number"
                  className="form-control"
                  value={respiratoryRate}
                  onChange={(e) => setRespiratoryRate(parseInt(e.target.value) || 20)}
                  required
                />
              </div>
              <div>
                <label>SpO2 (%)</label>
                <input
                  type="number"
                  className="form-control"
                  value={spo2Percent}
                  onChange={(e) => setSpo2Percent(parseInt(e.target.value) || 98)}
                  required
                />
              </div>
              <div>
                <label>Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control"
                  value={temperatureCelsius}
                  onChange={(e) => setTemperatureCelsius(parseFloat(e.target.value) || 36.5)}
                  required
                />
              </div>
              <div>
                <label>Pupils</label>
                <select
                  className="form-control"
                  value={pupilStatus}
                  onChange={(e) => setPupilStatus(e.target.value as any)}
                >
                  <option value="equal_reactive">Equal & Reactive</option>
                  <option value="sluggish_asymmetric">Sluggish / Asymmetric</option>
                  <option value="unilateral_dilated_fixed">Unilateral Blown Pupil</option>
                  <option value="bilateral_fixed_dilated">Bilateral Fixed Dilated</option>
                </select>
              </div>
            </div>

            <h5 style={{ fontSize: '0.9rem', marginBottom: 6, color: '#334155' }}>
              Cumulative Resuscitation Fluids & Blood Products
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
              <div>
                <label>Crystalloid (mL)</label>
                <input
                  type="number"
                  className="form-control"
                  value={cumulativeCrystalloidMl}
                  onChange={(e) => setCumulativeCrystalloidMl(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label>PRBC (mL)</label>
                <input
                  type="number"
                  className="form-control"
                  value={cumulativePrbcMl}
                  onChange={(e) => setCumulativePrbcMl(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label>FFP (mL)</label>
                <input
                  type="number"
                  className="form-control"
                  value={cumulativeFfpMl}
                  onChange={(e) => setCumulativeFfpMl(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label>Platelets (mL)</label>
                <input
                  type="number"
                  className="form-control"
                  value={cumulativePlateletsMl}
                  onChange={(e) => setCumulativePlateletsMl(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label>Bedside Notes</label>
              <input
                type="text"
                className="form-control"
                placeholder="Response to fluid bolus, warmed blood product infusion, ongoing blood loss..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Record Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
