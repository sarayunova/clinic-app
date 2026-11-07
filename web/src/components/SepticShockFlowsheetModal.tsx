import React, { useState, useMemo } from 'react';
import { logPediatricSepticShockFlowsheet, type PediatricSepticShockFlowsheetRecord } from '../api';
import { calculateVisScore } from '../pediatricSepticShockEngine';

interface SepticShockFlowsheetModalProps {
  episodeId: number;
  patientId: number;
  weightKg: number;
  currentTotalFluidMl: number;
  defaultMinutes?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (log: PediatricSepticShockFlowsheetRecord, visScore: number, newTotalFluidMlKg: number) => void;
}

export const SepticShockFlowsheetModal: React.FC<SepticShockFlowsheetModalProps> = ({
  episodeId,
  patientId,
  weightKg,
  currentTotalFluidMl,
  defaultMinutes = 15,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState<string>(new Date().toISOString().slice(0, 16));
  const [minutesFromRecognition, setMinutesFromRecognition] = useState<string>(String(defaultMinutes));
  const [heartRateBpm, setHeartRateBpm] = useState<string>('150');
  const [sbp, setSbp] = useState<string>('82');
  const [dbp, setDbp] = useState<string>('48');
  const [capillaryRefillSeconds, setCapillaryRefillSeconds] = useState<string>('2.5');
  const [mentalStatus, setMentalStatus] = useState<string>('alert');

  // Fluid bolus
  const [bolusFluidType, setBolusFluidType] = useState<string>('Plasma-Lyte');
  const [bolusFluidVolumeMl, setBolusFluidVolumeMl] = useState<string>('0');
  const [hepatomegalyChecked, setHepatomegalyChecked] = useState<boolean>(true);
  const [pulmonaryCracklesChecked, setPulmonaryCracklesChecked] = useState<boolean>(true);

  // Vasoactives (mcg/kg/min)
  const [dopamineMcgKgMin, setDopamineMcgKgMin] = useState<string>('0');
  const [dobutamineMcgKgMin, setDobutamineMcgKgMin] = useState<string>('0');
  const [epinephrineMcgKgMin, setEpinephrineMcgKgMin] = useState<string>('0.1');
  const [norepinephrineMcgKgMin, setNorepinephrineMcgKgMin] = useState<string>('0');
  const [milrinoneMcgKgMin, setMilrinoneMcgKgMin] = useState<string>('0');
  const [vasopressinUnitsKgMin, setVasopressinUnitsKgMin] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Computed VIS and MAP
  const calculations = useMemo(() => {
    const sbpNum = parseInt(sbp, 10) || 80;
    const dbpNum = parseInt(dbp, 10) || 50;
    const map = Math.round((dbpNum + (sbpNum - dbpNum) / 3) * 10) / 10;

    const vis = calculateVisScore({
      dopamineMcgKgMin: parseFloat(dopamineMcgKgMin) || 0,
      dobutamineMcgKgMin: parseFloat(dobutamineMcgKgMin) || 0,
      epinephrineMcgKgMin: parseFloat(epinephrineMcgKgMin) || 0,
      norepinephrineMcgKgMin: parseFloat(norepinephrineMcgKgMin) || 0,
      milrinoneMcgKgMin: parseFloat(milrinoneMcgKgMin) || 0,
      vasopressinUnitsKgMin: parseFloat(vasopressinUnitsKgMin) || 0,
    });

    const bolus = parseFloat(bolusFluidVolumeMl) || 0;
    const newTotal = currentTotalFluidMl + bolus;
    const newTotalMlKg = Math.round((newTotal / weightKg) * 10) / 10;

    return { map, vis, newTotal, newTotalMlKg };
  }, [
    sbp,
    dbp,
    dopamineMcgKgMin,
    dobutamineMcgKgMin,
    epinephrineMcgKgMin,
    norepinephrineMcgKgMin,
    milrinoneMcgKgMin,
    vasopressinUnitsKgMin,
    bolusFluidVolumeMl,
    currentTotalFluidMl,
    weightKg,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await logPediatricSepticShockFlowsheet(episodeId, {
        logDatetime,
        minutesFromRecognition: parseInt(minutesFromRecognition, 10) || 0,
        heartRateBpm: heartRateBpm ? parseInt(heartRateBpm, 10) : undefined,
        sbp: sbp ? parseInt(sbp, 10) : undefined,
        dbp: dbp ? parseInt(dbp, 10) : undefined,
        capillaryRefillSeconds: capillaryRefillSeconds ? parseFloat(capillaryRefillSeconds) : undefined,
        mentalStatus,
        bolusFluidType: bolusFluidVolumeMl && parseFloat(bolusFluidVolumeMl) > 0 ? bolusFluidType : undefined,
        bolusFluidVolumeMl: parseFloat(bolusFluidVolumeMl) || 0,
        dopamineMcgKgMin: parseFloat(dopamineMcgKgMin) || 0,
        dobutamineMcgKgMin: parseFloat(dobutamineMcgKgMin) || 0,
        epinephrineMcgKgMin: parseFloat(epinephrineMcgKgMin) || 0,
        norepinephrineMcgKgMin: parseFloat(norepinephrineMcgKgMin) || 0,
        milrinoneMcgKgMin: parseFloat(milrinoneMcgKgMin) || 0,
        vasopressinUnitsKgMin: parseFloat(vasopressinUnitsKgMin) || 0,
        hepatomegalyChecked,
        pulmonaryCracklesChecked,
        notes: notes || undefined,
      });

      onSuccess(res.log, res.visScore, res.newTotalFluidMlKg);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record septic shock flowsheet log');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-900 px-6 py-4 text-white flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>⏱️</span> Resuscitation Flowsheet & VIS Score Checkpoint
            </h2>
            <p className="text-blue-100 text-xs mt-0.5">
              Weight: {weightKg} kg | Current Fluids: {calculations.newTotalMlKg} mL/kg
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
              1. Hemodynamic Vital Signs & Perfusion
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
                <label className="block text-xs font-medium text-gray-700 mb-1">Minutes from Start</label>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={minutesFromRecognition}
                  onChange={(e) => setMinutesFromRecognition(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Heart Rate (bpm)</label>
                <input
                  type="number"
                  min="30"
                  max="280"
                  value={heartRateBpm}
                  onChange={(e) => setHeartRateBpm(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">BP (MAP)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="30"
                    max="240"
                    value={sbp}
                    onChange={(e) => setSbp(e.target.value)}
                    className="w-1/2 text-xs border rounded px-1.5 py-1 bg-white font-bold"
                  />
                  <span>/</span>
                  <input
                    type="number"
                    min="15"
                    max="160"
                    value={dbp}
                    onChange={(e) => setDbp(e.target.value)}
                    className="w-1/2 text-xs border rounded px-1.5 py-1 bg-white font-bold"
                  />
                </div>
                <span className="text-[10px] text-indigo-700 font-bold block mt-0.5">
                  MAP: {calculations.map} mmHg
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Capillary Refill (sec)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="15"
                  value={capillaryRefillSeconds}
                  onChange={(e) => setCapillaryRefillSeconds(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mental Status</label>
                <input
                  type="text"
                  value={mentalStatus}
                  onChange={(e) => setMentalStatus(e.target.value)}
                  placeholder="e.g. Improving alertness, responds to name"
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Fluid Bolus Given in this interval */}
          <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-blue-900 text-xs uppercase tracking-wider flex items-center justify-between">
              <span>2. Crystalloid Resuscitation & Safety Screen</span>
              <span className="text-xs font-bold text-blue-800">
                New Total: {calculations.newTotalMlKg} mL/kg
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Bolus Fluid Type</label>
                <select
                  value={bolusFluidType}
                  onChange={(e) => setBolusFluidType(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                >
                  <option value="Plasma-Lyte">Plasma-Lyte (Balanced)</option>
                  <option value="Normal Saline 0.9%">Normal Saline 0.9%</option>
                  <option value="Ringer Lactate">Ringer Lactate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Bolus Volume Administered (mL)
                </label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={bolusFluidVolumeMl}
                  onChange={(e) => setBolusFluidVolumeMl(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-2 p-2 bg-white border rounded text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={hepatomegalyChecked}
                  onChange={(e) => setHepatomegalyChecked(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Liver edge examined prior to bolus</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-white border rounded text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={pulmonaryCracklesChecked}
                  onChange={(e) => setPulmonaryCracklesChecked(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Lungs auscultated (no rales / crackles)</span>
              </label>
            </div>
          </div>

          {/* Vasoactive Inotrope Titration & VIS Score */}
          <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-indigo-900 text-xs uppercase tracking-wider">
                3. Continuous Vasoactive Infusions (mcg/kg/min)
              </h3>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-indigo-700 block">VIS Score</span>
                <span className="text-lg font-black text-indigo-900">{calculations.vis.visScore}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-white p-2 border rounded">
                <label className="block text-[11px] font-semibold text-gray-700">Epinephrine (×100)</label>
                <input
                  type="number"
                  step="0.02"
                  min="0"
                  max="2.0"
                  value={epinephrineMcgKgMin}
                  onChange={(e) => setEpinephrineMcgKgMin(e.target.value)}
                  className="w-full text-xs border rounded px-2 py-1 font-bold text-rose-800"
                />
              </div>

              <div className="bg-white p-2 border rounded">
                <label className="block text-[11px] font-semibold text-gray-700">Norepinephrine (×100)</label>
                <input
                  type="number"
                  step="0.02"
                  min="0"
                  max="2.0"
                  value={norepinephrineMcgKgMin}
                  onChange={(e) => setNorepinephrineMcgKgMin(e.target.value)}
                  className="w-full text-xs border rounded px-2 py-1 font-bold text-indigo-800"
                />
              </div>

              <div className="bg-white p-2 border rounded">
                <label className="block text-[11px] font-semibold text-gray-700">Dobutamine (×1)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="25"
                  value={dobutamineMcgKgMin}
                  onChange={(e) => setDobutamineMcgKgMin(e.target.value)}
                  className="w-full text-xs border rounded px-2 py-1"
                />
              </div>

              <div className="bg-white p-2 border rounded">
                <label className="block text-[11px] font-semibold text-gray-700">Dopamine (×1)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="25"
                  value={dopamineMcgKgMin}
                  onChange={(e) => setDopamineMcgKgMin(e.target.value)}
                  className="w-full text-xs border rounded px-2 py-1"
                />
              </div>

              <div className="bg-white p-2 border rounded">
                <label className="block text-[11px] font-semibold text-gray-700">Milrinone (×10)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1.5"
                  value={milrinoneMcgKgMin}
                  onChange={(e) => setMilrinoneMcgKgMin(e.target.value)}
                  className="w-full text-xs border rounded px-2 py-1"
                />
              </div>

              <div className="bg-white p-2 border rounded">
                <label className="block text-[11px] font-semibold text-gray-700">Vasopressin (U/kg/min ×10⁴)</label>
                <input
                  type="number"
                  step="0.0005"
                  min="0"
                  max="0.01"
                  value={vasopressinUnitsKgMin}
                  onChange={(e) => setVasopressinUnitsKgMin(e.target.value)}
                  className="w-full text-xs border rounded px-2 py-1"
                />
              </div>
            </div>

            <div
              className={`p-2.5 rounded-lg border text-xs ${
                calculations.vis.severityTier === 'severe_critical'
                  ? 'bg-rose-100 border-rose-300 text-rose-900'
                  : calculations.vis.severityTier === 'moderate'
                  ? 'bg-amber-100 border-amber-300 text-amber-900'
                  : 'bg-indigo-100/70 border-indigo-200 text-indigo-900'
              }`}
            >
              <div className="font-bold">{calculations.vis.tierLabel}</div>
              <p className="mt-0.5 text-[11px]">{calculations.vis.clinicalInterpretation}</p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Clinical Observations & Response</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Peripheral perfusion restored; pulse pressure widened; urine output 1.5 mL/kg/h."
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
              className="px-5 py-2 bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white rounded-lg text-xs font-semibold shadow-md disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Log Resuscitation Flowsheet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
