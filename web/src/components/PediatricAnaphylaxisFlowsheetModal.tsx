import React, { useState } from 'react';
import { logPediatricAnaphylaxisFlowsheet } from '../api';

interface PediatricAnaphylaxisFlowsheetModalProps {
  episodeId: number;
  initialWeightKg: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const PediatricAnaphylaxisFlowsheetModal: React.FC<PediatricAnaphylaxisFlowsheetModalProps> = ({
  episodeId,
  initialWeightKg,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [minutesFromArrival, setMinutesFromArrival] = useState(15);
  const [sbpMmhg, setSbpMmhg] = useState(94);
  const [dbpMmhg, setDbpMmhg] = useState<number | ''>(58);
  const [heartRateBpm, setHeartRateBpm] = useState(132);
  const [respiratoryRate, setRespiratoryRate] = useState(28);
  const [spo2Percent, setSpo2Percent] = useState(98);
  const [stridorPresent, setStridorPresent] = useState(false);
  const [wheezeSeverity, setWheezeSeverity] = useState<'none' | 'mild' | 'moderate' | 'severe'>('mild');
  const [urticariaCoverage, setUrticariaCoverage] = useState<'none' | 'localized' | 'generalized'>('localized');
  const [epinephrineIvRateMcgKgMin, setEpinephrineIvRateMcgKgMin] = useState<number | ''>('');
  const [cumulativeImEpinephrineDoses, setCumulativeImEpinephrineDoses] = useState(1);
  const [cumulativeCrystalloidMl, setCumulativeCrystalloidMl] = useState(Math.round(initialWeightKg * 20));
  const [notes, setNotes] = useState('Stridor resolved 10 min post-IM epinephrine. Mild expiratory wheeze persisting. Perfusion brisk, BP stable.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await logPediatricAnaphylaxisFlowsheet(episodeId, {
        logDatetime,
        minutesFromArrival: Number(minutesFromArrival),
        sbpMmhg: Number(sbpMmhg),
        dbpMmhg: dbpMmhg === '' ? null : Number(dbpMmhg),
        heartRateBpm: Number(heartRateBpm),
        respiratoryRate: Number(respiratoryRate),
        spo2Percent: Number(spo2Percent),
        stridorPresent,
        wheezeSeverity,
        urticariaCoverage,
        epinephrineIvRateMcgKgMin: epinephrineIvRateMcgKgMin === '' ? null : Number(epinephrineIvRateMcgKgMin),
        cumulativeImEpinephrineDoses: Number(cumulativeImEpinephrineDoses),
        cumulativeCrystalloidMl: Number(cumulativeCrystalloidMl),
        notes: notes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to log flowsheet checkpoint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="modal-card" style={{ background: '#fff', borderRadius: 8, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h4 style={{ margin: 0, color: '#dc2626' }}>Log Bedside Anaphylaxis Resuscitation Checkpoint</h4>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Log Datetime</label>
              <input type="datetime-local" className="form-control" value={logDatetime} onChange={(e) => setLogDatetime(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Minutes From Arrival (+min)</label>
              <input type="number" className="form-control" value={minutesFromArrival} onChange={(e) => setMinutesFromArrival(Number(e.target.value))} required />
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, marginBottom: 12, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Vital Signs & Hemodynamics</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 6 }}>
              <div>
                <label style={{ fontSize: '0.75rem' }}>SBP (mmHg)</label>
                <input type="number" className="form-control" value={sbpMmhg} onChange={(e) => setSbpMmhg(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem' }}>DBP (mmHg)</label>
                <input type="number" className="form-control" value={dbpMmhg} onChange={(e) => setDbpMmhg(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem' }}>HR (bpm)</label>
                <input type="number" className="form-control" value={heartRateBpm} onChange={(e) => setHeartRateBpm(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem' }}>RR (/min)</label>
                <input type="number" className="form-control" value={respiratoryRate} onChange={(e) => setRespiratoryRate(Number(e.target.value))} required />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>SpO2 (%)</label>
              <input type="number" className="form-control" value={spo2Percent} onChange={(e) => setSpo2Percent(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Wheeze Severity</label>
              <select className="form-control" value={wheezeSeverity} onChange={(e) => setWheezeSeverity(e.target.value as any)}>
                <option value="none">None</option>
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Urticaria Coverage</label>
              <select className="form-control" value={urticariaCoverage} onChange={(e) => setUrticariaCoverage(e.target.value as any)}>
                <option value="none">None / Cleared</option>
                <option value="localized">Localized</option>
                <option value="generalized">Generalized</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 20 }}>
              <label style={{ fontSize: '0.85rem' }}><input type="checkbox" checked={stridorPresent} onChange={(e) => setStridorPresent(e.target.checked)} /> Stridor Present</label>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Cumulative IM Doses</label>
              <input type="number" className="form-control" value={cumulativeImEpinephrineDoses} onChange={(e) => setCumulativeImEpinephrineDoses(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Crystalloid (mL)</label>
              <input type="number" className="form-control" value={cumulativeCrystalloidMl} onChange={(e) => setCumulativeCrystalloidMl(Number(e.target.value))} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Bedside Notes</label>
            <input type="text" className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Logging...' : 'Save Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
