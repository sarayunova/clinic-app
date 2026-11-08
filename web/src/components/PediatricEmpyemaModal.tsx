import React, { useState, useEffect } from 'react';
import {
  createPediatricEmpyemaEpisode,
  updatePediatricEmpyemaEpisode,
  type PediatricEmpyemaRecord,
} from '../api';
import {
  evaluatePediatricEmpyema,
  type PediatricEmpyemaEvaluationResult,
  type PediatricEmpyemaStaging,
  type UltrasoundFindings,
  type PleuralFluidAppearance,
  type IntrapleuralFibrinolyticTherapy,
} from '../pediatricEmpyemaEngine';

interface Props {
  patientId: number;
  existingEpisode?: PediatricEmpyemaRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricEmpyemaModal: React.FC<Props> = ({
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
  const [ageYears, setAgeYears] = useState<number>(existingEpisode?.age_years ?? 4.0);
  const [weightKg, setWeightKg] = useState<number>(existingEpisode?.weight_kg ?? 16.0);
  const [stagingPhase, setStagingPhase] = useState<PediatricEmpyemaStaging>(
    existingEpisode?.staging_phase ?? 'stage_2_fibrinopurulent_complicated'
  );
  const [ultrasoundFindings, setUltrasoundFindings] = useState<UltrasoundFindings>(
    existingEpisode?.ultrasound_findings ?? 'dense_multiloculated_honeycomb'
  );
  const [pleuralFluidPh, setPleuralFluidPh] = useState<string>(
    existingEpisode?.pleural_fluid_ph !== null && existingEpisode?.pleural_fluid_ph !== undefined
      ? String(existingEpisode.pleural_fluid_ph)
      : '7.08'
  );
  const [pleuralFluidGlucoseMgDl, setPleuralFluidGlucoseMgDl] = useState<string>(
    existingEpisode?.pleural_fluid_glucose_mg_dl !== null && existingEpisode?.pleural_fluid_glucose_mg_dl !== undefined
      ? String(existingEpisode.pleural_fluid_glucose_mg_dl)
      : '28.0'
  );
  const [pleuralFluidLdhUL, setPleuralFluidLdhUL] = useState<string>(
    existingEpisode?.pleural_fluid_ldh_u_l !== null && existingEpisode?.pleural_fluid_ldh_u_l !== undefined
      ? String(existingEpisode.pleural_fluid_ldh_u_l)
      : '2400'
  );
  const [pleuralFluidAppearance, setPleuralFluidAppearance] = useState<PleuralFluidAppearance>(
    existingEpisode?.pleural_fluid_appearance ?? 'frank_pus_purulent'
  );
  const [gramStainCultureIsolated, setGramStainCultureIsolated] = useState<string>(
    existingEpisode?.gram_stain_culture_isolated || 'Streptococcus pneumoniae (Gram + lancet pairs)'
  );
  const [chestTubePlaced, setChestTubePlaced] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.chest_tube_placed) : true
  );
  const [chestTubeSizeFr, setChestTubeSizeFr] = useState<string>(
    existingEpisode?.chest_tube_size_fr !== null && existingEpisode?.chest_tube_size_fr !== undefined
      ? String(existingEpisode.chest_tube_size_fr)
      : '10'
  );
  const [intrapleuralFibrinolyticTherapy, setIntrapleuralFibrinolyticTherapy] = useState<IntrapleuralFibrinolyticTherapy>(
    existingEpisode?.intrapleural_fibrinolytic_therapy ?? 'tpa_plus_dornase_alfa_twice_daily'
  );
  const [dosesCompleted, setDosesCompleted] = useState<number>(existingEpisode?.doses_completed ?? 0);
  const [vatsDecorticationIndicated, setVatsDecorticationIndicated] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.vats_decortication_indicated) : false
  );
  const [status, setStatus] = useState<PediatricEmpyemaRecord['status']>(
    existingEpisode?.status ?? 'chest_tube_insertion'
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(existingEpisode?.clinical_notes || '');

  const [evaluation, setEvaluation] = useState<PediatricEmpyemaEvaluationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const res = evaluatePediatricEmpyema({
      ageYears,
      weightKg,
      stagingPhase,
      ultrasoundFindings,
      pleuralFluidPh: pleuralFluidPh ? parseFloat(pleuralFluidPh) : undefined,
      pleuralFluidGlucoseMgDl: pleuralFluidGlucoseMgDl ? parseFloat(pleuralFluidGlucoseMgDl) : undefined,
      pleuralFluidLdhUL: pleuralFluidLdhUL ? parseFloat(pleuralFluidLdhUL) : undefined,
      pleuralFluidAppearance,
      gramStainCultureIsolated: gramStainCultureIsolated || undefined,
      chestTubePlaced,
      chestTubeSizeFr: chestTubeSizeFr ? parseInt(chestTubeSizeFr, 10) : undefined,
      intrapleuralFibrinolyticTherapy,
      dosesCompleted,
      vatsDecorticationIndicated,
    });
    setEvaluation(res);
  }, [
    ageYears,
    weightKg,
    stagingPhase,
    ultrasoundFindings,
    pleuralFluidPh,
    pleuralFluidGlucoseMgDl,
    pleuralFluidLdhUL,
    pleuralFluidAppearance,
    gramStainCultureIsolated,
    chestTubePlaced,
    chestTubeSizeFr,
    intrapleuralFibrinolyticTherapy,
    dosesCompleted,
    vatsDecorticationIndicated,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      onsetDatetime,
      ageYears: Number(ageYears),
      weightKg: Number(weightKg),
      stagingPhase,
      ultrasoundFindings,
      pleuralFluidPh: pleuralFluidPh ? parseFloat(pleuralFluidPh) : undefined,
      pleuralFluidGlucoseMgDl: pleuralFluidGlucoseMgDl ? parseFloat(pleuralFluidGlucoseMgDl) : undefined,
      pleuralFluidLdhUL: pleuralFluidLdhUL ? parseFloat(pleuralFluidLdhUL) : undefined,
      pleuralFluidAppearance,
      gramStainCultureIsolated: gramStainCultureIsolated || undefined,
      chestTubePlaced,
      chestTubeSizeFr: chestTubeSizeFr ? parseInt(chestTubeSizeFr, 10) : undefined,
      intrapleuralFibrinolyticTherapy,
      dosesCompleted: Number(dosesCompleted),
      vatsDecorticationIndicated,
      status,
      clinicalNotes: clinicalNotes || undefined,
    };

    try {
      if (existingEpisode) {
        await updatePediatricEmpyemaEpisode(existingEpisode.id, payload);
      } else {
        await createPediatricEmpyemaEpisode(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save empyema episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-indigo-700 text-white rounded-t-lg">
          <div>
            <h2 className="text-xl font-bold">
              {existingEpisode ? 'Edit' : 'New'} Pediatric Empyema & Effusion Protocol
            </h2>
            <p className="text-xs text-indigo-100">
              BTS Guidelines • Ultrasound Loculation Staging • Intrapleural tPA/DNase & VATS Decortication
            </p>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl font-bold leading-none">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          {evaluation && (
            <div
              className={`p-4 rounded-lg border ${
                evaluation.urgencyTier === 'vats_thoracoscopy_surgical'
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : evaluation.urgencyTier === 'intrapleural_fibrinolysis_active'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-indigo-50 border-indigo-300 text-indigo-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-base">{evaluation.urgencyTierLabel}</span>
                <span className="px-2.5 py-1 text-xs rounded-full font-semibold uppercase bg-white border">
                  {evaluation.calculatedRecommendedStage.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs mt-1 font-medium">
                Dosing: tPA {evaluation.fibrinolyticDosing.tpaDoseMg} mg + Dornase alfa {evaluation.fibrinolyticDosing.dornaseAlfaDoseMg} mg (2h clamp dwell)
              </p>

              {evaluation.alerts.length > 0 && (
                <div className="mt-2 space-y-1">
                  {evaluation.alerts.map((al, idx) => (
                    <div key={idx} className="text-xs font-semibold text-red-700 flex items-start gap-1">
                      <span>⚠️</span>
                      <span>{al}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Onset Datetime</label>
              <input
                type="datetime-local"
                value={onsetDatetime}
                onChange={(e) => setOnsetDatetime(e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Age (Years)</label>
              <input
                type="number"
                step="0.1"
                value={ageYears}
                onChange={(e) => setAgeYears(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="0"
                max="21"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="1"
                max="150"
                required
              />
            </div>
          </div>

          {/* Staging & Ultrasound */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Empyema Staging Phase</label>
              <select
                value={stagingPhase}
                onChange={(e) => setStagingPhase(e.target.value as PediatricEmpyemaStaging)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white font-medium"
              >
                <option value="stage_1_exudative_simple">Stage 1: Exudative (Simple parapneumonic effusion)</option>
                <option value="stage_2_fibrinopurulent_complicated">Stage 2: Fibrinopurulent (Septations &amp; purulence)</option>
                <option value="stage_3_organizing_pleural_peel">Stage 3: Organizing (Thick peel &amp; trapped lung)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Thoracic Ultrasound Findings</label>
              <select
                value={ultrasoundFindings}
                onChange={(e) => setUltrasoundFindings(e.target.value as UltrasoundFindings)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white font-medium"
              >
                <option value="dense_multiloculated_honeycomb">Dense Multiloculated Honeycomb (Loculated Empyema)</option>
                <option value="fibrinous_strands_early_septation">Fibrinous Strands &amp; Early Septation</option>
                <option value="free_flowing_anechoic">Free-Flowing Anechoic Fluid</option>
                <option value="thickened_visceral_pleura_trapped_lung">Thickened Visceral Pleura / Trapped Lung</option>
              </select>
            </div>
          </div>

          {/* Pleural fluid biomarkers */}
          <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
              Pleural Fluid Analysis (Light's &amp; Biochemical Staging)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Fluid pH</label>
                <input
                  type="number"
                  step="0.01"
                  value={pleuralFluidPh}
                  onChange={(e) => setPleuralFluidPh(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm bg-white font-bold"
                  placeholder="e.g. 7.08"
                />
                <span className="text-[11px] text-gray-500">&lt; 7.20 = Complicated</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Glucose (mg/dL)</label>
                <input
                  type="number"
                  step="1"
                  value={pleuralFluidGlucoseMgDl}
                  onChange={(e) => setPleuralFluidGlucoseMgDl(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm bg-white font-bold"
                  placeholder="e.g. 28"
                />
                <span className="text-[11px] text-gray-500">&lt; 40 mg/dL = Consumed</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">LDH (U/L)</label>
                <input
                  type="number"
                  step="10"
                  value={pleuralFluidLdhUL}
                  onChange={(e) => setPleuralFluidLdhUL(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm bg-white font-bold"
                  placeholder="e.g. 2400"
                />
                <span className="text-[11px] text-gray-500">&gt; 1000 U/L = Severe</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Macroscopic Appearance</label>
                <select
                  value={pleuralFluidAppearance}
                  onChange={(e) => setPleuralFluidAppearance(e.target.value as PleuralFluidAppearance)}
                  className="w-full border rounded px-3 py-1.5 text-sm bg-white font-medium"
                >
                  <option value="frank_pus_purulent">Frank Purulent Pus</option>
                  <option value="turbid_cloudy">Turbid / Cloudy</option>
                  <option value="clear_serous">Clear / Serous</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Gram Stain / Culture Organism</label>
              <input
                type="text"
                value={gramStainCultureIsolated}
                onChange={(e) => setGramStainCultureIsolated(e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white"
                placeholder="e.g. Streptococcus pneumoniae, S. pyogenes, MRSA..."
              />
            </div>
          </div>

          {/* Chest tube & Fibrinolytics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={chestTubePlaced}
                  onChange={(e) => setChestTubePlaced(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                Chest Tube In Situ
              </label>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Chest Tube Size (Fr)</label>
              <input
                type="number"
                value={chestTubeSizeFr}
                onChange={(e) => setChestTubeSizeFr(e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm"
                placeholder="e.g. 10 (Pigtail 8-12 Fr)"
              />
              <span className="text-[11px] text-gray-500">BTS: Small-bore (8-12 Fr) favored</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Intrapleural Fibrinolytic Regimen</label>
              <select
                value={intrapleuralFibrinolyticTherapy}
                onChange={(e) => setIntrapleuralFibrinolyticTherapy(e.target.value as IntrapleuralFibrinolyticTherapy)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white"
              >
                <option value="tpa_plus_dornase_alfa_twice_daily">tPA + Dornase alfa (Twice Daily x 3 days)</option>
                <option value="single_agent_tpa">Single-agent Alteplase (tPA)</option>
                <option value="saline_flush_control">Saline Flush Control</option>
                <option value="not_indicated_antibiotics_only">Not Indicated (Antibiotics Only)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Fibrinolytic Doses Completed</label>
              <input
                type="number"
                value={dosesCompleted}
                onChange={(e) => setDosesCompleted(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="0"
                max="12"
              />
              <span className="text-[11px] text-gray-500">Standard course: 6 doses (twice daily x 3 days)</span>
            </div>
          </div>

          {/* VATS & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 text-xs font-bold text-red-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={vatsDecorticationIndicated}
                  onChange={(e) => setVatsDecorticationIndicated(e.target.checked)}
                  className="rounded text-red-600"
                />
                VATS Decortication Surgical Indication Met
              </label>
              <span className="text-[11px] text-gray-500 mt-1">
                Persistent loculation, trapped lung, or failure of 3 days fibrinolysis
              </span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Clinical Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PediatricEmpyemaRecord['status'])}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white font-medium"
              >
                <option value="chest_tube_insertion">1. Chest Tube Placement</option>
                <option value="intrapleural_fibrinolysis_active">2. Intrapleural Fibrinolysis (tPA/DNase)</option>
                <option value="vats_surgical_decortication">3. VATS Surgical Decortication</option>
                <option value="resolving_drain_removal_phase">4. Resolving / Drain Removal</option>
                <option value="discharged_complete_resolution">5. Discharged / Complete Resolution</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Clinical Notes</label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              className="w-full border rounded px-3 py-1.5 text-sm"
              placeholder="Ultrasound details, antibiotic choices, drain effluent notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-indigo-700 text-white rounded text-sm font-semibold hover:bg-indigo-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : existingEpisode ? 'Update Protocol' : 'Save Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
