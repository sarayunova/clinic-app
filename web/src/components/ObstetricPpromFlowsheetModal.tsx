import React, { useState } from 'react';
import { addObstetricPpromFlowsheet } from '../api';

interface ObstetricPpromFlowsheetModalProps {
  episodeId: number;
  patientId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const ObstetricPpromFlowsheetModal: React.FC<ObstetricPpromFlowsheetModalProps> = ({
  episodeId,
  patientId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromAdmission, setHoursFromAdmission] = useState(4);
  const [maternalTempC, setMaternalTempC] = useState(37.1);
  const [maternalHrBpm, setMaternalHrBpm] = useState(82);
  const [maternalBpSbp, setMaternalBpSbp] = useState(118);
  const [maternalBpDbp, setMaternalBpDbp] = useState(74);
  const [fetalHrBpm, setFetalHrBpm] = useState(140);
  const [uterineContractionsPer10min, setUterineContractionsPer10min] = useState(0);
  const [amnioticFluidCharacter, setAmnioticFluidCharacter] = useState<'clear' | 'blood_tinged' | 'purulent_malodorous'>('clear');
  const [maternalWbc, setMaternalWbc] = useState<number | ''>(11200);
  const [ctgCategory, setCtgCategory] = useState<'category_1_normal' | 'category_2_indeterminate' | 'category_3_abnormal'>('category_1_normal');
  const [notes, setNotes] = useState('Patient comfortable. Amniotic fluid leaking continuously, clear without odor. CTG Category 1 reactive.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await addObstetricPpromFlowsheet(episodeId, {
        logDatetime,
        hoursFromAdmission: Number(hoursFromAdmission),
        maternalTempC: Number(maternalTempC),
        maternalHrBpm: Number(maternalHrBpm),
        maternalBpSbp: Number(maternalBpSbp),
        maternalBpDbp: Number(maternalBpDbp),
        fetalHrBpm: Number(fetalHrBpm),
        uterineContractionsPer10min: Number(uterineContractionsPer10min),
        amnioticFluidCharacter,
        maternalWbc: maternalWbc === '' ? null : Number(maternalWbc),
        ctgCategory,
        notes: notes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to log PPROM flowsheet checkpoint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="modal-card" style={{ background: '#fff', borderRadius: 8, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
          <h4 style={{ margin: 0, color: '#991b1b' }}>📊 Log PPROM Latency & Maternal-Fetal Vitals</h4>
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
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hours from Admission</label>
              <input type="number" step="0.5" className="form-control" value={hoursFromAdmission} onChange={(e) => setHoursFromAdmission(Number(e.target.value))} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Maternal Temp (°C)</label>
              <input type="number" step="0.1" className="form-control" value={maternalTempC} onChange={(e) => setMaternalTempC(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Maternal HR (bpm)</label>
              <input type="number" className="form-control" value={maternalHrBpm} onChange={(e) => setMaternalHrBpm(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>BP (SBP)</label>
              <input type="number" className="form-control" value={maternalBpSbp} onChange={(e) => setMaternalBpSbp(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>BP (DBP)</label>
              <input type="number" className="form-control" value={maternalBpDbp} onChange={(e) => setMaternalBpDbp(Number(e.target.value))} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Fetal Heart Rate (bpm)</label>
              <input type="number" className="form-control" value={fetalHrBpm} onChange={(e) => setFetalHrBpm(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Amniotic Fluid Character</label>
              <select className="form-control" value={amnioticFluidCharacter} onChange={(e) => setAmnioticFluidCharacter(e.target.value as any)}>
                <option value="clear">Clear / Straw Colored</option>
                <option value="blood_tinged">Blood Tinged</option>
                <option value="purulent_malodorous">Purulent / Malodorous</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>CTG Category</label>
              <select className="form-control" value={ctgCategory} onChange={(e) => setCtgCategory(e.target.value as any)}>
                <option value="category_1_normal">Category I: Normal</option>
                <option value="category_2_indeterminate">Category II: Indeterminate</option>
                <option value="category_3_abnormal">Category III: Abnormal</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Contractions / 10 min</label>
              <input type="number" className="form-control" value={uterineContractionsPer10min} onChange={(e) => setUterineContractionsPer10min(Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Maternal WBC (/uL)</label>
              <input type="number" className="form-control" placeholder="Optional" value={maternalWbc} onChange={(e) => setMaternalWbc(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Notes</label>
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
