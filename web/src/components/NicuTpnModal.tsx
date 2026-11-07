import React, { useState, useMemo } from 'react';
import { createNicuTpnPrescription, type NicuTpnPrescriptionRecord } from '../api';
import { calculateNicuTpn, type NicuTpnCalculationInput } from '../nicuTpnEngine';

interface NicuTpnModalProps {
  patientId: number;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (prescription: NicuTpnPrescriptionRecord) => void;
  defaultWeightKg?: number;
}

export const NicuTpnModal: React.FC<NicuTpnModalProps> = ({
  patientId,
  patientName,
  isOpen,
  onClose,
  onSuccess,
  defaultWeightKg = 1.2,
}) => {
  const [prescriptionDate, setPrescriptionDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [dayOfLife, setDayOfLife] = useState<number>(3);
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(29);
  const [birthWeightKg, setBirthWeightKg] = useState<number>(defaultWeightKg);
  const [currentWeightKg, setCurrentWeightKg] = useState<number>(defaultWeightKg);
  const [targetTotalFluidMlPerKgDay, setTargetTotalFluidMlPerKgDay] = useState<number>(120);
  const [enteralIntakeMlDay, setEnteralIntakeMlDay] = useState<number>(10);
  const [dextrosePercent, setDextrosePercent] = useState<number>(10);
  const [aminoAcidSolutionType, setAminoAcidSolutionType] = useState<
    'trophamine_6' | 'trophamine_10' | 'primene_10' | 'aminoven_infant_10'
  >('primene_10');
  const [aminoAcidGPerKgDay, setAminoAcidGPerKgDay] = useState<number>(3.0);
  const [lipidEmulsionType, setLipidEmulsionType] = useState<
    'intralipid_20' | 'smoflipid_20' | 'lipofundin_20'
  >('smoflipid_20');
  const [lipidGPerKgDay, setLipidGPerKgDay] = useState<number>(2.0);
  const [lipidInfusionHours, setLipidInfusionHours] = useState<number>(24);
  const [sodiumMeqPerKgDay, setSodiumMeqPerKgDay] = useState<number>(3.0);
  const [potassiumMeqPerKgDay, setPotassiumMeqPerKgDay] = useState<number>(2.0);
  const [calciumGluconateMlPerKgDay, setCalciumGluconateMlPerKgDay] = useState<number>(2.0);
  const [magnesiumSulfateMlDay, setMagnesiumSulfateMlDay] = useState<number>(0.2);
  const [phosphateMmolPerKgDay, setPhosphateMmolPerKgDay] = useState<number>(1.0);
  const [heparinUnitsPerMl, setHeparinUnitsPerMl] = useState<number>(0.5);
  const [multivitaminMviMlDay, setMultivitaminMviMlDay] = useState<number>(1.5);
  const [notes, setNotes] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calcResult = useMemo(() => {
    try {
      const input: NicuTpnCalculationInput = {
        currentWeightKg: Number(currentWeightKg) || 1.0,
        birthWeightKg: Number(birthWeightKg) || 1.0,
        dayOfLife: Number(dayOfLife) || 1,
        gestationalAgeWeeks: Number(gestationalAgeWeeks) || undefined,
        targetTotalFluidMlPerKgDay: Number(targetTotalFluidMlPerKgDay) || 100,
        enteralIntakeMlDay: Number(enteralIntakeMlDay) || 0,
        dextrosePercent: Number(dextrosePercent) || 10,
        aminoAcidSolutionType,
        aminoAcidGPerKgDay: Number(aminoAcidGPerKgDay) || 2.5,
        lipidEmulsionType,
        lipidGPerKgDay: Number(lipidGPerKgDay) || 1.5,
        sodiumMeqPerKgDay: Number(sodiumMeqPerKgDay) || 0,
        potassiumMeqPerKgDay: Number(potassiumMeqPerKgDay) || 0,
        calciumGluconateMlPerKgDay: Number(calciumGluconateMlPerKgDay) || 0,
        magnesiumSulfateMlDay: Number(magnesiumSulfateMlDay) || 0,
        phosphateMmolPerKgDay: Number(phosphateMmolPerKgDay) || 0,
        heparinUnitsPerMl: Number(heparinUnitsPerMl) || 0.5,
        multivitaminMviMlDay: Number(multivitaminMviMlDay) || 1.5,
      };
      return calculateNicuTpn(input);
    } catch {
      return null;
    }
  }, [
    currentWeightKg,
    birthWeightKg,
    dayOfLife,
    gestationalAgeWeeks,
    targetTotalFluidMlPerKgDay,
    enteralIntakeMlDay,
    dextrosePercent,
    aminoAcidSolutionType,
    aminoAcidGPerKgDay,
    lipidEmulsionType,
    lipidGPerKgDay,
    sodiumMeqPerKgDay,
    potassiumMeqPerKgDay,
    calciumGluconateMlPerKgDay,
    magnesiumSulfateMlDay,
    phosphateMmolPerKgDay,
    heparinUnitsPerMl,
    multivitaminMviMlDay,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await createNicuTpnPrescription({
        patientId,
        prescriptionDate,
        dayOfLife: Number(dayOfLife),
        gestationalAgeWeeks: gestationalAgeWeeks ? Number(gestationalAgeWeeks) : undefined,
        birthWeightKg: Number(birthWeightKg),
        currentWeightKg: Number(currentWeightKg),
        targetTotalFluidMlPerKgDay: Number(targetTotalFluidMlPerKgDay),
        enteralIntakeMlDay: Number(enteralIntakeMlDay),
        dextrosePercent: Number(dextrosePercent),
        aminoAcidSolutionType,
        aminoAcidGPerKgDay: Number(aminoAcidGPerKgDay),
        lipidEmulsionType,
        lipidGPerKgDay: Number(lipidGPerKgDay),
        lipidInfusionHours: Number(lipidInfusionHours),
        sodiumMeqPerKgDay: Number(sodiumMeqPerKgDay),
        potassiumMeqPerKgDay: Number(potassiumMeqPerKgDay),
        calciumGluconateMlPerKgDay: Number(calciumGluconateMlPerKgDay),
        magnesiumSulfateMlDay: Number(magnesiumSulfateMlDay),
        phosphateMmolPerKgDay: Number(phosphateMmolPerKgDay),
        heparinUnitsPerMl: Number(heparinUnitsPerMl),
        multivitaminMviMlDay: Number(multivitaminMviMlDay),
        notes: notes.trim() || undefined,
      });

      onSuccess(res.prescription);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to prescribe NICU TPN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>🧪</span> NICU Level-3 Total Parenteral Nutrition (TPN) Order
            </h2>
            <p className="text-xs text-blue-100 mt-1">
              Patient: <strong className="text-white">{patientName}</strong> | ESPGHAN/NNF Precision Compounding Protocol
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl font-bold leading-none p-1"
          >
            &times;
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Section 1: Demographics & Fluid targets */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
              <span>⚖️</span> Neonatal Vitals & Fluid Goals
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input
                  type="date"
                  value={prescriptionDate}
                  onChange={e => setPrescriptionDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Day of Life (DOL)</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={dayOfLife}
                  onChange={e => setDayOfLife(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Gestation (Weeks)</label>
                <input
                  type="number"
                  step="0.1"
                  min="22"
                  max="44"
                  value={gestationalAgeWeeks}
                  onChange={e => setGestationalAgeWeeks(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Birth Weight (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.3"
                  max="6"
                  value={birthWeightKg}
                  onChange={e => setBirthWeightKg(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-semibold text-blue-900">
                  Current Weight (kg) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.3"
                  max="6"
                  value={currentWeightKg}
                  onChange={e => setCurrentWeightKg(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border-2 border-blue-400 bg-blue-50/50 rounded text-sm font-bold text-blue-900 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Target Total Fluid (mL/kg/d)
                </label>
                <input
                  type="number"
                  step="5"
                  min="40"
                  max="220"
                  value={targetTotalFluidMlPerKgDay}
                  onChange={e => setTargetTotalFluidMlPerKgDay(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Enteral Intake (mL/d)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={enteralIntakeMlDay}
                  onChange={e => setEnteralIntakeMlDay(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-semibold text-indigo-900">
                  Dextrose % in Aqueous Base
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="5"
                  max="25"
                  value={dextrosePercent}
                  onChange={e => setDextrosePercent(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-indigo-300 bg-indigo-50/50 rounded text-sm font-semibold text-indigo-900 focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Macronutrients (Amino Acids & Lipids) */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
              <span>🥩</span> Macronutrient Dosing (Amino Acids & 20% Lipids)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2 p-3 bg-white rounded border border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Amino Acids Solution</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Type</label>
                    <select
                      value={aminoAcidSolutionType}
                      onChange={e => setAminoAcidSolutionType(e.target.value as any)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="primene_10">Primene 10%</option>
                      <option value="trophamine_10">TrophAmine 10%</option>
                      <option value="trophamine_6">TrophAmine 6%</option>
                      <option value="aminoven_infant_10">Aminoven Infant 10%</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Dose (g/kg/day)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="4.5"
                      value={aminoAcidGPerKgDay}
                      onChange={e => setAminoAcidGPerKgDay(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 p-3 bg-white rounded border border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Lipid Emulsion (20%)</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block text-xs text-slate-600 mb-1">Type</label>
                    <select
                      value={lipidEmulsionType}
                      onChange={e => setLipidEmulsionType(e.target.value as any)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="smoflipid_20">SMOFlipid 20%</option>
                      <option value="intralipid_20">Intralipid 20%</option>
                      <option value="lipofundin_20">Lipofundin 20%</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Dose (g/kg/d)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.0"
                      max="4.0"
                      value={lipidGPerKgDay}
                      onChange={e => setLipidGPerKgDay(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Infusion (Hours)</label>
                    <input
                      type="number"
                      min="12"
                      max="24"
                      value={lipidInfusionHours}
                      onChange={e => setLipidInfusionHours(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Electrolytes & Micronutrients */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
              <span>⚡</span> Electrolytes & Additives
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">Na (mEq/kg/d)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="8"
                  value={sodiumMeqPerKgDay}
                  onChange={e => setSodiumMeqPerKgDay(Number(e.target.value))}
                  className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">K (mEq/kg/d)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="5"
                  value={potassiumMeqPerKgDay}
                  onChange={e => setPotassiumMeqPerKgDay(Number(e.target.value))}
                  className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">10% Ca-Gluc (mL/kg/d)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="6"
                  value={calciumGluconateMlPerKgDay}
                  onChange={e => setCalciumGluconateMlPerKgDay(Number(e.target.value))}
                  className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">Phosphate (mmol/kg/d)</label>
                <input
                  type="number"
                  step="0.2"
                  min="0"
                  max="3"
                  value={phosphateMmolPerKgDay}
                  onChange={e => setPhosphateMmolPerKgDay(Number(e.target.value))}
                  className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">MgSO4 50% (mL/d)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={magnesiumSulfateMlDay}
                  onChange={e => setMagnesiumSulfateMlDay(Number(e.target.value))}
                  className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">Heparin (U/mL)</label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="2"
                  value={heparinUnitsPerMl}
                  onChange={e => setHeparinUnitsPerMl(Number(e.target.value))}
                  className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-medium">MVI Pediatric (mL/d)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="5"
                  value={multivitaminMviMlDay}
                  onChange={e => setMultivitaminMviMlDay(Number(e.target.value))}
                  className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Live Clinical Compounding Calculations & Safety Dashboard */}
          {calcResult && (
            <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 text-white p-4 rounded-xl shadow-inner space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-800/60 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <span>📊</span> Live TPN Compounding & Safety Analytics
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      calcResult.isCentralLineMandatory
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {calcResult.isCentralLineMandatory ? '⚠️ Central Line Mandatory' : '✓ Peripheral Access Safe'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white/10 p-2.5 rounded border border-white/10">
                  <span className="text-slate-400 block text-[11px]">Glucose Infusion (GIR)</span>
                  <span className="text-base font-extrabold text-amber-300">
                    {calcResult.glucoseInfusionRateGir} <span className="text-xs font-normal">mg/kg/min</span>
                  </span>
                  <span className="text-[10px] text-slate-300 block">Target: 4 - 8 mg/kg/min</span>
                </div>

                <div className="bg-white/10 p-2.5 rounded border border-white/10">
                  <span className="text-slate-400 block text-[11px]">Total Osmolarity</span>
                  <span
                    className={`text-base font-extrabold ${
                      calcResult.totalOsmolarityMOsmL > 900 ? 'text-rose-400' : 'text-emerald-300'
                    }`}
                  >
                    {calcResult.totalOsmolarityMOsmL} <span className="text-xs font-normal">mOsm/L</span>
                  </span>
                  <span className="text-[10px] text-slate-300 block">Max Peripheral: 900 mOsm/L</span>
                </div>

                <div className="bg-white/10 p-2.5 rounded border border-white/10">
                  <span className="text-slate-400 block text-[11px]">Energy / Calories</span>
                  <span className="text-base font-extrabold text-cyan-300">
                    {calcResult.caloriesPerKgDay} <span className="text-xs font-normal">kcal/kg/d</span>
                  </span>
                  <span className="text-[10px] text-slate-300 block">Total: {calcResult.totalCaloriesKcalDay} kcal/d</span>
                </div>

                <div className="bg-white/10 p-2.5 rounded border border-white/10">
                  <span className="text-slate-400 block text-[11px]">NPC : Nitrogen Ratio</span>
                  <span className="text-base font-extrabold text-violet-300">
                    {calcResult.nonProteinCalorieToNitrogenRatio} : 1
                  </span>
                  <span className="text-[10px] text-slate-300 block">Nitrogen: {calcResult.nitrogenGramsDay} g/d</span>
                </div>
              </div>

              {/* Compounding Volumes Quick Breakdown */}
              <div className="p-2.5 bg-black/30 rounded border border-white/10 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px]">Aqueous Fluid Base:</span>
                  <strong className="text-white">{calcResult.parenteralFluidMlDay} mL/d</strong> @ {calcResult.infusionRateMlHr} mL/h
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Amino Acids Vol:</span>
                  <strong className="text-amber-300">{calcResult.aminoAcidVolumeMl} mL/d</strong> ({calcResult.aminoAcidGramsDay} g)
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">20% Lipids Vol:</span>
                  <strong className="text-emerald-300">{calcResult.lipidVolumeMl} mL/d</strong> @ {calcResult.lipidInfusionRateMlHr} mL/h
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Dextrose Vol:</span>
                  <strong className="text-cyan-300">{calcResult.dextroseVolumeMl} mL/d</strong> ({calcResult.dextroseGramsDay} g)
                </div>
              </div>

              {/* Alerts */}
              {calcResult.isCentralLineMandatory && (
                <div className="p-2 bg-rose-950/80 border border-rose-500/50 rounded text-rose-200 text-xs">
                  {calcResult.osmolarityAlert}
                </div>
              )}
              {calcResult.girAlert && (
                <div className="p-2 bg-amber-950/80 border border-amber-500/50 rounded text-amber-200 text-xs">
                  {calcResult.girAlert}
                </div>
              )}
            </div>
          )}

          {/* Section 5: Clinical Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Physician Special Compounding & Infusion Instructions
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Infuse lipids via separate dedicated lumen with light-protective amber cover; titrate GIR based on Q4H glucometer logs."
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? 'Submitting Order...' : 'Sign & Submit TPN Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
