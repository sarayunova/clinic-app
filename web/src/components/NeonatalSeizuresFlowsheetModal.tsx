import React, { useState } from 'react';
import { addNeonatalSeizuresFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalSeizuresFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen = true,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().slice(0, 16));
  const [seizureCountPastHour, setSeizureCountPastHour] = useState<number>(0);
  const [currentSeizureState, setCurrentSeizureState] = useState<
    'seizure_free' | 'infrequent_twitches' | 'active_clinical_seizures' | 'continuous_status'
  >('seizure_free');
  const [heartRateBpm, setHeartRateBpm] = useState<string>('140');
  const [respiratoryRateBpm, setRespiratoryRateBpm] = useState<string>('44');
  const [spo2Percent, setSpo2Percent] = useState<string>('96');
  const [bloodPressureSys, setBloodPressureSys] = useState<string>('68');
  const [bloodPressureDia, setBloodPressureDia] = useState<string>('42');
  const [sedationScore, setSedationScore] = useState<
    'normal_alert' | 'mild_somnolence' | 'deep_stupor' | 'unresponsive'
  >('mild_somnolence');
  const [medicationAdministered, setMedicationAdministered] = useState<string>('');
  const [eegBackground, setEegBackground] = useState<
    'normal' | 'mildly_abnormal' | 'discontinuous' | 'burst_suppression' | 'isoelectric' | 'not_available'
  >('discontinuous');
  const [nurseNotes, setNurseNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      recordedAt,
      seizureCountPastHour,
      currentSeizureState,
      heartRateBpm: heartRateBpm ? parseInt(heartRateBpm) : null,
      respiratoryRateBpm: respiratoryRateBpm ? parseInt(respiratoryRateBpm) : null,
      spo2Percent: spo2Percent ? parseFloat(spo2Percent) : null,
      bloodPressureSys: bloodPressureSys ? parseInt(bloodPressureSys) : null,
      bloodPressureDia: bloodPressureDia ? parseInt(bloodPressureDia) : null,
      sedationScore,
      medicationAdministered: medicationAdministered || null,
      eegBackground,
      nurseNotes: nurseNotes || null,
    };

    try {
      await addNeonatalSeizuresFlowsheet(episodeId, payload);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal card" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Add Bedside Seizure & Vital Checkpoint</h3>
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
              <label>Seizures in Past Hour *</label>
              <input
                type="number"
                min="0"
                max="100"
                value={seizureCountPastHour}
                onChange={(e) => setSeizureCountPastHour(parseInt(e.target.value) || 0)}
                required
              />
            </div>
            <div>
              <label>Current Clinical State *</label>
              <select
                value={currentSeizureState}
                onChange={(e) => setCurrentSeizureState(e.target.value as any)}
              >
                <option value="seizure_free">Seizure-Free / Quiescent</option>
                <option value="infrequent_twitches">Infrequent Myoclonic Twitches</option>
                <option value="active_clinical_seizures">Active Clinical Clonic / Tonic Seizures</option>
                <option value="continuous_status">Continuous Status Epilepticus</option>
              </select>
            </div>
            <div>
              <label>Sedation Score *</label>
              <select
                value={sedationScore}
                onChange={(e) => setSedationScore(e.target.value as any)}
              >
                <option value="normal_alert">Normal / Spontaneously Alert</option>
                <option value="mild_somnolence">Mild Somnolence (Rousable)</option>
                <option value="deep_stupor">Deep Stupor (Responds to pain)</option>
                <option value="unresponsive">Unresponsive / Post-Ictal Coma</option>
              </select>
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
              <label>Respiratory Rate (bpm)</label>
              <input
                type="number"
                value={respiratoryRateBpm}
                onChange={(e) => setRespiratoryRateBpm(e.target.value)}
              />
            </div>
            <div>
              <label>SpO2 (%)</label>
              <input
                type="number"
                step="0.1"
                value={spo2Percent}
                onChange={(e) => setSpo2Percent(e.target.value)}
              />
            </div>
            <div>
              <label>Blood Pressure (Sys / Dia)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number"
                  placeholder="Sys"
                  value={bloodPressureSys}
                  onChange={(e) => setBloodPressureSys(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Dia"
                  value={bloodPressureDia}
                  onChange={(e) => setBloodPressureDia(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>aEEG Background Pattern</label>
            <select
              value={eegBackground}
              onChange={(e) => setEegBackground(e.target.value as any)}
            >
              <option value="normal">Continuous Normal Voltage (CNV)</option>
              <option value="discontinuous">Discontinuous Normal/Low Voltage (DNV)</option>
              <option value="burst_suppression">Burst Suppression (BS)</option>
              <option value="isoelectric">Continuous Low Voltage / Flat Trace (FT)</option>
              <option value="not_available">aEEG Not Available</option>
            </select>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Medications / Boluses Given</label>
            <input
              type="text"
              placeholder="e.g. Additional Phenobarbital 10 mg/kg IV; 10% Dextrose 2 mL/kg"
              value={medicationAdministered}
              onChange={(e) => setMedicationAdministered(e.target.value)}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Nurse / Bedside Observations</label>
            <textarea
              rows={2}
              placeholder="Observations on pupil response, lip smacking, respiratory effort..."
              value={nurseNotes}
              onChange={(e) => setNurseNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Recording...' : 'Log Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
