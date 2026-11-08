import React, { useState } from 'react';
import { addNeonatalEaTefFlowsheet } from '../api';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalEaTefFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [hoursFromAdmission, setHoursFromAdmission] = useState<number>(2.0);
  const [replogleSalineFlushed, setReplogleSalineFlushed] = useState<boolean>(true);
  const [replogleAspirateVolumeMl, setReplogleAspirateVolumeMl] = useState<string>('8.0');
  const [replogleAspirateCharacter, setReplogleAspirateCharacter] = useState<
    'clear_saliva' | 'frothy_mucus' | 'blood_tinged' | 'bilious_reflux'
  >('frothy_mucus');
  const [heartRate, setHeartRate] = useState<number>(142);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(44);
  const [oxygenSaturationPct, setOxygenSaturationPct] = useState<number>(98);
  const [abdominalGirthCm, setAbdominalGirthCm] = useState<string>('28.5');
  const [notes, setNotes] = useState<string>('Continuous Replogle sump 25 mmHg suction patent, flushed with 1 mL sterile saline');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addNeonatalEaTefFlowsheet(episodeId, {
        logDatetime,
        hoursFromAdmission: Number(hoursFromAdmission),
        replogleSalineFlushed,
        replogleAspirateVolumeMl: replogleAspirateVolumeMl ? parseFloat(replogleAspirateVolumeMl) : null,
        replogleAspirateCharacter,
        heartRate: Number(heartRate),
        respiratoryRate: Number(respiratoryRate),
        oxygenSaturationPct: Number(oxygenSaturationPct),
        abdominalGirthCm: abdominalGirthCm ? parseFloat(abdominalGirthCm) : null,
        notes: notes || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record Replogle flowsheet log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-cyan-700 text-white rounded-t-lg">
          <div>
            <h3 className="font-bold text-lg">Log Replogle Sump & Airway Status</h3>
            <p className="text-xs text-cyan-100">Hourly / Q2H Continuous Decompression Monitor</p>
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">Hours From Admission</label>
              <input
                type="number"
                step="0.5"
                value={hoursFromAdmission}
                onChange={(e) => setHoursFromAdmission(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="0"
                max="720"
                required
              />
            </div>
          </div>

          <div className="p-3 bg-cyan-50 rounded border border-cyan-200 space-y-3">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={replogleSalineFlushed}
                onChange={(e) => setReplogleSalineFlushed(e.target.checked)}
                className="rounded text-cyan-600"
              />
              Replogle Saline Sump Lumen Flushed (0.5 - 1.0 mL)
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Aspirate Volume (mL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={replogleAspirateVolumeMl}
                  onChange={(e) => setReplogleAspirateVolumeMl(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm bg-white"
                  placeholder="e.g. 5.0"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Aspirate Character</label>
                <select
                  value={replogleAspirateCharacter}
                  onChange={(e) => setReplogleAspirateCharacter(e.target.value as any)}
                  className="w-full border rounded px-3 py-1.5 text-sm bg-white"
                >
                  <option value="clear_saliva">Clear Saliva</option>
                  <option value="frothy_mucus">Frothy Mucus</option>
                  <option value="blood_tinged">Blood-tinged</option>
                  <option value="bilious_reflux">Bilious Reflux (Fistula Reflux)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Heart Rate (bpm)</label>
              <input
                type="number"
                value={heartRate}
                onChange={(e) => setHeartRate(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="30"
                max="250"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Resp Rate (/min)</label>
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
            <label className="block text-xs font-semibold text-gray-700 mb-1">Abdominal Girth (cm)</label>
            <input
              type="number"
              step="0.5"
              value={abdominalGirthCm}
              onChange={(e) => setAbdominalGirthCm(e.target.value)}
              className="w-full border rounded px-3 py-1.5 text-sm"
              placeholder="e.g. 28.5"
            />
            <span className="text-[11px] text-gray-500">Monitor for acute gastric distension</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nurse / Clinician Observations</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded px-3 py-1.5 text-sm"
              placeholder="Suction vacuum integrity, secretions..."
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
              className="px-5 py-2 bg-cyan-700 text-white rounded text-sm font-semibold hover:bg-cyan-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
