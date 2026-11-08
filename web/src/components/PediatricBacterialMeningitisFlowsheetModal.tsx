import React, { useState } from 'react';
import { addPediatricMeningitisFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricBacterialMeningitisFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [gcsScore, setGcsScore] = useState<number>(15);
  const [pupilReactivity, setPupilReactivity] = useState<'brisk_bilateral' | 'sluggish' | 'unequal_fixed'>('brisk_bilateral');
  const [heartRate, setHeartRate] = useState<number>(115);
  const [bloodPressureSys, setBloodPressureSys] = useState<number>(102);
  const [bloodPressureDia, setBloodPressureDia] = useState<number>(64);
  const [temperatureCelsius, setTemperatureCelsius] = useState<number>(38.4);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(24);
  const [seizureActivityObserved, setSeizureActivityObserved] = useState<boolean>(false);
  const [neurologicalNotes, setNeurologicalNotes] = useState<string>('Alert, irritable on neck flexion, no focal deficits');
  const [antibioticDoseAdministered, setAntibioticDoseAdministered] = useState<string>('IV Ceftriaxone 625mg Dose 1');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await addPediatricMeningitisFlowsheet(episodeId, {
        logDatetime,
        gcsScore,
        pupilReactivity,
        heartRate,
        bloodPressureSys,
        bloodPressureDia,
        temperatureCelsius,
        respiratoryRate,
        seizureActivityObserved,
        neurologicalNotes: neurologicalNotes || null,
        antibioticDoseAdministered: antibioticDoseAdministered || null,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 text-xs">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="text-lg font-bold text-gray-800">Log Meningitis Neurological Checkpoint</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">&times;</button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded mt-3 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 mt-4">
          <div>
            <label className="block font-medium text-gray-700">Observation Timestamp</label>
            <input
              type="datetime-local"
              value={logDatetime}
              onChange={(e) => setLogDatetime(e.target.value)}
              className="w-full border rounded p-1.5"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-gray-700">GCS Score (3-15)</label>
              <input
                type="number"
                min="3"
                max="15"
                value={gcsScore}
                onChange={(e) => setGcsScore(parseInt(e.target.value, 10) || 15)}
                className="w-full border rounded p-1.5 font-bold"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-gray-700">Pupillary Reactivity</label>
              <select
                value={pupilReactivity}
                onChange={(e) => setPupilReactivity(e.target.value as any)}
                className="w-full border rounded p-1.5"
              >
                <option value="brisk_bilateral">Brisk Bilateral</option>
                <option value="sluggish">Sluggish</option>
                <option value="unequal_fixed">Unequal / Fixed (Raised ICP Alert)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block font-medium text-gray-700">HR (bpm)</label>
              <input
                type="number"
                value={heartRate}
                onChange={(e) => setHeartRate(parseInt(e.target.value, 10) || 100)}
                className="w-full border rounded p-1.5"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">SBP</label>
              <input
                type="number"
                value={bloodPressureSys}
                onChange={(e) => setBloodPressureSys(parseInt(e.target.value, 10) || 100)}
                className="w-full border rounded p-1.5"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">DBP</label>
              <input
                type="number"
                value={bloodPressureDia}
                onChange={(e) => setBloodPressureDia(parseInt(e.target.value, 10) || 60)}
                className="w-full border rounded p-1.5"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                value={temperatureCelsius}
                onChange={(e) => setTemperatureCelsius(parseFloat(e.target.value) || 37.0)}
                className="w-full border rounded p-1.5 font-bold text-red-700"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-gray-700">Respiratory Rate (bpm)</label>
              <input
                type="number"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(parseInt(e.target.value, 10) || 20)}
                className="w-full border rounded p-1.5"
                required
              />
            </div>

            <div className="flex items-center space-x-2 pt-4">
              <input
                type="checkbox"
                id="seizure"
                checked={seizureActivityObserved}
                onChange={(e) => setSeizureActivityObserved(e.target.checked)}
              />
              <label htmlFor="seizure" className="font-semibold text-rose-800">
                Seizure Activity Observed
              </label>
            </div>
          </div>

          <div>
            <label className="block font-medium text-gray-700">Neurological / Meningeal Notes</label>
            <input
              type="text"
              value={neurologicalNotes}
              onChange={(e) => setNeurologicalNotes(e.target.value)}
              className="w-full border rounded p-1.5"
            />
          </div>

          <div>
            <label className="block font-medium text-gray-700">Antibiotic Dose Administered</label>
            <input
              type="text"
              value={antibioticDoseAdministered}
              onChange={(e) => setAntibioticDoseAdministered(e.target.value)}
              className="w-full border rounded p-1.5"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border rounded text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 bg-amber-600 text-white font-bold rounded hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
