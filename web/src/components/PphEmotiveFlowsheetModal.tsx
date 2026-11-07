import React, { useState } from 'react';
import { logObstetricPphFlowsheet } from '../api';
import { calculateShockIndex } from '../obstetricPphEngine';

interface Props {
  episodeId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const PphEmotiveFlowsheetModal: React.FC<Props> = ({
  episodeId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [minutesFromRecognition, setMinutesFromRecognition] = useState(15);
  const [intervalBloodLossMl, setIntervalBloodLossMl] = useState(150);
  const [sbp, setSbp] = useState(96);
  const [dbp, setDbp] = useState(58);
  const [heartRateBpm, setHeartRateBpm] = useState(105);
  const [uterineTone, setUterineTone] = useState<'firm_contracted' | 'boggy_soft' | 'relaxed'>('boggy_soft');
  const [medicationGiven, setMedicationGiven] = useState('Carboprost 250 mcg IM stat');
  const [bakriDrainageMl, setBakriDrainageMl] = useState(20);
  const [urineOutputMl, setUrineOutputMl] = useState(40);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentSi = calculateShockIndex(heartRateBpm, sbp);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await logObstetricPphFlowsheet(episodeId, {
        logDatetime,
        minutesFromRecognition,
        intervalBloodLossMl,
        sbp,
        dbp,
        heartRateBpm,
        uterineTone,
        medicationGiven,
        bakriDrainageMl,
        urineOutputMl,
        notes,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to record flowsheet log');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bedside PPH & Hemodynamic Flowsheet</h2>
            <p className="text-xs text-gray-500">Record interval blood loss, shock index & uterotonics</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">
            &times;
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Log Datetime</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                className="w-full text-xs border rounded px-2 py-1.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Minutes from Recognition</label>
              <input
                type="number"
                value={minutesFromRecognition}
                onChange={(e) => setMinutesFromRecognition(parseInt(e.target.value) || 0)}
                className="w-full text-xs border rounded px-2 py-1.5"
                required
              />
            </div>
          </div>

          <div className="bg-rose-50/70 p-3 rounded border border-rose-200">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-rose-950 mb-1">Interval Loss (mL)</label>
                <input
                  type="number"
                  step="10"
                  value={intervalBloodLossMl}
                  onChange={(e) => setIntervalBloodLossMl(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs border border-rose-300 rounded px-2 py-1 font-bold text-rose-950"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">BP (mmHg)</label>
                <div className="flex gap-1 items-center">
                  <input
                    type="number"
                    value={sbp}
                    onChange={(e) => setSbp(parseInt(e.target.value) || 0)}
                    className="w-1/2 text-xs border rounded px-1.5 py-1 text-center font-bold"
                    placeholder="SBP"
                  />
                  <span>/</span>
                  <input
                    type="number"
                    value={dbp}
                    onChange={(e) => setDbp(parseInt(e.target.value) || 0)}
                    className="w-1/2 text-xs border rounded px-1.5 py-1 text-center"
                    placeholder="DBP"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">HR (bpm)</label>
                <input
                  type="number"
                  value={heartRateBpm}
                  onChange={(e) => setHeartRateBpm(parseInt(e.target.value) || 0)}
                  className="w-full text-xs border rounded px-2 py-1 font-bold text-red-700"
                  required
                />
              </div>
            </div>
            <div className="mt-2 text-xs font-bold text-rose-950 flex justify-between">
              <span>Calculated Shock Index: {currentSi}</span>
              <span className={currentSi >= 1.0 ? 'text-red-700 font-black' : currentSi >= 0.9 ? 'text-amber-700' : 'text-emerald-700'}>
                {currentSi >= 1.4 ? 'CRITICAL COLLAPSE' : currentSi >= 1.0 ? 'SEVERE SHOCK' : currentSi >= 0.9 ? 'WARNING' : 'NORMAL'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Uterine Tone</label>
              <select
                value={uterineTone}
                onChange={(e) => setUterineTone(e.target.value as any)}
                className="w-full text-xs border rounded px-2 py-1.5 font-medium"
              >
                <option value="firm_contracted">Firm & Well Contracted</option>
                <option value="boggy_soft">Boggy / Soft (Atony)</option>
                <option value="relaxed">Completely Relaxed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Medication Given</label>
              <input
                type="text"
                value={medicationGiven}
                onChange={(e) => setMedicationGiven(e.target.value)}
                placeholder="e.g. TXA 1g IV or Carboprost 250mcg"
                className="w-full text-xs border rounded px-2 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Bakri Drainage (mL)</label>
              <input
                type="number"
                value={bakriDrainageMl}
                onChange={(e) => setBakriDrainageMl(parseFloat(e.target.value) || 0)}
                className="w-full text-xs border rounded px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Urine Output (mL)</label>
              <input
                type="number"
                value={urineOutputMl}
                onChange={(e) => setUrineOutputMl(parseFloat(e.target.value) || 0)}
                className="w-full text-xs border rounded px-2 py-1.5"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nursing Observations</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Uterus contracted after bimanual massage and second uterotonic."
              className="w-full text-xs border rounded px-2 py-1.5"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border rounded text-xs text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Record Flowsheet Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
