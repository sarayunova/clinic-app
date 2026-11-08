import React, { useState } from 'react';
import {
  addFetalHydropsFlowsheet,
  type FetalHydropsRecord,
  type FetalHydropsFlowsheetRecord,
} from '../api';

interface Props {
  episode: FetalHydropsRecord;
  isOpen?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const FetalHydropsFlowsheetModal: React.FC<Props> = ({
  episode,
  isOpen = true,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(
    episode.gestational_age_weeks
  );
  const [fetalHeartRateBpm, setFetalHeartRateBpm] = useState<number>(144);
  const [mcaPsvCmS, setMcaPsvCmS] = useState<number>(55.0);
  const [mcaPsvMom, setMcaPsvMom] = useState<number>(1.45);
  const [pleuralEffusionDepthMm, setPleuralEffusionDepthMm] = useState<number>(12.0);
  const [ascitesDepthMm, setAscitesDepthMm] = useState<number>(15.0);
  const [maternalBpSystolic, setMaternalBpSystolic] = useState<number>(126);
  const [maternalBpDiastolic, setMaternalBpDiastolic] = useState<number>(80);
  const [maternalWeightKg, setMaternalWeightKg] = useState<number>(68.5);
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      logDatetime,
      gestationalAgeWeeks,
      fetalHeartRateBpm,
      mcaPsvCmS,
      mcaPsvMom,
      pleuralEffusionDepthMm,
      ascitesDepthMm,
      maternalBpSystolic,
      maternalBpDiastolic,
      maternalWeightKg,
      notes: notes.trim() || undefined,
    };

    try {
      await addFetalHydropsFlowsheet(episode.id, payload);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record fetal hydrops flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal card" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Record Fetal & Maternal Surveillance Checkpoint</h3>
          <button className="btn small" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {error && <div className="alert banner danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label>Log Date & Time *</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                required
              />
            </div>

            <div>
              <label>Gestational Age (weeks) *</label>
              <input
                type="number"
                step="0.1"
                min="12.0"
                max="43.0"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(parseFloat(e.target.value) || 26.0)}
                required
              />
            </div>

            <div>
              <label>Fetal Heart Rate (bpm) *</label>
              <input
                type="number"
                min="40"
                max="260"
                value={fetalHeartRateBpm}
                onChange={(e) => setFetalHeartRateBpm(parseInt(e.target.value) || 140)}
                required
              />
            </div>

            <div>
              <label>MCA Peak Systolic Velocity (cm/s) *</label>
              <input
                type="number"
                step="0.5"
                min="5"
                max="200"
                value={mcaPsvCmS}
                onChange={(e) => setMcaPsvCmS(parseFloat(e.target.value) || 40)}
                required
              />
            </div>

            <div>
              <label>MCA PSV (MoM) *</label>
              <input
                type="number"
                step="0.05"
                min="0.2"
                max="5.0"
                value={mcaPsvMom}
                onChange={(e) => setMcaPsvMom(parseFloat(e.target.value) || 1.0)}
                required
              />
            </div>

            <div>
              <label>Pleural Effusion Depth (mm)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={pleuralEffusionDepthMm}
                onChange={(e) => setPleuralEffusionDepthMm(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <label>Ascites Depth (mm)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={ascitesDepthMm}
                onChange={(e) => setAscitesDepthMm(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <label>Maternal Systolic BP (mmHg)</label>
              <input
                type="number"
                min="60"
                max="250"
                value={maternalBpSystolic}
                onChange={(e) => setMaternalBpSystolic(parseInt(e.target.value) || 120)}
                required
              />
            </div>

            <div>
              <label>Maternal Diastolic BP (mmHg)</label>
              <input
                type="number"
                min="40"
                max="160"
                value={maternalBpDiastolic}
                onChange={(e) => setMaternalBpDiastolic(parseInt(e.target.value) || 80)}
                required
              />
            </div>

            <div>
              <label>Maternal Weight (kg) *</label>
              <input
                type="number"
                step="0.1"
                min="30"
                max="250"
                value={maternalWeightKg}
                onChange={(e) => setMaternalWeightKg(parseFloat(e.target.value) || 65)}
                required
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label>Serial Observation Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Post-IUT hematocrit check, fetal heart rate stable, maternal lung bases clear..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving...' : 'Add Checkpoint Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
