import React, { useState, useEffect } from 'react';
import {
  createPediatricGbsEpisode,
  updatePediatricGbsEpisode,
  type PediatricGbsRecord,
} from '../api';
import {
  evaluatePediatricGbs,
  type PediatricGbsEvaluationResult,
  type GbsAntecedentInfection,
  type GbsBrightonLevel,
  type GbsImmunotherapyRegimen,
} from '../pediatricGbsEngine';

interface Props {
  patientId: number;
  initialEpisode?: PediatricGbsRecord | null;
  existingEpisode?: PediatricGbsRecord | null;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: (newId?: number) => void;
  onSaved?: () => void;
}

export const PediatricGbsModal: React.FC<Props> = ({
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
  const [ageYears, setAgeYears] = useState<number>(currentEp?.age_years ?? 6.5);
  const [weightKg, setWeightKg] = useState<number>(currentEp?.weight_kg ?? 22.0);
  const [antecedentInfectionType, setAntecedentInfectionType] = useState<GbsAntecedentInfection>(
    currentEp?.antecedent_infection_type ?? 'campylobacter_gastroenteritis'
  );
  const [brightonCriteriaLevel, setBrightonCriteriaLevel] = useState<GbsBrightonLevel>(
    currentEp?.brighton_criteria_level ?? 'level_1_highest_certainty_csf_ncs'
  );
  const [hughesDisabilityScore, setHughesDisabilityScore] = useState<number>(
    currentEp?.hughes_disability_score ?? 4
  );
  const [ascendingSymmetricWeakness, setAscendingSymmetricWeakness] = useState<boolean>(
    currentEp ? Boolean(currentEp.ascending_symmetric_weakness) : true
  );
  const [areflexiaOrHyporeflexia, setAreflexiaOrHyporeflexia] = useState<boolean>(
    currentEp ? Boolean(currentEp.areflexia_or_hyporeflexia) : true
  );
  const [csfProteinMgDl, setCsfProteinMgDl] = useState<number>(
    currentEp?.csf_protein_mg_dl ?? 128.0
  );
  const [csfWbcCountPerUl, setCsfWbcCountPerUl] = useState<number>(
    currentEp?.csf_wbc_count_per_ul ?? 2
  );
  const [vitalCapacityMlKg, setVitalCapacityMlKg] = useState<number>(
    currentEp?.vital_capacity_ml_kg ?? 17.5
  );
  const [negativeInspiratoryForceCmh2o, setNegativeInspiratoryForceCmh2o] = useState<number>(
    currentEp?.negative_inspiratory_force_cmh2o ?? -24.0
  );
  const [peakExpiratoryPressureCmh2o, setPeakExpiratoryPressureCmh2o] = useState<number>(
    currentEp?.peak_expiratory_pressure_cmh2o ?? 32.0
  );
  const [dysautonomiaSignsPresent, setDysautonomiaSignsPresent] = useState<boolean>(
    currentEp ? Boolean(currentEp.dysautonomia_signs_present) : true
  );
  const [immunotherapyRegimen, setImmunotherapyRegimen] = useState<GbsImmunotherapyRegimen>(
    currentEp?.immunotherapy_regimen ?? 'ivig_2g_kg_over_2_days'
  );
  const [corticosteroidsAvoided, setCorticosteroidsAvoided] = useState<boolean>(
    currentEp ? Boolean(currentEp.corticosteroids_avoided) : true
  );
  const [status, setStatus] = useState<PediatricGbsRecord['status']>(
    currentEp?.status ?? 'acute_diagnostic_evaluation'
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    currentEp?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PediatricGbsEvaluationResult | null>(null);

  useEffect(() => {
    try {
      const res = evaluatePediatricGbs({
        ageYears: Number(ageYears),
        weightKg: Number(weightKg),
        antecedentInfectionType,
        brightonCriteriaLevel,
        hughesDisabilityScore: Number(hughesDisabilityScore),
        ascendingSymmetricWeakness,
        areflexiaOrHyporeflexia,
        csfProteinMgDl: Number(csfProteinMgDl),
        csfWbcCountPerUl: Number(csfWbcCountPerUl),
        vitalCapacityMlKg: Number(vitalCapacityMlKg),
        negativeInspiratoryForceCmh2o: Number(negativeInspiratoryForceCmh2o),
        peakExpiratoryPressureCmh2o: Number(peakExpiratoryPressureCmh2o),
        dysautonomiaSignsPresent,
        immunotherapyRegimen,
        corticosteroidsAvoided,
      });
      setPreview(res);
    } catch {
      // preview calculation fallback
    }
  }, [
    ageYears,
    weightKg,
    antecedentInfectionType,
    brightonCriteriaLevel,
    hughesDisabilityScore,
    ascendingSymmetricWeakness,
    areflexiaOrHyporeflexia,
    csfProteinMgDl,
    csfWbcCountPerUl,
    vitalCapacityMlKg,
    negativeInspiratoryForceCmh2o,
    peakExpiratoryPressureCmh2o,
    dysautonomiaSignsPresent,
    immunotherapyRegimen,
    corticosteroidsAvoided,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      admissionId: currentEp?.admission_id || null,
      onsetDatetime,
      ageYears: Number(ageYears),
      weightKg: Number(weightKg),
      antecedentInfectionType,
      brightonCriteriaLevel,
      hughesDisabilityScore: Number(hughesDisabilityScore),
      ascendingSymmetricWeakness,
      areflexiaOrHyporeflexia,
      csfProteinMgDl: Number(csfProteinMgDl),
      csfWbcCountPerUl: Number(csfWbcCountPerUl),
      vitalCapacityMlKg: Number(vitalCapacityMlKg),
      negativeInspiratoryForceCmh2o: Number(negativeInspiratoryForceCmh2o),
      peakExpiratoryPressureCmh2o: Number(peakExpiratoryPressureCmh2o),
      dysautonomiaSignsPresent,
      immunotherapyRegimen,
      corticosteroidsAvoided,
      status,
      clinicalNotes: clinicalNotes.trim() || null,
    };

    try {
      if (currentEp) {
        await updatePediatricGbsEpisode(currentEp.id, payload);
        if (onSuccess) onSuccess(currentEp.id);
      } else {
        const res = await createPediatricGbsEpisode(payload);
        if (onSuccess) onSuccess(res.episode.id);
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save pediatric GBS episode:', err);
      setError(err?.message || 'Failed to save pediatric GBS episode record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-indigo-500/10 dark:bg-indigo-500/5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧠</span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {currentEp ? 'Update Pediatric GBS Episode' : 'New Pediatric Guillain-Barré Syndrome (GBS) Protocol'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Brighton Criteria Levels 1–4 • The 20/30/40 Rule • Hughes Disability Scale • IVIG 2 g/kg Weight Dosing
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

        {/* Live Calculation Preview Banner */}
        {preview && (
          <div className="mx-6 mt-4 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                Functional Status: {preview.hughesDisabilityLabel} • Total IVIG: {preview.ivigDoseGramsTotal} g
              </span>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">
                {preview.urgencyTierLabel}
              </span>
            </div>
            {preview.alerts.length > 0 && (
              <div className="space-y-1 mt-2">
                {preview.alerts.map((alert, i) => (
                  <div key={i} className="text-xs text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1">
                    <span>⚠️</span> {alert}
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

          {/* Section 1: Demographics & Diagnostic Criteria */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 border-b pb-1 dark:border-slate-700">
              1. Demographics &amp; Brighton Criteria Classification
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Weakness Onset Datetime
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
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Age (Years)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.2"
                  max="21.0"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={ageYears}
                  onChange={(e) => setAgeYears(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="2.0"
                  max="120.0"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                />
                <span className="text-[10px] text-slate-400">Total IVIG dose = weight × 2 g/kg</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Antecedent Infection
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={antecedentInfectionType}
                  onChange={(e) => setAntecedentInfectionType(e.target.value as GbsAntecedentInfection)}
                >
                  <option value="campylobacter_gastroenteritis">Campylobacter jejuni Enteritis (AMAN risk)</option>
                  <option value="upper_respiratory_viral">Upper Respiratory Viral Infection</option>
                  <option value="ebv_cmv_infection">CMV / EBV Arboviral</option>
                  <option value="none_identified">None Identified / Idiopathic</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Brighton Diagnostic Certainty Level
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={brightonCriteriaLevel}
                  onChange={(e) => setBrightonCriteriaLevel(e.target.value as GbsBrightonLevel)}
                >
                  <option value="level_1_highest_certainty_csf_ncs">Level 1: Highest Certainty (CSF Dissociation + NCS Abnormal)</option>
                  <option value="level_2_csf_or_ncs">Level 2: High Certainty (CSF or NCS Confirmatory)</option>
                  <option value="level_3_clinical_only">Level 3: Moderate Certainty (Clinical Symmetrical Flaccidity)</option>
                  <option value="level_4_unclassifiable">Level 4: Unclassifiable / Alternative Differential</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Hughes Functional Disability Scale (0–6)
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={hughesDisabilityScore}
                  onChange={(e) => setHughesDisabilityScore(Number(e.target.value))}
                >
                  <option value={0}>0: Normal / Healthy</option>
                  <option value={1}>1: Minor signs/symptoms, able to run</option>
                  <option value={2}>2: Able to walk 10m independently without aid</option>
                  <option value={3}>3: Able to walk 10m only with support / walker</option>
                  <option value={4}>4: Bedbound or chairbound (unable to walk 10m)</option>
                  <option value={5}>5: Requires mechanical ventilation</option>
                  <option value={6}>6: Deceased</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: CSF Findings & Neurological Examination */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 border-b pb-1 dark:border-slate-700">
              2. CSF Albuminocytological Dissociation &amp; Neuro Exam
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  CSF Protein (mg/dL)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="5.0"
                  max="1500.0"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={csfProteinMgDl}
                  onChange={(e) => setCsfProteinMgDl(Number(e.target.value))}
                />
                <span className="text-[10px] text-slate-400">&gt;45 mg/dL = Elevated</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  CSF WBC Count (/µL)
                </label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={csfWbcCountPerUl}
                  onChange={(e) => setCsfWbcCountPerUl(Number(e.target.value))}
                />
                <span className="text-[10px] text-slate-400">&lt;10/µL = Normal dissociation</span>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                    checked={ascendingSymmetricWeakness}
                    onChange={(e) => setAscendingSymmetricWeakness(e.target.checked)}
                  />
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Bilateral Symmetric Flaccid Weakness
                  </span>
                </label>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                    checked={areflexiaOrHyporeflexia}
                    onChange={(e) => setAreflexiaOrHyporeflexia(e.target.checked)}
                  />
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Areflexia / Hyporeflexia Present
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: The 20/30/40 Rule for Respiratory Failure */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 border-b pb-1 dark:border-slate-700">
              3. The 20/30/40 Rule for Impending Respiratory Arrest
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Vital Capacity (VC mL/kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="2.0"
                  max="80.0"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={vitalCapacityMlKg}
                  onChange={(e) => setVitalCapacityMlKg(Number(e.target.value))}
                />
                <span className="text-[10px] text-slate-400">&lt;20 mL/kg = Intubation indicated</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Negative Inspiratory Force (NIF cmH2O)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="-120.0"
                  max="0.0"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={negativeInspiratoryForceCmh2o}
                  onChange={(e) => setNegativeInspiratoryForceCmh2o(Number(e.target.value))}
                />
                <span className="text-[10px] text-slate-400">&gt;-30 cmH2O (e.g. -20) = Failure</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Peak Expiratory Pressure (PEP cmH2O)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="5.0"
                  max="150.0"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={peakExpiratoryPressureCmh2o}
                  onChange={(e) => setPeakExpiratoryPressureCmh2o(Number(e.target.value))}
                />
                <span className="text-[10px] text-slate-400">&lt;40 cmH2O = Impaired cough</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-rose-600 focus:ring-rose-500"
                  checked={dysautonomiaSignsPresent}
                  onChange={(e) => setDysautonomiaSignsPresent(e.target.checked)}
                />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Dysautonomia Signs Present
                  </div>
                  <div className="text-[11px] text-slate-500">Labile hypertension, tachy/bradycardia, diaphoresis</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                  checked={corticosteroidsAvoided}
                  onChange={(e) => setCorticosteroidsAvoided(e.target.checked)}
                />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Corticosteroids Strictly Avoided
                  </div>
                  <div className="text-[11px] text-slate-500">Steroids contraindicated (impair remyelination)</div>
                </div>
              </label>
            </div>
          </div>

          {/* Section 4: Immunotherapy Regimen & Status */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 border-b pb-1 dark:border-slate-700">
              4. Immunotherapy &amp; Clinical Trajectory
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Immunotherapy Regimen
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={immunotherapyRegimen}
                  onChange={(e) => setImmunotherapyRegimen(e.target.value as GbsImmunotherapyRegimen)}
                >
                  <option value="ivig_2g_kg_over_2_days">IVIG: 2 g/kg total divided over 2 days (1 g/kg/day)</option>
                  <option value="ivig_2g_kg_over_5_days">IVIG: 2 g/kg total divided over 5 days (0.4 g/kg/day)</option>
                  <option value="plasma_exchange_tpe">Therapeutic Plasma Exchange (TPE: 5 exchanges)</option>
                  <option value="supportive_care_only">Supportive Care Only (Mild Hughes 1–2)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Protocol Status
                </label>
                <select
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PediatricGbsRecord['status'])}
                >
                  <option value="acute_diagnostic_evaluation">Acute Diagnostic Evaluation</option>
                  <option value="picu_ventilatory_support">PICU Ventilatory Support</option>
                  <option value="immunotherapy_infusion_active">Immunotherapy Infusion Active</option>
                  <option value="dysautonomia_telemetry_monitoring">Dysautonomia Telemetry Monitoring</option>
                  <option value="subacute_rehabilitation_weaning">Subacute Rehabilitation &amp; Weaning</option>
                  <option value="resolved_full_motor_recovery">Resolved Full Motor Recovery</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Pediatric Neurology &amp; PICU Notes
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                placeholder="Document nerve conduction findings (demyelinating vs axonal AMAN), cranial nerve involvement (facial diplegia), autonomic blood pressure fluctuations, rehabilitation milestones..."
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
              />
            </div>
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
            className="px-6 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? 'Saving...' : currentEp ? 'Update GBS Protocol' : 'Initiate GBS Protocol'}
          </button>
        </div>
      </div>
    </div>
  );
};
