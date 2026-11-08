import React, { useState } from 'react';
import {
  addPediatricScfeFlowsheet,
  type PediatricScfeRecord,
} from '../api';

interface Props {
  episode: PediatricScfeRecord;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricScfeFlowsheetModal: React.FC<Props> = ({
  episode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [dayFromPresentation, setDayFromPresentation] = useState<number>(1);
  const [painScoreVas, setPainScoreVas] = useState<number>(4);
  const [nonWeightBearingCompliance, setNonWeightBearingCompliance] = useState<
    'strict_wheelchair_bedrest' | 'partial_crutches' | 'full_weight_bearing'
  >('strict_wheelchair_bedrest');
  const [hipInternalRotationDegrees, setHipInternalRotationDegrees] = useState<number>(5.0);
  const [woundDressingClean, setWoundDressingClean] = useState<boolean>(true);
  const [distalNeurovascularStatus, setDistalNeurovascularStatus] = useState<
    'intact_pulses_sensation_normal' | 'paresthesias_delayed_cap_refill'
  >('intact_pulses_sensation_normal');
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await addPediatricScfeFlowsheet(episode.id, {
        logDatetime,
        dayFromPresentation: Number(dayFromPresentation),
        painScoreVas: Number(painScoreVas),
        nonWeightBearingCompliance,
        hipInternalRotationDegrees: Number(hipInternalRotationDegrees),
        woundDressingClean,
        distalNeurovascularStatus,
        notes: notes.trim() || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to add SCFE flowsheet checkpoint:', err);
      setError(err?.message || 'Failed to record flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">⏱️</span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Record Pediatric SCFE Serial Checkpoint
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Episode {episode.episode_code} • Weight-Bearing Adherence, ROM, Distal Neurovascular &amp; Pain Audit
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Day from Presentation / Surgery
              </label>
              <input
                type="number"
                min="1"
                max="180"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={dayFromPresentation}
                onChange={(e) => setDayFromPresentation(parseInt(e.target.value, 10) || 1)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                VAS Pain Score (0–10)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold"
                value={painScoreVas}
                onChange={(e) => setPainScoreVas(parseInt(e.target.value, 10) || 0)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Weight-Bearing Compliance
              </label>
              <select
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-semibold"
                value={nonWeightBearingCompliance}
                onChange={(e) => setNonWeightBearingCompliance(e.target.value as any)}
              >
                <option value="strict_wheelchair_bedrest">Strict Wheelchair / Bedrest (Strict NWB)</option>
                <option value="partial_crutches">Touch-Down / Partial Crutches (Toe-touch only)</option>
                <option value="full_weight_bearing">Full Weight Bearing (Post-fusion only)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Hip Internal Rotation (degrees)
              </label>
              <input
                type="number"
                min="-30"
                max="60"
                step="1"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={hipInternalRotationDegrees}
                onChange={(e) => setHipInternalRotationDegrees(parseFloat(e.target.value) || 0)}
              />
              <span className="text-[10px] text-slate-400">Diminished IR is hallmark of retroverted epiphysis</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Distal Neurovascular Status
              </label>
              <select
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={distalNeurovascularStatus}
                onChange={(e) => setDistalNeurovascularStatus(e.target.value as any)}
              >
                <option value="intact_pulses_sensation_normal">Intact Pulses (DP/PT 2+) &amp; Normal Sensation</option>
                <option value="paresthesias_delayed_cap_refill">Paresthesias / Delayed Capillary Refill (Alert!)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center">
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                className="rounded text-emerald-600 focus:ring-emerald-500"
                checked={woundDressingClean}
                onChange={(e) => setWoundDressingClean(e.target.checked)}
              />
              <span>Surgical puncture wound dressing clean, dry, and intact (no hematoma or strike-through)</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nursing / Orthopedic Checkpoint Notes
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              placeholder="E.g. Strict wheelchair transfer practiced with physical therapy, analgesics tolerated well..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow disabled:opacity-50"
            >
              {saving ? 'Recording...' : 'Save Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
