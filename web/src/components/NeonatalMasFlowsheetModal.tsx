import React, { useState } from 'react';
import { addNeonatalMasFlowsheet } from '../api';
import { calculateOxygenationIndex } from '../neonatalMasEngine';

interface Props {
  episodeId: number;
  currentMap: number;
  currentFio2: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalMasFlowsheetModal: React.FC<Props> = ({
  episodeId,
  currentMap,
  currentFio2,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromAdmission, setHoursFromAdmission] = useState<number>(4);

  const [respiratoryRate, setRespiratoryRate] = useState<number>(64);
  const [heartRateBpm, setHeartRateBpm] = useState<number>(152);
  const [preDuctalSpo2, setPreDuctalSpo2] = useState<number>(94);
  const [postDuctalSpo2, setPostDuctalSpo2] = useState<number>(84);
  const [fio2Percent, setFio2Percent] = useState<number>(currentFio2 || 60);
  const [meanAirwayPressure, setMeanAirwayPressure] = useState<number>(currentMap || 12);

  const [pao2Mmhg, setPao2Mmhg] = useState<number | undefined>(52);
  const [paco2Mmhg, setPaco2Mmhg] = useState<number | undefined>(46);
  const [arterialPh, setArterialPh] = useState<number | undefined>(7.3);
  const [inoDosePpm, setInoDosePpm] = useState<number>(0);
  const [meanBloodPressure, setMeanBloodPressure] = useState<number>(44);
  const [chestTubeDrainage, setChestTubeDrainage] = useState<boolean>(false);
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const calculatedOi = calculateOxygenationIndex(meanAirwayPressure, fio2Percent, pao2Mmhg);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await addNeonatalMasFlowsheet(episodeId, {
        logDatetime,
        hoursFromAdmission,
        respiratoryRate,
        heartRateBpm,
        preDuctalSpo2Percent: preDuctalSpo2,
        postDuctalSpo2Percent: postDuctalSpo2,
        fio2Percent,
        meanAirwayPressureCmh2o: meanAirwayPressure,
        pao2Mmhg: pao2Mmhg ?? null,
        paco2Mmhg: paco2Mmhg ?? null,
        arterialPh: arterialPh ?? null,
        inoDosePpm,
        meanBloodPressureMmhg: meanBloodPressure,
        chestTubeDrainageActive: chestTubeDrainage,
        notes: notes || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record flowsheet observation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-teal-50 rounded-t-xl">
          <div>
            <h3 className="font-bold text-teal-900 text-lg">Log MAS & Respiratory Flowsheet</h3>
            <p className="text-xs text-teal-700">Serial Oxygenation Index, Pre/Post Ductal SpO2 & Blood Gas</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">
            &times;
          </button>
        </div>

        {/* Live OI preview */}
        <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-xs flex justify-between items-center">
          <span className="font-semibold text-amber-900">Computed Oxygenation Index (OI):</span>
          <span className="text-sm font-bold text-amber-800">
            {calculatedOi !== null ? calculatedOi : 'Enter PaO2 to calculate'}
          </span>
          <span className="text-xs text-gray-600">
            Ductal SpO2 Diff: <strong className="text-rose-700">{Math.max(0, preDuctalSpo2 - postDuctalSpo2)}%</strong>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-sm">
          {error && <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Observation Datetime</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                className="w-full border rounded px-2.5 py-1.5 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Hours From Admission</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={hoursFromAdmission}
                onChange={(e) => setHoursFromAdmission(parseFloat(e.target.value))}
                className="w-full border rounded px-2.5 py-1.5 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Heart Rate (bpm)</label>
              <input
                type="number"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(parseInt(e.target.value))}
                className="w-full border rounded px-2 py-1 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Resp Rate (/min)</label>
              <input
                type="number"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(parseInt(e.target.value))}
                className="w-full border rounded px-2 py-1 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Mean BP (mmHg)</label>
              <input
                type="number"
                value={meanBloodPressure}
                onChange={(e) => setMeanBloodPressure(parseFloat(e.target.value))}
                className="w-full border rounded px-2 py-1 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded border">
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Pre-Ductal SpO2 (Right Hand %)</label>
              <input
                type="number"
                min="50"
                max="100"
                value={preDuctalSpo2}
                onChange={(e) => setPreDuctalSpo2(parseFloat(e.target.value))}
                className="w-full border rounded px-2 py-1 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Post-Ductal SpO2 (Foot %)</label>
              <input
                type="number"
                min="50"
                max="100"
                value={postDuctalSpo2}
                onChange={(e) => setPostDuctalSpo2(parseFloat(e.target.value))}
                className="w-full border rounded px-2 py-1 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">FiO2 (%)</label>
              <input
                type="number"
                min="21"
                max="100"
                value={fio2Percent}
                onChange={(e) => setFio2Percent(parseFloat(e.target.value))}
                className="w-full border rounded px-2 py-1 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">MAP (cmH2O)</label>
              <input
                type="number"
                step="0.5"
                min="4"
                max="35"
                value={meanAirwayPressure}
                onChange={(e) => setMeanAirwayPressure(parseFloat(e.target.value))}
                className="w-full border rounded px-2 py-1 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">iNO Dose (ppm)</label>
              <input
                type="number"
                min="0"
                max="40"
                value={inoDosePpm}
                onChange={(e) => setInoDosePpm(parseFloat(e.target.value))}
                className="w-full border rounded px-2 py-1 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded border">
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">PaO2 (mmHg)</label>
              <input
                type="number"
                placeholder="e.g. 52"
                value={pao2Mmhg ?? ''}
                onChange={(e) => setPao2Mmhg(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full border rounded px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">PaCO2 (mmHg)</label>
              <input
                type="number"
                placeholder="e.g. 46"
                value={paco2Mmhg ?? ''}
                onChange={(e) => setPaco2Mmhg(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full border rounded px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Arterial pH</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 7.30"
                value={arterialPh ?? ''}
                onChange={(e) => setArterialPh(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full border rounded px-2 py-1 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="masChestTube"
              checked={chestTubeDrainage}
              onChange={(e) => setChestTubeDrainage(e.target.checked)}
            />
            <label htmlFor="masChestTube" className="text-xs text-gray-700 font-medium">
              Intercostal Drain / Chest Tube In Situ Active
            </label>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1 text-xs">Clinical Notes</label>
            <input
              type="text"
              placeholder="e.g. Suctioned thick particulate secretions, blood pressure maintained on Dobutamine"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded px-2.5 py-1.5 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border rounded text-gray-600 hover:bg-gray-100 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Flowsheet Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
