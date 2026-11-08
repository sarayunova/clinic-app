import React, { useState, useEffect } from 'react';
import { logNeonatalHspdaFlowsheet } from '../api';

interface NeonatalHspdaFlowsheetModalProps {
  episodeId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const NeonatalHspdaFlowsheetModal: React.FC<NeonatalHspdaFlowsheetModalProps> = ({
  episodeId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromInitiation, setHoursFromInitiation] = useState(12);
  const [heartRateBpm, setHeartRateBpm] = useState(158);
  const [sbpMmhg, setSbpMmhg] = useState(62);
  const [dbpMmhg, setDbpMmhg] = useState(26);
  const [mapMmhg, setMapMmhg] = useState(38);
  const [pulsePressureMmhg, setPulsePressureMmhg] = useState(36);
  const [respiratorySupportType, setRespiratorySupportType] = useState('simv_prvc');
  const [fio2Percent, setFio2Percent] = useState(35);
  const [spo2Percent, setSpo2Percent] = useState(94);
  const [urineOutputMlKgHr, setUrineOutputMlKgHr] = useState<number | ''>(1.4);
  const [serumCreatinineMgDl, setSerumCreatinineMgDl] = useState<number | ''>(1.0);
  const [plateletCount, setPlateletCount] = useState<number | ''>(48000);
  const [notes, setNotes] = useState('Dose 2 IV Paracetamol administered. Pulse pressure remains wide at 36 mmHg. Urine output adequate.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-calculate MAP and Pulse Pressure
  useEffect(() => {
    const sbp = Number(sbpMmhg) || 0;
    const dbp = Number(dbpMmhg) || 0;
    setPulsePressureMmhg(sbp - dbp);
    setMapMmhg(Math.round(dbp + (sbp - dbp) / 3));
  }, [sbpMmhg, dbpMmhg]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await logNeonatalHspdaFlowsheet(episodeId, {
        logDatetime,
        hoursFromInitiation: Number(hoursFromInitiation),
        heartRateBpm: Number(heartRateBpm),
        sbpMmhg: Number(sbpMmhg),
        dbpMmhg: Number(dbpMmhg),
        mapMmhg: Number(mapMmhg),
        pulsePressureMmhg: Number(pulsePressureMmhg),
        respiratorySupportType,
        fio2Percent: Number(fio2Percent),
        spo2Percent: Number(spo2Percent),
        urineOutputMlKgHr: urineOutputMlKgHr === '' ? null : Number(urineOutputMlKgHr),
        serumCreatinineMgDl: serumCreatinineMgDl === '' ? null : Number(serumCreatinineMgDl),
        plateletCount: plateletCount === '' ? null : Number(plateletCount),
        notes: notes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to log flowsheet observation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="modal-card" style={{ background: '#fff', borderRadius: 8, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h4 style={{ margin: 0, color: '#1e3a8a' }}>Log Bedside hsPDA Hemodynamic Checkpoint</h4>
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
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hours From Initiation (+hrs)</label>
              <input type="number" step="0.5" className="form-control" value={hoursFromInitiation} onChange={(e) => setHoursFromInitiation(Number(e.target.value))} required />
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, marginBottom: 12, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Hemodynamics & Pulse Pressure</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 6 }}>
              <div>
                <label style={{ fontSize: '0.75rem' }}>HR (bpm)</label>
                <input type="number" className="form-control" value={heartRateBpm} onChange={(e) => setHeartRateBpm(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem' }}>SBP (mmHg)</label>
                <input type="number" className="form-control" value={sbpMmhg} onChange={(e) => setSbpMmhg(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem' }}>DBP (mmHg)</label>
                <input type="number" className="form-control" value={dbpMmhg} onChange={(e) => setDbpMmhg(Number(e.target.value))} required />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem' }}>Pulse Pressure</label>
                <input type="number" className="form-control" value={pulsePressureMmhg} readOnly style={{ background: '#f1f5f9', fontWeight: 'bold', color: pulsePressureMmhg >= 30 ? '#dc2626' : 'inherit' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Ventilator Support</label>
              <input type="text" className="form-control" value={respiratorySupportType} onChange={(e) => setRespiratorySupportType(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>FiO2 (%)</label>
              <input type="number" className="form-control" value={fio2Percent} onChange={(e) => setFio2Percent(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>SpO2 (%)</label>
              <input type="number" className="form-control" value={spo2Percent} onChange={(e) => setSpo2Percent(Number(e.target.value))} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Urine (mL/kg/hr)</label>
              <input type="number" step="0.1" className="form-control" value={urineOutputMlKgHr} onChange={(e) => setUrineOutputMlKgHr(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Creatinine (mg/dL)</label>
              <input type="number" step="0.1" className="form-control" value={serumCreatinineMgDl} onChange={(e) => setSerumCreatinineMgDl(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Platelets (/uL)</label>
              <input type="number" className="form-control" value={plateletCount} onChange={(e) => setPlateletCount(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Bedside Notes</label>
            <input type="text" className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Logging...' : 'Save Observation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
