import React, { useState, useMemo } from 'react';
import { createMaternalVteAssessment, type MaternalVteAssessmentRecord } from '../api';
import { calculateMaternalVteScore, type MaternalVteRiskFactors } from '../maternalVteEngine';

interface MaternalVteModalProps {
  patientId: number;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (assessment: MaternalVteAssessmentRecord) => void;
  defaultWeightKg?: number;
  defaultGestationalWeeks?: number;
}

export const MaternalVteModal: React.FC<MaternalVteModalProps> = ({
  patientId,
  patientName,
  isOpen,
  onClose,
  onSuccess,
  defaultWeightKg = 68.0,
  defaultGestationalWeeks = 30.0,
}) => {
  const [assessmentType, setAssessmentType] = useState<'antenatal_early' | 'antenatal_intrapartum' | 'postnatal'>('antenatal_intrapartum');
  const [assessmentDatetime, setAssessmentDatetime] = useState<string>(new Date().toISOString().slice(0, 16));
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<string>(String(defaultGestationalWeeks));
  const [currentWeightKg, setCurrentWeightKg] = useState<string>(String(defaultWeightKg));
  const [heightCm, setHeightCm] = useState<string>('162');

  // Pre-existing factors
  const [previousVteUnprovokedOrEstrogen, setPreviousVteUnprovokedOrEstrogen] = useState(false);
  const [previousVteProvoked, setPreviousVteProvoked] = useState(false);
  const [knownHighRiskThrombophilia, setKnownHighRiskThrombophilia] = useState(false);
  const [medicalComorbidities, setMedicalComorbidities] = useState(false);
  const [surgicalProcedureInPregnancy, setSurgicalProcedureInPregnancy] = useState(false);
  const [grossVaricoseVeins, setGrossVaricoseVeins] = useState(false);
  const [ageOver35, setAgeOver35] = useState(false);
  const [parityGeq3, setParityGeq3] = useState(false);
  const [smoker, setSmoker] = useState(false);
  const [lowRiskThrombophilia, setLowRiskThrombophilia] = useState(false);
  const [familyHistoryVteFirstDegree, setFamilyHistoryVteFirstDegree] = useState(false);

  // Obstetric factors
  const [multiplePregnancy, setMultiplePregnancy] = useState(false);
  const [assistedReproductiveTechIvf, setAssistedReproductiveTechIvf] = useState(false);
  const [preEclampsia, setPreEclampsia] = useState(false);
  const [cesareanSectionEmergency, setCesareanSectionEmergency] = useState(false);
  const [cesareanSectionElective, setCesareanSectionElective] = useState(false);
  const [prolongedLaborOver24h, setProlongedLaborOver24h] = useState(false);
  const [postpartumHemorrhageOver1000ml, setPostpartumHemorrhageOver1000ml] = useState(false);
  const [pretermBirthUnder37w, setPretermBirthUnder37w] = useState(false);
  const [stillbirthInThisPregnancy, setStillbirthInThisPregnancy] = useState(false);

  // Transient factors
  const [systemicInfectionCurrent, setSystemicInfectionCurrent] = useState(false);
  const [immobilityBedrestOver3d, setImmobilityBedrestOver3d] = useState(false);
  const [hyperemesisOrDehydration, setHyperemesisOrDehydration] = useState(false);

  // LMWH Prescription state
  const [lmwhPrescribed, setLmwhPrescribed] = useState(true);
  const [lmwhAgent, setLmwhAgent] = useState<'enoxaparin' | 'dalteparin' | 'tinzaparin' | 'unfractionated_heparin'>('enoxaparin');
  const [antiEmbolicStockingsOrdered, setAntiEmbolicStockingsOrdered] = useState(true);
  const [clinicalNotes, setClinicalNotes] = useState('RCOG Green-top 37a assessment performed. Weight-banded prophylactic LMWH ordered.');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived BMI
  const bmi = useMemo(() => {
    const wt = Number(currentWeightKg) || 60;
    const htM = (Number(heightCm) || 160) / 100;
    return Math.round((wt / (htM * htM)) * 10) / 10;
  }, [currentWeightKg, heightCm]);

  // Scoring engine computation
  const calcResult = useMemo(() => {
    const factors: MaternalVteRiskFactors = {
      assessmentType,
      gestationalAgeWeeks: Number(gestationalAgeWeeks) || undefined,
      weightKg: Number(currentWeightKg) || 60,
      heightCm: Number(heightCm) || 160,
      bmi,
      previousVteUnprovokedOrEstrogen,
      previousVteProvoked,
      knownHighRiskThrombophilia,
      medicalComorbidities,
      surgicalProcedureInPregnancy,
      grossVaricoseVeins,
      ageOver35,
      parityGeq3,
      smoker,
      bmiGeq30: bmi >= 30 && bmi < 40,
      bmiGeq40: bmi >= 40,
      multiplePregnancy,
      assistedReproductiveTechIvf,
      preEclampsia,
      cesareanSectionEmergency,
      cesareanSectionElective,
      prolongedLaborOver24h,
      postpartumHemorrhageOver1000ml,
      pretermBirthUnder37w,
      stillbirthInThisPregnancy,
      systemicInfectionCurrent,
      immobilityBedrestOver3d,
      hyperemesisOrDehydration,
      lowRiskThrombophilia,
      familyHistoryVteFirstDegree,
    };
    return calculateMaternalVteScore(factors);
  }, [
    assessmentType,
    gestationalAgeWeeks,
    currentWeightKg,
    heightCm,
    bmi,
    previousVteUnprovokedOrEstrogen,
    previousVteProvoked,
    knownHighRiskThrombophilia,
    medicalComorbidities,
    surgicalProcedureInPregnancy,
    grossVaricoseVeins,
    ageOver35,
    parityGeq3,
    smoker,
    multiplePregnancy,
    assistedReproductiveTechIvf,
    preEclampsia,
    cesareanSectionEmergency,
    cesareanSectionElective,
    prolongedLaborOver24h,
    postpartumHemorrhageOver1000ml,
    pretermBirthUnder37w,
    stillbirthInThisPregnancy,
    systemicInfectionCurrent,
    immobilityBedrestOver3d,
    hyperemesisOrDehydration,
    lowRiskThrombophilia,
    familyHistoryVteFirstDegree,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        patientId,
        assessmentType,
        assessmentDatetime,
        gestationalAgeWeeks: assessmentType !== 'postnatal' && gestationalAgeWeeks ? Number(gestationalAgeWeeks) : null,
        currentWeightKg: Number(currentWeightKg),
        bmi,
        previousVteUnprovokedOrEstrogen,
        previousVteProvoked,
        knownHighRiskThrombophilia,
        medicalComorbidities,
        surgicalProcedureInPregnancy,
        grossVaricoseVeins,
        ageOver35,
        parityGeq3,
        smoker,
        bmiGeq30: bmi >= 30 && bmi < 40,
        bmiGeq40: bmi >= 40,
        multiplePregnancy,
        assistedReproductiveTechIvf,
        preEclampsia,
        cesareanSectionEmergency,
        cesareanSectionElective,
        prolongedLaborOver24h,
        postpartumHemorrhageOver1000ml,
        pretermBirthUnder37w,
        stillbirthInThisPregnancy,
        systemicInfectionCurrent,
        immobilityBedrestOver3d,
        hyperemesisOrDehydration,
        lowRiskThrombophilia,
        familyHistoryVteFirstDegree,
        lmwhPrescribed: calcResult.prophylaxisIndicated ? lmwhPrescribed : false,
        lmwhAgent: calcResult.prophylaxisIndicated ? lmwhAgent : null,
        lmwhDailyDoseMgOrUnits: calcResult.prophylaxisIndicated
          ? (lmwhAgent === 'dalteparin' ? calcResult.dalteparinDose : calcResult.enoxaparinDose)
          : null,
        weightTierBracket: calcResult.weightTierBracket,
        antiEmbolicStockingsOrdered,
        neuraxialAnesthesiaEligible: true,
        clinicalNotes,
      };

      const res = await createMaternalVteAssessment(payload);
      onSuccess(res.assessment);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record Maternal VTE risk assessment');
    } finally {
      setLoading(false);
    }
  };

  const tierBadgeColor =
    calcResult.riskTier === 'high_immediate_prophylaxis_indicated'
      ? 'bg-rose-600 text-white'
      : calcResult.riskTier === 'intermediate_prophylaxis_indicated'
      ? 'bg-amber-500 text-white'
      : 'bg-emerald-600 text-white';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-rose-900 flex items-center gap-2">
              <span>🩸</span> Maternal VTE Risk Assessment & Thromboprophylaxis
            </h2>
            <p className="text-xs text-gray-500">
              RCOG Green-top Guideline No. 37a / ACOG Practice Bulletin 196 • Patient: <span className="font-semibold">{patientName}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Demographics & Clinical Timing */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-rose-50/60 p-3.5 rounded-lg border border-rose-100">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Assessment Stage</label>
              <select
                value={assessmentType}
                onChange={(e) => setAssessmentType(e.target.value as any)}
                className="w-full text-xs border rounded p-1.5 mt-1 font-semibold text-rose-950"
              >
                <option value="antenatal_early">Antenatal (Booking / Early)</option>
                <option value="antenatal_intrapartum">Antenatal (Late / Admission)</option>
                <option value="postnatal">Postnatal (Post-Delivery / Puerperium)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Assessment Datetime</label>
              <input
                type="datetime-local"
                value={assessmentDatetime}
                onChange={(e) => setAssessmentDatetime(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Gestational Weeks</label>
              <input
                type="number"
                step="0.1"
                min="4"
                max="44"
                disabled={assessmentType === 'postnatal'}
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(e.target.value)}
                className="w-full text-xs border rounded p-1.5 mt-1 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Weight (kg)</label>
              <input
                type="number"
                step="0.5"
                min="35"
                max="250"
                value={currentWeightKg}
                onChange={(e) => setCurrentWeightKg(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Height (cm) & BMI</label>
              <div className="flex gap-1 items-center mt-1">
                <input
                  type="number"
                  step="1"
                  min="120"
                  max="220"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="w-20 text-xs border rounded p-1.5"
                />
                <span className={`text-xs font-bold px-1.5 py-1 rounded border ${bmi >= 30 ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-white'}`}>
                  {bmi} kg/m²
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Interactive Risk Factors Checklist */}
          <div className="border border-gray-200 rounded-lg p-3.5 space-y-3 bg-gray-50/50">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
              RCOG Green-top 37a Thrombosis Risk Factors Checklist
            </h3>

            {/* Pre-existing */}
            <div>
              <span className="text-[11px] font-bold text-rose-900 uppercase block mb-1.5">
                1. Pre-Existing Clinical Risk Factors
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={previousVteUnprovokedOrEstrogen}
                    onChange={(e) => setPreviousVteUnprovokedOrEstrogen(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Previous VTE unprovoked / estrogen-provoked <strong className="text-rose-700">(+4)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={previousVteProvoked}
                    onChange={(e) => setPreviousVteProvoked(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Previous VTE provoked by minor factor <strong className="text-rose-700">(+3)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={knownHighRiskThrombophilia}
                    onChange={(e) => setKnownHighRiskThrombophilia(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>High-risk thrombophilia (Antithrombin/Protein C-S def) <strong className="text-rose-700">(+3)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={medicalComorbidities}
                    onChange={(e) => setMedicalComorbidities(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Medical comorbidities (Cancer, SLE, Nephrotic, Heart) <strong className="text-rose-700">(+3)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={surgicalProcedureInPregnancy}
                    onChange={(e) => setSurgicalProcedureInPregnancy(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Surgical procedure during pregnancy or puerperium <strong className="text-rose-700">(+3)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={lowRiskThrombophilia}
                    onChange={(e) => setLowRiskThrombophilia(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Low-risk thrombophilia (Heterozygous FVL / Prothrombin) <strong className="text-rose-700">(+1)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={familyHistoryVteFirstDegree}
                    onChange={(e) => setFamilyHistoryVteFirstDegree(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Family history of VTE in first-degree relative <strong className="text-rose-700">(+1)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={grossVaricoseVeins}
                    onChange={(e) => setGrossVaricoseVeins(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Gross / symptomatic varicose veins <strong className="text-rose-700">(+1)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={ageOver35}
                    onChange={(e) => setAgeOver35(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Maternal age &gt; 35 years <strong className="text-rose-700">(+1)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={parityGeq3}
                    onChange={(e) => setParityGeq3(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Parity ≥ 3 <strong className="text-rose-700">(+1)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={smoker}
                    onChange={(e) => setSmoker(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Active cigarette smoker <strong className="text-rose-700">(+1)</strong></span>
                </label>
              </div>
            </div>

            {/* Obstetric & Delivery factors */}
            <div>
              <span className="text-[11px] font-bold text-rose-900 uppercase block mb-1.5">
                2. Obstetric & Intrapartum Factors
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={cesareanSectionEmergency}
                    onChange={(e) => setCesareanSectionEmergency(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Emergency Cesarean Section / CS in labor <strong className="text-rose-700">(+2 postnatal)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={cesareanSectionElective}
                    onChange={(e) => setCesareanSectionElective(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Elective Cesarean Section <strong className="text-rose-700">(+1 postnatal)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={preEclampsia}
                    onChange={(e) => setPreEclampsia(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Pre-eclampsia in current pregnancy <strong className="text-rose-700">(+1)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={multiplePregnancy}
                    onChange={(e) => setMultiplePregnancy(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Multiple pregnancy (twins/triplets) <strong className="text-rose-700">(+1)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={assistedReproductiveTechIvf}
                    onChange={(e) => setAssistedReproductiveTechIvf(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Assisted Reproductive Technology (IVF) <strong className="text-rose-700">(+1)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={prolongedLaborOver24h}
                    onChange={(e) => setProlongedLaborOver24h(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Prolonged labor &gt; 24 hours <strong className="text-rose-700">(+1 postnatal)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={postpartumHemorrhageOver1000ml}
                    onChange={(e) => setPostpartumHemorrhageOver1000ml(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Postpartum hemorrhage &gt; 1000 mL or transfusion <strong className="text-rose-700">(+1 postnatal)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={pretermBirthUnder37w}
                    onChange={(e) => setPretermBirthUnder37w(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Preterm birth &lt; 37 weeks <strong className="text-rose-700">(+1 postnatal)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={stillbirthInThisPregnancy}
                    onChange={(e) => setStillbirthInThisPregnancy(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Perinatal loss / stillbirth <strong className="text-rose-700">(+1 postnatal)</strong></span>
                </label>
              </div>
            </div>

            {/* Transient factors */}
            <div>
              <span className="text-[11px] font-bold text-rose-900 uppercase block mb-1.5">
                3. Transient Risk Factors
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={systemicInfectionCurrent}
                    onChange={(e) => setSystemicInfectionCurrent(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Current systemic infection / sepsis <strong className="text-rose-700">(+1)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={immobilityBedrestOver3d}
                    onChange={(e) => setImmobilityBedrestOver3d(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Immobility / bed rest &gt; 3 days <strong className="text-rose-700">(+1)</strong></span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-white rounded border cursor-pointer hover:bg-rose-50/40">
                  <input
                    type="checkbox"
                    checked={hyperemesisOrDehydration}
                    onChange={(e) => setHyperemesisOrDehydration(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Hyperemesis / dehydration <strong className="text-rose-700">(+1)</strong></span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Live Score Summary & Thromboprophylaxis Recommendation */}
          <div className="border-2 border-rose-200 rounded-xl p-4 bg-rose-50/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-rose-950 uppercase">RCOG VTE Risk Score Result:</span>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-2xl font-black text-rose-900">{calcResult.totalScore} Points</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${tierBadgeColor}`}>
                    {calcResult.riskTier.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-gray-700 block">Prophylaxis Status</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${calcResult.prophylaxisIndicated ? 'bg-rose-100 text-rose-900' : 'bg-emerald-100 text-emerald-900'}`}>
                  {calcResult.prophylaxisIndicated ? 'LMWH Prophylaxis Indicated' : 'Mobilization & Hydration'}
                </span>
              </div>
            </div>

            <p className="text-xs font-medium text-rose-900 bg-white p-2.5 rounded border border-rose-200">
              📋 <strong>Clinical Plan:</strong> {calcResult.recommendedDuration}
            </p>

            {/* Weight-banded dosing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-white p-3 rounded border">
              <div>
                <span className="text-gray-500 block text-[10px]">Weight Tier Bracket</span>
                <span className="font-bold text-gray-800">{calcResult.weightTierBracket}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Weight-Calibrated LMWH Dose</span>
                <span className="font-bold text-rose-900">
                  Enoxaparin: {calcResult.enoxaparinDose} | Dalteparin: {calcResult.dalteparinDose}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: LMWH Prescription & Stockings */}
          {calcResult.prophylaxisIndicated && (
            <div className="border border-sky-200 rounded-lg p-3 bg-sky-50/40 space-y-3">
              <h3 className="font-bold text-xs text-sky-900 uppercase">Prescribe Thromboprophylaxis</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">LMWH Agent</label>
                  <select
                    value={lmwhAgent}
                    onChange={(e) => setLmwhAgent(e.target.value as any)}
                    className="w-full text-xs border rounded p-1.5 mt-1 font-semibold text-sky-900"
                  >
                    <option value="enoxaparin">Enoxaparin (Clexane®) - {calcResult.enoxaparinDose}</option>
                    <option value="dalteparin">Dalteparin (Fragmin®) - {calcResult.dalteparinDose}</option>
                    <option value="tinzaparin">Tinzaparin (Innohep®)</option>
                    <option value="unfractionated_heparin">Unfractionated Heparin (Renal Failure)</option>
                  </select>
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={antiEmbolicStockingsOrdered}
                      onChange={(e) => setAntiEmbolicStockingsOrdered(e.target.checked)}
                      className="rounded text-sky-600"
                    />
                    <span>Graduated Anti-Embolic Stockings (GECS)</span>
                  </label>
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs font-semibold text-rose-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lmwhPrescribed}
                      onChange={(e) => setLmwhPrescribed(e.target.checked)}
                      className="rounded text-rose-600"
                    />
                    <span>Prescribe LMWH in E-Chart</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700">Clinical Notes</label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              className="w-full text-xs border rounded p-2 mt-1"
              placeholder="e.g. Risk score re-evaluated after emergency cesarean section. 10 days of postpartum enoxaparin prescribed."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-rose-700 text-white rounded text-xs font-bold hover:bg-rose-800 shadow"
            >
              {loading ? 'Saving...' : 'Save VTE Risk Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
