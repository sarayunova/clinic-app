import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getNeonatalHyperammonemiaEpisode,
  type NeonatalHyperammonemiaRecord,
  type NeonatalHyperammonemiaFlowsheetRecord,
} from '../api';
import { evaluateNeonatalHyperammonemia } from '../neonatalHyperammonemiaEngine';

export const NeonatalHyperammonemiaPrint: React.FC = () => {
  const { id, episodeId } = useParams<{ id?: string; episodeId?: string }>();
  const targetId = id || episodeId;

  const [episode, setEpisode] = useState<NeonatalHyperammonemiaRecord | null>(null);
  const [flowsheet, setFlowsheet] = useState<NeonatalHyperammonemiaFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await getNeonatalHyperammonemiaEpisode(Number(targetId));
        setEpisode(res.episode);
        setFlowsheet(res.flowsheet || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load neonatal hyperammonemia dossier');
      } finally {
        setLoading(false);
      }
    })();
  }, [targetId]);

  if (loading) return <div className="p-8 text-center text-sm">Loading clinical dossier...</div>;
  if (error || !episode) return <div className="p-8 text-center text-red-600 text-sm">{error || 'Episode not found'}</div>;

  const evaluation = evaluateNeonatalHyperammonemia({
    ageHours: episode.age_hours,
    birthWeightGrams: episode.birth_weight_grams,
    gestationalAgeWeeks: episode.gestational_age_weeks,
    plasmaAmmoniaUmolL: episode.plasma_ammonia_umol_l,
    bloodGasAcidBasePattern: episode.blood_gas_acid_base_pattern,
    plasmaLactateMmolL: episode.plasma_lactate_mmol_l,
    anionGapMeqL: episode.anion_gap_meq_l,
    urineKetonesPresent: Boolean(episode.urine_ketones_present),
    suspectedDisorderCategory: episode.suspected_disorder_category,
    proteinIntakeHalted: Boolean(episode.protein_intake_halted),
    highCalorieDextroseActive: Boolean(episode.high_calorie_dextrose_active),
    girMgKgMin: episode.gir_mg_kg_min,
    nitrogenScavengerAmmonulActive: Boolean(episode.nitrogen_scavenger_ammonul_active),
    ivLArginineActive: Boolean(episode.iv_l_arginine_active),
    ivLCarnitineActive: Boolean(episode.iv_l_carnitine_active),
    crrtDialysisIndicated: Boolean(episode.crrt_dialysis_indicated),
    crrtDialysisActive: Boolean(episode.crrt_dialysis_active),
  });

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 text-black bg-white print:p-0">
      <div className="border-b-2 border-black pb-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider">
            Neonatal IEM Hyperammonemic Crisis Clinical Dossier
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Clinical Reference: ACMG / SIMD / BIMDG Inborn Errors Protocol
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold">{episode.episode_code}</div>
          <div className="text-xs text-gray-500">{new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Patient & Onset Info */}
      <div className="grid grid-cols-4 gap-4 p-4 border rounded text-xs bg-gray-50">
        <div>
          <span className="text-gray-500 block">Patient Name:</span>
          <span className="font-bold text-sm">{episode.patient_name || `Patient #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Age / Birth Weight:</span>
          <span className="font-bold">{episode.age_hours}h • {episode.birth_weight_grams}g ({episode.gestational_age_weeks}w)</span>
        </div>
        <div>
          <span className="text-gray-500 block">Onset:</span>
          <span className="font-bold">{episode.onset_datetime.replace('T', ' ')}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Consultant:</span>
          <span className="font-bold">{episode.consultant_name || `Dr. ID #${episode.consultant_id}`}</span>
        </div>
      </div>

      {/* Stratification Banner */}
      <div className="p-4 border rounded text-xs space-y-2">
        <div className="flex justify-between items-center border-b pb-2">
          <span className="font-bold text-sm uppercase">{evaluation.urgencyTierLabel}</span>
          <span className="font-bold px-2 py-0.5 rounded bg-gray-200">
            {evaluation.ammoniaCrisisLabel}
          </span>
        </div>
        {evaluation.alerts.length > 0 && (
          <div className="space-y-1 pt-1">
            {evaluation.alerts.map((al, idx) => (
              <div key={idx} className="font-semibold text-red-700">⚠️ {al}</div>
            ))}
          </div>
        )}
      </div>

      {/* Laboratory Parameters */}
      <div className="border rounded p-4 text-xs space-y-3">
        <h3 className="font-bold uppercase tracking-wider border-b pb-1">Metabolic & Acid-Base Parameters</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-gray-500 block">Plasma Ammonia:</span>
            <span className="font-bold text-base text-purple-900">{episode.plasma_ammonia_umol_l} umol/L</span>
          </div>
          <div>
            <span className="text-gray-500 block">Blood Gas Pattern:</span>
            <span className="font-bold text-base">{episode.blood_gas_acid_base_pattern.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Lactate / Anion Gap:</span>
            <span className="font-bold">{episode.plasma_lactate_mmol_l} mmol/L • AG {episode.anion_gap_meq_l}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Urine Ketones:</span>
            <span className="font-bold">{episode.urine_ketones_present ? 'Ketonuria Present (OA suspected)' : 'Absent (UCD suspected)'}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Suspected Category:</span>
            <span className="font-bold">{episode.suspected_disorder_category.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-gray-500 block">GIR Infusion Rate:</span>
            <span className="font-bold">{episode.gir_mg_kg_min} mg/kg/min</span>
          </div>
        </div>
      </div>

      {/* Directives */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="border rounded p-3 space-y-2">
          <h3 className="font-bold uppercase tracking-wider border-b pb-1">Caloric Suppression & Scavengers</h3>
          <ul className="space-y-1 list-disc list-inside">
            {evaluation.caloricSuppressionDirectives.concat(evaluation.nitrogenScavengerDirectives).map((d, idx) => (
              <li key={idx}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="border rounded p-3 space-y-2">
          <h3 className="font-bold uppercase tracking-wider border-b pb-1">CRRT Dialysis & Genetics Guidance</h3>
          <ul className="space-y-1 list-disc list-inside">
            {evaluation.dialysisDirectives.concat(evaluation.diagnosticDifferentiationNotes).map((d, idx) => (
              <li key={idx}>{d}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Flowsheet Table */}
      <div className="border rounded p-4 text-xs space-y-2">
        <h3 className="font-bold uppercase tracking-wider border-b pb-1">
          Serial Flowsheet Checkpoints ({flowsheet.length})
        </h3>
        {flowsheet.length === 0 ? (
          <p className="text-gray-500 py-2">No serial flowsheet entries recorded.</p>
        ) : (
          <table className="w-full text-left">
            <thead className="border-b font-semibold text-gray-600">
              <tr>
                <th className="py-1">Time</th>
                <th className="py-1">Hrs</th>
                <th className="py-1">Ammonia</th>
                <th className="py-1">pH/pCO2</th>
                <th className="py-1">HCO3</th>
                <th className="py-1">Glucose</th>
                <th className="py-1">Encephalopathy</th>
                <th className="py-1">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {flowsheet.map((f) => (
                <tr key={f.id}>
                  <td className="py-1">{f.log_datetime.replace('T', ' ')}</td>
                  <td className="py-1">{f.hours_from_crisis_onset}h</td>
                  <td className="py-1 font-bold text-purple-900">{f.plasma_ammonia_umol_l} umol/L</td>
                  <td className="py-1">{f.ph_value} / {f.pco2_mmhg}</td>
                  <td className="py-1">{f.bicarbonate_meq_l} mEq/L</td>
                  <td className="py-1">{f.glucose_mg_dl} mg/dL</td>
                  <td className="py-1">{f.encephalopathy_grade.replace(/_/g, ' ')}</td>
                  <td className="py-1 text-gray-600">{f.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Signature Box */}
      <div className="pt-8 grid grid-cols-2 gap-8 text-xs border-t">
        <div>
          <p className="font-bold">Attending Neonatologist / Biochemical Geneticist:</p>
          <div className="h-12 border-b border-gray-400 mt-2"></div>
          <p className="text-gray-500 mt-1">Signature & Medical Registration Number</p>
        </div>
        <div className="text-right">
          <p className="font-bold">NICU Clinical Nurse Specialist:</p>
          <div className="h-12 border-b border-gray-400 mt-2"></div>
          <p className="text-gray-500 mt-1">Signature & Date/Time</p>
        </div>
      </div>
    </div>
  );
};
