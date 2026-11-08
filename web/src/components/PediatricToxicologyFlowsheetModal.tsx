import React, { useState } from 'react';
import { addPediatricToxicologyFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PediatricToxicologyFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen = true,
  onClose,
  onSuccess,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [hoursFromIngestion, setHoursFromIngestion] = useState<number>(6.0);
  const [heartRateBpm, setHeartRateBpm] = useState<number>(104);
  const [systolicBpMmhg, setSystolicBpMmhg] = useState<number>(100);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(22);
  const [spo2Percent, setSpo2Percent] = useState<number>(98.0);
  const [altUL, setAltUL] = useState<number>(32.0);
  const [astUL, setAstUL] = useState<number>(36.0);
  const [toxinSerumLevel, setToxinSerumLevel] = useState<number>(95.0);
  const [vinRoseUrineObserved, setVinRoseUrineObserved] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await addPediatricToxicologyFlowsheet(episodeId, {
        logDatetime,
        hoursFromIngestion,
        heartRateBpm,
        systolicBpMmhg,
        respiratoryRate,
        spo2Percent,
        altUL,
        astUL,
        toxinSerumLevel,
        vinRoseUrineObserved,
        notes: notes || null,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record toxicology flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 bg-amber-700 text-white flex justify-between items-center">
          <h2 className="text-lg font-bold">Add Toxicology & LFT Flowsheet Entry</h2>
          <button onClick={onClose} className="text-white hover:text-amber-200 text-2xl font-bold">&times;</button>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Hours Post-Ingestion *</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="168"
                value={hoursFromIngestion}
                onChange={(e) => setHoursFromIngestion(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
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
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Systolic BP (mmHg)</label>
              <input
                type="number"
                min="30"
                max="250"
                value={systolicBpMmhg}
                onChange={(e) => setSystolicBpMmhg(parseInt(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Resp Rate (bpm)</label>
              <input
                type="number"
                min="5"
                max="100"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(parseInt(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Serum ALT (U/L)</label>
              <input
                type="number"
                min="5"
                max="10000"
                value={altUL}
                onChange={(e) => setAltUL(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs font-bold text-amber-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Serum AST (U/L)</label>
              <input
                type="number"
                min="5"
                max="10000"
                value={astUL}
                onChange={(e) => setAstUL(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Serum Toxin Level</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="5000"
                value={toxinSerumLevel}
                onChange={(e) => setToxinSerumLevel(parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-3 py-1.5 text-xs font-bold"
              />
            </div>
          </div>

          <div className="flex items-center pt-2">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-800">
              <input
                type="checkbox"
                checked={vinRoseUrineObserved}
                onChange={(e) => setVinRoseUrineObserved(e.target.checked)}
              />
              <span className="text-amber-800 font-bold">Vin-Rosé Urine Color (Deferoxamine Ferrioxamine Complex)</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Clinical Observations & Antidote Tolerance</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="NAC infusion tolerated without flushing or urticaria; liver enzymes stable..."
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
              className="px-4 py-1.5 bg-amber-700 text-white rounded text-xs font-medium hover:bg-amber-800 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
