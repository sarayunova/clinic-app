import React, { useState, useMemo } from 'react';
import { createPediatricSepticShockEpisode, type PediatricSepticShockRecord } from '../api';
import {
  classifyPediatricShockPhenotype,
  evaluateFluidResuscitationSafety,
} from '../pediatricSepticShockEngine';

interface PediatricSepticShockModalProps {
  patientId: number;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (episode: PediatricSepticShockRecord) => void;
  defaultAgeMonths?: number;
  defaultWeightKg?: number;
}

export const PediatricSepticShockModal: React.FC<PediatricSepticShockModalProps> = ({
  patientId,
  patientName,
  isOpen,
  onClose,
  onSuccess,
  defaultAgeMonths = 24,
  defaultWeightKg = 12.0,
}) => {
  const [recognitionDatetime, setRecognitionDatetime] = useState<string>(new Date().toISOString().slice(0, 16));
  const [ageMonths, setAgeMonths] = useState<string>(String(defaultAgeMonths));
  const [weightKg, setWeightKg] = useState<string>(String(defaultWeightKg));
  const [mentalStatus, setMentalStatus] = useState<'alert' | 'voice' | 'pain' | 'unresponsive'>('voice');
  const [heartRateBpm, setHeartRateBpm] = useState<string>('165');
  const [sbp, setSbp] = useState<string>('74');
  const [dbp, setDbp] = useState<string>('40');
  const [capillaryRefillSeconds, setCapillaryRefillSeconds] = useState<string>('3.5');
  const [pulseQuality, setPulseQuality] = useState<'normal' | 'bounding' | 'weak_thready' | 'absent'>('weak_thready');
  const [extremityTemperature, setExtremityTemperature] = useState<'warm' | 'cool_mottled'>('cool_mottled');
  const [cumulativeFluidMl, setCumulativeFluidMl] = useState<string>('0');
  const [hepatomegalyPresent, setHepatomegalyPresent] = useState<boolean>(false);
  const [pulmonaryCracklesPresent, setPulmonaryCracklesPresent] = useState<boolean>(false);
  const [stressHydrocortisoneAdministered, setStressHydrocortisoneAdministered] = useState<boolean>(false);
  const [clinicalNotes, setClinicalNotes] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Live calculations
  const calculations = useMemo(() => {
    const sbpNum = parseInt(sbp, 10) || 80;
    const dbpNum = parseInt(dbp, 10) || 50;
    const wt = parseFloat(weightKg) || 10;
    const capRefill = parseFloat(capillaryRefillSeconds) || 2.0;

    const phenotype = classifyPediatricShockPhenotype({
      capillaryRefillSeconds: capRefill,
      pulseQuality,
      extremityTemperature,
      sbp: sbpNum,
      dbp: dbpNum,
    });

    const fluidSafety = evaluateFluidResuscitationSafety({
      weightKg: wt,
      cumulativeFluidMl: parseFloat(cumulativeFluidMl) || 0,
      hepatomegalyPresent,
      pulmonaryCracklesPresent,
    });

    return { phenotype, fluidSafety };
  }, [
    sbp,
    dbp,
    weightKg,
    capillaryRefillSeconds,
    pulseQuality,
    extremityTemperature,
    cumulativeFluidMl,
    hepatomegalyPresent,
    pulmonaryCracklesPresent,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await createPediatricSepticShockEpisode({
        patientId,
        recognitionDatetime,
        ageMonths: parseInt(ageMonths, 10) || 12,
        weightKg: parseFloat(weightKg) || 10,
        shockPhenotype: calculations.phenotype.phenotype,
        mentalStatus,
        capillaryRefillSeconds: parseFloat(capillaryRefillSeconds) || 2.0,
        heartRateBpm: parseInt(heartRateBpm, 10) || 140,
        sbp: parseInt(sbp, 10) || 80,
        dbp: parseInt(dbp, 10) || 50,
        pulseQuality,
        extremityTemperature,
        cumulativeFluidMl: parseFloat(cumulativeFluidMl) || 0,
        hepatomegalyPresent,
        pulmonaryCracklesPresent,
        firstLineVasoactive: calculations.phenotype.recommendedFirstLineVasoactive,
        stressHydrocortisoneAdministered,
        currentVisScore: 0,
        status: 'resuscitating',
        clinicalNotes: clinicalNotes || undefined,
      });

      onSuccess(res.episode);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to initiate pediatric septic shock resuscitation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-800 to-rose-900 px-6 py-4 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>🧸</span> Pediatric Septic Shock Resuscitation & PALS Protocol
            </h2>
            <p className="text-blue-100 text-xs mt-0.5">
              Surviving Sepsis Children Guidelines (2020) | Patient: {patientName} (ID: {patientId})
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
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
              {error}
            </div>
          )}

          {/* Section 1: Demographics & Time */}
          <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-blue-900 text-xs uppercase tracking-wider">
              1. Recognition Parameters & Demographics
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Recognition Time</label>
                <input
                  type="datetime-local"
                  value={recognitionDatetime}
                  onChange={(e) => setRecognitionDatetime(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Age (Months)</label>
                <input
                  type="number"
                  min="0"
                  max="216"
                  value={ageMonths}
                  onChange={(e) => setAgeMonths(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="120"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mental Status (AVPU)</label>
                <select
                  value={mentalStatus}
                  onChange={(e) => setMentalStatus(e.target.value as any)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white font-semibold"
                >
                  <option value="alert">Alert (A)</option>
                  <option value="voice">Responsive to Voice (V)</option>
                  <option value="pain">Responsive to Pain (P)</option>
                  <option value="unresponsive">Unresponsive (U)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Vitals & Shock Phenotype */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
              2. Hemodynamic Parameters & Cold vs. Warm Shock Phenotyping
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Heart Rate (bpm)</label>
                <input
                  type="number"
                  min="30"
                  max="280"
                  value={heartRateBpm}
                  onChange={(e) => setHeartRateBpm(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">BP (SBP / DBP mmHg)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="30"
                    max="240"
                    value={sbp}
                    onChange={(e) => setSbp(e.target.value)}
                    className="w-1/2 text-xs border rounded px-1.5 py-1 bg-white font-bold"
                    placeholder="SBP"
                    required
                  />
                  <span>/</span>
                  <input
                    type="number"
                    min="15"
                    max="160"
                    value={dbp}
                    onChange={(e) => setDbp(e.target.value)}
                    className="w-1/2 text-xs border rounded px-1.5 py-1 bg-white font-bold"
                    placeholder="DBP"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Capillary Refill (sec)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="15"
                  value={capillaryRefillSeconds}
                  onChange={(e) => setCapillaryRefillSeconds(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Pulse Quality</label>
                <select
                  value={pulseQuality}
                  onChange={(e) => setPulseQuality(e.target.value as any)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
                >
                  <option value="normal">Normal</option>
                  <option value="bounding">Bounding (Warm Shock)</option>
                  <option value="weak_thready">Weak / Thready (Cold Shock)</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Extremity Temperature</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExtremityTemperature('cool_mottled')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors ${
                      extremityTemperature === 'cool_mottled'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    ❄️ Cool & Mottled
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtremityTemperature('warm')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors ${
                      extremityTemperature === 'warm'
                        ? 'bg-rose-600 text-white'
                        : 'bg-white border text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    🔥 Warm & Flushed
                  </button>
                </div>
              </div>

              {/* Phenotype Badge */}
              <div className="p-3 bg-white border rounded-lg flex flex-col justify-center">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Classified Phenotype</span>
                <span
                  className={`text-sm font-black uppercase ${
                    calculations.phenotype.phenotype === 'cold_shock'
                      ? 'text-blue-700'
                      : calculations.phenotype.phenotype === 'warm_shock'
                      ? 'text-rose-700'
                      : 'text-gray-800'
                  }`}
                >
                  {calculations.phenotype.phenotypeLabel}
                </span>
                <span className="text-[11px] text-gray-600 mt-0.5">
                  First-Line Vasoactive:{' '}
                  <strong className="text-gray-900 uppercase">
                    {calculations.phenotype.recommendedFirstLineVasoactive} Infusion
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Fluid Resuscitation & Safety Stops */}
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-amber-900 text-xs uppercase tracking-wider flex items-center justify-between">
              <span>3. Fluid Bolus Resuscitation & Safety Stops</span>
              <span className="text-xs font-bold text-amber-800">
                Initial Bolus: 10–20 mL/kg ({calculations.fluidSafety.maxRecommendedBolusMl} mL crystalloid)
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Cumulative Fluid Administered (mL)
                </label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={cumulativeFluidMl}
                  onChange={(e) => setCumulativeFluidMl(e.target.value)}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white font-bold"
                />
                <span className="text-[10px] text-gray-500">
                  {calculations.fluidSafety.cumulativeFluidMlKg} mL/kg administered
                </span>
              </div>

              <label className="flex items-center gap-2 p-2.5 bg-white border rounded-lg text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={hepatomegalyPresent}
                  onChange={(e) => setHepatomegalyPresent(e.target.checked)}
                  className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="font-bold text-gray-900 block">Hepatomegaly (&gt;2 cm)</span>
                  <span className="text-[10px] text-rose-600">Safety stop: HOLD fluid boluses</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 bg-white border rounded-lg text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={pulmonaryCracklesPresent}
                  onChange={(e) => setPulmonaryCracklesPresent(e.target.checked)}
                  className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="font-bold text-gray-900 block">Pulmonary Rales / Crackles</span>
                  <span className="text-[10px] text-rose-600">Safety stop: HOLD fluid boluses</span>
                </div>
              </label>
            </div>

            {calculations.fluidSafety.overloadWarning && (
              <div className="p-2.5 bg-red-100 border border-red-300 text-red-900 rounded-lg text-xs font-medium">
                ⚠️ {calculations.fluidSafety.overloadWarning}
              </div>
            )}
          </div>

          {/* Section 4: Adrenal / Corticosteroid & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white border rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-gray-800 block">Stress-Dose Hydrocortisone</span>
                <span className="text-[11px] text-gray-500">
                  1–2 mg/kg IV for catecholamine-resistant refractory shock
                </span>
              </div>
              <input
                type="checkbox"
                checked={stressHydrocortisoneAdministered}
                onChange={(e) => setStressHydrocortisoneAdministered(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-5 w-5"
              />
            </div>

            <div>
              <textarea
                rows={2}
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Pediatric emergency notes: IO needle secured; blood cultures drawn before antibiotics."
                className="w-full text-xs border rounded-lg px-3 py-2"
              />
            </div>
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
              {submitting ? 'Initiating...' : 'Activate Septic Shock Resuscitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
