import React, { useState } from 'react';
import { logNeonatalGirFlowsheet } from '../api';
import { calculateGir } from '../neonatalHypoglycemiaEngine';

interface Props {
  episodeId: number;
  weightKg: number;
  currentDextrosePercent: number;
  currentRateMlHr: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const NeonatalGirFlowsheetModal: React.FC<Props> = ({
  episodeId,
  weightKg,
  currentDextrosePercent,
  currentRateMlHr,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursOnProtocol, setHoursOnProtocol] = useState(1.0);
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState(48);
  const [fluidDextrosePercent, setFluidDextrosePercent] = useState(currentDextrosePercent || 10.0);
  const [fluidRateMlHr, setFluidRateMlHr] = useState(currentRateMlHr || 10.0);
  const [d10wBolusMl, setD10wBolusMl] = useState(0);
  const [feedingVolumeMl, setFeedingVolumeMl] = useState(15);
  const [feedingType, setFeedingType] = useState<'breast_milk' | 'formula' | 'tpn_npo'>('breast_milk');
  const [aeegPattern, setAeegPattern] = useState<'continuous_normal_voltage' | 'discontinuous_normal_voltage' | 'continuous_low_voltage' | 'burst_suppression' | 'flat_trace'>('continuous_normal_voltage');
  const [seizureEventsCount, setSeizureEventsCount] = useState(0);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculatedGir = calculateGir({
    dextrosePercent: fluidDextrosePercent,
    rateMlHr: fluidRateMlHr,
    weightKg: weightKg > 0 ? weightKg : 3.0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await logNeonatalGirFlowsheet(episodeId, {
        logDatetime,
        hoursOnProtocol,
        bloodGlucoseMgDl,
        fluidDextrosePercent,
        fluidRateMlHr,
        d10wBolusMl,
        feedingVolumeMl,
        feedingType,
        aeegPattern,
        seizureEventsCount,
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
            <h2 className="text-lg font-bold text-gray-900">Bedside Glucose & GIR Flowsheet</h2>
            <p className="text-xs text-gray-500">Log serial blood sugar, IV infusion & feeding</p>
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">Hours on Protocol</label>
              <input
                type="number"
                step="0.5"
                value={hoursOnProtocol}
                onChange={(e) => setHoursOnProtocol(parseFloat(e.target.value) || 0)}
                className="w-full text-xs border rounded px-2 py-1.5"
                required
              />
            </div>
          </div>

          <div className="bg-blue-50/70 p-3 rounded border border-blue-200">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-blue-900 mb-1">Blood Sugar (mg/dL)</label>
                <input
                  type="number"
                  step="1"
                  value={bloodGlucoseMgDl}
                  onChange={(e) => setBloodGlucoseMgDl(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs border border-blue-300 rounded px-2 py-1 font-bold text-blue-900"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Dextrose %</label>
                <input
                  type="number"
                  step="0.5"
                  value={fluidDextrosePercent}
                  onChange={(e) => setFluidDextrosePercent(parseFloat(e.target.value) || 10)}
                  className="w-full text-xs border rounded px-2 py-1"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Rate (mL/hr)</label>
                <input
                  type="number"
                  step="0.1"
                  value={fluidRateMlHr}
                  onChange={(e) => setFluidRateMlHr(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs border rounded px-2 py-1"
                />
              </div>
            </div>
            <div className="mt-2 text-xs font-bold text-blue-900 flex justify-between">
              <span>Calculated GIR: {calculatedGir} mg/kg/min</span>
              <span>Weight: {weightKg} kg</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">D10W Bolus (mL)</label>
              <input
                type="number"
                step="0.1"
                value={d10wBolusMl}
                onChange={(e) => setD10wBolusMl(parseFloat(e.target.value) || 0)}
                className="w-full text-xs border rounded px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Feed Vol (mL)</label>
              <input
                type="number"
                step="1"
                value={feedingVolumeMl}
                onChange={(e) => setFeedingVolumeMl(parseFloat(e.target.value) || 0)}
                className="w-full text-xs border rounded px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Feed Type</label>
              <select
                value={feedingType}
                onChange={(e) => setFeedingType(e.target.value as any)}
                className="w-full text-xs border rounded px-2 py-1.5"
              >
                <option value="breast_milk">EBM / Breast</option>
                <option value="formula">Preterm Formula</option>
                <option value="tpn_npo">NPO / TPN</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">aEEG Pattern</label>
              <select
                value={aeegPattern}
                onChange={(e) => setAeegPattern(e.target.value as any)}
                className="w-full text-xs border rounded px-2 py-1.5"
              >
                <option value="continuous_normal_voltage">CNV (Normal)</option>
                <option value="discontinuous_normal_voltage">DNV (Mild depression)</option>
                <option value="continuous_low_voltage">CLV (Low voltage)</option>
                <option value="burst_suppression">Burst Suppression</option>
                <option value="flat_trace">Flat Trace</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Seizure Count</label>
              <input
                type="number"
                value={seizureEventsCount}
                onChange={(e) => setSeizureEventsCount(parseInt(e.target.value) || 0)}
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
              placeholder="e.g. Tolerated feeds well. No jitteriness observed."
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
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Record Flowsheet Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
