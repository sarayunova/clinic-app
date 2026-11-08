import React, { useState } from 'react';
import { addPediatricCroupFlowsheet } from '../api';

interface PediatricCroupFlowsheetModalProps {
  episodeId: number;
  patientId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const PediatricCroupFlowsheetModal: React.FC<PediatricCroupFlowsheetModalProps> = ({
  episodeId,
  patientId: _patientId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [minutesFromTriage, setMinutesFromTriage] = useState(30);
  const [westleyScoreCurrent, setWestleyScoreCurrent] = useState(2);
  const [heartRateBpm, setHeartRateBpm] = useState(115);
  const [respiratoryRate, setRespiratoryRate] = useState(28);
  const [spo2Percent, setSpo2Percent] = useState(99);
  const [stridorAtRest, setStridorAtRest] = useState(false);
  const [chestRetractionsSeverity, setChestRetractionsSeverity] = useState<
    'none' | 'mild_subcostal' | 'moderate_intercostal' | 'severe_sternal_indrawing'
  >('mild_subcostal');
  const [interventionGiven, setInterventionGiven] = useState<
    | 'none_observation'
    | 'dexamethasone_oral'
    | 'dexamethasone_im_iv'
    | 'nebulized_epinephrine_1'
    | 'nebulized_epinephrine_repeat'
    | 'heliox_or_intubation_prep'
  >('nebulized_epinephrine_1');
  const [notes, setNotes] = useState('Marked improvement 30 min post-epinephrine nebulization. Stridor absent at rest, calm in mother\'s lap.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await addPediatricCroupFlowsheet(episodeId, {
        logDatetime,
        minutesFromTriage: Number(minutesFromTriage),
        westleyScoreCurrent: Number(westleyScoreCurrent),
        heartRateBpm: Number(heartRateBpm),
        respiratoryRate: Number(respiratoryRate),
        spo2Percent: Number(spo2Percent),
        stridorAtRest,
        chestRetractionsSeverity,
        interventionGiven,
        notes: notes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to log croup flowsheet checkpoint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="modal-card"
        style={{
          background: '#fff',
          borderRadius: 8,
          maxWidth: 640,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: 8,
          }}
        >
          <h4 style={{ margin: 0, color: '#0284c7' }}>📊 Log Airway & Nebulization Response Checkpoint</h4>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Log Date/Time</label>
              <input
                type="datetime-local"
                className="form-control"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Minutes From Triage</label>
              <input
                type="number"
                min="0"
                className="form-control"
                value={minutesFromTriage}
                onChange={(e) => setMinutesFromTriage(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Westley Score (/17)</label>
              <input
                type="number"
                min="0"
                max="17"
                className="form-control"
                value={westleyScoreCurrent}
                onChange={(e) => setWestleyScoreCurrent(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Heart Rate (bpm)</label>
              <input
                type="number"
                className="form-control"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Respiratory Rate</label>
              <input
                type="number"
                className="form-control"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>SpO2 (%)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={spo2Percent}
                onChange={(e) => setSpo2Percent(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Retractions Severity</label>
              <select
                className="form-control"
                value={chestRetractionsSeverity}
                onChange={(e) => setChestRetractionsSeverity(e.target.value as any)}
              >
                <option value="none">None</option>
                <option value="mild_subcostal">Mild Subcostal</option>
                <option value="moderate_intercostal">Moderate Intercostal</option>
                <option value="severe_sternal_indrawing">Severe Sternal Indrawing</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Stridor at Rest?</label>
              <select
                className="form-control"
                value={stridorAtRest ? 'yes' : 'no'}
                onChange={(e) => setStridorAtRest(e.target.value === 'yes')}
              >
                <option value="no">No (Absent or only with agitation)</option>
                <option value="yes">Yes (Present at rest)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Intervention Administered</label>
            <select
              className="form-control"
              value={interventionGiven}
              onChange={(e) => setInterventionGiven(e.target.value as any)}
            >
              <option value="none_observation">None / Observation Only</option>
              <option value="dexamethasone_oral">Dexamethasone Oral</option>
              <option value="dexamethasone_im_iv">Dexamethasone IM / IV</option>
              <option value="nebulized_epinephrine_1">Nebulized Epinephrine 1:1000 (1st Dose)</option>
              <option value="nebulized_epinephrine_repeat">Nebulized Epinephrine 1:1000 (Repeat Dose)</option>
              <option value="heliox_or_intubation_prep">Heliox / Intubation Preparation</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Response Notes</label>
            <textarea
              className="form-control"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 15 min post-nebulizer, stridor quietened, retractions improved from moderate to mild..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#0284c7', borderColor: '#0369a1' }} disabled={loading}>
              {loading ? 'Recording...' : 'Save Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
