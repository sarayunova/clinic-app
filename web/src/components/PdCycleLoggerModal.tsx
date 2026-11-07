import React, { useState } from 'react';
import { logPdCycle, type PdCycleRecord } from '../api';

interface PdCycleLoggerModalProps {
  sessionId: number;
  sessionNumber: string;
  patientName: string;
  nextCycleNumber: number;
  prescribedFillVolume: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (cycle: PdCycleRecord) => void;
}

export const PdCycleLoggerModal: React.FC<PdCycleLoggerModalProps> = ({
  sessionId,
  sessionNumber,
  patientName,
  nextCycleNumber,
  prescribedFillVolume,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [cycleNumber, setCycleNumber] = useState<number>(nextCycleNumber);
  const [cycleStartTime, setCycleStartTime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [inflowMl, setInflowMl] = useState<number>(prescribedFillVolume);
  const [dwellDurationMinutes, setDwellDurationMinutes] = useState<number>(45);
  const [outflowMl, setOutflowMl] = useState<number>(prescribedFillVolume + 10);
  const [effluentAppearance, setEffluentAppearance] = useState<
    'clear_straw' | 'hazy' | 'cloudy_turbid' | 'blood_tinged' | 'frank_blood' | 'fibrin_clots'
  >('clear_straw');
  const [abdominalGirthCm, setAbdominalGirthCm] = useState<string>('');
  const [catheterSiteLeakage, setCatheterSiteLeakage] = useState<boolean>(false);
  const [patientTolerance, setPatientTolerance] = useState<
    'well_tolerated' | 'mild_distress' | 'severe_pain_distension' | 'respiratory_compromise'
  >('well_tolerated');
  const [notes, setNotes] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const netUf = Math.round((outflowMl - inflowMl) * 10) / 10;
  const isCloudy = effluentAppearance === 'cloudy_turbid' || effluentAppearance === 'fibrin_clots';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await logPdCycle(sessionId, {
        cycleNumber,
        cycleStartTime,
        inflowMl,
        dwellDurationMinutes,
        outflowMl,
        effluentAppearance,
        abdominalGirthCm: abdominalGirthCm ? parseFloat(abdominalGirthCm) : null,
        catheterSiteLeakage,
        patientTolerance,
        notes: notes || null,
      });
      onSuccess(res.cycle);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record PD cycle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Log Bedside Peritoneal Dialysis Cycle #{cycleNumber}
            </h2>
            <p className="text-xs text-gray-600">
              Patient: <span className="font-semibold">{patientName}</span> | Session: {sessionNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-2xl"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
            {error}
          </div>
        )}

        {isCloudy && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-center gap-2">
            <span className="text-base font-bold">⚠️</span>
            <span>
              <strong>Peritonitis Alert:</strong> Turbid or fibrin-rich effluent detected. Send 50 mL for immediate cell count & culture!
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Cycle Number
              </label>
              <input
                type="number"
                min="1"
                value={cycleNumber}
                onChange={(e) => setCycleNumber(parseInt(e.target.value, 10) || 1)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm font-bold text-blue-700"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Exchange Time
              </label>
              <input
                type="datetime-local"
                value={cycleStartTime}
                onChange={(e) => setCycleStartTime(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm"
                required
              />
            </div>
          </div>

          <div className="bg-slate-50 border rounded-lg p-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Inflow (mL)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={inflowMl}
                  onChange={(e) => setInflowMl(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-2 py-1 text-sm text-center font-semibold"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Dwell (min)</label>
                <input
                  type="number"
                  min="0"
                  value={dwellDurationMinutes}
                  onChange={(e) => setDwellDurationMinutes(parseInt(e.target.value, 10) || 0)}
                  className="w-full border rounded px-2 py-1 text-sm text-center font-semibold"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Drain/Outflow (mL)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={outflowMl}
                  onChange={(e) => setOutflowMl(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-2 py-1 text-sm text-center font-semibold"
                  required
                />
              </div>
            </div>

            <div className="mt-3 pt-3 border-t flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">Net Ultrafiltration (UF):</span>
              <span
                className={`text-base font-black px-3 py-0.5 rounded-full ${
                  netUf >= 0
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}
              >
                {netUf >= 0 ? `+${netUf} mL (Removal)` : `${netUf} mL (Retention)`}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Dialysate Effluent Appearance
            </label>
            <select
              value={effluentAppearance}
              onChange={(e) =>
                setEffluentAppearance(e.target.value as typeof effluentAppearance)
              }
              className={`w-full border rounded-lg px-3 py-2 text-sm font-medium ${
                isCloudy ? 'bg-amber-50 text-amber-900 border-amber-400' : 'bg-white'
              }`}
            >
              <option value="clear_straw">Clear Straw / Pale Yellow (Normal)</option>
              <option value="hazy">Hazy / Mildly Opaque</option>
              <option value="cloudy_turbid">Cloudy / Turbid (Peritonitis Alert)</option>
              <option value="fibrin_clots">Fibrin Clots / Strands</option>
              <option value="blood_tinged">Blood-Tinged / Pink</option>
              <option value="frank_blood">Frank Blood (Catheter Bleed)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Abdominal Girth (cm)
              </label>
              <input
                type="number"
                step="0.5"
                placeholder="e.g. 28.5"
                value={abdominalGirthCm}
                onChange={(e) => setAbdominalGirthCm(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Patient Tolerance
              </label>
              <select
                value={patientTolerance}
                onChange={(e) =>
                  setPatientTolerance(e.target.value as typeof patientTolerance)
                }
                className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white"
              >
                <option value="well_tolerated">Well Tolerated</option>
                <option value="mild_distress">Mild Irritability / Discomfort</option>
                <option value="severe_pain_distension">Severe Pain / Distension</option>
                <option value="respiratory_compromise">Respiratory Compromise (Tachypnea)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="catheterSiteLeakage"
              checked={catheterSiteLeakage}
              onChange={(e) => setCatheterSiteLeakage(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <label htmlFor="catheterSiteLeakage" className="text-xs text-gray-700 font-medium">
              Dialysate leakage observed around catheter insertion site / dressing
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Nursing Notes / Bedside Observations
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Inflow completed in 12 min without pain, drain clear with good flow rate"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded-lg px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Record Cycle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
