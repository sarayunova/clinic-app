import React, { useState } from 'react';
import { addPediatricForeignBodyFlowsheet } from '../api';

interface PediatricForeignBodyFlowsheetModalProps {
  episodeId: number;
  patientId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const PediatricForeignBodyFlowsheetModal: React.FC<PediatricForeignBodyFlowsheetModalProps> = ({
  episodeId,
  patientId: _patientId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [minutesFromChoking, setMinutesFromChoking] = useState(15);
  const [mentalStatus, setMentalStatus] = useState<'alert_vocalizing' | 'irritable_lethargic' | 'unresponsive_coma'>('alert_vocalizing');
  const [airwayPatency, setAirwayPatency] = useState<'clear_normal_air_entry' | 'partial_wheeze_stridor' | 'silent_complete_obstruction'>('clear_normal_air_entry');
  const [heartRateBpm, setHeartRateBpm] = useState(128);
  const [respiratoryRate, setRespiratoryRate] = useState(28);
  const [spo2Percent, setSpo2Percent] = useState(98.0);
  const [interventionCycle, setInterventionCycle] = useState<
    | 'reassurance_and_spontaneous_coughing'
    | 'five_back_slaps_five_chest_thrusts'
    | 'subdiaphragmatic_heimlich_thrusts'
    | 'cpr_with_direct_laryngoscopy_removal'
    | 'urgent_or_rigid_bronchoscopy'
  >('subdiaphragmatic_heimlich_thrusts');
  const [foreignObjectVisualizedOrRemoved, setForeignObjectVisualizedOrRemoved] = useState(true);
  const [notes, setNotes] = useState('Peanut expelled from mouth onto stretcher. Lungs auscultated with bilateral clear air entry without monophonic wheeze.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await addPediatricForeignBodyFlowsheet(episodeId, {
        logDatetime,
        minutesFromChoking: Number(minutesFromChoking),
        mentalStatus,
        airwayPatency,
        heartRateBpm: Number(heartRateBpm),
        respiratoryRate: Number(respiratoryRate),
        spo2Percent: Number(spo2Percent),
        interventionCycle,
        foreignObjectVisualizedOrRemoved,
        notes: notes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to record choking flowsheet entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal" style={{ maxWidth: 640, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: 10 }}>
          <h3 style={{ margin: 0, color: '#0369a1' }}>🌬️ Airway Resuscitation & Choking Flowsheet Log</h3>
          <button type="button" className="btn small" onClick={onClose}>✕</button>
        </div>

        {error && <div className="banner error" style={{ margin: '12px 0' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Log Datetime</label>
              <input
                type="datetime-local"
                className="form-control"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Minutes from Choking Event</label>
              <input
                type="number"
                min="0"
                max="1440"
                className="form-control"
                value={minutesFromChoking}
                onChange={(e) => setMinutesFromChoking(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Mental Status</label>
              <select
                className="form-control"
                value={mentalStatus}
                onChange={(e: any) => setMentalStatus(e.target.value)}
              >
                <option value="alert_vocalizing">Alert / Vocalizing / Crying</option>
                <option value="irritable_lethargic">Irritable / Lethargic</option>
                <option value="unresponsive_coma">Unresponsive / Comatose</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Airway Patency</label>
              <select
                className="form-control"
                value={airwayPatency}
                onChange={(e: any) => setAirwayPatency(e.target.value)}
              >
                <option value="clear_normal_air_entry">Clear / Normal Bilateral Air Entry</option>
                <option value="partial_wheeze_stridor">Partial Obstruction (Stridor/Wheeze)</option>
                <option value="silent_complete_obstruction">Silent Chest (Complete Impaction)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Heart Rate (bpm)</label>
              <input
                type="number"
                min="40"
                max="250"
                className="form-control"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Respiratory Rate (/min)</label>
              <input
                type="number"
                min="0"
                max="120"
                className="form-control"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>SpO₂ (%)</label>
              <input
                type="number"
                step="0.1"
                min="30"
                max="100"
                className="form-control"
                value={spo2Percent}
                onChange={(e) => setSpo2Percent(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Intervention Cycle Executed</label>
              <select
                className="form-control"
                value={interventionCycle}
                onChange={(e: any) => setInterventionCycle(e.target.value)}
              >
                <option value="subdiaphragmatic_heimlich_thrusts">Subdiaphragmatic Heimlich Thrusts</option>
                <option value="five_back_slaps_five_chest_thrusts">5 Back Slaps + 5 Chest Thrusts (Infant)</option>
                <option value="reassurance_and_spontaneous_coughing">Spontaneous Coughing Observation</option>
                <option value="cpr_with_direct_laryngoscopy_removal">CPR with Direct McGill Forceps Removal</option>
                <option value="urgent_or_rigid_bronchoscopy">Urgent / Rigid Bronchoscopy</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Object Removed / Expelled?</label>
              <select
                className="form-control"
                value={foreignObjectVisualizedOrRemoved ? '1' : '0'}
                onChange={(e) => setForeignObjectVisualizedOrRemoved(e.target.value === '1')}
              >
                <option value="1">YES - Object Removed</option>
                <option value="0">NO - Not Visualized</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Auscultation & Clinical Observation</label>
            <textarea
              className="form-control"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Air entry symmetry, cough character, speech..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? 'Recording...' : 'Log Airway Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
