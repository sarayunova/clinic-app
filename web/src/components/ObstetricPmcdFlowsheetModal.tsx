import React, { useState } from 'react';
import {
  addObstetricPmcdFlowsheet,
  type ObstetricPmcdRecord,
} from '../api';

interface Props {
  episodeId?: number;
  episode?: ObstetricPmcdRecord;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSaved?: () => void;
}

export const ObstetricPmcdFlowsheetModal: React.FC<Props> = ({
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
  const [minutesPostArrest, setMinutesPostArrest] = useState<number>(15.0);
  const [heartRateBpm, setHeartRateBpm] = useState<number>(104);
  const [systolicBp, setSystolicBp] = useState<number>(92);
  const [diastolicBp, setDiastolicBp] = useState<number>(56);
  const [endTidalCo2Mmhg, setEndTidalCo2Mmhg] = useState<number>(28.5);
  const [pupillaryResponse, setPupillaryResponse] = useState<
    'reactive_equal' | 'sluggish' | 'fixed_dilated'
  >('sluggish');
  const [chestCompressionsQuality, setChestCompressionsQuality] = useState<
    'optimal_etco2_gt_20' | 'suboptimal_etco2_lt_10' | 'rosc_sustained'
  >('rosc_sustained');
  const [epinephrineCumulativeDoses, setEpinephrineCumulativeDoses] = useState<number>(2);
  const [defibrillationShocksCount, setDefibrillationShocksCount] = useState<number>(0);
  const [bloodProductsTransfusedUnits, setBloodProductsTransfusedUnits] = useState<number>(4);
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEpisodeId) {
      setError('Missing obstetric PMCD episode ID');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      await addObstetricPmcdFlowsheet(targetEpisodeId, {
        logDatetime,
        minutesPostArrest: Number(minutesPostArrest),
        heartRateBpm: Number(heartRateBpm),
        systolicBp: Number(systolicBp),
        diastolicBp: Number(diastolicBp),
        endTidalCo2Mmhg: Number(endTidalCo2Mmhg),
        pupillaryResponse,
        chestCompressionsQuality,
        epinephrineCumulativeDoses: Number(epinephrineCumulativeDoses),
        defibrillationShocksCount: Number(defibrillationShocksCount),
        bloodProductsTransfusedUnits: Number(bloodProductsTransfusedUnits),
        notes: notes.trim() || null,
      });
      if (onSuccess) onSuccess();
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to log PMCD flowsheet:', err);
      setError(err?.message || 'Failed to record flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-rose-50 dark:bg-rose-950/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Log Obstetric PMCD Resuscitation &amp; Post-ROSC Checkpoint
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Minutes Post-Arrest • Vitals &amp; EtCO2 • Pupillary Reflex • TTM Target • Blood Transfusions
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
                Minutes Post-Arrest
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1440"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={minutesPostArrest}
                onChange={(e) => setMinutesPostArrest(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Heart Rate (BPM)
              </label>
              <input
                type="number"
                min="0"
                max="300"
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
                min="0"
                max="300"
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
                min="0"
                max="200"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={diastolicBp}
                onChange={(e) => setDiastolicBp(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                End-Tidal CO2 (EtCO2 mmHg)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={endTidalCo2Mmhg}
                onChange={(e) => setEndTidalCo2Mmhg(Number(e.target.value))}
              />
              <span className="text-[10px] text-slate-400">&gt;20 indicates high-quality CPR / ROSC</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Perfusion / CPR Quality
              </label>
              <select
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={chestCompressionsQuality}
                onChange={(e) =>
                  setChestCompressionsQuality(
                    e.target.value as
                      | 'optimal_etco2_gt_20'
                      | 'suboptimal_etco2_lt_10'
                      | 'rosc_sustained'
                  )
                }
              >
                <option value="rosc_sustained">ROSC Sustained (Pulse Restored)</option>
                <option value="optimal_etco2_gt_20">Optimal CPR Quality (EtCO2 &gt; 20 mmHg)</option>
                <option value="suboptimal_etco2_lt_10">Suboptimal CPR (EtCO2 &lt; 10 mmHg)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Pupillary Response
              </label>
              <select
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={pupillaryResponse}
                onChange={(e) =>
                  setPupillaryResponse(
                    e.target.value as 'reactive_equal' | 'sluggish' | 'fixed_dilated'
                  )
                }
              >
                <option value="reactive_equal">Reactive &amp; Equal</option>
                <option value="sluggish">Sluggish</option>
                <option value="fixed_dilated">Fixed &amp; Dilated</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Epi Doses (1mg)
              </label>
              <input
                type="number"
                min="0"
                max="50"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={epinephrineCumulativeDoses}
                onChange={(e) => setEpinephrineCumulativeDoses(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Defib Shocks
              </label>
              <input
                type="number"
                min="0"
                max="20"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={defibrillationShocksCount}
                onChange={(e) => setDefibrillationShocksCount(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Blood Units Transfused
              </label>
              <input
                type="number"
                min="0"
                max="100"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={bloodProductsTransfusedUnits}
                onChange={(e) => setBloodProductsTransfusedUnits(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Resuscitation &amp; Critical Care Notes
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              placeholder="Arterial blood gas values, vasopressor escalation (norepinephrine/epinephrine), uterine tone, surgical drain output..."
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
              className="px-5 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-md disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Resuscitation Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
