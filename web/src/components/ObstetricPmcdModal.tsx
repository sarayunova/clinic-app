import React, { useState, useEffect } from 'react';
import {
  createObstetricPmcdEpisode,
  updateObstetricPmcdEpisode,
  type ObstetricPmcdRecord,
} from '../api';
import {
  evaluateObstetricPmcd,
  type ObstetricPmcdEvaluationResult,
  type PmcdArrestRhythm,
  type PmcdBeauChopsEtiology,
  type PmcdUterineClosureMethod,
} from '../obstetricPmcdEngine';

interface Props {
  patientId: number;
  initialEpisode?: ObstetricPmcdRecord | null;
  existingEpisode?: ObstetricPmcdRecord | null;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: (newId?: number) => void;
  onSaved?: () => void;
}

export const ObstetricPmcdModal: React.FC<Props> = ({
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

  const [arrestDatetime, setArrestDatetime] = useState(
    currentEp?.arrest_datetime || new Date().toISOString().slice(0, 16)
  );
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(
    currentEp?.gestational_age_weeks ?? 34.0
  );
  const [initialArrestRhythm, setInitialArrestRhythm] = useState<PmcdArrestRhythm>(
    currentEp?.initial_arrest_rhythm ?? 'pea'
  );
  const [cprInitiatedDatetime, setCprInitiatedDatetime] = useState(
    currentEp?.cpr_initiated_datetime || new Date().toISOString().slice(0, 16)
  );
  const [continuousLeftUterineDisplacement, setContinuousLeftUterineDisplacement] = useState<boolean>(
    currentEp ? Boolean(currentEp.continuous_left_uterine_displacement) : true
  );
  const [pmcdDecisionMinute, setPmcdDecisionMinute] = useState<number>(
    currentEp?.pmcd_decision_minute ?? 3.5
  );
  const [incisionDatetime, setIncisionDatetime] = useState<string>(
    currentEp?.incision_datetime || ''
  );
  const [infantDeliveryDatetime, setInfantDeliveryDatetime] = useState<string>(
    currentEp?.infant_delivery_datetime || ''
  );
  const [elapsedArrestToDeliveryMinutes, setElapsedArrestToDeliveryMinutes] = useState<number>(
    currentEp?.elapsed_arrest_to_delivery_minutes ?? 4.8
  );
  const [roscAchievedPostDelivery, setRoscAchievedPostDelivery] = useState<boolean>(
    currentEp ? Boolean(currentEp.rosc_achieved_post_delivery) : true
  );
  const [roscDatetime, setRoscDatetime] = useState<string>(
    currentEp?.rosc_datetime || ''
  );
  const [primaryEtiologyBeauChops, setPrimaryEtiologyBeauChops] = useState<PmcdBeauChopsEtiology>(
    currentEp?.primary_etiology_beau_chops ?? 'embolism_afe_pte'
  );
  const [uterineClosureMethod, setUterineClosureMethod] = useState<PmcdUterineClosureMethod>(
    currentEp?.uterine_closure_method ?? 'rapid_single_layer_in_situ'
  );
  const [maternalSurvivalStatus, setMaternalSurvivalStatus] = useState<ObstetricPmcdRecord['maternal_survival_status']>(
    currentEp?.maternal_survival_status ?? 'active_icu_targeted_temperature_management'
  );
  const [neonatalSurvivalStatus, setNeonatalSurvivalStatus] = useState<ObstetricPmcdRecord['neonatal_survival_status']>(
    currentEp?.neonatal_survival_status ?? 'nicu_active_hypothermia_hie'
  );
  const [status, setStatus] = useState<ObstetricPmcdRecord['status']>(
    currentEp?.status ?? 'cardiac_arrest_resuscitation'
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    currentEp?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ObstetricPmcdEvaluationResult | null>(null);

  useEffect(() => {
    try {
      const res = evaluateObstetricPmcd({
        gestationalAgeWeeks: Number(gestationalAgeWeeks),
        initialArrestRhythm,
        continuousLeftUterineDisplacement,
        pmcdDecisionMinute: Number(pmcdDecisionMinute),
        elapsedArrestToDeliveryMinutes: elapsedArrestToDeliveryMinutes ? Number(elapsedArrestToDeliveryMinutes) : null,
        roscAchievedPostDelivery,
        primaryEtiologyBeauChops,
        uterineClosureMethod,
      });
      setPreview(res);
    } catch {
      // preview calculation fallback
    }
  }, [
    gestationalAgeWeeks,
    initialArrestRhythm,
    continuousLeftUterineDisplacement,
    pmcdDecisionMinute,
    elapsedArrestToDeliveryMinutes,
    roscAchievedPostDelivery,
    primaryEtiologyBeauChops,
    uterineClosureMethod,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      admissionId: currentEp?.admission_id || null,
      arrestDatetime,
      gestationalAgeWeeks: Number(gestationalAgeWeeks),
      initialArrestRhythm,
      cprInitiatedDatetime,
      continuousLeftUterineDisplacement,
      pmcdDecisionMinute: Number(pmcdDecisionMinute),
      incisionDatetime: incisionDatetime || null,
      infantDeliveryDatetime: infantDeliveryDatetime || null,
      elapsedArrestToDeliveryMinutes: elapsedArrestToDeliveryMinutes ? Number(elapsedArrestToDeliveryMinutes) : null,
      roscAchievedPostDelivery,
      roscDatetime: roscDatetime || null,
      primaryEtiologyBeauChops,
      uterineClosureMethod,
      maternalSurvivalStatus,
      neonatalSurvivalStatus,
      status,
      clinicalNotes: clinicalNotes.trim() || null,
    };

    try {
      if (currentEp) {
        await updateObstetricPmcdEpisode(currentEp.id, payload);
        if (onSuccess) onSuccess(currentEp.id);
      } else {
        const res = await createObstetricPmcdEpisode(payload);
        if (onSuccess) onSuccess(res.episode.id);
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save PMCD episode:', err);
      setError(err?.message || 'Failed to save obstetric PMCD protocol record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-rose-500/10 dark:bg-rose-500/5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {currentEp ? 'Update Obstetric PMCD Episode' : 'New Resuscitative Hysterotomy (PMCD) Protocol'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                AHA CPR in Pregnancy / SOAP: 4-to-5 Minute Rule • Aortocaval Decompression • BEAU-CHOPS Etiologies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Live Evaluation Preview Banner */}
        {preview && (
          <div className="mx-6 mt-4 p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                Resuscitation Timing: {preview.timeComplianceLabel}
              </span>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200">
                {preview.urgencyTierLabel}
              </span>
            </div>
            {preview.alerts.length > 0 && (
              <div className="space-y-1 mt-2">
                {preview.alerts.map((alert, i) => (
                  <div key={i} className="text-xs text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1">
                    <span>🚨</span> {alert}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-xs rounded-lg bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">
              {error}
            </div>
          )}

          {/* Section 1: Arrest Time & Gestational Viability */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 border-b pb-1 dark:border-slate-700">
              1. Arrest Timing &amp; Hemodynamics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Cardiac Arrest Datetime
                </label>
                <input
                  type="datetime-local"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={arrestDatetime}
                  onChange={(e) => setArrestDatetime(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  CPR Initiated Time
                </label>
                <input
                  type="datetime-local"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={cprInitiatedDatetime}
                  onChange={(e) => setCprInitiatedDatetime(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Gestational Age (Weeks)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="16.0"
                  max="43.0"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={gestationalAgeWeeks}
                  onChange={(e) => setGestationalAgeWeeks(Number(e.target.value))}
                />
                <span className="text-[10px] text-slate-400">≥20 wks = Severe IVC compression</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Initial Arrest Rhythm
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={initialArrestRhythm}
                  onChange={(e) => setInitialArrestRhythm(e.target.value as PmcdArrestRhythm)}
                >
                  <option value="pea">PEA (Pulseless Electrical Activity)</option>
                  <option value="asystole">Asystole</option>
                  <option value="ventricular_fibrillation">Ventricular Fibrillation (VF)</option>
                  <option value="pulseless_vt">Pulseless VT</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: 4-to-5 Minute Rule & LUD */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 border-b pb-1 dark:border-slate-700">
              2. Resuscitative Hysterotomy Decision &amp; Timing Compliance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  PMCD Decision / Incision Minute
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.0"
                  max="60.0"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={pmcdDecisionMinute}
                  onChange={(e) => setPmcdDecisionMinute(Number(e.target.value))}
                />
                <span className="text-[10px] text-slate-400">AHA benchmark ≤ 4.0 minutes</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Elapsed Arrest-to-Delivery (Min)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.0"
                  max="120.0"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={elapsedArrestToDeliveryMinutes || ''}
                  onChange={(e) => setElapsedArrestToDeliveryMinutes(Number(e.target.value))}
                />
                <span className="text-[10px] text-slate-400">Target delivery ≤ 5.0 minutes</span>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 cursor-pointer w-full">
                  <input
                    type="checkbox"
                    className="rounded text-rose-600 focus:ring-rose-500"
                    checked={continuousLeftUterineDisplacement}
                    onChange={(e) => setContinuousLeftUterineDisplacement(e.target.checked)}
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Left Uterine Displacement Active
                    </div>
                    <div className="text-[10px] text-slate-500">Continuous manual LUD ≥30°</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Incision Datetime
                </label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={incisionDatetime}
                  onChange={(e) => setIncisionDatetime(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Infant Delivery Datetime
                </label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={infantDeliveryDatetime}
                  onChange={(e) => setInfantDeliveryDatetime(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  ROSC Datetime
                </label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={roscDatetime}
                  onChange={(e) => setRoscDatetime(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 3: BEAU-CHOPS Etiology & Surgical Technique */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 border-b pb-1 dark:border-slate-700">
              3. BEAU-CHOPS Etiology &amp; Surgical Closure
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Primary Arrest Etiology (BEAU-CHOPS)
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={primaryEtiologyBeauChops}
                  onChange={(e) => setPrimaryEtiologyBeauChops(e.target.value as PmcdBeauChopsEtiology)}
                >
                  <option value="embolism_afe_pte">E - Embolism (Amniotic Fluid / Pulmonary)</option>
                  <option value="bleeding_dic">B - Bleeding / DIC (Massive PPH)</option>
                  <option value="anesthetic_complication_last">A - Anesthetic (LAST / High Spinal)</option>
                  <option value="uterine_atony">U - Uterine Atony / Inversion</option>
                  <option value="cardiac_underlying">C - Cardiac Disease (PPCM, Ischemia, Arrhythmia)</option>
                  <option value="hypertension_preeclampsia">H - Hypertension / Eclampsia / PRES</option>
                  <option value="other_toxic_metabolic">O - Other Toxic / Metabolic / Hypoglycemia</option>
                  <option value="placenta_abruption_accreta">P - Placental Abruption / PAS Accreta</option>
                  <option value="sepsis_shock">S - Sepsis / Septic Shock</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Uterine Hemostatic Closure Method
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={uterineClosureMethod}
                  onChange={(e) => setUterineClosureMethod(e.target.value as PmcdUterineClosureMethod)}
                >
                  <option value="rapid_single_layer_in_situ">Rapid Single-Layer In Situ (Standard PMCD)</option>
                  <option value="hemostatic_packing_temporary_closure">Hemostatic Packing &amp; Temporary Damage Control</option>
                  <option value="emergent_hysterectomy">Emergent Cesarean Hysterectomy</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Protocol Status
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ObstetricPmcdRecord['status'])}
                >
                  <option value="cardiac_arrest_resuscitation">Cardiac Arrest Resuscitation</option>
                  <option value="hysterotomy_evacuation_active">Hysterotomy Evacuation Active</option>
                  <option value="post_rosc_intensive_care">Post-ROSC Intensive Care</option>
                  <option value="surgical_hemostasis_icu">Surgical Hemostasis / ICU Transfer</option>
                  <option value="convalescent_rehabilitation">Convalescent Rehabilitation</option>
                  <option value="case_closed">Case Closed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Maternal Post-ROSC Status
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={maternalSurvivalStatus}
                  onChange={(e) => setMaternalSurvivalStatus(e.target.value as ObstetricPmcdRecord['maternal_survival_status'])}
                >
                  <option value="active_icu_targeted_temperature_management">Active ICU TTM (32–36°C)</option>
                  <option value="post_cardiac_arrest_stable">Post-Cardiac Arrest Stable</option>
                  <option value="neurologically_intact_recovery">Neurologically Intact Recovery</option>
                  <option value="maternal_demise">Maternal Demise</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Neonatal Status
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={neonatalSurvivalStatus}
                  onChange={(e) => setNeonatalSurvivalStatus(e.target.value as ObstetricPmcdRecord['neonatal_survival_status'])}
                >
                  <option value="nicu_active_hypothermia_hie">NICU Active Therapeutic Hypothermia</option>
                  <option value="stable_nicu_survivor">Stable NICU Survivor</option>
                  <option value="neonatal_demise">Neonatal Demise</option>
                </select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 cursor-pointer w-full">
                  <input
                    type="checkbox"
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                    checked={roscAchievedPostDelivery}
                    onChange={(e) => setRoscAchievedPostDelivery(e.target.checked)}
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Maternal ROSC Achieved
                    </div>
                    <div className="text-[10px] text-slate-500">Return of spontaneous circulation</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: Clinical Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Obstetric Code Arrest &amp; Operative Hysterotomy Notes
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              placeholder="Document location of arrest, timeline of scalpel to infant delivery, blood products transfused, EtCO2 progression, vasopressor infusions..."
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
            className="px-6 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? 'Saving...' : currentEp ? 'Update PMCD Protocol' : 'Initiate PMCD Protocol'}
          </button>
        </div>
      </div>
    </div>
  );
};
