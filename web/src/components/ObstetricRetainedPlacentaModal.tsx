import React, { useState, useEffect } from 'react';
import {
  createObstetricRetainedPlacentaEpisode,
  type ObstetricRetainedPlacentaRecord,
} from '../api';
import {
  evaluateObstetricRetainedPlacenta,
  type ObstetricRetainedPlacentaResult,
} from '../obstetricRetainedPlacentaEngine';

interface Props {
  patientId: number;
  existingEpisode?: ObstetricRetainedPlacentaRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricRetainedPlacentaModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [deliveryDatetime, setDeliveryDatetime] = useState(
    existingEpisode?.delivery_datetime || new Date().toISOString().slice(0, 16),
  );
  const [thirdStageDurationMinutes, setThirdStageDurationMinutes] = useState<number>(
    existingEpisode?.third_stage_duration_minutes ?? 35,
  );
  const [activeManagementThirdStage, setActiveManagementThirdStage] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.active_management_third_stage) : true,
  );
  const [estimatedBloodLossMl, setEstimatedBloodLossMl] = useState<number>(
    existingEpisode?.estimated_blood_loss_ml ?? 350,
  );
  const [hemodynamicStability, setHemodynamicStability] = useState<
    'stable' | 'borderline_tachycardic' | 'decompensated_hypotensive_shock'
  >(existingEpisode?.hemodynamic_stability ?? 'stable');
  const [bladderCatheterized, setBladderCatheterized] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.bladder_catheterized) : false,
  );
  const [retainedPlacentaType, setRetainedPlacentaType] = useState<
    'placenta_adherens' | 'trapped_incarcerated_placenta' | 'partial_accreta_suspected'
  >(existingEpisode?.retained_placenta_type ?? 'placenta_adherens');
  const [iuvOxytocinAttempted, setIuvOxytocinAttempted] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.iuv_oxytocin_attempted) : false,
  );
  const [iuvOxytocinDoseIu, setIuvOxytocinDoseIu] = useState<number>(
    existingEpisode?.iuv_oxytocin_dose_iu ?? 20,
  );
  const [iuvOxytocinSuccessful, setIuvOxytocinSuccessful] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.iuv_oxytocin_successful) : false,
  );
  const [mropIndicated, setMropIndicated] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.mrop_indicated) : true,
  );
  const [mropPerformed, setMropPerformed] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.mrop_performed) : false,
  );
  const [mropDatetime, setMropDatetime] = useState<string>(
    existingEpisode?.mrop_datetime ?? '',
  );
  const [anesthesiaType, setAnesthesiaType] = useState<
    'spinal_regional' | 'epidural_topup' | 'general_anesthesia' | 'iv_sedation_analgesia' | ''
  >(existingEpisode?.anesthesia_type ?? '');
  const [placentaCompletePostRemoval, setPlacentaCompletePostRemoval] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.placenta_complete_post_removal) : true,
  );
  const [prophylacticAntibioticsGiven, setProphylacticAntibioticsGiven] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.prophylactic_antibiotics_given) : true,
  );
  const [postRemovalOxytocinInfusion, setPostRemovalOxytocinInfusion] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.post_removal_oxytocin_infusion) : true,
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    existingEpisode?.clinical_notes ?? '',
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Real-time evaluation preview
  const [evaluation, setEvaluation] = useState<ObstetricRetainedPlacentaResult | null>(null);

  useEffect(() => {
    try {
      const res = evaluateObstetricRetainedPlacenta({
        thirdStageDurationMinutes,
        activeManagementThirdStage,
        estimatedBloodLossMl,
        hemodynamicStability,
        bladderCatheterized,
        retainedPlacentaType,
        iuvOxytocinAttempted,
        iuvOxytocinSuccessful,
        mropPerformed,
        placentaCompletePostRemoval,
        prophylacticAntibioticsGiven,
        postRemovalOxytocinInfusion,
      });
      setEvaluation(res);
    } catch (e: any) {
      // ignore
    }
  }, [
    thirdStageDurationMinutes,
    activeManagementThirdStage,
    estimatedBloodLossMl,
    hemodynamicStability,
    bladderCatheterized,
    retainedPlacentaType,
    iuvOxytocinAttempted,
    iuvOxytocinSuccessful,
    mropPerformed,
    placentaCompletePostRemoval,
    prophylacticAntibioticsGiven,
    postRemovalOxytocinInfusion,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await createObstetricRetainedPlacentaEpisode({
        patientId,
        deliveryDatetime,
        thirdStageDurationMinutes,
        activeManagementThirdStage,
        estimatedBloodLossMl,
        hemodynamicStability,
        bladderCatheterized,
        retainedPlacentaType,
        iuvOxytocinAttempted,
        iuvOxytocinDoseIu,
        iuvOxytocinSuccessful,
        mropIndicated,
        mropPerformed,
        mropDatetime: mropDatetime || null,
        anesthesiaType: anesthesiaType || null,
        placentaCompletePostRemoval,
        prophylacticAntibioticsGiven,
        postRemovalOxytocinInfusion,
        status: mropPerformed ? 'post_removal_recovery' : 'under_conservative_management',
        clinicalNotes: clinicalNotes.trim() || null,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to initiate Retained Placenta protocol');
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
              Obstetric Retained Placenta & Emergent Manual Removal (MROP) Protocol
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              RCOG Green-top Guideline / WHO Postpartum Haemorrhage (PPH) Management
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60">
              <div>
                <span className="text-xs uppercase tracking-wider text-rose-700 dark:text-rose-300 font-semibold">Duration Classification</span>
                <p className="text-lg font-bold text-rose-900 dark:text-rose-100 mt-0.5">
                  {evaluation.durationCategoryLabel}
                </p>
                <span className="text-xs text-slate-500">Duration: {thirdStageDurationMinutes} min ({activeManagementThirdStage ? 'Active mgmt' : 'Expectant'})</span>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-rose-700 dark:text-rose-300 font-semibold">MROP Theater Urgency</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {evaluation.mropUrgencyLabel}
                </p>
                <span className="text-xs text-slate-500">Blood loss: {estimatedBloodLossMl} mL</span>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-rose-700 dark:text-rose-300 font-semibold">IUV Oxytocin Trial</span>
                <p className={`text-sm font-bold mt-0.5 ${evaluation.iuvProtocol.recommended ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'}`}>
                  {evaluation.iuvProtocol.recommended ? 'Recommended Trial (20 IU in 20 mL NS)' : 'Not Indicated / Bypass directly to OT'}
                </p>
              </div>
            </div>
          )}

          {/* Section 1: Timing & Third Stage Profile */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
              1. Delivery Timing & Third Stage Duration
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Delivery Datetime
                </label>
                <input
                  type="datetime-local"
                  required
                  value={deliveryDatetime}
                  onChange={(e) => setDeliveryDatetime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Third Stage Duration (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  required
                  value={thirdStageDurationMinutes}
                  onChange={(e) => setThirdStageDurationMinutes(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Estimated Blood Loss (mL)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="50"
                  required
                  value={estimatedBloodLossMl}
                  onChange={(e) => setEstimatedBloodLossMl(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={activeManagementThirdStage}
                  onChange={(e) => setActiveManagementThirdStage(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span>Active Management of Third Stage of Labor (Uterotonic + CCT + Cord clamp)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={bladderCatheterized}
                  onChange={(e) => setBladderCatheterized(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="font-semibold text-rose-700 dark:text-rose-400">
                  Bladder Catheterized (Decompress lower uterine segment)
                </span>
              </label>
            </div>
          </div>

          {/* Section 2: Clinical Etiology & Stability */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
              2. Hemodynamic Stability & Retained Placenta Subtype
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Hemodynamic Stability
                </label>
                <select
                  value={hemodynamicStability}
                  onChange={(e) => setHemodynamicStability(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="stable">Stable (Normotensive, HR &lt;100 bpm)</option>
                  <option value="borderline_tachycardic">Borderline / Tachycardic (HR 100-115, BP borderline)</option>
                  <option value="decompensated_hypotensive_shock">Decompensated Shock (SBP &lt;90, HR &gt;115, altered mental state)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Retained Placenta Presumed Type
                </label>
                <select
                  value={retainedPlacentaType}
                  onChange={(e) => setRetainedPlacentaType(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="placenta_adherens">Placenta Adherens (Failed detachment, no cleavage plane yet)</option>
                  <option value="trapped_incarcerated_placenta">Trapped / Incarcerated (Detached but cervix closed / hourglass ring)</option>
                  <option value="partial_accreta_suspected">Partial Placenta Accreta Spectrum Suspected (Myometrial invasion)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Conservative IUV Trial & MROP Status */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
              3. Intra-Umbilical Vein (IUV) Oxytocin & MROP Preparation
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={iuvOxytocinAttempted}
                  onChange={(e) => setIuvOxytocinAttempted(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span>IUV Oxytocin Injection Trialed</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  disabled={!iuvOxytocinAttempted}
                  checked={iuvOxytocinSuccessful}
                  onChange={(e) => setIuvOxytocinSuccessful(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span>IUV Successful (Placenta expelled spontaneously)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={mropPerformed}
                  onChange={(e) => setMropPerformed(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="font-bold text-rose-700 dark:text-rose-400">MROP Performed in Operating Theatre</span>
              </label>
            </div>

            {mropPerformed && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Anesthesia Modality Used
                  </label>
                  <select
                    value={anesthesiaType}
                    onChange={(e) => setAnesthesiaType(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="">Select Anesthesia...</option>
                    <option value="spinal_regional">Spinal Anesthesia</option>
                    <option value="epidural_topup">Epidural Top-up</option>
                    <option value="general_anesthesia">General Anesthesia with ETT (preferred if bleeding/shock)</option>
                    <option value="iv_sedation_analgesia">IV Sedation & Analgesia (emergency bed-side only)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    MROP Completion Time
                  </label>
                  <input
                    type="datetime-local"
                    value={mropDatetime}
                    onChange={(e) => setMropDatetime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Post-Removal Safety & Prophylaxis */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
              4. Post-Removal Safety Bundle & Prophylaxis
            </h4>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={placentaCompletePostRemoval}
                  onChange={(e) => setPlacentaCompletePostRemoval(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span>Placenta & Membranes Inspected Complete (No missing cotyledons)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={prophylacticAntibioticsGiven}
                  onChange={(e) => setProphylacticAntibioticsGiven(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span>Prophylactic Antibiotics Administered (Ampicillin 2g IV + Metronidazole 500mg)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={postRemovalOxytocinInfusion}
                  onChange={(e) => setPostRemovalOxytocinInfusion(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span>Post-Removal High-Dose Oxytocin Infusion (20-40 IU in 500 mL @ 125 mL/h)</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Clinical & Surgical Notes
              </label>
              <textarea
                rows={2}
                placeholder="Cleavage plane findings, uterine exploration notes, blood products transfused..."
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
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
              className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-medium text-white shadow hover:bg-rose-700 disabled:opacity-50"
            >
              {submitting ? 'Initiating Protocol...' : 'Initiate Retained Placenta Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
