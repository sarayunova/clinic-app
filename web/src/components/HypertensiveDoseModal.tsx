import React, { useState, useMemo } from 'react';
import { logObstetricHypertensiveDose, type ObstetricHypertensiveDoseRecord } from '../api';
import {
  getNextHypertensiveStep,
  calculateMap,
} from '../obstetricHypertensionEngine';

interface HypertensiveDoseModalProps {
  crisisId: number;
  patientId: number;
  initialMap: number;
  agent: 'labetalol' | 'hydralazine' | 'nifedipine';
  defaultStepNumber?: number;
  cumulativeLabetalolMg?: number;
  cumulativeHydralazineMg?: number;
  cumulativeNifedipineMg?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (log: ObstetricHypertensiveDoseRecord, isControlled: boolean) => void;
}

export const HypertensiveDoseModal: React.FC<HypertensiveDoseModalProps> = ({
  crisisId,
  patientId,
  initialMap,
  agent,
  defaultStepNumber = 1,
  cumulativeLabetalolMg = 0,
  cumulativeHydralazineMg = 0,
  cumulativeNifedipineMg = 0,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState<string>(new Date().toISOString().slice(0, 16));
  const [stepNumber, setStepNumber] = useState<string>(String(defaultStepNumber));
  const [sbp, setSbp] = useState<string>('162');
  const [dbp, setDbp] = useState<string>('110');
  const [fetalHeartRate, setFetalHeartRate] = useState<string>('142');
  const [maternalSymptoms, setMaternalSymptoms] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Compute recommendation
  const recommendation = useMemo(() => {
    const sbpNum = parseInt(sbp, 10) || 160;
    const dbpNum = parseInt(dbp, 10) || 100;

    return getNextHypertensiveStep({
      agent,
      currentStep: parseInt(stepNumber, 10) || 1,
      currentSbp: sbpNum,
      currentDbp: dbpNum,
      initialMap,
      cumulativeLabetalolMg,
      cumulativeHydralazineMg,
      cumulativeNifedipineMg,
    });
  }, [
    agent,
    stepNumber,
    sbp,
    dbp,
    initialMap,
    cumulativeLabetalolMg,
    cumulativeHydralazineMg,
    cumulativeNifedipineMg,
  ]);

  const [medicationAdministered, setMedicationAdministered] = useState<string>(recommendation.nextMedication);
  const [doseValue, setDoseValue] = useState<string>(String(recommendation.nextDoseValue));
  const [route, setRoute] = useState<string>(recommendation.route);

  // Sync state if step changes
  React.useEffect(() => {
    setMedicationAdministered(recommendation.nextMedication);
    setDoseValue(String(recommendation.nextDoseValue));
    setRoute(recommendation.route);
  }, [recommendation]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await logObstetricHypertensiveDose(crisisId, {
        logDatetime,
        stepNumber: parseInt(stepNumber, 10) || 1,
        sbp: parseInt(sbp, 10),
        dbp: parseInt(dbp, 10),
        medicationAdministered,
        doseValue: parseFloat(doseValue) || 0,
        doseUnit: 'mg',
        route,
        fetalHeartRate: fetalHeartRate ? parseInt(fetalHeartRate, 10) : undefined,
        maternalSymptoms: maternalSymptoms || undefined,
        notes: notes || undefined,
      });

      onSuccess(res.log, res.isControlled);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record dose administration');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-800 px-6 py-4 text-white flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>💊</span> ACOG Rapid Antihypertensive Dose Administration
            </h2>
            <p className="text-red-100 text-xs mt-0.5">
              Protocol: <span className="font-semibold uppercase">{agent}</span> | Step #{stepNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
              {error}
            </div>
          )}

          {/* Vitals Checkpoint */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
              1. Blood Pressure & Vital Checkpoint Prior to Dose
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="datetime-local"
                  value={logDatetime}
                  onChange={(e) => setLogDatetime(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Step Number</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={stepNumber}
                  onChange={(e) => setStepNumber(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">SBP / DBP (mmHg)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="60"
                    max="280"
                    value={sbp}
                    onChange={(e) => setSbp(e.target.value)}
                    className="w-1/2 text-xs border rounded px-1.5 py-1 bg-white font-bold text-rose-800"
                    required
                  />
                  <span>/</span>
                  <input
                    type="number"
                    min="30"
                    max="180"
                    value={dbp}
                    onChange={(e) => setDbp(e.target.value)}
                    className="w-1/2 text-xs border rounded px-1.5 py-1 bg-white font-bold text-rose-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fetal HR (bpm)</label>
                <input
                  type="number"
                  min="50"
                  max="220"
                  value={fetalHeartRate}
                  onChange={(e) => setFetalHeartRate(e.target.value)}
                  placeholder="e.g. 140"
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600 pt-1">
              <span>
                Current MAP: <strong className="text-gray-900">{recommendation.currentMap} mmHg</strong>
              </span>
              <span>
                Drop from Initial: <strong className="text-gray-900">{recommendation.mapDropPercent}%</strong>
              </span>
            </div>

            {recommendation.placentalHypoperfusionRisk && (
              <div className="p-2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-xs font-medium">
                ⚠️ Excessive Blood Pressure Drop Detected (&gt;25% drop or SBP &lt; 120): Monitor for fetal distress / placental hypoperfusion.
              </div>
            )}
          </div>

          {/* Algorithm Next Dose Recommendation */}
          <div
            className={`border rounded-xl p-4 space-y-3 ${
              recommendation.isControlled ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50/70 border-rose-200'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs uppercase font-bold text-gray-700">
                ACOG PB 222 Decision Engine Recommendation
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                  recommendation.isControlled
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-rose-200 text-rose-900'
                }`}
              >
                {recommendation.isControlled ? 'BP Controlled' : `Step ${stepNumber} Action`}
              </span>
            </div>

            <p className="text-xs text-gray-800 font-medium">{recommendation.advisory}</p>

            {!recommendation.isControlled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Medication</label>
                  <input
                    type="text"
                    value={medicationAdministered}
                    onChange={(e) => setMedicationAdministered(e.target.value)}
                    className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Dose (mg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={doseValue}
                    onChange={(e) => setDoseValue(e.target.value)}
                    className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Route</label>
                  <input
                    type="text"
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          {/* Maternal Symptoms */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Maternal Neurological / Preeclampsia Symptoms</label>
            <input
              type="text"
              value={maternalSymptoms}
              onChange={(e) => setMaternalSymptoms(e.target.value)}
              placeholder="e.g. Frontal headache resolving; no scotomata; deep tendon reflexes 2+."
              className="w-full text-xs border rounded-lg px-3 py-1.5 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nursing Observations / Plan</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Infused over 2 minutes; repeat blood pressure scheduled in 20 minutes."
              className="w-full text-xs border rounded-lg px-3 py-1.5"
            />
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-xs text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white rounded-lg text-xs font-semibold shadow-md disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Log Dose & Recheck Timer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
