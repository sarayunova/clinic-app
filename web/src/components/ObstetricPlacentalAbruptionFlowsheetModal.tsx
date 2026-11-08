import React, { useState } from 'react';
import { addObstetricPlacentalAbruptionFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricPlacentalAbruptionFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [minutesFromPresentation, setMinutesFromPresentation] = useState<number>(15.0);
  const [maternalHeartRate, setMaternalHeartRate] = useState<number>(126);
  const [maternalBloodPressureSys, setMaternalBloodPressureSys] = useState<number>(94);
  const [maternalBloodPressureDia, setMaternalBloodPressureDia] = useState<number>(56);
  const [fetalHeartRate, setFetalHeartRate] = useState<string>('95');
  const [uterineToneAssessment, setUterineToneAssessment] = useState<
    'soft_relaxed_between_contractions' | 'tense_hypertonic' | 'woody_rigid'
  >('woody_rigid');
  const [vaginalBloodLossMl, setVaginalBloodLossMl] = useState<string>('600');
  const [fibrinogenMgDl, setFibrinogenMgDl] = useState<string>('135');
  const [bloodProductsInfused, setBloodProductsInfused] = useState<string>(
    '2 units PRBC, 2 pools Cryoprecipitate infusing through rapid warmer',
  );
  const [notes, setNotes] = useState<string>(
    'Anesthesia team present in OR 2; rapid sequence induction prepared; warm fluids running',
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shockIndex = (maternalHeartRate / (maternalBloodPressureSys || 1)).toFixed(2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addObstetricPlacentalAbruptionFlowsheet(episodeId, {
        logDatetime,
        minutesFromPresentation,
        maternalHeartRate,
        maternalBloodPressureSys,
        maternalBloodPressureDia,
        fetalHeartRate: fetalHeartRate ? parseInt(fetalHeartRate) : null,
        uterineToneAssessment,
        vaginalBloodLossMl: vaginalBloodLossMl ? parseFloat(vaginalBloodLossMl) : null,
        fibrinogenMgDl: fibrinogenMgDl ? parseFloat(fibrinogenMgDl) : null,
        bloodProductsInfused: bloodProductsInfused || null,
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
        <div className="bg-rose-700 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h2 className="text-lg font-bold">Log Abruption Resuscitation Checkpoint</h2>
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

          {/* Real-time Shock Index Calculation */}
          <div className={`p-3 rounded-lg border flex items-center justify-between text-xs font-bold ${
            parseFloat(shockIndex) >= 0.9
              ? 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200'
              : 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
          }`}>
            <span>Maternal Shock Index: {shockIndex} (HR / SBP)</span>
            <span>{parseFloat(shockIndex) >= 0.9 ? '⚠️ CRITICAL HEMODYNAMIC INSTABILITY (≥ 0.9)' : 'Euvolemic / Stable (< 0.9)'}</span>
          </div>

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
                Minutes From Presentation *
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="1440"
                value={minutesFromPresentation}
                onChange={(e) => setMinutesFromPresentation(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Maternal Heart Rate (bpm) *
              </label>
              <input
                type="number"
                min="40"
                max="240"
                value={maternalHeartRate}
                onChange={(e) => setMaternalHeartRate(parseInt(e.target.value) || 0)}
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
                  value={maternalBloodPressureSys}
                  onChange={(e) => setMaternalBloodPressureSys(parseInt(e.target.value) || 0)}
                  className="w-1/2 text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  required
                />
                <input
                  type="number"
                  min="20"
                  max="160"
                  placeholder="Dia"
                  value={maternalBloodPressureDia}
                  onChange={(e) => setMaternalBloodPressureDia(parseInt(e.target.value) || 0)}
                  className="w-1/2 text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fetal Heart Rate (bpm)
              </label>
              <input
                type="number"
                min="0"
                max="240"
                placeholder="e.g., 95 or 0 if demise"
                value={fetalHeartRate}
                onChange={(e) => setFetalHeartRate(e.target.value)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Uterine Tone Assessment *
              </label>
              <select
                value={uterineToneAssessment}
                onChange={(e) => setUterineToneAssessment(e.target.value as any)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-medium"
              >
                <option value="woody_rigid">Woody Rigid / Tetanic</option>
                <option value="tense_hypertonic">Tense / Hypertonic</option>
                <option value="soft_relaxed_between_contractions">Soft / Relaxed between contractions</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cumulative Blood Loss (mL)
              </label>
              <input
                type="number"
                step="50"
                min="0"
                value={vaginalBloodLossMl}
                onChange={(e) => setVaginalBloodLossMl(e.target.value)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Repeat Fibrinogen (mg/dL)
              </label>
              <input
                type="number"
                step="1"
                min="20"
                max="800"
                value={fibrinogenMgDl}
                onChange={(e) => setFibrinogenMgDl(e.target.value)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold text-rose-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Blood Products Infused & Resuscitation Interventions
            </label>
            <input
              type="text"
              value={bloodProductsInfused}
              onChange={(e) => setBloodProductsInfused(e.target.value)}
              placeholder="e.g., 2U PRBC, 2 pools Cryoprecipitate, TXA 1g IV given..."
              className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Clinical Assessment & Operative Progress Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Document transfer to OR, anesthesia induction, clot extrusion..."
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
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Flowsheet Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
