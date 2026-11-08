import React, { useState } from 'react';
import {
  addPediatricOsteomyelitisFlowsheet,
  type PediatricOsteomyelitisRecord,
} from '../api';

interface Props {
  episode: PediatricOsteomyelitisRecord;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricOsteomyelitisFlowsheetModal: React.FC<Props> = ({
  episode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [dayOfTherapy, setDayOfTherapy] = useState<number>(3);
  const [temperatureCelsius, setTemperatureCelsius] = useState<number>(37.6);
  const [crpLevelMgL, setCrpLevelMgL] = useState<number>(
    Math.max(5, Math.round(episode.crp_peak_mg_l * 0.6))
  );
  const [esrMmHr, setEsrMmHr] = useState<number | ''>(35);
  const [painScoreFlaccOrVas, setPainScoreFlaccOrVas] = useState<number>(3);
  const [weightBearingStatus, setWeightBearingStatus] = useState<
    'unable_refuses_pseudoparalysis' | 'partial_weight_bearing_limp' | 'full_weight_bearing_pain_free'
  >('partial_weight_bearing_limp');
  const [localSigns, setLocalSigns] = useState<
    'marked_edema_erythema_warmth' | 'moderately_tender_improving' | 'mild_tenderness_no_swelling' | 'completely_quiescent'
  >('moderately_tender_improving');
  const [routeOfAdministration, setRouteOfAdministration] = useState<'iv_infusion' | 'oral_step_down'>('iv_infusion');
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await addPediatricOsteomyelitisFlowsheet(episode.id, {
        logDatetime,
        dayOfTherapy: Number(dayOfTherapy),
        temperatureCelsius: Number(temperatureCelsius),
        crpLevelMgL: Number(crpLevelMgL),
        esrMmHr: esrMmHr !== '' ? Number(esrMmHr) : null,
        painScoreFlaccOrVas: Number(painScoreFlaccOrVas),
        weightBearingStatus,
        localSigns,
        routeOfAdministration,
        notes: notes.trim() || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record osteomyelitis flowsheet log.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card wide" style={{ maxWidth: '780px' }}>
        <div className="modal-header">
          <h2>📊 AHO Biomarker &amp; Clinical Recovery Flowsheet Log</h2>
          <button type="button" className="btn-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Log Date &amp; Time</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={logDatetime}
                  onChange={(e) => setLogDatetime(e.target.value)}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Day of Antimicrobial Therapy</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  className="form-control"
                  value={dayOfTherapy}
                  onChange={(e) => setDayOfTherapy(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Body Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  min="34"
                  max="43"
                  className="form-control"
                  value={temperatureCelsius}
                  onChange={(e) => setTemperatureCelsius(Number(e.target.value))}
                  required
                />
                <small className="text-muted">&lt; 38.0°C indicates afebrile state</small>
              </div>

              <div className="col-md-6">
                <label className="form-label">Serum CRP Level (mg/L)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="500"
                  className="form-control"
                  value={crpLevelMgL}
                  onChange={(e) => setCrpLevelMgL(Number(e.target.value))}
                  required
                />
                <small className="text-muted">Peak was {episode.crp_peak_mg_l} mg/L</small>
              </div>

              <div className="col-md-6">
                <label className="form-label">ESR (mm/hr, optional)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="150"
                  className="form-control"
                  placeholder="e.g. 35 mm/hr"
                  value={esrMmHr}
                  onChange={(e) => setEsrMmHr(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Pain Score (FLACC / VAS 0-10)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  className="form-control"
                  value={painScoreFlaccOrVas}
                  onChange={(e) => setPainScoreFlaccOrVas(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Weight-Bearing &amp; Mobility Status</label>
                <select
                  className="form-select"
                  value={weightBearingStatus}
                  onChange={(e) => setWeightBearingStatus(e.target.value as any)}
                >
                  <option value="unable_refuses_pseudoparalysis">Refuses Weight-Bearing / Pseudoparalysis</option>
                  <option value="partial_weight_bearing_limp">Partial Weight-Bearing with Antalgic Limp</option>
                  <option value="full_weight_bearing_pain_free">Full Weight-Bearing Pain-Free</option>
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">Local Bone / Joint Physical Signs</label>
                <select
                  className="form-select"
                  value={localSigns}
                  onChange={(e) => setLocalSigns(e.target.value as any)}
                >
                  <option value="marked_edema_erythema_warmth">Marked Edema, Warmth &amp; Point Tenderness</option>
                  <option value="moderately_tender_improving">Moderately Tender, Warmth Improving</option>
                  <option value="mild_tenderness_no_swelling">Mild Tenderness Only, No Swelling</option>
                  <option value="completely_quiescent">Completely Quiescent / Normal Exam</option>
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">Route of Antibiotic Delivery</label>
                <select
                  className="form-select"
                  value={routeOfAdministration}
                  onChange={(e) => setRouteOfAdministration(e.target.value as any)}
                >
                  <option value="iv_infusion">Intravenous Infusion (IV)</option>
                  <option value="oral_step_down">Oral Step-Down Suspension/Tablet</option>
                </select>
              </div>

              <div className="col-md-12">
                <label className="form-label">Bedside Notes &amp; Observations</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="e.g. Child actively crawling and bearing partial weight on affected leg. Tolerating oral feeds well."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Logging...' : 'Save Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
