import React, { useState, useEffect } from 'react';
import {
  createNeonatalBpdEpisode,
  calculateNeonatalBpd,
  type NeonatalBpdRecord,
} from '../api';
import { type RespiratorySupportType } from '../neonatalBpdEngine';

interface NeonatalBpdModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: (ep: NeonatalBpdRecord) => void;
}

export const NeonatalBpdModal: React.FC<NeonatalBpdModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState(28.0);
  const [birthWeightGrams, setBirthWeightGrams] = useState(1050);
  const [currentPmaWeeks, setCurrentPmaWeeks] = useState(36.0);
  const [evaluationDatetime, setEvaluationDatetime] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [respiratorySupportType, setRespiratorySupportType] =
    useState<RespiratorySupportType>('nasal_cannula_low_flow');
  const [cannulaFlowLpm, setCannulaFlowLpm] = useState(1.0);
  const [fio2Percent, setFio2Percent] = useState(25);
  const [caffeineTherapyActive, setCaffeineTherapyActive] = useState(true);
  const [diureticTherapyActive, setDiureticTherapyActive] = useState(false);
  const [postnatalSteroidsActive, setPostnatalSteroidsActive] = useState(false);
  const [steroidRegimen, setSteroidRegimen] = useState('');
  const [homeOxygenPlanned, setHomeOxygenPlanned] = useState(false);
  const [status, setStatus] = useState<'evaluating' | 'inpatient_respiratory_care' | 'weaning_protocol' | 'discharged_home_oxygen' | 'resolved'>('inpatient_respiratory_care');
  const [clinicalNotes, setClinicalNotes] = useState('');

  const [preview, setPreview] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculateNeonatalBpd({
      gestationalAgeWeeks,
      birthWeightGrams,
      currentPmaWeeks,
      respiratorySupportType,
      cannulaFlowLpm,
      fio2Percent,
      caffeineTherapyActive,
      diureticTherapyActive,
      postnatalSteroidsActive,
    })
      .then((res) => setPreview(res.evalResult))
      .catch(() => {});
  }, [
    gestationalAgeWeeks,
    birthWeightGrams,
    currentPmaWeeks,
    respiratorySupportType,
    cannulaFlowLpm,
    fio2Percent,
    caffeineTherapyActive,
    diureticTherapyActive,
    postnatalSteroidsActive,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await createNeonatalBpdEpisode({
        patientId,
        evaluationDatetime,
        gestationalAgeWeeks,
        birthWeightGrams,
        currentPmaWeeks,
        respiratorySupportType,
        cannulaFlowLpm,
        fio2Percent,
        caffeineTherapyActive,
        diureticTherapyActive,
        postnatalSteroidsActive,
        steroidRegimen: postnatalSteroidsActive ? steroidRegimen : null,
        homeOxygenPlanned,
        status,
        clinicalNotes,
      });
      onSuccess(res.episode);
    } catch (err: any) {
      setError(err?.message || 'Failed to record neonatal BPD evaluation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 820 }}>
        <div className="modal-header">
          <h3>🫁 Neonatal BPD & Jensen 2019 Staging Evaluation</h3>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}

            <div style={{ background: '#f8f9fa', padding: 12, borderRadius: 6, marginBottom: 16 }}>
              <strong>Patient:</strong> {patientName} (ID: #{patientId})
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
              <div>
                <label>Gestational Age at Birth (weeks)</label>
                <input
                  type="number"
                  step="0.1"
                  min="22"
                  max="42"
                  className="form-control"
                  value={gestationalAgeWeeks}
                  onChange={(e) => setGestationalAgeWeeks(parseFloat(e.target.value) || 28)}
                  required
                />
              </div>

              <div>
                <label>Birth Weight (grams)</label>
                <input
                  type="number"
                  min="300"
                  max="5000"
                  className="form-control"
                  value={birthWeightGrams}
                  onChange={(e) => setBirthWeightGrams(parseInt(e.target.value) || 1000)}
                  required
                />
              </div>

              <div>
                <label>Current PMA (weeks)</label>
                <input
                  type="number"
                  step="0.1"
                  min="24"
                  max="55"
                  className="form-control"
                  value={currentPmaWeeks}
                  onChange={(e) => setCurrentPmaWeeks(parseFloat(e.target.value) || 36)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
              <div>
                <label>Respiratory Support Modality</label>
                <select
                  className="form-control"
                  value={respiratorySupportType}
                  onChange={(e) => setRespiratorySupportType(e.target.value as RespiratorySupportType)}
                  required
                >
                  <option value="none_room_air">None (Room Air)</option>
                  <option value="nasal_cannula_low_flow">Nasal Cannula (Low Flow &le; 2 L/min)</option>
                  <option value="nasal_cannula_high_flow">High-Flow Nasal Cannula (HFNC)</option>
                  <option value="cpap_nippv">CPAP / NIPPV (Non-Invasive)</option>
                  <option value="invasive_mechanical_ventilation">Invasive Mechanical Ventilation</option>
                </select>
              </div>

              <div>
                <label>Cannula Flow (L/min)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="15"
                  className="form-control"
                  value={cannulaFlowLpm}
                  onChange={(e) => setCannulaFlowLpm(parseFloat(e.target.value) || 0)}
                  disabled={respiratorySupportType === 'none_room_air' || respiratorySupportType === 'invasive_mechanical_ventilation'}
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12, background: '#eef6fc', padding: 10, borderRadius: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <input
                  type="checkbox"
                  checked={caffeineTherapyActive}
                  onChange={(e) => setCaffeineTherapyActive(e.target.checked)}
                />
                Caffeine Active
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <input
                  type="checkbox"
                  checked={diureticTherapyActive}
                  onChange={(e) => setDiureticTherapyActive(e.target.checked)}
                />
                Diuretics Active
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <input
                  type="checkbox"
                  checked={postnatalSteroidsActive}
                  onChange={(e) => setPostnatalSteroidsActive(e.target.checked)}
                />
                Postnatal Steroids
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <input
                  type="checkbox"
                  checked={homeOxygenPlanned}
                  onChange={(e) => setHomeOxygenPlanned(e.target.checked)}
                />
                Home O2 Planned
              </label>
            </div>

            {postnatalSteroidsActive && (
              <div style={{ marginBottom: 12 }}>
                <label>Steroid Protocol & Regimen Details (e.g. DART dexamethasone taper)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="DART protocol: 0.89 mg/kg cumulative over 10 days"
                  value={steroidRegimen}
                  onChange={(e) => setSteroidRegimen(e.target.value)}
                />
              </div>
            )}

            {preview && (
              <div style={{ background: '#fdf7e7', borderLeft: '4px solid #f39c12', padding: 12, borderRadius: 4, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: '1.05rem' }}>Staging: {preview.gradeLabel}</strong>
                  <span className="badge badge-info" style={{ fontSize: '0.85rem' }}>
                    Target SpO2: {preview.targetSpo2Min}% - {preview.targetSpo2Max}%
                  </span>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#444', marginBottom: 6 }}>{preview.severitySummary}</div>
                <div style={{ fontSize: '0.85rem', color: '#2c3e50' }}>
                  <strong>Caffeine:</strong> {preview.caffeineRecommendation}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label>Clinical Status</label>
                <select
                  className="form-control"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="evaluating">Evaluating</option>
                  <option value="inpatient_respiratory_care">Inpatient Respiratory Care</option>
                  <option value="weaning_protocol">Weaning Protocol</option>
                  <option value="discharged_home_oxygen">Discharged on Home Oxygen</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div>
                <label>Clinical Notes</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Assessment of lung mechanics, blood gases, echocardiography screening..."
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save BPD Evaluation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
