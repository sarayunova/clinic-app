import React, { useState } from 'react';
import { logNeonatalBpdFlowsheet } from '../api';

interface NeonatalBpdFlowsheetModalProps {
  episodeId: number;
  currentPma: number;
  currentSupport: string;
  currentFlow: number;
  currentFio2: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const NeonatalBpdFlowsheetModal: React.FC<NeonatalBpdFlowsheetModalProps> = ({
  episodeId,
  currentPma,
  currentSupport,
  currentFlow,
  currentFio2,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [pmaWeeks, setPmaWeeks] = useState(currentPma);
  const [respiratorySupport, setRespiratorySupport] = useState(currentSupport);
  const [flowLpm, setFlowLpm] = useState(currentFlow);
  const [fio2Percent, setFio2Percent] = useState(currentFio2);
  const [spo2Percent, setSpo2Percent] = useState(93);
  const [targetSpo2InRange, setTargetSpo2InRange] = useState(true);
  const [apneaBradycardiaEpisodes24h, setApneaBradycardiaEpisodes24h] = useState(0);
  const [diureticDoseMgKg, setDiureticDoseMgKg] = useState<number | ''>('');
  const [weightGrams, setWeightGrams] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await logNeonatalBpdFlowsheet(episodeId, {
        logDatetime,
        pmaWeeks,
        respiratorySupport,
        flowLpm,
        fio2Percent,
        spo2Percent,
        targetSpo2InRange,
        apneaBradycardiaEpisodes24h,
        diureticDoseMgKg: diureticDoseMgKg === '' ? null : Number(diureticDoseMgKg),
        weightGrams: weightGrams === '' ? null : Number(weightGrams),
        notes,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to record flowsheet log');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h4>📝 Bedside BPD Respiratory & Weaning Log</h4>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label>Observation Datetime</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={logDatetime}
                  onChange={(e) => setLogDatetime(e.target.value)}
                  required
                />
              </div>

              <div>
                <label>PMA (weeks)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control"
                  value={pmaWeeks}
                  onChange={(e) => setPmaWeeks(parseFloat(e.target.value) || currentPma)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
              <div>
                <label>Respiratory Support</label>
                <input
                  type="text"
                  className="form-control"
                  value={respiratorySupport}
                  onChange={(e) => setRespiratorySupport(e.target.value)}
                  required
                />
              </div>

              <div>
                <label>Flow (L/min)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="15"
                  className="form-control"
                  value={flowLpm}
                  onChange={(e) => setFlowLpm(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label>FiO2 (%)</label>
                <input
                  type="number"
                  min="21"
                  max="100"
                  className="form-control"
                  value={fio2Percent}
                  onChange={(e) => setFio2Percent(parseInt(e.target.value) || 21)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label>SpO2 (%) [Target: 91 - 95%]</label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  className="form-control"
                  value={spo2Percent}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 90;
                    setSpo2Percent(val);
                    setTargetSpo2InRange(val >= 91 && val <= 95);
                  }}
                  required
                />
              </div>

              <div>
                <label>Target SpO2 Status</label>
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={targetSpo2InRange}
                      onChange={(e) => setTargetSpo2InRange(e.target.checked)}
                    />
                    In Target Range (91 - 95%)
                  </label>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
              <div>
                <label>A/B Spells (24h)</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={apneaBradycardiaEpisodes24h}
                  onChange={(e) => setApneaBradycardiaEpisodes24h(parseInt(e.target.value) || 0)}
                />
              </div>

              <div>
                <label>Diuretic Dose (mg/kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="form-control"
                  placeholder="Optional"
                  value={diureticDoseMgKg}
                  onChange={(e) => setDiureticDoseMgKg(e.target.value === '' ? '' : parseFloat(e.target.value))}
                />
              </div>

              <div>
                <label>Weight (g)</label>
                <input
                  type="number"
                  min="300"
                  className="form-control"
                  placeholder="Optional"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value === '' ? '' : parseInt(e.target.value))}
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label>Bedside Notes</label>
              <input
                type="text"
                className="form-control"
                placeholder="Work of breathing, chest retractions, tolerance of flow wean..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Record Observation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
