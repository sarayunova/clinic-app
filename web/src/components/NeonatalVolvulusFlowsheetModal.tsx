import React, { useState } from 'react';
import { addNeonatalVolvulusFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalVolvulusFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromOnset, setHoursFromOnset] = useState<number>(2.0);
  const [serumLactateMmolL, setSerumLactateMmolL] = useState<string>('2.2');
  const [heartRate, setHeartRate] = useState<number>(160);
  const [bloodPressureSys, setBloodPressureSys] = useState<string>('68');
  const [bloodPressureDia, setBloodPressureDia] = useState<string>('38');
  const [capillaryRefillSeconds, setCapillaryRefillSeconds] = useState<string>('2.5');
  const [ngTubeOutputMl, setNgTubeOutputMl] = useState<string>('15');
  const [ngAspirateAppearance, setNgAspirateAppearance] = useState<string>('Dark green bilious fluid');
  const [abdominalExamNotes, setAbdominalExamNotes] = useState<string>('Mild epigastric fullness, soft, no rebound tenderness');
  const [notes, setNotes] = useState<string>('Replogle to low continuous suction, IV fluid bolus running');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addNeonatalVolvulusFlowsheet(episodeId, {
        logDatetime,
        hoursFromOnset,
        serumLactateMmolL: serumLactateMmolL ? parseFloat(serumLactateMmolL) : null,
        heartRate,
        bloodPressureSys: bloodPressureSys ? parseInt(bloodPressureSys) : null,
        bloodPressureDia: bloodPressureDia ? parseInt(bloodPressureDia) : null,
        capillaryRefillSeconds: capillaryRefillSeconds ? parseFloat(capillaryRefillSeconds) : null,
        ngTubeOutputMl: ngTubeOutputMl ? parseFloat(ngTubeOutputMl) : null,
        ngAspirateAppearance: ngAspirateAppearance || null,
        abdominalExamNotes: abdominalExamNotes || null,
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
              <span className="p-1.5 bg-red-100 text-red-700 rounded-lg text-base">⏱️</span>
              Log Volvulus Clinical Checkpoint
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Serial Lactate, NG Tube Decompression & Perfusion Monitoring
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
              <label className="block text-gray-700 font-medium mb-1">Hours from Onset</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={hoursFromOnset}
                onChange={(e) => setHoursFromOnset(parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-gray-700 font-medium mb-1">Heart Rate (bpm)</label>
              <input
                type="number"
                min="30"
                max="250"
                value={heartRate}
                onChange={(e) => setHeartRate(parseInt(e.target.value) || 0)}
                className="w-full border rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">BP Sys (mmHg)</label>
              <input
                type="number"
                min="20"
                max="150"
                value={bloodPressureSys}
                onChange={(e) => setBloodPressureSys(e.target.value)}
                placeholder="e.g. 65"
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">BP Dia (mmHg)</label>
              <input
                type="number"
                min="10"
                max="100"
                value={bloodPressureDia}
                onChange={(e) => setBloodPressureDia(e.target.value)}
                placeholder="e.g. 35"
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-gray-700 font-medium mb-1">Serum Lactate (mmol/L)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="30.0"
                value={serumLactateMmolL}
                onChange={(e) => setSerumLactateMmolL(e.target.value)}
                placeholder="e.g. 2.2"
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">Capillary Refill (sec)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="15"
                value={capillaryRefillSeconds}
                onChange={(e) => setCapillaryRefillSeconds(e.target.value)}
                placeholder="e.g. 2.5"
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">NG Tube Output (mL)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={ngTubeOutputMl}
                onChange={(e) => setNgTubeOutputMl(e.target.value)}
                placeholder="e.g. 15"
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="text-sm">
            <label className="block text-gray-700 font-medium mb-1">NG Aspirate Appearance</label>
            <input
              type="text"
              value={ngAspirateAppearance}
              onChange={(e) => setNgAspirateAppearance(e.target.value)}
              placeholder="e.g. Dark green bilious, coffee-ground, blood-tinged..."
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>

          <div className="text-sm">
            <label className="block text-gray-700 font-medium mb-1">Abdominal Exam Findings</label>
            <input
              type="text"
              value={abdominalExamNotes}
              onChange={(e) => setAbdominalExamNotes(e.target.value)}
              placeholder="e.g. Soft, mild epigastric fullness, no erythema of abdominal wall"
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>

          <div className="text-sm">
            <label className="block text-gray-700 font-medium mb-1">Nursing & Clinical Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Replogle tube suction active, operating theater on standby..."
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
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Record Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
