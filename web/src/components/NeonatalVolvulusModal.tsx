import React, { useState, useEffect } from 'react';
import {
  createNeonatalVolvulusEpisode,
  type NeonatalVolvulusRecord,
} from '../api';
import {
  evaluateNeonatalVolvulus,
  type NeonatalVolvulusEvaluationResult,
} from '../neonatalVolvulusEngine';

interface Props {
  patientId: number;
  existingEpisode?: NeonatalVolvulusRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalVolvulusModal: React.FC<Props> = ({
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
  const [ageDays, setAgeDays] = useState<number>(existingEpisode?.age_days ?? 4);
  const [weightKg, setWeightKg] = useState<number>(existingEpisode?.weight_kg ?? 3.2);
  const [emesisColor, setEmesisColor] = useState<
    'bilious_dark_green' | 'bilious_light_green_yellow' | 'non_bilious_gastric'
  >(existingEpisode?.emesis_color ?? 'bilious_dark_green');
  const [abdominalDistension, setAbdominalDistension] = useState<
    'absent_scaphoid' | 'mild_epigastric' | 'marked_generalized'
  >(existingEpisode?.abdominal_distension ?? 'mild_epigastric');
  const [abdominalTenderness, setAbdominalTenderness] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.abdominal_tenderness) : true,
  );
  const [rectalBleedingMelena, setRectalBleedingMelena] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.rectal_bleeding_melena) : false,
  );
  const [peritonitisSigns, setPeritonitisSigns] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.peritonitis_signs) : false,
  );
  const [hemodynamicShock, setHemodynamicShock] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.hemodynamic_shock) : false,
  );
  const [serumLactateMmolL, setSerumLactateMmolL] = useState<number>(
    existingEpisode?.serum_lactate_mmol_l ?? 2.4,
  );
  const [bloodPh, setBloodPh] = useState<string>(
    existingEpisode?.blood_ph?.toString() ?? '7.32',
  );
  const [baseExcessMeqL, setBaseExcessMeqL] = useState<string>(
    existingEpisode?.base_excess_meq_l?.toString() ?? '-4.0',
  );
  const [plainRadiographFinding, setPlainRadiographFinding] = useState<
    'normal_gas_pattern' | 'gasless_abdomen' | 'double_bubble' | 'distended_stomach_scant_distal_gas' | 'pneumoperitoneum_free_air'
  >(existingEpisode?.plain_radiograph_finding ?? 'distended_stomach_scant_distal_gas');
  const [upperGiContrastDone, setUpperGiContrastDone] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.upper_gi_contrast_done) : true,
  );
  const [upperGiFinding, setUpperGiFinding] = useState<string>(
    existingEpisode?.upper_gi_finding ?? 'corkscrew_duodenum_positive',
  );
  const [dopplerUsWhirlpoolSign, setDopplerUsWhirlpoolSign] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.doppler_us_whirlpool_sign) : true,
  );
  const [dopplerSmaSmvInversion, setDopplerSmaSmvInversion] = useState<boolean>(
    existingEpisode ? Boolean(existingEpisode.doppler_sma_smv_inversion) : true,
  );
  const [status, setStatus] = useState<
    'emergent_surgical_consult' | 'in_operating_room_ladd' | 'post_op_bowel_recovery' | 'resolved_feeding_tolerated' | 'short_bowel_syndrome_care'
  >(existingEpisode?.status ?? 'emergent_surgical_consult');
  const [clinicalNotes, setClinicalNotes] = useState(existingEpisode?.clinical_notes || '');

  const [evaluation, setEvaluation] = useState<NeonatalVolvulusEvaluationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const res = evaluateNeonatalVolvulus({
      ageDays,
      weightKg,
      emesisColor,
      abdominalDistension,
      abdominalTenderness,
      rectalBleedingMelena,
      peritonitisSigns,
      hemodynamicShock,
      serumLactateMmolL,
      bloodPh: bloodPh ? parseFloat(bloodPh) : undefined,
      baseExcessMeqL: baseExcessMeqL ? parseFloat(baseExcessMeqL) : undefined,
      plainRadiographFinding,
      upperGiContrastDone,
      upperGiFinding: (upperGiFinding as any) || undefined,
      dopplerUsWhirlpoolSign,
      dopplerSmaSmvInversion,
    });
    setEvaluation(res);
  }, [
    ageDays,
    weightKg,
    emesisColor,
    abdominalDistension,
    abdominalTenderness,
    rectalBleedingMelena,
    peritonitisSigns,
    hemodynamicShock,
    serumLactateMmolL,
    bloodPh,
    baseExcessMeqL,
    plainRadiographFinding,
    upperGiContrastDone,
    upperGiFinding,
    dopplerUsWhirlpoolSign,
    dopplerSmaSmvInversion,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createNeonatalVolvulusEpisode({
        patientId,
        onsetDatetime,
        ageDays,
        weightKg,
        emesisColor,
        abdominalDistension,
        abdominalTenderness,
        rectalBleedingMelena,
        peritonitisSigns,
        hemodynamicShock,
        serumLactateMmolL,
        bloodPh: bloodPh ? parseFloat(bloodPh) : null,
        baseExcessMeqL: baseExcessMeqL ? parseFloat(baseExcessMeqL) : null,
        plainRadiographFinding,
        upperGiContrastDone,
        upperGiFinding: upperGiFinding || null,
        dopplerUsWhirlpoolSign,
        dopplerSmaSmvInversion,
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save neonatal volvulus episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="p-2 bg-red-100 text-red-700 rounded-lg text-lg">🌀</span>
              Neonatal Bilious Emesis & Malrotation with Midgut Volvulus Protocol
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              AAP Section on Surgery &middot; Emergent Ladd Procedure &middot; Mesenteric Bowel Viability
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-semibold leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Real-time Urgency Tier Banner */}
          {evaluation && (
            <div
              className={`p-4 rounded-xl border ${
                evaluation.urgencyTier === 'immediate_operating_room_crash'
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : evaluation.urgencyTier === 'emergent_imaging_workup'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-green-50 border-green-300 text-green-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-base">{evaluation.urgencyTierLabel}</div>
                <span
                  className={`px-3 py-1 text-xs font-bold rounded-full ${
                    evaluation.laddProcedureIndicated
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {evaluation.laddProcedureIndicated
                    ? 'LADD PROCEDURE INDICATED'
                    : 'OBSERVATION PROTOCOL'}
                </span>
              </div>
              <p className="text-xs mt-1.5 opacity-90">{evaluation.imagingRecommendation}</p>

              {evaluation.alerts.length > 0 && (
                <div className="mt-2 space-y-1">
                  {evaluation.alerts.map((alt, idx) => (
                    <div key={idx} className="text-xs font-semibold flex items-center gap-1.5 text-red-800">
                      <span>⚠️</span> {alt}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 1: Demographics & Onset */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              1. Demographics & Presentation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Onset Datetime</label>
                <input
                  type="datetime-local"
                  value={onsetDatetime}
                  onChange={(e) => setOnsetDatetime(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Age (Days)</label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={ageDays}
                  onChange={(e) => setAgeDays(parseInt(e.target.value) || 0)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.4"
                  max="15.0"
                  value={weightKg}
                  onChange={(e) => setWeightKg(parseFloat(e.target.value) || 3.0)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Clinical Signs & Emesis */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              2. Cardinal Signs & Bowel Perfusion
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Emesis Color <span className="text-red-500">*</span>
                </label>
                <select
                  value={emesisColor}
                  onChange={(e: any) => setEmesisColor(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm font-medium"
                >
                  <option value="bilious_dark_green">Bilious: Dark Spinach Green (Surgical Emergency)</option>
                  <option value="bilious_light_green_yellow">Bilious: Light Green/Golden Yellow</option>
                  <option value="non_bilious_gastric">Non-Bilious: Clear / Curdled Gastric</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Abdominal Distension</label>
                <select
                  value={abdominalDistension}
                  onChange={(e: any) => setAbdominalDistension(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                >
                  <option value="absent_scaphoid">Absent / Scaphoid (Common in Proximal Volvulus)</option>
                  <option value="mild_epigastric">Mild Epigastric Fullness</option>
                  <option value="marked_generalized">Marked Generalized Distension</option>
                </select>
              </div>

              <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <label className="flex items-center space-x-2 bg-white p-2.5 rounded border">
                  <input
                    type="checkbox"
                    checked={abdominalTenderness}
                    onChange={(e) => setAbdominalTenderness(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span className="text-xs font-medium text-gray-800">Abdominal Tenderness</span>
                </label>

                <label className="flex items-center space-x-2 bg-white p-2.5 rounded border">
                  <input
                    type="checkbox"
                    checked={rectalBleedingMelena}
                    onChange={(e) => setRectalBleedingMelena(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span className="text-xs font-medium text-gray-800">Melena / Hematochezia</span>
                </label>

                <label className="flex items-center space-x-2 bg-white p-2.5 rounded border">
                  <input
                    type="checkbox"
                    checked={peritonitisSigns}
                    onChange={(e) => setPeritonitisSigns(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span className="text-xs font-medium text-gray-800">Peritonitis / Guarding</span>
                </label>

                <label className="flex items-center space-x-2 bg-white p-2.5 rounded border">
                  <input
                    type="checkbox"
                    checked={hemodynamicShock}
                    onChange={(e) => setHemodynamicShock(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span className="text-xs font-medium text-gray-800">Hemodynamic Shock</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Laboratory & Metabolic Acidosis */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              3. Laboratory & Bowel Ischemia Markers
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Serum Lactate (mmol/L) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="30.0"
                  value={serumLactateMmolL}
                  onChange={(e) => setSerumLactateMmolL(parseFloat(e.target.value) || 1.0)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Blood pH</label>
                <input
                  type="number"
                  step="0.01"
                  min="6.5"
                  max="7.8"
                  value={bloodPh}
                  onChange={(e) => setBloodPh(e.target.value)}
                  placeholder="e.g. 7.30"
                  className="w-full border rounded px-3 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Base Excess (mEq/L)</label>
                <input
                  type="number"
                  step="0.5"
                  min="-35.0"
                  max="35.0"
                  value={baseExcessMeqL}
                  onChange={(e) => setBaseExcessMeqL(e.target.value)}
                  placeholder="e.g. -4.0"
                  className="w-full border rounded px-3 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Radiographic & Upper GI Fluoroscopy */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              4. Imaging Studies (Plain Film, UGI Series, Doppler US)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Plain Radiograph</label>
                <select
                  value={plainRadiographFinding}
                  onChange={(e: any) => setPlainRadiographFinding(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                >
                  <option value="distended_stomach_scant_distal_gas">Distended Stomach with Scant Distal Gas</option>
                  <option value="gasless_abdomen">Gasless Abdomen</option>
                  <option value="double_bubble">Double Bubble Appearance</option>
                  <option value="normal_gas_pattern">Normal Gas Pattern</option>
                  <option value="pneumoperitoneum_free_air">Pneumoperitoneum / Free Air (Laparotomy Stat)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Upper GI Contrast Series</label>
                <select
                  value={upperGiFinding}
                  onChange={(e) => setUpperGiFinding(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                >
                  <option value="corkscrew_duodenum_positive">Positive Corkscrew Duodenum Sign (Pathognomonic)</option>
                  <option value="ligament_of_treitz_right_sided">Ligament of Treitz Right of Spine</option>
                  <option value="duodenal_beaking_complete_obstruction">Duodenal Beaking / Complete Obstruction</option>
                  <option value="normal_c_loop_treitz_left">Normal C-loop & Treitz Left of Spine</option>
                  <option value="deferred_emergency_laparotomy">Deferred: Crash Laparotomy for Peritonitis/Shock</option>
                </select>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <label className="flex items-center space-x-2 bg-white p-2.5 rounded border">
                  <input
                    type="checkbox"
                    checked={dopplerUsWhirlpoolSign}
                    onChange={(e) => setDopplerUsWhirlpoolSign(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span className="text-xs font-medium text-gray-800">
                    Doppler US: Whirlpool Sign (Twisted Mesenteric Vessels)
                  </span>
                </label>

                <label className="flex items-center space-x-2 bg-white p-2.5 rounded border">
                  <input
                    type="checkbox"
                    checked={dopplerSmaSmvInversion}
                    onChange={(e) => setDopplerSmaSmvInversion(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span className="text-xs font-medium text-gray-800">
                    Doppler US: SMA / SMV Transposition / Inversion
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 5: Pre-operative Resuscitation Directives */}
          {evaluation && evaluation.resuscitationDirectives.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">
                Pre-Operative Ladd Resuscitation Protocol
              </h4>
              <ul className="text-xs text-blue-950 space-y-1 list-disc list-inside">
                {evaluation.resuscitationDirectives.map((dir, i) => (
                  <li key={i}>{dir}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Status & Clinical Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-gray-700 font-medium mb-1">Episode Status</label>
              <select
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm"
              >
                <option value="emergent_surgical_consult">Emergent Pediatric Surgical Consultation</option>
                <option value="in_operating_room_ladd">In Operating Room: Ladd Procedure</option>
                <option value="post_op_bowel_recovery">Post-Operative Bowel Recovery & TPN</option>
                <option value="resolved_feeding_tolerated">Resolved: Full Enteral Feeds Tolerated</option>
                <option value="short_bowel_syndrome_care">Short Bowel Syndrome Care</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1">Clinical Notes</label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={2}
                className="w-full border rounded px-3 py-1.5 text-sm"
                placeholder="Findings, pediatric surgical team alerted, operating room prep..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save & Initiate Volvulus Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
