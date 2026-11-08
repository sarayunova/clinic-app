import React, { useState } from 'react';
import { addPediatricAcuteScrotumFlowsheet } from '../api';

interface Props {
  episodeId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const PediatricAcuteScrotumFlowsheetModal: React.FC<Props> = ({
  episodeId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromPresentation, setHoursFromPresentation] = useState(2.0);
  const [painScoreFlaccOrVas, setPainScoreFlaccOrVas] = useState(3);
  const [scrotalEdemaErythema, setScrotalEdemaErythema] = useState<
    'mild' | 'moderate' | 'severe_tense' | 'resolving'
  >('mild');
  const [cremastericReflexStatus, setCremastericReflexStatus] = useState<
    'absent' | 'sluggish' | 'intact_normal'
  >('sluggish');
  const [woundDressingClean, setWoundDressingClean] = useState(true);
  const [ambulationStatus, setAmbulationStatus] = useState<
    'bedrest_scrotal_elevation' | 'gentle_ambulation_supported' | 'full_activity'
  >('bedrest_scrotal_elevation');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await addPediatricAcuteScrotumFlowsheet(episodeId, {
        logDatetime: new Date(logDatetime).toISOString(),
        hoursFromPresentation: Number(hoursFromPresentation),
        painScoreFlaccOrVas: Number(painScoreFlaccOrVas),
        scrotalEdemaErythema,
        cremastericReflexStatus,
        woundDressingClean,
        ambulationStatus,
        notes: notes || undefined,
      });
      onSuccess();
    } catch (err: any) {
      console.error('Failed to add acute scrotum flowsheet log:', err);
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
            <span>📝</span> Record Post-Torsion Recovery Log
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
                Hours From Presentation
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="168"
                required
                value={hoursFromPresentation}
                onChange={(e) => setHoursFromPresentation(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pain Score (0–10 FLACC/VAS)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                required
                value={painScoreFlaccOrVas}
                onChange={(e) => setPainScoreFlaccOrVas(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Scrotal Edema / Erythema
              </label>
              <select
                value={scrotalEdemaErythema}
                onChange={(e) =>
                  setScrotalEdemaErythema(
                    e.target.value as 'mild' | 'moderate' | 'severe_tense' | 'resolving'
                  )
                }
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe_tense">Severe Tense</option>
                <option value="resolving">Resolving</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cremasteric Reflex
              </label>
              <select
                value={cremastericReflexStatus}
                onChange={(e) =>
                  setCremastericReflexStatus(
                    e.target.value as 'absent' | 'sluggish' | 'intact_normal'
                  )
                }
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="absent">Absent</option>
                <option value="sluggish">Sluggish</option>
                <option value="intact_normal">Intact / Normal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ambulation Activity
              </label>
              <select
                value={ambulationStatus}
                onChange={(e) =>
                  setAmbulationStatus(
                    e.target.value as
                      | 'bedrest_scrotal_elevation'
                      | 'gentle_ambulation_supported'
                      | 'full_activity'
                  )
                }
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="bedrest_scrotal_elevation">Bedrest + Scrotal Elevation</option>
                <option value="gentle_ambulation_supported">Gentle Ambulation Supported</option>
                <option value="full_activity">Full Normal Activity</option>
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={woundDressingClean}
                onChange={(e) => setWoundDressingClean(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Surgical Dressing Dry &amp; Intact (No Hematoma)
              </span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nursing / Post-op Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Scrotal support jockstrap applied, oral acetaminophen given, swelling improving"
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
              {saving ? 'Saving...' : 'Add Recovery Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
