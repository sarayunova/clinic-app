import React, { useState } from 'react';
import { addObstetricPdphFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricPdphFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [postureAssessed, setPostureAssessed] = useState<'supine' | 'sitting_upright' | 'standing_ambulating'>('sitting_upright');
  const [vasPainScore, setVasPainScore] = useState<number>(6);
  const [headacheReliefOnLying, setHeadacheReliefOnLying] = useState<boolean>(true);
  const [bloodPressureSys, setBloodPressureSys] = useState<number | undefined>(118);
  const [bloodPressureDia, setBloodPressureDia] = useState<number | undefined>(74);
  const [heartRate, setHeartRate] = useState<number | undefined>(78);
  const [temperatureCelsius, setTemperatureCelsius] = useState<number | undefined>(36.8);
  const [neurologicalSymptomsPresent, setNeurologicalSymptomsPresent] = useState<boolean>(false);
  const [interventionsGiven, setInterventionsGiven] = useState<string>('Paracetamol 1000mg + IV Normal Saline 500mL bolus');
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await addObstetricPdphFlowsheet(episodeId, {
        logDatetime,
        postureAssessed,
        vasPainScore,
        headacheReliefOnLying,
        bloodPressureSys: bloodPressureSys ?? null,
        bloodPressureDia: bloodPressureDia ?? null,
        heartRate: heartRate ?? null,
        temperatureCelsius: temperatureCelsius ?? null,
        neurologicalSymptomsPresent,
        interventionsGiven: interventionsGiven || null,
        notes: notes || null,
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
          <h3 className="text-lg font-bold text-gray-800">Log PDPH Flowsheet Observation</h3>
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
              <label className="block font-medium text-gray-700">Posture Assessed</label>
              <select
                value={postureAssessed}
                onChange={(e) => setPostureAssessed(e.target.value as any)}
                className="w-full border rounded p-1.5"
              >
                <option value="supine">Supine (Flat Bedrest)</option>
                <option value="sitting_upright">Sitting Upright</option>
                <option value="standing_ambulating">Standing / Ambulating</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-gray-700">VAS Pain Score (0-10)</label>
              <input
                type="number"
                min="0"
                max="10"
                value={vasPainScore}
                onChange={(e) => setVasPainScore(parseInt(e.target.value, 10) || 0)}
                className="w-full border rounded p-1.5 font-bold text-rose-900"
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="relief"
              checked={headacheReliefOnLying}
              onChange={(e) => setHeadacheReliefOnLying(e.target.checked)}
            />
            <label htmlFor="relief" className="font-semibold text-gray-800">
              Immediate Relief Noted Upon Lying Supine
            </label>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block font-medium text-gray-700">SBP</label>
              <input
                type="number"
                value={bloodPressureSys ?? ''}
                onChange={(e) => setBloodPressureSys(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                placeholder="120"
                className="w-full border rounded p-1.5"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">DBP</label>
              <input
                type="number"
                value={bloodPressureDia ?? ''}
                onChange={(e) => setBloodPressureDia(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                placeholder="80"
                className="w-full border rounded p-1.5"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">HR</label>
              <input
                type="number"
                value={heartRate ?? ''}
                onChange={(e) => setHeartRate(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                placeholder="75"
                className="w-full border rounded p-1.5"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                value={temperatureCelsius ?? ''}
                onChange={(e) => setTemperatureCelsius(e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="37.0"
                className="w-full border rounded p-1.5"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="neuro"
              checked={neurologicalSymptomsPresent}
              onChange={(e) => setNeurologicalSymptomsPresent(e.target.checked)}
            />
            <label htmlFor="neuro" className="font-semibold text-rose-800">
              New Neurological Findings (Diplopia, Photophobia, Tinnitus, Weakness)
            </label>
          </div>

          <div>
            <label className="block font-medium text-gray-700">Interventions Administered</label>
            <input
              type="text"
              value={interventionsGiven}
              onChange={(e) => setInterventionsGiven(e.target.value)}
              className="w-full border rounded p-1.5"
              placeholder="Analgesics, hydration bolus, caffeine..."
            />
          </div>

          <div>
            <label className="block font-medium text-gray-700">Bedside Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tolerating upright position for 10 minutes..."
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
              className="px-3 py-1.5 bg-rose-600 text-white font-bold rounded hover:bg-rose-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
