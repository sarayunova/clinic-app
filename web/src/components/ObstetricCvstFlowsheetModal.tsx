import React, { useState } from 'react';
import {
  addObstetricCvstFlowsheet,
  type ObstetricCvstRecord,
  type ObstetricCvstFlowsheetRecord,
} from '../api';

interface Props {
  episode: ObstetricCvstRecord;
  isOpen?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricCvstFlowsheetModal: React.FC<Props> = ({
  episode,
  isOpen = true,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [gcsScore, setGcsScore] = useState<number>(14);
  const [pupillaryReactivity, setPupillaryReactivity] = useState<'equal_and_reactive' | 'sluggish' | 'unilateral_dilated' | 'bilateral_fixed'>('equal_and_reactive');
  const [headacheSeverityNrs, setHeadacheSeverityNrs] = useState<number>(7);
  const [systolicBpMmhg, setSystolicBpMmhg] = useState<number>(134);
  const [diastolicBpMmhg, setDiastolicBpMmhg] = useState<number>(84);
  const [heartRateBpm, setHeartRateBpm] = useState<number>(78);
  const [antiXaOrApttLevel, setAntiXaOrApttLevel] = useState<number>(0.75);
  const [seizureActivityObserved, setSeizureActivityObserved] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      logDatetime,
      gcsScore,
      pupillaryReactivity,
      headacheSeverityNrs,
      systolicBpMmhg,
      diastolicBpMmhg,
      heartRateBpm,
      antiXaOrApttLevel,
      seizureActivityObserved,
      notes: notes.trim() || undefined,
    };

    try {
      await addObstetricCvstFlowsheet(episode.id, payload);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record obstetric CVST flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal card" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Record Neuro-Vascular & GCS Surveillance Checkpoint</h3>
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
              <label>Glasgow Coma Scale (3–15) *</label>
              <input
                type="number"
                min="3"
                max="15"
                value={gcsScore}
                onChange={(e) => setGcsScore(parseInt(e.target.value) || 15)}
                required
              />
            </div>

            <div>
              <label>Pupillary Reactivity *</label>
              <select
                value={pupillaryReactivity}
                onChange={(e) => setPupillaryReactivity(e.target.value as any)}
                required
              >
                <option value="equal_and_reactive">Equal & Briskly Reactive</option>
                <option value="sluggish">Sluggish Reactivity</option>
                <option value="unilateral_dilated">Unilateral Dilated (Herniation Warning!)</option>
                <option value="bilateral_fixed">Bilateral Fixed / Dilated</option>
              </select>
            </div>

            <div>
              <label>Headache Severity (0–10 NRS) *</label>
              <input
                type="number"
                min="0"
                max="10"
                value={headacheSeverityNrs}
                onChange={(e) => setHeadacheSeverityNrs(parseInt(e.target.value) || 0)}
                required
              />
            </div>

            <div>
              <label>Systolic BP (mmHg) *</label>
              <input
                type="number"
                min="60"
                max="250"
                value={systolicBpMmhg}
                onChange={(e) => setSystolicBpMmhg(parseInt(e.target.value) || 120)}
                required
              />
            </div>

            <div>
              <label>Diastolic BP (mmHg) *</label>
              <input
                type="number"
                min="40"
                max="160"
                value={diastolicBpMmhg}
                onChange={(e) => setDiastolicBpMmhg(parseInt(e.target.value) || 80)}
                required
              />
            </div>

            <div>
              <label>Heart Rate (bpm) *</label>
              <input
                type="number"
                min="30"
                max="220"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(parseInt(e.target.value) || 75)}
                required
              />
            </div>

            <div>
              <label>Anti-Xa / aPTT Ratio *</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="200"
                value={antiXaOrApttLevel}
                onChange={(e) => setAntiXaOrApttLevel(parseFloat(e.target.value) || 0)}
                required
              />
              <span className="small muted">Target Anti-Xa 0.6–1.0 IU/mL for LMWH</span>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={seizureActivityObserved}
                onChange={(e) => setSeizureActivityObserved(e.target.checked)}
              />
              <strong>Seizure activity observed during shift</strong>
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Neuro Check Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Pain relief response to IV acetaminophen, no new cranial nerve palsy, LMWH administered on schedule..."
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
