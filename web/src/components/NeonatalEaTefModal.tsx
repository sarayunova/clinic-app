import React, { useState, useEffect } from 'react';
import {
  createNeonatalEaTefEpisode,
  updateNeonatalEaTefEpisode,
  type NeonatalEaTefRecord,
} from '../api';
import {
  evaluateNeonatalEaTef,
  type NeonatalEaTefEvaluationResult,
  type GrossClassificationType,
  type AbdominalGasPattern,
  type GapLengthClassification,
  type SurgicalProcedurePlanned,
} from '../neonatalEaTefEngine';

interface Props {
  patientId: number;
  existingEpisode?: NeonatalEaTefRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalEaTefModal: React.FC<Props> = ({
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
  const [ageHours, setAgeHours] = useState<number>(existingEpisode?.age_hours ?? 12);
  const [weightKg, setWeightKg] = useState<number>(existingEpisode?.weight_kg ?? 3.0);
  const [frothyOralSecretions, setFrothyOralSecretions] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.frothy_oral_secretions) : true
  );
  const [chokingCyanosisWithFeed, setChokingCyanosisWithFeed] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.choking_cyanosis_with_feed) : true
  );
  const [ogTubeCoilingDistanceCm, setOgTubeCoilingDistanceCm] = useState<number>(
    existingEpisode?.og_tube_coiling_distance_cm ?? 10.0
  );
  const [grossClassificationType, setGrossClassificationType] = useState<GrossClassificationType>(
    existingEpisode?.gross_classification_type ?? 'type_c_ea_with_distal_tef'
  );
  const [abdominalGasPattern, setAbdominalGasPattern] = useState<AbdominalGasPattern>(
    existingEpisode?.abdominal_gas_pattern ?? 'aerated_gastrointestinal_tract'
  );
  const [replogleTubeInSitu, setReplogleTubeInSitu] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.replogle_tube_in_situ) : true
  );
  const [replogleSuctionPressureMmHg, setReplogleSuctionPressureMmHg] = useState<number>(
    existingEpisode?.replogle_suction_pressure_mmhg ?? 25
  );
  const [gapLengthClassification, setGapLengthClassification] = useState<GapLengthClassification>(
    existingEpisode?.gap_length_classification ?? 'short_gap_primary_anastomosis'
  );
  const [vacterlVertebralAnomaly, setVacterlVertebralAnomaly] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.vacterl_vertebral_anomaly) : false
  );
  const [vacterlAnorectalMalformation, setVacterlAnorectalMalformation] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.vacterl_anorectal_malformation) : false
  );
  const [vacterlCardiacAnomaly, setVacterlCardiacAnomaly] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.vacterl_cardiac_anomaly) : false
  );
  const [vacterlRightAorticArch, setVacterlRightAorticArch] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.vacterl_right_aortic_arch) : false
  );
  const [vacterlRenalUltrasoundAbnormal, setVacterlRenalUltrasoundAbnormal] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.vacterl_renal_ultrasound_abnormal) : false
  );
  const [vacterlLimbRadialAnomaly, setVacterlLimbRadialAnomaly] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.vacterl_limb_radial_anomaly) : false
  );
  const [headOfBedElevated30deg, setHeadOfBedElevated30deg] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.head_of_bed_elevated_30deg) : true
  );
  const [surgicalProcedurePlanned, setSurgicalProcedurePlanned] = useState<SurgicalProcedurePlanned>(
    existingEpisode?.surgical_procedure_planned ?? 'primary_extrapleural_repair_fistula_ligation'
  );
  const [status, setStatus] = useState<NeonatalEaTefRecord['status']>(
    existingEpisode?.status ?? 'preop_replogle_sump_decompression'
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(existingEpisode?.clinical_notes || '');

  const [evaluation, setEvaluation] = useState<NeonatalEaTefEvaluationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const res = evaluateNeonatalEaTef({
      ageHours,
      weightKg,
      frothyOralSecretions,
      chokingCyanosisWithFeed,
      ogTubeCoilingDistanceCm,
      grossClassificationType,
      abdominalGasPattern,
      replogleTubeInSitu,
      replogleSuctionPressureMmHg,
      gapLengthClassification,
      vacterlVertebralAnomaly,
      vacterlAnorectalMalformation,
      vacterlCardiacAnomaly,
      vacterlRightAorticArch,
      vacterlRenalUltrasoundAbnormal,
      vacterlLimbRadialAnomaly,
      headOfBedElevated30deg,
      surgicalProcedurePlanned,
    });
    setEvaluation(res);
  }, [
    ageHours,
    weightKg,
    frothyOralSecretions,
    chokingCyanosisWithFeed,
    ogTubeCoilingDistanceCm,
    grossClassificationType,
    abdominalGasPattern,
    replogleTubeInSitu,
    replogleSuctionPressureMmHg,
    gapLengthClassification,
    vacterlVertebralAnomaly,
    vacterlAnorectalMalformation,
    vacterlCardiacAnomaly,
    vacterlRightAorticArch,
    vacterlRenalUltrasoundAbnormal,
    vacterlLimbRadialAnomaly,
    headOfBedElevated30deg,
    surgicalProcedurePlanned,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      patientId,
      onsetDatetime,
      ageHours: Number(ageHours),
      weightKg: Number(weightKg),
      frothyOralSecretions,
      chokingCyanosisWithFeed,
      ogTubeCoilingDistanceCm: Number(ogTubeCoilingDistanceCm),
      grossClassificationType,
      abdominalGasPattern,
      replogleTubeInSitu,
      replogleSuctionPressureMmHg: Number(replogleSuctionPressureMmHg),
      gapLengthClassification,
      vacterlVertebralAnomaly,
      vacterlAnorectalMalformation,
      vacterlCardiacAnomaly,
      vacterlRightAorticArch,
      vacterlRenalUltrasoundAbnormal,
      vacterlLimbRadialAnomaly,
      headOfBedElevated30deg,
      surgicalProcedurePlanned,
      status,
      clinicalNotes: clinicalNotes || undefined,
    };

    try {
      if (existingEpisode) {
        await updateNeonatalEaTefEpisode(existingEpisode.id, payload);
      } else {
        await createNeonatalEaTefEpisode(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save neonatal EA/TEF episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-cyan-700 text-white rounded-t-lg">
          <div>
            <h2 className="text-xl font-bold">
              {existingEpisode ? 'Edit' : 'New'} Neonatal EA/TEF & Replogle Sump Suction Protocol
            </h2>
            <p className="text-xs text-cyan-100">
              Gross Types A-E • VACTERL Association • Replogle Continuous Sump Decompression
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl font-bold leading-none"
          >
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
                evaluation.urgencyTier === 'emergency_surgical_repair'
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : evaluation.urgencyTier === 'staged_long_gap_management'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-blue-50 border-blue-300 text-blue-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-base">{evaluation.urgencyTierLabel}</span>
                <span className="px-2.5 py-1 text-xs rounded-full font-semibold uppercase bg-white border">
                  {evaluation.grossTypeDescription.split(':')[0]}
                </span>
              </div>
              <p className="text-sm mt-1">{evaluation.grossTypeDescription}</p>
              <div className="mt-2 text-xs font-semibold">
                Lateralization:{' '}
                <span className={evaluation.surgicalThoracotomySide === 'left_thoracotomy_right_arch' ? 'text-red-700 font-bold' : ''}>
                  {evaluation.surgicalThoracotomySideLabel}
                </span>
              </div>

              {evaluation.alerts.length > 0 && (
                <div className="mt-2 space-y-1">
                  {evaluation.alerts.map((al, idx) => (
                    <div key={idx} className="text-xs font-medium text-red-700 flex items-start gap-1">
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">Age (Hours)</label>
              <input
                type="number"
                value={ageHours}
                onChange={(e) => setAgeHours(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="0"
                max="720"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.01"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="0.4"
                max="15.0"
                required
              />
            </div>
          </div>

          {/* Clinical signs & tube coiling */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">OG Tube Coiling Distance (cm)</label>
              <input
                type="number"
                step="0.5"
                value={ogTubeCoilingDistanceCm}
                onChange={(e) => setOgTubeCoilingDistanceCm(Number(e.target.value))}
                className="w-full border rounded px-3 py-1.5 text-sm"
                min="5"
                max="25"
                required
              />
              <span className="text-[11px] text-gray-500">Arrest at 9-11 cm diagnostic of blind pouch</span>
            </div>
            <div className="flex flex-col justify-center space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={frothyOralSecretions}
                  onChange={(e) => setFrothyOralSecretions(e.target.checked)}
                  className="rounded text-cyan-600"
                />
                Frothy Excessive Oral Secretions
              </label>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={chokingCyanosisWithFeed}
                  onChange={(e) => setChokingCyanosisWithFeed(e.target.checked)}
                  className="rounded text-cyan-600"
                />
                Choking / Cyanosis / Coughing with Feeds
              </label>
            </div>
            <div className="flex flex-col justify-center space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={headOfBedElevated30deg}
                  onChange={(e) => setHeadOfBedElevated30deg(e.target.checked)}
                  className="rounded text-cyan-600"
                />
                Reverse Trendelenburg (Head Up 30-45°)
              </label>
            </div>
          </div>

          {/* Gross Classification & Gap length */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Gross Classification</label>
              <select
                value={grossClassificationType}
                onChange={(e) => setGrossClassificationType(e.target.value as GrossClassificationType)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white"
              >
                <option value="type_c_ea_with_distal_tef">Type C: EA with Distal TEF (85% - Classic)</option>
                <option value="type_a_isolated_ea_no_fistula">Type A: Pure EA without Fistula (8% - Gasless)</option>
                <option value="type_e_isolated_h_type_tef">Type E: Isolated H-type / N-type TEF (4%)</option>
                <option value="type_b_ea_with_proximal_tef">Type B: EA with Proximal TEF (&lt;1%)</option>
                <option value="type_d_ea_with_both_fistulas">Type D: EA with Proximal & Distal TEF (&lt;1%)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Abdominal Gas Pattern (X-Ray)</label>
              <select
                value={abdominalGasPattern}
                onChange={(e) => setAbdominalGasPattern(e.target.value as AbdominalGasPattern)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white"
              >
                <option value="aerated_gastrointestinal_tract">Aerated Bowel (Confirms Distal TEF)</option>
                <option value="gasless_abdomen_no_distal_fistula">Gasless Abdomen (Isolated EA or Proximal TEF)</option>
                <option value="massive_gastric_distension">Massive Gastric Distension (Critical Barotrauma)</option>
              </select>
            </div>
          </div>

          {/* Replogle Sump Suction Protocol */}
          <div className="p-4 rounded-lg bg-cyan-50 border border-cyan-200 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-900">
              Replogle Double-Lumen Sump Protocol
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={replogleTubeInSitu}
                  onChange={(e) => setReplogleTubeInSitu(e.target.checked)}
                  className="rounded text-cyan-600"
                />
                Replogle 8 Fr / 10 Fr Tube in Blind Pouch
              </label>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Continuous Suction (mmHg)</label>
                <input
                  type="number"
                  value={replogleSuctionPressureMmHg}
                  onChange={(e) => setReplogleSuctionPressureMmHg(Number(e.target.value))}
                  className="w-full border rounded px-3 py-1.5 text-sm bg-white"
                  min="10"
                  max="80"
                />
                <span className="text-[11px] text-gray-500">Target 20 - 30 mmHg continuous low suction</span>
              </div>
            </div>
          </div>

          {/* VACTERL Workup & Arch Laterality */}
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                VACTERL Association Workup
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white border text-amber-900">
                Score: {evaluation?.vacterlFeatureCount ?? 1} / 6
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={vacterlVertebralAnomaly}
                  onChange={(e) => setVacterlVertebralAnomaly(e.target.checked)}
                  className="rounded text-amber-600"
                />
                Vertebral Anomaly
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={vacterlAnorectalMalformation}
                  onChange={(e) => setVacterlAnorectalMalformation(e.target.checked)}
                  className="rounded text-amber-600"
                />
                Anorectal Malformation
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={vacterlCardiacAnomaly}
                  onChange={(e) => setVacterlCardiacAnomaly(e.target.checked)}
                  className="rounded text-amber-600"
                />
                Cardiac Anomaly (Echo)
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer text-red-800 font-semibold">
                <input
                  type="checkbox"
                  checked={vacterlRightAorticArch}
                  onChange={(e) => setVacterlRightAorticArch(e.target.checked)}
                  className="rounded text-red-600"
                />
                Right Aortic Arch (Echo)
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={vacterlRenalUltrasoundAbnormal}
                  onChange={(e) => setVacterlRenalUltrasoundAbnormal(e.target.checked)}
                  className="rounded text-amber-600"
                />
                Renal / US Abnormality
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={vacterlLimbRadialAnomaly}
                  onChange={(e) => setVacterlLimbRadialAnomaly(e.target.checked)}
                  className="rounded text-amber-600"
                />
                Limb / Radial Defect
              </label>
            </div>
          </div>

          {/* Surgical Strategy & Gap */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Gap Length Classification</label>
              <select
                value={gapLengthClassification}
                onChange={(e) => setGapLengthClassification(e.target.value as GapLengthClassification)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white"
              >
                <option value="short_gap_primary_anastomosis">Short Gap (&lt; 1-2 cm / 1 vertebra)</option>
                <option value="intermediate_gap_1_to_3_cm">Intermediate Gap (1 - 3 cm)</option>
                <option value="long_gap_greater_3_cm_or_vertebrae">Long Gap (&gt; 3 cm / 2-3 vertebrae)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Planned Surgical Procedure</label>
              <select
                value={surgicalProcedurePlanned}
                onChange={(e) => setSurgicalProcedurePlanned(e.target.value as SurgicalProcedurePlanned)}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white"
              >
                <option value="primary_extrapleural_repair_fistula_ligation">Right Extrapleural Repair & Ligation</option>
                <option value="thoracoscopic_repair_fistula_ligation">Thoracoscopic Repair & Ligation</option>
                <option value="staged_gastrostomy_delayed_anastomosis">Staged Gastrostomy & Delayed Anastomosis</option>
                <option value="cervical_esophagostomy">Cervical Esophagostomy (Salivary Fistula)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Clinical Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as NeonatalEaTefRecord['status'])}
                className="w-full border rounded px-3 py-1.5 text-sm bg-white font-medium"
              >
                <option value="preop_replogle_sump_decompression">Pre-op Replogle Sump Suction</option>
                <option value="in_operating_room_thoracotomy">In Operating Room (Repair)</option>
                <option value="postop_transanastomotic_tube_recovery">Post-op Transanastomotic Tube Recovery</option>
                <option value="esophagram_contrast_clearance">Esophagram Contrast Clearance</option>
                <option value="resolved_full_oral_feeding">Resolved / Full Oral Feeding</option>
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
              placeholder="Echocardiogram aortic arch findings, Replogle flush frequency, surgeon notes..."
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
              className="px-5 py-2 bg-cyan-700 text-white rounded text-sm font-semibold hover:bg-cyan-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : existingEpisode ? 'Update Protocol' : 'Save Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
