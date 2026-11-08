import React, { useState } from 'react';
import { addObstetricVasaPreviaFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricVasaPreviaFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(33.5);
  const [maternalSystolicBp, setMaternalSystolicBp] = useState<number>(118);
  const [maternalDiastolicBp, setMaternalDiastolicBp] = useState<number>(74);
  const [maternalHeartRate, setMaternalHeartRate] = useState<number>(82);
  const [fetalHeartRateBpm, setFetalHeartRateBpm] = useState<number>(144);
  const [ctgBaselineVariability, setCtgBaselineVariability] = useState<
    'normal_moderate' | 'minimal' | 'absent' | 'sinusoidal'
  >('normal_moderate');
  const [vaginalBleedingSeverity, setVaginalBleedingSeverity] = useState<
    'none' | 'spotting_pink_mucus' | 'frank_fetal_blood_active' | 'massive_hemorrhage'
  >('none');
  const [uterineContractionsPer10min, setUrineContractionsPer10min] = useState<number>(0);
  const [notes, setNotes] = useState<string>('Continuous EFM running, intact membranes, no bleeding or cramping');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addObstetricVasaPreviaFlowsheet(episodeId, {
        logDatetime,
        gestationalAgeWeeks: Number(gestationalAgeWeeks),
        maternalSystolicBp: Number(maternalSystolicBp),
        maternalDiastolicBp: Number(maternalDiastolicBp),
        maternalHeartRate: Number(maternalHeartRate),
        fetalHeartRateBpm: Number(fetalHeartRateBpm),
        ctgBaselineVariability,
        vaginalBleedingSeverity,
        uterineContractionsPer10min: Number(uterineContractionsPer10min),
        notes: notes || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record vasa previa flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-rose-700 text-white rounded-t-lg">
          <div>
            <h3 className="font-bold text-lg">Log Vasa Previa CTG & Bleeding Checkpoint</h3>
            <p className="text-xs text-rose-100">Inpatient Rupture Precautions & Fetal Surveillance</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl font-bold leading-none">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Log Time</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Gestational Age (wks)</label>
              <input
                type="number"
                step="0.1"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="12"
                max="43"
                required
              />
            </div>
          </div>

          <div className="p-3 bg-rose-50 rounded border border-rose-200 space-y-3">
            <h4 className="text-xs font-bold uppercase text-rose-900">Fetal CTG & Bleeding Monitor</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">FHR Baseline (bpm)</label>
                <input
                  type="number"
                  value={fetalHeartRateBpm}
                  onChange={(e) => setFetalHeartRateBpm(Number(e.target.value))}
                  className="w-full border rounded px-3 py-1.5 text-sm bg-white font-bold"
                  min="40"
                  max="220"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">CTG Variability</label>
                <select
                  value={ctgBaselineVariability}
                  onChange={(e) => setCtgBaselineVariability(e.target.value as any)}
                  className="w-full border rounded px-3 py-1.5 text-sm bg-white"
                >
                  <option value="normal_moderate">Moderate (Normal 6-25 bpm)</option>
                  <option value="minimal">Minimal (&lt; 5 bpm)</option>
                  <option value="absent">Absent (Critical)</option>
                  <option value="sinusoidal">SINUSOIDAL (CRITICAL EXSANGUINATION)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Vaginal Bleeding Severity</label>
              <select
                value={vaginalBleedingSeverity}
                onChange={(e) => setVaginalBleedingSeverity(e.target.value as any)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white font-semibold text-rose-900"
              >
                <option value="none">None (Quiescent)</option>
                <option value="spotting_pink_mucus">Spotting / Pink Mucus (Alert L&amp;D)</option>
                <option value="frank_fetal_blood_active">Active Frank Blood (Perform Stat Apt Test)</option>
                <option value="massive_hemorrhage">Massive Hemorrhage (Crash Cesarean)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Maternal SBP</label>
              <input
                type="number"
                value={maternalSystolicBp}
                onChange={(e) => setMaternalSystolicBp(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="60"
                max="260"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Maternal DBP</label>
              <input
                type="number"
                value={maternalDiastolicBp}
                onChange={(e) => setMaternalDiastolicBp(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="30"
                max="160"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Maternal HR</label>
              <input
                type="number"
                value={maternalHeartRate}
                onChange={(e) => setMaternalHeartRate(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="40"
                max="200"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Uterine Contractions (/10 min)</label>
            <input
              type="number"
              value={uterineContractionsPer10min}
              onChange={(e) => setUrineContractionsPer10min(Number(e.target.value))}
              className="w-full border rounded px-3 py-1.5 text-sm"
              min="0"
              max="10"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Clinical Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded px-3 py-1.5 text-sm"
              placeholder="Fetal movements, tocodynamometry, triage nurse note..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-rose-700 text-white rounded text-sm font-semibold hover:bg-rose-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
