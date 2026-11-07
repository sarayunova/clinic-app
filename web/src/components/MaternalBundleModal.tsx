import React, { useState } from 'react';
import { logMaternalSepsisBundle, type MaternalBundleRecord } from '../api';

interface MaternalBundleModalProps {
  sepsisAssessmentId: number;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (bundle: MaternalBundleRecord) => void;
}

export const MaternalBundleModal: React.FC<MaternalBundleModalProps> = ({
  sepsisAssessmentId,
  patientName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );

  const [bloodCulturesDrawn, setBloodCulturesDrawn] = useState<boolean>(true);
  const [bloodCulturesDrawnTime, setBloodCulturesDrawnTime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );

  const [ivAntibioticsGiven, setIvAntibioticsGiven] = useState<boolean>(true);
  const [antibioticNameRegimen, setAntibioticNameRegimen] = useState<string>(
    'Piperacillin-Tazobactam 4.5g IV + Clindamycin 900mg IV'
  );
  const [ivAntibioticsTime, setIvAntibioticsTime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [antibioticWithin60m, setAntibioticWithin60m] = useState<boolean>(true);

  const [fluidBolus30mlPerKgGiven, setFluidBolus30mlPerKgGiven] = useState<boolean>(true);
  const [fluidBolusVolumeMl, setFluidBolusVolumeMl] = useState<string>('2000');

  const [norepinephrineVasopressorActive, setNorepinephrineVasopressorActive] = useState<boolean>(false);
  const [vasopressorDoseMcgMin, setVasopressorDoseMcgMin] = useState<string>('');

  const [repeatLactateMmolL, setRepeatLactateMmolL] = useState<string>('1.9');
  const [targetMapAchievedGte65, setTargetMapAchievedGte65] = useState<boolean>(true);
  const [urineOutputMlHr, setUrineOutputMlHr] = useState<string>('45');
  const [interventionsSummary, setInterventionsSummary] = useState<string>(
    '2x peripheral blood cultures drawn. Broad-spectrum empiric IV antibiotics infused within 35 minutes of triage. 2L crystalloid bolus administered; MAP stabilized at 68 mmHg.'
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await logMaternalSepsisBundle(sepsisAssessmentId, {
        logDatetime,
        bloodCulturesDrawn,
        bloodCulturesDrawnTime: bloodCulturesDrawn ? bloodCulturesDrawnTime : undefined,
        ivAntibioticsGiven,
        antibioticNameRegimen: ivAntibioticsGiven ? antibioticNameRegimen : undefined,
        ivAntibioticsTime: ivAntibioticsGiven ? ivAntibioticsTime : undefined,
        antibioticWithin60m,
        fluidBolus30mlPerKgGiven,
        fluidBolusVolumeMl: fluidBolusVolumeMl ? Number(fluidBolusVolumeMl) : undefined,
        norepinephrineVasopressorActive,
        vasopressorDoseMcgMin: vasopressorDoseMcgMin ? Number(vasopressorDoseMcgMin) : undefined,
        repeatLactateMmolL: repeatLactateMmolL ? Number(repeatLactateMmolL) : undefined,
        targetMapAchievedGte65,
        urineOutputMlHr: urineOutputMlHr ? Number(urineOutputMlHr) : undefined,
        interventionsSummary: interventionsSummary || undefined,
      });

      onSuccess(res.log);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record sepsis bundle log');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-800 via-pink-700 to-indigo-900 text-white p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <h2 className="text-xl font-bold tracking-tight">Hour-1 Sepsis Bundle Execution</h2>
            </div>
            <p className="text-rose-100 text-xs mt-1">
              Patient: <span className="font-semibold text-white">{patientName}</span> · FIGO / Surviving Sepsis Campaign Guidelines
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg p-2 text-sm transition"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Log Timestamp *
            </label>
            <input
              type="datetime-local"
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500"
              value={logDatetime}
              onChange={(e) => setLogDatetime(e.target.value)}
            />
          </div>

          {/* Blood Cultures & Antibiotics */}
          <div className="p-4 bg-slate-50 border rounded-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <span>🧫</span> 1. Cultures &amp; Empiric Antimicrobials (Target &lt; 60m)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 p-2.5 bg-white rounded-lg border cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={bloodCulturesDrawn}
                  onChange={(e) => setBloodCulturesDrawn(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-800">Blood Cultures Drawn (Prior to Abx)</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 bg-white rounded-lg border cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={antibioticWithin60m}
                  onChange={(e) => setAntibioticWithin60m(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-800">Infused within 60 Mins of Recognition</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">IV Antimicrobial Regimen</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                  placeholder="e.g. Piperacillin-Tazobactam 4.5g IV"
                  value={antibioticNameRegimen}
                  onChange={(e) => setAntibioticNameRegimen(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Antimicrobial Start Time</label>
                <input
                  type="datetime-local"
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                  value={ivAntibioticsTime}
                  onChange={(e) => setIvAntibioticsTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Fluids and Vasopressors */}
          <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
              <span>💧</span> 2. Fluid Resuscitation &amp; Hemodynamics
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 p-2.5 bg-white rounded-lg border cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={fluidBolus30mlPerKgGiven}
                  onChange={(e) => setFluidBolus30mlPerKgGiven(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-800">30 mL/kg Crystalloid Bolus Given</span>
              </label>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Fluid Volume Administered (mL)</label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  placeholder="e.g. 2000"
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                  value={fluidBolusVolumeMl}
                  onChange={(e) => setFluidBolusVolumeMl(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-2 p-2.5 bg-white rounded-lg border cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={norepinephrineVasopressorActive}
                  onChange={(e) => setNorepinephrineVasopressorActive(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-800">Norepinephrine Infusion Active</span>
              </label>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Vasopressor Dose (mcg/min)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="e.g. 8"
                  className="w-full border rounded-lg px-3 py-1.5 text-xs"
                  value={vasopressorDoseMcgMin}
                  onChange={(e) => setVasopressorDoseMcgMin(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Repeat Lactate and MAP Goal */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Repeat Lactate (mmol/L)</label>
              <input
                type="number"
                step="0.1"
                placeholder="Target clearance < 2.0"
                className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-slate-800"
                value={repeatLactateMmolL}
                onChange={(e) => setRepeatLactateMmolL(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Urine Output (mL/hr)</label>
              <input
                type="number"
                placeholder="Target > 30 mL/hr"
                className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-slate-800"
                value={urineOutputMlHr}
                onChange={(e) => setUrineOutputMlHr(e.target.value)}
              />
            </div>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 p-2.5 bg-slate-50 w-full rounded-lg border cursor-pointer hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={targetMapAchievedGte65}
                  onChange={(e) => setTargetMapAchievedGte65(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-xs font-bold text-slate-800">MAP ≥ 65 mmHg Achieved</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Clinical Summary of Interventions</label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={interventionsSummary}
              onChange={(e) => setInterventionsSummary(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border rounded-lg text-sm text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-gradient-to-r from-rose-700 to-indigo-700 hover:from-rose-800 hover:to-indigo-800 text-white font-bold rounded-lg text-sm shadow-md transition disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Log Bundle Execution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
