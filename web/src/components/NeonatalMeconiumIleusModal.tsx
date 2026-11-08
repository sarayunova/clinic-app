import React, { useState, useEffect } from 'react';
import {
  createNeonatalMeconiumIleusEpisode,
  type NeonatalMeconiumIleusRecord,
} from '../api';
import {
  evaluateNeonatalMeconiumIleus,
  type NeonatalMeconiumIleusEvaluationResult,
} from '../neonatalMeconiumIleusEngine';

interface Props {
  patientId: number;
  existingEpisode?: NeonatalMeconiumIleusRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalMeconiumIleusModal: React.FC<Props> = ({
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
  const [ageHours, setAgeHours] = useState<number>(existingEpisode?.age_hours ?? 24);
  const [weightKg, setWeightKg] = useState<number>(existingEpisode?.weight_kg ?? 3.1);
  const [meconiumPassedYet, setMeconiumPassedYet] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.meconium_passed_yet) : false,
  );
  const [abdominalDistension, setAbdominalDistension] = useState<
    'absent' | 'mild' | 'marked_tense'
  >(existingEpisode?.abdominal_distension ?? 'marked_tense');
  const [emesisCharacter, setEmesisCharacter] = useState<
    'none' | 'gastric_clear' | 'bilious_green'
  >(existingEpisode?.emesis_character ?? 'bilious_green');
  const [palpableDoughyMasses, setPalpableDoughyMasses] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.palpable_doughy_masses) : true,
  );
  const [familyHistoryCysticFibrosis, setFamilyHistoryCysticFibrosis] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.family_history_cystic_fibrosis) : false,
  );
  const [plainAbdominalXrayFindings, setPlainAbdominalXrayFindings] = useState<
    'neuhauser_soap_bubble_sign' | 'dilated_loops_no_fluid_levels' | 'calcifications_meconium_peritonitis' | 'pneumoperitoneum_free_air' | 'non_specific_distension'
  >(existingEpisode?.plain_abdominal_xray_findings ?? 'neuhauser_soap_bubble_sign');
  const [contrastEnemaPerformed, setContrastEnemaPerformed] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.contrast_enema_performed) : true,
  );
  const [contrastEnemaType, setContrastEnemaType] = useState<
    'gastrografin_dilute' | 'omnipaque_water_soluble' | 'barium_contraindicated' | 'none'
  >(existingEpisode?.contrast_enema_type ?? 'gastrografin_dilute');
  const [microcolonConfirmed, setMicrocolonConfirmed] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.microcolon_confirmed) : true,
  );
  const [meconiumPelletsVisualized, setMeconiumPelletsVisualized] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.meconium_pellets_visualized) : true,
  );
  const [complicationPresent, setComplicationPresent] = useState<
    'uncomplicated_simple_ileus' | 'volvulus_gangrene' | 'atresia_segmental' | 'meconium_peritonitis_pseudocyst' | 'perforation_free_air'
  >(existingEpisode?.complication_present ?? 'uncomplicated_simple_ileus');
  const [enemaAttemptsCount, setEnemaAttemptsCount] = useState<number>(
    existingEpisode?.enema_attempts_count ?? 1,
  );
  const [enemaSuccessOutcome, setEnemaSuccessOutcome] = useState<
    'successful_evacuation_reflux_into_ileum' | 'partial_evacuation_repeat_indicated' | 'failed_refractory_obstruction' | 'procedure_aborted_perforation_risk' | 'not_attempted_surgery_first'
  >(existingEpisode?.enema_success_outcome ?? 'successful_evacuation_reflux_into_ileum');
  const [surgeryIndicated, setSurgeryIndicated] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.surgery_indicated) : false,
  );
  const [surgicalProcedurePlanned, setSurgicalProcedurePlanned] = useState<
    'none_medical_decompression' | 'bishop_koop_t_tube_enterostomy' | 'santulli_enterostomy' | 'resection_primary_anastomosis' | 'laparotomy_enterotomy_irrigation'
  >(existingEpisode?.surgical_procedure_planned ?? 'none_medical_decompression');
  const [cftrGeneMutationSent, setCftrGeneMutationSent] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.cftr_gene_mutation_sent) : true,
  );
  const [pancreaticEnzymeReplacementStarted, setPancreaticEnzymeReplacementStarted] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.pancreatic_enzyme_replacement_started) : false,
  );
  const [status, setStatus] = useState<
    'initial_contrast_decompression' | 'repeat_enema_observation' | 'in_operating_room_enterostomy' | 'post_op_stoma_recovery' | 'resolved_normal_stooling'
  >(existingEpisode?.status ?? 'initial_contrast_decompression');
  const [clinicalNotes, setClinicalNotes] = useState<string>(existingEpisode?.clinical_notes || '');

  const [evaluation, setEvaluation] = useState<NeonatalMeconiumIleusEvaluationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recalculate evaluation when clinical inputs change
  useEffect(() => {
    const res = evaluateNeonatalMeconiumIleus({
      ageHours,
      weightKg,
      meconiumPassedYet,
      abdominalDistension,
      emesisCharacter,
      palpableDoughyMasses,
      familyHistoryCysticFibrosis,
      plainAbdominalXrayFindings,
      contrastEnemaPerformed,
      contrastEnemaType,
      microcolonConfirmed,
      meconiumPelletsVisualized,
      complicationPresent,
      enemaAttemptsCount,
      enemaSuccessOutcome,
    });
    setEvaluation(res);
    setSurgeryIndicated(res.surgeryIndicated);
  }, [
    ageHours,
    weightKg,
    meconiumPassedYet,
    abdominalDistension,
    emesisCharacter,
    palpableDoughyMasses,
    familyHistoryCysticFibrosis,
    plainAbdominalXrayFindings,
    contrastEnemaPerformed,
    contrastEnemaType,
    microcolonConfirmed,
    meconiumPelletsVisualized,
    complicationPresent,
    enemaAttemptsCount,
    enemaSuccessOutcome,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createNeonatalMeconiumIleusEpisode({
        patientId,
        onsetDatetime,
        ageHours,
        weightKg,
        meconiumPassedYet,
        abdominalDistension,
        emesisCharacter,
        palpableDoughyMasses,
        familyHistoryCysticFibrosis,
        plainAbdominalXrayFindings,
        contrastEnemaPerformed,
        contrastEnemaType,
        microcolonConfirmed,
        meconiumPelletsVisualized,
        complicationPresent,
        enemaAttemptsCount,
        enemaSuccessOutcome,
        surgeryIndicated,
        surgicalProcedurePlanned,
        cftrGeneMutationSent,
        pancreaticEnzymeReplacementStarted,
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record Neonatal Meconium Ileus episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="bg-amber-600 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍼</span>
            <div>
              <h2 className="text-xl font-bold">
                {existingEpisode ? 'Edit Neonatal Meconium Ileus Protocol' : 'Neonatal Meconium Ileus & Cystic Fibrosis Protocol'}
              </h2>
              <p className="text-xs text-amber-100">
                AAP Surgical / CF Foundation: Dilute Gastrografin Decompression vs Bishop-Koop Enterostomy
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

          {/* Clinical Directives / Urgency Banner */}
          {evaluation && (
            <div className={`p-4 rounded-xl border ${
              evaluation.surgeryIndicated
                ? 'bg-red-50 border-red-300 dark:bg-red-950/40 dark:border-red-800 text-red-900 dark:text-red-100'
                : 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm tracking-wide uppercase flex items-center gap-2">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${evaluation.surgeryIndicated ? 'bg-red-600 animate-ping' : 'bg-emerald-600'}`}></span>
                  Urgency: {evaluation.urgencyTierLabel}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-white/70 dark:bg-slate-800/80 shadow-sm">
                  CF Suspected: {evaluation.isCysticFibrosisSuspected ? 'YES (High Index)' : 'Low'}
                </span>
              </div>
              <p className="text-sm font-medium">{evaluation.recommendedProcedure}</p>
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

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                Age (Hours of Life) *
              </label>
              <input
                type="number"
                min="0"
                max="720"
                value={ageHours}
                onChange={(e) => setAgeHours(parseInt(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Birth Weight (kg) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.4"
                max="15.0"
                value={weightKg}
                onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                required
              />
            </div>
          </div>

          {/* Section: Clinical Presentation */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              1. Clinical Signs & Meconium Passage
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Meconium Passed Yet?
                </label>
                <select
                  value={meconiumPassedYet ? 'yes' : 'no'}
                  onChange={(e) => setMeconiumPassedYet(e.target.value === 'yes')}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="no">No (Failed to pass in &gt;24-48h)</option>
                  <option value="yes">Yes (Meconium evacuating)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Abdominal Distension
                </label>
                <select
                  value={abdominalDistension}
                  onChange={(e) => setAbdominalDistension(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="marked_tense">Marked / Tense Distension</option>
                  <option value="mild">Mild Distension</option>
                  <option value="absent">Absent / Soft</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Emesis Character
                </label>
                <select
                  value={emesisCharacter}
                  onChange={(e) => setEmesisCharacter(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="bilious_green">Bilious (Dark green)</option>
                  <option value="gastric_clear">Gastric / Non-bilious</option>
                  <option value="none">None</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Palpable Doughy Lower Quadrant Masses
                </label>
                <select
                  value={palpableDoughyMasses ? 'yes' : 'no'}
                  onChange={(e) => setPalpableDoughyMasses(e.target.value === 'yes')}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="yes">Yes (Inspissated meconium in ileum)</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Family History of Cystic Fibrosis
                </label>
                <select
                  value={familyHistoryCysticFibrosis ? 'yes' : 'no'}
                  onChange={(e) => setFamilyHistoryCysticFibrosis(e.target.value === 'yes')}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="no">No / Unknown</option>
                  <option value="yes">Yes (Sibling or 1st degree relative CF)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Plain Abdominal X-ray Findings
                </label>
                <select
                  value={plainAbdominalXrayFindings}
                  onChange={(e) => setPlainAbdominalXrayFindings(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="neuhauser_soap_bubble_sign">Neuhauser Soap-Bubble Sign (RLQ)</option>
                  <option value="dilated_loops_no_fluid_levels">Dilated Loops (Scant Fluid Levels)</option>
                  <option value="calcifications_meconium_peritonitis">Intra-abdominal Calcifications</option>
                  <option value="pneumoperitoneum_free_air">Pneumoperitoneum (Free Air under Diaphragm)</option>
                  <option value="non_specific_distension">Non-specific Distension</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Diagnostic & Therapeutic Contrast Enema */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              2. Fluoroscopic Contrast Decompression & Complications
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contrast Enema Performed
                </label>
                <select
                  value={contrastEnemaPerformed ? 'yes' : 'no'}
                  onChange={(e) => setContrastEnemaPerformed(e.target.value === 'yes')}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contrast Enema Agent
                </label>
                <select
                  value={contrastEnemaType}
                  onChange={(e) => setContrastEnemaType(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="gastrografin_dilute">Dilute Gastrografin (1:3 or 1:4 with saline)</option>
                  <option value="omnipaque_water_soluble">Omnipaque (Water-soluble Iso-osmolar)</option>
                  <option value="barium_contraindicated">Barium (CONTRAINDICATED in Ileus)</option>
                  <option value="none">None</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Microcolon of Disuse Visualized
                </label>
                <select
                  value={microcolonConfirmed ? 'yes' : 'no'}
                  onChange={(e) => setMicrocolonConfirmed(e.target.value === 'yes')}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="yes">Yes (Slender disuse microcolon)</option>
                  <option value="no">No (Normal caliber colon)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Meconium Pellets Visualized in Colon
                </label>
                <select
                  value={meconiumPelletsVisualized ? 'yes' : 'no'}
                  onChange={(e) => setMeconiumPelletsVisualized(e.target.value === 'yes')}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="yes">Yes (Inspissated round pellets)</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Complications Identified
                </label>
                <select
                  value={complicationPresent}
                  onChange={(e) => setComplicationPresent(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="uncomplicated_simple_ileus">Uncomplicated Simple Ileus</option>
                  <option value="volvulus_gangrene">Volvulus with Gangrene</option>
                  <option value="atresia_segmental">Intestinal Atresia (Segmental)</option>
                  <option value="meconium_peritonitis_pseudocyst">Meconium Pseudocyst / Peritonitis</option>
                  <option value="perforation_free_air">Perforation / Pneumoperitoneum</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Enema Attempts Count
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={enemaAttemptsCount}
                  onChange={(e) => setEnemaAttemptsCount(parseInt(e.target.value) || 0)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Enema Decompression Outcome
                </label>
                <select
                  value={enemaSuccessOutcome}
                  onChange={(e) => setEnemaSuccessOutcome(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="successful_evacuation_reflux_into_ileum">Successful (Reflux into Dilated Ileum)</option>
                  <option value="partial_evacuation_repeat_indicated">Partial (Repeat enema in 6-12h)</option>
                  <option value="failed_refractory_obstruction">Failed Refractory (Surgical Clearance)</option>
                  <option value="procedure_aborted_perforation_risk">Aborted (Perforation Risk)</option>
                  <option value="not_attempted_surgery_first">Not Attempted (Direct Laparotomy)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Surgical Procedure Planned
                </label>
                <select
                  value={surgicalProcedurePlanned}
                  onChange={(e) => setSurgicalProcedurePlanned(e.target.value as any)}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="none_medical_decompression">None (Non-operative Gastrografin Decompression)</option>
                  <option value="bishop_koop_t_tube_enterostomy">Bishop-Koop Enterostomy (Distal Chimney)</option>
                  <option value="santulli_enterostomy">Santulli Enterostomy (Proximal Chimney)</option>
                  <option value="resection_primary_anastomosis">Resection & Primary Anastomosis</option>
                  <option value="laparotomy_enterotomy_irrigation">Enterotomy & Saline / Mucomyst Irrigation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  CFTR Gene Testing Sent
                </label>
                <select
                  value={cftrGeneMutationSent ? 'yes' : 'no'}
                  onChange={(e) => setCftrGeneMutationSent(e.target.value === 'yes')}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="yes">Yes (CFTR Comprehensive Panel Sent)</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pancreatic Enzyme Replacement
                </label>
                <select
                  value={pancreaticEnzymeReplacementStarted ? 'yes' : 'no'}
                  onChange={(e) => setPancreaticEnzymeReplacementStarted(e.target.value === 'yes')}
                  className="w-full text-sm border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="no">No / Pending Enteral Feeding</option>
                  <option value="yes">Yes (Started with initial enteral feeds)</option>
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
                  <option value="initial_contrast_decompression">Initial Contrast Decompression</option>
                  <option value="repeat_enema_observation">Repeat Enema Observation</option>
                  <option value="in_operating_room_enterostomy">In Operating Room (Enterostomy)</option>
                  <option value="post_op_stoma_recovery">Post-Op Stoma Recovery</option>
                  <option value="resolved_normal_stooling">Resolved / Normal Stooling</option>
                </select>
              </div>
            </div>
          </div>

          {/* Directives Preview */}
          {evaluation && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-800 pt-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                  Gastrografin Decompression Directives
                </h4>
                <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-1 list-disc pl-4">
                  {evaluation.gastrografinProtocolDirectives.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200 mb-1">
                  Cystic Fibrosis Management Directives
                </h4>
                <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-disc pl-4">
                  {evaluation.cysticFibrosisDirectives.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Clinical Notes & Operative/Fluoroscopy Details
            </label>
            <textarea
              rows={3}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Document fluoroscopy observation, reflux into dilated terminal ileum, volume of Gastrografin infused, post-procedure IV fluids..."
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
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 shadow-md"
            >
              {saving ? 'Saving...' : existingEpisode ? 'Update Episode' : 'Commit Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
