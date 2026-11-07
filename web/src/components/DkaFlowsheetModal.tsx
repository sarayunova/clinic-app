import React, { useState } from 'react';
import { logPediatricDkaFlowsheet, type PediatricDkaFlowsheetRecord } from '../api';

interface DkaFlowsheetModalProps {
  dkaEpisodeId: number;
  patientName: string;
  nextHourNumber: number;
  targetTotalRateMlHr: number;
  defaultInsulinRateUnitsHr: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (log: PediatricDkaFlowsheetRecord) => void;
}

export const DkaFlowsheetModal: React.FC<DkaFlowsheetModalProps> = ({
  dkaEpisodeId,
  patientName,
  nextHourNumber,
  targetTotalRateMlHr,
  defaultInsulinRateUnitsHr,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [hoursOnProtocol, setHoursOnProtocol] = useState<number>(nextHourNumber || 1);
  const [logDatetime, setLogDatetime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState<string>('320');
  const [venousPh, setVenousPh] = useState<string>('7.18');
  const [serumBicarbonateMmolL, setSerumBicarbonateMmolL] = useState<string>('11.0');
  const [serumSodiumMeqL, setSerumSodiumMeqL] = useState<string>('136');
  const [serumPotassiumMeqL, setSerumPotassiumMeqL] = useState<string>('4.2');
  const [serumChlorideMeqL, setSerumChlorideMeqL] = useState<string>('102');

  // Two-Bag rates (sum should ideally approximate targetTotalRateMlHr)
  const defaultBag1 = Math.round(targetTotalRateMlHr * 0.7);
  const defaultBag2 = Math.round(targetTotalRateMlHr * 0.3);
  const [bag1RateMlHr, setBag1RateMlHr] = useState<string>(String(defaultBag1 || 60));
  const [bag2RateMlHr, setBag2RateMlHr] = useState<string>(String(defaultBag2 || 20));
  const [insulinInfusionUnitsHr, setInsulinInfusionUnitsHr] = useState<string>(
    String(defaultInsulinRateUnitsHr || 1.2)
  );

  const [glasgowComaScaleScore, setGlasgowComaScaleScore] = useState<string>('15');
  const [neurologicalHeadacheVomiting, setNeurologicalHeadacheVomiting] = useState<boolean>(false);
  const [cushingTriadWarning, setCushingTriadWarning] = useState<boolean>(false);
  const [emergencyHyperosmolarSalineGiven, setEmergencyHyperosmolarSalineGiven] = useState<boolean>(false);
  const [urineOutputMlKgHr, setUrineOutputMlKgHr] = useState<string>('1.4');
  const [notes, setNotes] = useState<string>(
    'BG declining smoothly at ~60 mg/dL/hr. Bag 2 (D10) titrated in as BG approached 300 mg/dL. Neuro check normal.'
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalCurrentRate = (Number(bag1RateMlHr) || 0) + (Number(bag2RateMlHr) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await logPediatricDkaFlowsheet(dkaEpisodeId, {
        hoursOnProtocol: Number(hoursOnProtocol),
        logDatetime,
        bloodGlucoseMgDl: Number(bloodGlucoseMgDl),
        venousPh: venousPh ? Number(venousPh) : undefined,
        serumBicarbonateMmolL: serumBicarbonateMmolL ? Number(serumBicarbonateMmolL) : undefined,
        serumSodiumMeqL: serumSodiumMeqL ? Number(serumSodiumMeqL) : undefined,
        serumPotassiumMeqL: serumPotassiumMeqL ? Number(serumPotassiumMeqL) : undefined,
        serumChlorideMeqL: serumChlorideMeqL ? Number(serumChlorideMeqL) : undefined,
        bag1RateMlHr: Number(bag1RateMlHr),
        bag2RateMlHr: Number(bag2RateMlHr),
        insulinInfusionUnitsHr: Number(insulinInfusionUnitsHr),
        glasgowComaScaleScore: Number(glasgowComaScaleScore),
        neurologicalHeadacheVomiting,
        cushingTriadWarning,
        emergencyHyperosmolarSalineGiven,
        urineOutputMlKgHr: urineOutputMlKgHr ? Number(urineOutputMlKgHr) : undefined,
        notes: notes || undefined,
      });

      onSuccess(res.log);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record DKA hourly flowsheet log');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-700 via-orange-600 to-indigo-800 text-white p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🍼</span>
              <h2 className="text-xl font-bold tracking-tight">Log Hourly DKA Flowsheet &amp; Two-Bag Rate</h2>
            </div>
            <p className="text-amber-100 text-xs mt-1">
              Patient: <span className="font-semibold text-white">{patientName}</span> · Protocol Hour #{hoursOnProtocol}
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
                Protocol Hour # (1–48) *
              </label>
              <input
                type="number"
                min="0"
                max="120"
                required
                className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-amber-800"
                value={hoursOnProtocol}
                onChange={(e) => setHoursOnProtocol(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Timestamp *
              </label>
              <input
                type="datetime-local"
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Blood Glucose (mg/dL) *
              </label>
              <input
                type="number"
                required
                min="20"
                max="1500"
                className="w-full border rounded-lg px-3 py-2 text-sm font-black text-rose-700"
                value={bloodGlucoseMgDl}
                onChange={(e) => setBloodGlucoseMgDl(e.target.value)}
              />
            </div>
          </div>

          {/* Acid-Base & Electrolytes */}
          <div className="p-4 bg-slate-50 border rounded-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <span>🧪</span> Hourly Labs &amp; Acid-Base Evolution
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Venous pH</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border rounded-lg px-3 py-2 text-xs font-bold"
                  value={venousPh}
                  onChange={(e) => setVenousPh(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Serum HCO3</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full border rounded-lg px-3 py-2 text-xs font-bold"
                  value={serumBicarbonateMmolL}
                  onChange={(e) => setSerumBicarbonateMmolL(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Serum Na (mEq)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                  value={serumSodiumMeqL}
                  onChange={(e) => setSerumSodiumMeqL(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Serum K (mEq)</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                  value={serumPotassiumMeqL}
                  onChange={(e) => setSerumPotassiumMeqL(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Chloride (mEq)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                  value={serumChlorideMeqL}
                  onChange={(e) => setSerumChlorideMeqL(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Two-Bag System & Insulin Delivery */}
          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                <span>⚡</span> Two-Bag IV Titration &amp; Insulin Infusion
              </h3>
              <span className="text-xs font-mono font-bold text-slate-700">
                Sum: {totalCurrentRate} mL/hr (Target ~{targetTotalRateMlHr} mL/hr)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-700 font-semibold mb-1">
                  Bag 1 Rate: D0 (0.9% NaCl + KCl)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-cyan-800"
                  value={bag1RateMlHr}
                  onChange={(e) => setBag1RateMlHr(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-700 font-semibold mb-1">
                  Bag 2 Rate: D10 (D10 + 0.9% NaCl + KCl)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-amber-800"
                  value={bag2RateMlHr}
                  onChange={(e) => setBag2RateMlHr(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-700 font-semibold mb-1">
                  Insulin Rate (Units/hr) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  className="w-full border rounded-lg px-3 py-2 text-sm font-black text-rose-700"
                  value={insulinInfusionUnitsHr}
                  onChange={(e) => setInsulinInfusionUnitsHr(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Neurological Surveillance (Cerebral Edema / GCS) */}
          <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
              <span>🧠</span> Neurological Check &amp; Cerebral Edema Surveillance
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Glasgow Coma Scale (GCS 3–15) *
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
                  value={glasgowComaScaleScore}
                  onChange={(e) => setGlasgowComaScaleScore(e.target.value)}
                >
                  <option value="15">15 - Fully Alert &amp; Oriented</option>
                  <option value="14">14 - Mild Lethargy</option>
                  <option value="13">13 - Significant Lethargy (Edema Warning)</option>
                  <option value="12">12 - Drowsy / Stupor</option>
                  <option value="11">11 - Moderate Impairment</option>
                  <option value="10">10 - Severe Neurological Compromise</option>
                  <option value="9">9 - High Risk</option>
                  <option value="8">8 or less - Critical Coma</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Urine Output (mL/kg/hr)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Target > 1.0 mL/kg/hr"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={urineOutputMlKgHr}
                  onChange={(e) => setUrineOutputMlKgHr(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={neurologicalHeadacheVomiting}
                  onChange={(e) => setNeurologicalHeadacheVomiting(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-800">Headache / Recurrent Emesis</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={cushingTriadWarning}
                  onChange={(e) => setCushingTriadWarning(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                />
                <span className="text-xs font-bold text-red-700">Cushing Triad (Brady + HTN)</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={emergencyHyperosmolarSalineGiven}
                  onChange={(e) => setEmergencyHyperosmolarSalineGiven(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                />
                <span className="text-xs font-bold text-purple-900">3% Saline / Mannitol Given</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Hourly Resuscitation Remarks</label>
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
              className="px-5 py-2 bg-gradient-to-r from-amber-600 to-indigo-700 hover:from-amber-700 hover:to-indigo-800 text-white font-bold rounded-lg text-sm shadow-md transition disabled:opacity-50"
            >
              {loading ? 'Logging...' : 'Save Flowsheet Hour'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
