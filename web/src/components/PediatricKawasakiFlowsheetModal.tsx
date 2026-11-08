import React, { useState } from 'react';
import { addPediatricKawasakiFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricKawasakiFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromAdmission, setHoursFromAdmission] = useState<number>(6.0);
  const [temperatureCelsius, setTemperatureCelsius] = useState<number>(38.2);
  const [heartRate, setHeartRate] = useState<number>(128);
  const [bloodPressureSys, setBloodPressureSys] = useState<string>('95');
  const [bloodPressureDia, setBloodPressureDia] = useState<string>('58');
  const [ivigInfusionRunning, setIvigInfusionRunning] = useState<boolean>(true);
  const [aspirinDoseGivenMg, setAspirinDoseGivenMg] = useState<string>('125');
  const [rashAppearance, setRashAppearance] = useState<string>('Fading trunk erythema, no new lesions');
  const [extremityEdema, setExtremityEdema] = useState<string>('Mild dorsal hand edema improving');
  const [notes, setNotes] = useState<string>('IVIG 50% infused, vitals stable, no anaphylaxis');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await addPediatricKawasakiFlowsheet(episodeId, {
        logDatetime,
        hoursFromAdmission: Number(hoursFromAdmission),
        temperatureCelsius: Number(temperatureCelsius),
        heartRate: Number(heartRate),
        bloodPressureSys: bloodPressureSys ? Number(bloodPressureSys) : null,
        bloodPressureDia: bloodPressureDia ? Number(bloodPressureDia) : null,
        ivigInfusionRunning,
        aspirinDoseGivenMg: aspirinDoseGivenMg ? Number(aspirinDoseGivenMg) : null,
        rashAppearance: rashAppearance.trim() || null,
        extremityEdema: extremityEdema.trim() || null,
        notes: notes.trim() || null,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add flowsheet checkpoint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-gradient-to-r from-amber-600 to-rose-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🌡️</span>
            <h2 className="text-md font-bold">Log Kawasaki Vitals & Infusion Checkpoint</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-amber-200 text-2xl font-bold p-1 leading-none"
            type="button"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">Check Date/Time *</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Hours from Admission *</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={hoursFromAdmission}
                onChange={(e) => setHoursFromAdmission(Number(e.target.value))}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">Temperature (°C) *</label>
              <input
                type="number"
                step="0.1"
                min="34"
                max="43"
                value={temperatureCelsius}
                onChange={(e) => setTemperatureCelsius(Number(e.target.value))}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Heart Rate (bpm) *</label>
              <input
                type="number"
                min="40"
                max="250"
                value={heartRate}
                onChange={(e) => setHeartRate(Number(e.target.value))}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">BP Systolic (mmHg)</label>
              <input
                type="number"
                value={bloodPressureSys}
                onChange={(e) => setBloodPressureSys(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                placeholder="95"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">BP Diastolic (mmHg)</label>
              <input
                type="number"
                value={bloodPressureDia}
                onChange={(e) => setBloodPressureDia(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                placeholder="58"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center pt-5">
              <label className="flex items-center space-x-2 text-xs font-bold text-gray-800">
                <input
                  type="checkbox"
                  checked={ivigInfusionRunning}
                  onChange={(e) => setIvigInfusionRunning(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>IVIG Infusion Running</span>
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Aspirin Dose Given (mg)</label>
              <input
                type="number"
                value={aspirinDoseGivenMg}
                onChange={(e) => setAspirinDoseGivenMg(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                placeholder="e.g. 125"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Rash & Mucosa Evolution</label>
            <input
              type="text"
              value={rashAppearance}
              onChange={(e) => setRashAppearance(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              placeholder="e.g. Fading maculopapular rash, lips moistening"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Extremity & Edema Notes</label>
            <input
              type="text"
              value={extremityEdema}
              onChange={(e) => setExtremityEdema(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              placeholder="e.g. Resolving induration, no desquamation yet"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-amber-700 text-white rounded-lg text-sm font-semibold hover:bg-amber-800 disabled:opacity-50"
            >
              {submitting ? 'Logging...' : 'Log Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
