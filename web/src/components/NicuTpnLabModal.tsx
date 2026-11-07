import React, { useState } from 'react';
import { logNicuTpnLab, type NicuTpnLabRecord } from '../api';

interface NicuTpnLabModalProps {
  prescriptionId: number;
  prescriptionCode: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lab: NicuTpnLabRecord) => void;
}

export const NicuTpnLabModal: React.FC<NicuTpnLabModalProps> = ({
  prescriptionId,
  prescriptionCode,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [monitoringDatetime, setMonitoringDatetime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState<string>('85');
  const [serumSodiumMeqL, setSerumSodiumMeqL] = useState<string>('138');
  const [serumPotassiumMeqL, setSerumPotassiumMeqL] = useState<string>('4.2');
  const [serumCalciumMgDl, setSerumCalciumMgDl] = useState<string>('9.0');
  const [serumTriglyceridesMgDl, setSerumTriglyceridesMgDl] = useState<string>('140');
  const [serumUreaMgDl, setSerumUreaMgDl] = useState<string>('24');
  const [serumCreatinineMgDl, setSerumCreatinineMgDl] = useState<string>('0.6');
  const [directBilirubinMgDl, setDirectBilirubinMgDl] = useState<string>('0.8');
  const [girAdjustedFlag, setGirAdjustedFlag] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await logNicuTpnLab(prescriptionId, {
        monitoringDatetime,
        bloodGlucoseMgDl: Number(bloodGlucoseMgDl),
        serumSodiumMeqL: serumSodiumMeqL ? Number(serumSodiumMeqL) : undefined,
        serumPotassiumMeqL: serumPotassiumMeqL ? Number(serumPotassiumMeqL) : undefined,
        serumCalciumMgDl: serumCalciumMgDl ? Number(serumCalciumMgDl) : undefined,
        serumTriglyceridesMgDl: serumTriglyceridesMgDl ? Number(serumTriglyceridesMgDl) : undefined,
        serumUreaMgDl: serumUreaMgDl ? Number(serumUreaMgDl) : undefined,
        serumCreatinineMgDl: serumCreatinineMgDl ? Number(serumCreatinineMgDl) : undefined,
        directBilirubinMgDl: directBilirubinMgDl ? Number(directBilirubinMgDl) : undefined,
        girAdjustedFlag,
        notes: notes.trim() || undefined,
      });

      onSuccess(res.lab);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to log TPN monitoring values');
    } finally {
      setLoading(false);
    }
  };

  const bgVal = Number(bloodGlucoseMgDl);
  const isHypo = bgVal > 0 && bgVal < 50;
  const isHyper = bgVal > 150;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="px-5 py-3.5 bg-gradient-to-r from-teal-700 to-cyan-800 text-white flex justify-between items-center">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              <span>🩸</span> Log Bedside TPN Glucose & Electrolytes
            </h3>
            <p className="text-xs text-teal-100">Prescription: {prescriptionCode}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl font-bold leading-none">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Observation Datetime</label>
            <input
              type="datetime-local"
              value={monitoringDatetime}
              onChange={e => setMonitoringDatetime(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-teal-500"
              required
            />
          </div>

          {/* Blood Glucose */}
          <div className="p-3 bg-teal-50/60 rounded-lg border border-teal-200">
            <label className="block text-xs font-bold text-teal-900 mb-1">
              Bedside Blood Glucose (mg/dL) *
            </label>
            <input
              type="number"
              step="1"
              min="10"
              max="800"
              value={bloodGlucoseMgDl}
              onChange={e => setBloodGlucoseMgDl(e.target.value)}
              className="w-full px-3 py-1.5 border border-teal-300 rounded text-base font-bold text-slate-900 focus:ring-2 focus:ring-teal-500"
              required
            />
            {isHypo && (
              <span className="block mt-1 text-xs text-rose-600 font-semibold">
                ⚠️ Hypoglycemia Alert (&lt;50 mg/dL): Increase GIR or administer 2 mL/kg 10% Dextrose bolus!
              </span>
            )}
            {isHyper && (
              <span className="block mt-1 text-xs text-amber-600 font-semibold">
                ⚠️ Hyperglycemia Alert (&gt;150 mg/dL): Consider reducing GIR or evaluating for neonatal sepsis/osmotic diuresis.
              </span>
            )}
          </div>

          {/* Serum Labs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-slate-600 mb-0.5">Sodium (mEq/L)</label>
              <input
                type="number"
                step="0.1"
                value={serumSodiumMeqL}
                onChange={e => setSerumSodiumMeqL(e.target.value)}
                className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-0.5">Potassium (mEq/L)</label>
              <input
                type="number"
                step="0.1"
                value={serumPotassiumMeqL}
                onChange={e => setSerumPotassiumMeqL(e.target.value)}
                className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-0.5">Total Calcium (mg/dL)</label>
              <input
                type="number"
                step="0.1"
                value={serumCalciumMgDl}
                onChange={e => setSerumCalciumMgDl(e.target.value)}
                className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-0.5">Triglycerides (mg/dL)</label>
              <input
                type="number"
                step="1"
                value={serumTriglyceridesMgDl}
                onChange={e => setSerumTriglyceridesMgDl(e.target.value)}
                className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-0.5">Urea (mg/dL)</label>
              <input
                type="number"
                step="1"
                value={serumUreaMgDl}
                onChange={e => setSerumUreaMgDl(e.target.value)}
                className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-0.5">Direct Bilirubin</label>
              <input
                type="number"
                step="0.1"
                value={directBilirubinMgDl}
                onChange={e => setDirectBilirubinMgDl(e.target.value)}
                className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
              />
            </div>
          </div>

          {/* GIR Adjustment checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={girAdjustedFlag}
                onChange={e => setGirAdjustedFlag(e.target.checked)}
                className="h-4 w-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
              />
              <span>GIR / Infusion Rate was adjusted in response to this reading</span>
            </label>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Notes / Interventions</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Infusion titrated from 3.2 mL/h to 3.5 mL/h"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-semibold shadow disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Lab Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
