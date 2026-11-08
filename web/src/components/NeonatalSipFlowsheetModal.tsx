import React, { useState } from 'react';
import {
  addNeonatalSipFlowsheet,
  type NeonatalSipRecord,
} from '../api';

interface Props {
  episodeId?: number;
  episode?: NeonatalSipRecord;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSaved?: () => void;
}

export const NeonatalSipFlowsheetModal: React.FC<Props> = ({
  episodeId,
  episode,
  isOpen = true,
  onClose,
  onSuccess,
  onSaved,
}) => {
  if (!isOpen) return null;
  const targetEpisodeId = episodeId || episode?.id;

  const [logDatetime, setLogDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [hoursFromIntervention, setHoursFromIntervention] = useState<number>(24);
  const [drainOutputMl24h, setDrainOutputMl24h] = useState<number>(14.5);
  const [drainOutputCharacter, setDrainOutputCharacter] = useState<
    'serosanguinous' | 'bilious' | 'feculent_meconium' | 'purulent' | 'minimal_clear'
  >('bilious');
  const [abdominalGirthCm, setAbdominalGirthCm] = useState<number>(23.5);
  const [meanAirwayPressureCmh2o, setMeanAirwayPressureCmh2o] = useState<number>(9.5);
  const [inotropicSupportActive, setInotropicSupportActive] = useState<boolean>(true);
  const [plateletCountKUl, setPlateletCountKUl] = useState<number>(115);
  const [crpMgL, setCrpMgL] = useState<number>(38.5);
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEpisodeId) {
      setError('Missing neonatal SIP episode ID');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      await addNeonatalSipFlowsheet(targetEpisodeId, {
        logDatetime,
        hoursFromIntervention: Number(hoursFromIntervention),
        drainOutputMl24h: Number(drainOutputMl24h),
        drainOutputCharacter,
        abdominalGirthCm: Number(abdominalGirthCm),
        meanAirwayPressureCmh2o: Number(meanAirwayPressureCmh2o),
        inotropicSupportActive,
        plateletCountKUl: Number(plateletCountKUl),
        crpMgL: Number(crpMgL),
        notes: notes.trim() || null,
      });
      if (onSuccess) onSuccess();
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to log neonatal SIP flowsheet:', err);
      setError(err?.message || 'Failed to record flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-950/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Log SIP Peritoneal Drain &amp; Sepsis Checkpoint
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Drain Output • Fluid Character • Abdominal Girth • MAP • Platelets &amp; CRP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs rounded-lg bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Log Timestamp
              </label>
              <input
                type="datetime-local"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Hours From Intervention
              </label>
              <input
                type="number"
                min="0"
                max="720"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={hoursFromIntervention}
                onChange={(e) => setHoursFromIntervention(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                24h Drain Output (mL)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="500"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={drainOutputMl24h}
                onChange={(e) => setDrainOutputMl24h(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Drain Output Character
              </label>
              <select
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={drainOutputCharacter}
                onChange={(e) =>
                  setDrainOutputCharacter(
                    e.target.value as 'serosanguinous' | 'bilious' | 'feculent_meconium' | 'purulent' | 'minimal_clear'
                  )
                }
              >
                <option value="feculent_meconium">Feculent / Meconium (Ongoing Enteric Leak)</option>
                <option value="bilious">Bilious</option>
                <option value="serosanguinous">Serosanguinous</option>
                <option value="purulent">Purulent</option>
                <option value="minimal_clear">Minimal / Clear (Resolving)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Abdominal Girth (cm)
              </label>
              <input
                type="number"
                step="0.1"
                min="10"
                max="60"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={abdominalGirthCm}
                onChange={(e) => setAbdominalGirthCm(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Mean Airway Pressure (MAP cmH2O)
              </label>
              <input
                type="number"
                step="0.1"
                min="4"
                max="30"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={meanAirwayPressureCmh2o}
                onChange={(e) => setMeanAirwayPressureCmh2o(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Platelet Count (k/µL)
              </label>
              <input
                type="number"
                min="5"
                max="1000"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={plateletCountKUl}
                onChange={(e) => setPlateletCountKUl(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                C-Reactive Protein (CRP mg/L)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="300"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={crpMgL}
                onChange={(e) => setCrpMgL(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-amber-600 focus:ring-amber-500"
                  checked={inotropicSupportActive}
                  onChange={(e) => setInotropicSupportActive(e.target.checked)}
                />
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Active Inotropes (Dopamine/Epi)
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Clinical Assessment &amp; Nursing Notes
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              placeholder="Drain site dressing condition, abdominal softness, bile color changes, tolerance of minimal feeds..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-md disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Checkpoint Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
