import React, { useState } from 'react';
import { addPediatricAcuteLiverFailureFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricAcuteLiverFailureFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen = true,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().slice(0, 16));
  const [encephalopathyStage, setEncephalopathyStage] = useState<number>(1);
  const [pupilReactivity, setPupilReactivity] = useState<
    'brisk_equal' | 'sluggish' | 'asymmetric' | 'fixed_dilated'
  >('brisk_equal');
  const [meanArterialPressureMmhg, setMeanArterialPressureMmhg] = useState<string>('72');
  const [heartRateBpm, setHeartRateBpm] = useState<string>('105');
  const [gcsScore, setGcsScore] = useState<string>('13');
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState<string>('95');
  const [serumSodiumMeqL, setSerumSodiumMeqL] = useState<string>('146');
  const [serumAmmoniaUmolL, setSerumAmmoniaUmolL] = useState<string>('92');
  const [dailyStoolCount, setDailyStoolCount] = useState<number>(3);
  const [icpMonitoringNotes, setIcpMonitoringNotes] = useState<string>('');
  const [nurseNotes, setNurseNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      recordedAt,
      encephalopathyStage,
      pupilReactivity,
      meanArterialPressureMmhg: meanArterialPressureMmhg ? parseFloat(meanArterialPressureMmhg) : null,
      heartRateBpm: heartRateBpm ? parseInt(heartRateBpm) : null,
      gcsScore: gcsScore ? parseInt(gcsScore) : null,
      bloodGlucoseMgDl: bloodGlucoseMgDl ? parseFloat(bloodGlucoseMgDl) : null,
      serumSodiumMeqL: serumSodiumMeqL ? parseFloat(serumSodiumMeqL) : null,
      serumAmmoniaUmolL: serumAmmoniaUmolL ? parseFloat(serumAmmoniaUmolL) : null,
      dailyStoolCount,
      icpMonitoringNotes: icpMonitoringNotes || null,
      nurseNotes: nurseNotes || null,
    };

    try {
      await addPediatricAcuteLiverFailureFlowsheet(episodeId, payload);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record PALF flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal card" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Add Bedside Neurological & PICU Checkpoint</h3>
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
              <label>Encephalopathy Grade *</label>
              <select
                value={encephalopathyStage}
                onChange={(e) => setEncephalopathyStage(parseInt(e.target.value))}
              >
                <option value={0}>Grade 0: Normal cognition</option>
                <option value={1}>Grade 1: Sleep disturbance / confusion</option>
                <option value={2}>Grade 2: Lethargy / asterixis</option>
                <option value={3}>Grade 3: Somnolence / stupor</option>
                <option value={4}>Grade 4: Coma</option>
              </select>
            </div>
            <div>
              <label>Pupil Reactivity *</label>
              <select
                value={pupilReactivity}
                onChange={(e) => setPupilReactivity(e.target.value as any)}
              >
                <option value="brisk_equal">Brisk & Equal</option>
                <option value="sluggish">Sluggish (Early ICP concern)</option>
                <option value="asymmetric">Asymmetric (Impending Herniation)</option>
                <option value="fixed_dilated">Fixed & Dilated (Critical Herniation)</option>
              </select>
            </div>
            <div>
              <label>Glasgow Coma Scale (GCS)</label>
              <input
                type="number"
                min="3"
                max="15"
                value={gcsScore}
                onChange={(e) => setGcsScore(e.target.value)}
              />
            </div>
            <div>
              <label>Mean Arterial Pressure (mmHg)</label>
              <input
                type="number"
                step="1"
                value={meanArterialPressureMmhg}
                onChange={(e) => setMeanArterialPressureMmhg(e.target.value)}
              />
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
              <label>Serum Sodium (mEq/L)</label>
              <input
                type="number"
                step="1"
                value={serumSodiumMeqL}
                onChange={(e) => setSerumSodiumMeqL(e.target.value)}
                placeholder="Target 145 - 150"
              />
            </div>
            <div>
              <label>Blood Glucose (mg/dL)</label>
              <input
                type="number"
                step="1"
                value={bloodGlucoseMgDl}
                onChange={(e) => setBloodGlucoseMgDl(e.target.value)}
                placeholder="e.g. 95"
              />
            </div>
            <div>
              <label>Serum Ammonia (µmol/L)</label>
              <input
                type="number"
                step="1"
                value={serumAmmoniaUmolL}
                onChange={(e) => setSerumAmmoniaUmolL(e.target.value)}
              />
            </div>
            <div>
              <label>Daily Stool Count (Lactulose titr.)</label>
              <input
                type="number"
                min="0"
                value={dailyStoolCount}
                onChange={(e) => setDailyStoolCount(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Neuro-monitoring / ICP Interventions</label>
            <input
              type="text"
              placeholder="e.g. Head elevated 30 degrees midline; 3% NaCl at 1.5 mL/kg/hr; Mannitol 0.5 g/kg given for sluggish pupil"
              value={icpMonitoringNotes}
              onChange={(e) => setIcpMonitoringNotes(e.target.value)}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Nurse / PICU Notes</label>
            <textarea
              rows={2}
              placeholder="Asterixis assessment, tone, clonus, spontaneous movements..."
              value={nurseNotes}
              onChange={(e) => setNurseNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Recording...' : 'Log PICU Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
