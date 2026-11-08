import React, { useState } from 'react';
import { addPediatricEmpyemaFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricEmpyemaFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromDrainPlacement, setHoursFromDrainPlacement] = useState<number>(12.0);
  const [chestDrainOutputMl, setChestDrainOutputMl] = useState<number>(85.0);
  const [drainEffluentAppearance, setDrainEffluentAppearance] = useState<
    'purulent_thick_pus' | 'turbid_serosanguinous' | 'serous_straw_colored' | 'no_output_blocked'
  >('turbid_serosanguinous');
  const [airLeakGrade, setAirLeakGrade] = useState<'none' | 'cough_only' | 'expiratory' | 'continuous'>('none');
  const [temperatureCelsius, setTemperatureCelsius] = useState<number>(37.6);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(26);
  const [oxygenSaturationPct, setOxygenSaturationPct] = useState<number>(97);
  const [fibrinolyticInstilledDwellCompleted, setFibrinolyticInstilledDwellCompleted] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('Dose #2 tPA/DNase completed, clamped 2h, brisk drainage unclamped to -15 cmH2O');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addPediatricEmpyemaFlowsheet(episodeId, {
        logDatetime,
        hoursFromDrainPlacement: Number(hoursFromDrainPlacement),
        chestDrainOutputMl: Number(chestDrainOutputMl),
        drainEffluentAppearance,
        airLeakGrade,
        temperatureCelsius: Number(temperatureCelsius),
        respiratoryRate: Number(respiratoryRate),
        oxygenSaturationPct: Number(oxygenSaturationPct),
        fibrinolyticInstilledDwellCompleted,
        notes: notes || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record empyema flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-indigo-700 text-white rounded-t-lg">
          <div>
            <h3 className="font-bold text-lg">Log Chest Drain &amp; Fibrinolytic Dwell</h3>
            <p className="text-xs text-indigo-100">Intrapleural Therapy &amp; Effluent Surveillance</p>
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">Hours From Drain</label>
              <input
                type="number"
                step="0.5"
                value={hoursFromDrainPlacement}
                onChange={(e) => setHoursFromDrainPlacement(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="0"
                max="720"
                required
              />
            </div>
          </div>

          <div className="p-3 bg-indigo-50 rounded border border-indigo-200 space-y-3">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={fibrinolyticInstilledDwellCompleted}
                onChange={(e) => setFibrinolyticInstilledDwellCompleted(e.target.checked)}
                className="rounded text-indigo-600"
              />
              tPA + DNase Instilled &amp; 2-Hour Clamp Dwell Completed
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Drain Output (mL)</label>
                <input
                  type="number"
                  step="1"
                  value={chestDrainOutputMl}
                  onChange={(e) => setChestDrainOutputMl(Number(e.target.value))}
                  className="w-full border rounded px-3 py-1.5 text-sm bg-white font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Effluent Appearance</label>
                <select
                  value={drainEffluentAppearance}
                  onChange={(e) => setDrainEffluentAppearance(e.target.value as any)}
                  className="w-full border rounded px-3 py-1.5 text-sm bg-white"
                >
                  <option value="purulent_thick_pus">Thick Purulent Pus</option>
                  <option value="turbid_serosanguinous">Turbid Serosanguinous</option>
                  <option value="serous_straw_colored">Clear Straw-colored</option>
                  <option value="no_output_blocked">No Output / Blocked</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                value={temperatureCelsius}
                onChange={(e) => setTemperatureCelsius(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="30"
                max="44"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Resp Rate</label>
              <input
                type="number"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="5"
                max="120"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">SpO2 (%)</label>
              <input
                type="number"
                value={oxygenSaturationPct}
                onChange={(e) => setOxygenSaturationPct(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="50"
                max="100"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Air Leak Grade</label>
            <select
              value={airLeakGrade}
              onChange={(e) => setAirLeakGrade(e.target.value as any)}
              className="w-full border rounded px-3 py-1.5 text-sm bg-white"
            >
              <option value="none">None (No bubbling)</option>
              <option value="cough_only">Cough Only (Small leak)</option>
              <option value="expiratory">Expiratory Leak</option>
              <option value="continuous">Continuous Leak (Bronchopleural Fistula Risk)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Clinical Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded px-3 py-1.5 text-sm"
              placeholder="Drain swing, pain during dwell, flush volume..."
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
              className="px-5 py-2 bg-indigo-700 text-white rounded text-sm font-semibold hover:bg-indigo-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
