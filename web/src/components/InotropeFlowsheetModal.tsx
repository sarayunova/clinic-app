import React, { useState, useMemo } from 'react';
import { logNeonatalInotropeFlowsheet, type NeonatalInotropeRecord } from '../api';
import { calculateInotropeInfusionRates } from '../neonatalSepsisEngine';

interface InotropeFlowsheetModalProps {
  episodeId: number;
  patientId: number;
  weightKg: number;
  defaultHoursOnInotropes?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (log: NeonatalInotropeRecord) => void;
}

export const InotropeFlowsheetModal: React.FC<InotropeFlowsheetModalProps> = ({
  episodeId,
  patientId,
  weightKg,
  defaultHoursOnInotropes = 1,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [logDatetime, setLogDatetime] = useState<string>(new Date().toISOString().slice(0, 16));
  const [hoursOnInotropes, setHoursOnInotropes] = useState<string>(String(defaultHoursOnInotropes));
  const [heartRateBpm, setHeartRateBpm] = useState<string>('145');
  const [bloodPressureSystolic, setBloodPressureSystolic] = useState<string>('55');
  const [bloodPressureDiastolic, setBloodPressureDiastolic] = useState<string>('30');
  const [preDuctalSpo2, setPreDuctalSpo2] = useState<string>('95');
  const [postDuctalSpo2, setPostDuctalSpo2] = useState<string>('92');
  const [svcFlowMlKgMin, setSvcFlowMlKgMin] = useState<string>('55');
  const [urineOutputMlKgHr, setUrineOutputMlKgHr] = useState<string>('1.8');

  // Inotrope doses (mcg/kg/min)
  const [dopamineMcgKgMin, setDopamineMcgKgMin] = useState<string>('5');
  const [dobutamineMcgKgMin, setDobutamineMcgKgMin] = useState<string>('0');
  const [epinephrineMcgKgMin, setEpinephrineMcgKgMin] = useState<string>('0');
  const [milrinoneMcgKgMin, setMilrinoneMcgKgMin] = useState<string>('0');
  const [hydrocortisoneMgKg, setHydrocortisoneMgKg] = useState<string>('0');
  const [inoPpm, setInoPpm] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Computed values
  const mapMmhg = useMemo(() => {
    const sbp = parseFloat(bloodPressureSystolic);
    const dbp = parseFloat(bloodPressureDiastolic);
    if (!isNaN(sbp) && !isNaN(dbp)) {
      return Math.round((dbp + (sbp - dbp) / 3) * 10) / 10;
    }
    return null;
  }, [bloodPressureSystolic, bloodPressureDiastolic]);

  const deltaSpo2 = useMemo(() => {
    const pre = parseFloat(preDuctalSpo2);
    const post = parseFloat(postDuctalSpo2);
    if (!isNaN(pre) && !isNaN(post)) {
      return Math.round(Math.abs(pre - post) * 10) / 10;
    }
    return null;
  }, [preDuctalSpo2, postDuctalSpo2]);

  const infusionRates = useMemo(() => {
    return calculateInotropeInfusionRates({
      weightKg,
      dopamineMcgKgMin: parseFloat(dopamineMcgKgMin) || 0,
      dobutamineMcgKgMin: parseFloat(dobutamineMcgKgMin) || 0,
      epinephrineMcgKgMin: parseFloat(epinephrineMcgKgMin) || 0,
      milrinoneMcgKgMin: parseFloat(milrinoneMcgKgMin) || 0,
    });
  }, [weightKg, dopamineMcgKgMin, dobutamineMcgKgMin, epinephrineMcgKgMin, milrinoneMcgKgMin]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await logNeonatalInotropeFlowsheet(episodeId, {
        logDatetime,
        hoursOnInotropes: parseFloat(hoursOnInotropes) || 0,
        heartRateBpm: heartRateBpm ? parseInt(heartRateBpm, 10) : undefined,
        bloodPressureSystolic: bloodPressureSystolic ? parseInt(bloodPressureSystolic, 10) : undefined,
        bloodPressureDiastolic: bloodPressureDiastolic ? parseInt(bloodPressureDiastolic, 10) : undefined,
        preDuctalSpo2: preDuctalSpo2 ? parseFloat(preDuctalSpo2) : undefined,
        postDuctalSpo2: postDuctalSpo2 ? parseFloat(postDuctalSpo2) : undefined,
        svcFlowMlKgMin: svcFlowMlKgMin ? parseFloat(svcFlowMlKgMin) : undefined,
        urineOutputMlKgHr: urineOutputMlKgHr ? parseFloat(urineOutputMlKgHr) : undefined,
        dopamineMcgKgMin: parseFloat(dopamineMcgKgMin) || 0,
        dobutamineMcgKgMin: parseFloat(dobutamineMcgKgMin) || 0,
        epinephrineMcgKgMin: parseFloat(epinephrineMcgKgMin) || 0,
        milrinoneMcgKgMin: parseFloat(milrinoneMcgKgMin) || 0,
        hydrocortisoneMgKg: parseFloat(hydrocortisoneMgKg) || 0,
        inoPpm: parseFloat(inoPpm) || 0,
        notes: notes || undefined,
      });

      onSuccess(res.log);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to log inotrope flowsheet');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-indigo-800 px-6 py-4 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>💉</span> Neonatal Inotrope & Hemodynamics Bedside Flowsheet
            </h2>
            <p className="text-teal-100 text-xs mt-0.5">
              Weight: <span className="font-semibold">{weightKg} kg</span> | Episode #{episodeId}
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Time & Vitals */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
              1. Hemodynamic Vital Signs & Perfusion Metrics
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Log Time</label>
                <input
                  type="datetime-local"
                  value={logDatetime}
                  onChange={(e) => setLogDatetime(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Hours on Protocol</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={hoursOnInotropes}
                  onChange={(e) => setHoursOnInotropes(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Heart Rate (bpm)</label>
                <input
                  type="number"
                  min="40"
                  max="240"
                  value={heartRateBpm}
                  onChange={(e) => setHeartRateBpm(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  BP (SBP / DBP) &rarr; MAP
                </label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="number"
                    min="30"
                    max="160"
                    placeholder="SBP"
                    value={bloodPressureSystolic}
                    onChange={(e) => setBloodPressureSystolic(e.target.value)}
                    className="w-1/2 text-xs border rounded-lg px-2 py-1.5 bg-white"
                  />
                  <span>/</span>
                  <input
                    type="number"
                    min="15"
                    max="110"
                    placeholder="DBP"
                    value={bloodPressureDiastolic}
                    onChange={(e) => setBloodPressureDiastolic(e.target.value)}
                    className="w-1/2 text-xs border rounded-lg px-2 py-1.5 bg-white"
                  />
                </div>
                {mapMmhg !== null && (
                  <span className="text-[11px] font-bold text-indigo-700 mt-0.5 block">
                    MAP: {mapMmhg} mmHg
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Pre-Ductal SpO₂ (%)</label>
                <input
                  type="number"
                  min="40"
                  max="100"
                  value={preDuctalSpo2}
                  onChange={(e) => setPreDuctalSpo2(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Post-Ductal SpO₂ (%)</label>
                <input
                  type="number"
                  min="40"
                  max="100"
                  value={postDuctalSpo2}
                  onChange={(e) => setPostDuctalSpo2(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">SVC Flow (mL/kg/min)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="250"
                  value={svcFlowMlKgMin}
                  onChange={(e) => setSvcFlowMlKgMin(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                />
                <span className="text-[10px] text-gray-500">&lt;40 flags low systemic flow</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Urine Output (mL/kg/h)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="20"
                  value={urineOutputMlKgHr}
                  onChange={(e) => setUrineOutputMlKgHr(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                />
              </div>
            </div>

            {deltaSpo2 !== null && deltaSpo2 >= 5 && (
              <div className="p-2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-xs">
                ⚠️ <span className="font-bold">Significant Pre/Post-Ductal SpO₂ gradient ({deltaSpo2}% &ge; 5%):</span> Suggests right-to-left ductal shunting / Persistent Pulmonary Hypertension of the Newborn (PPHN).
              </div>
            )}
          </div>

          {/* Inotrope Titration */}
          <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-teal-900 text-xs uppercase tracking-wider flex items-center justify-between">
              <span>2. Vasoactive Inotropes & Pulmonary Vasodilators</span>
              <span className="text-[11px] font-normal text-teal-700">Calculated for {weightKg} kg</span>
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-2.5 rounded-lg border border-teal-100">
                <label className="block text-xs font-semibold text-gray-800 mb-1">Dopamine</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="25"
                    value={dopamineMcgKgMin}
                    onChange={(e) => setDopamineMcgKgMin(e.target.value)}
                    className="w-full text-xs border rounded px-2 py-1"
                  />
                  <span className="text-[11px] text-gray-500">mcg/kg/min</span>
                </div>
                <div className="text-[11px] text-teal-800 font-bold mt-1">
                  Rate: {infusionRates.dopamineRateMlHr} mL/h
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-teal-100">
                <label className="block text-xs font-semibold text-gray-800 mb-1">Dobutamine</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="25"
                    value={dobutamineMcgKgMin}
                    onChange={(e) => setDobutamineMcgKgMin(e.target.value)}
                    className="w-full text-xs border rounded px-2 py-1"
                  />
                  <span className="text-[11px] text-gray-500">mcg/kg/min</span>
                </div>
                <div className="text-[11px] text-teal-800 font-bold mt-1">
                  Rate: {infusionRates.dobutamineRateMlHr} mL/h
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-teal-100">
                <label className="block text-xs font-semibold text-gray-800 mb-1">Epinephrine</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1.5"
                    value={epinephrineMcgKgMin}
                    onChange={(e) => setEpinephrineMcgKgMin(e.target.value)}
                    className="w-full text-xs border rounded px-2 py-1"
                  />
                  <span className="text-[11px] text-gray-500">mcg/kg/min</span>
                </div>
                <div className="text-[11px] text-teal-800 font-bold mt-1">
                  Rate: {infusionRates.epinephrineRateMlHr} mL/h
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-teal-100">
                <label className="block text-xs font-semibold text-gray-800 mb-1">Milrinone</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1.5"
                    value={milrinoneMcgKgMin}
                    onChange={(e) => setMilrinoneMcgKgMin(e.target.value)}
                    className="w-full text-xs border rounded px-2 py-1"
                  />
                  <span className="text-[11px] text-gray-500">mcg/kg/min</span>
                </div>
                <div className="text-[11px] text-teal-800 font-bold mt-1">
                  Rate: {infusionRates.milrinoneRateMlHr} mL/h
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="bg-white p-2.5 rounded-lg border border-teal-100 flex items-center justify-between">
                <div>
                  <label className="block text-xs font-semibold text-gray-800">Hydrocortisone</label>
                  <span className="text-[11px] text-gray-500">Stress-dose for vasopressor resistance</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="5"
                    value={hydrocortisoneMgKg}
                    onChange={(e) => setHydrocortisoneMgKg(e.target.value)}
                    className="w-20 text-xs border rounded px-2 py-1"
                  />
                  <span className="text-[11px] text-gray-500">mg/kg</span>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-teal-100 flex items-center justify-between">
                <div>
                  <label className="block text-xs font-semibold text-gray-800">Inhaled Nitric Oxide (iNO)</label>
                  <span className="text-[11px] text-gray-500">Selective pulmonary vasodilator</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="40"
                    value={inoPpm}
                    onChange={(e) => setInoPpm(e.target.value)}
                    className="w-20 text-xs border rounded px-2 py-1"
                  />
                  <span className="text-[11px] text-gray-500">ppm</span>
                </div>
              </div>
            </div>

            {infusionRates.hemodynamicAlert && (
              <div className="p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded text-xs">
                ⚠️ {infusionRates.hemodynamicAlert}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Bedside Nursing Observation & Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Central line patent; capillary refill 2.5s; peripheral pulses easily palpable."
              className="w-full text-xs border rounded-lg px-3 py-2"
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
              className="px-5 py-2 bg-gradient-to-r from-teal-700 to-indigo-800 hover:from-teal-800 hover:to-indigo-900 text-white rounded-lg text-xs font-semibold shadow-md disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Log Inotrope Flowsheet Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
