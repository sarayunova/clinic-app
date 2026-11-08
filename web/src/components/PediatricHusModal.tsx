import React, { useState, useEffect } from 'react';
import {
  createPediatricHusEpisode,
  type PediatricHusRecord,
} from '../api';
import {
  evaluatePediatricHus,
  type PediatricHusEvaluationResult,
} from '../pediatricHusEngine';

interface Props {
  patientId: number;
  existingEpisode?: PediatricHusRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricHusModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [onsetDatetime, setOnsetDatetime] = useState(
    existingEpisode?.onset_datetime || new Date().toISOString().slice(0, 16),
  );
  const [ageYears, setAgeYears] = useState<number>(existingEpisode?.age_years ?? 4.5);
  const [weightKg, setWeightKg] = useState<number>(existingEpisode?.weight_kg ?? 16.0);
  const [prodromalBloodyDiarrhea, setProdromalBloodyDiarrhea] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.prodromal_bloody_diarrhea) : true,
  );
  const [shigaToxinTested, setShigaToxinTested] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.shiga_toxin_tested) : true,
  );
  const [shigaToxinResult, setShigaToxinResult] = useState<
    'positive_stec' | 'negative' | 'pending'
  >(existingEpisode?.shiga_toxin_result ?? 'positive_stec');
  const [hemoglobinGDl, setHemoglobinGDl] = useState<number>(existingEpisode?.hemoglobin_g_dl ?? 7.2);
  const [plateletCount, setPlateletCount] = useState<number>(existingEpisode?.platelet_count ?? 42000);
  const [serumCreatinineMgDl, setSerumCreatinineMgDl] = useState<number>(
    existingEpisode?.serum_creatinine_mg_dl ?? 2.8,
  );
  const [baselineCreatinineMgDl, setBaselineCreatinineMgDl] = useState<number>(
    existingEpisode?.baseline_creatinine_mg_dl ?? 0.4,
  );
  const [schistocytesPresentPct, setSchistocytesPresentPct] = useState<number>(
    existingEpisode?.schistocytes_present_pct ?? 3.5,
  );
  const [serumLdhUL, setSerumLdhUL] = useState<number>(existingEpisode?.serum_ldh_u_l ?? 2150);
  const [directCoombsTest, setDirectCoombsTest] = useState<
    'negative' | 'positive_non_stec' | 'not_performed'
  >(existingEpisode?.direct_coombs_test ?? 'negative');
  const [serumPotassiumMeqL, setSerumPotassiumMeqL] = useState<number>(
    existingEpisode?.serum_potassium_meq_l ?? 5.4,
  );
  const [oliguriaAnuriaDurationHours, setOliguriaAnuriaDurationHours] = useState<number>(
    existingEpisode?.oliguria_anuria_duration_hours ?? 16.0,
  );
  const [hypertensionPresent, setHypertensionPresent] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.hypertension_present) : false,
  );
  const [neurologicalInvolvement, setNeurologicalInvolvement] = useState<
    'none' | 'lethargy_irritability' | 'seizures_altered_mental_status' | 'coma_stroke'
  >(existingEpisode?.neurological_involvement ?? 'lethargy_irritability');
  const [husPhenotype, setHusPhenotype] = useState<
    'typical_stec_d_plus' | 'atypical_complement_mediated_ahus' | 'secondary_pneumococcal_or_other'
  >(existingEpisode?.hus_phenotype ?? 'typical_stec_d_plus');
  const [antibioticsAvoidedStrict, setAntibioticsAvoidedStrict] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.antibiotics_avoided_strict) : true,
  );
  const [antimotilityAgentsAvoided, setAntimotilityAgentsAvoided] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.antimotility_agents_avoided) : true,
  );
  const [dialysisRrtIndicated, setDialysisRrtIndicated] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.dialysis_rrt_indicated) : true,
  );
  const [dialysisModality, setDialysisModality] = useState<
    'none' | 'peritoneal_dialysis' | 'crrt_cvvhdf' | 'hemodialysis'
  >(existingEpisode?.dialysis_modality ?? 'peritoneal_dialysis');
  const [eculizumabIndicated, setEculizumabIndicated] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.eculizumab_indicated) : false,
  );
  const [status, setStatus] = useState<
    'active_fluid_electrolyte_management' | 'dialysis_crrt_running' | 'eculizumab_infusion' | 'renal_recovery_phase' | 'resolved_normal_renal_function'
  >(existingEpisode?.status ?? 'active_fluid_electrolyte_management');
  const [clinicalNotes, setClinicalNotes] = useState<string>(existingEpisode?.clinical_notes || '');

  const [evaluation, setEvaluation] = useState<PediatricHusEvaluationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recalculate evaluation when inputs change
  useEffect(() => {
    const res = evaluatePediatricHus({
      ageYears,
      weightKg,
      prodromalBloodyDiarrhea,
      shigaToxinTested,
      shigaToxinResult,
      hemoglobinGDl,
      plateletCount,
      serumCreatinineMgDl,
      baselineCreatinineMgDl,
      schistocytesPresentPct,
      serumLdhUL,
      directCoombsTest,
      serumPotassiumMeqL,
      oliguriaAnuriaDurationHours,
      hypertensionPresent,
      neurologicalInvolvement,
      husPhenotype,
    });
    setEvaluation(res);
    setDialysisRrtIndicated(res.dialysisRrtIndicated);
    setEculizumabIndicated(res.eculizumabIndicated);
    if (res.dialysisRrtIndicated && dialysisModality === 'none') {
      setDialysisModality('peritoneal_dialysis');
    }
  }, [
    ageYears,
    weightKg,
    prodromalBloodyDiarrhea,
    shigaToxinTested,
    shigaToxinResult,
    hemoglobinGDl,
    plateletCount,
    serumCreatinineMgDl,
    baselineCreatinineMgDl,
    schistocytesPresentPct,
    serumLdhUL,
    directCoombsTest,
    serumPotassiumMeqL,
    oliguriaAnuriaDurationHours,
    hypertensionPresent,
    neurologicalInvolvement,
    husPhenotype,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createPediatricHusEpisode({
        patientId,
        onsetDatetime,
        ageYears,
        weightKg,
        prodromalBloodyDiarrhea,
        shigaToxinTested,
        shigaToxinResult,
        hemoglobinGDl,
        plateletCount,
        serumCreatinineMgDl,
        baselineCreatinineMgDl,
        schistocytesPresentPct,
        serumLdhUL,
        directCoombsTest,
        serumPotassiumMeqL,
        oliguriaAnuriaDurationHours,
        hypertensionPresent,
        neurologicalInvolvement,
        husPhenotype,
        antibioticsAvoidedStrict,
        antimotilityAgentsAvoided,
        dialysisRrtIndicated,
        dialysisModality,
        eculizumabIndicated,
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record Pediatric HUS episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="bg-cyan-700 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔬</span>
            <div>
              <h2 className="text-xl font-bold">
                {existingEpisode ? 'Edit Pediatric HUS Protocol' : 'Pediatric Hemolytic Uremic Syndrome Protocol'}
              </h2>
              <p className="text-xs text-cyan-100">
                IPNA Guidelines: Triad Assessment (MAHA + Thrombocytopenia + KDIGO AKI) & STEC / aHUS Stratification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl font-bold leading-none p-1"
          >
            &times;
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Clinical Directives / Diagnostic Triad Banner */}
          {evaluation && (
            <div className={`p-4 rounded-xl border ${
              evaluation.dialysisRrtIndicated || evaluation.eculizumabIndicated
                ? 'bg-red-50 border-red-300 dark:bg-red-950/40 dark:border-red-800 text-red-900 dark:text-red-100'
                : 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm tracking-wide uppercase flex items-center gap-2">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                    evaluation.dialysisRrtIndicated ? 'bg-red-600 animate-ping' : 'bg-emerald-600'
                  }`}></span>
                  Classic Triad Status: {evaluation.isTriadDiagnosticMet ? 'DIAGNOSTIC TRIAD MET (MAHA + PLT <100k + AKI)' : 'Incomplete Triad'}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-white/70 dark:bg-slate-800/80 shadow-sm">
                  {evaluation.kdigoAkiStageLabel}
                </span>
              </div>

              {evaluation.dialysisRrtIndicated && (
                <div className="text-xs font-bold text-red-800 dark:text-red-200 mb-1">
                  🚨 RENAL REPLACEMENT THERAPY INDICATED: {evaluation.dialysisModalityRecommendation}
                </div>
              )}

              {/* Strict Antibiotic Contraindication Banner */}
              <div className="p-2.5 bg-red-100/80 dark:bg-red-900/60 rounded border border-red-300 dark:border-red-700 text-xs font-black text-red-900 dark:text-red-100 mt-2">
                {evaluation.antibioticContraindicationAlert}
              </div>

              {evaluation.alerts.length > 0 && (
                <div className="mt-2 space-y-1">
                  {evaluation.alerts.map((alt, i) => (
                    <div key={i} className="text-xs text-red-700 dark:text-red-300 font-semibold flex items-center gap-1.5">
                      <span>⚠️</span> {alt}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Core Demographics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Onset Date & Time *
              </label>
              <input
                type="datetime-local"
                value={onsetDatetime}
                onChange={(e) => setOnsetDatetime(e.target.value)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Age (Years) *
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="21.0"
                value={ageYears}
                onChange={(e) => setAgeYears(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Weight (kg) *
              </label>
              <input
                type="number"
                step="0.1"
                min="2.0"
                max="120.0"
                value={weightKg}
                onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phenotype Classification *
              </label>
              <select
                value={husPhenotype}
                onChange={(e) => setHusPhenotype(e.target.value as any)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold"
              >
                <option value="typical_stec_d_plus">Typical STEC-HUS (D+ Diarrhea-associated)</option>
                <option value="atypical_complement_mediated_ahus">Atypical HUS (aHUS Complement-mediated)</option>
                <option value="secondary_pneumococcal_or_other">Secondary HUS (Pneumococcal / Other)</option>
              </select>
            </div>
          </div>

          {/* Section: Diagnostic Triad Laboratory Markers */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              1. Microangiopathic Hemolytic Anemia & Thrombocytopenia Markers
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Hemoglobin (g/dL) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="2.0"
                  max="20.0"
                  value={hemoglobinGDl}
                  onChange={(e) => setHemoglobinGDl(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold text-rose-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Platelets (/mcL) *
                </label>
                <input
                  type="number"
                  min="1000"
                  max="900000"
                  value={plateletCount}
                  onChange={(e) => setPlateletCount(parseInt(e.target.value) || 0)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold text-amber-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Schistocytes on Smear (%) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.0"
                  max="30.0"
                  value={schistocytesPresentPct}
                  onChange={(e) => setSchistocytesPresentPct(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Serum LDH (U/L) *
                </label>
                <input
                  type="number"
                  min="50"
                  max="20000"
                  value={serumLdhUL}
                  onChange={(e) => setSerumLdhUL(parseInt(e.target.value) || 0)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Direct Coombs (DAT)
                </label>
                <select
                  value={directCoombsTest}
                  onChange={(e) => setDirectCoombsTest(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="negative">Negative (Typical for STEC/aHUS MAHA)</option>
                  <option value="positive_non_stec">Positive (Autoimmune / Secondary)</option>
                  <option value="not_performed">Not Performed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Prodromal Bloody Diarrhea
                </label>
                <select
                  value={prodromalBloodyDiarrhea ? 'yes' : 'no'}
                  onChange={(e) => setProdromalBloodyDiarrhea(e.target.value === 'yes')}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="yes">Yes (Antecedent colitis &gt;3-8 days)</option>
                  <option value="no">No (Non-diarrheal prodrome)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Shiga Toxin Stool PCR/ELISA
                </label>
                <select
                  value={shigaToxinResult}
                  onChange={(e) => setShigaToxinResult(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="positive_stec">Positive STEC (Stx1 / Stx2)</option>
                  <option value="pending">Pending</option>
                  <option value="negative">Negative</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Neurological Involvement
                </label>
                <select
                  value={neurologicalInvolvement}
                  onChange={(e) => setNeurologicalInvolvement(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-medium"
                >
                  <option value="none">None (Alert & oriented)</option>
                  <option value="lethargy_irritability">Lethargy / Irritability</option>
                  <option value="seizures_altered_mental_status">Seizures / Encephalopathy</option>
                  <option value="coma_stroke">Coma / Cerebral Infarction</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Renal Function & Dialysis Indications */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              2. KDIGO Acute Kidney Injury & RRT / Eculizumab Indications
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Serum Creatinine (mg/dL) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="25.0"
                  value={serumCreatinineMgDl}
                  onChange={(e) => setSerumCreatinineMgDl(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold text-cyan-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Baseline Creatinine (mg/dL) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="5.0"
                  value={baselineCreatinineMgDl}
                  onChange={(e) => setBaselineCreatinineMgDl(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Serum Potassium (mEq/L) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="12.0"
                  value={serumPotassiumMeqL}
                  onChange={(e) => setSerumPotassiumMeqL(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Oliguria/Anuria Duration (Hours)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="720"
                  value={oliguriaAnuriaDurationHours}
                  onChange={(e) => setOliguriaAnuriaDurationHours(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Systemic Hypertension
                </label>
                <select
                  value={hypertensionPresent ? 'yes' : 'no'}
                  onChange={(e) => setHypertensionPresent(e.target.value === 'yes')}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="no">Normotensive</option>
                  <option value="yes">Hypertensive (&gt;95th percentile)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dialysis / RRT Indicated
                </label>
                <select
                  value={dialysisRrtIndicated ? 'yes' : 'no'}
                  onChange={(e) => setDialysisRrtIndicated(e.target.value === 'yes')}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold"
                >
                  <option value="yes">Yes (Dialysis criteria met)</option>
                  <option value="no">No (Medical management)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dialysis Modality Planned
                </label>
                <select
                  value={dialysisModality}
                  onChange={(e) => setDialysisModality(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="none">None</option>
                  <option value="peritoneal_dialysis">Peritoneal Dialysis (PD)</option>
                  <option value="crrt_cvvhdf">CRRT (CVVHDF)</option>
                  <option value="hemodialysis">Intermittent Hemodialysis</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Eculizumab (C5 Inhibitor)
                </label>
                <select
                  value={eculizumabIndicated ? 'yes' : 'no'}
                  onChange={(e) => setEculizumabIndicated(e.target.value === 'yes')}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="no">Not Indicated (STEC Typical)</option>
                  <option value="yes">Indicated (aHUS / Refractory STEC CNS)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Antibiotics Strictly Avoided (IPNA Contraindication) *
                </label>
                <select
                  value={antibioticsAvoidedStrict ? 'yes' : 'no'}
                  onChange={(e) => setAntibioticsAvoidedStrict(e.target.value === 'yes')}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold"
                >
                  <option value="yes">YES - Antibiotics strictly withheld (Reduces Shiga toxin release)</option>
                  <option value="no">NO - Antibiotic given (High Risk of Stx induction)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Clinical Protocol Status *
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-medium"
                >
                  <option value="active_fluid_electrolyte_management">Active Fluid & Electrolyte Management</option>
                  <option value="dialysis_crrt_running">Dialysis / CRRT Running</option>
                  <option value="eculizumab_infusion">Eculizumab Infusion</option>
                  <option value="renal_recovery_phase">Renal Recovery Phase</option>
                  <option value="resolved_normal_renal_function">Resolved / Normal Renal Function</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fluid Directives Preview */}
          {evaluation && (
            <div className="p-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-lg border border-cyan-200 dark:border-cyan-800">
              <h4 className="text-xs font-bold text-cyan-900 dark:text-cyan-200 mb-1">
                IPNA Fluid & Electrolyte Replacement Directives
              </h4>
              <ul className="text-xs text-cyan-800 dark:text-cyan-300 space-y-1 list-disc pl-4">
                {evaluation.fluidManagementDirectives.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Clinical Notes & Dialysis / Nephrology Documentation
            </label>
            <textarea
              rows={3}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Document PICU admission, vascular access, peritoneal dialysis catheter placement, urine output tracking, anti-hypertensive therapy..."
              className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          {/* Footer Controls */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-cyan-700 hover:bg-cyan-800 disabled:opacity-50 shadow-md"
            >
              {saving ? 'Saving...' : existingEpisode ? 'Update Episode' : 'Commit Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
