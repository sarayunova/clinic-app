import React, { useState } from 'react';
import { addObstetricRetainedPlacentaFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricRetainedPlacentaFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [minutesFromDelivery, setMinutesFromDelivery] = useState<number>(40);
  const [bloodPressureSys, setBloodPressureSys] = useState<string>('115');
  const [bloodPressureDia, setBloodPressureDia] = useState<string>('75');
  const [heartRate, setHeartRate] = useState<string>('88');
  const [cumulativeBloodLossMl, setCumulativeBloodLossMl] = useState<number>(400);
  const [uterineFundusTone, setUterineFundusTone] = useState<
    'firm_contracted' | 'soft_boggy' | 'contracted_with_lower_spasm'
  >('firm_contracted');
  const [activeVaginalBleeding, setActiveVaginalBleeding] = useState<
    'minimal_trickle' | 'moderate_lochia' | 'brisk_hemorrhage'
  >('moderate_lochia');
  const [cordLengtheningObserved, setCordLengtheningObserved] = useState<boolean>(false);
  const [interventionApplied, setInterventionApplied] = useState<string>(
    'Bladder emptied, gentle controlled cord traction applied',
  );
  const [notes, setNotes] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await addObstetricRetainedPlacentaFlowsheet(episodeId, {
        logDatetime,
        minutesFromDelivery,
        bloodPressureSys: bloodPressureSys ? Number(bloodPressureSys) : null,
        bloodPressureDia: bloodPressureDia ? Number(bloodPressureDia) : null,
        heartRate: heartRate ? Number(heartRate) : null,
        cumulativeBloodLossMl,
        uterineFundusTone,
        activeVaginalBleeding,
        cordLengtheningObserved,
        interventionApplied: interventionApplied.trim() || null,
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
              Log Third Stage Retained Placenta Checkpoint
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Serial hemodynamic surveillance, blood loss monitoring & placental separation signs
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
                Minutes From Delivery
              </label>
              <input
                type="number"
                min="0"
                max="1440"
                required
                value={minutesFromDelivery}
                onChange={(e) => setMinutesFromDelivery(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                BP Systolic
              </label>
              <input
                type="number"
                placeholder="e.g. 115"
                value={bloodPressureSys}
                onChange={(e) => setBloodPressureSys(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                BP Diastolic
              </label>
              <input
                type="number"
                placeholder="e.g. 75"
                value={bloodPressureDia}
                onChange={(e) => setBloodPressureDia(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Heart Rate (bpm)
              </label>
              <input
                type="number"
                placeholder="e.g. 88"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Cumulative Blood Loss (mL)
              </label>
              <input
                type="number"
                min="0"
                max="10000"
                step="50"
                required
                value={cumulativeBloodLossMl}
                onChange={(e) => setCumulativeBloodLossMl(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Active Vaginal Bleeding
              </label>
              <select
                value={activeVaginalBleeding}
                onChange={(e) => setActiveVaginalBleeding(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="minimal_trickle">Minimal Trickle</option>
                <option value="moderate_lochia">Moderate Bleeding</option>
                <option value="brisk_hemorrhage">Brisk Hemorrhage (Severe PPH)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Uterine Fundus Tone
              </label>
              <select
                value={uterineFundusTone}
                onChange={(e) => setUterineFundusTone(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="firm_contracted">Firm & Contracted</option>
                <option value="soft_boggy">Soft & Boggy (Atony)</option>
                <option value="contracted_with_lower_spasm">Contracted with Lower Segment Spasm / Hourglass Ring</option>
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={cordLengtheningObserved}
                  onChange={(e) => setCordLengtheningObserved(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="font-semibold">Cord Lengthening Observed (Separation Sign)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Intervention Applied
            </label>
            <input
              type="text"
              placeholder="e.g. Bladder catheterized, IUV oxytocin injected, Theater team notified..."
              value={interventionApplied}
              onChange={(e) => setInterventionApplied(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Clinical Shift Notes
            </label>
            <textarea
              rows={2}
              placeholder="Vital trends, IV access, blood cross-match, analgesia..."
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
              className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-medium text-white shadow hover:bg-rose-700 disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Record Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
