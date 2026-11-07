import React, { useState } from 'react';
import { logTtmFlowsheet, type TtmFlowsheetRecord } from '../api';

interface TtmFlowsheetModalProps {
  assessmentId: number;
  patientName: string;
  nextHourNumber: number;
  currentCoolingPhase?: 'induction' | 'maintenance_cooling' | 'controlled_rewarming' | 'post_cooling_normothermia';
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (log: TtmFlowsheetRecord) => void;
}

export const TtmFlowsheetModal: React.FC<TtmFlowsheetModalProps> = ({
  assessmentId,
  patientName,
  nextHourNumber,
  currentCoolingPhase = 'maintenance_cooling',
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [hoursIntoProtocol, setHoursIntoProtocol] = useState<number>(nextHourNumber || 1);
  const [logDatetime, setLogDatetime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [coreTemperatureCelsius, setCoreTemperatureCelsius] = useState<string>('33.5');
  const [skinTemperatureCelsius, setSkinTemperatureCelsius] = useState<string>('33.0');
  const [phase, setPhase] = useState<'induction' | 'maintenance_cooling' | 'controlled_rewarming' | 'post_cooling_normothermia'>(
    currentCoolingPhase
  );
  const [heartRateBpm, setHeartRateBpm] = useState<string>('115');
  const [meanArterialPressureMmhg, setMeanArterialPressureMmhg] = useState<string>('44');
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState<string>('85');
  const [serumPotassiumMeqL, setSerumPotassiumMeqL] = useState<string>('4.2');
  const [aeegBackgroundPattern, setAeegBackgroundPattern] = useState<
    'continuous_normal_voltage_cnv' | 'discontinuous_normal_voltage_dnv' | 'continuous_low_voltage_clv' | 'burst_suppression_bs' | 'flat_trace_ft'
  >('discontinuous_normal_voltage_dnv');
  const [aeegSleepWakeCycling, setAeegSleepWakeCycling] = useState<boolean>(false);
  const [electrographicSeizuresDetected, setElectrographicSeizuresDetected] = useState<boolean>(false);
  const [anticonvulsantAdministered, setAnticonvulsantAdministered] = useState<string>('Phenobarbital 20 mg/kg load');
  const [inotropicSupport, setInotropicSupport] = useState<string>('Dopamine 5 mcg/kg/min');
  const [notes, setNotes] = useState<string>('Target 33.5°C maintained; vitals stable, regular repositioning performed.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await logTtmFlowsheet(assessmentId, {
        hoursIntoProtocol: Number(hoursIntoProtocol),
        logDatetime,
        coreTemperatureCelsius: Number(coreTemperatureCelsius),
        skinTemperatureCelsius: skinTemperatureCelsius ? Number(skinTemperatureCelsius) : undefined,
        phase,
        heartRateBpm: Number(heartRateBpm),
        meanArterialPressureMmhg: meanArterialPressureMmhg ? Number(meanArterialPressureMmhg) : undefined,
        bloodGlucoseMgDl: bloodGlucoseMgDl ? Number(bloodGlucoseMgDl) : undefined,
        serumPotassiumMeqL: serumPotassiumMeqL ? Number(serumPotassiumMeqL) : undefined,
        aeegBackgroundPattern,
        aeegSleepWakeCycling,
        electrographicSeizuresDetected,
        anticonvulsantAdministered: anticonvulsantAdministered || undefined,
        inotropicSupport: inotropicSupport || undefined,
        notes: notes || undefined,
      });

      onSuccess(res.log);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record TTM flowsheet log');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-700 via-sky-700 to-indigo-800 text-white p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🧊</span>
              <h2 className="text-xl font-bold tracking-tight">Log TTM Hourly Flowsheet</h2>
            </div>
            <p className="text-cyan-100 text-xs mt-1">
              Patient: <span className="font-semibold text-white">{patientName}</span> · Protocol Hour #{hoursIntoProtocol}
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Protocol Hour # (1–80) *
              </label>
              <input
                type="number"
                min="0"
                max="120"
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 font-bold text-cyan-800"
                value={hoursIntoProtocol}
                onChange={(e) => setHoursIntoProtocol(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Timestamp *
              </label>
              <input
                type="datetime-local"
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cooling Phase *
              </label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 font-medium"
                value={phase}
                onChange={(e) => setPhase(e.target.value as any)}
              >
                <option value="induction">Induction (0–2h)</option>
                <option value="maintenance_cooling">Maintenance Cooling (33.5°C, 72h)</option>
                <option value="controlled_rewarming">Controlled Rewarming (+0.5°C/hr)</option>
                <option value="post_cooling_normothermia">Post-Cooling Normothermia</option>
              </select>
            </div>
          </div>

          {/* Vitals and Temperatures */}
          <div className="p-4 bg-slate-50 border rounded-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <span>🌡️</span> Thermal &amp; Hemodynamic Monitoring
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Core Temp (°C) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="42"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm font-black text-cyan-700"
                  value={coreTemperatureCelsius}
                  onChange={(e) => setCoreTemperatureCelsius(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Skin Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="42"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={skinTemperatureCelsius}
                  onChange={(e) => setSkinTemperatureCelsius(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Heart Rate (bpm) *</label>
                <input
                  type="number"
                  min="40"
                  max="240"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={heartRateBpm}
                  onChange={(e) => setHeartRateBpm(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">MAP (mmHg)</label>
                <input
                  type="number"
                  min="20"
                  max="120"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={meanArterialPressureMmhg}
                  onChange={(e) => setMeanArterialPressureMmhg(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Blood Glucose (mg/dL)</label>
                <input
                  type="number"
                  min="20"
                  max="600"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={bloodGlucoseMgDl}
                  onChange={(e) => setBloodGlucoseMgDl(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Serum Potassium (mEq/L)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="10"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={serumPotassiumMeqL}
                  onChange={(e) => setSerumPotassiumMeqL(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Neurological & aEEG Monitoring */}
          <div className="p-4 bg-sky-50/50 border border-sky-100 rounded-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1.5">
              <span>🧠</span> aEEG Background &amp; Seizure Surveillance
            </h3>
            <div>
              <label className="block text-xs text-slate-700 font-medium mb-1">aEEG Voltage Background</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={aeegBackgroundPattern}
                onChange={(e) => setAeegBackgroundPattern(e.target.value as any)}
              >
                <option value="continuous_normal_voltage_cnv">Continuous Normal Voltage (CNV - Normal/Mild)</option>
                <option value="discontinuous_normal_voltage_dnv">Discontinuous Normal Voltage (DNV - Moderate)</option>
                <option value="continuous_low_voltage_clv">Continuous Low Voltage (CLV - Severe)</option>
                <option value="burst_suppression_bs">Burst Suppression (BS - High Neurological Risk)</option>
                <option value="flat_trace_ft">Flat Trace (FT - Isoelectric/Inactive)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-2 p-2.5 bg-white rounded-lg border cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={electrographicSeizuresDetected}
                  onChange={(e) => setElectrographicSeizuresDetected(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-800">Seizures Detected</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 bg-white rounded-lg border cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={aeegSleepWakeCycling}
                  onChange={(e) => setAeegSleepWakeCycling(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-800">Sleep-Wake Cycling (SWC)</span>
              </label>
            </div>
          </div>

          {/* Inotropes and Anticonvulsants */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Inotropic Support</label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={inotropicSupport}
                onChange={(e) => setInotropicSupport(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Anticonvulsant Administered</label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={anticonvulsantAdministered}
                onChange={(e) => setAnticonvulsantAdministered(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nursing Observations &amp; Actions</label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
              className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 text-white font-bold rounded-lg text-sm shadow-md transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Record Flowsheet Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
