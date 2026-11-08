import React, { useState } from 'react';
import { addObstetricUterineInversionFlowsheet } from '../api';
import { calculateObstetricShockIndex } from '../obstetricUterineInversionEngine';

interface Props {
  episodeId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricUterineInversionFlowsheetModal: React.FC<Props> = ({
  episodeId,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [minutesFromInversion, setMinutesFromInversion] = useState<number>(15);

  const [systolicBp, setSystolicBp] = useState<number>(95);
  const [diastolicBp, setDiastolicBp] = useState<number>(58);
  const [heartRateBpm, setHeartRateBpm] = useState<number>(88);
  const [uterineTone, setUterineTone] = useState<'firm_well_contracted' | 'boggy_hypotonic' | 'relaxing_re_inversion_risk'>('firm_well_contracted');

  const [bimanualCompression, setBimanualCompression] = useState<boolean>(true);
  const [oxytocinInfusion, setOxytocinInfusion] = useState<boolean>(true);
  const [ongoingBloodLoss, setOngoingBloodLoss] = useState<number>(50);
  const [urineOutput, setUrineOutput] = useState<number | undefined>(45);
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const currentSi = calculateObstetricShockIndex(heartRateBpm, systolicBp);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await addObstetricUterineInversionFlowsheet(episodeId, {
        logDatetime,
        minutesFromInversion,
        systolicBp,
        diastolicBp,
        heartRateBpm,
        uterineTone,
        bimanualCompressionActive: bimanualCompression,
        oxytocinInfusionRunning: oxytocinInfusion,
        estimatedOngoingBloodLossMl: ongoingBloodLoss,
        urineOutputMlHr: urineOutput ?? null,
        notes: notes || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record inversion flowsheet checkpoint');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-rose-50 rounded-t-xl">
          <div>
            <h3 className="font-bold text-rose-950 text-lg">Log Uterine Inversion Checkpoint</h3>
            <p className="text-xs text-rose-700">Serial Shock Index, Hemodynamics, Myometrial Tone & Blood Loss</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">
            &times;
          </button>
        </div>

        {/* Live Shock Index Banner */}
        <div className="px-6 py-2.5 bg-rose-100/60 border-b border-rose-200 text-xs flex justify-between items-center">
          <span className="font-semibold text-rose-950">Current Shock Index (HR/SBP):</span>
          <span className="text-sm font-bold text-rose-800">{currentSi}</span>
          <span className="text-xs text-gray-700">
            Tone: <strong className="capitalize">{uterineTone.replace(/_/g, ' ')}</strong>
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
              <label className="block text-gray-700 font-medium mb-1 text-xs">Minutes From Inversion</label>
              <input
                type="number"
                min="0"
                max="1440"
                value={minutesFromInversion}
                onChange={(e) => setMinutesFromInversion(parseInt(e.target.value))}
                className="w-full border rounded px-2.5 py-1.5 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Systolic BP (mmHg)</label>
              <input
                type="number"
                min="30"
                max="250"
                value={systolicBp}
                onChange={(e) => setSystolicBp(parseInt(e.target.value))}
                className="w-full border rounded px-2 py-1 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Diastolic BP (mmHg)</label>
              <input
                type="number"
                min="10"
                max="160"
                value={diastolicBp}
                onChange={(e) => setDiastolicBp(parseInt(e.target.value))}
                className="w-full border rounded px-2 py-1 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Heart Rate (bpm)</label>
              <input
                type="number"
                min="30"
                max="220"
                value={heartRateBpm}
                onChange={(e) => setHeartRateBpm(parseInt(e.target.value))}
                className="w-full border rounded px-2 py-1 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded border">
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Uterine Tone</label>
              <select
                value={uterineTone}
                onChange={(e) => setUterineTone(e.target.value as any)}
                className="w-full border rounded px-2 py-1 text-xs font-semibold"
              >
                <option value="firm_well_contracted">Firm & Well-Contracted</option>
                <option value="boggy_hypotonic">Boggy / Hypotonic (Atony)</option>
                <option value="relaxing_re_inversion_risk">Relaxing (Re-Inversion Risk)</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Ongoing Loss (mL)</label>
              <input
                type="number"
                min="0"
                max="5000"
                value={ongoingBloodLoss}
                onChange={(e) => setOngoingBloodLoss(parseFloat(e.target.value))}
                className="w-full border rounded px-2 py-1 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={bimanualCompression}
                  onChange={(e) => setBimanualCompression(e.target.checked)}
                />
                <span>Bimanual Compression Active</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={oxytocinInfusion}
                  onChange={(e) => setOxytocinInfusion(e.target.checked)}
                />
                <span>High-Dose Oxytocin Infusion</span>
              </label>
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Urine Output (mL/hr)</label>
              <input
                type="number"
                min="0"
                max="1000"
                placeholder="e.g. 45"
                value={urineOutput ?? ''}
                onChange={(e) => setUrineOutput(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full border rounded px-2 py-1 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1 text-xs">Clinical Observation Notes</label>
            <input
              type="text"
              placeholder="e.g. Fundus firm above umbilicus, no bleeding, blood pressure recovering"
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
              className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded text-xs font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Flowsheet Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
