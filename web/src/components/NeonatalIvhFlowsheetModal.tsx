import React, { useState } from 'react';
import { addNeonatalIvhFlowsheet } from '../api';

interface NeonatalIvhFlowsheetModalProps {
  episodeId: number;
  patientId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const NeonatalIvhFlowsheetModal: React.FC<NeonatalIvhFlowsheetModalProps> = ({
  episodeId,
  patientId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [daysFromBaseline, setDaysFromBaseline] = useState(2);
  const [ventricularIndexMm, setVentricularIndexMm] = useState(16.8);
  const [anteriorHornWidthMm, setAnteriorHornWidthMm] = useState(7.5);
  const [headCircumferenceCm, setHeadCircumferenceCm] = useState(25.2);
  const [fontanelleTension, setFontanelleTension] = useState<'normal_soft' | 'full' | 'bulging_tense'>('full');
  const [splitCranialSutures, setSplitCranialSutures] = useState(false);
  const [apneicEpisodes24h, setApneicEpisodes24h] = useState(2);
  const [csfVolumeTappedMl, setCsfVolumeTappedMl] = useState(12.0);
  const [resistiveIndexAca, setResistiveIndexAca] = useState<number | ''>(0.84);
  const [notes, setNotes] = useState('Subcutaneous reservoir tapped via 25G butterfly under sterile conditions. Clear xanthochromic fluid aspirated.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await addNeonatalIvhFlowsheet(episodeId, {
        logDatetime,
        daysFromBaseline: Number(daysFromBaseline),
        ventricularIndexMm: Number(ventricularIndexMm),
        anteriorHornWidthMm: Number(anteriorHornWidthMm),
        headCircumferenceCm: Number(headCircumferenceCm),
        fontanelleTension,
        splitCranialSutures,
        apneicEpisodes24h: Number(apneicEpisodes24h),
        csfVolumeTappedMl: Number(csfVolumeTappedMl),
        resistiveIndexAca: resistiveIndexAca === '' ? null : Number(resistiveIndexAca),
        notes: notes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to log cranial ultrasound flowsheet checkpoint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="modal-card" style={{ background: '#fff', borderRadius: 8, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
          <h4 style={{ margin: 0, color: '#1e3a8a' }}>📊 Log Serial Cranial Ultrasound & PHH Checkpoint</h4>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Log Date/Time</label>
              <input type="datetime-local" className="form-control" value={logDatetime} onChange={(e) => setLogDatetime(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Days from Baseline</label>
              <input type="number" step="0.5" className="form-control" value={daysFromBaseline} onChange={(e) => setDaysFromBaseline(Number(e.target.value))} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Ventricular Index (mm)</label>
              <input type="number" step="0.1" className="form-control" value={ventricularIndexMm} onChange={(e) => setVentricularIndexMm(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Ant Horn Width (mm)</label>
              <input type="number" step="0.1" className="form-control" value={anteriorHornWidthMm} onChange={(e) => setAnteriorHornWidthMm(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Head Circ (cm)</label>
              <input type="number" step="0.1" className="form-control" value={headCircumferenceCm} onChange={(e) => setHeadCircumferenceCm(Number(e.target.value))} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Fontanelle Tension</label>
              <select className="form-control" value={fontanelleTension} onChange={(e) => setFontanelleTension(e.target.value as any)}>
                <option value="normal_soft">Normal / Soft</option>
                <option value="full">Full</option>
                <option value="bulging_tense">Bulging / Tense</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>CSF Volume Tapped (mL)</label>
              <input type="number" step="0.5" className="form-control" value={csfVolumeTappedMl} onChange={(e) => setCsfVolumeTappedMl(Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>ACA Resistive Index</label>
              <input type="number" step="0.01" className="form-control" placeholder="Normal: 0.65-0.75" value={resistiveIndexAca} onChange={(e) => setResistiveIndexAca(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={splitCranialSutures} onChange={(e) => setSplitCranialSutures(e.target.checked)} />
                <strong>Split Cranial Sutures</strong>
              </label>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Apnea/Brady Episodes (24h)</label>
              <input type="number" className="form-control" value={apneicEpisodes24h} onChange={(e) => setApneicEpisodes24h(Number(e.target.value))} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Bedside Notes / Clinical Response</label>
            <textarea className="form-control" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Flowsheet Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
