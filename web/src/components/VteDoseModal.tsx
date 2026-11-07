import React, { useState } from 'react';
import { logMaternalVteDose, type MaternalVteDoseLogRecord } from '../api';

interface VteDoseModalProps {
  assessmentId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (log: MaternalVteDoseLogRecord) => void;
  defaultAgent?: string;
  defaultDose?: string;
}

export const VteDoseModal: React.FC<VteDoseModalProps> = ({
  assessmentId,
  isOpen,
  onClose,
  onSuccess,
  defaultAgent = 'Enoxaparin (Clexane)',
  defaultDose = '40 mg SC',
}) => {
  const [administeredAt, setAdministeredAt] = useState<string>(new Date().toISOString().slice(0, 16));
  const [agent, setAgent] = useState<string>(defaultAgent);
  const [dose, setDose] = useState<string>(defaultDose);
  const [route, setRoute] = useState<string>('subcutaneous');
  const [site, setSite] = useState<'abdomen_left' | 'abdomen_right' | 'thigh_left' | 'thigh_right' | 'upper_arm'>('abdomen_left');
  const [plateletCount, setPlateletCount] = useState<string>('240000');
  const [antiXaLevel, setAntiXaLevel] = useState<string>('');
  const [bleedingSignsObserved, setBleedingSignsObserved] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('Subcutaneous injection administered without hematoma. Patient instructed on 12-hour spinal/epidural window.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        administeredAt,
        agent,
        dose,
        route,
        site,
        plateletCount: plateletCount ? Number(plateletCount) : null,
        antiXaLevel: antiXaLevel ? Number(antiXaLevel) : null,
        bleedingSignsObserved,
        notes: notes || null,
      };

      const res = await logMaternalVteDose(assessmentId, payload);
      onSuccess(res.log);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record LMWH dose administration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-2 mb-4">
          <h3 className="font-bold text-rose-950 text-base flex items-center gap-2">
            <span>💉</span> Record LMWH Dose & Start Neuraxial Countdown
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
            ⏰ <strong>Neuraxial Anesthesia Safety Notice:</strong> Administering this dose starts a mandatory
            <strong> 12-hour blackout countdown</strong> during which spinal anesthesia, epidural catheter insertion, or epidural catheter removal is contraindicated to prevent epidural hematoma.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Administration Datetime</label>
              <input
                type="datetime-local"
                value={administeredAt}
                onChange={(e) => setAdministeredAt(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">LMWH Agent</label>
              <input
                type="text"
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1 font-semibold text-gray-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Dose</label>
              <input
                type="text"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1 font-bold text-rose-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Route</label>
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="w-full text-xs border rounded p-1.5 mt-1"
              >
                <option value="subcutaneous">Subcutaneous (SC)</option>
                <option value="intravenous">Intravenous (IV)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Injection Site</label>
              <select
                value={site}
                onChange={(e) => setSite(e.target.value as any)}
                className="w-full text-xs border rounded p-1.5 mt-1"
              >
                <option value="abdomen_left">Abdomen Left</option>
                <option value="abdomen_right">Abdomen Right</option>
                <option value="thigh_left">Thigh Left</option>
                <option value="thigh_right">Thigh Right</option>
                <option value="upper_arm">Upper Arm</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Platelet Count (/µL)</label>
              <input
                type="number"
                value={plateletCount}
                onChange={(e) => setPlateletCount(e.target.value)}
                className="w-full text-xs border rounded p-1.5 mt-1"
                placeholder="Check for HIT"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Anti-Xa Level (IU/mL)</label>
              <input
                type="number"
                step="0.05"
                value={antiXaLevel}
                onChange={(e) => setAntiXaLevel(e.target.value)}
                className="w-full text-xs border rounded p-1.5 mt-1"
                placeholder="Optional monitoring"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
            <input
              type="checkbox"
              id="bleedingCheck"
              checked={bleedingSignsObserved}
              onChange={(e) => setBleedingSignsObserved(e.target.checked)}
              className="rounded text-rose-600"
            />
            <label htmlFor="bleedingCheck" className="text-xs font-medium text-gray-800 cursor-pointer">
              Any petechiae, injection site bruising, hematuria, or lochia excess observed?
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Nurse Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs border rounded p-1.5 mt-1"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-rose-700 text-white rounded text-xs font-bold hover:bg-rose-800 shadow"
            >
              {loading ? 'Logging...' : 'Confirm Dose Administration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
