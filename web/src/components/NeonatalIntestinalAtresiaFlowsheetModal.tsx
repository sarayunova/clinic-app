import React, { useState } from 'react';
import {
  addNeonatalIntestinalAtresiaFlowsheet,
  type NeonatalIntestinalAtresiaRecord,
} from '../api';

interface Props {
  episode: NeonatalIntestinalAtresiaRecord;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalIntestinalAtresiaFlowsheetModal: React.FC<Props> = ({
  episode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [hoursFromAdmission, setHoursFromAdmission] = useState<number>(6);
  const [nasogastricOutputMl, setNasogastricOutputMl] = useState<number>(18.5);
  const [nasogastricAspirateCharacter, setNasogastricAspirateCharacter] = useState<
    'clear_gastric' | 'bilious_dark_green' | 'feculent_stasis'
  >('bilious_dark_green');
  const [abdominalGirthCm, setAbdominalGirthCm] = useState<number>(27.5);
  const [enteralFeedRateMlHr, setEnteralFeedRateMlHr] = useState<number>(0.0);
  const [stoolPassageObserved, setStoolPassageObserved] = useState<boolean>(false);
  const [stoolCharacter, setStoolCharacter] = useState<
    'none' | 'pale_mucus_plug' | 'transitional_meconium' | 'normal_yellow_breastmilk_stool'
  >('none');
  const [heartRate, setHeartRate] = useState<number>(140);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(44);
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await addNeonatalIntestinalAtresiaFlowsheet(episode.id, {
        logDatetime,
        hoursFromAdmission: Number(hoursFromAdmission),
        nasogastricOutputMl: Number(nasogastricOutputMl),
        nasogastricAspirateCharacter,
        abdominalGirthCm: Number(abdominalGirthCm),
        enteralFeedRateMlHr: Number(enteralFeedRateMlHr),
        stoolPassageObserved,
        stoolCharacter,
        heartRate: Number(heartRate),
        respiratoryRate: Number(respiratoryRate),
        notes: notes.trim() || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record intestinal atresia flowsheet log.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card wide" style={{ maxWidth: '780px' }}>
        <div className="modal-header">
          <h2>📊 NG Decompression, Feeds &amp; Transit Flowsheet Log</h2>
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
                <label className="form-label">Hours from Admission</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="720"
                  className="form-control"
                  value={hoursFromAdmission}
                  onChange={(e) => setHoursFromAdmission(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">NG / Replogle Output (mL)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="500"
                  className="form-control"
                  value={nasogastricOutputMl}
                  onChange={(e) => setNasogastricOutputMl(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">NG Aspirate Character</label>
                <select
                  className="form-select"
                  value={nasogastricAspirateCharacter}
                  onChange={(e) => setNasogastricAspirateCharacter(e.target.value as any)}
                >
                  <option value="bilious_dark_green">Bilious (Dark Forest Green)</option>
                  <option value="clear_gastric">Clear / Colorless Gastric Juice</option>
                  <option value="feculent_stasis">Feculent Stasis (Distal Obstruction)</option>
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">Abdominal Girth (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="15"
                  max="60"
                  className="form-control"
                  value={abdominalGirthCm}
                  onChange={(e) => setAbdominalGirthCm(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Enteral / TAT Feed Rate (mL/hr)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="30"
                  className="form-control"
                  value={enteralFeedRateMlHr}
                  onChange={(e) => setEnteralFeedRateMlHr(Number(e.target.value))}
                  required
                />
                <small className="text-muted">0 = NPO on total parenteral nutrition</small>
              </div>

              <div className="col-md-6">
                <label className="form-label">Stool Passage &amp; Transit</label>
                <select
                  className="form-select"
                  value={stoolCharacter}
                  onChange={(e) => {
                    const sc = e.target.value as any;
                    setStoolCharacter(sc);
                    setStoolPassageObserved(sc !== 'none');
                  }}
                >
                  <option value="none">None (No Stool Passed)</option>
                  <option value="pale_mucus_plug">Pale / Gray Mucus Plug (Distal Atresia)</option>
                  <option value="transitional_meconium">Transitional Dark Meconium</option>
                  <option value="normal_yellow_breastmilk_stool">Normal Yellow Breastmilk Stool</option>
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">Heart Rate (bpm)</label>
                <input
                  type="number"
                  min="60"
                  max="220"
                  className="form-control"
                  value={heartRate}
                  onChange={(e) => setHeartRate(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Respiratory Rate (breaths/min)</label>
                <input
                  type="number"
                  min="15"
                  max="100"
                  className="form-control"
                  value={respiratoryRate}
                  onChange={(e) => setRespiratoryRate(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-md-12">
                <label className="form-label">Bedside Notes &amp; Observations</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="e.g. Sump flushed with 1 mL saline; bilious drainage continues. Abdomen soft, non-tender. TAT breastmilk feeds well tolerated."
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
