import React, { useState } from 'react';
import { addPediatricDkaCerebralEdemaFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricDkaCerebralEdemaFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromDetection, setHoursFromDetection] = useState<number>(1.0);
  const [gcsScore, setGcsScore] = useState<number>(13);
  const [pupilSizeAndReactivity, setPupilSizeAndReactivity] = useState<string>('3mm equal, briskly reactive');
  const [heartRate, setHeartRate] = useState<number>(115);
  const [bloodPressureSys, setBloodPressureSys] = useState<number>(108);
  const [bloodPressureDia, setBloodPressureDia] = useState<number>(68);
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState<number>(480);
  const [serumSodiumMeasuredMeqL, setSerumSodiumMeasuredMeqL] = useState<number>(134);
  const [hyperosmolarAgentGiven, setHyperosmolarAgentGiven] = useState<string>('3% NaCl 130 mL IV infused');
  const [ivFluidRateMlHr, setIvFluidRateMlHr] = useState<number>(75);
  const [neurologicalExamNotes, setNeurologicalExamNotes] = useState<string>('Sensorium improving, oriented to parent, headache subsided');
  const [notes, setNotes] = useState<string>('Targeting glucose drop < 75 mg/dL/hr, measured sodium rising');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addPediatricDkaCerebralEdemaFlowsheet(episodeId, {
        logDatetime,
        hoursFromDetection,
        gcsScore,
        pupilSizeAndReactivity,
        heartRate,
        bloodPressureSys,
        bloodPressureDia,
        bloodGlucoseMgDl,
        serumSodiumMeasuredMeqL,
        hyperosmolarAgentGiven: hyperosmolarAgentGiven || null,
        ivFluidRateMlHr,
        neurologicalExamNotes: neurologicalExamNotes || null,
        notes: notes || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="p-1.5 bg-rose-100 text-rose-700 rounded-lg text-base">⏱️</span>
              Log PICU Neurological & Osmolar Checkpoint
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Serial GCS, Corrected Sodium Trajectory & Hyperosmolar Infusion Log
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-semibold leading-none">
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-gray-700 font-medium mb-1">Log Datetime</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">Hours from Detection</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={hoursFromDetection}
                onChange={(e) => setHoursFromDetection(parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">GCS Score (3–15)</label>
              <input
                type="number"
                min="3"
                max="15"
                value={gcsScore}
                onChange={(e) => setGcsScore(parseInt(e.target.value) || 15)}
                className="w-full border rounded px-3 py-1.5 text-sm font-bold text-rose-700"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-gray-700 font-medium mb-1">Pupils Size & Reaction</label>
              <input
                type="text"
                value={pupilSizeAndReactivity}
                onChange={(e) => setPupilSizeAndReactivity(e.target.value)}
                placeholder="e.g. 3mm equal, brisk"
                className="w-full border rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">Heart Rate (bpm)</label>
              <input
                type="number"
                min="30"
                max="250"
                value={heartRate}
                onChange={(e) => setHeartRate(parseInt(e.target.value) || 100)}
                className="w-full border rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">BP (Sys / Dia)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Sys"
                  value={bloodPressureSys}
                  onChange={(e) => setBloodPressureSys(parseInt(e.target.value) || 100)}
                  className="w-1/2 border rounded px-2 py-1.5 text-sm"
                  required
                />
                <input
                  type="number"
                  placeholder="Dia"
                  value={bloodPressureDia}
                  onChange={(e) => setBloodPressureDia(parseInt(e.target.value) || 60)}
                  className="w-1/2 border rounded px-2 py-1.5 text-sm"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-gray-700 font-medium mb-1">Blood Glucose (mg/dL)</label>
              <input
                type="number"
                min="30"
                max="2000"
                value={bloodGlucoseMgDl}
                onChange={(e) => setBloodGlucoseMgDl(parseFloat(e.target.value) || 400)}
                className="w-full border rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">Measured Na+ (mEq/L)</label>
              <input
                type="number"
                step="0.5"
                min="100"
                max="180"
                value={serumSodiumMeasuredMeqL}
                onChange={(e) => setSerumSodiumMeasuredMeqL(parseFloat(e.target.value) || 135)}
                className="w-full border rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">IV Fluid Rate (mL/hr)</label>
              <input
                type="number"
                min="0"
                max="800"
                value={ivFluidRateMlHr}
                onChange={(e) => setIvFluidRateMlHr(parseFloat(e.target.value) || 80)}
                className="w-full border rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
          </div>

          <div className="text-sm">
            <label className="block text-gray-700 font-medium mb-1">Hyperosmolar Agent Administered</label>
            <input
              type="text"
              value={hyperosmolarAgentGiven}
              onChange={(e) => setHyperosmolarAgentGiven(e.target.value)}
              placeholder="e.g. 3% Hypertonic Saline 130 mL IV or 20% Mannitol"
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>

          <div className="text-sm">
            <label className="block text-gray-700 font-medium mb-1">Neurological Exam Notes</label>
            <input
              type="text"
              value={neurologicalExamNotes}
              onChange={(e) => setNeurologicalExamNotes(e.target.value)}
              placeholder="e.g. Cranial nerves intact, obeying commands, prompt pupillary response..."
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>

          <div className="text-sm">
            <label className="block text-gray-700 font-medium mb-1">Nursing & PICU Comments</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Head of bed 30°, continuous arterial line monitoring..."
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold shadow disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Record Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
