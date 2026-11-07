import React, { useState, useMemo } from 'react';
import { createPediatricDkaEpisode, type PediatricDkaRecord } from '../api';
import { calculatePediatricDka, type PediatricDkaInput } from '../pediatricDkaEngine';

interface PediatricDkaModalProps {
  patientId: number;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (episode: PediatricDkaRecord) => void;
  defaultWeightKg?: number;
}

export const PediatricDkaModal: React.FC<PediatricDkaModalProps> = ({
  patientId,
  patientName,
  isOpen,
  onClose,
  onSuccess,
  defaultWeightKg = 18.0,
}) => {
  const [diagnosisDatetime, setDiagnosisDatetime] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [childWeightKg, setChildWeightKg] = useState<string>(String(defaultWeightKg));
  const [childHeightCm, setChildHeightCm] = useState<string>('110');
  const [initialBloodGlucoseMgDl, setInitialBloodGlucoseMgDl] = useState<string>('480');
  const [venousPh, setVenousPh] = useState<string>('7.08');
  const [serumBicarbonateMmolL, setSerumBicarbonateMmolL] = useState<string>('6.5');
  const [serumBetaHydroxybutyrateMmolL, setSerumBetaHydroxybutyrateMmolL] = useState<string>('5.2');
  const [ketonesUrineOrBlood, setKetonesUrineOrBlood] = useState<
    'moderate_2_plus' | 'large_3_plus' | 'beta_hydroxybutyrate_gte_3'
  >('beta_hydroxybutyrate_gte_3');

  const [measuredSodiumMeqL, setMeasuredSodiumMeqL] = useState<string>('132');
  const [measuredPotassiumMeqL, setMeasuredPotassiumMeqL] = useState<string>('4.8');
  const [measuredChlorideMeqL, setMeasuredChlorideMeqL] = useState<string>('98');
  const [initialSalineBolusMl, setInitialSalineBolusMl] = useState<string>('180');
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    'New onset Type-1 Diabetes with severe DKA, Kussmaul breathing, and 7% dehydration. PICU bedside monitor active.'
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calcResult = useMemo(() => {
    try {
      const input: PediatricDkaInput = {
        childWeightKg: Number(childWeightKg) || 15,
        initialBloodGlucoseMgDl: Number(initialBloodGlucoseMgDl) || 300,
        venousPh: Number(venousPh) || 7.20,
        serumBicarbonateMmolL: Number(serumBicarbonateMmolL) || 12,
        measuredSodiumMeqL: measuredSodiumMeqL ? Number(measuredSodiumMeqL) : undefined,
        measuredPotassiumMeqL: measuredPotassiumMeqL ? Number(measuredPotassiumMeqL) : undefined,
        measuredChlorideMeqL: measuredChlorideMeqL ? Number(measuredChlorideMeqL) : undefined,
        serumBetaHydroxybutyrateMmolL: serumBetaHydroxybutyrateMmolL ? Number(serumBetaHydroxybutyrateMmolL) : undefined,
      };
      return calculatePediatricDka(input);
    } catch {
      return null;
    }
  }, [
    childWeightKg,
    initialBloodGlucoseMgDl,
    venousPh,
    serumBicarbonateMmolL,
    measuredSodiumMeqL,
    measuredPotassiumMeqL,
    measuredChlorideMeqL,
    serumBetaHydroxybutyrateMmolL,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await createPediatricDkaEpisode({
        patientId,
        diagnosisDatetime,
        childWeightKg: Number(childWeightKg),
        childHeightCm: childHeightCm ? Number(childHeightCm) : undefined,
        initialBloodGlucoseMgDl: Number(initialBloodGlucoseMgDl),
        venousPh: Number(venousPh),
        serumBicarbonateMmolL: Number(serumBicarbonateMmolL),
        serumBetaHydroxybutyrateMmolL: serumBetaHydroxybutyrateMmolL ? Number(serumBetaHydroxybutyrateMmolL) : undefined,
        ketonesUrineOrBlood,
        measuredSodiumMeqL: measuredSodiumMeqL ? Number(measuredSodiumMeqL) : undefined,
        measuredPotassiumMeqL: measuredPotassiumMeqL ? Number(measuredPotassiumMeqL) : undefined,
        measuredChlorideMeqL: measuredChlorideMeqL ? Number(measuredChlorideMeqL) : undefined,
        initialSalineBolusMl: initialSalineBolusMl ? Number(initialSalineBolusMl) : undefined,
        clinicalNotes: clinicalNotes || undefined,
      });

      onSuccess(res.episode);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate pediatric DKA episode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-700 via-orange-700 to-rose-900 text-white p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🧸</span>
              <h2 className="text-xl font-bold tracking-tight">Initiate Pediatric DKA Resuscitation</h2>
            </div>
            <p className="text-amber-100 text-xs mt-1">
              Patient: <span className="font-semibold text-white">{patientName}</span> · ISPAD / PECARN 48-Hour Resuscitation &amp; Two-Bag System
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Timing & Anthropometrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Diagnosis Datetime *
              </label>
              <input
                type="datetime-local"
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                value={diagnosisDatetime}
                onChange={(e) => setDiagnosisDatetime(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Weight (kg) *
              </label>
              <input
                type="number"
                step="0.1"
                min="3"
                max="120"
                required
                className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-amber-800"
                value={childWeightKg}
                onChange={(e) => setChildWeightKg(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Height (cm)
              </label>
              <input
                type="number"
                min="40"
                max="220"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={childHeightCm}
                onChange={(e) => setChildHeightCm(e.target.value)}
              />
            </div>
          </div>

          {/* Blood Gas & Glycemic Parameters */}
          <div className="p-4 bg-slate-50 border rounded-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <span>🩸</span> Laboratory Acid-Base &amp; Glycemic Values
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Blood Glucose (mg/dL) *</label>
                <input
                  type="number"
                  required
                  min="150"
                  max="2000"
                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-amber-800"
                  value={initialBloodGlucoseMgDl}
                  onChange={(e) => setInitialBloodGlucoseMgDl(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Venous pH *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="6.5"
                  max="7.5"
                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-rose-700"
                  value={venousPh}
                  onChange={(e) => setVenousPh(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Serum HCO3 (mmol/L) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  min="0.5"
                  max="30"
                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold text-rose-700"
                  value={serumBicarbonateMmolL}
                  onChange={(e) => setSerumBicarbonateMmolL(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Serum Beta-OHB</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="20"
                  placeholder="mmol/L (≥ 3.0)"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={serumBetaHydroxybutyrateMmolL}
                  onChange={(e) => setSerumBetaHydroxybutyrateMmolL(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Measured Sodium (mEq/L)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                  value={measuredSodiumMeqL}
                  onChange={(e) => setMeasuredSodiumMeqL(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Measured Potassium (mEq/L)</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                  value={measuredPotassiumMeqL}
                  onChange={(e) => setMeasuredPotassiumMeqL(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Measured Chloride (mEq/L)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                  value={measuredChlorideMeqL}
                  onChange={(e) => setMeasuredChlorideMeqL(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Ketone Evidence *</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                  value={ketonesUrineOrBlood}
                  onChange={(e) => setKetonesUrineOrBlood(e.target.value as any)}
                >
                  <option value="beta_hydroxybutyrate_gte_3">Beta-OHB ≥ 3.0 mmol/L</option>
                  <option value="large_3_plus">Urine Ketones 3+ / Large</option>
                  <option value="moderate_2_plus">Urine Ketones 2+ / Moderate</option>
                </select>
              </div>
            </div>
          </div>

          {/* Dynamic Calculation Summary Card */}
          {calcResult && (
            <div className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50/70 space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 pb-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full font-black uppercase text-xs ${
                      calcResult.dkaSeverity === 'severe_ph_lt_7_10'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : calcResult.dkaSeverity === 'moderate_ph_7_10_7_19'
                        ? 'bg-amber-600 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {calcResult.dkaSeverityLabel}
                  </span>
                  <span className="font-bold text-amber-900">
                    Dehydration: {calcResult.estimatedDehydrationPercent}%
                  </span>
                </div>

                <div className="text-right">
                  <span className="font-bold text-slate-700">Corrected Na: </span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {calcResult.correctedSodiumMeqL ? `${calcResult.correctedSodiumMeqL} mEq/L` : '—'}
                  </span>
                </div>
              </div>

              {/* Fluid Deficit and Maintenance Flow Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-2.5 rounded-lg border">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Total Deficit</div>
                  <div className="text-base font-black text-slate-900">{calcResult.totalFluidDeficitMl} mL</div>
                  <div className="text-[10px] text-slate-400">Replaced over 48h</div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Saline Bolus (10 mL/kg)</div>
                  <div className="text-base font-black text-amber-800">{calcResult.initialBolusVolumeMl} mL</div>
                  <div className="text-[10px] text-slate-400">0.9% NaCl over 1h</div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Total 48h Rehydration Rate</div>
                  <div className="text-base font-black text-indigo-700">{calcResult.totalHourlyRehydrationRateMlHr} mL/hr</div>
                  <div className="text-[10px] text-slate-400">Deficit ({calcResult.hourlyDeficitRateMlHr}) + Maint ({calcResult.hourlyMaintenanceMlHr})</div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">IV Regular Insulin</div>
                  <div className="text-base font-black text-rose-700">{calcResult.recommendedInsulinInfusionUnitsHr} U/hr</div>
                  <div className="text-[10px] text-rose-600 font-bold">⚠️ STRICTLY NO BOLUS</div>
                </div>
              </div>

              {/* Two-Bag System Preview */}
              <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3 text-indigo-950 space-y-1">
                <div className="font-bold flex items-center justify-between">
                  <span>🍼 Two-Bag Titration Strategy</span>
                  <span className="text-[10px] bg-indigo-200/60 px-2 py-0.5 rounded font-mono">
                    Total: {calcResult.totalHourlyRehydrationRateMlHr} mL/hr
                  </span>
                </div>
                <div className="text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div><strong>Bag 1:</strong> {calcResult.twoBagTitrationGuidelines.bag1Composition}</div>
                  <div><strong>Bag 2:</strong> {calcResult.twoBagTitrationGuidelines.bag2Composition}</div>
                </div>
                <div className="text-[10px] text-indigo-800 pt-1">
                  <em>Action Rule:</em> {calcResult.twoBagTitrationGuidelines.actionRule}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Clinical Assessment &amp; Resuscitation Orders
            </label>
            <textarea
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
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
              className="px-5 py-2 bg-gradient-to-r from-amber-600 to-rose-700 hover:from-amber-700 hover:to-rose-800 text-white font-bold rounded-lg text-sm shadow-md transition disabled:opacity-50"
            >
              {loading ? 'Initiating...' : 'Start 48h DKA Resuscitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
