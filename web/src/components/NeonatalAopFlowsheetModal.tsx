import React, { useState } from 'react';
import { addNeonatalAopFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalAopFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [apneaEventsCountInShift, setApneaEventsCountInShift] = useState<number>(1);
  const [bradycardiaEventsCount, setBradycardiaEventsCount] = useState<number>(1);
  const [desaturationEventsCount, setDesaturationEventsCount] = useState<number>(1);
  const [lowestHeartRateBpm, setLowestHeartRateBpm] = useState<string>('76');
  const [lowestSpo2Percent, setLowestSpo2Percent] = useState<string>('84');
  const [stimulationModeUsed, setStimulationModeUsed] = useState<
    'none' | 'tactile_rubbing' | 'repositioning' | 'bag_valve_mask'
  >('tactile_rubbing');
  const [caffeineDoseGivenMg, setCaffeineDoseGivenMg] = useState<string>('9.4');
  const [currentRespiratorySupport, setCurrentRespiratorySupport] = useState<string>('Bubble CPAP +5 cmH2O, FiO2 25%');
  const [caffeineToxicitySigns, setCaffeineToxicitySigns] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await addNeonatalAopFlowsheet(episodeId, {
        logDatetime,
        apneaEventsCountInShift,
        bradycardiaEventsCount,
        desaturationEventsCount,
        lowestHeartRateBpm: lowestHeartRateBpm ? Number(lowestHeartRateBpm) : null,
        lowestSpo2Percent: lowestSpo2Percent ? Number(lowestSpo2Percent) : null,
        stimulationModeUsed,
        caffeineDoseGivenMg: caffeineDoseGivenMg ? Number(caffeineDoseGivenMg) : null,
        currentRespiratorySupport: currentRespiratorySupport.trim() || null,
        caffeineToxicitySigns,
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
              Log Neonatal AOP Shift Checkpoint
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Record Apnea/Bradycardia/Desaturation (ABD) events & caffeine administration
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Apnea Events
              </label>
              <input
                type="number"
                min="0"
                max="50"
                required
                value={apneaEventsCountInShift}
                onChange={(e) => setApneaEventsCountInShift(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Bradycardia Events
              </label>
              <input
                type="number"
                min="0"
                max="50"
                required
                value={bradycardiaEventsCount}
                onChange={(e) => setBradycardiaEventsCount(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Desat Events
              </label>
              <input
                type="number"
                min="0"
                max="50"
                required
                value={desaturationEventsCount}
                onChange={(e) => setDesaturationEventsCount(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Lowest Heart Rate (bpm)
              </label>
              <input
                type="number"
                placeholder="e.g. 76"
                value={lowestHeartRateBpm}
                onChange={(e) => setLowestHeartRateBpm(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Lowest SpO2 (%)
              </label>
              <input
                type="number"
                placeholder="e.g. 84"
                value={lowestSpo2Percent}
                onChange={(e) => setLowestSpo2Percent(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Stimulation Mode Used
              </label>
              <select
                value={stimulationModeUsed}
                onChange={(e) => setStimulationModeUsed(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="none">None / Spontaneous recovery</option>
                <option value="tactile_rubbing">Tactile Rubbing (Soles / Back)</option>
                <option value="repositioning">Repositioning / Airway alignment</option>
                <option value="bag_valve_mask">Bag-Valve-Mask Ventilation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Caffeine Dose Given (mg)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 9.4"
                value={caffeineDoseGivenMg}
                onChange={(e) => setCaffeineDoseGivenMg(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Current Respiratory Support
            </label>
            <input
              type="text"
              placeholder="e.g. Bubble CPAP +5 cmH2O, FiO2 25%"
              value={currentRespiratorySupport}
              onChange={(e) => setCurrentRespiratorySupport(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={caffeineToxicitySigns}
              onChange={(e) => setCaffeineToxicitySigns(e.target.checked)}
              className="rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <span className="font-semibold text-red-600 dark:text-red-400">
              Signs of Caffeine Toxicity (Tachycardia HR &gt;180 bpm, extreme jitteriness, feeding intolerance)
            </span>
          </label>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Clinical Shift Notes
            </label>
            <textarea
              rows={2}
              placeholder="Observation details, feeds, kangaroo care..."
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
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Record Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
