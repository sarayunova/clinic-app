import React, { useState } from 'react';
import {
  addNeonatalCdhFlowsheet,
  type NeonatalCdhRecord,
} from '../api';

interface Props {
  episodeId?: number;
  episode?: NeonatalCdhRecord;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSaved?: () => void;
}

export const NeonatalCdhFlowsheetModal: React.FC<Props> = ({
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
  const [hoursFromAdmission, setHoursFromAdmission] = useState<number>(6);
  const [pipCmh2o, setPipCmh2o] = useState<number>(episode?.peak_inspiratory_pressure_cmh2o ?? 22.0);
  const [peepCmh2o, setPeepCmh2o] = useState<number>(episode?.peep_cmh2o ?? 4.5);
  const [fio2Percent, setFio2Percent] = useState<number>(45.0);
  const [preductalSpo2, setPreductalSpo2] = useState<number>(episode?.preductal_spo2_percent ?? 92);
  const [postductalSpo2, setPostductalSpo2] = useState<number>(episode?.postductal_spo2_percent ?? 84);
  const [arterialPh, setArterialPh] = useState<number>(7.32);
  const [paco2Mmhg, setPaco2Mmhg] = useState<number>(episode?.paco2_mmhg ?? 55);
  const [lactateMmolL, setLactateMmolL] = useState<number>(2.1);
  const [meanArterialPressureMmhg, setMeanArterialPressureMmhg] = useState<number>(42.0);
  const [inoPpm, setInoPpm] = useState<number>(episode?.inhaled_nitric_oxide_active === 1 ? 20.0 : 0.0);
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEpisodeId) {
      setError('Missing CDH episode ID');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      await addNeonatalCdhFlowsheet(targetEpisodeId, {
        logDatetime,
        hoursFromAdmission: Number(hoursFromAdmission),
        pipCmh2o: Number(pipCmh2o),
        peepCmh2o: Number(peepCmh2o),
        fio2Percent: Number(fio2Percent),
        preductalSpo2: Number(preductalSpo2),
        postductalSpo2: Number(postductalSpo2),
        arterialPh: Number(arterialPh),
        paco2Mmhg: Number(paco2Mmhg),
        lactateMmolL: Number(lactateMmolL),
        meanArterialPressureMmhg: Number(meanArterialPressureMmhg),
        inoPpm: Number(inoPpm),
        notes: notes.trim() || null,
      });
      if (onSuccess) onSuccess();
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to add CDH flowsheet checkpoint:', err);
      setError(err?.message || 'Failed to record flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-sky-50/50 dark:bg-sky-950/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">⏱️</span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Record CDH Ventilatory &amp; Hemodynamic Checkpoint
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Episode {episode?.episode_code || targetEpisodeId} • PIP, Ductal Gradient, Lactate &amp; iNO Titration Log
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
                Hours from Admission
              </label>
              <input
                type="number"
                min="0"
                max="720"
                step="0.5"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={hoursFromAdmission}
                onChange={(e) => setHoursFromAdmission(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                PIP (cmH2O)
              </label>
              <input
                type="number"
                step="0.5"
                min="10"
                max="50"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                value={pipCmh2o}
                onChange={(e) => setPipCmh2o(parseFloat(e.target.value) || 0)}
              />
              <span className="text-[10px] text-slate-400">Target &lt; 25 cmH2O</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                PEEP (cmH2O)
              </label>
              <input
                type="number"
                step="0.5"
                min="2"
                max="15"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={peepCmh2o}
                onChange={(e) => setPeepCmh2o(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                FiO2 (%)
              </label>
              <input
                type="number"
                step="1"
                min="21"
                max="100"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono"
                value={fio2Percent}
                onChange={(e) => setFio2Percent(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Pre-Ductal SpO2 (%)
              </label>
              <input
                type="number"
                min="40"
                max="100"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={preductalSpo2}
                onChange={(e) => setPreductalSpo2(parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Post-Ductal SpO2 (%)
              </label>
              <input
                type="number"
                min="40"
                max="100"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={postductalSpo2}
                onChange={(e) => setPostductalSpo2(parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Arterial pH
              </label>
              <input
                type="number"
                step="0.01"
                min="6.8"
                max="7.8"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={arterialPh}
                onChange={(e) => setArterialPh(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                PaCO2 (mmHg)
              </label>
              <input
                type="number"
                step="0.5"
                min="15"
                max="140"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={paco2Mmhg}
                onChange={(e) => setPaco2Mmhg(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Lactate (mmol/L)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.2"
                max="25"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={lactateMmolL}
                onChange={(e) => setLactateMmolL(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                MAP (mmHg)
              </label>
              <input
                type="number"
                step="1"
                min="15"
                max="90"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={meanArterialPressureMmhg}
                onChange={(e) => setMeanArterialPressureMmhg(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              iNO Dose (ppm)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              max="80"
              required
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              value={inoPpm}
              onChange={(e) => setInoPpm(parseFloat(e.target.value) || 0)}
            />
            <span className="text-[10px] text-slate-400">0 ppm if inactive; standard 10–20 ppm</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nursing / NICU Observation Notes
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              placeholder="E.g. Replogle patent on continuous suction, chest symmetric, sedation titrated..."
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
              className="px-5 py-2 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow disabled:opacity-50"
            >
              {saving ? 'Recording...' : 'Save Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
