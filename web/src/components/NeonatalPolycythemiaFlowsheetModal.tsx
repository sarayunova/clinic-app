import React, { useState } from 'react';
import { addNeonatalPolycythemiaFlowsheet } from '../api';

interface NeonatalPolycythemiaFlowsheetModalProps {
  episodeId: number;
  patientId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const NeonatalPolycythemiaFlowsheetModal: React.FC<NeonatalPolycythemiaFlowsheetModalProps> = ({
  episodeId,
  patientId: _patientId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromTriage, setHoursFromTriage] = useState(1.0);
  const [aliquotNumber, setAliquotNumber] = useState(1);
  const [volumeWithdrawnMl, setVolumeWithdrawnMl] = useState(15.0);
  const [volumeInfusedMl, setVolumeInfusedMl] = useState(15.0);
  const [cumulativeExchangedMl, setCumulativeExchangedMl] = useState(15.0);
  const [currentHematocritPct, setCurrentHematocritPct] = useState<number | ''>(63.5);

  const [heartRateBpm, setHeartRateBpm] = useState(140);
  const [respiratoryRate, setRespiratoryRate] = useState(46);
  const [meanArterialPressureMmhg, setMeanArterialPressureMmhg] = useState<number | ''>(48);
  const [capillaryRefillSeconds, setCapillaryRefillSeconds] = useState<number | ''>(2.0);
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState<number | ''>(54);
  const [adverseEventsObserved, setAdverseEventsObserved] = useState<
    'none' | 'hypotension_bradycardia' | 'catheter_thrombosis' | 'abdominal_distension_nec_suspicion' | 'hypoglycemia_recurrence'
  >('none');
  const [notes, setNotes] = useState('Aliquot #1 exchanged over 3 min without bradycardia. Infant stable.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await addNeonatalPolycythemiaFlowsheet(episodeId, {
        logDatetime,
        hoursFromTriage: Number(hoursFromTriage),
        aliquotNumber: Number(aliquotNumber),
        volumeWithdrawnMl: Number(volumeWithdrawnMl),
        volumeInfusedMl: Number(volumeInfusedMl),
        cumulativeExchangedMl: Number(cumulativeExchangedMl),
        currentHematocritPct: currentHematocritPct === '' ? null : Number(currentHematocritPct),
        heartRateBpm: Number(heartRateBpm),
        respiratoryRate: Number(respiratoryRate),
        meanArterialPressureMmhg: meanArterialPressureMmhg === '' ? null : Number(meanArterialPressureMmhg),
        capillaryRefillSeconds: capillaryRefillSeconds === '' ? null : Number(capillaryRefillSeconds),
        bloodGlucoseMgDl: bloodGlucoseMgDl === '' ? null : Number(bloodGlucoseMgDl),
        adverseEventsObserved,
        notes: notes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to log polycythemia flowsheet checkpoint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal" style={{ maxWidth: 640, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: 10 }}>
          <h3 style={{ margin: 0, color: '#991b1b' }}>📋 Partial Exchange Transfusion (PET) Flowsheet Entry</h3>
          <button type="button" className="btn small" onClick={onClose}>✕</button>
        </div>

        {error && <div className="banner error" style={{ margin: '12px 0' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
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
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hours from Triage</label>
              <input
                type="number"
                step="0.1"
                min="0"
                className="form-control"
                value={hoursFromTriage}
                onChange={(e) => setHoursFromTriage(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Aliquot Number (#)</label>
              <input
                type="number"
                min="1"
                max="50"
                className="form-control"
                value={aliquotNumber}
                onChange={(e) => setAliquotNumber(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10, marginBottom: 12 }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#334155' }}>Volume Exchanged (mL) & Hct Response</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Withdrawn (mL)</label>
                <input
                  type="number"
                  step="0.5"
                  className="form-control"
                  value={volumeWithdrawnMl}
                  onChange={(e) => setVolumeWithdrawnMl(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Infused NS (mL)</label>
                <input
                  type="number"
                  step="0.5"
                  className="form-control"
                  value={volumeInfusedMl}
                  onChange={(e) => setVolumeInfusedMl(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Cumulative Exchanged</label>
                <input
                  type="number"
                  step="0.5"
                  className="form-control"
                  value={cumulativeExchangedMl}
                  onChange={(e) => setCumulativeExchangedMl(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Current Hct (%)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control"
                  value={currentHematocritPct}
                  onChange={(e) => setCurrentHematocritPct(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Optional check"
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>HR (bpm)</label>
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
              <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>RR (/min)</label>
              <input
                type="number"
                min="10"
                max="150"
                className="form-control"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>MAP (mmHg)</label>
              <input
                type="number"
                step="1"
                className="form-control"
                value={meanArterialPressureMmhg}
                onChange={(e) => setMeanArterialPressureMmhg(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Cap Refill (sec)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={capillaryRefillSeconds}
                onChange={(e) => setCapillaryRefillSeconds(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Glucose (mg/dL)</label>
              <input
                type="number"
                step="1"
                className="form-control"
                value={bloodGlucoseMgDl}
                onChange={(e) => setBloodGlucoseMgDl(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Adverse Events / Complications</label>
            <select
              className="form-control"
              value={adverseEventsObserved}
              onChange={(e: any) => setAdverseEventsObserved(e.target.value)}
            >
              <option value="none">None - Procedure Tolerated Smoothly</option>
              <option value="hypotension_bradycardia">Hypotension / Bradycardia (Pause Infusion)</option>
              <option value="catheter_thrombosis">Catheter Thrombosis / Resistance</option>
              <option value="abdominal_distension_nec_suspicion">Abdominal Distension (NEC Concern - Stop Feeds)</option>
              <option value="hypoglycemia_recurrence">Recurrent Hypoglycemia (Bolus D10W)</option>
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Notes</label>
            <textarea
              className="form-control"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catheter site, perfusion, infant activity..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? 'Logging...' : 'Save Flowsheet Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
