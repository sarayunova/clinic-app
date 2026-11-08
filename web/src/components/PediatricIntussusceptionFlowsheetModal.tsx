import React, { useState } from 'react';
import { addPediatricIntussusceptionFlowsheet } from '../api';

interface PediatricIntussusceptionFlowsheetModalProps {
  episodeId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const PediatricIntussusceptionFlowsheetModal: React.FC<PediatricIntussusceptionFlowsheetModalProps> = ({
  episodeId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [minutesFromProcedure, setMinutesFromProcedure] = useState(60);
  const [heartRateBpm, setHeartRateBpm] = useState(110);
  const [bloodPressureSys, setBloodPressureSys] = useState(96);
  const [bloodPressureDia, setBloodPressureDia] = useState(58);
  const [abdominalSoftNonTender, setAbdominalSoftNonTender] = useState(true);
  const [colickyPainRecurrence, setColickyPainRecurrence] = useState(false);
  const [oralIntakeTolerated, setOralIntakeTolerated] = useState(false);
  const [notes, setNotes] = useState('1h post-air reduction: Abdomen soft, non-distended. Infant sleeping comfortably, no colicky cry or vomiting.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await addPediatricIntussusceptionFlowsheet(episodeId, {
        logDatetime,
        minutesFromProcedure: Number(minutesFromProcedure),
        heartRateBpm: Number(heartRateBpm),
        bloodPressureSys: Number(bloodPressureSys),
        bloodPressureDia: Number(bloodPressureDia),
        abdominalSoftNonTender,
        colickyPainRecurrence,
        oralIntakeTolerated,
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
            <h2 className="text-lg font-bold text-gray-800">Post-Reduction Surveillance Checkpoint</h2>
            <p className="text-xs text-gray-500">Episode #{episodeId} • Monitor for Recurrence & Perforation</p>
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
              <label className="block text-xs font-medium text-gray-700">Minutes from Procedure</label>
              <input
                type="number"
                value={minutesFromProcedure}
                onChange={(e) => setMinutesFromProcedure(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700">Heart Rate (bpm)</label>
              <input
                type="number"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-2 py-1.5 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Systolic BP</label>
              <input
                type="number"
                value={bloodPressureSys}
                onChange={(e) => setBloodPressureSys(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-2 py-1.5 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Diastolic BP</label>
              <input
                type="number"
                value={bloodPressureDia}
                onChange={(e) => setBloodPressureDia(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-2 py-1.5 text-xs"
                required
              />
            </div>
          </div>

          <div className="flex gap-4 pt-1">
            <label className="flex items-center text-xs font-medium text-gray-700">
              <input
                type="checkbox"
                checked={abdominalSoftNonTender}
                onChange={(e) => setAbdominalSoftNonTender(e.target.checked)}
                className="mr-2 h-4 w-4 text-emerald-600 rounded"
              />
              Abdomen Soft & Non-Tender
            </label>
            <label className="flex items-center text-xs font-medium text-gray-700">
              <input
                type="checkbox"
                checked={colickyPainRecurrence}
                onChange={(e) => setColickyPainRecurrence(e.target.checked)}
                className="mr-2 h-4 w-4 text-rose-600 rounded"
              />
              Colicky Pain Recurred
            </label>
          </div>

          <div>
            <label className="flex items-center text-xs font-medium text-gray-700">
              <input
                type="checkbox"
                checked={oralIntakeTolerated}
                onChange={(e) => setOralIntakeTolerated(e.target.checked)}
                className="mr-2 h-4 w-4 text-indigo-600 rounded"
              />
              Clear Liquids / Oral Feeding Tolerated
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Clinical Notes</label>
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
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Add Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
