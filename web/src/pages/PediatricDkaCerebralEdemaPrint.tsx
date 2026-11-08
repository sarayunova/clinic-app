import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPediatricDkaCerebralEdemaEpisode,
  type PediatricDkaCerebralEdemaRecord,
  type PediatricDkaCerebralEdemaFlowsheetRecord,
} from '../api';
import { type PediatricDkaCerebralEdemaEvaluationResult } from '../pediatricDkaCerebralEdemaEngine';

export const PediatricDkaCerebralEdemaPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: PediatricDkaCerebralEdemaRecord;
    evaluation: PediatricDkaCerebralEdemaEvaluationResult;
    flowsheet: PediatricDkaCerebralEdemaFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getPediatricDkaCerebralEdemaEpisode(Number(id))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheet || res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load DKA CE dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating DKA Cerebral Edema Clinical Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Pediatric DKA Cerebral Edema Episode not found.</div>;
  }

  const { episode, evaluation, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0 print:max-w-none text-xs leading-normal">
      {/* Print Trigger Button */}
      <div className="flex justify-end mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-800"
        >
          Print Dossier 🖨
        </button>
      </div>

      {/* Hospital Header */}
      <div className="border-b-2 border-rose-800 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-rose-900">
            Pediatric Intensive Care Unit (PICU) & Pediatric Endocrinology
          </h1>
          <p className="text-sm font-semibold text-slate-800">
            Pediatric DKA Cerebral Edema & Emergent Hyperosmolar Rescue Clinical Dossier
          </p>
          <p className="text-slate-500 text-[10px]">
            Reference: ISPAD 2022 Guidelines / Muir Diagnostic Criteria for DKA Cerebral Edema
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-bold text-rose-700">{episode.episode_code}</div>
          <div className="text-[10px] text-slate-500">
            Generated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Patient & Consultant Info */}
      <div className="bg-slate-50 border border-slate-200 rounded p-3 mb-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div>
          <span className="text-slate-500 block">Patient Name:</span>
          <span className="font-bold">{episode.patient_name || `Patient #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Age & Weight:</span>
          <span className="font-bold">{episode.age_years} years &middot; {episode.weight_kg} kg</span>
        </div>
        <div>
          <span className="text-slate-500 block">Detection Datetime:</span>
          <span className="font-bold">{new Date(episode.detection_datetime).toLocaleString()}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Attending Intensivist:</span>
          <span className="font-bold">{episode.consultant_name || 'PICU Consultant'}</span>
        </div>
      </div>

      {/* Diagnostic Category & Osmolar Rescue Box */}
      <div className={`p-4 rounded border mb-4 ${
        evaluation.muirCriteriaCategory === 'diagnostic_cerebral_edema'
          ? 'bg-rose-50 border-rose-300'
          : evaluation.muirCriteriaCategory === 'impending_warning_signs'
          ? 'bg-amber-50 border-amber-300'
          : 'bg-emerald-50 border-emerald-300'
      }`}>
        <div className="flex justify-between items-center mb-1">
          <div>
            <span className="font-black text-sm uppercase text-slate-900">{evaluation.muirCriteriaCategoryLabel}</span>
            <div className="text-xs font-semibold text-slate-700 mt-0.5">
              Muir Criteria: {evaluation.muirMajorCount} Major &middot; {evaluation.muirMinorCount} Minor &middot;
              Corrected Na+: {evaluation.serumSodiumCorrectedMeqL} mEq/L &middot; Effective Osm: {evaluation.effectiveSerumOsmolalityMosmKg} mOsm/kg
            </div>
          </div>
          <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
            evaluation.hyperosmolarRescueIndicated ? 'bg-rose-700 text-white' : 'bg-slate-200 text-slate-800'
          }`}>
            {evaluation.hyperosmolarRescueIndicated ? 'STAT HYPEROSMOLAR RESCUE' : 'CLINICAL SURVEILLANCE'}
          </span>
        </div>

        {evaluation.hyperosmolarRescueIndicated && (
          <div className="mt-3 p-2.5 bg-white/80 rounded border border-rose-200 text-xs">
            <strong>STAT Rescue Prescription:</strong>{' '}
            3% Hypertonic Saline {evaluation.hyperosmolarSaline3PctDoseMl} mL (5 mL/kg) IV over 10-15 min OR 20% Mannitol {evaluation.mannitol20PctDoseMl} mL (0.5 g/kg = 2.5 mL/kg) IV over 15-20 min.
          </div>
        )}

        {evaluation.alerts.length > 0 && (
          <div className="mt-2 space-y-1">
            {evaluation.alerts.map((alt, idx) => (
              <div key={idx} className="font-bold text-rose-900 flex items-center gap-1">
                <span>⚠️</span> {alt}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Muir Neurological Criteria & Labs Breakdown */}
      <div className="border border-slate-200 rounded p-3 mb-4">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2 border-b pb-1">
          Neurological Examination & Metabolic Acidosis Profile
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500 block">Glasgow Coma Scale:</span>
            <span className="font-black text-rose-700 text-sm">{episode.gcs_score} / 15</span>
          </div>
          <div>
            <span className="text-slate-500 block">Pupillary Reactivity:</span>
            <span className="font-bold capitalize">{episode.pupillary_abnormality.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Blood Glucose:</span>
            <span className="font-bold">{episode.blood_glucose_mg_dl} mg/dL</span>
          </div>
          <div>
            <span className="text-slate-500 block">Measured / Corrected Na+:</span>
            <span className="font-bold">{episode.serum_sodium_measured_meq_l} / {episode.serum_sodium_corrected_meq_l} mEq/L</span>
          </div>
          <div>
            <span className="text-slate-500 block">Effective Osmolality:</span>
            <span className="font-bold">{episode.effective_serum_osmolality_mosm_kg} mOsm/kg</span>
          </div>
          <div>
            <span className="text-slate-500 block">Blood pH / HCO3-:</span>
            <span className="font-bold">{episode.blood_ph} / {episode.serum_bicarbonate_meq_l} mEq/L</span>
          </div>
          <div>
            <span className="text-slate-500 block">Cushing Triad Bradycardia:</span>
            <span className="font-bold">{Boolean(episode.bradycardia_cushing_triad) ? 'Positive Sign (+)' : 'Absent'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">IV Fluid -30% Restriction:</span>
            <span className="font-bold text-emerald-700">{Boolean(episode.fluid_rate_reduced_by_30pct) ? 'Enforced' : 'No'}</span>
          </div>
        </div>
      </div>

      {/* Neuroprotective Protocol */}
      {evaluation.neuroprotectiveDirectives.length > 0 && (
        <div className="border border-blue-200 bg-blue-50/50 rounded p-3 mb-4">
          <h3 className="font-bold text-xs uppercase tracking-wider text-blue-900 mb-2">
            Standard PICU Cerebral Edema Neuroprotective Protocol
          </h3>
          <ul className="list-disc list-inside space-y-1 text-slate-800 text-xs">
            {evaluation.neuroprotectiveDirectives.map((dir, idx) => (
              <li key={idx}>{dir}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Flowsheet Log */}
      <div className="border border-slate-200 rounded p-3 mb-6">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2 border-b pb-1">
          PICU Serial Neurological & Osmolar Trajectory Checkpoints
        </h3>
        {flowsheet.length === 0 ? (
          <p className="text-slate-500 italic py-2">No flowsheet checkpoints logged.</p>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 font-semibold text-slate-600">
                <th className="p-1.5">Hours</th>
                <th className="p-1.5">GCS</th>
                <th className="p-1.5">Pupils</th>
                <th className="p-1.5">Glucose</th>
                <th className="p-1.5">Na+ (Meas/Corr)</th>
                <th className="p-1.5">Fluid Rate</th>
                <th className="p-1.5">Rescue Agent / Notes</th>
                <th className="p-1.5">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-800">
              {flowsheet.map((l) => (
                <tr key={l.id}>
                  <td className="p-1.5 whitespace-nowrap font-medium">+{l.hours_from_detection}h</td>
                  <td className="p-1.5 font-bold text-rose-700">{l.gcs_score}/15</td>
                  <td className="p-1.5">{l.pupil_size_and_reactivity}</td>
                  <td className="p-1.5">{l.blood_glucose_mg_dl}</td>
                  <td className="p-1.5 font-bold">{l.serum_sodium_measured_meq_l} / {l.serum_sodium_corrected_meq_l}</td>
                  <td className="p-1.5">{l.iv_fluid_rate_ml_hr} mL/h</td>
                  <td className="p-1.5 max-w-xs truncate">{l.hyperosmolar_agent_given || l.neurological_exam_notes || l.notes || '—'}</td>
                  <td className="p-1.5 text-slate-500 whitespace-nowrap">{l.logged_by_name || 'Staff'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Signature Section */}
      <div className="pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs">
        <div>
          <div className="border-b border-slate-400 w-48 h-8 mb-1"></div>
          <span className="font-semibold block text-slate-700">Attending Pediatric Intensivist (PICU)</span>
          <span className="text-slate-500">Date & Stamp: __________________</span>
        </div>
        <div className="text-right">
          <div className="border-b border-slate-400 w-48 h-8 mb-1 ml-auto"></div>
          <span className="font-semibold block text-slate-700">Consultant Pediatric Neurologist / Neurosurgeon</span>
          <span className="text-slate-500">Date & Stamp: __________________</span>
        </div>
      </div>
    </div>
  );
};
