import React, { useState } from 'react';
import { addNeonatalSghFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalSghFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromBirth, setHoursFromBirth] = useState<number>(4.0);
  const [headCircumferenceCm, setHeadCircumferenceCm] = useState<number>(35.5);
  const [bloodPressureSys, setBloodPressureSys] = useState<string>('55');
  const [bloodPressureDia, setBloodPressureDia] = useState<string>('30');
  const [heartRate, setHeartRate] = useState<number>(160);
  const [capillaryRefillSeconds, setCapillaryRefillSeconds] = useState<string>('3.5');
  const [hematocritPct, setHematocritPct] = useState<string>('32');
  const [bloodProductsTransfused, setBloodProductsTransfused] = useState<string>('PRBC 35 mL + FFP 35 mL');
  const [notes, setNotes] = useState<string>('Ongoing hourly HC check. Swelling stable.');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await addNeonatalSghFlowsheet(episodeId, {
        logDatetime,
        hoursFromBirth: Number(hoursFromBirth),
        headCircumferenceCm: Number(headCircumferenceCm),
        bloodPressureSys: bloodPressureSys ? Number(bloodPressureSys) : null,
        bloodPressureDia: bloodPressureDia ? Number(bloodPressureDia) : null,
        heartRate: Number(heartRate),
        capillaryRefillSeconds: capillaryRefillSeconds ? Number(capillaryRefillSeconds) : null,
        hematocritPct: hematocritPct ? Number(hematocritPct) : null,
        bloodProductsTransfused: bloodProductsTransfused.trim() || null,
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
        <div className="bg-gradient-to-r from-red-700 to-rose-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📏</span>
            <h2 className="text-md font-bold">Log SGH Serial Checkpoint</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-rose-200 text-2xl font-bold p-1 leading-none"
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
              <label className="block text-xs font-medium text-gray-700">Hours from Birth *</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={hoursFromBirth}
                onChange={(e) => setHoursFromBirth(Number(e.target.value))}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">Head Circumference (cm) *</label>
              <input
                type="number"
                step="0.1"
                min="20"
                max="50"
                value={headCircumferenceCm}
                onChange={(e) => setHeadCircumferenceCm(Number(e.target.value))}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Heart Rate (bpm) *</label>
              <input
                type="number"
                min="30"
                max="250"
                value={heartRate}
                onChange={(e) => setHeartRate(Number(e.target.value))}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">BP Systolic</label>
              <input
                type="number"
                value={bloodPressureSys}
                onChange={(e) => setBloodPressureSys(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                placeholder="55"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">BP Diastolic</label>
              <input
                type="number"
                value={bloodPressureDia}
                onChange={(e) => setBloodPressureDia(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                placeholder="30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Cap Refill (s)</label>
              <input
                type="number"
                step="0.5"
                value={capillaryRefillSeconds}
                onChange={(e) => setCapillaryRefillSeconds(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                placeholder="3.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">Hematocrit (%)</label>
              <input
                type="number"
                step="0.1"
                value={hematocritPct}
                onChange={(e) => setHematocritPct(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                placeholder="32"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Blood Products Given</label>
              <input
                type="text"
                value={bloodProductsTransfused}
                onChange={(e) => setBloodProductsTransfused(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                placeholder="e.g. PRBC 20 mL/kg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Exam Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              placeholder="e.g. Swelling now stable, active perfusion improving"
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
              className="px-5 py-2 bg-red-700 text-white rounded-lg text-sm font-semibold hover:bg-red-800 disabled:opacity-50"
            >
              {submitting ? 'Logging...' : 'Log Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
