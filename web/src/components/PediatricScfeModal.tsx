import React, { useState, useEffect } from 'react';
import {
  createPediatricScfeEpisode,
  updatePediatricScfeEpisode,
  type PediatricScfeRecord,
} from '../api';
import {
  evaluatePediatricScfe,
  type PediatricScfeEvaluationResult,
  type LoderStability,
  type AffectedHip,
  type ScfeSurgicalProcedure,
} from '../pediatricScfeEngine';

interface Props {
  patientId: number;
  existingEpisode?: PediatricScfeRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricScfeModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [onsetDatetime, setOnsetDatetime] = useState(
    existingEpisode?.onset_datetime || new Date().toISOString().slice(0, 16)
  );
  const [ageYears, setAgeYears] = useState<number>(existingEpisode?.age_years ?? 12.5);
  const [weightKg, setWeightKg] = useState<number>(existingEpisode?.weight_kg ?? 65.0);
  const [bmiPercentile, setBmiPercentile] = useState<number>(existingEpisode?.bmi_percentile ?? 96.0);
  const [affectedHip, setAffectedHip] = useState<AffectedHip>(
    existingEpisode?.affected_hip ?? 'left'
  );
  const [loderStability, setLoderStability] = useState<LoderStability>(
    existingEpisode?.loder_stability ?? 'unstable_cannot_bear_weight'
  );
  const [symptomDurationDays, setSymptomDurationDays] = useState<number>(
    existingEpisode?.symptom_duration_days ?? 3
  );
  const [southwickSlipAngleDegrees, setSouthwickSlipAngleDegrees] = useState<number>(
    existingEpisode?.southwick_slip_angle_degrees ?? 38.0
  );
  const [kleinLineTrethowanAbnormal, setKleinLineTrethowanAbnormal] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.klein_line_trethowan_abnormal) : true
  );
  const [referredKneeThighPain, setReferredKneeThighPain] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.referred_knee_thigh_pain) : true
  );
  const [endocrineDisorderSuspected, setEndocrineDisorderSuspected] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.endocrine_disorder_suspected) : false
  );
  const [strictNonWeightBearingEnforced, setStrictNonWeightBearingEnforced] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.strict_non_weight_bearing_enforced) : true
  );
  const [surgicalProcedurePerformed, setSurgicalProcedurePerformed] = useState<ScfeSurgicalProcedure>(
    existingEpisode?.surgical_procedure_performed ?? 'in_situ_single_cannulated_screw'
  );
  const [contralateralHipProphylacticPinning, setContralateralHipProphylacticPinning] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.contralateral_hip_prophylactic_pinning) : false
  );
  const [status, setStatus] = useState<string>(
    existingEpisode?.status ?? 'strict_bedrest_non_weight_bearing'
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    existingEpisode?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live calculation
  const [evaluation, setEvaluation] = useState<PediatricScfeEvaluationResult | null>(null);

  useEffect(() => {
    try {
      const res = evaluatePediatricScfe({
        ageYears,
        weightKg,
        bmiPercentile,
        affectedHip,
        loderStability,
        symptomDurationDays,
        southwickSlipAngleDegrees,
        kleinLineTrethowanAbnormal,
        referredKneeThighPain,
        endocrineDisorderSuspected,
        strictNonWeightBearingEnforced,
        surgicalProcedurePerformed,
        contralateralHipProphylacticPinning,
      });
      setEvaluation(res);
    } catch (e: any) {
      console.error('SCFE eval error:', e);
    }
  }, [
    ageYears,
    weightKg,
    bmiPercentile,
    affectedHip,
    loderStability,
    symptomDurationDays,
    southwickSlipAngleDegrees,
    kleinLineTrethowanAbnormal,
    referredKneeThighPain,
    endocrineDisorderSuspected,
    strictNonWeightBearingEnforced,
    surgicalProcedurePerformed,
    contralateralHipProphylacticPinning,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      admissionId: existingEpisode?.admission_id || null,
      onsetDatetime,
      ageYears: Number(ageYears),
      weightKg: Number(weightKg),
      bmiPercentile: Number(bmiPercentile),
      affectedHip,
      loderStability,
      symptomDurationDays: Number(symptomDurationDays),
      southwickSlipAngleDegrees: Number(southwickSlipAngleDegrees),
      kleinLineTrethowanAbnormal,
      referredKneeThighPain,
      endocrineDisorderSuspected,
      strictNonWeightBearingEnforced,
      surgicalProcedurePerformed,
      contralateralHipProphylacticPinning,
      status: status as any,
      clinicalNotes: clinicalNotes || null,
    };

    try {
      if (existingEpisode) {
        await updatePediatricScfeEpisode(existingEpisode.id, payload);
      } else {
        await createPediatricScfeEpisode(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save SCFE episode:', err);
      setError(err?.message || 'Failed to save SCFE episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦴</span>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {existingEpisode ? 'Edit Pediatric SCFE Protocol' : 'New Pediatric SCFE Episode'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                POSNA / AAOS: Loder Stability &amp; AVN Risk • Southwick Slip Angle • Avoid Forceful Reduction
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-xs">
              {error}
            </div>
          )}

          {/* Real-time Guidance Banner */}
          {evaluation && (
            <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${evaluation.isUnstableScfe ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    {evaluation.loderClassificationLabel}
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">
                    {evaluation.southwickSeverityLabel}
                  </span>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 font-mono">
                  AVN Risk: {evaluation.avascularNecrosisRiskPct}
                </span>
              </div>

              {evaluation.isContralateralProphylacticPinningIndicated && (
                <div className="text-xs font-medium text-purple-700 dark:text-purple-300">
                  🟣 {evaluation.contralateralPinningRationale}
                </div>
              )}

              {evaluation.diagnosticKneePainPitfallAlert && (
                <div className="text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-800">
                  ⚠️ <strong>Diagnostic Pitfall:</strong> Referred knee/distal thigh pain via obturator nerve branches frequently delays diagnosis of SCFE. Always obtain frog-leg lateral pelvis radiographs!
                </div>
              )}

              {evaluation.alerts.length > 0 && (
                <div className="mt-2 text-xs text-red-700 dark:text-red-400 font-medium space-y-1 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-lg border border-red-200 dark:border-red-900">
                  {evaluation.alerts.map((al, idx) => (
                    <div key={idx} className="flex items-start gap-1">
                      <span>🚨</span>
                      <span>{al}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 1: Demographics & Presentation */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              1. Demographics, Affected Side &amp; Stability
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Presentation Timestamp
                </label>
                <input
                  type="datetime-local"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={onsetDatetime}
                  onChange={(e) => setOnsetDatetime(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Age (years)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="5"
                  max="21"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={ageYears}
                  onChange={(e) => setAgeYears(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Weight (kg) &amp; BMI %ile
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="15"
                    max="200"
                    placeholder="kg"
                    required
                    className="w-1/2 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    value={weightKg}
                    onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                  />
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="100"
                    placeholder="BMI %"
                    required
                    className="w-1/2 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    value={bmiPercentile}
                    onChange={(e) => setBmiPercentile(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Affected Hip
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={affectedHip}
                  onChange={(e) => setAffectedHip(e.target.value as AffectedHip)}
                >
                  <option value="left">Left Hip</option>
                  <option value="right">Right Hip</option>
                  <option value="bilateral">Bilateral Hips</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Loder Stability & Symptoms */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              2. Loder Clinical Stability &amp; Symptom Chronicity
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Loder Stability Criterion
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-semibold"
                  value={loderStability}
                  onChange={(e) => setLoderStability(e.target.value as LoderStability)}
                >
                  <option value="unstable_cannot_bear_weight">Unstable (Cannot bear weight even with crutches) - 40–50% AVN</option>
                  <option value="stable_able_to_ambulate">Stable (Able to ambulate / weight bear) - &lt; 2% AVN</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Symptom Duration (days)
                </label>
                <input
                  type="number"
                  min="0"
                  max="720"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={symptomDurationDays}
                  onChange={(e) => setSymptomDurationDays(parseInt(e.target.value, 10) || 0)}
                />
                <span className="text-[10px] text-slate-400">Acute &lt; 3 wks | Chronic ≥ 3 wks | Acute-on-chronic</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Southwick Slip Angle (degrees)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="90"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                  value={southwickSlipAngleDegrees}
                  onChange={(e) => setSouthwickSlipAngleDegrees(parseFloat(e.target.value) || 0)}
                />
                <span className="text-[10px] text-slate-400">Mild &lt; 30° | Mod 30–50° | Severe &gt; 50°</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-amber-600 focus:ring-amber-500"
                  checked={kleinLineTrethowanAbnormal}
                  onChange={(e) => setKleinLineTrethowanAbnormal(e.target.checked)}
                />
                <span>Klein's line fails to intersect lateral epiphysis (Trethowan sign positive)</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-amber-600 focus:ring-amber-500"
                  checked={referredKneeThighPain}
                  onChange={(e) => setReferredKneeThighPain(e.target.checked)}
                />
                <span className="font-semibold text-amber-800 dark:text-amber-300">
                  Referred knee or medial thigh pain (obturator nerve referral pitfall)
                </span>
              </label>
            </div>
          </div>

          {/* Section 3: Etiology & Preop Safety */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              3. Underlying Factors &amp; Immediate Precautions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-purple-600 focus:ring-purple-500"
                  checked={endocrineDisorderSuspected}
                  onChange={(e) => setEndocrineDisorderSuspected(e.target.checked)}
                />
                <span>Endocrine / Metabolic Etiology (Hypothyroidism, panhypopituitarism, renal osteodystrophy)</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-red-600 focus:ring-red-500"
                  checked={strictNonWeightBearingEnforced}
                  onChange={(e) => setStrictNonWeightBearingEnforced(e.target.checked)}
                />
                <span className="font-bold text-red-700 dark:text-red-400">
                  Strict non-weight bearing enforced (Wheelchair / stretcher only, no crutches allowed if unstable)
                </span>
              </label>
            </div>
          </div>

          {/* Section 4: Surgical Management & Status */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              4. Surgical Fixation &amp; Protocol Status
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Surgical Procedure Performed
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={surgicalProcedurePerformed}
                  onChange={(e) => setSurgicalProcedurePerformed(e.target.value as ScfeSurgicalProcedure)}
                >
                  <option value="in_situ_single_cannulated_screw">In-Situ Single Percutaneous Cannulated Screw (6.5–7.3 mm)</option>
                  <option value="none_preoperative_traction">None / Pre-op Bedrest</option>
                  <option value="two_screw_fixation">Two-Screw Fixation (Severe Slip)</option>
                  <option value="open_modified_dunn_procedure">Open Modified Dunn Procedure (Surgical Hip Dislocation)</option>
                  <option value="contralateral_prophylactic_pinning_only">Contralateral Prophylactic Pinning Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Contralateral Hip Pinning
                </label>
                <div className="pt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                      checked={contralateralHipProphylacticPinning}
                      onChange={(e) => setContralateralHipProphylacticPinning(e.target.checked)}
                    />
                    <span>Contralateral prophylactic pinning performed</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Episode Status
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="strict_bedrest_non_weight_bearing">Strict Bedrest Non-Weight Bearing</option>
                  <option value="urgent_preop_radiographic_workup">Urgent Pre-op Radiographic Workup</option>
                  <option value="in_situ_percutaneous_pinning_performed">In-Situ Percutaneous Pinning Performed</option>
                  <option value="postop_protected_weight_bearing">Post-op Protected Weight Bearing</option>
                  <option value="contralateral_surveillance">Contralateral Surveillance</option>
                  <option value="resolved_physeal_fusion">Resolved (Physeal Fusion Complete)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 5: Clinical Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Operative Details &amp; Orthopedic Follow-up Notes
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              placeholder="Document fluoroscopic screw trajectory (center-center on AP & lateral), threads crossing physis by 4-5 threads, lack of joint penetration on approach-withdrawal view..."
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? 'Saving...' : existingEpisode ? 'Update SCFE Protocol' : 'Create SCFE Protocol'}
          </button>
        </div>
      </div>
    </div>
  );
};
