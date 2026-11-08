import React, { useState } from 'react';
import {
  createPediatricMeningitisEpisode,
  type PediatricBacterialMeningitisRecord,
} from '../api';
import {
  evaluatePediatricBacterialMeningitis,
  type PediatricBacterialMeningitisEvaluationResult,
} from '../pediatricBacterialMeningitisEngine';

interface Props {
  patientId: number;
  existingEpisode?: PediatricBacterialMeningitisRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricBacterialMeningitisModal: React.FC<Props> = ({
  patientId,
  existingEpisode,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [triageDatetime, setTriageDatetime] = useState(
    existingEpisode?.triage_datetime || new Date().toISOString().slice(0, 16),
  );
  const [ageMonths, setAgeMonths] = useState<number>(
    existingEpisode?.age_months ?? 24,
  );
  const [weightKg, setWeightKg] = useState<number>(
    existingEpisode?.weight_kg ?? 12.5,
  );

  const [priorAntibioticExposure72h, setPriorAntibioticExposure72h] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.prior_antibiotic_exposure_72h) : false,
  );
  const [seizureAtPresentation, setSeizureAtPresentation] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.seizure_at_presentation) : false,
  );
  const [gcsScore, setGcsScore] = useState<number>(
    existingEpisode?.gcs_score ?? 15,
  );
  const [kernigBrudzinskiSign, setKernigBrudzinskiSign] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.kernig_brudzinski_sign) : true,
  );
  const [fontanelleBulging, setFontanelleBulging] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.fontanelle_bulging) : false,
  );
  const [purpuricRash, setPurpuricRash] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.purpuric_rash) : false,
  );

  // CSF Parameters
  const [csfWbcCount, setCsfWbcCount] = useState<number>(
    existingEpisode?.csf_wbc_count ?? 250,
  );
  const [csfNeutrophilPercent, setCsfNeutrophilPercent] = useState<number>(
    existingEpisode?.csf_neutrophil_percent ?? 80,
  );
  const [csfProteinMgDl, setCsfProteinMgDl] = useState<number>(
    existingEpisode?.csf_protein_mg_dl ?? 120,
  );
  const [csfGlucoseMgDl, setCsfGlucoseMgDl] = useState<number>(
    existingEpisode?.csf_glucose_mg_dl ?? 28,
  );
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState<number>(
    existingEpisode?.blood_glucose_mg_dl ?? 105,
  );

  const [csfGramStainPositive, setCsfGramStainPositive] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.csf_gram_stain_positive) : true,
  );
  const [csfGramStainOrganism, setCsfGramStainOrganism] = useState<
    'none_seen' | 'gram_positive_cocci_pairs' | 'gram_negative_diplococci' | 'gram_negative_bacilli' | 'other'
  >(existingEpisode?.csf_gram_stain_organism ?? 'gram_positive_cocci_pairs');

  const [peripheralWbc, setPeripheralWbc] = useState<number>(
    existingEpisode?.peripheral_wbc ?? 18.5,
  );
  const [peripheralAnc, setPeripheralAnc] = useState<number>(
    existingEpisode?.peripheral_anc ?? 13500,
  );

  const [empiricCeftriaxoneOrdered, setEmpiricCeftriaxoneOrdered] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.empiric_ceftriaxone_ordered) : true,
  );
  const [empiricVancomycinOrdered, setEmpiricVancomycinOrdered] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.empiric_vancomycin_ordered) : true,
  );
  const [dexamethasoneGivenPreAntibiotic, setDexamethasoneGivenPreAntibiotic] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.dexamethasone_given_pre_antibiotic) : true,
  );
  const [isolationPrecautions, setIsolationPrecautions] = useState<'droplet_precautions' | 'standard'>(
    existingEpisode?.isolation_precautions ?? 'droplet_precautions',
  );

  const [status, setStatus] = useState<
    'active_triage' | 'picu_critical_care' | 'ward_antimicrobial_therapy' | 'aseptic_meningitis_weaning' | 'resolved_discharged'
  >(existingEpisode?.status ?? 'active_triage');

  const [clinicalNotes, setClinicalNotes] = useState<string>(
    existingEpisode?.clinical_notes ?? '',
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const evaluation: PediatricBacterialMeningitisEvaluationResult = evaluatePediatricBacterialMeningitis({
    ageMonths,
    weightKg,
    priorAntibioticExposure72h,
    seizureAtPresentation,
    gcsScore,
    kernigBrudzinskiSign,
    fontanelleBulging,
    purpuricRash,
    csfWbcCount,
    csfNeutrophilPercent,
    csfProteinMgDl,
    csfGlucoseMgDl,
    bloodGlucoseMgDl,
    csfGramStainPositive,
    csfGramStainOrganism,
    peripheralWbc,
    peripheralAnc,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await createPediatricMeningitisEpisode({
        patientId,
        triageDatetime,
        ageMonths,
        weightKg,
        priorAntibioticExposure72h,
        seizureAtPresentation,
        gcsScore,
        kernigBrudzinskiSign,
        fontanelleBulging,
        purpuricRash,
        csfWbcCount,
        csfNeutrophilPercent,
        csfProteinMgDl,
        csfGlucoseMgDl,
        bloodGlucoseMgDl,
        csfGramStainPositive,
        csfGramStainOrganism,
        peripheralWbc,
        peripheralAnc,
        empiricCeftriaxoneOrdered,
        empiricVancomycinOrdered,
        dexamethasoneGivenPreAntibiotic,
        isolationPrecautions,
        status,
        clinicalNotes: clinicalNotes || null,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save meningitis episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="text-xl font-bold text-gray-800">
            {existingEpisode ? 'Pediatric Bacterial Meningitis Episode' : 'Pediatric Bacterial Meningitis & Nigrovic BMS Score'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">&times;</button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded mt-3 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
          {/* Real-time Assessment Banner */}
          <div className="bg-amber-50 border border-amber-300 rounded p-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-amber-900">
                  Nigrovic Bacterial Meningitis Score:
                </span>
                <span className="ml-2 text-2xl font-extrabold text-amber-950">
                  {evaluation.bmsBreakdown.totalBmsScore} / 6
                </span>
                <span className="ml-3 text-xs text-gray-600">
                  (CSF:Blood Glucose Ratio: <strong>{evaluation.csfToBloodGlucoseRatio}</strong> | CSF ANC: <strong>{evaluation.csfAncCalculated}</strong> cells/mm³)
                </span>
              </div>
              <span
                className={`px-3 py-1 text-xs font-bold rounded-full ${
                  evaluation.riskTier === 'high_risk'
                    ? 'bg-red-200 text-red-900'
                    : 'bg-emerald-200 text-emerald-900'
                }`}
              >
                {evaluation.riskTierLabel}
              </span>
            </div>

            {/* Antibiotic Dosing Guidance */}
            <div className="mt-2.5 pt-2 border-t border-amber-200 grid grid-cols-1 md:grid-cols-3 gap-2 text-amber-950 font-medium">
              <div>
                <strong>Ceftriaxone:</strong> {evaluation.antibioticRecommendations.ceftriaxoneDoseMg} mg IV Q12H
              </div>
              <div>
                <strong>Vancomycin:</strong> {evaluation.antibioticRecommendations.vancomycinDoseMg} mg IV Q6H
              </div>
              <div>
                <strong>Dexamethasone:</strong> {evaluation.antibioticRecommendations.dexamethasoneDoseMg} mg IV Q6H (pre-dose)
              </div>
            </div>

            {evaluation.alerts.length > 0 && (
              <div className="mt-2 pt-2 border-t border-amber-200 space-y-1">
                {evaluation.alerts.map((alt, idx) => (
                  <div key={idx} className="text-rose-800 font-semibold flex items-center gap-1">
                    <span>⚠</span> {alt}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Demographics & Clinical Presentation */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 p-3 rounded border">
            <div>
              <label className="block font-medium text-gray-700">Triage Timestamp</label>
              <input
                type="datetime-local"
                value={triageDatetime}
                onChange={(e) => setTriageDatetime(e.target.value)}
                className="w-full border rounded p-1.5"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">Age (Months)</label>
              <input
                type="number"
                value={ageMonths}
                onChange={(e) => setAgeMonths(parseInt(e.target.value, 10) || 12)}
                className="w-full border rounded p-1.5"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(parseFloat(e.target.value) || 10)}
                className="w-full border rounded p-1.5"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">GCS Score (3-15)</label>
              <input
                type="number"
                min="3"
                max="15"
                value={gcsScore}
                onChange={(e) => setGcsScore(parseInt(e.target.value, 10) || 15)}
                className="w-full border rounded p-1.5 font-bold"
                required
              />
            </div>
          </div>

          {/* Clinical Risk Indicators */}
          <div className="border rounded p-3 bg-yellow-50/40">
            <h4 className="font-bold uppercase tracking-wider text-gray-800 mb-2">
              Clinical Signs & Pretreatment History
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={priorAntibioticExposure72h}
                  onChange={(e) => setPriorAntibioticExposure72h(e.target.checked)}
                />
                <span className="font-semibold text-rose-800">Prior Antibiotics within 72h (Confounder)</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={seizureAtPresentation}
                  onChange={(e) => setSeizureAtPresentation(e.target.checked)}
                />
                <span className="font-semibold text-gray-800">Seizure at/before Presentation (+1 BMS)</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={kernigBrudzinskiSign}
                  onChange={(e) => setKernigBrudzinskiSign(e.target.checked)}
                />
                <span className="text-gray-800">Positive Kernig or Brudzinski Sign</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={fontanelleBulging}
                  onChange={(e) => setFontanelleBulging(e.target.checked)}
                />
                <span className="text-gray-800">Bulging Fontanelle (Infants)</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={purpuricRash}
                  onChange={(e) => setPurpuricRash(e.target.checked)}
                />
                <span className="font-bold text-red-700">Petechial / Purpuric Rash (Meningococcemia)</span>
              </label>
            </div>
          </div>

          {/* CSF & Laboratory Profile */}
          <div className="border rounded p-3">
            <h4 className="font-bold uppercase tracking-wider text-gray-800 mb-2">
              CSF Cytology & Chemistry (Nigrovic Predictors)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="block font-medium text-gray-700">CSF WBC (/mm³)</label>
                <input
                  type="number"
                  value={csfWbcCount}
                  onChange={(e) => setCsfWbcCount(parseInt(e.target.value, 10) || 0)}
                  className="w-full border rounded p-1.5"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700">CSF Neutrophil (%)</label>
                <input
                  type="number"
                  value={csfNeutrophilPercent}
                  onChange={(e) => setCsfNeutrophilPercent(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded p-1.5"
                  required
                />
                <span className="text-[10px] text-gray-500">ANC: {evaluation.csfAncCalculated} cells/mm³</span>
              </div>

              <div>
                <label className="block font-medium text-gray-700">CSF Protein (mg/dL)</label>
                <input
                  type="number"
                  value={csfProteinMgDl}
                  onChange={(e) => setCsfProteinMgDl(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded p-1.5"
                  required
                />
                <span className="text-[10px] text-gray-500">≥80 mg/dL = +1 BMS</span>
              </div>

              <div>
                <label className="block font-medium text-gray-700">CSF Glucose (mg/dL)</label>
                <input
                  type="number"
                  value={csfGlucoseMgDl}
                  onChange={(e) => setCsfGlucoseMgDl(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded p-1.5"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700">Blood Glucose (mg/dL)</label>
                <input
                  type="number"
                  value={bloodGlucoseMgDl}
                  onChange={(e) => setBloodGlucoseMgDl(parseFloat(e.target.value) || 100)}
                  className="w-full border rounded p-1.5"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3 pt-3 border-t">
              <div className="flex items-center space-x-2 pt-4">
                <input
                  type="checkbox"
                  id="gramstain"
                  checked={csfGramStainPositive}
                  onChange={(e) => setCsfGramStainPositive(e.target.checked)}
                />
                <label htmlFor="gramstain" className="font-bold text-rose-900">
                  CSF Gram Stain Positive (+2 BMS)
                </label>
              </div>

              <div>
                <label className="block font-medium text-gray-700">Gram Stain Organism</label>
                <select
                  value={csfGramStainOrganism}
                  onChange={(e) => setCsfGramStainOrganism(e.target.value as any)}
                  className="w-full border rounded p-1.5"
                >
                  <option value="none_seen">None Seen</option>
                  <option value="gram_positive_cocci_pairs">Gram+ Cocci Pairs (S. pneumoniae)</option>
                  <option value="gram_negative_diplococci">Gram- Diplococci (N. meningitidis)</option>
                  <option value="gram_negative_bacilli">Gram- Bacilli (H. influenzae / E. coli)</option>
                  <option value="other">Other morphology</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700">Peripheral WBC (x10³/µL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={peripheralWbc}
                  onChange={(e) => setPeripheralWbc(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded p-1.5"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700">Peripheral ANC (/mm³)</label>
                <input
                  type="number"
                  value={peripheralAnc}
                  onChange={(e) => setPeripheralAnc(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded p-1.5"
                  required
                />
                <span className="text-[10px] text-gray-500">≥10,000 /mm³ = +1 BMS</span>
              </div>
            </div>
          </div>

          {/* Treatment Orders & Precautions */}
          <div className="border rounded p-3 bg-gray-50">
            <h4 className="font-bold uppercase tracking-wider text-gray-800 mb-2">
              Empiric Antibiotic Orders & Dexamethasone Timing
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={empiricCeftriaxoneOrdered}
                  onChange={(e) => setEmpiricCeftriaxoneOrdered(e.target.checked)}
                />
                <span className="font-semibold text-gray-800">Ceftriaxone Ordered (100mg/kg/d)</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={empiricVancomycinOrdered}
                  onChange={(e) => setEmpiricVancomycinOrdered(e.target.checked)}
                />
                <span className="font-semibold text-gray-800">Vancomycin Ordered (60mg/kg/d)</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={dexamethasoneGivenPreAntibiotic}
                  onChange={(e) => setDexamethasoneGivenPreAntibiotic(e.target.checked)}
                />
                <span className="font-semibold text-amber-900">Dexamethasone Given Pre-Antibiotic</span>
              </label>

              <div>
                <select
                  value={isolationPrecautions}
                  onChange={(e) => setIsolationPrecautions(e.target.value as any)}
                  className="w-full border rounded p-1.5 font-semibold text-rose-900"
                >
                  <option value="droplet_precautions">Strict Droplet Precautions</option>
                  <option value="standard">Standard Precautions</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-medium text-gray-700">Clinical Notes</label>
            <textarea
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              rows={2}
              className="w-full border rounded p-1.5"
              placeholder="Neurological exam, lumbar puncture opening pressure, antibiotic start time..."
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-amber-600 text-white rounded font-bold hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Initiate Meningitis Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
