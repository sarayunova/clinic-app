import React, { useState } from 'react';
import { addObstetricCordProlapseFlowsheet } from '../api';

interface ObstetricCordProlapseFlowsheetModalProps {
  episodeId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const ObstetricCordProlapseFlowsheetModal: React.FC<ObstetricCordProlapseFlowsheetModalProps> = ({
  episodeId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [minutesFromDetection, setMinutesFromDetection] = useState(5);
  const [fetalHeartRateBpm, setFetalHeartRateBpm] = useState(115);
  const [cordPulsationPalpable, setCordPulsationPalpable] = useState(true);
  const [manualElevationMaintained, setManualElevationMaintained] = useState(true);
  const [maternalBloodPressureSys, setMaternalBloodPressureSys] = useState(118);
  const [maternalBloodPressureDia, setMaternalBloodPressureDia] = useState(72);
  const [notes, setNotes] = useState('En route to OR in knee-chest position. Continuous manual elevation of head maintained. FHR recovering to 115 bpm with palpable cord pulsation.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await addObstetricCordProlapseFlowsheet(episodeId, {
        logDatetime,
        minutesFromDetection: Number(minutesFromDetection),
        fetalHeartRateBpm: Number(fetalHeartRateBpm),
        cordPulsationPalpable,
        manualElevationMaintained,
        maternalBloodPressureSys: Number(maternalBloodPressureSys),
        maternalBloodPressureDia: Number(maternalBloodPressureDia),
        notes: notes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to record flowsheet log');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Decompression Progress Checkpoint</h2>
            <p className="text-xs text-gray-500">Episode #{episodeId} • Minute-by-Minute Monitoring</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">
            &times;
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Timestamp</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Minutes from Detection</label>
              <input
                type="number"
                value={minutesFromDetection}
                onChange={(e) => setMinutesFromDetection(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700">FHR (bpm)</label>
              <input
                type="number"
                value={fetalHeartRateBpm}
                onChange={(e) => setFetalHeartRateBpm(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-2 py-1.5 text-xs font-bold text-red-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Maternal SBP</label>
              <input
                type="number"
                value={maternalBloodPressureSys}
                onChange={(e) => setMaternalBloodPressureSys(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-2 py-1.5 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Maternal DBP</label>
              <input
                type="number"
                value={maternalBloodPressureDia}
                onChange={(e) => setMaternalBloodPressureDia(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-2 py-1.5 text-xs"
                required
              />
            </div>
          </div>

          <div className="flex gap-4 pt-1">
            <label className="flex items-center text-xs font-medium text-gray-700">
              <input
                type="checkbox"
                checked={manualElevationMaintained}
                onChange={(e) => setManualElevationMaintained(e.target.checked)}
                className="mr-2 h-4 w-4 text-red-600 rounded"
              />
              Manual Elevation Active
            </label>
            <label className="flex items-center text-xs font-medium text-gray-700">
              <input
                type="checkbox"
                checked={cordPulsationPalpable}
                onChange={(e) => setCordPulsationPalpable(e.target.checked)}
                className="mr-2 h-4 w-4 text-emerald-600 rounded"
              />
              Cord Pulsation Palpable
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Decompression Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-xs"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 shadow disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Record Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
