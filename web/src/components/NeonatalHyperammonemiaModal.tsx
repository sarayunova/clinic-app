import React, { useState, useEffect } from 'react';
import {
  createNeonatalHyperammonemiaEpisode,
  updateNeonatalHyperammonemiaEpisode,
  type NeonatalHyperammonemiaRecord,
} from '../api';
import {
  evaluateNeonatalHyperammonemia,
  type NeonatalHyperammonemiaEvaluation,
  type BloodGasAcidBasePattern,
  type SuspectedDisorderCategory,
  type NeonatalHyperammonemiaStatus,
} from '../neonatalHyperammonemiaEngine';

interface Props {
  patientId: number;
  initialEpisode?: NeonatalHyperammonemiaRecord | null;
  existingEpisode?: NeonatalHyperammonemiaRecord | null;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: (newId?: number) => void;
  onSaved?: () => void;
}

export const NeonatalHyperammonemiaModal: React.FC<Props> = ({
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
  const [ageHours, setAgeHours] = useState<number>(currentEp?.age_hours ?? 48);
  const [birthWeightGrams, setBirthWeightGrams] = useState<number>(
    currentEp?.birth_weight_grams ?? 3100
  );
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(
    currentEp?.gestational_age_weeks ?? 39.0
  );
  const [plasmaAmmoniaUmolL, setPlasmaAmmoniaUmolL] = useState<number>(
    currentEp?.plasma_ammonia_umol_l ?? 380.0
  );
  const [bloodGasAcidBasePattern, setBloodGasAcidBasePattern] = useState<BloodGasAcidBasePattern>(
    currentEp?.blood_gas_acid_base_pattern ?? 'respiratory_alkalosis'
  );
  const [plasmaLactateMmolL, setPlasmaLactateMmolL] = useState<number>(
    currentEp?.plasma_lactate_mmol_l ?? 1.8
  );
  const [anionGapMeqL, setAnionGapMeqL] = useState<number>(
    currentEp?.anion_gap_meq_l ?? 12.0
  );
  const [urineKetonesPresent, setUrineKetonesPresent] = useState<boolean>(
    currentEp ? Boolean(currentEp.urine_ketones_present) : false
  );
  const [suspectedDisorderCategory, setSuspectedDisorderCategory] = useState<SuspectedDisorderCategory>(
    currentEp?.suspected_disorder_category ?? 'urea_cycle_disorder_ucd'
  );
  const [proteinIntakeHalted, setProteinIntakeHalted] = useState<boolean>(
    currentEp ? Boolean(currentEp.protein_intake_halted) : true
  );
  const [highCalorieDextroseActive, setHighCalorieDextroseActive] = useState<boolean>(
    currentEp ? Boolean(currentEp.high_calorie_dextrose_active) : true
  );
  const [girMgKgMin, setGirMgKgMin] = useState<number>(
    currentEp?.gir_mg_kg_min ?? 10.0
  );
  const [nitrogenScavengerAmmonulActive, setNitrogenScavengerAmmonulActive] = useState<boolean>(
    currentEp ? Boolean(currentEp.nitrogen_scavenger_ammonul_active) : true
  );
  const [ivLArginineActive, setIvLArginineActive] = useState<boolean>(
    currentEp ? Boolean(currentEp.iv_l_arginine_active) : true
  );
  const [ivLCarnitineActive, setIvLCarnitineActive] = useState<boolean>(
    currentEp ? Boolean(currentEp.iv_l_carnitine_active) : false
  );
  const [crrtDialysisIndicated, setCrrtDialysisIndicated] = useState<boolean>(
    currentEp ? Boolean(currentEp.crrt_dialysis_indicated) : false
  );
  const [crrtDialysisActive, setCrrtDialysisActive] = useState<boolean>(
    currentEp ? Boolean(currentEp.crrt_dialysis_active) : false
  );
  const [status, setStatus] = useState<NeonatalHyperammonemiaStatus>(
    (currentEp?.status as NeonatalHyperammonemiaStatus) ?? 'acute_hyperammonemic_crisis'
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    currentEp?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<NeonatalHyperammonemiaEvaluation | null>(null);

  useEffect(() => {
    try {
      const evalResult = evaluateNeonatalHyperammonemia({
        ageHours,
        birthWeightGrams,
        gestationalAgeWeeks,
        plasmaAmmoniaUmolL,
        bloodGasAcidBasePattern,
        plasmaLactateMmolL,
        anionGapMeqL,
        urineKetonesPresent,
        suspectedDisorderCategory,
        proteinIntakeHalted,
        highCalorieDextroseActive,
        girMgKgMin,
        nitrogenScavengerAmmonulActive,
        ivLArginineActive,
        ivLCarnitineActive,
        crrtDialysisIndicated,
        crrtDialysisActive,
        status,
      });
      setPreview(evalResult);
    } catch {
      // preview calculation error suppressed
    }
  }, [
    ageHours,
    birthWeightGrams,
    gestationalAgeWeeks,
    plasmaAmmoniaUmolL,
    bloodGasAcidBasePattern,
    plasmaLactateMmolL,
    anionGapMeqL,
    urineKetonesPresent,
    suspectedDisorderCategory,
    proteinIntakeHalted,
    highCalorieDextroseActive,
    girMgKgMin,
    nitrogenScavengerAmmonulActive,
    ivLArginineActive,
    ivLCarnitineActive,
    crrtDialysisIndicated,
    crrtDialysisActive,
    status,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      onsetDatetime,
      ageHours,
      birthWeightGrams,
      gestationalAgeWeeks,
      plasmaAmmoniaUmolL,
      bloodGasAcidBasePattern,
      plasmaLactateMmolL,
      anionGapMeqL,
      urineKetonesPresent,
      suspectedDisorderCategory,
      proteinIntakeHalted,
      highCalorieDextroseActive,
      girMgKgMin,
      nitrogenScavengerAmmonulActive,
      ivLArginineActive,
      ivLCarnitineActive,
      crrtDialysisIndicated,
      crrtDialysisActive,
      status,
      clinicalNotes: clinicalNotes || null,
    };

    try {
      if (currentEp) {
        await updateNeonatalHyperammonemiaEpisode(currentEp.id, payload);
        onSuccess?.(currentEp.id);
      } else {
        const res = await createNeonatalHyperammonemiaEpisode(payload);
        onSuccess?.(res.episode.id);
      }
      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save neonatal hyperammonemia episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-purple-700 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">
              {currentEp ? 'Edit Hyperammonemia Episode' : 'New Neonatal Inborn Errors of Metabolism (IEM) Crisis Protocol'}
            </h2>
            <p className="text-xs text-purple-100">
              ACMG / SIMD Guidelines: Toxic Hyperammonemia, Ammonul Scavengers, Caloric Suppression & Emergency CRRT
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-purple-200 text-2xl font-bold"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          {/* Clinical Real-Time Decision Preview */}
          {preview && (
            <div className={`p-4 rounded-lg border ${
              preview.urgencyTier === 'emergency_crrt_dialysis_and_scavengers'
                ? 'bg-red-50 border-red-300'
                : preview.urgencyTier === 'urgent_medical_scavengers_caloric_suppression'
                ? 'bg-amber-50 border-amber-300'
                : 'bg-emerald-50 border-emerald-300'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm tracking-wide uppercase">
                  {preview.urgencyTierLabel}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-white/80 shadow-sm">
                  {preview.ammoniaCrisisLabel}
                </span>
              </div>

              {preview.alerts.length > 0 && (
                <div className="mt-2 space-y-1">
                  {preview.alerts.map((al, idx) => (
                    <div key={idx} className="text-xs font-semibold text-red-700 flex items-start gap-1.5">
                      <span>⚠️</span>
                      <span>{al}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-black/10 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-600 block">Ammonul (Phenylacetate+Benzoate):</span>
                  <span className="font-bold">{preview.ammonulLoadingDoseMg} mg (250 mg/kg)</span>
                </div>
                <div>
                  <span className="text-gray-600 block">IV L-Arginine HCl:</span>
                  <span className="font-bold">{preview.arginineLoadingDoseMg} mg (250 mg/kg)</span>
                </div>
                <div>
                  <span className="text-gray-600 block">Dialysis Mandated:</span>
                  <span className="font-bold text-purple-900">{preview.isCrrtHemodialysisMandated ? 'YES (CRRT / CVVHD)' : 'Medical Scavengers First'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Section 1: Demographics & Onset */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Onset Datetime *</label>
              <input
                type="datetime-local"
                value={onsetDatetime}
                onChange={(e) => setOnsetDatetime(e.target.value)}
                required
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Age (Hours) *</label>
              <input
                type="number"
                min="0"
                max="720"
                value={ageHours}
                onChange={(e) => setAgeHours(parseInt(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Birth Weight (g) *</label>
              <input
                type="number"
                min="400"
                max="6000"
                value={birthWeightGrams}
                onChange={(e) => setBirthWeightGrams(parseInt(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Gestational Age (wks) *</label>
              <input
                type="number"
                step="0.1"
                min="22"
                max="43"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          {/* Section 2: Laboratory Matrix & Ammonia */}
          <div className="border border-purple-200 bg-purple-50/30 p-4 rounded-lg space-y-4">
            <h3 className="text-sm font-bold text-purple-900 border-b border-purple-200 pb-1">
              Plasma Ammonia & Diagnostic Differentiation Matrix
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Plasma Ammonia (umol/L) *</label>
                <input
                  type="number"
                  step="1"
                  min="10"
                  max="3000"
                  value={plasmaAmmoniaUmolL}
                  onChange={(e) => setPlasmaAmmoniaUmolL(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full border rounded px-3 py-1.5 text-sm font-bold text-purple-900"
                />
                <p className="text-[11px] text-gray-500 mt-0.5">&gt; 150 umol/L crisis; &gt; 400 dialysis threshold</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Blood Gas Acid-Base Pattern *</label>
                <select
                  value={bloodGasAcidBasePattern}
                  onChange={(e) => setBloodGasAcidBasePattern(e.target.value as BloodGasAcidBasePattern)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                >
                  <option value="respiratory_alkalosis">Primary Respiratory Alkalosis (Points to UCD)</option>
                  <option value="high_anion_gap_metabolic_acidosis">High Anion Gap Acidosis (Points to OA)</option>
                  <option value="normal_compensated">Normal / Compensated</option>
                  <option value="mixed_acid_base">Mixed Acid-Base Disorder</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Plasma Lactate (mmol/L) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.2"
                  max="30"
                  value={plasmaLactateMmolL}
                  onChange={(e) => setPlasmaLactateMmolL(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full border rounded px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Anion Gap (mEq/L) *</label>
                <input
                  type="number"
                  step="0.5"
                  min="2"
                  max="50"
                  value={anionGapMeqL}
                  onChange={(e) => setAnionGapMeqL(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full border rounded px-3 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-800 bg-white p-2.5 rounded border">
                <input
                  type="checkbox"
                  checked={urineKetonesPresent}
                  onChange={(e) => setUrineKetonesPresent(e.target.checked)}
                />
                <span>Urine Ketones Present (Pathognomonic for Organic Acidemia)</span>
              </label>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Suspected Inborn Error Disorder</label>
                <select
                  value={suspectedDisorderCategory}
                  onChange={(e) => setSuspectedDisorderCategory(e.target.value as SuspectedDisorderCategory)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                >
                  <option value="urea_cycle_disorder_ucd">Urea Cycle Disorder (UCD - OTC/CPS1/Citrullinemia)</option>
                  <option value="organic_acidemia_oa">Organic Acidemia (MMA / PA / IVA)</option>
                  <option value="fatty_acid_oxidation_faod">Fatty Acid Oxidation Disorder (FAOD)</option>
                  <option value="undifferentiated_hyperammonemia">Undifferentiated Hyperammonemia</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Caloric Hyperinfusion & Pharmacotherapy */}
          <div className="border border-gray-200 p-4 rounded-lg space-y-3">
            <h3 className="text-sm font-bold text-gray-900 border-b pb-1">
              Catabolism Suppression & Scavenger Pharmacotherapy
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={proteinIntakeHalted}
                  onChange={(e) => setProteinIntakeHalted(e.target.checked)}
                />
                <span>Halt All Dietary Protein Feeds (0 protein)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={highCalorieDextroseActive}
                  onChange={(e) => setHighCalorieDextroseActive(e.target.checked)}
                />
                <span>D10W / D12.5W Caloric Suppression</span>
              </label>

              <div>
                <label className="block text-[11px] text-gray-600 mb-0.5">Glucose Infusion Rate (GIR mg/kg/min)</label>
                <input
                  type="number"
                  step="0.5"
                  min="4"
                  max="25"
                  value={girMgKgMin}
                  onChange={(e) => setGirMgKgMin(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-2 py-1 text-xs font-bold"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={nitrogenScavengerAmmonulActive}
                  onChange={(e) => setNitrogenScavengerAmmonulActive(e.target.checked)}
                />
                <span>Ammonul Infusion (Na Phenylacetate + Benzoate)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={ivLArginineActive}
                  onChange={(e) => setIvLArginineActive(e.target.checked)}
                />
                <span>IV L-Arginine HCl Infusion</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={ivLCarnitineActive}
                  onChange={(e) => setIvLCarnitineActive(e.target.checked)}
                />
                <span>IV L-Carnitine (for OA / Acyl conjugates)</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={crrtDialysisIndicated}
                  onChange={(e) => setCrrtDialysisIndicated(e.target.checked)}
                />
                <span>CRRT / Hemodialysis Indicated</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={crrtDialysisActive}
                  onChange={(e) => setCrrtDialysisActive(e.target.checked)}
                />
                <span>Continuous CVVHD Active</span>
              </label>

              <div>
                <label className="block text-[11px] text-gray-600 mb-0.5">Clinical Protocol Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as NeonatalHyperammonemiaStatus)}
                  className="w-full border rounded px-2 py-1 text-xs"
                >
                  <option value="acute_hyperammonemic_crisis">Acute Hyperammonemic Crisis</option>
                  <option value="medical_scavenger_infusion">Medical Scavenger Infusion</option>
                  <option value="emergency_crrt_hemodialysis">Emergency CRRT Hemodialysis</option>
                  <option value="catabolism_reversal_stabilization">Catabolism Reversal Stabilization</option>
                  <option value="controlled_protein_reintroduction">Controlled Protein Reintroduction</option>
                  <option value="convalescent_metabolic_maintenance">Convalescent Metabolic Maintenance</option>
                  <option value="neonatal_demise">Neonatal Demise</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Clinical Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Clinical Notes & Metabolic Geneticist Handover</label>
            <textarea
              rows={3}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Record serial encephalopathy checks, dialysate clearance, amino acid panel results, and neuroprotective hypothermia notes..."
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-purple-700 text-white rounded-lg text-sm font-medium hover:bg-purple-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : currentEp ? 'Update Episode' : 'Create Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
