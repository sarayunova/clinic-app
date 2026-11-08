import React, { useState } from 'react';
import { addNeonatalHypomagnesemiaFlowsheet } from '../api';

interface NeonatalHypomagnesemiaFlowsheetModalProps {
  episodeId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const NeonatalHypomagnesemiaFlowsheetModal: React.FC<NeonatalHypomagnesemiaFlowsheetModalProps> = ({
  episodeId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromOnset, setHoursFromOnset] = useState(2);
  const [serumMagnesiumMgDl, setSerumMagnesiumMgDl] = useState<number | ''>(1.4);
  const [ionizedCalciumMmolL, setIonizedCalciumMmolL] = useState<number | ''>(1.02);
  const [heartRateBpm, setHeartRateBpm] = useState(136);
  const [respiratoryRate, setRespiratoryRate] = useState(44);
  const [deepTendonReflexes, setDeepTendonReflexes] = useState<string>('normal_2_plus');
  const [seizureActivityPresent, setSeizureActivityPresent] = useState(false);
  const [magnesiumInfusionRateMlHr, setMagnesiumInfusionRateMlHr] = useState(0.3);
  const [ecgRhythmStrip, setEcgRhythmStrip] = useState<string>('normal_sinus');
  const [toxicityWarning, setToxicityWarning] = useState(false);
  const [notes, setNotes] = useState('Post-bolus check: Seizures ceased. DTRs 2+ intact. PR interval normal.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await addNeonatalHypomagnesemiaFlowsheet(episodeId, {
        logDatetime: new Date(logDatetime).toISOString(),
        hoursFromOnset: Number(hoursFromOnset),
        serumMagnesiumMgDl: serumMagnesiumMgDl === '' ? undefined : Number(serumMagnesiumMgDl),
        ionizedCalciumMmolL: ionizedCalciumMmolL === '' ? undefined : Number(ionizedCalciumMmolL),
        heartRateBpm: Number(heartRateBpm),
        respiratoryRate: Number(respiratoryRate),
        deepTendonReflexes,
        seizureActivityPresent,
        magnesiumInfusionRateMlHr: Number(magnesiumInfusionRateMlHr),
        ecgRhythmStrip,
        toxicityWarning,
        notes,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to log flowsheet checkpoint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal card" style={{ maxWidth: 640, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#0284c7' }}>⏱️ Record Hypomagnesemia Flowsheet Checkpoint</h3>
          <button className="button small" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Patient: <strong>{patientName}</strong> | Serial Mg, DTR & Toxicity Monitoring
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
              <label>Hours from Onset *</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={hoursFromOnset}
                onChange={(e) => setHoursFromOnset(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
            <div>
              <label>Serum Mg (mg/dL)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 1.6"
                value={serumMagnesiumMgDl}
                onChange={(e) => setSerumMagnesiumMgDl(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label>Ionized Ca (mmol/L)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 1.05"
                value={ionizedCalciumMmolL}
                onChange={(e) => setIonizedCalciumMmolL(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label>HR (bpm) *</label>
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
              <label>RR (/min) *</label>
              <input
                type="number"
                min="0"
                max="140"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label>Deep Tendon Reflexes (DTR) *</label>
              <select value={deepTendonReflexes} onChange={(e) => setDeepTendonReflexes(e.target.value)}>
                <option value="normal_2_plus">Normal (2+ brisk, physiologic)</option>
                <option value="brisk_3_plus_clonus">Hyperreflexic (3+ / Clonus present)</option>
                <option value="diminished_1_plus">Diminished (1+ sluggish)</option>
                <option value="absent_areflexia_toxicity">ABSENT (Areflexia - Mg Toxicity Herald!)</option>
              </select>
            </div>
            <div>
              <label>ECG Rhythm Strip</label>
              <select value={ecgRhythmStrip} onChange={(e) => setEcgRhythmStrip(e.target.value)}>
                <option value="normal_sinus">Normal Sinus Rhythm</option>
                <option value="sinus_bradycardia">Sinus Bradycardia</option>
                <option value="pr_prolongation">PR Interval Prolongation</option>
                <option value="heart_block">Heart Block (AV Block)</option>
                <option value="arrhythmia">Arrhythmia / Ectopy</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label>Maintenance Infusion Rate (mL/hr)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                value={magnesiumInfusionRateMlHr}
                onChange={(e) => setMagnesiumInfusionRateMlHr(Number(e.target.value))}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={seizureActivityPresent}
                  onChange={(e) => setSeizureActivityPresent(e.target.checked)}
                />
                <span>Active Seizure Activity Observed</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#dc2626' }}>
                <input
                  type="checkbox"
                  checked={toxicityWarning}
                  onChange={(e) => setToxicityWarning(e.target.checked)}
                />
                <strong>Magnesium Toxicity Warning Flag</strong>
              </label>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>Observations & Clinical Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Tone improving, no tremors, feeding well, urine output adequate..."
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
