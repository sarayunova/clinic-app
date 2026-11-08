import React, { useState } from 'react';
import { addObstetricEcvFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricEcvFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [minutesFromStart, setMinutesFromStart] = useState<number>(15.0);
  const [maternalHeartRate, setMaternalHeartRate] = useState<number>(88);
  const [maternalBloodPressureSys, setMaternalBloodPressureSys] = useState<string>('118');
  const [maternalBloodPressureDia, setMaternalBloodPressureDia] = useState<string>('72');
  const [fetalHeartRateBaseline, setFetalHeartRateBaseline] = useState<number>(140);
  const [efmPattern, setEfmPattern] = useState<
    'reactive_reassuring' | 'transient_bradycardia_self_resolved' | 'persistent_severe_bradycardia' | 'tachycardia_post_terbutaline'
  >('reactive_reassuring');
  const [uterineRelaxationAdequate, setUterineRelaxationAdequate] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('Post-attempt FHR auscultation reassuring, good variability, no decelerations');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addObstetricEcvFlowsheet(episodeId, {
        logDatetime,
        minutesFromStart,
        maternalHeartRate,
        maternalBloodPressureSys: maternalBloodPressureSys ? parseInt(maternalBloodPressureSys) : null,
        maternalBloodPressureDia: maternalBloodPressureDia ? parseInt(maternalBloodPressureDia) : null,
        fetalHeartRateBaseline,
        efmPattern,
        uterineRelaxationAdequate,
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-base">⏱️</span>
              Log ECV Fetal Heart & Uterine Tone Checkpoint
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Serial EFM, Maternal Hemodynamics & Tocolytic Response
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-semibold leading-none">
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-gray-700 font-medium mb-1">Log Datetime</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">Minutes from Start</label>
              <input
                type="number"
                step="5"
                min="0"
                value={minutesFromStart}
                onChange={(e) => setMinutesFromStart(parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-gray-700 font-medium mb-1">FHR Baseline (bpm)</label>
              <input
                type="number"
                min="60"
                max="220"
                value={fetalHeartRateBaseline}
                onChange={(e) => setFetalHeartRateBaseline(parseInt(e.target.value) || 140)}
                className="w-full border rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">Maternal HR (bpm)</label>
              <input
                type="number"
                min="40"
                max="220"
                value={maternalHeartRate}
                onChange={(e) => setMaternalHeartRate(parseInt(e.target.value) || 80)}
                className="w-full border rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">Maternal BP (mmHg)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Sys"
                  value={maternalBloodPressureSys}
                  onChange={(e) => setMaternalBloodPressureSys(e.target.value)}
                  className="w-1/2 border rounded px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  placeholder="Dia"
                  value={maternalBloodPressureDia}
                  onChange={(e) => setMaternalBloodPressureDia(e.target.value)}
                  className="w-1/2 border rounded px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <label className="block text-gray-700 font-medium mb-1">EFM Pattern</label>
              <select
                value={efmPattern}
                onChange={(e: any) => setEfmPattern(e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm font-medium"
              >
                <option value="reactive_reassuring">Reactive / Reassuring (Category I)</option>
                <option value="transient_bradycardia_self_resolved">Transient Bradycardia (Self-Resolved &lt; 2 min)</option>
                <option value="persistent_severe_bradycardia">Persistent Severe Bradycardia (&gt; 3 min - Stat CS)</option>
                <option value="tachycardia_post_terbutaline">Tachycardia Post-Terbutaline (Maternal/Fetal)</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={uterineRelaxationAdequate}
                  onChange={(e) => setUterineRelaxationAdequate(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span className="text-xs font-medium text-gray-800">
                  Uterine Relaxation Adequate on Palpation
                </span>
              </label>
            </div>
          </div>

          <div className="text-sm">
            <label className="block text-gray-700 font-medium mb-1">Clinical Observations & Comments</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Fetal position re-scanned, ultrasound confirms cephalic presentation..."
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Record Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
