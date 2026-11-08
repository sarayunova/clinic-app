import React, { useState, useEffect } from 'react';
import {
  createPediatricAppendicitisEpisode,
  updatePediatricAppendicitisEpisode,
  calculatePediatricAppendicitis,
  type PediatricAppendicitisRecord,
} from '../api';
import {
  calculateSamuelPasScore,
  type ManagementPathway,
  type EmpiricAntibioticRegimen,
  type SurgicalFindings,
} from '../pediatricAppendicitisEngine';

interface Props {
  patientId: number;
  existingEpisode?: PediatricAppendicitisRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricAppendicitisModal: React.FC<Props> = ({
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
  const [ageYears, setAgeYears] = useState<number>(existingEpisode?.age_years ?? 8.0);
  const [weightKg, setWeightKg] = useState<number>(existingEpisode?.weight_kg ?? 26.5);
  const [symptomDurationHours, setSymptomDurationHours] = useState<number>(
    existingEpisode?.symptom_duration_hours ?? 18.0,
  );

  // Samuel PAS Criteria
  const [coughPain, setCoughPain] = useState<boolean>(
    existingEpisode ? existingEpisode.cough_percussion_hopping_rlq_pain === 1 : true,
  );
  const [rlqTenderness, setRlqTenderness] = useState<boolean>(
    existingEpisode ? existingEpisode.rlq_tenderness_light_palpation === 1 : true,
  );
  const [painMigration, setPainMigration] = useState<boolean>(
    existingEpisode ? existingEpisode.migration_pain_to_rlq === 1 : true,
  );
  const [fever, setFever] = useState<boolean>(
    existingEpisode ? existingEpisode.fever_gt_38c === 1 : true,
  );
  const [nauseaVomiting, setNauseaVomiting] = useState<boolean>(
    existingEpisode ? existingEpisode.nausea_or_vomiting === 1 : true,
  );
  const [anorexia, setAnorexia] = useState<boolean>(
    existingEpisode ? existingEpisode.anorexia === 1 : true,
  );
  const [leukocytosis, setLeukocytosis] = useState<boolean>(
    existingEpisode ? existingEpisode.leukocytosis_wbc_gt_10000 === 1 : true,
  );
  const [neutrophilia, setNeutrophilia] = useState<boolean>(
    existingEpisode ? existingEpisode.neutrophilia_anc_gt_7500_or_ge_75pct === 1 : true,
  );

  const [wbcCount, setWbcCount] = useState<number | undefined>(
    existingEpisode?.wbc_count_per_microliter ?? 14200,
  );
  const [neutrophilPercent, setNeutrophilPercent] = useState<number | undefined>(
    existingEpisode?.neutrophil_percent ?? 82.0,
  );
  const [crpMgL, setCrpMgL] = useState<number | undefined>(
    existingEpisode?.crp_mg_l ?? 38.0,
  );

  // Ultrasound findings
  const [ultrasoundPerformed, setUltrasoundPerformed] = useState<boolean>(
    existingEpisode ? existingEpisode.ultrasound_performed === 1 : true,
  );
  const [appendixVisualized, setAppendixVisualized] = useState<boolean>(
    existingEpisode ? existingEpisode.appendix_visualized === 1 : true,
  );
  const [outerDiameterMm, setOuterDiameterMm] = useState<number | undefined>(
    existingEpisode?.outer_diameter_mm ?? 7.8,
  );
  const [nonCompressible, setNonCompressible] = useState<boolean>(
    existingEpisode ? existingEpisode.non_compressible === 1 : true,
  );
  const [hypervascular, setHypervascular] = useState<boolean>(
    existingEpisode ? existingEpisode.hypervascular_ring_of_fire === 1 : true,
  );
  const [appendicolith, setAppendicolith] = useState<boolean>(
    existingEpisode ? existingEpisode.appendicolith_fecalith_present === 1 : false,
  );
  const [fatStranding, setFatStranding] = useState<boolean>(
    existingEpisode ? existingEpisode.periappendiceal_fluid_or_fat_stranding === 1 : true,
  );
  const [perforationSuspected, setPerforationSuspected] = useState<boolean>(
    existingEpisode ? existingEpisode.perforation_or_abscess_suspected === 1 : false,
  );

  const [pathway, setPathway] = useState<ManagementPathway>(
    existingEpisode?.management_pathway ?? 'urgent_laparoscopic_appendectomy',
  );
  const [antibioticRegimen, setAntibioticRegimen] = useState<EmpiricAntibioticRegimen>(
    existingEpisode?.empiric_antibiotic_regimen ?? 'ceftriaxone_plus_metronidazole',
  );
  const [surgicalFindings, setSurgicalFindings] = useState<SurgicalFindings | undefined>(
    existingEpisode?.surgical_findings ?? undefined,
  );

  const [status, setStatus] = useState<PediatricAppendicitisRecord['status']>(
    existingEpisode?.status ?? 'triage_diagnostic_evaluation',
  );
  const [clinicalNotes, setClinicalNotes] = useState(existingEpisode?.clinical_notes || '');

  const [evalResult, setEvalResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Live calculation
  useEffect(() => {
    let active = true;
    const runEval = async () => {
      try {
        const res = await calculatePediatricAppendicitis({
          ageYears,
          weightKg,
          symptomDurationHours,
          coughPercussionHoppingRlqPain: coughPain,
          rlqTendernessLightPalpation: rlqTenderness,
          migrationPainToRlq: painMigration,
          feverGt38c: fever,
          nauseaOrVomiting: nauseaVomiting,
          anorexia,
          leukocytosisWbcGt10000: leukocytosis,
          neutrophiliaAncGt7500OrGe75pct: neutrophilia,
          wbcCountPerMicroliter: wbcCount,
          neutrophilPercent,
          crpMgL,
          ultrasoundPerformed,
          appendixVisualized,
          outerDiameterMm,
          nonCompressible,
          hypervascularRingOfFire: hypervascular,
          appendicolithFecalithPresent: appendicolith,
          periappendicealFluidOrFatStranding: fatStranding,
          perforationOrAbscessSuspected: perforationSuspected,
          managementPathway: pathway,
          empiricAntibioticRegimen: antibioticRegimen,
          surgicalFindings,
        });
        if (active) setEvalResult(res.evalResult);
      } catch (err: any) {
        // Fallback
      }
    };
    runEval();
    return () => {
      active = false;
    };
  }, [
    ageYears,
    weightKg,
    symptomDurationHours,
    coughPain,
    rlqTenderness,
    painMigration,
    fever,
    nauseaVomiting,
    anorexia,
    leukocytosis,
    neutrophilia,
    wbcCount,
    neutrophilPercent,
    crpMgL,
    ultrasoundPerformed,
    appendixVisualized,
    outerDiameterMm,
    nonCompressible,
    hypervascular,
    appendicolith,
    fatStranding,
    perforationSuspected,
    pathway,
    antibioticRegimen,
    surgicalFindings,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      patientId,
      triageDatetime,
      ageYears,
      weightKg,
      symptomDurationHours,
      coughPercussionHoppingRlqPain: coughPain,
      rlqTendernessLightPalpation: rlqTenderness,
      migrationPainToRlq: painMigration,
      feverGt38c: fever,
      nauseaOrVomiting: nauseaVomiting,
      anorexia,
      leukocytosisWbcGt10000: leukocytosis,
      neutrophiliaAncGt7500OrGe75pct: neutrophilia,
      wbcCountPerMicroliter: wbcCount,
      neutrophilPercent,
      crpMgL,
      ultrasoundPerformed,
      appendixVisualized,
      outerDiameterMm,
      nonCompressible,
      hypervascularRingOfFire: hypervascular,
      appendicolithFecalithPresent: appendicolith,
      periappendicealFluidOrFatStranding: fatStranding,
      perforationOrAbscessSuspected: perforationSuspected,
      managementPathway: pathway,
      empiricAntibioticRegimen: antibioticRegimen,
      surgicalFindings: surgicalFindings || null,
      status,
      clinicalNotes,
    };

    try {
      if (existingEpisode) {
        await updatePediatricAppendicitisEpisode(existingEpisode.id, payload);
      } else {
        await createPediatricAppendicitisEpisode(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save pediatric appendicitis episode');
    } finally {
      setSaving(false);
    }
  };

  const calculatedPas = calculateSamuelPasScore({
    coughPercussionHoppingRlqPain: coughPain,
    rlqTendernessLightPalpation: rlqTenderness,
    migrationPainToRlq: painMigration,
    feverGt38c: fever,
    nauseaOrVomiting: nauseaVomiting,
    anorexia,
    leukocytosisWbcGt10000: leukocytosis,
    neutrophiliaAncGt7500OrGe75pct: neutrophilia,
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-indigo-50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-indigo-950">
              {existingEpisode ? 'Edit Pediatric Appendicitis Record' : 'Initiate Pediatric Acute Appendicitis Evaluation'}
            </h2>
            <p className="text-sm text-indigo-700">
              Samuel PAS Score (0-10) &bull; Graded-Compression Ultrasound &bull; APSA Surgical Guidelines
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
          >
            &times;
          </button>
        </div>

        {/* Live Calculation Banner */}
        {evalResult && (
          <div className="px-6 py-3 bg-indigo-100/60 border-b border-indigo-200 text-sm flex flex-wrap gap-4 items-center justify-between">
            <div>
              <span className="font-semibold text-indigo-950">Samuel PAS Score: </span>
              <span className="text-lg font-bold text-indigo-800">{calculatedPas}/10</span>
              <span
                className={`ml-3 px-2 py-0.5 rounded text-xs font-semibold ${
                  calculatedPas >= 7
                    ? 'bg-rose-200 text-rose-900'
                    : calculatedPas >= 4
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-emerald-200 text-emerald-900'
                }`}
              >
                {evalResult.riskTier.toUpperCase().replace(/_/g, ' ')}
              </span>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Probability: </span>
              <span className="font-bold text-indigo-900">{evalResult.predictedProbabilityPercent}%</span>
              {evalResult.ultrasoundDefinitiveForAppendicitis && (
                <span className="ml-3 px-2 py-0.5 rounded text-xs font-bold bg-purple-200 text-purple-900">
                  US Confirmed
                </span>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

          {/* Section 1: Demographics & Duration */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm tracking-wide uppercase">
              1. Triage & Baseline Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Triage Datetime</label>
                <input
                  type="datetime-local"
                  value={triageDatetime}
                  onChange={(e) => setTriageDatetime(e.target.value)}
                  className="w-full border rounded px-3 py-1.5"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Age (Years)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="18"
                  value={ageYears}
                  onChange={(e) => setAgeYears(parseFloat(e.target.value))}
                  className="w-full border rounded px-3 py-1.5"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Weight (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  min="4"
                  max="120"
                  value={weightKg}
                  onChange={(e) => setWeightKg(parseFloat(e.target.value))}
                  className="w-full border rounded px-3 py-1.5"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Symptom Duration (Hours)</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="336"
                  value={symptomDurationHours}
                  onChange={(e) => setSymptomDurationHours(parseFloat(e.target.value))}
                  className="w-full border rounded px-3 py-1.5"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Samuel Pediatric Appendicitis Score (PAS) */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm tracking-wide uppercase flex justify-between">
              <span>2. Samuel Pediatric Appendicitis Score Criteria</span>
              <span className="text-indigo-800 font-bold">Subtotal: {calculatedPas} / 10 pts</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-white p-3 rounded border">
              <label className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={coughPain}
                  onChange={(e) => setCoughPain(e.target.checked)}
                />
                <span className="font-medium text-gray-800">
                  Cough / Percussion / Hopping Tenderness in RLQ <strong>(+2 pts)</strong>
                </span>
              </label>

              <label className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={rlqTenderness}
                  onChange={(e) => setRlqTenderness(e.target.checked)}
                />
                <span className="font-medium text-gray-800">
                  Tenderness in RLQ to Light Palpation <strong>(+2 pts)</strong>
                </span>
              </label>

              <label className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={painMigration}
                  onChange={(e) => setPainMigration(e.target.checked)}
                />
                <span className="font-medium text-gray-800">
                  Migration of Pain from Periumbilical to RLQ <strong>(+1 pt)</strong>
                </span>
              </label>

              <label className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={fever}
                  onChange={(e) => setFever(e.target.checked)}
                />
                <span className="font-medium text-gray-800">
                  Fever &gt; 38.0&deg;C (100.4&deg;F) <strong>(+1 pt)</strong>
                </span>
              </label>

              <label className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={nauseaVomiting}
                  onChange={(e) => setNauseaVomiting(e.target.checked)}
                />
                <span className="font-medium text-gray-800">
                  Nausea or Vomiting <strong>(+1 pt)</strong>
                </span>
              </label>

              <label className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={anorexia}
                  onChange={(e) => setAnorexia(e.target.checked)}
                />
                <span className="font-medium text-gray-800">
                  Anorexia / Poor Oral Intake <strong>(+1 pt)</strong>
                </span>
              </label>

              <label className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={leukocytosis}
                  onChange={(e) => setLeukocytosis(e.target.checked)}
                />
                <span className="font-medium text-gray-800">
                  Leukocytosis (WBC &gt; 10,000/&mu;L) <strong>(+1 pt)</strong>
                </span>
              </label>

              <label className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={neutrophilia}
                  onChange={(e) => setNeutrophilia(e.target.checked)}
                />
                <span className="font-medium text-gray-800">
                  Neutrophilia (ANC &gt; 7,500 or &ge; 75%) <strong>(+1 pt)</strong>
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-xs">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Exact WBC (/&mu;L)</label>
                <input
                  type="number"
                  placeholder="e.g. 14200"
                  value={wbcCount ?? ''}
                  onChange={(e) => setWbcCount(e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-full border rounded px-2.5 py-1 text-xs"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Neutrophils (%)</label>
                <input
                  type="number"
                  placeholder="e.g. 82"
                  value={neutrophilPercent ?? ''}
                  onChange={(e) => setNeutrophilPercent(e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-full border rounded px-2.5 py-1 text-xs"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">CRP (mg/L)</label>
                <input
                  type="number"
                  placeholder="e.g. 38"
                  value={crpMgL ?? ''}
                  onChange={(e) => setCrpMgL(e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-full border rounded px-2.5 py-1 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Graded-Compression Ultrasound */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm tracking-wide uppercase">
              3. Graded-Compression Ultrasound & Pathology
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ultrasoundPerformed}
                  onChange={(e) => setUltrasoundPerformed(e.target.checked)}
                />
                <span className="font-medium text-gray-800">Ultrasound Performed</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={appendixVisualized}
                  onChange={(e) => setAppendixVisualized(e.target.checked)}
                />
                <span className="font-medium text-gray-800">Appendix Visualized</span>
              </label>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Outer Diameter (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  min="2"
                  max="25"
                  placeholder="e.g. 7.8 (&ge; 6 mm positive)"
                  value={outerDiameterMm ?? ''}
                  onChange={(e) => setOuterDiameterMm(e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-full border rounded px-2 py-1 text-xs"
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={nonCompressible}
                  onChange={(e) => setNonCompressible(e.target.checked)}
                />
                <span className="font-medium text-gray-800">Non-Compressible Blind-Ending Loop</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hypervascular}
                  onChange={(e) => setHypervascular(e.target.checked)}
                />
                <span className="font-medium text-gray-800">Hypervascular Wall (&quot;Ring of Fire&quot;)</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={appendicolith}
                  onChange={(e) => setAppendicolith(e.target.checked)}
                />
                <span className="font-medium text-gray-800">Appendicolith / Fecalith Present</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={fatStranding}
                  onChange={(e) => setFatStranding(e.target.checked)}
                />
                <span className="font-medium text-gray-800">Periappendiceal Fluid / Fat Stranding</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={perforationSuspected}
                  onChange={(e) => setPerforationSuspected(e.target.checked)}
                />
                <span className="font-medium text-rose-700 font-bold">Perforation / Phlegmon Suspected</span>
              </label>
            </div>
          </div>

          {/* Section 4: Management & Findings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Management Pathway</label>
              <select
                value={pathway}
                onChange={(e) => setPathway(e.target.value as ManagementPathway)}
                className="w-full border rounded px-3 py-1.5 text-xs font-semibold"
              >
                <option value="urgent_laparoscopic_appendectomy">Urgent Laparoscopic Appendectomy</option>
                <option value="open_appendectomy">Open Appendectomy</option>
                <option value="non_operative_iv_antibiotics">Non-Operative IV Antibiotics Trial</option>
                <option value="percutaneous_abscess_drainage_interval">Percutaneous Drainage + Interval Appy</option>
                <option value="discharge_observation">Discharge & Outpatient Surveillance</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Empiric Antibiotics</label>
              <select
                value={antibioticRegimen}
                onChange={(e) => setAntibioticRegimen(e.target.value as EmpiricAntibioticRegimen)}
                className="w-full border rounded px-3 py-1.5 text-xs"
              >
                <option value="none">None</option>
                <option value="ceftriaxone_plus_metronidazole">Ceftriaxone + Metronidazole</option>
                <option value="piperacillin_tazobactam">Piperacillin-Tazobactam (Zosyn)</option>
                <option value="ampicillin_gentamicin_metronidazole">Ampicillin + Gentamicin + Metronidazole</option>
                <option value="ciprofloxacin_plus_metronidazole">Ciprofloxacin + Metronidazole</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1 text-xs">Surgical Findings (If Operated)</label>
              <select
                value={surgicalFindings ?? ''}
                onChange={(e) => setSurgicalFindings((e.target.value as SurgicalFindings) || undefined)}
                className="w-full border rounded px-3 py-1.5 text-xs"
              >
                <option value="">Not Yet Operated</option>
                <option value="uncomplicated_suppurative">Uncomplicated Suppurative Appendicitis</option>
                <option value="gangrenous_intact">Gangrenous (Intact Wall)</option>
                <option value="perforated_localized_phlegmon">Perforated with Localized Phlegmon</option>
                <option value="perforated_generalized_peritonitis">Perforated with Generalized Peritonitis</option>
                <option value="normal_appendix">Normal Appendix (Negative Appy)</option>
              </select>
            </div>
          </div>

          {/* Section 5: Status & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-sm">Protocol Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full border rounded px-3 py-1.5 text-sm font-semibold"
              >
                <option value="triage_diagnostic_evaluation">Triage & Diagnostic Evaluation</option>
                <option value="operating_room_in_transit">In Transit to Operating Room</option>
                <option value="postoperative_recovery">Postoperative Inpatient Recovery</option>
                <option value="conservative_antibiotics_inpatient">Conservative Antibiotics Inpatient</option>
                <option value="resolved_discharged">Resolved & Discharged</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1 text-sm">Clinical Notes</label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Serial abdominal exam findings, pediatric surgical consult notes..."
                rows={2}
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-semibold shadow disabled:opacity-50"
            >
              {saving ? 'Saving...' : existingEpisode ? 'Update Record' : 'Save & Record PAS Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
