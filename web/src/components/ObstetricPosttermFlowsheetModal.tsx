import React, { useState } from 'react';
import { addObstetricPosttermFlowsheet } from '../api';

interface ObstetricPosttermFlowsheetModalProps {
  episodeId: number;
  patientId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const ObstetricPosttermFlowsheetModal: React.FC<ObstetricPosttermFlowsheetModalProps> = ({
  episodeId,
  patientId: _patientId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromRipeningStart, setHoursFromRipeningStart] = useState(6.0);
  const [bishopScoreCurrent, setBishopScoreCurrent] = useState(7);
  const [dilationCm, setDilationCm] = useState(3.5);
  const [effacementPct, setEffacementPct] = useState(70);
  const [contractionsPer10min, setContractionsPer10min] = useState(3);
  const [fetalHeartRateBpm, setFetalHeartRateBpm] = useState(140);
  const [fhrCategory, setFhrCategory] = useState<'category_1_normal' | 'category_2_indeterminate' | 'category_3_abnormal'>('category_1_normal');
  const [tachysystolePresent, setTachysystolePresent] = useState(false);
  const [actionTaken, setActionTaken] = useState<
    | 'continue_monitoring'
    | 'oxytocin_initiated'
    | 'insert_removed_spontaneous_labor'
    | 'insert_removed_tachysystole_terbutaline'
    | 'balloon_expelled_ready_amniotomy'
    | 'emergency_cesarean_transfer'
  >('continue_monitoring');
  const [notes, setNotes] = useState('Cervix now favorable (Bishop 7). Moderate regular contractions. FHR reassuring Category I.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await addObstetricPosttermFlowsheet(episodeId, {
        logDatetime,
        hoursFromRipeningStart: Number(hoursFromRipeningStart),
        bishopScoreCurrent: Number(bishopScoreCurrent),
        dilationCm: Number(dilationCm),
        effacementPct: Number(effacementPct),
        contractionsPer10min: Number(contractionsPer10min),
        fetalHeartRateBpm: Number(fetalHeartRateBpm),
        fhrCategory,
        tachysystolePresent,
        actionTaken,
        notes: notes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to log cervical ripening flowsheet checkpoint');
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
          <h4 style={{ margin: 0, color: '#047857' }}>📊 Log Cervical Ripening & Labor Checkpoint</h4>
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
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hours From Ripening Start</label>
              <input
                type="number"
                step="0.5"
                min="0"
                className="form-control"
                value={hoursFromRipeningStart}
                onChange={(e) => setHoursFromRipeningStart(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Bishop Score (/13)</label>
              <input
                type="number"
                min="0"
                max="13"
                className="form-control"
                value={bishopScoreCurrent}
                onChange={(e) => setBishopScoreCurrent(Number(e.target.value))}
                required
              />
              <small style={{ color: bishopScoreCurrent > 6 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                {bishopScoreCurrent > 6 ? 'Favorable (>6)' : 'Unfavorable (≤6)'}
              </small>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Dilation (cm)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="10"
                className="form-control"
                value={dilationCm}
                onChange={(e) => setDilationCm(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Effacement (%)</label>
              <input
                type="number"
                step="5"
                min="0"
                max="100"
                className="form-control"
                value={effacementPct}
                onChange={(e) => setEffacementPct(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Contractions / 10 min</label>
              <input
                type="number"
                min="0"
                max="10"
                className="form-control"
                value={contractionsPer10min}
                onChange={(e) => setContractionsPer10min(Number(e.target.value))}
                required
              />
              <small style={{ color: contractionsPer10min > 5 ? '#dc2626' : 'inherit' }}>
                {contractionsPer10min > 5 ? '⚠️ Tachysystole (>5)' : 'Normal'}
              </small>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Fetal Heart Rate (bpm)</label>
              <input
                type="number"
                min="60"
                max="240"
                className="form-control"
                value={fetalHeartRateBpm}
                onChange={(e) => setFetalHeartRateBpm(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>FHR CTG Category</label>
              <select
                className="form-control"
                value={fhrCategory}
                onChange={(e) => setFhrCategory(e.target.value as any)}
              >
                <option value="category_1_normal">Category I (Normal)</option>
                <option value="category_2_indeterminate">Category II (Indeterminate)</option>
                <option value="category_3_abnormal">Category III (Abnormal)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.85rem', color: tachysystolePresent ? '#dc2626' : 'inherit' }}>
                <input
                  type="checkbox"
                  checked={tachysystolePresent}
                  onChange={(e) => setTachysystolePresent(e.target.checked)}
                />
                Tachysystole Present
              </label>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Action Taken</label>
              <select
                className="form-control"
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value as any)}
              >
                <option value="continue_monitoring">Continue Ripening & Monitoring</option>
                <option value="oxytocin_initiated">Oxytocin Infusion Initiated (Favorable Cervix)</option>
                <option value="insert_removed_spontaneous_labor">Insert Removed: Spontaneous Active Labor</option>
                <option value="insert_removed_tachysystole_terbutaline">Insert Removed: Tachysystole / Terbutaline 0.25mg Given</option>
                <option value="balloon_expelled_ready_amniotomy">Balloon Expelled (≥3 cm): Ready for Amniotomy</option>
                <option value="emergency_cesarean_transfer">Transfer to OR for Emergency Cesarean</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Bedside Notes</label>
            <textarea
              className="form-control"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cervical insert intact. Patient comfortable in left lateral position..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#047857', borderColor: '#065f46' }} disabled={loading}>
              {loading ? 'Recording...' : 'Save Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
