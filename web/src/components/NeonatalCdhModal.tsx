import React, { useState, useEffect } from 'react';
import {
  createNeonatalCdhEpisode,
  updateNeonatalCdhEpisode,
  type NeonatalCdhRecord,
} from '../api';
import {
  evaluateNeonatalCdh,
  type NeonatalCdhEvaluationResult,
  type CdhDefectSide,
  type CdhSurgicalRepairStatus,
} from '../neonatalCdhEngine';

interface Props {
  patientId: number;
  initialEpisode?: NeonatalCdhRecord | null;
  existingEpisode?: NeonatalCdhRecord | null;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: (newId?: number) => void;
  onSaved?: () => void;
}

export const NeonatalCdhModal: React.FC<Props> = ({
  patientId,
  initialEpisode,
  existingEpisode,
  isOpen = true,
  onClose,
  onSuccess,
  onSaved,
}) => {
  if (!isOpen) return null;
  const currentEp = initialEpisode || existingEpisode;

  const [onsetDatetime, setOnsetDatetime] = useState(
    currentEp?.onset_datetime || new Date().toISOString().slice(0, 16)
  );
  const [ageHours, setAgeHours] = useState<number>(currentEp?.age_hours ?? 4);
  const [weightKg, setWeightKg] = useState<number>(currentEp?.weight_kg ?? 3.1);
  const [defectSide, setDefectSide] = useState<CdhDefectSide>(
    currentEp?.defect_side ?? 'left_bochdalek'
  );
  const [liverHerniationUp, setLiverHerniationUp] = useState<boolean>(
    currentEp ? Boolean(currentEp.liver_herniation_up) : false
  );
  const [observedExpectedLhrPercent, setObservedExpectedLhrPercent] = useState<number>(
    currentEp?.observed_expected_lhr_percent ?? 32.0
  );
  const [bagMaskAvoidedInDeliveryRoom, setBagMaskAvoidedInDeliveryRoom] = useState<boolean>(
    currentEp ? Boolean(currentEp.bag_mask_avoided_in_delivery_room) : true
  );
  const [replogleSumpDecompressionActive, setReplogleSumpDecompressionActive] = useState<boolean>(
    currentEp ? Boolean(currentEp.replogle_sump_decompression_active) : true
  );
  const [preductalSpo2Percent, setPreductalSpo2Percent] = useState<number>(
    currentEp?.preductal_spo2_percent ?? 92
  );
  const [postductalSpo2Percent, setPostductalSpo2Percent] = useState<number>(
    currentEp?.postductal_spo2_percent ?? 84
  );
  const [peakInspiratoryPressureCmh2o, setPeakInspiratoryPressureCmh2o] = useState<number>(
    currentEp?.peak_inspiratory_pressure_cmh2o ?? 22.0
  );
  const [peepCmh2o, setPeepCmh2o] = useState<number>(currentEp?.peep_cmh2o ?? 4.5);
  const [paco2Mmhg, setPaco2Mmhg] = useState<number>(existingEpisode?.paco2_mmhg ?? 55.0);
  const [inhaledNitricOxideActive, setInhaledNitricOxideActive] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.inhaled_nitric_oxide_active) : false
  );
  const [sildenafilInfusionActive, setSildenafilInfusionActive] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.sildenafil_infusion_active) : false
  );
  const [surgicalRepairStatus, setSurgicalRepairStatus] = useState<CdhSurgicalRepairStatus>(
    existingEpisode?.surgical_repair_status ?? 'preop_physiological_stabilization'
  );
  const [status, setStatus] = useState<string>(
    existingEpisode?.status ?? 'preop_gentle_ventilation'
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    existingEpisode?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live evaluation preview
  const [evaluation, setEvaluation] = useState<NeonatalCdhEvaluationResult | null>(null);

  useEffect(() => {
    try {
      const res = evaluateNeonatalCdh({
        defectSide,
        liverHerniationUp,
        observedExpectedLhrPercent,
        bagMaskAvoidedInDeliveryRoom,
        replogleSumpDecompressionActive,
        preductalSpo2Percent,
        postductalSpo2Percent,
        peakInspiratoryPressureCmh2o,
        peepCmh2o,
        paco2Mmhg,
        inhaledNitricOxideActive,
        sildenafilInfusionActive,
        surgicalRepairStatus,
      });
      setEvaluation(res);
    } catch (e: any) {
      console.error('CDH eval error:', e);
    }
  }, [
    defectSide,
    liverHerniationUp,
    observedExpectedLhrPercent,
    bagMaskAvoidedInDeliveryRoom,
    replogleSumpDecompressionActive,
    preductalSpo2Percent,
    postductalSpo2Percent,
    peakInspiratoryPressureCmh2o,
    peepCmh2o,
    paco2Mmhg,
    inhaledNitricOxideActive,
    sildenafilInfusionActive,
    surgicalRepairStatus,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      admissionId: existingEpisode?.admission_id || null,
      onsetDatetime,
      ageHours: Number(ageHours),
      weightKg: Number(weightKg),
      defectSide,
      liverHerniationUp,
      observedExpectedLhrPercent: Number(observedExpectedLhrPercent),
      bagMaskAvoidedInDeliveryRoom,
      replogleSumpDecompressionActive,
      preductalSpo2Percent: Number(preductalSpo2Percent),
      postductalSpo2Percent: Number(postductalSpo2Percent),
      peakInspiratoryPressureCmh2o: Number(peakInspiratoryPressureCmh2o),
      peepCmh2o: Number(peepCmh2o),
      paco2Mmhg: Number(paco2Mmhg),
      inhaledNitricOxideActive,
      sildenafilInfusionActive,
      surgicalRepairStatus,
      status: status as any,
      clinicalNotes: clinicalNotes || null,
    };

    try {
      if (currentEp) {
        await updateNeonatalCdhEpisode(currentEp.id, payload);
        if (onSuccess) onSuccess(currentEp.id);
      } else {
        const res = await createNeonatalCdhEpisode(payload);
        if (onSuccess) onSuccess(res.episode.id);
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save CDH episode:', err);
      setError(err?.message || 'Failed to save CDH episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-sky-50/50 dark:bg-sky-950/20">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🫁</span>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {existingEpisode ? 'Edit Neonatal CDH Episode' : 'New Neonatal CDH Protocol Episode'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                AAP / EURO-CDH Consortium: Gentle Ventilation • PPHN Shunt Surveillance • Delayed Surgical Repair
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
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${evaluation.hypoplasiaSeverity === 'extreme_severe' ? 'bg-red-600 text-white' : evaluation.hypoplasiaSeverity === 'moderate' ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    {evaluation.hypoplasiaSeverityLabel}
                  </span>
                  {evaluation.isLiverUp && (
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200">
                      Liver-Up (Patch Likely)
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
                  {evaluation.urgencyTierLabel}
                </span>
              </div>

              {/* Ductal Gradient & PPHN Shunting */}
              <div className="text-xs flex flex-wrap gap-4">
                <div>
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Pre/Post-Ductal Gradient: </span>
                  <span className={`font-mono font-bold ${evaluation.hasSignificantPphnShunt ? 'text-red-600' : 'text-emerald-600'}`}>
                    {evaluation.ductalGradientPercent}% {evaluation.hasSignificantPphnShunt ? '(Significant PPHN Shunt)' : '(Mild/Minimal)'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Gentle Ventilation: </span>
                  <span className={`font-bold ${evaluation.isGentleVentilationCompliant ? 'text-emerald-600' : 'text-red-600'}`}>
                    {evaluation.isGentleVentilationCompliant ? 'Compliant (PIP < 25)' : 'BAROTRAUMA RISK (PIP ≥ 25)'}
                  </span>
                </div>
              </div>

              {/* Readiness status */}
              <div className="text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded">
                <span className="font-bold text-slate-700 dark:text-slate-300">Surgical Readiness: </span>
                <span className={evaluation.isPhysiologicallyReadyForSurgery ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-amber-700 dark:text-amber-400'}>
                  {evaluation.readinessCriteriaStatus}
                </span>
              </div>

              {evaluation.alerts.length > 0 && (
                <div className="mt-2 text-xs text-red-700 dark:text-red-400 font-medium space-y-1 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-lg border border-red-200 dark:border-red-900">
                  {evaluation.alerts.map((al, idx) => (
                    <div key={idx} className="flex items-start gap-1">
                      <span>⚠️</span>
                      <span>{al}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 1: Demographics & Defect Anatomy */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              1. Defect Anatomy &amp; Antenatal Hypoplasia Staging
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Birth Timestamp
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
                  Age (hours) &amp; Weight (kg)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    max="720"
                    placeholder="Hrs"
                    required
                    className="w-1/2 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    value={ageHours}
                    onChange={(e) => setAgeHours(parseInt(e.target.value, 10) || 0)}
                  />
                  <input
                    type="number"
                    step="0.05"
                    min="0.4"
                    max="15"
                    placeholder="kg"
                    required
                    className="w-1/2 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    value={weightKg}
                    onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Defect Side
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={defectSide}
                  onChange={(e) => setDefectSide(e.target.value as CdhDefectSide)}
                >
                  <option value="left_bochdalek">Left Posterolateral (Bochdalek ~85%)</option>
                  <option value="right_bochdalek">Right Posterolateral (Bochdalek ~13%)</option>
                  <option value="bilateral_bochdalek">Bilateral Bochdalek (~1%)</option>
                  <option value="anterior_morgagni">Anterior Retrosternal (Morgagni ~2%)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Observed/Expected LHR (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="5"
                  max="100"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                  value={observedExpectedLhrPercent}
                  onChange={(e) => setObservedExpectedLhrPercent(parseFloat(e.target.value) || 0)}
                />
                <span className="text-[10px] text-slate-400">&lt;25% Severe | 25-35% Mod | &gt;35% Mild</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-purple-600 focus:ring-purple-500"
                  checked={liverHerniationUp}
                  onChange={(e) => setLiverHerniationUp(e.target.checked)}
                />
                <span className="font-semibold text-purple-800 dark:text-purple-300">
                  Intrathoracic Liver Herniation ("Liver-Up")
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                  checked={bagMaskAvoidedInDeliveryRoom}
                  onChange={(e) => setBagMaskAvoidedInDeliveryRoom(e.target.checked)}
                />
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                  Bag-Mask Avoided in Delivery Room (Direct Intubation)
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-sky-600 focus:ring-sky-500"
                  checked={replogleSumpDecompressionActive}
                  onChange={(e) => setReplogleSumpDecompressionActive(e.target.checked)}
                />
                <span>Replogle 10 Fr continuous low-suction active</span>
              </label>
            </div>
          </div>

          {/* Section 2: Gentle Ventilation & Blood Gas Parameters */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              2. Gentle Ventilation &amp; Pulmonary Mechanics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  PIP (cmH2O)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="10"
                  max="50"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                  value={peakInspiratoryPressureCmh2o}
                  onChange={(e) => setPeakInspiratoryPressureCmh2o(parseFloat(e.target.value) || 0)}
                />
                <span className="text-[10px] text-slate-400">Target &lt; 25 cmH2O</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  PEEP (cmH2O)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="2"
                  max="15"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={peepCmh2o}
                  onChange={(e) => setPeepCmh2o(parseFloat(e.target.value) || 0)}
                />
                <span className="text-[10px] text-slate-400">Target 4–5 cmH2O</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  PaCO2 (mmHg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="20"
                  max="120"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono"
                  value={paco2Mmhg}
                  onChange={(e) => setPaco2Mmhg(parseFloat(e.target.value) || 0)}
                />
                <span className="text-[10px] text-slate-400">Permissive 50–70 mmHg</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Pre-Ductal SpO2 (%)
                </label>
                <input
                  type="number"
                  min="40"
                  max="100"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={preductalSpo2Percent}
                  onChange={(e) => setPreductalSpo2Percent(parseInt(e.target.value, 10) || 0)}
                />
                <span className="text-[10px] text-slate-400">Right wrist probe</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Post-Ductal SpO2 (%)
                </label>
                <input
                  type="number"
                  min="40"
                  max="100"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={postductalSpo2Percent}
                  onChange={(e) => setPostductalSpo2Percent(parseInt(e.target.value, 10) || 0)}
                />
                <span className="text-[10px] text-slate-400">Lower limb probe</span>
              </div>
            </div>
          </div>

          {/* Section 3: Pulmonary Hypertension & Surgical Status */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              3. PPHN Vasodilators &amp; Delayed Repair Progression
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded text-sky-600 focus:ring-sky-500"
                    checked={inhaledNitricOxideActive}
                    onChange={(e) => setInhaledNitricOxideActive(e.target.checked)}
                  />
                  <span>Inhaled Nitric Oxide (iNO 10–20 ppm) Active</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                    checked={sildenafilInfusionActive}
                    onChange={(e) => setSildenafilInfusionActive(e.target.checked)}
                  />
                  <span>IV Sildenafil / Milrinone Infusion Active</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Surgical Repair Progression
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={surgicalRepairStatus}
                  onChange={(e) => setSurgicalRepairStatus(e.target.value as CdhSurgicalRepairStatus)}
                >
                  <option value="preop_physiological_stabilization">Pre-op Physiological Stabilization</option>
                  <option value="ready_for_repair_criteria_met">Readiness Criteria Met (Clear for OR)</option>
                  <option value="primary_repair_performed">Primary Suture Closure Performed</option>
                  <option value="prosthetic_patch_repair_performed">Prosthetic Gore-Tex Patch Performed</option>
                  <option value="ecmo_cannulated_bridge">ECMO Cannulation Bridge Active</option>
                </select>
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
                  <option value="preop_gentle_ventilation">Pre-op Gentle Ventilation</option>
                  <option value="pulmonary_hypertension_crisis">PPHN Crisis (Inotropes / iNO)</option>
                  <option value="in_operating_room_repair">In Operating Room Repair</option>
                  <option value="postop_ventilatory_weaning">Post-op Ventilatory Weaning</option>
                  <option value="recovering_extubated">Recovering Extubated</option>
                  <option value="resolved_discharged_home">Resolved Discharged Home</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Clinical Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              NICU &amp; Pediatric Surgical Log Notes
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              placeholder="Document echocardiogram findings (LV/RV dimensions, TR jet gradient), ventilatory index, inotropic doses, surgical patch details..."
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
            className="px-6 py-2 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? 'Saving...' : existingEpisode ? 'Update CDH Protocol' : 'Create CDH Protocol'}
          </button>
        </div>
      </div>
    </div>
  );
};
