import React, { useState } from 'react';
import { addNeonatalMeconiumIleusFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalMeconiumIleusFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromOnset, setHoursFromOnset] = useState<number>(4.0);
  const [abdominalGirthCm, setAbdominalGirthCm] = useState<number>(31.5);
  const [gastricAspirateMl, setGastricAspirateMl] = useState<string>('12');
  const [gastricAspirateColor, setGastricAspirateColor] = useState<string>('Bilious dark green');
  const [meconiumEvacuatedAmount, setMeconiumEvacuatedAmount] = useState<
    'none' | 'scant_mucus' | 'small_hard_pellets' | 'large_thick_meconium_plug' | 'copious_liquid_meconium'
  >('large_thick_meconium_plug');
  const [hydrationStatus, setHydrationStatus] = useState<
    'euvolemic' | 'mild_hypovolemia' | 'moderate_dehydration' | 'severe_shock'
  >('euvolemic');
  const [urineOutputMlKgHr, setUrineOutputMlKgHr] = useState<string>('2.2');
  const [serumSodiumMeqL, setSerumSodiumMeqL] = useState<string>('138');
  const [heartRate, setHeartRate] = useState<number>(148);
  const [notes, setNotes] = useState<string>('Post-dilute Gastrografin enema, baby warm, passage of dark rubbery meconium plug');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addNeonatalMeconiumIleusFlowsheet(episodeId, {
        logDatetime,
        hoursFromOnset,
        abdominalGirthCm,
        gastricAspirateMl: gastricAspirateMl ? parseFloat(gastricAspirateMl) : null,
        gastricAspirateColor: gastricAspirateColor || null,
        meconiumEvacuatedAmount,
        hydrationStatus,
        urineOutputMlKgHr: urineOutputMlKgHr ? parseFloat(urineOutputMlKgHr) : null,
        serumSodiumMeqL: serumSodiumMeqL ? parseFloat(serumSodiumMeqL) : null,
        heartRate,
        notes: notes || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-xl w-full flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="bg-amber-600 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h2 className="text-lg font-bold">Log Meconium Decompression Flowsheet Checkpoint</h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl font-bold leading-none p-1">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Log Date & Time *
              </label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Hours from Onset *
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="720"
                value={hoursFromOnset}
                onChange={(e) => setHoursFromOnset(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Abdominal Girth (cm) *
              </label>
              <input
                type="number"
                step="0.1"
                min="10"
                max="80"
                value={abdominalGirthCm}
                onChange={(e) => setAbdominalGirthCm(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Heart Rate (bpm) *
              </label>
              <input
                type="number"
                min="40"
                max="250"
                value={heartRate}
                onChange={(e) => setHeartRate(parseInt(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Meconium Evacuated Amount *
              </label>
              <select
                value={meconiumEvacuatedAmount}
                onChange={(e) => setMeconiumEvacuatedAmount(e.target.value as any)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              >
                <option value="none">None</option>
                <option value="scant_mucus">Scant mucus only</option>
                <option value="small_hard_pellets">Small hard pellets</option>
                <option value="large_thick_meconium_plug">Large thick meconium plug</option>
                <option value="copious_liquid_meconium">Copious liquid meconium</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Hydration Assessment *
              </label>
              <select
                value={hydrationStatus}
                onChange={(e) => setHydrationStatus(e.target.value as any)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              >
                <option value="euvolemic">Euvolemic (Adequate perfusion)</option>
                <option value="mild_hypovolemia">Mild Hypovolemia</option>
                <option value="moderate_dehydration">Moderate Dehydration</option>
                <option value="severe_shock">Severe Shock / Hypovolemia</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Gastric Aspirate Volume (mL)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={gastricAspirateMl}
                onChange={(e) => setGastricAspirateMl(e.target.value)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Gastric Aspirate Color
              </label>
              <input
                type="text"
                value={gastricAspirateColor}
                onChange={(e) => setGastricAspirateColor(e.target.value)}
                placeholder="e.g., Bilious dark green"
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Urine Output (mL/kg/hr)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={urineOutputMlKgHr}
                onChange={(e) => setUrineOutputMlKgHr(e.target.value)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Serum Sodium (mEq/L)
              </label>
              <input
                type="number"
                step="0.5"
                min="100"
                max="180"
                value={serumSodiumMeqL}
                onChange={(e) => setSerumSodiumMeqL(e.target.value)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Clinical Assessment & Fluid Balance Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Document IV maintenance rate, flushes, enema passage details..."
              className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Flowsheet Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
