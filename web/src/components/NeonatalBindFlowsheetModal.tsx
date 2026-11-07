import React, { useState } from 'react';
import { logNeonatalBindFlowsheet } from '../api';

interface Props {
  episodeId: number;
  onClose: () => void;
  onSuccess: (res: any) => void;
}

export const NeonatalBindFlowsheetModal: React.FC<Props> = ({
  episodeId,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [hoursFromAdmission, setHoursFromAdmission] = useState(2);
  const [mentalStatusScore, setMentalStatusScore] = useState(0);
  const [muscleToneScore, setMuscleToneScore] = useState(0);
  const [cryScore, setCryScore] = useState(0);
  const [tsbMgDl, setTsbMgDl] = useState<number | undefined>(undefined);
  const [phototherapyType, setPhototherapyType] = useState('double_surface_led');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const totalScore = mentalStatusScore + muscleToneScore + cryScore;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await logNeonatalBindFlowsheet(episodeId, {
        logDatetime,
        hoursFromAdmission,
        mentalStatusScore,
        muscleToneScore,
        cryScore,
        tsbMgDl,
        phototherapyType,
        notes: notes || undefined,
      });
      onSuccess(res);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to log serial BIND entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-yellow-200">
        <div className="bg-gradient-to-r from-amber-600 to-yellow-600 px-6 py-4 text-white flex justify-between items-center">
          <div>
            <h2 className="text-md font-bold flex items-center gap-2">
              <span>⏱️</span> Log Serial BIND & Bilirubin Checkpoint
            </h2>
            <p className="text-xs text-yellow-100">
              Bedside Acute Bilirubin Encephalopathy Surveillance Flowsheet
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-yellow-200 text-2xl font-semibold leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Log Datetime
              </label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Hours on Protocol
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="720"
                value={hoursFromAdmission}
                onChange={(e) => setHoursFromAdmission(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                required
              />
            </div>
          </div>

          <div className="p-3 bg-amber-50 rounded border border-amber-200 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-amber-900 uppercase">
                BIND Score Assessment (0-3 each)
              </span>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-white text-amber-900 border border-amber-300">
                Score: {totalScore}/9
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600">Mental Status</label>
                <select
                  value={mentalStatusScore}
                  onChange={(e) => setMentalStatusScore(parseInt(e.target.value))}
                  className="w-full text-xs border rounded p-1 bg-white"
                >
                  <option value={0}>0: Normal</option>
                  <option value={1}>1: Sleepy</option>
                  <option value={2}>2: Lethargic</option>
                  <option value={3}>3: Coma/Seizure</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600">Muscle Tone</label>
                <select
                  value={muscleToneScore}
                  onChange={(e) => setMuscleToneScore(parseInt(e.target.value))}
                  className="w-full text-xs border rounded p-1 bg-white"
                >
                  <option value={0}>0: Normal</option>
                  <option value={1}>1: Mild Hypo</option>
                  <option value={2}>2: Hyper/Hypo</option>
                  <option value={3}>3: Retrocollis</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600">Cry Quality</label>
                <select
                  value={cryScore}
                  onChange={(e) => setCryScore(parseInt(e.target.value))}
                  className="w-full text-xs border rounded p-1 bg-white"
                >
                  <option value={0}>0: Normal</option>
                  <option value={1}>1: High-pitch</option>
                  <option value={2}>2: Shrill</option>
                  <option value={3}>3: Silent/Weak</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Repeat TSB (mg/dL)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="50"
                value={tsbMgDl ?? ''}
                onChange={(e) => setTsbMgDl(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Phototherapy Modality
              </label>
              <select
                value={phototherapyType}
                onChange={(e) => setPhototherapyType(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
              >
                <option value="none">None / Off</option>
                <option value="single_surface_led">Single Surface Overhead LED</option>
                <option value="double_surface_led">Double Surface Intensive LED</option>
                <option value="biliblanket_overhead">Biliblanket + Overhead Multi-Bank</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Bedside Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
              placeholder="e.g. Sucking reflex improving, eye shields repositioned..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-semibold shadow disabled:opacity-50"
            >
              {submitting ? 'Logging...' : 'Save Flowsheet Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
