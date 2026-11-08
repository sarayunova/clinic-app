import React, { useState } from 'react';
import { addPediatricHusFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricHusFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromOnset, setHoursFromOnset] = useState<number>(8.0);
  const [urineOutputMlKgHr, setUrineOutputMlKgHr] = useState<number>(0.3);
  const [fluidBalance24hMl, setFluidBalance24hMl] = useState<string>('+120');
  const [plateletCount, setPlateletCount] = useState<number>(38000);
  const [serumCreatinineMgDl, setSerumCreatinineMgDl] = useState<number>(3.1);
  const [serumPotassiumMeqL, setSerumPotassiumMeqL] = useState<number>(5.6);
  const [bloodPressureSys, setBloodPressureSys] = useState<number>(118);
  const [bloodPressureDia, setBloodPressureDia] = useState<number>(76);
  const [neurologicalStatus, setNeurologicalStatus] = useState<
    'alert' | 'irritable' | 'somnolent' | 'seizure_activity'
  >('irritable');
  const [dialysisUltrafiltrationMl, setDialysisUltrafiltrationMl] = useState<string>('200');
  const [notes, setNotes] = useState<string>(
    'Insensible losses replaced with D5 0.45% NS; potassium strictly withheld from all fluids',
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addPediatricHusFlowsheet(episodeId, {
        logDatetime,
        hoursFromOnset,
        urineOutputMlKgHr,
        fluidBalance24hMl: fluidBalance24hMl ? parseFloat(fluidBalance24hMl) : null,
        plateletCount,
        serumCreatinineMgDl,
        serumPotassiumMeqL,
        bloodPressureSys,
        bloodPressureDia,
        neurologicalStatus,
        dialysisUltrafiltrationMl: dialysisUltrafiltrationMl ? parseFloat(dialysisUltrafiltrationMl) : null,
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
        <div className="bg-cyan-700 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h2 className="text-lg font-bold">Log Pediatric HUS Nephrology Checkpoint</h2>
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
                Hours From Onset *
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
                Urine Output (mL/kg/hr) *
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="20"
                value={urineOutputMlKgHr}
                onChange={(e) => setUrineOutputMlKgHr(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cumulative Fluid Balance (mL)
              </label>
              <input
                type="number"
                step="10"
                placeholder="e.g. +120 or -50"
                value={fluidBalance24hMl}
                onChange={(e) => setFluidBalance24hMl(e.target.value)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Serum Creatinine (mg/dL) *
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="25.0"
                value={serumCreatinineMgDl}
                onChange={(e) => setSerumCreatinineMgDl(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold text-cyan-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Serum Potassium (mEq/L) *
              </label>
              <input
                type="number"
                step="0.1"
                min="1.0"
                max="12.0"
                value={serumPotassiumMeqL}
                onChange={(e) => setSerumPotassiumMeqL(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold text-red-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Platelet Count (/mcL) *
              </label>
              <input
                type="number"
                min="1000"
                max="900000"
                value={plateletCount}
                onChange={(e) => setPlateletCount(parseInt(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Blood Pressure (Sys / Dia) *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="40"
                  max="260"
                  placeholder="Sys"
                  value={bloodPressureSys}
                  onChange={(e) => setBloodPressureSys(parseInt(e.target.value) || 0)}
                  className="w-1/2 text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  required
                />
                <input
                  type="number"
                  min="20"
                  max="160"
                  placeholder="Dia"
                  value={bloodPressureDia}
                  onChange={(e) => setBloodPressureDia(parseInt(e.target.value) || 0)}
                  className="w-1/2 text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Neurological Status *
              </label>
              <select
                value={neurologicalStatus}
                onChange={(e) => setNeurologicalStatus(e.target.value as any)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-medium"
              >
                <option value="alert">Alert & appropriate</option>
                <option value="irritable">Irritable / Fussy</option>
                <option value="somnolent">Somnolent / Lethargic</option>
                <option value="seizure_activity">Seizure activity</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Dialysis Ultrafiltration (mL)
              </label>
              <input
                type="number"
                step="10"
                min="0"
                placeholder="e.g. 200"
                value={dialysisUltrafiltrationMl}
                onChange={(e) => setDialysisUltrafiltrationMl(e.target.value)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nephrology Notes & Fluid Replacement
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Document insensible loss replacement, peritoneal dialysis cycle volume, Kayexalate or calcium gluconate given..."
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
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-cyan-700 hover:bg-cyan-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Flowsheet Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
