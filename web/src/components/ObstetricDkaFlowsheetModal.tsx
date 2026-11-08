import React, { useState } from 'react';
import { logObstetricDkaFlowsheet } from '../api';

interface ObstetricDkaFlowsheetModalProps {
  episodeId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const ObstetricDkaFlowsheetModal: React.FC<ObstetricDkaFlowsheetModalProps> = ({
  episodeId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromPresentation, setHoursFromPresentation] = useState(2);
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState(154);
  const [insulinRateUnitsHr, setInsulinRateUnitsHr] = useState(3.5);
  const [ivFluidType, setIvFluidType] = useState('D5W with 0.45% NS + 20 mEq KCl');
  const [ivFluidRateMlHr, setIvFluidRateMlHr] = useState(250);
  const [vbgPh, setVbgPh] = useState<number | ''>(7.28);
  const [serumBicarbonateMeqL, setSerumBicarbonateMeqL] = useState<number | ''>(15);
  const [calculatedAnionGap, setCalculatedAnionGap] = useState<number | ''>(14);
  const [serumPotassiumMeqL, setSerumPotassiumMeqL] = useState(4.0);
  const [potassiumReplacementMeqL, setPotassiumReplacementMeqL] = useState(20);
  const [fhrBaselineBpm, setFhrBaselineBpm] = useState<number | ''>(150);
  const [fhrVariability, setFhrVariability] = useState('moderate');
  const [fhrDecelerations, setFhrDecelerations] = useState('none');
  const [maternalSbpMmhg, setMaternalSbpMmhg] = useState<number | ''>(118);
  const [maternalDbpMmhg, setMaternalDbpMmhg] = useState<number | ''>(72);
  const [maternalHrBpm, setMaternalHrBpm] = useState<number | ''>(88);
  const [urineOutputMlHr, setUrineOutputMlHr] = useState<number | ''>(65);
  const [notes, setNotes] = useState('Glucose dropped to 154 mg/dL. D5W added to maintain glycemic target. Anion gap improving (14 mEq/L). FHR tracing restored to Category I.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await logObstetricDkaFlowsheet(episodeId, {
        logDatetime,
        hoursFromPresentation: Number(hoursFromPresentation),
        bloodGlucoseMgDl: Number(bloodGlucoseMgDl),
        insulinRateUnitsHr: Number(insulinRateUnitsHr),
        ivFluidType,
        ivFluidRateMlHr: Number(ivFluidRateMlHr),
        vbgPh: vbgPh === '' ? null : Number(vbgPh),
        serumBicarbonateMeqL: serumBicarbonateMeqL === '' ? null : Number(serumBicarbonateMeqL),
        calculatedAnionGap: calculatedAnionGap === '' ? null : Number(calculatedAnionGap),
        serumPotassiumMeqL: Number(serumPotassiumMeqL),
        potassiumReplacementMeqL: Number(potassiumReplacementMeqL),
        fhrBaselineBpm: fhrBaselineBpm === '' ? null : Number(fhrBaselineBpm),
        fhrVariability: fhrVariability || null,
        fhrDecelerations: fhrDecelerations || null,
        maternalSbpMmhg: maternalSbpMmhg === '' ? null : Number(maternalSbpMmhg),
        maternalDbpMmhg: maternalDbpMmhg === '' ? null : Number(maternalDbpMmhg),
        maternalHrBpm: maternalHrBpm === '' ? null : Number(maternalHrBpm),
        urineOutputMlHr: urineOutputMlHr === '' ? null : Number(urineOutputMlHr),
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
      <div className="modal-card" style={{ background: '#fff', borderRadius: 8, maxWidth: 680, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h4 style={{ margin: 0, color: '#991b1b' }}>Log Bedside DKA & Fetal Surveillance Checkpoint</h4>
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
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hours From Presentation (+hrs)</label>
              <input type="number" step="0.5" className="form-control" value={hoursFromPresentation} onChange={(e) => setHoursFromPresentation(Number(e.target.value))} required />
            </div>
          </div>

          <div style={{ background: '#fef2f2', padding: 10, borderRadius: 6, marginBottom: 12, border: '1px solid #fecaca' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#991b1b' }}>Glucose, Insulin & Fluid Titration</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 6 }}>
              <div>
                <label style={{ fontSize: '0.75rem' }}>Blood Glucose (mg/dL)</label>
                <input type="number" className="form-control" value={bloodGlucoseMgDl} onChange={(e) => setBloodGlucoseMgDl(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem' }}>Insulin Rate (U/hr)</label>
                <input type="number" step="0.1" className="form-control" value={insulinRateUnitsHr} onChange={(e) => setInsulinRateUnitsHr(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem' }}>IV Fluid Rate (mL/hr)</label>
                <input type="number" className="form-control" value={ivFluidRateMlHr} onChange={(e) => setIvFluidRateMlHr(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem' }}>K+ Added (mEq/L)</label>
                <input type="number" className="form-control" value={potassiumReplacementMeqL} onChange={(e) => setPotassiumReplacementMeqL(Number(e.target.value))} required />
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: '0.75rem' }}>IV Fluid Composition (e.g. D5W with 0.45% NS + 20 mEq KCl)</label>
              <input type="text" className="form-control" value={ivFluidType} onChange={(e) => setIvFluidType(e.target.value)} required />
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, marginBottom: 12, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Metabolic & Acid-Base Trend</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 6 }}>
              <div>
                <label style={{ fontSize: '0.75rem' }}>VBG pH</label>
                <input type="number" step="0.01" className="form-control" value={vbgPh} onChange={(e) => setVbgPh(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem' }}>HCO3 (mEq/L)</label>
                <input type="number" step="0.5" className="form-control" value={serumBicarbonateMeqL} onChange={(e) => setSerumBicarbonateMeqL(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem' }}>Anion Gap (mEq/L)</label>
                <input type="number" step="0.5" className="form-control" value={calculatedAnionGap} onChange={(e) => setCalculatedAnionGap(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem' }}>Serum K+ (mEq/L)</label>
                <input type="number" step="0.1" className="form-control" value={serumPotassiumMeqL} onChange={(e) => setSerumPotassiumMeqL(Number(e.target.value))} required />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>FHR Baseline (bpm)</label>
              <input type="number" className="form-control" value={fhrBaselineBpm} onChange={(e) => setFhrBaselineBpm(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>FHR Variability</label>
              <input type="text" className="form-control" value={fhrVariability} onChange={(e) => setFhrVariability(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Urine Output (mL/hr)</label>
              <input type="number" className="form-control" value={urineOutputMlHr} onChange={(e) => setUrineOutputMlHr(e.target.value === '' ? '' : Number(e.target.value))} />
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
