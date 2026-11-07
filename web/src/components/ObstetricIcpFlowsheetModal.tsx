import React, { useState } from 'react';
import { logObstetricIcpFlowsheet } from '../api';

interface Props {
  episodeId: number;
  gestationWeeks?: number;
  currentUdcaDose?: number;
  onClose: () => void;
  onSuccess: (res: any) => void;
}

export const ObstetricIcpFlowsheetModal: React.FC<Props> = ({
  episodeId,
  gestationWeeks = 34.0,
  currentUdcaDose = 900,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [gaWeeks, setGaWeeks] = useState(gestationWeeks);
  const [currentTsba, setCurrentTsba] = useState(38.0);
  const [alt, setAlt] = useState<number | undefined>(72);
  const [ast, setAst] = useState<number | undefined>(55);
  const [pruritusScore, setPruritusScore] = useState(5);
  const [ctgResult, setCtgResult] = useState<'reactive' | 'equivocal' | 'non_reactive'>('reactive');
  const [fetalMovementsAdequate, setFetalMovementsAdequate] = useState(true);
  const [udcaDose, setUdcaDose] = useState(currentUdcaDose);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await logObstetricIcpFlowsheet(episodeId, {
        logDatetime,
        gestationWeeks: gaWeeks,
        currentTsbaUmolL: currentTsba,
        altUL: alt,
        astUL: ast,
        pruritusScore,
        ctgResult,
        fetalMovementsAdequate,
        udcaCurrentDoseMgDay: udcaDose,
        notes: notes || undefined,
      });
      onSuccess(res);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to log ICP surveillance entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-emerald-200">
        <div className="bg-gradient-to-r from-teal-700 to-emerald-700 px-6 py-4 text-white flex justify-between items-center">
          <div>
            <h2 className="text-md font-bold flex items-center gap-2">
              <span>📊</span> Log Serial Bile Acids & CTG Checkpoint
            </h2>
            <p className="text-xs text-teal-100">
              Antenatal ICP Longitudinal Surveillance Flowsheet
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-teal-200 text-2xl font-semibold leading-none"
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
                Gestation Weeks
              </label>
              <input
                type="number"
                step="0.1"
                min="12"
                max="43"
                value={gaWeeks}
                onChange={(e) => setGaWeeks(parseFloat(e.target.value) || 34)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Fasting TSBA (umol/L) *
              </label>
              <input
                type="number"
                step="0.1"
                min="1.0"
                max="500.0"
                value={currentTsba}
                onChange={(e) => setCurrentTsba(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border border-teal-300 rounded px-2 py-1.5 font-bold text-teal-900 bg-teal-50"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ALT (U/L)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="2000"
                value={alt ?? ''}
                onChange={(e) => setAlt(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                AST (U/L)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="2000"
                value={ast ?? ''}
                onChange={(e) => setAst(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Pruritus Score (0-10)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={pruritusScore}
                onChange={(e) => setPruritusScore(parseInt(e.target.value) || 0)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                CTG Trace Evaluation
              </label>
              <select
                value={ctgResult}
                onChange={(e: any) => setCtgResult(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
              >
                <option value="reactive">Reactive (Normal)</option>
                <option value="equivocal">Equivocal (Suspicious)</option>
                <option value="non_reactive">Non-Reactive (Pathological)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                UDCA Dose (mg/day)
              </label>
              <input
                type="number"
                step="100"
                min="0"
                max="3000"
                value={udcaDose}
                onChange={(e) => setUdcaDose(parseInt(e.target.value) || 0)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                required
              />
            </div>
            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={fetalMovementsAdequate}
                  onChange={(e) => setFetalMovementsAdequate(e.target.checked)}
                  className="rounded text-teal-600"
                />
                <span>Adequate Fetal Movements (DFKC)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Surveillance Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
              placeholder="e.g. Mild itching persistent, reassuring fetal heart rate..."
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
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded text-sm font-semibold shadow disabled:opacity-50"
            >
              {submitting ? 'Logging...' : 'Save Checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
