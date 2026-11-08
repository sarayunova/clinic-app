import React, { useState } from 'react';
import { addPediatricSvtFlowsheet } from '../api';

interface PediatricSvtFlowsheetModalProps {
  episodeId: number;
  patientId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const PediatricSvtFlowsheetModal: React.FC<PediatricSvtFlowsheetModalProps> = ({
  episodeId,
  patientId: _patientId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [minutesFromTriage, setMinutesFromTriage] = useState(15);
  const [heartRateBpm, setHeartRateBpm] = useState(240);
  const [rhythmState, setRhythmState] = useState<
    'svt_active' | 'sinus_rhythm_restored' | 'sinus_bradycardia' | 'junctional_or_other'
  >('svt_active');
  const [sbpMmhg, setSbpMmhg] = useState(72);
  const [dbpMmhg, setDbpMmhg] = useState<number | ''>(42);
  const [capillaryRefillSeconds, setCapillaryRefillSeconds] = useState(3.0);
  const [mentalStatus, setMentalStatus] = useState<'alert_normal' | 'irritable' | 'lethargic' | 'unresponsive'>('lethargic');
  const [spo2Percent, setSpo2Percent] = useState(94);
  const [interventionAdministered, setInterventionAdministered] = useState<
    | 'none'
    | 'ice_bag_to_face'
    | 'valsalva'
    | 'adenosine_dose_1'
    | 'adenosine_dose_2'
    | 'synchronized_cardioversion'
    | 'antiarrhythmic_infusion'
  >('adenosine_dose_1');
  const [notes, setNotes] = useState('Adenosine 0.1 mg/kg rapid IV push via left AC with 10 mL NS rapid flush.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await addPediatricSvtFlowsheet(episodeId, {
        logDatetime,
        minutesFromTriage: Number(minutesFromTriage),
        heartRateBpm: Number(heartRateBpm),
        rhythmState,
        sbpMmhg: Number(sbpMmhg),
        dbpMmhg: dbpMmhg === '' ? null : Number(dbpMmhg),
        capillaryRefillSeconds: Number(capillaryRefillSeconds),
        mentalStatus,
        spo2Percent: Number(spo2Percent),
        interventionAdministered,
        notes: notes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to log pediatric SVT flowsheet entry');
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
          <h4 style={{ margin: 0, color: '#dc2626' }}>⚡ Log PALS Bedside SVT Flowsheet Checkpoint</h4>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

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
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Minutes from Triage</label>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Heart Rate (bpm)</label>
              <input
                type="number"
                min="30"
                max="350"
                className="form-control"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Rhythm State</label>
              <select
                className="form-control"
                value={rhythmState}
                onChange={(e) => setRhythmState(e.target.value as any)}
              >
                <option value="svt_active">SVT Active (Tachycardia)</option>
                <option value="sinus_rhythm_restored">Sinus Rhythm Restored</option>
                <option value="sinus_bradycardia">Sinus Bradycardia</option>
                <option value="junctional_or_other">Junctional / Other Reentry</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Mental Status</label>
              <select
                className="form-control"
                value={mentalStatus}
                onChange={(e) => setMentalStatus(e.target.value as any)}
              >
                <option value="alert_normal">Alert / Normal</option>
                <option value="irritable">Irritable</option>
                <option value="lethargic">Lethargic</option>
                <option value="unresponsive">Unresponsive</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Systolic BP (mmHg)</label>
              <input
                type="number"
                min="30"
                max="250"
                className="form-control"
                value={sbpMmhg}
                onChange={(e) => setSbpMmhg(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Diastolic BP (mmHg)</label>
              <input
                type="number"
                min="10"
                max="150"
                className="form-control"
                value={dbpMmhg}
                onChange={(e) => setDbpMmhg(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Capillary Refill (s)</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="10.0"
                className="form-control"
                value={capillaryRefillSeconds}
                onChange={(e) => setCapillaryRefillSeconds(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>SpO2 (%)</label>
              <input
                type="number"
                min="50"
                max="100"
                className="form-control"
                value={spo2Percent}
                onChange={(e) => setSpo2Percent(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Intervention Administered</label>
            <select
              className="form-control"
              value={interventionAdministered}
              onChange={(e) => setInterventionAdministered(e.target.value as any)}
            >
              <option value="none">None / Observation Only</option>
              <option value="ice_bag_to_face">Vagal: Ice Bag to Face (Infant 15-20s)</option>
              <option value="valsalva">Vagal: Modified Valsalva (Syringe blow + leg raise)</option>
              <option value="adenosine_dose_1">Adenosine Dose 1 (0.1 mg/kg, max 6 mg) Rapid Flush</option>
              <option value="adenosine_dose_2">Adenosine Dose 2 (0.2 mg/kg, max 12 mg) Rapid Flush</option>
              <option value="synchronized_cardioversion">Synchronized Electrical Cardioversion (0.5-2.0 J/kg)</option>
              <option value="antiarrhythmic_infusion">Maintenance Antiarrhythmic Infusion (Amiodarone / Procainamide)</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Notes / Rhythm Observations</label>
            <textarea
              className="form-control"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Brief transient sinus pause followed by prompt restoration of normal sinus rhythm at 115 bpm..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }} disabled={loading}>
              {loading ? 'Recording...' : 'Save SVT Flowsheet Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
