import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPediatricGbsEpisode,
  type PediatricGbsRecord,
  type PediatricGbsFlowsheetRecord,
} from '../api';
import { type PediatricGbsEvaluationResult } from '../pediatricGbsEngine';

export const PediatricGbsPrint: React.FC = () => {
  const { id, episodeId } = useParams<{ id?: string; episodeId?: string }>();
  const targetId = id || episodeId;
  const [data, setData] = useState<{
    episode: PediatricGbsRecord;
    evaluation: PediatricGbsEvaluationResult;
    flowsheet: PediatricGbsFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetId) return;
    getPediatricGbsEpisode(Number(targetId))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load pediatric GBS dossier:', err);
        setLoading(false);
      });
  }, [targetId]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating Pediatric GBS Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Pediatric GBS Record not found.</div>;
  }

  const { episode, evaluation, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0 print:max-w-none text-xs leading-normal">
      {/* Print Button */}
      <div className="flex justify-end mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-800"
        >
          Print Dossier 🖨
        </button>
      </div>

      {/* Hospital Header */}
      <div className="border-b-2 border-indigo-900 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-indigo-950 uppercase">
            Clinical Dossier: Pediatric Guillain-Barré Syndrome (GBS)
          </h1>
          <p className="text-xs text-slate-600">
            Brighton Collaboration Diagnostic Criteria • 20/30/40 Rule for Respiratory Mechanics • IVIG Dosing
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-indigo-900">{episode.episode_code}</div>
          <div className="text-[10px] text-slate-500">Generated: {new Date().toLocaleDateString()}</div>
        </div>
      </div>

      {/* Patient & Demographic Grid */}
      <div className="mb-4 bg-slate-50 border border-slate-200 rounded p-3 grid grid-cols-4 gap-2">
        <div>
          <span className="block text-[10px] uppercase font-bold text-slate-500">Pediatric Patient</span>
          <span className="font-semibold text-slate-900">{episode.patient_name || `ID #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-bold text-slate-500">Age &amp; Weight</span>
          <span className="font-semibold text-slate-900">
            {episode.age_years} yrs • {episode.weight_kg} kg
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-bold text-slate-500">Antecedent Infection</span>
          <span className="font-semibold text-slate-900 capitalize">{episode.antecedent_infection_type.replace(/_/g, ' ')}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-bold text-slate-500">Attending Neurologist</span>
          <span className="font-semibold text-slate-900">{episode.consultant_name || 'Pediatric Neurology Staff'}</span>
        </div>
      </div>

      {/* Brighton Diagnostic & Functional Score */}
      <div className="mb-4 border border-indigo-200 rounded p-3 bg-indigo-50/50 space-y-2">
        <div className="flex justify-between items-center border-b border-indigo-200 pb-1">
          <span className="font-bold text-indigo-950 uppercase">
            Functional Disability: {evaluation.hughesDisabilityLabel}
          </span>
          <span className="font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-indigo-200 text-indigo-900">
            {evaluation.urgencyTierLabel}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
          <div>
            <span className="text-slate-500 font-semibold">Brighton Level: </span>
            <span className="font-bold capitalize">{episode.brighton_criteria_level.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold">CSF Dissociation: </span>
            <span className="font-bold">
              Protein {episode.csf_protein_mg_dl} mg/dL • WBCs {episode.csf_wbc_count_per_ul}/µL
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold">IVIG Total Regimen: </span>
            <span className="font-bold text-indigo-800">{evaluation.ivigDoseGramsTotal} g total (2 g/kg)</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <span className="text-slate-500 font-semibold">20/30/40 Rule: </span>
            <span className={`font-bold ${evaluation.isImpendingRespiratoryFailure ? 'text-rose-700' : 'text-emerald-700'}`}>
              {evaluation.respiratoryFailureRuleLabel}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold">Corticosteroid Policy: </span>
            <span className="font-bold text-emerald-800">
              {episode.corticosteroids_avoided ? 'STRICTLY AVOIDED (Contraindicated)' : 'Warning: Steroids administered'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold">Dysautonomia Signs: </span>
            <span className="font-bold">{episode.dysautonomia_signs_present ? 'PRESENT (Telemetry Active)' : 'Absent'}</span>
          </div>
        </div>

        {evaluation.alerts.length > 0 && (
          <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 space-y-0.5">
            {evaluation.alerts.map((al, idx) => (
              <div key={idx} className="font-medium">⚠️ {al}</div>
            ))}
          </div>
        )}
      </div>

      {/* Immunotherapy & Respiratory Directives */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="border border-slate-200 rounded p-3">
          <h2 className="font-bold text-slate-800 uppercase text-[10px] mb-2 border-b pb-1">
            Immunotherapy &amp; IVIG Infusion Directives
          </h2>
          <ul className="space-y-1 text-[11px] text-slate-700 list-disc list-inside">
            {evaluation.immunotherapyDirectives.map((dir, idx) => (
              <li key={idx}>{dir}</li>
            ))}
          </ul>
        </div>

        <div className="border border-slate-200 rounded p-3">
          <h2 className="font-bold text-slate-800 uppercase text-[10px] mb-2 border-b pb-1">
            Respiratory PFT Surveillance &amp; Intubation Criteria
          </h2>
          <ul className="space-y-1 text-[11px] text-slate-700 list-disc list-inside">
            {evaluation.respiratoryMonitoringDirectives.map((crit, idx) => (
              <li key={idx}>{crit}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Autonomic Dysreflexia Directives */}
      <div className="mb-4 border border-slate-200 rounded p-3">
        <h2 className="font-bold text-slate-800 uppercase text-[10px] mb-2 border-b pb-1">
          Autonomic Dysreflexia &amp; Hemodynamic Telemetry Directives
        </h2>
        <ul className="grid grid-cols-2 gap-1 text-[11px] text-slate-700 list-disc list-inside">
          {evaluation.autonomicDysreflexiaDirectives.map((dir, idx) => (
            <li key={idx}>{dir}</li>
          ))}
        </ul>
      </div>

      {/* Flowsheet Log */}
      <div className="mb-6">
        <h2 className="font-bold text-slate-800 uppercase text-[10px] mb-2 border-b pb-1">
          Serial Respiratory Mechanics &amp; Neuromuscular Flowsheet
        </h2>
        {flowsheet.length === 0 ? (
          <p className="text-slate-400 italic">No flowsheet checkpoints recorded.</p>
        ) : (
          <table className="w-full text-left border border-slate-200">
            <thead className="bg-slate-100 text-[10px] uppercase font-semibold text-slate-600">
              <tr>
                <th className="p-1.5 border">Time / Day of Illness</th>
                <th className="p-1.5 border">VC &amp; Single Breath Count</th>
                <th className="p-1.5 border">Neck Flexion (MRC)</th>
                <th className="p-1.5 border">Hughes</th>
                <th className="p-1.5 border">HR &amp; BP</th>
                <th className="p-1.5 border">Cranial Palsy &amp; Retention</th>
                <th className="p-1.5 border">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[10px]">
              {flowsheet.map((entry) => (
                <tr key={entry.id}>
                  <td className="p-1.5 border font-semibold">
                    Day {entry.day_of_illness} ({entry.log_datetime.slice(0, 16).replace('T', ' ')})
                  </td>
                  <td className="p-1.5 border font-bold text-indigo-800">
                    {entry.vital_capacity_ml_kg} mL/kg (SBC: {entry.single_breath_count})
                  </td>
                  <td className="p-1.5 border">MRC {entry.neck_flexion_power_mrc}/5</td>
                  <td className="p-1.5 border font-bold">Hughes {entry.hughes_score_current}</td>
                  <td className="p-1.5 border">
                    {entry.heart_rate_bpm} bpm • {entry.systolic_bp}/{entry.diastolic_bp}
                  </td>
                  <td className="p-1.5 border">
                    {entry.cranial_nerve_palsy_facial_bulbar ? 'Cranial Palsy +' : 'CN intact'} / {entry.urinary_retention_catheterized ? 'Catheterized' : 'Normal'}
                  </td>
                  <td className="p-1.5 border">{entry.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Neurologist Sign-off */}
      <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <span className="block font-bold uppercase text-[9px] text-slate-500 mb-1">
            Attending Pediatric Neurologist / Consultant
          </span>
          <div className="h-8 border-b border-dashed border-slate-400"></div>
          <span className="block mt-1 font-semibold text-slate-700">Signature / Seal / Date</span>
        </div>
        <div>
          <span className="block font-bold uppercase text-[9px] text-slate-500 mb-1">
            PICU Attending Intensivist / Charge Nurse
          </span>
          <div className="h-8 border-b border-dashed border-slate-400"></div>
          <span className="block mt-1 font-semibold text-slate-700">Signature / Verification</span>
        </div>
      </div>
    </div>
  );
};
