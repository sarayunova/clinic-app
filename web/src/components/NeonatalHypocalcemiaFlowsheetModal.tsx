import React, { useState } from 'react';
import { addNeonatalHypocalcemiaFlowsheet } from '../api';

interface NeonatalHypocalcemiaFlowsheetModalProps {
  episodeId: number;
  patientId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const NeonatalHypocalcemiaFlowsheetModal: React.FC<NeonatalHypocalcemiaFlowsheetModalProps> = ({
  episodeId,
  patientId: _patientId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromInitiation, setHoursFromInitiation] = useState(4.0);
  const [heartRateBpm, setHeartRateBpm] = useState(144);
  const [ionizedCalciumMmolL, setIonizedCalciumMmolL] = useState(0.98);
  const [totalCalciumMgDl, setTotalCalciumMgDl] = useState<number | ''>(7.2);
  const [serumMagnesiumMgDl, setSerumMagnesiumMgDl] = useState<number | ''>(1.7);
  const [calciumInfusionRateMlHr, setCalciumInfusionRateMlHr] = useState(0.2);
  const [ivSiteCondition, setIvSiteCondition] = useState<
    'patent_no_extravasation' | 'mild_erythema_monitored' | 'extravasation_infusion_stopped'
  >('patent_no_extravasation');
  const [clinicalNeuromuscularState, setClinicalNeuromuscularState] = useState<
    'normal_tone_calm' | 'mild_tremor_on_handling' | 'marked_jitteriness' | 'active_seizure'
  >('normal_tone_calm');
  const [ecgRhythmStrip, setEcgRhythmStrip] = useState<
    'normal_sinus_rhythm' | 'sinus_bradycardia' | 'qtc_prolongation_improving' | 'arrhythmia_noted'
  >('normal_sinus_rhythm');
  const [notes, setNotes] = useState('iCa improved from 0.82 to 0.98 mmol/L. Jitteriness resolved. Infusion patent without extravasation.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await addNeonatalHypocalcemiaFlowsheet(episodeId, {
        logDatetime,
        hoursFromInitiation: Number(hoursFromInitiation),
        heartRateBpm: Number(heartRateBpm),
        ionizedCalciumMmolL: Number(ionizedCalciumMmolL),
        totalCalciumMgDl: totalCalciumMgDl === '' ? null : Number(totalCalciumMgDl),
        serumMagnesiumMgDl: serumMagnesiumMgDl === '' ? null : Number(serumMagnesiumMgDl),
        calciumInfusionRateMlHr: Number(calciumInfusionRateMlHr),
        ivSiteCondition,
        clinicalNeuromuscularState,
        ecgRhythmStrip,
        notes: notes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to log hypocalcemia flowsheet checkpoint');
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
          <h4 style={{ margin: 0, color: '#b45309' }}>📊 Log Bedside Calcium Infusion Checkpoint</h4>
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
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hours From Initiation</label>
              <input
                type="number"
                step="0.5"
                min="0"
                className="form-control"
                value={hoursFromInitiation}
                onChange={(e) => setHoursFromInitiation(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Heart Rate (bpm)</label>
              <input
                type="number"
                min="40"
                max="250"
                className="form-control"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(Number(e.target.value))}
                required
              />
              <small style={{ color: heartRateBpm < 100 ? '#dc2626' : '#16a34a' }}>
                {heartRateBpm < 100 ? '⚠️ Bradycardia Warning!' : 'Normocardic'}
              </small>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Ionized Calcium (mmol/L)</label>
              <input
                type="number"
                step="0.01"
                min="0.2"
                max="2.5"
                className="form-control"
                value={ionizedCalciumMmolL}
                onChange={(e) => setIonizedCalciumMmolL(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Infusion Rate (mL/hr)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="20"
                className="form-control"
                value={calciumInfusionRateMlHr}
                onChange={(e) => setCalciumInfusionRateMlHr(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Total Calcium (mg/dL)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={totalCalciumMgDl}
                onChange={(e) => setTotalCalciumMgDl(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Serum Magnesium (mg/dL)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={serumMagnesiumMgDl}
                onChange={(e) => setSerumMagnesiumMgDl(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>IV Line Site Condition</label>
              <select
                className="form-control"
                value={ivSiteCondition}
                onChange={(e) => setIvSiteCondition(e.target.value as any)}
              >
                <option value="patent_no_extravasation">Patent / No extravasation</option>
                <option value="mild_erythema_monitored">Mild Erythema / Monitored</option>
                <option value="extravasation_infusion_stopped">Extravasation / STOPPED</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Neuromuscular State</label>
              <select
                className="form-control"
                value={clinicalNeuromuscularState}
                onChange={(e) => setClinicalNeuromuscularState(e.target.value as any)}
              >
                <option value="normal_tone_calm">Normal Tone / Calm</option>
                <option value="mild_tremor_on_handling">Mild Tremor on Handling</option>
                <option value="marked_jitteriness">Marked Jitteriness</option>
                <option value="active_seizure">Active Seizure</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>ECG Rhythm Strip</label>
              <select
                className="form-control"
                value={ecgRhythmStrip}
                onChange={(e) => setEcgRhythmStrip(e.target.value as any)}
              >
                <option value="normal_sinus_rhythm">Normal Sinus Rhythm</option>
                <option value="sinus_bradycardia">Sinus Bradycardia</option>
                <option value="qtc_prolongation_improving">QTc Prolongation Improving</option>
                <option value="arrhythmia_noted">Arrhythmia Noted</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Bedside Observations & Action</label>
            <textarea
              className="form-control"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Infusion running via right forearm 24G cannula without resistance or swelling..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#b45309', borderColor: '#92400e' }} disabled={loading}>
              {loading ? 'Recording...' : 'Save Flowsheet Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
