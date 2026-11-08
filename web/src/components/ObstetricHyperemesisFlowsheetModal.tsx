import React, { useState } from 'react';
import { addObstetricHyperemesisFlowsheet } from '../api';
import { type KetonuriaDipstick } from '../obstetricHyperemesisEngine';

interface Props {
  episodeId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const ObstetricHyperemesisFlowsheetModal: React.FC<Props> = ({
  episodeId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [dayOfTreatment, setDayOfTreatment] = useState(1);
  const [puqeScoreTotal, setPuqeScoreTotal] = useState(8);
  const [vomitingEpisodes24h, setVomitingEpisodes24h] = useState(2);
  const [ketonuriaDipstick, setKetonuriaDipstick] = useState<KetonuriaDipstick>('one_plus');
  const [ivFluidBalanceMl24h, setIvFluidBalanceMl24h] = useState(1500);
  const [oralFluidIntakeMl, setOralFluidIntakeMl] = useState(500);
  const [potassiumMmolL, setPotassiumMmolL] = useState(3.8);
  const [thiamineAdministered, setThiamineAdministered] = useState(true);
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await addObstetricHyperemesisFlowsheet(episodeId, {
        logDatetime: new Date(logDatetime).toISOString(),
        dayOfTreatment: Number(dayOfTreatment),
        puqeScoreTotal: Number(puqeScoreTotal),
        vomitingEpisodes24h: Number(vomitingEpisodes24h),
        ketonuriaDipstick,
        ivFluidBalanceMl24h: Number(ivFluidBalanceMl24h),
        oralFluidIntakeMl: Number(oralFluidIntakeMl),
        potassiumMmolL: Number(potassiumMmolL),
        thiamineAdministered,
        notes: notes || undefined,
      });
      onSuccess();
    } catch (err: any) {
      console.error('Failed to add hyperemesis flowsheet entry:', err);
      setError(err?.message || 'Failed to save flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 my-8">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>📝</span> Record Daily HG Flowsheet Checkpoint
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date &amp; Time
              </label>
              <input
                type="datetime-local"
                required
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Day of Inpatient Care
              </label>
              <input
                type="number"
                min="1"
                max="60"
                required
                value={dayOfTreatment}
                onChange={(e) => setDayOfTreatment(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                PUQE-24 Score (3–15)
              </label>
              <input
                type="number"
                min="3"
                max="15"
                required
                value={puqeScoreTotal}
                onChange={(e) => setPuqeScoreTotal(parseInt(e.target.value) || 3)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                24h Vomiting Episodes
              </label>
              <input
                type="number"
                min="0"
                max="50"
                required
                value={vomitingEpisodes24h}
                onChange={(e) => setVomitingEpisodes24h(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Urine Ketonuria
              </label>
              <select
                value={ketonuriaDipstick}
                onChange={(e) => setKetonuriaDipstick(e.target.value as KetonuriaDipstick)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="negative">Negative</option>
                <option value="trace">Trace</option>
                <option value="one_plus">1+</option>
                <option value="two_plus">2+</option>
                <option value="three_plus">3+</option>
                <option value="four_plus">4+</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Serum K+ (mmol/L)
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="8"
                required
                value={potassiumMmolL}
                onChange={(e) => setPotassiumMmolL(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                IV Fluid Balance (mL/24h)
              </label>
              <input
                type="number"
                step="50"
                required
                value={ivFluidBalanceMl24h}
                onChange={(e) => setIvFluidBalanceMl24h(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Oral Intake (mL)
              </label>
              <input
                type="number"
                step="50"
                min="0"
                required
                value={oralFluidIntakeMl}
                onChange={(e) => setOralFluidIntakeMl(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={thiamineAdministered}
                onChange={(e) => setThiamineAdministered(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                Daily Thiamine (100 mg IV) Administered
              </span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nursing / Intake Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Tolerated 2 dry crackers and 100 mL electrolyte sip; no emesis post-ondansetron"
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm transition"
            >
              {saving ? 'Saving...' : 'Add Flowsheet Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
