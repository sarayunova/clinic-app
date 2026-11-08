import React, { useState } from 'react';
import { addObstetricMassivePeFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ObstetricMassivePeFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen = true,
  onClose,
  onSuccess,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [hoursFromPresentation, setHoursFromPresentation] = useState<number>(2.0);
  const [systolicBpMmhg, setSystolicBpMmhg] = useState<number>(94);
  const [diastolicBpMmhg, setDiastolicBpMmhg] = useState<number>(58);
  const [heartRateBpm, setHeartRateBpm] = useState<number>(118);
  const [spo2Percent, setSpo2Percent] = useState<number>(93.0);
  const [apttSeconds, setApttSeconds] = useState<number>(68.0);
  const [heparinInfusionRateUnitsHr, setHeparinInfusionRateUnitsHr] = useState<number>(1100.0);
  const [vasopressorNorepinephrineMcgMin, setVasopressorNorepinephrineMcgMin] = useState<number>(4.0);
  const [bleedingComplicationObserved, setBleedingComplicationObserved] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await addObstetricMassivePeFlowsheet(episodeId, {
        logDatetime,
        hoursFromPresentation,
        systolicBpMmhg,
        diastolicBpMmhg,
        heartRateBpm,
        spo2Percent,
        apttSeconds,
        heparinInfusionRateUnitsHr,
        vasopressorNorepinephrineMcgMin,
        bleedingComplicationObserved,
        notes: notes || null,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record PE flowsheet checkpoint');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 bg-rose-700 text-white flex justify-between items-center">
          <h2 className="text-lg font-bold">Add PE Hemodynamic & aPTT Flowsheet Entry</h2>
          <button onClick={onClose} className="text-white hover:text-rose-200 text-2xl font-bold">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Log Datetime *</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hours Post-Presentation *</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="720"
                value={hoursFromPresentation}
                onChange={(e) => setHoursFromPresentation(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Systolic BP</label>
              <input
                type="number"
                min="30"
                max="250"
                value={systolicBpMmhg}
                onChange={(e) => setSystolicBpMmhg(parseInt(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs font-bold text-rose-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Diastolic BP</label>
              <input
                type="number"
                min="20"
                max="150"
                value={diastolicBpMmhg}
                onChange={(e) => setDiastolicBpMmhg(parseInt(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Heart Rate (bpm)</label>
              <input
                type="number"
                min="30"
                max="250"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(parseInt(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">SpO2 (%)</label>
              <input
                type="number"
                step="0.5"
                min="40"
                max="100"
                value={spo2Percent}
                onChange={(e) => setSpo2Percent(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">aPTT (seconds)</label>
              <input
                type="number"
                step="0.5"
                min="20"
                max="200"
                value={apttSeconds}
                onChange={(e) => setApttSeconds(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs font-bold text-teal-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Heparin (U/hr)</label>
              <input
                type="number"
                step="50"
                min="0"
                max="3000"
                value={heparinInfusionRateUnitsHr}
                onChange={(e) => setHeparinInfusionRateUnitsHr(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Norepinephrine (mcg/min)</label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={vasopressorNorepinephrineMcgMin}
                onChange={(e) => setVasopressorNorepinephrineMcgMin(parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={bleedingComplicationObserved}
                  onChange={(e) => setBleedingComplicationObserved(e.target.checked)}
                />
                <span className="text-red-700 font-bold">Active Bleeding Complication</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Clinical Observations & Anticoagulation Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="MAP stabilized > 65 mmHg, no uterine bleeding or puncture site hematoma..."
              className="w-full border rounded px-3 py-1.5 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 border rounded text-xs text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 bg-rose-700 text-white rounded text-xs font-medium hover:bg-rose-800 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
