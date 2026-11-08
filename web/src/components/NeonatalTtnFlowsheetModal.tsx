import React, { useState } from 'react';
import { addNeonatalTtnFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalTtnFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [respiratoryRate, setRespiratoryRate] = useState<number>(72);
  const [heartRate, setHeartRate] = useState<number>(142);
  const [spo2Percent, setSpo2Percent] = useState<number>(94);
  const [fio2Percent, setFio2Percent] = useState<number>(25);
  const [cpapPeepCmh2o, setCpapPeepCmh2o] = useState<number | undefined>(5.0);
  const [silvermanAndersonScore, setSilvermanAndersonScore] = useState<number>(2);
  const [gruntingPresent, setGruntingPresent] = useState<boolean>(false);
  const [feedingRoute, setFeedingRoute] = useState<'npo_iv' | 'gavage_tube' | 'oral_breast' | 'oral_bottle'>('gavage_tube');
  const [bloodGasPh, setBloodGasPh] = useState<number | undefined>(7.36);
  const [bloodGasPco2, setBloodGasPco2] = useState<number | undefined>(44);
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await addNeonatalTtnFlowsheet(episodeId, {
        logDatetime,
        respiratoryRate,
        heartRate,
        spo2Percent,
        fio2Percent,
        cpapPeepCmh2o: cpapPeepCmh2o ?? null,
        silvermanAndersonScore,
        gruntingPresent,
        feedingRoute,
        bloodGasPh: bloodGasPh ?? null,
        bloodGasPco2: bloodGasPco2 ?? null,
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
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="text-lg font-bold text-gray-800">Log TTN Flowsheet Observation</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">&times;</button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded mt-3 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 mt-4 text-xs">
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
              <label className="block font-medium text-gray-700">Respiratory Rate (bpm)</label>
              <input
                type="number"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(parseInt(e.target.value, 10) || 60)}
                className="w-full border rounded p-1.5"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">Heart Rate (bpm)</label>
              <input
                type="number"
                value={heartRate}
                onChange={(e) => setHeartRate(parseInt(e.target.value, 10) || 140)}
                className="w-full border rounded p-1.5"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-gray-700">SpO2 (%)</label>
              <input
                type="number"
                value={spo2Percent}
                onChange={(e) => setSpo2Percent(parseFloat(e.target.value) || 95)}
                className="w-full border rounded p-1.5"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">FiO2 (%)</label>
              <input
                type="number"
                value={fio2Percent}
                onChange={(e) => setFio2Percent(parseFloat(e.target.value) || 21)}
                className="w-full border rounded p-1.5"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">CPAP (cmH2O)</label>
              <input
                type="number"
                step="0.5"
                value={cpapPeepCmh2o ?? ''}
                onChange={(e) => setCpapPeepCmh2o(e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="5.0"
                className="w-full border rounded p-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-gray-700">Silverman Score (0-10)</label>
              <input
                type="number"
                min="0"
                max="10"
                value={silvermanAndersonScore}
                onChange={(e) => setSilvermanAndersonScore(parseInt(e.target.value, 10) || 0)}
                className="w-full border rounded p-1.5"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">Feeding Route</label>
              <select
                value={feedingRoute}
                onChange={(e) => setFeedingRoute(e.target.value as any)}
                className="w-full border rounded p-1.5"
              >
                <option value="npo_iv">NPO (IV Fluid)</option>
                <option value="gavage_tube">OG/NG Gavage Tube</option>
                <option value="oral_breast">Direct Breastfeeding</option>
                <option value="oral_bottle">Bottle Feed</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="grunting"
              checked={gruntingPresent}
              onChange={(e) => setGruntingPresent(e.target.checked)}
            />
            <label htmlFor="grunting" className="font-medium text-gray-700">
              Audible Expiratory Grunting Present
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-gray-700">Blood Gas pH (optional)</label>
              <input
                type="number"
                step="0.01"
                value={bloodGasPh ?? ''}
                onChange={(e) => setBloodGasPh(e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="7.35"
                className="w-full border rounded p-1.5"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">pCO2 (mmHg, optional)</label>
              <input
                type="number"
                step="1"
                value={bloodGasPco2 ?? ''}
                onChange={(e) => setBloodGasPco2(e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="45"
                className="w-full border rounded p-1.5"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-gray-700">Clinical Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Weaning CPAP from 6 to 5 cmH2O, good aeration..."
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
              className="px-3 py-1.5 bg-sky-600 text-white font-bold rounded hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
