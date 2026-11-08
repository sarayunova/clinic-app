import React, { useState } from 'react';
import { addPediatricPyloricStenosisFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricPyloricStenosisFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [hoursFromAdmission, setHoursFromAdmission] = useState<number>(6);
  const [serumSodiumMeqL, setSerumSodiumMeqL] = useState<string>('136');
  const [serumPotassiumMeqL, setSerumPotassiumMeqL] = useState<string>('3.8');
  const [serumChlorideMeqL, setSerumChlorideMeqL] = useState<string>('99');
  const [serumBicarbonateMeqL, setSerumBicarbonateMeqL] = useState<string>('28');
  const [bloodPh, setBloodPh] = useState<string>('7.44');
  const [urineOutputMlKgHr, setUrineOutputMlKgHr] = useState<number>(1.4);
  const [ivFluidRateMlHr, setIvFluidRateMlHr] = useState<number>(24);
  const [capillaryRefillSeconds, setCapillaryRefillSeconds] = useState<string>('2.0');
  const [vomitingEpisodesCount, setVomitingEpisodesCount] = useState<number>(0);
  const [gastricDecompressionOutputMl, setGastricDecompressionOutputMl] = useState<string>('15');
  const [notes, setNotes] = useState<string>('Infant calm, good skin turgor, electrolytes normalizing on D5 0.45% NS + 20 mEq KCl');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await addPediatricPyloricStenosisFlowsheet(episodeId, {
        logDatetime,
        hoursFromAdmission,
        serumSodiumMeqL: serumSodiumMeqL ? Number(serumSodiumMeqL) : null,
        serumPotassiumMeqL: serumPotassiumMeqL ? Number(serumPotassiumMeqL) : null,
        serumChlorideMeqL: serumChlorideMeqL ? Number(serumChlorideMeqL) : null,
        serumBicarbonateMeqL: serumBicarbonateMeqL ? Number(serumBicarbonateMeqL) : null,
        bloodPh: bloodPh ? Number(bloodPh) : null,
        urineOutputMlKgHr,
        ivFluidRateMlHr,
        capillaryRefillSeconds: capillaryRefillSeconds ? Number(capillaryRefillSeconds) : null,
        vomitingEpisodesCount,
        gastricDecompressionOutputMl: gastricDecompressionOutputMl ? Number(gastricDecompressionOutputMl) : null,
        notes: notes.trim() || null,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record flowsheet log');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Log IHPS Metabolic Resuscitation Checkpoint
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Serial electrolyte balance, urine output & gastric decompression monitoring
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Log Datetime
              </label>
              <input
                type="datetime-local"
                required
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Hours From Admission
              </label>
              <input
                type="number"
                min="0"
                max="720"
                required
                value={hoursFromAdmission}
                onChange={(e) => setHoursFromAdmission(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Serum Cl- (mEq/L)
              </label>
              <input
                type="number"
                step="1"
                placeholder="Target ≥100"
                value={serumChlorideMeqL}
                onChange={(e) => setSerumChlorideMeqL(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Serum HCO3- (mEq/L)
              </label>
              <input
                type="number"
                step="1"
                placeholder="Target ≤28"
                value={serumBicarbonateMeqL}
                onChange={(e) => setSerumBicarbonateMeqL(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Serum K+ (mEq/L)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="Target ≥3.5"
                value={serumPotassiumMeqL}
                onChange={(e) => setSerumPotassiumMeqL(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Blood pH
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Target 7.35-7.45"
                value={bloodPh}
                onChange={(e) => setBloodPh(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                UOP (mL/kg/hr)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={urineOutputMlKgHr}
                onChange={(e) => setUrineOutputMlKgHr(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                IV Rate (mL/hr)
              </label>
              <input
                type="number"
                step="1"
                required
                value={ivFluidRateMlHr}
                onChange={(e) => setIvFluidRateMlHr(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Cap Refill (sec)
              </label>
              <input
                type="number"
                step="0.5"
                placeholder="e.g. 2.0"
                value={capillaryRefillSeconds}
                onChange={(e) => setCapillaryRefillSeconds(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Vomiting Count
              </label>
              <input
                type="number"
                min="0"
                value={vomitingEpisodesCount}
                onChange={(e) => setVomitingEpisodesCount(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                NG Output (mL)
              </label>
              <input
                type="number"
                placeholder="e.g. 15"
                value={gastricDecompressionOutputMl}
                onChange={(e) => setGastricDecompressionOutputMl(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Clinical Shift Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-medium text-white shadow hover:bg-amber-700 disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Record Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
