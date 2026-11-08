import React, { useState } from 'react';
import {
  addObstetricHellpFlowsheet,
  type ObstetricHellpRecord,
} from '../api';

interface Props {
  episode: ObstetricHellpRecord;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricHellpFlowsheetModal: React.FC<Props> = ({
  episode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [hoursFromAdmission, setHoursFromAdmission] = useState<number>(6);
  const [plateletCountPerUl, setPlateletCountPerUl] = useState<number>(
    episode.platelet_count_per_ul
  );
  const [astUL, setAstUL] = useState<number>(episode.ast_u_l);
  const [ldhUL, setLdhUL] = useState<number>(episode.ldh_u_l);
  const [systolicBp, setSystolicBp] = useState<number>(episode.systolic_bp);
  const [diastolicBp, setDiastolicBp] = useState<number>(episode.diastolic_bp);
  const [urineOutputMlHr, setUrineOutputMlHr] = useState<number>(35.0);
  const [deepTendonReflexes, setDeepTendonReflexes] = useState<
    'absent_hyporeflexia' | 'normal_2_plus' | 'hyperreflexic_clonus'
  >('normal_2_plus');
  const [epigastricPainScore, setEpigastricPainScore] = useState<number>(
    episode.epigastric_ruq_pain === 1 ? 6 : 0
  );
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await addObstetricHellpFlowsheet(episode.id, {
        logDatetime,
        hoursFromAdmission: Number(hoursFromAdmission),
        plateletCountPerUl: Number(plateletCountPerUl),
        astUL: Number(astUL),
        ldhUL: Number(ldhUL),
        systolicBp: Number(systolicBp),
        diastolicBp: Number(diastolicBp),
        urineOutputMlHr: Number(urineOutputMlHr),
        deepTendonReflexes,
        epigastricPainScore: Number(epigastricPainScore),
        notes: notes.trim() || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to add HELLP flowsheet checkpoint:', err);
      setError(err?.message || 'Failed to record flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-rose-50/50 dark:bg-rose-950/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">⏱️</span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Record Obstetric HELLP Serial Checkpoint
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Episode {episode.episode_code} • Platelet Trends, Transaminases, MgSO4 Toxicity &amp; BP Surveillance
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
                Platelets (/µL)
              </label>
              <input
                type="number"
                min="1000"
                max="500000"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                value={plateletCountPerUl}
                onChange={(e) => setPlateletCountPerUl(parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                AST / SGOT (U/L)
              </label>
              <input
                type="number"
                min="5"
                max="5000"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={astUL}
                onChange={(e) => setAstUL(parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                LDH (U/L)
              </label>
              <input
                type="number"
                min="50"
                max="10000"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={ldhUL}
                onChange={(e) => setLdhUL(parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Blood Pressure (Systolic / Diastolic)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="60"
                  max="260"
                  placeholder="Sys"
                  required
                  className="w-1/2 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={systolicBp}
                  onChange={(e) => setSystolicBp(parseInt(e.target.value, 10) || 0)}
                />
                <input
                  type="number"
                  min="40"
                  max="160"
                  placeholder="Dia"
                  required
                  className="w-1/2 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={diastolicBp}
                  onChange={(e) => setDiastolicBp(parseInt(e.target.value, 10) || 0)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Urine Output (mL/hr)
              </label>
              <input
                type="number"
                min="0"
                max="500"
                step="0.5"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={urineOutputMlHr}
                onChange={(e) => setUrineOutputMlHr(parseFloat(e.target.value) || 0)}
              />
              <span className="text-[10px] text-slate-400">Target &gt; 30 mL/hr (MgSO4 safety)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Deep Tendon Reflexes (Patellar)
              </label>
              <select
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={deepTendonReflexes}
                onChange={(e) => setDeepTendonReflexes(e.target.value as any)}
              >
                <option value="normal_2_plus">Normal (2+) - Safe MgSO4</option>
                <option value="absent_hyporeflexia">Absent / Hyporeflexic (Warning: MgSO4 toxicity)</option>
                <option value="hyperreflexic_clonus">Hyperreflexic / Clonus present (Eclampsia risk)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Epigastric / RUQ Pain Score (0–10)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                value={epigastricPainScore}
                onChange={(e) => setEpigastricPainScore(parseInt(e.target.value, 10) || 0)}
              />
              <span className="text-[10px] text-slate-400">Severe pain &gt; 5 raises rupture concern</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nursing / ICU Observation Notes
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              placeholder="E.g. Platelet drip completed, Dexamethasone dose 2 given, respiratory rate 18/min..."
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
              className="px-5 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow disabled:opacity-50"
            >
              {saving ? 'Recording...' : 'Save Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
