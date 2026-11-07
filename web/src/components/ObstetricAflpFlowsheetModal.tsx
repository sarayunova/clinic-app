import React, { useState } from 'react';
import { logObstetricAflpFlowsheet } from '../api';

interface ObstetricAflpFlowsheetModalProps {
  episodeId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const ObstetricAflpFlowsheetModal: React.FC<ObstetricAflpFlowsheetModalProps> = ({
  episodeId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromDiagnosis, setHoursFromDiagnosis] = useState(1.0);
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState(76);
  const [dextroseInfusionRateMlHr, setDextroseInfusionRateMlHr] = useState(100);
  const [dextroseConcentrationPercent, setDextroseConcentrationPercent] = useState(10);
  const [sbpMmhg, setSbpMmhg] = useState<number | ''>(124);
  const [dbpMmhg, setDbpMmhg] = useState<number | ''>(78);
  const [hrBpm, setHrBpm] = useState<number | ''>(88);
  const [encephalopathyGrade, setEncephalopathyGrade] = useState(0);
  const [urineOutputMlHr, setUrineOutputMlHr] = useState<number | ''>(45);
  const [plateletCount, setPlateletCount] = useState<number | ''>(95000);
  const [fibrinogenMgDl, setFibrinogenMgDl] = useState<number | ''>(160);
  const [ptSeconds, setPtSeconds] = useState<number | ''>(15.2);
  const [inr, setInr] = useState<number | ''>(1.35);
  const [bloodProductsAdministered, setBloodProductsAdministered] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await logObstetricAflpFlowsheet(episodeId, {
        logDatetime,
        hoursFromDiagnosis,
        bloodGlucoseMgDl,
        dextroseInfusionRateMlHr,
        dextroseConcentrationPercent,
        sbpMmhg: sbpMmhg === '' ? null : Number(sbpMmhg),
        dbpMmhg: dbpMmhg === '' ? null : Number(dbpMmhg),
        hrBpm: hrBpm === '' ? null : Number(hrBpm),
        encephalopathyGrade,
        urineOutputMlHr: urineOutputMlHr === '' ? null : Number(urineOutputMlHr),
        plateletCount: plateletCount === '' ? null : Number(plateletCount),
        fibrinogenMgDl: fibrinogenMgDl === '' ? null : Number(fibrinogenMgDl),
        ptSeconds: ptSeconds === '' ? null : Number(ptSeconds),
        inr: inr === '' ? null : Number(inr),
        bloodProductsAdministered: bloodProductsAdministered || null,
        notes: notes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to record AFLP flowsheet checkpoint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h4>🩸 Bedside AFLP Glycemic & Coagulopathy Flowsheet</h4>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label>Checkpoint Datetime</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={logDatetime}
                  onChange={(e) => setLogDatetime(e.target.value)}
                  required
                />
              </div>

              <div>
                <label>Hours from Diagnosis</label>
                <input
                  type="number"
                  step="0.5"
                  className="form-control"
                  value={hoursFromDiagnosis}
                  onChange={(e) => setHoursFromDiagnosis(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
              <div>
                <label>Blood Glucose (mg/dL)</label>
                <input
                  type="number"
                  className="form-control"
                  value={bloodGlucoseMgDl}
                  onChange={(e) => setBloodGlucoseMgDl(parseInt(e.target.value) || 70)}
                  required
                />
              </div>

              <div>
                <label>Dextrose Rate (mL/hr)</label>
                <input
                  type="number"
                  className="form-control"
                  value={dextroseInfusionRateMlHr}
                  onChange={(e) => setDextroseInfusionRateMlHr(parseInt(e.target.value) || 0)}
                  required
                />
              </div>

              <div>
                <label>Dextrose Concentration</label>
                <select
                  className="form-control"
                  value={dextroseConcentrationPercent}
                  onChange={(e) => setDextroseConcentrationPercent(parseInt(e.target.value) || 10)}
                >
                  <option value={10}>D10W (10%)</option>
                  <option value={20}>D20W (20%)</option>
                  <option value={50}>D50W Bolus</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
              <div>
                <label>SBP (mmHg)</label>
                <input
                  type="number"
                  className="form-control"
                  value={sbpMmhg}
                  onChange={(e) => setSbpMmhg(e.target.value === '' ? '' : parseInt(e.target.value))}
                />
              </div>
              <div>
                <label>DBP (mmHg)</label>
                <input
                  type="number"
                  className="form-control"
                  value={dbpMmhg}
                  onChange={(e) => setDbpMmhg(e.target.value === '' ? '' : parseInt(e.target.value))}
                />
              </div>
              <div>
                <label>HR (bpm)</label>
                <input
                  type="number"
                  className="form-control"
                  value={hrBpm}
                  onChange={(e) => setHrBpm(e.target.value === '' ? '' : parseInt(e.target.value))}
                />
              </div>
              <div>
                <label>Encephalopathy</label>
                <select
                  className="form-control"
                  value={encephalopathyGrade}
                  onChange={(e) => setEncephalopathyGrade(parseInt(e.target.value) || 0)}
                >
                  <option value={0}>Grade 0 (Normal)</option>
                  <option value={1}>Grade 1 (Euphoria/Mild)</option>
                  <option value={2}>Grade 2 (Lethargy/Confusion)</option>
                  <option value={3}>Grade 3 (Somnolence)</option>
                  <option value={4}>Grade 4 (Coma)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
              <div>
                <label>INR</label>
                <input
                  type="number"
                  step="0.05"
                  className="form-control"
                  value={inr}
                  onChange={(e) => setInr(e.target.value === '' ? '' : parseFloat(e.target.value))}
                />
              </div>
              <div>
                <label>Fibrinogen (mg/dL)</label>
                <input
                  type="number"
                  className="form-control"
                  value={fibrinogenMgDl}
                  onChange={(e) => setFibrinogenMgDl(e.target.value === '' ? '' : parseInt(e.target.value))}
                />
              </div>
              <div>
                <label>Platelets (/uL)</label>
                <input
                  type="number"
                  className="form-control"
                  value={plateletCount}
                  onChange={(e) => setPlateletCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                />
              </div>
              <div>
                <label>Urine (mL/hr)</label>
                <input
                  type="number"
                  className="form-control"
                  value={urineOutputMlHr}
                  onChange={(e) => setUrineOutputMlHr(e.target.value === '' ? '' : parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label>Blood Products Given (e.g. 10u Cryoprecipitate, 2u FFP, 1u Platelets)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Cryoprecipitate 10 units infused for fibrinogen < 150 mg/dL"
                value={bloodProductsAdministered}
                onChange={(e) => setBloodProductsAdministered(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label>Bedside Notes</label>
              <input
                type="text"
                className="form-control"
                placeholder="Fetal status, bleeding checks, response to dextrose infusion..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Record Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
