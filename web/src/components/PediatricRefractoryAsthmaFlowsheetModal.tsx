import React, { useState } from 'react';
import {
  addPediatricRefractoryAsthmaFlowsheet,
  type PediatricRefractoryAsthmaRecord,
} from '../api';

interface Props {
  episode: PediatricRefractoryAsthmaRecord;
  isOpen?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricRefractoryAsthmaFlowsheetModal: React.FC<Props> = ({
  episode,
  isOpen = true,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [hoursFromPicuAdmission, setHoursFromPicuAdmission] = useState<number>(2.0);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(44);
  const [heartRateBpm, setHeartRateBpm] = useState<number>(142);
  const [spo2Percent, setSpo2Percent] = useState<number>(93.0);
  const [pco2Mmhg, setPco2Mmhg] = useState<number>(41.0);
  const [phValue, setPhValue] = useState<number>(7.31);
  const [terbutalineInfusionRate, setTerbutalineInfusionRate] = useState<number>(
    episode.terbutaline_dose_mcg_kg_min || 1.5
  );
  const [ketamineInfusionRate, setKetamineInfusionRate] = useState<number>(
    episode.ketamine_dose_mg_kg_hr || 1.0
  );
  const [inspiratoryExpiratoryRatio, setInspiratoryExpiratoryRatio] = useState<string>('1_to_3');
  const [airEntryAuscultation, setAirEntryAuscultation] = useState<
    'bilateral_good_clear' | 'mild_expiratory_wheeze' | 'severe_widespread_wheezing' | 'markedly_reduced_poor_air_movement' | 'silent_chest'
  >('severe_widespread_wheezing');
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      logDatetime,
      hoursFromPicuAdmission,
      respiratoryRate,
      heartRateBpm,
      spo2Percent,
      pco2Mmhg,
      phValue,
      terbutalineInfusionRate,
      ketamineInfusionRate,
      inspiratoryExpiratoryRatio,
      airEntryAuscultation,
      notes: notes.trim() || undefined,
    };

    try {
      await addPediatricRefractoryAsthmaFlowsheet(episode.id, payload);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record pediatric refractory asthma flowsheet checkpoint');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal card" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Record PICU Bronchodilator & Blood Gas Checkpoint</h3>
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
              <label>Hours from PICU Admission *</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={hoursFromPicuAdmission}
                onChange={(e) => setHoursFromPicuAdmission(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            <div>
              <label>Respiratory Rate (bpm) *</label>
              <input
                type="number"
                min="10"
                max="120"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(parseInt(e.target.value) || 40)}
                required
              />
            </div>

            <div>
              <label>Heart Rate (bpm) *</label>
              <input
                type="number"
                min="40"
                max="260"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(parseInt(e.target.value) || 120)}
                required
              />
            </div>

            <div>
              <label>SpO₂ (%) *</label>
              <input
                type="number"
                step="0.1"
                min="40"
                max="100"
                value={spo2Percent}
                onChange={(e) => setSpo2Percent(parseFloat(e.target.value) || 92)}
                required
              />
            </div>

            <div>
              <label>pCO₂ (mmHg) *</label>
              <input
                type="number"
                step="0.1"
                min="15"
                max="150"
                value={pco2Mmhg}
                onChange={(e) => setPco2Mmhg(parseFloat(e.target.value) || 40)}
                required
              />
            </div>

            <div>
              <label>pH Value *</label>
              <input
                type="number"
                step="0.01"
                min="6.80"
                max="7.80"
                value={phValue}
                onChange={(e) => setPhValue(parseFloat(e.target.value) || 7.35)}
                required
              />
            </div>

            <div>
              <label>Terbutaline Infusion (µg/kg/min)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={terbutalineInfusionRate}
                onChange={(e) => setTerbutalineInfusionRate(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <label>Ketamine Infusion (mg/kg/hr)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={ketamineInfusionRate}
                onChange={(e) => setKetamineInfusionRate(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <label>I:E Ratio</label>
              <select
                value={inspiratoryExpiratoryRatio}
                onChange={(e) => setInspiratoryExpiratoryRatio(e.target.value)}
              >
                <option value="1_to_1">1 : 1</option>
                <option value="1_to_2">1 : 2</option>
                <option value="1_to_3">1 : 3 (Prolonged Expiration)</option>
                <option value="1_to_4">1 : 4 (Severe Gas Trapping)</option>
                <option value="1_to_5">1 : 5 (Extreme Gas Trapping)</option>
              </select>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label>Air Entry Auscultation *</label>
              <select
                value={airEntryAuscultation}
                onChange={(e) => setAirEntryAuscultation(e.target.value as any)}
                required
              >
                <option value="bilateral_good_clear">Bilateral Good & Clear Air Movement</option>
                <option value="mild_expiratory_wheeze">Mild Expiratory Wheeze</option>
                <option value="severe_widespread_wheezing">Severe Widespread Wheezing</option>
                <option value="markedly_reduced_poor_air_movement">Markedly Reduced / Poor Air Movement</option>
                <option value="silent_chest">Silent Chest (Critical Impending Arrest)</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Clinical Surveillance Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g., Patient calmer post-ketamine bolus, breath sounds improved bilaterally, chest physiotherapy withheld..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Recording Checkpoint...' : 'Save Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
