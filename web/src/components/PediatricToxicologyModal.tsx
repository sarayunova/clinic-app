import React, { useState, useEffect } from 'react';
import {
  createPediatricToxicologyEpisode,
  updatePediatricToxicologyEpisode,
  type PediatricToxicologyRecord,
} from '../api';
import {
  evaluatePediatricToxicology,
  type PediatricToxicologyEvaluation,
  type ToxicSubstanceCategory,
  type AntidoteProtocolAdministered,
  type PediatricToxicologyStatus,
} from '../pediatricToxicologyEngine';

interface Props {
  patientId: number;
  initialEpisode?: PediatricToxicologyRecord | null;
  existingEpisode?: PediatricToxicologyRecord | null;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: (newId?: number) => void;
  onSaved?: () => void;
}

export const PediatricToxicologyModal: React.FC<Props> = ({
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

  const [ingestionDatetime, setIngestionDatetime] = useState(
    currentEp?.ingestion_datetime || new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 16)
  );
  const [presentationDatetime, setPresentationDatetime] = useState(
    currentEp?.presentation_datetime || new Date().toISOString().slice(0, 16)
  );
  const [ageYears, setAgeYears] = useState<number>(currentEp?.age_years ?? 4.0);
  const [weightKg, setWeightKg] = useState<number>(currentEp?.weight_kg ?? 16.0);
  const [substanceCategory, setSubstanceCategory] = useState<ToxicSubstanceCategory>(
    currentEp?.substance_category ?? 'acetaminophen_paracetamol'
  );
  const [ingestedDoseMgKg, setIngestedDoseMgKg] = useState<number>(
    currentEp?.ingested_dose_mg_kg ?? 200.0
  );
  const [hoursPostIngestion, setHoursPostIngestion] = useState<number>(
    currentEp?.hours_post_ingestion ?? 4.5
  );
  const [serumLevelValue, setSerumLevelValue] = useState<number>(
    currentEp?.serum_level_value ?? 165.0
  );
  const [rumackMatthewLineBreached, setRumackMatthewLineBreached] = useState<boolean>(
    currentEp ? Boolean(currentEp.rumack_matthew_line_breached) : true
  );
  const [altUL, setAltUL] = useState<number>(currentEp?.alt_u_l ?? 28.0);
  const [astUL, setAstUL] = useState<number>(currentEp?.ast_u_l ?? 32.0);
  const [totalBilirubinMgDl, setTotalBilirubinMgDl] = useState<number>(
    currentEp?.total_bilirubin_mg_dl ?? 0.7
  );
  const [prothrombinTimeInr, setProthrombinTimeInr] = useState<number>(
    currentEp?.prothrombin_time_inr ?? 1.1
  );
  const [antidoteIndicated, setAntidoteIndicated] = useState<boolean>(
    currentEp ? Boolean(currentEp.antidote_indicated) : true
  );
  const [antidoteAdministered, setAntidoteAdministered] = useState<AntidoteProtocolAdministered>(
    (currentEp?.antidote_administered as AntidoteProtocolAdministered) ?? 'iv_n_acetylcysteine_nac_protocol'
  );
  const [gastricDecontaminationContraindicated, setGastricDecontaminationContraindicated] = useState<boolean>(
    currentEp ? Boolean(currentEp.gastric_decontamination_contraindicated) : false
  );
  const [status, setStatus] = useState<PediatricToxicologyStatus>(
    (currentEp?.status as PediatricToxicologyStatus) ?? 'acute_poisoning_triage'
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    currentEp?.clinical_notes ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PediatricToxicologyEvaluation | null>(null);

  useEffect(() => {
    try {
      const evalResult = evaluatePediatricToxicology({
        ageYears,
        weightKg,
        substanceCategory,
        ingestedDoseMgKg,
        hoursPostIngestion,
        serumLevelValue,
        rumackMatthewLineBreached,
        altUL,
        astUL,
        totalBilirubinMgDl,
        prothrombinTimeInr,
        antidoteIndicated,
        antidoteAdministered,
        gastricDecontaminationContraindicated,
        status,
      });
      setPreview(evalResult);
    } catch {
      // preview calculation error suppressed
    }
  }, [
    ageYears,
    weightKg,
    substanceCategory,
    ingestedDoseMgKg,
    hoursPostIngestion,
    serumLevelValue,
    rumackMatthewLineBreached,
    altUL,
    astUL,
    totalBilirubinMgDl,
    prothrombinTimeInr,
    antidoteIndicated,
    antidoteAdministered,
    gastricDecontaminationContraindicated,
    status,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      ingestionDatetime,
      presentationDatetime,
      ageYears,
      weightKg,
      substanceCategory,
      ingestedDoseMgKg,
      hoursPostIngestion,
      serumLevelValue,
      rumackMatthewLineBreached,
      altUL,
      astUL,
      totalBilirubinMgDl,
      prothrombinTimeInr,
      antidoteIndicated,
      antidoteAdministered,
      gastricDecontaminationContraindicated,
      status,
      clinicalNotes: clinicalNotes || null,
    };

    try {
      if (currentEp) {
        await updatePediatricToxicologyEpisode(currentEp.id, payload);
        onSuccess?.(currentEp.id);
      } else {
        const res = await createPediatricToxicologyEpisode(payload);
        onSuccess?.(res.episode.id);
      }
      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save pediatric toxicology episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-amber-700 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">
              {currentEp ? 'Edit Toxic Ingestion Episode' : 'New Pediatric Toxic Exposure & Antidote Protocol'}
            </h2>
            <p className="text-xs text-amber-100">
              AAP / ACMT Guidelines: Rumack-Matthew APAP Nomogram • IV NAC • Deferoxamine • Toxidromes
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-amber-200 text-2xl font-bold"
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
              preview.urgencyTier === 'emergency_antidote_and_picu'
                ? 'bg-red-50 border-red-300'
                : preview.urgencyTier === 'urgent_inpatient_toxicology_monitoring'
                ? 'bg-amber-50 border-amber-300'
                : 'bg-emerald-50 border-emerald-300'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm tracking-wide uppercase">
                  {preview.urgencyTierLabel}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-white/80 shadow-sm">
                  {preview.toxicityRiskLabel}
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
                  <span className="text-gray-600 block">Antidote Status:</span>
                  <span className="font-bold">{preview.isAntidoteIndicated ? `Indicated (${preview.antidoteName})` : 'None Indicated'}</span>
                </div>
                <div>
                  <span className="text-gray-600 block">Decontamination Safety:</span>
                  <span className="font-bold text-red-800">
                    {preview.isDecontaminationStrictlyContraindicated ? 'CONTRAINDICATED (Perforation Risk)' : 'Charcoal Safe if < 2h'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 block">Rumack-Matthew:</span>
                  <span className="font-bold">{preview.rumackMatthewNomogramBreached ? 'TREATMENT LINE BREACHED' : 'Below Treatment Line'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Section 1: Demographics & Timings */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ingestion Datetime *</label>
              <input
                type="datetime-local"
                value={ingestionDatetime}
                onChange={(e) => setIngestionDatetime(e.target.value)}
                required
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Presentation Datetime *</label>
              <input
                type="datetime-local"
                value={presentationDatetime}
                onChange={(e) => setPresentationDatetime(e.target.value)}
                required
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Age (Years) *</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="21"
                value={ageYears}
                onChange={(e) => setAgeYears(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Weight (kg) *</label>
              <input
                type="number"
                step="0.5"
                min="2"
                max="150"
                value={weightKg}
                onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                required
                className="w-full border rounded px-3 py-1.5 text-sm font-bold"
              />
            </div>
          </div>

          {/* Section 2: Substance & Exposure Quantification */}
          <div className="border border-amber-200 bg-amber-50/30 p-4 rounded-lg space-y-4">
            <h3 className="text-sm font-bold text-amber-900 border-b border-amber-200 pb-1">
              Toxic Substance & Exposure Quantification
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Substance Category *</label>
                <select
                  value={substanceCategory}
                  onChange={(e) => setSubstanceCategory(e.target.value as ToxicSubstanceCategory)}
                  className="w-full border rounded px-3 py-1.5 text-sm font-semibold"
                >
                  <option value="acetaminophen_paracetamol">Acetaminophen / Paracetamol</option>
                  <option value="iron_elemental_supplement">Elemental Iron / Ferrous Sulfate</option>
                  <option value="organophosphate_carbamate">Organophosphate / Carbamate</option>
                  <option value="caustic_alkali_acid_battery">Caustic Alkali / Acid / Button Battery</option>
                  <option value="hydrocarbon_petroleum">Hydrocarbon / Petroleum Distillate</option>
                  <option value="other_unidentified_toxin">Other Unidentified Toxin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ingested Dose (mg/kg)</label>
                <input
                  type="number"
                  step="5"
                  min="0"
                  max="5000"
                  value={ingestedDoseMgKg}
                  onChange={(e) => setIngestedDoseMgKg(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-3 py-1.5 text-sm font-bold"
                />
                <p className="text-[11px] text-gray-500 mt-0.5">APAP &ge; 150 mg/kg; Iron &ge; 40 mg/kg toxic</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Hours Post-Ingestion *</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="168"
                  value={hoursPostIngestion}
                  onChange={(e) => setHoursPostIngestion(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full border rounded px-3 py-1.5 text-sm"
                />
                <p className="text-[11px] text-gray-500 mt-0.5">Rumack-Matthew valid 4 to 24h</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Serum Level (mcg/mL or mcg/dL)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="5000"
                  value={serumLevelValue}
                  onChange={(e) => setSerumLevelValue(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-3 py-1.5 text-sm font-bold text-amber-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-800 bg-white p-2.5 rounded border">
                <input
                  type="checkbox"
                  checked={rumackMatthewLineBreached}
                  onChange={(e) => setRumackMatthewLineBreached(e.target.checked)}
                />
                <span>Rumack-Matthew Nomogram Treatment Line Breached</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-800 bg-white p-2.5 rounded border">
                <input
                  type="checkbox"
                  checked={gastricDecontaminationContraindicated}
                  onChange={(e) => setGastricDecontaminationContraindicated(e.target.checked)}
                />
                <span>Gastric Decontamination Strictly Contraindicated (Caustic/Hydrocarbon)</span>
              </label>
            </div>
          </div>

          {/* Section 3: Organ Damage Biomarkers (LFTs & INR) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Serum ALT (U/L)</label>
              <input
                type="number"
                min="5"
                max="10000"
                value={altUL}
                onChange={(e) => setAltUL(parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Serum AST (U/L)</label>
              <input
                type="number"
                min="5"
                max="10000"
                value={astUL}
                onChange={(e) => setAstUL(parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Total Bilirubin (mg/dL)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="50"
                value={totalBilirubinMgDl}
                onChange={(e) => setTotalBilirubinMgDl(parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prothrombin Time / INR</label>
              <input
                type="number"
                step="0.05"
                min="0.7"
                max="20"
                value={prothrombinTimeInr}
                onChange={(e) => setProthrombinTimeInr(parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-3 py-1.5 text-sm font-bold"
              />
            </div>
          </div>

          {/* Section 4: Antidote Protocol & Status */}
          <div className="border border-gray-200 p-4 rounded-lg space-y-3">
            <h3 className="text-sm font-bold text-gray-900 border-b pb-1">
              Antidote Therapy & Protocol Progression
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={antidoteIndicated}
                  onChange={(e) => setAntidoteIndicated(e.target.checked)}
                />
                <span>Specific Antidote Indicated</span>
              </label>

              <div>
                <label className="block text-[11px] text-gray-600 mb-0.5">Antidote Regimen</label>
                <select
                  value={antidoteAdministered}
                  onChange={(e) => setAntidoteAdministered(e.target.value as AntidoteProtocolAdministered)}
                  className="w-full border rounded px-2 py-1 text-xs"
                >
                  <option value="iv_n_acetylcysteine_nac_protocol">IV N-Acetylcysteine (NAC 3-Bag)</option>
                  <option value="iv_deferoxamine_chelation">IV Deferoxamine Chelation</option>
                  <option value="atropine_pralidoxime_regimen">Atropine + Pralidoxime (2-PAM)</option>
                  <option value="activated_charcoal_single_dose">Activated Charcoal Single Dose</option>
                  <option value="whole_bowel_irrigation_peg">Whole Bowel Irrigation (PEG-ELS)</option>
                  <option value="supportive_care_only">Supportive Care Only</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-gray-600 mb-0.5">Clinical Protocol Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PediatricToxicologyStatus)}
                  className="w-full border rounded px-2 py-1 text-xs"
                >
                  <option value="acute_poisoning_triage">Acute Poisoning Triage</option>
                  <option value="antidote_infusion_active">Antidote Infusion Active</option>
                  <option value="picu_organ_support_monitoring">PICU Organ Support Monitoring</option>
                  <option value="toxic_levels_clearing">Toxic Levels Clearing</option>
                  <option value="convalescent_hepatic_recovery">Convalescent Hepatic Recovery</option>
                  <option value="resolved_discharged_home">Resolved / Discharged Home</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 5: Clinical Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Clinical Notes & Poison Center Coordination</label>
            <textarea
              rows={3}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Record poison control center case number, GI decontamination details, pupillary responses, serial LFT trends, and psychiatric assessment..."
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
              className="px-5 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : currentEp ? 'Update Episode' : 'Create Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
