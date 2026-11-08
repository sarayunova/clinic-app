import React, { useState } from 'react';
import { addPediatricSepticArthritisFlowsheet } from '../api';

interface PediatricSepticArthritisFlowsheetModalProps {
  episodeId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const PediatricSepticArthritisFlowsheetModal: React.FC<PediatricSepticArthritisFlowsheetModalProps> = ({
  episodeId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromTriage, setHoursFromTriage] = useState(6);
  const [temperatureCelsius, setTemperatureCelsius] = useState(38.2);
  const [heartRateBpm, setHeartRateBpm] = useState(128);
  const [jointRangeOfMotion, setJointRangeOfMotion] = useState<string>('moderate_guarding');
  const [weightBearingAbility, setWeightBearingAbility] = useState<string>('non_weight_bearing');
  const [crpMgL, setCrpMgL] = useState<number | ''>(38.0);
  const [drainOutputMl24h, setDrainOutputMl24h] = useState(25.0);
  const [notes, setNotes] = useState('Postoperative arthrotomy check: Drain patent with serosanguinous fluid. Temperature down from 38.8 C to 38.2 C. IV Cefazolin continuing.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await addPediatricSepticArthritisFlowsheet(episodeId, {
        logDatetime: new Date(logDatetime).toISOString(),
        hoursFromTriage: Number(hoursFromTriage),
        temperatureCelsius: Number(temperatureCelsius),
        heartRateBpm: Number(heartRateBpm),
        jointRangeOfMotion,
        weightBearingAbility,
        crpMgL: crpMgL === '' ? undefined : Number(crpMgL),
        drainOutputMl24h: Number(drainOutputMl24h),
        notes,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to log septic arthritis flowsheet checkpoint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal card" style={{ maxWidth: 640, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#b91c1c' }}>⏱️ Record Joint Examination &amp; Infection Flowsheet</h3>
          <button className="button small" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Patient: <strong>{patientName}</strong> | Temperature, Range of Motion &amp; Drain Surveillance
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
              <label>Hours from Triage *</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={hoursFromTriage}
                onChange={(e) => setHoursFromTriage(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            <div>
              <label>Temperature (°C) *</label>
              <input
                type="number"
                step="0.1"
                min="34.0"
                max="43.0"
                value={temperatureCelsius}
                onChange={(e) => setTemperatureCelsius(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>Heart Rate (bpm) *</label>
              <input
                type="number"
                min="40"
                max="250"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>CRP (mg/L)</label>
              <input
                type="number"
                step="0.1"
                value={crpMgL}
                onChange={(e) => setCrpMgL(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label>Joint Range of Motion (ROM) *</label>
              <select value={jointRangeOfMotion} onChange={(e) => setJointRangeOfMotion(e.target.value)}>
                <option value="severely_restricted_pseudoparalysis">Severely Restricted / Pseudoparalysis</option>
                <option value="moderate_guarding">Moderate Guarding on Passive Rotation</option>
                <option value="mild_limitation">Mild Limitation at Terminal Motion</option>
                <option value="full_painless_rom">Full Painless Range of Motion</option>
              </select>
            </div>
            <div>
              <label>Weight-Bearing Ability *</label>
              <select value={weightBearingAbility} onChange={(e) => setWeightBearingAbility(e.target.value)}>
                <option value="non_weight_bearing">Non-Weight-Bearing / Refusal to Walk</option>
                <option value="limping_antalgic">Antalgic Limp</option>
                <option value="full_independent">Full Independent Ambulation</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Drain Output (mL / 24h)</label>
            <input
              type="number"
              step="1"
              min="0"
              value={drainOutputMl24h}
              onChange={(e) => setDrainOutputMl24h(Number(e.target.value))}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>Observations &amp; Examination Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Swelling, local erythema, warmth, irritability, oral intake..."
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
