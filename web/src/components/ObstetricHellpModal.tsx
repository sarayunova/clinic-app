import React, { useState, useEffect } from 'react';
import {
  createObstetricHellpEpisode,
  updateObstetricHellpEpisode,
  type ObstetricHellpRecord,
} from '../api';
import {
  evaluateObstetricHellp,
  type ObstetricHellpEvaluationResult,
  type HepaticImagingFinding,
  type DeliveryTimingPlan,
} from '../obstetricHellpEngine';

interface Props {
  patientId: number;
  existingEpisode?: ObstetricHellpRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ObstetricHellpModal: React.FC<Props> = ({
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
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(
    existingEpisode?.gestational_age_weeks ?? 33.5
  );
  const [plateletCountPerUl, setPlateletCountPerUl] = useState<number>(
    existingEpisode?.platelet_count_per_ul ?? 45000
  );
  const [astUL, setAstUL] = useState<number>(existingEpisode?.ast_u_l ?? 140);
  const [altUL, setAltUL] = useState<number>(existingEpisode?.alt_u_l ?? 125);
  const [ldhUL, setLdhUL] = useState<number>(existingEpisode?.ldh_u_l ?? 820);
  const [totalBilirubinMgDl, setTotalBilirubinMgDl] = useState<number>(
    existingEpisode?.total_bilirubin_mg_dl ?? 1.8
  );
  const [schistocytesPresent, setSchistocytesPresent] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.schistocytes_present) : true
  );
  const [systolicBp, setSystolicBp] = useState<number>(existingEpisode?.systolic_bp ?? 165);
  const [diastolicBp, setDiastolicBp] = useState<number>(existingEpisode?.diastolic_bp ?? 108);
  const [epigastricRuqPain, setEpigastricRuqPain] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.epigastric_ruq_pain) : true
  );
  const [hepaticSubcapsularHematomaSuspected, setHepaticSubcapsularHematomaSuspected] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.hepatic_subcapsular_hematoma_suspected) : false
  );
  const [hepaticImagingPerformed, setHepaticImagingPerformed] = useState<HepaticImagingFinding>(
    existingEpisode?.hepatic_imaging_performed ?? 'none'
  );
  const [dexamethasonePulseInitiated, setDexamethasonePulseInitiated] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.dexamethasone_pulse_initiated) : true
  );
  const [magnesiumSulfateSeizureProphylaxis, setMagnesiumSulfateSeizureProphylaxis] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.magnesium_sulfate_seizure_prophylaxis) : true
  );
  const [plateletTransfusionAdministered, setPlateletTransfusionAdministered] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.platelet_transfusion_administered) : false
  );
  const [deliveryTimingPlan, setDeliveryTimingPlan] = useState<DeliveryTimingPlan>(
    existingEpisode?.delivery_timing_plan ?? 'planned_stabilization_and_delivery'
  );
  const [status, setStatus] = useState<string>(
    existingEpisode?.status ?? 'active_icu_resuscitation'
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    existingEpisode?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Live evaluation preview
  const [evaluation, setEvaluation] = useState<ObstetricHellpEvaluationResult | null>(null);

  useEffect(() => {
    try {
      const evalRes = evaluateObstetricHellp({
        gestationalAgeWeeks,
        plateletCountPerUl,
        astUL,
        altUL,
        ldhUL,
        totalBilirubinMgDl,
        schistocytesPresent,
        systolicBp,
        diastolicBp,
        epigastricRuqPain,
        hepaticSubcapsularHematomaSuspected,
        hepaticImagingPerformed,
        dexamethasonePulseInitiated,
        magnesiumSulfateSeizureProphylaxis,
        plateletTransfusionAdministered,
        deliveryTimingPlan,
      });
      setEvaluation(evalRes);
    } catch (e: any) {
      console.error('Eval error', e);
    }
  }, [
    gestationalAgeWeeks,
    plateletCountPerUl,
    astUL,
    altUL,
    ldhUL,
    totalBilirubinMgDl,
    schistocytesPresent,
    systolicBp,
    diastolicBp,
    epigastricRuqPain,
    hepaticSubcapsularHematomaSuspected,
    hepaticImagingPerformed,
    dexamethasonePulseInitiated,
    magnesiumSulfateSeizureProphylaxis,
    plateletTransfusionAdministered,
    deliveryTimingPlan,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      admissionId: existingEpisode?.admission_id || null,
      onsetDatetime,
      gestationalAgeWeeks: Number(gestationalAgeWeeks),
      plateletCountPerUl: Number(plateletCountPerUl),
      astUL: Number(astUL),
      altUL: Number(altUL),
      ldhUL: Number(ldhUL),
      totalBilirubinMgDl: Number(totalBilirubinMgDl),
      schistocytesPresent,
      systolicBp: Number(systolicBp),
      diastolicBp: Number(diastolicBp),
      epigastricRuqPain,
      hepaticSubcapsularHematomaSuspected,
      hepaticImagingPerformed,
      dexamethasonePulseInitiated,
      magnesiumSulfateSeizureProphylaxis,
      plateletTransfusionAdministered,
      deliveryTimingPlan,
      status: status as any,
      clinicalNotes: clinicalNotes || null,
    };

    try {
      if (existingEpisode) {
        await updateObstetricHellpEpisode(existingEpisode.id, payload);
      } else {
        await createObstetricHellpEpisode(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save HELLP episode:', err);
      setError(err?.message || 'Failed to save HELLP episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-rose-50/50 dark:bg-rose-950/20">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🩸</span>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {existingEpisode ? 'Edit Obstetric HELLP Episode' : 'New Obstetric HELLP Protocol Episode'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ACOG Practice Bulletin No. 222 • Mississippi Triple-Class System • Subcapsular Hematoma Surveillance
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
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-rose-600 text-white">
                    {evaluation.mississippiClassLabel}
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">
                    {evaluation.tennesseeClassificationLabel}
                  </span>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200">
                  {evaluation.urgencyTierLabel}
                </span>
              </div>

              {/* Hepatic complication badge */}
              <div className="text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Hepatic Risk: </span>
                <span className="font-bold text-rose-700 dark:text-rose-400">{evaluation.hepaticComplicationLabel}</span>
              </div>

              {/* Transfusion status */}
              <div className="text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Platelet Transfusion: </span>
                <span className={`font-semibold ${evaluation.isPlateletTransfusionIndicated ? 'text-amber-700 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}>
                  {evaluation.plateletTransfusionThresholdMessage}
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

          {/* Section 1: Demographics & Vital Signs */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              1. Gestational Age &amp; Hemodynamics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Onset Timestamp
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
                  Gestational Age (weeks)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="44"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={gestationalAgeWeeks}
                  onChange={(e) => setGestationalAgeWeeks(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Systolic BP (mmHg)
                </label>
                <input
                  type="number"
                  min="60"
                  max="260"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={systolicBp}
                  onChange={(e) => setSystolicBp(parseInt(e.target.value, 10) || 0)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Diastolic BP (mmHg)
                </label>
                <input
                  type="number"
                  min="30"
                  max="160"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={diastolicBp}
                  onChange={(e) => setDiastolicBp(parseInt(e.target.value, 10) || 0)}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Laboratory Triad (Hemolysis, Elevated Liver Enzymes, Low Platelets) */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              2. HELLP Diagnostic Laboratory Markers
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Platelets (/µL)
                </label>
                <input
                  type="number"
                  min="1000"
                  max="500000"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                  value={plateletCountPerUl}
                  onChange={(e) => setPlateletCountPerUl(parseInt(e.target.value, 10) || 0)}
                />
                <span className="text-[10px] text-slate-400">Class 1 &lt; 50k | Class 2 &lt; 100k</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  AST / SGOT (U/L)
                </label>
                <input
                  type="number"
                  min="5"
                  max="3000"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={astUL}
                  onChange={(e) => setAstUL(parseInt(e.target.value, 10) || 0)}
                />
                <span className="text-[10px] text-slate-400">Cutoff ≥ 70 U/L</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  ALT / SGPT (U/L)
                </label>
                <input
                  type="number"
                  min="5"
                  max="3000"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={altUL}
                  onChange={(e) => setAltUL(parseInt(e.target.value, 10) || 0)}
                />
                <span className="text-[10px] text-slate-400">Transaminitis indicator</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  LDH (U/L)
                </label>
                <input
                  type="number"
                  min="50"
                  max="10000"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono"
                  value={ldhUL}
                  onChange={(e) => setLdhUL(parseInt(e.target.value, 10) || 0)}
                />
                <span className="text-[10px] text-slate-400">Cutoff ≥ 600 U/L (Hemolysis)</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Total Bilirubin (mg/dL)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="30"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={totalBilirubinMgDl}
                  onChange={(e) => setTotalBilirubinMgDl(parseFloat(e.target.value) || 0)}
                />
                <span className="text-[10px] text-slate-400">Cutoff ≥ 1.2 mg/dL</span>
              </div>
            </div>

            <div className="mt-3 flex items-center">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-rose-600 focus:ring-rose-500"
                  checked={schistocytesPresent}
                  onChange={(e) => setSchistocytesPresent(e.target.checked)}
                />
                <span>Schistocytes / microangiopathic hemolytic anemia features on peripheral smear</span>
              </label>
            </div>
          </div>

          {/* Section 3: Hepatic Complications & Imaging */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              3. Hepatic Symptoms &amp; Imaging Surveillance
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded text-rose-600 focus:ring-rose-500"
                    checked={epigastricRuqPain}
                    onChange={(e) => setEpigastricRuqPain(e.target.checked)}
                  />
                  <span className="font-semibold text-rose-800 dark:text-rose-300">
                    Epigastric or Right Upper Quadrant (RUQ) Pain (Glisson capsule distension)
                  </span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded text-red-600 focus:ring-red-500"
                    checked={hepaticSubcapsularHematomaSuspected}
                    onChange={(e) => setHepaticSubcapsularHematomaSuspected(e.target.checked)}
                  />
                  <span className="font-bold text-red-700 dark:text-red-400">
                    Hepatic Subcapsular Hematoma Suspected / Referred Shoulder Pain
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Hepatic Imaging Performed
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={hepaticImagingPerformed}
                  onChange={(e) => setHepaticImagingPerformed(e.target.value as HepaticImagingFinding)}
                >
                  <option value="none">None Performed</option>
                  <option value="ultrasound_capsule_intact">Ultrasound: Capsule Intact / Normal Liver Parenchyma</option>
                  <option value="subcapsular_hematoma_contained">Ultrasound/CT: Contained Subcapsular Hematoma</option>
                  <option value="hepatic_rupture_hemoperitoneum">CT/US: Hepatic Rupture with Free Hemoperitoneum</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Therapeutic Interventions & Obstetric Delivery Plan */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              4. Pharmacotherapy &amp; Delivery Strategy
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded text-rose-600 focus:ring-rose-500"
                    checked={dexamethasonePulseInitiated}
                    onChange={(e) => setDexamethasonePulseInitiated(e.target.checked)}
                  />
                  <span>Dexamethasone Pulse (10 mg IV q12h x 2, then 5 mg IV q12h x 2)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                    checked={magnesiumSulfateSeizureProphylaxis}
                    onChange={(e) => setMagnesiumSulfateSeizureProphylaxis(e.target.checked)}
                  />
                  <span>Magnesium Sulfate IV Seizure Prophylaxis (Zuspan protocol)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded text-amber-600 focus:ring-amber-500"
                    checked={plateletTransfusionAdministered}
                    onChange={(e) => setPlateletTransfusionAdministered(e.target.checked)}
                  />
                  <span>Platelet Transfusion Administered</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Delivery Timing Plan
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={deliveryTimingPlan}
                  onChange={(e) => setDeliveryTimingPlan(e.target.value as DeliveryTimingPlan)}
                >
                  <option value="immediate_crash_delivery_under_2h">Immediate Crash Delivery (&lt; 2h / Rupture or Distress)</option>
                  <option value="planned_stabilization_and_delivery">Planned Stabilization &amp; Expedited Delivery</option>
                  <option value="steroid_window_24_to_48h_if_stable">Steroid Window (24–48h if reassuring &amp; &lt; 34 wks)</option>
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
                  <option value="suspected">Suspected</option>
                  <option value="active_icu_resuscitation">Active ICU Resuscitation</option>
                  <option value="operative_delivery">Operative Delivery</option>
                  <option value="postpartum_stabilization">Postpartum Stabilization</option>
                  <option value="recovering_platelets_rising">Recovering (Platelets Rising)</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 5: Clinical Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Clinical Notes &amp; Multidisciplinary MFM/ICU Log
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              placeholder="Document maternal hemodynamic response, platelet trends, urine output, fetal heart rate category..."
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
            {saving ? 'Saving...' : existingEpisode ? 'Update HELLP Protocol' : 'Create HELLP Protocol'}
          </button>
        </div>
      </div>
    </div>
  );
};
