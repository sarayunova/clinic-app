import React, { useState } from 'react';
import { addNeonatalChylothoraxFlowsheet } from '../api';

interface NeonatalChylothoraxFlowsheetModalProps {
  episodeId: number;
  patientId: number;
  currentWeightKg: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const NeonatalChylothoraxFlowsheetModal: React.FC<NeonatalChylothoraxFlowsheetModalProps> = ({
  episodeId,
  currentWeightKg,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [daysFromDiagnosis, setDaysFromDiagnosis] = useState(1);
  const [drainage24hMl, setDrainage24hMl] = useState(48);
  const [octreotideDoseMcgKgHr, setOctreotideDoseMcgKgHr] = useState(3.0);
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState<number | ''>(88);
  const [serumSodiumMmolL, setSerumSodiumMmolL] = useState<number | ''>(138);
  const [fluidAppearance, setFluidAppearance] = useState<string>('serosanguinous');
  const [notes, setNotes] = useState('Day 2 of Octreotide 3 µg/kg/hr. Drainage decreased from 72 to 48 mL/day. Blood sugar stable.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drainageRate = currentWeightKg > 0 ? (drainage24hMl / currentWeightKg).toFixed(1) : '0';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await addNeonatalChylothoraxFlowsheet(episodeId, {
        logDatetime,
        daysFromDiagnosis: Number(daysFromDiagnosis),
        drainage24hMl: Number(drainage24hMl),
        octreotideDoseMcgKgHr: Number(octreotideDoseMcgKgHr),
        bloodGlucoseMgDl: bloodGlucoseMgDl === '' ? null : Number(bloodGlucoseMgDl),
        serumSodiumMmolL: serumSodiumMmolL === '' ? null : Number(serumSodiumMmolL),
        fluidAppearance,
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
            <h2 className="text-lg font-bold text-gray-800">Log Chylothorax Checkpoint</h2>
            <p className="text-xs text-gray-500">Episode #{episodeId} • Current Rate: {drainageRate} mL/kg/day</p>
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
              <label className="block text-xs font-medium text-gray-700">Log Timestamp</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Days from Diagnosis</label>
              <input
                type="number"
                value={daysFromDiagnosis}
                onChange={(e) => setDaysFromDiagnosis(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">24h Drainage (mL)</label>
              <input
                type="number"
                value={drainage24hMl}
                onChange={(e) => setDrainage24hMl(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Octreotide (µg/kg/hr)</label>
              <input
                type="number"
                step="0.1"
                value={octreotideDoseMcgKgHr}
                onChange={(e) => setOctreotideDoseMcgKgHr(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700">Blood Glucose</label>
              <input
                type="number"
                value={bloodGlucoseMgDl}
                onChange={(e) => setBloodGlucoseMgDl(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="mg/dL"
                className="mt-1 w-full border rounded-lg px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Serum Na+</label>
              <input
                type="number"
                value={serumSodiumMmolL}
                onChange={(e) => setSerumSodiumMmolL(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="mmol/L"
                className="mt-1 w-full border rounded-lg px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Fluid Appearance</label>
              <select
                value={fluidAppearance}
                onChange={(e) => setFluidAppearance(e.target.value)}
                className="mt-1 w-full border rounded-lg px-2 py-1.5 text-xs"
              >
                <option value="milky_chylous">Milky Chylous</option>
                <option value="serosanguinous">Serosanguinous</option>
                <option value="straw_colored_serous">Straw Serous</option>
                <option value="clear">Clear</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Progress Notes</label>
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
