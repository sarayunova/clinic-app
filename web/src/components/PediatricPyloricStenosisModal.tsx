import React, { useState, useEffect } from 'react';
import {
  createPediatricPyloricStenosisEpisode,
  type PediatricPyloricStenosisRecord,
} from '../api';
import {
  evaluatePediatricPyloricStenosis,
  type PediatricPyloricStenosisResult,
} from '../pediatricPyloricStenosisEngine';

interface Props {
  patientId: number;
  existingEpisode?: PediatricPyloricStenosisRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricPyloricStenosisModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [presentationDatetime, setPresentationDatetime] = useState(
    existingEpisode?.presentation_datetime || new Date().toISOString().slice(0, 16),
  );
  const [ageWeeks, setAgeWeeks] = useState<number>(existingEpisode?.age_weeks ?? 5.0);
  const [weightKg, setWeightKg] = useState<number>(existingEpisode?.weight_kg ?? 3.8);
  const [birthWeightKg, setBirthWeightKg] = useState<number>(existingEpisode?.birth_weight_kg ?? 3.3);
  const [vomitingProjectileNonBilious, setVomitingProjectileNonBilious] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.vomiting_projectile_non_bilious) : true,
  );
  const [hungryVomiterBehavior, setHungryVomiterBehavior] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.hungry_vomiter_behavior) : true,
  );
  const [palpableOliveMass, setPalpableOliveMass] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.palpable_olive_mass) : true,
  );
  const [visibleGastricPeristalsis, setVisibleGastricPeristalsis] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.visible_gastric_peristalsis) : false,
  );
  const [dehydrationPercentage, setDehydrationPercentage] = useState<number>(
    existingEpisode?.dehydration_percentage ?? 7.0,
  );
  const [ultrasoundPerformed, setUltrasoundPerformed] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.ultrasound_performed) : true,
  );
  const [pyloricMuscleThicknessMm, setPyloricMuscleThicknessMm] = useState<string>(
    existingEpisode?.pyloric_muscle_thickness_mm?.toString() ?? '3.8',
  );
  const [pyloricChannelLengthMm, setPyloricChannelLengthMm] = useState<string>(
    existingEpisode?.pyloric_channel_length_mm?.toString() ?? '16.5',
  );
  const [pyloricTransverseDiameterMm, setPyloricTransverseDiameterMm] = useState<string>(
    existingEpisode?.pyloric_transverse_diameter_mm?.toString() ?? '12.0',
  );
  const [ultrasoundDiagnosticTargetSign, setUltrasoundDiagnosticTargetSign] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.ultrasound_diagnostic_target_sign) : true,
  );
  const [serumSodiumMeqL, setSerumSodiumMeqL] = useState<number>(
    existingEpisode?.serum_sodium_meq_l ?? 134,
  );
  const [serumPotassiumMeqL, setSerumPotassiumMeqL] = useState<number>(
    existingEpisode?.serum_potassium_meq_l ?? 3.4,
  );
  const [serumChlorideMeqL, setSerumChlorideMeqL] = useState<number>(
    existingEpisode?.serum_chloride_meq_l ?? 94,
  );
  const [serumBicarbonateMeqL, setSerumBicarbonateMeqL] = useState<number>(
    existingEpisode?.serum_bicarbonate_meq_l ?? 31,
  );
  const [bloodPh, setBloodPh] = useState<number>(existingEpisode?.blood_ph ?? 7.49);
  const [urineOutputMlKgHr, setUrineOutputMlKgHr] = useState<number>(
    existingEpisode?.urine_output_ml_kg_hr ?? 0.8,
  );
  const [fluidResuscitationRateMlHr, setFluidResuscitationRateMlHr] = useState<string>(
    existingEpisode?.fluid_resuscitation_rate_ml_hr?.toString() ?? '24',
  );
  const [potassiumSupplementationStarted, setPotassiumSupplementationStarted] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.potassium_supplementation_started) : false,
  );
  const [surgeryPerformed, setSurgeryPerformed] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.surgery_performed) : false,
  );
  const [pyloromyotomyTechnique, setPyloromyotomyTechnique] = useState<
    'laparoscopic_ramstedt' | 'open_right_upper_quadrant' | 'open_circumumbilical_tan_bianchi' | ''
  >(existingEpisode?.pyloromyotomy_technique ?? '');
  const [postopFeedingStarted, setPostopFeedingStarted] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.postop_feeding_started) : false,
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    existingEpisode?.clinical_notes ?? '',
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Real-time evaluation preview
  const [evaluation, setEvaluation] = useState<PediatricPyloricStenosisResult | null>(null);

  useEffect(() => {
    try {
      const res = evaluatePediatricPyloricStenosis({
        ageWeeks,
        weightKg,
        birthWeightKg,
        vomitingProjectileNonBilious,
        hungryVomiterBehavior,
        palpableOliveMass,
        visibleGastricPeristalsis,
        dehydrationPercentage,
        ultrasoundPerformed,
        pyloricMuscleThicknessMm: pyloricMuscleThicknessMm ? Number(pyloricMuscleThicknessMm) : undefined,
        pyloricChannelLengthMm: pyloricChannelLengthMm ? Number(pyloricChannelLengthMm) : undefined,
        pyloricTransverseDiameterMm: pyloricTransverseDiameterMm ? Number(pyloricTransverseDiameterMm) : undefined,
        ultrasoundDiagnosticTargetSign,
        serumSodiumMeqL,
        serumPotassiumMeqL,
        serumChlorideMeqL,
        serumBicarbonateMeqL,
        bloodPh,
        urineOutputMlKgHr,
        potassiumSupplementationStarted,
        surgeryPerformed,
      });
      setEvaluation(res);
    } catch (e: any) {
      // ignore
    }
  }, [
    ageWeeks,
    weightKg,
    birthWeightKg,
    vomitingProjectileNonBilious,
    hungryVomiterBehavior,
    palpableOliveMass,
    visibleGastricPeristalsis,
    dehydrationPercentage,
    ultrasoundPerformed,
    pyloricMuscleThicknessMm,
    pyloricChannelLengthMm,
    pyloricTransverseDiameterMm,
    ultrasoundDiagnosticTargetSign,
    serumSodiumMeqL,
    serumPotassiumMeqL,
    serumChlorideMeqL,
    serumBicarbonateMeqL,
    bloodPh,
    urineOutputMlKgHr,
    potassiumSupplementationStarted,
    surgeryPerformed,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await createPediatricPyloricStenosisEpisode({
        patientId,
        presentationDatetime,
        ageWeeks,
        weightKg,
        birthWeightKg,
        vomitingProjectileNonBilious,
        hungryVomiterBehavior,
        palpableOliveMass,
        visibleGastricPeristalsis,
        dehydrationPercentage,
        ultrasoundPerformed,
        pyloricMuscleThicknessMm: pyloricMuscleThicknessMm ? Number(pyloricMuscleThicknessMm) : null,
        pyloricChannelLengthMm: pyloricChannelLengthMm ? Number(pyloricChannelLengthMm) : null,
        pyloricTransverseDiameterMm: pyloricTransverseDiameterMm ? Number(pyloricTransverseDiameterMm) : null,
        ultrasoundDiagnosticTargetSign,
        serumSodiumMeqL,
        serumPotassiumMeqL,
        serumChlorideMeqL,
        serumBicarbonateMeqL,
        bloodPh,
        urineOutputMlKgHr,
        fluidResuscitationRateMlHr: fluidResuscitationRateMlHr ? Number(fluidResuscitationRateMlHr) : null,
        potassiumSupplementationStarted,
        surgeryPerformed,
        pyloromyotomyTechnique: pyloromyotomyTechnique || null,
        postopFeedingStarted,
        status: evaluation?.preOpClearance.allClearedForOr ? 'metabolically_cleared_for_or' : 'preop_fluid_resuscitation',
        clinicalNotes: clinicalNotes.trim() || null,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to initiate Pyloric Stenosis protocol');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 my-8">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Pediatric Pyloric Stenosis (IHPS) Resuscitation Protocol
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              APSA / BAPS Guidelines: Ultrasound Verification & Pre-Op Metabolic Clearance Criteria
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {/* Real-time Calculation Summary Card */}
          {evaluation && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
              <div>
                <span className="text-xs uppercase tracking-wider text-amber-800 dark:text-amber-300 font-semibold">Ultrasound Diagnosis</span>
                <p className="text-sm font-bold text-amber-900 dark:text-amber-100 mt-0.5">
                  {evaluation.ultrasoundDiagnostic ? 'Diagnostic for IHPS ✓' : 'Indeterminate / Sub-diagnostic'}
                </p>
                <span className="text-xs text-slate-500">{evaluation.ultrasoundDetails}</span>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-amber-800 dark:text-amber-300 font-semibold">Metabolic Derangement</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 capitalize">
                  {evaluation.metabolicDerangementTier.replace(/_/g, ' ')}
                </p>
                <span className="text-xs text-slate-500">Cl: {serumChlorideMeqL} | HCO3: {serumBicarbonateMeqL} | pH: {bloodPh}</span>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-amber-800 dark:text-amber-300 font-semibold">Surgical OR Clearance</span>
                <p className={`text-sm font-bold mt-0.5 ${evaluation.preOpClearance.allClearedForOr ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>
                  {evaluation.preOpClearance.allClearedForOr ? 'CLEARED FOR RAMSTEDT ✓' : 'NOT CLEARED - RESUSCITATE'}
                </p>
                <span className="text-xs text-slate-500">{evaluation.preOpClearance.clearanceSummary}</span>
              </div>
            </div>
          )}

          {/* Section 1: Presentation & Clinical Signs */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
              1. Infant Demographics & Clinical Presentation
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Presentation Datetime
                </label>
                <input
                  type="datetime-local"
                  required
                  value={presentationDatetime}
                  onChange={(e) => setPresentationDatetime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Age (weeks)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="52"
                  required
                  value={ageWeeks}
                  onChange={(e) => setAgeWeeks(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Current Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="1.0"
                  max="15.0"
                  required
                  value={weightKg}
                  onChange={(e) => setWeightKg(parseFloat(e.target.value) || 3.0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Birth Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="10.0"
                  required
                  value={birthWeightKg}
                  onChange={(e) => setBirthWeightKg(parseFloat(e.target.value) || 3.0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={vomitingProjectileNonBilious}
                  onChange={(e) => setVomitingProjectileNonBilious(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="font-semibold">Projectile Non-Bilious Vomiting</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={hungryVomiterBehavior}
                  onChange={(e) => setHungryVomiterBehavior(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span>"Hungry Vomiter" (Eager to re-feed immediately after vomiting)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={palpableOliveMass}
                  onChange={(e) => setPalpableOliveMass(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="font-semibold text-amber-700 dark:text-amber-400">Palpable Pyloric "Olive" Mass (RUQ)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={visibleGastricPeristalsis}
                  onChange={(e) => setVisibleGastricPeristalsis(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span>Visible Gastric Peristaltic Wave</span>
              </label>
            </div>
          </div>

          {/* Section 2: Ultrasound Diagnostic Metrics */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
              2. Abdominal Ultrasound Diagnostic Criteria
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Muscle Thickness (mm) [≥3.0 mm]
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 3.8"
                  value={pyloricMuscleThicknessMm}
                  onChange={(e) => setPyloricMuscleThicknessMm(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Channel Length (mm) [≥14 mm]
                </label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="e.g. 16.5"
                  value={pyloricChannelLengthMm}
                  onChange={(e) => setPyloricChannelLengthMm(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Diameter (mm) [Optional]
                </label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="e.g. 12.0"
                  value={pyloricTransverseDiameterMm}
                  onChange={(e) => setPyloricTransverseDiameterMm(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={ultrasoundDiagnosticTargetSign}
                    onChange={(e) => setUltrasoundDiagnosticTargetSign(e.target.checked)}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="font-semibold">Target / Doughnut Sign Observed</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Electrolytes & Metabolic Resuscitation */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
              3. Serum Electrolytes & Blood Gas Profile (Strict Pre-Op Criteria)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Sodium (mEq/L)
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={serumSodiumMeqL}
                  onChange={(e) => setSerumSodiumMeqL(parseFloat(e.target.value) || 135)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Potassium (mEq/L) [≥3.5]
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={serumPotassiumMeqL}
                  onChange={(e) => setSerumPotassiumMeqL(parseFloat(e.target.value) || 3.5)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${serumPotassiumMeqL < 3.5 ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white'}`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Chloride (mEq/L) [≥100]
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={serumChlorideMeqL}
                  onChange={(e) => setSerumChlorideMeqL(parseFloat(e.target.value) || 100)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${serumChlorideMeqL < 100 ? 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-900' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white'}`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  HCO3 (mEq/L) [≤28]
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={serumBicarbonateMeqL}
                  onChange={(e) => setSerumBicarbonateMeqL(parseFloat(e.target.value) || 28)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${serumBicarbonateMeqL > 28 ? 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-900' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white'}`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Blood pH
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={bloodPh}
                  onChange={(e) => setBloodPh(parseFloat(e.target.value) || 7.45)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  UOP (mL/kg/h) [≥1.0]
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={urineOutputMlKgHr}
                  onChange={(e) => setUrineOutputMlKgHr(parseFloat(e.target.value) || 0)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${urineOutputMlKgHr < 1.0 ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white'}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  IV Resuscitation Rate (mL/hr)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 24 (1.5x maintenance D5 0.45% NS)"
                  value={fluidResuscitationRateMlHr}
                  onChange={(e) => setFluidResuscitationRateMlHr(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={potassiumSupplementationStarted}
                    onChange={(e) => setPotassiumSupplementationStarted(e.target.checked)}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>KCl Added to IV Infusion (20 mEq/L once UOP confirmed &gt;1.0 mL/kg/h)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: Operative & Feeding Status */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
              4. Surgical Technique & Clinical Notes
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Pyloromyotomy Technique
                </label>
                <select
                  value={pyloromyotomyTechnique}
                  onChange={(e) => setPyloromyotomyTechnique(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="">Pending / Not Scheduled</option>
                  <option value="laparoscopic_ramstedt">Laparoscopic Ramstedt Pyloromyotomy</option>
                  <option value="open_right_upper_quadrant">Open Right Upper Quadrant Transverse</option>
                  <option value="open_circumumbilical_tan_bianchi">Open Circumumbilical (Tan-Bianchi)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Clinical & Resuscitation Notes
                </label>
                <input
                  type="text"
                  placeholder="NG tube decompression, gastric suction output, electrolyte trend..."
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-medium text-white shadow hover:bg-amber-700 disabled:opacity-50"
            >
              {submitting ? 'Initiating Protocol...' : 'Initiate IHPS Resuscitation Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
