import React, { useState } from 'react';
import {
  addPediatricGbsFlowsheet,
  type PediatricGbsRecord,
} from '../api';

interface Props {
  episodeId?: number;
  episode?: PediatricGbsRecord;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSaved?: () => void;
}

export const PediatricGbsFlowsheetModal: React.FC<Props> = ({
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
  const [dayOfIllness, setDayOfIllness] = useState<number>(4);
  const [hughesScoreCurrent, setHughesScoreCurrent] = useState<number>(
    episode?.hughes_disability_score ?? 4
  );
  const [vitalCapacityMlKg, setVitalCapacityMlKg] = useState<number>(
    episode?.vital_capacity_ml_kg ?? 18.0
  );
  const [singleBreathCount, setSingleBreathCount] = useState<number>(14);
  const [cranialNervePalsyFacialBulbar, setCranialNervePalsyFacialBulbar] = useState<boolean>(false);
  const [neckFlexionPowerMrc, setNeckFlexionPowerMrc] = useState<number>(3);
  const [heartRateBpm, setHeartRateBpm] = useState<number>(108);
  const [systolicBp, setSystolicBp] = useState<number>(115);
  const [diastolicBp, setDiastolicBp] = useState<number>(72);
  const [urinaryRetentionCatheterized, setUrinaryRetentionCatheterized] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEpisodeId) {
      setError('Missing pediatric GBS episode ID');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      await addPediatricGbsFlowsheet(targetEpisodeId, {
        logDatetime,
        dayOfIllness: Number(dayOfIllness),
        hughesScoreCurrent: Number(hughesScoreCurrent),
        vitalCapacityMlKg: Number(vitalCapacityMlKg),
        singleBreathCount: Number(singleBreathCount),
        cranialNervePalsyFacialBulbar,
        neckFlexionPowerMrc: Number(neckFlexionPowerMrc),
        heartRateBpm: Number(heartRateBpm),
        systolicBp: Number(systolicBp),
        diastolicBp: Number(diastolicBp),
        urinaryRetentionCatheterized,
        notes: notes.trim() || null,
      });
      if (onSuccess) onSuccess();
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to log pediatric GBS flowsheet:', err);
      setError(err?.message || 'Failed to record flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-indigo-50 dark:bg-indigo-950/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Log GBS Respiratory 20/30/40 &amp; Autonomic Checkpoint
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Vital Capacity • NIF &amp; PEP • Hughes Score • Dysautonomia Events • IVIG Infusion
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
                Day of Illness
              </label>
              <input
                type="number"
                min="1"
                max="90"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={dayOfIllness}
                onChange={(e) => setDayOfIllness(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Vital Capacity (VC mL/kg)
              </label>
              <input
                type="number"
                step="0.1"
                min="2.0"
                max="80.0"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={vitalCapacityMlKg}
                onChange={(e) => setVitalCapacityMlKg(Number(e.target.value))}
              />
              <span className="text-[10px] text-slate-400">&lt;20 indicates failure</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Single Breath Count
              </label>
              <input
                type="number"
                min="0"
                max="60"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={singleBreathCount}
                onChange={(e) => setSingleBreathCount(Number(e.target.value))}
              />
              <span className="text-[10px] text-slate-400">&lt;15 suggests respiratory decline</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Neck Flexion Power (MRC 0–5)
              </label>
              <input
                type="number"
                min="0"
                max="5"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={neckFlexionPowerMrc}
                onChange={(e) => setNeckFlexionPowerMrc(Number(e.target.value))}
              />
              <span className="text-[10px] text-slate-400">Parallels diaphragm weakness</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Current Hughes Score (0–6)
              </label>
              <select
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={hughesScoreCurrent}
                onChange={(e) => setHughesScoreCurrent(Number(e.target.value))}
              >
                <option value={0}>0: Normal</option>
                <option value={1}>1: Minor symptoms</option>
                <option value={2}>2: Walks 10m independently</option>
                <option value={3}>3: Walks 10m with aid</option>
                <option value={4}>4: Bedbound / chairbound</option>
                <option value={5}>5: Mechanical ventilation</option>
                <option value={6}>6: Deceased</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Heart Rate (BPM)
              </label>
              <input
                type="number"
                min="30"
                max="250"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Blood Pressure (Systolic)
              </label>
              <input
                type="number"
                min="40"
                max="250"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={systolicBp}
                onChange={(e) => setSystolicBp(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Blood Pressure (Diastolic)
              </label>
              <input
                type="number"
                min="20"
                max="150"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={diastolicBp}
                onChange={(e) => setDiastolicBp(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 cursor-pointer">
              <input
                type="checkbox"
                className="rounded text-indigo-600 focus:ring-indigo-500"
                checked={cranialNervePalsyFacialBulbar}
                onChange={(e) => setCranialNervePalsyFacialBulbar(e.target.checked)}
              />
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Cranial Nerve Palsy (Facial / Bulbar)
                </div>
                <div className="text-[10px] text-slate-500">Bilateral VII or IX/X involvement</div>
              </div>
            </label>

            <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 cursor-pointer">
              <input
                type="checkbox"
                className="rounded text-indigo-600 focus:ring-indigo-500"
                checked={urinaryRetentionCatheterized}
                onChange={(e) => setUrinaryRetentionCatheterized(e.target.checked)}
              />
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Urinary Retention / Catheterized
                </div>
                <div className="text-[10px] text-slate-500">Autonomic neurogenic bladder</div>
              </div>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Nursing &amp; Neuromuscular Observations
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              placeholder="Single breath count (target >15), facial weakness, swallow function, neuropathic pain, bladder retention..."
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
              className="px-5 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Neuromuscular Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
