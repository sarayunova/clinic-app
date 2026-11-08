import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getNeonatalSipEpisode,
  type NeonatalSipRecord,
  type NeonatalSipFlowsheetRecord,
} from '../api';
import { type NeonatalSipEvaluationResult } from '../neonatalSipEngine';

export const NeonatalSipPrint: React.FC = () => {
  const { id, episodeId } = useParams<{ id?: string; episodeId?: string }>();
  const targetId = id || episodeId;
  const [data, setData] = useState<{
    episode: NeonatalSipRecord;
    evaluation: NeonatalSipEvaluationResult;
    flowsheet: NeonatalSipFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetId) return;
    getNeonatalSipEpisode(Number(targetId))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load neonatal SIP dossier:', err);
        setLoading(false);
      });
  }, [targetId]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating Neonatal SIP Protocol Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Neonatal SIP Record not found.</div>;
  }

  const { episode, evaluation, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0 print:max-w-none text-xs leading-normal">
      {/* Print Button */}
      <div className="flex justify-end mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-800"
        >
          Print Dossier 🖨
        </button>
      </div>

      {/* Hospital Header */}
      <div className="border-b-2 border-amber-900 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-amber-950 uppercase">
            NICU Clinical Dossier: Neonatal Spontaneous Intestinal Perforation (SIP)
          </h1>
          <p className="text-xs text-slate-600">
            AAP Section on Surgery / APSA / VON Consensus Guidelines • Primary Peritoneal Drainage (PPD)
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-amber-900">{episode.episode_code}</div>
          <div className="text-[10px] text-slate-500">Generated: {new Date().toLocaleDateString()}</div>
        </div>
      </div>

      {/* Patient & Episode Demographics */}
      <div className="mb-4 bg-slate-50 border border-slate-200 rounded p-3 grid grid-cols-4 gap-2">
        <div>
          <span className="block text-[10px] uppercase font-bold text-slate-500">Infant Patient</span>
          <span className="font-semibold text-slate-900">{episode.patient_name || `ID #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-bold text-slate-500">Postnatal Age &amp; Weight</span>
          <span className="font-semibold text-slate-900">
            Day {episode.age_days} • {episode.birth_weight_grams} g
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-bold text-slate-500">Gestational Age</span>
          <span className="font-semibold text-slate-900">{episode.gestational_age_weeks} weeks</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-bold text-slate-500">Attending Consultant</span>
          <span className="font-semibold text-slate-900">{episode.consultant_name || 'NICU Surgical Staff'}</span>
        </div>
      </div>

      {/* Diagnostic Evaluation & Risk Profile */}
      <div className="mb-4 border border-amber-200 rounded p-3 bg-amber-50/50 space-y-2">
        <div className="flex justify-between items-center border-b border-amber-200 pb-1">
          <span className="font-bold text-amber-950 uppercase">
            Diagnostic Stratification: {evaluation.sipConfidenceLabel}
          </span>
          <span className="font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-900">
            {evaluation.urgencyTierLabel}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
          <div>
            <span className="text-slate-500 font-semibold">Pneumoperitoneum: </span>
            <span className="font-bold">{episode.pneumoperitoneum_confirmed ? 'Present (Confirmed)' : 'Absent'}</span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold">Pneumatosis Intestinalis: </span>
            <span className="font-bold">{episode.pneumatosis_intestinalis_absent ? 'ABSENT (Supports SIP)' : 'Present'}</span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold">Portal Venous Gas: </span>
            <span className="font-bold">{episode.portal_venous_gas_absent ? 'ABSENT (Supports SIP)' : 'Present'}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <span className="text-slate-500 font-semibold">Medication Synergy Risk: </span>
            <span className="font-bold text-rose-700">
              {episode.antenatal_or_early_steroids_exposed && episode.indomethacin_or_ibuprofen_pda_exposed
                ? 'POSITIVE (Steroid + NSAID Synergy)'
                : 'Negative'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold">Bluish Abdominal Sign: </span>
            <span className="font-bold">{episode.abdominal_wall_bluish_discoloration ? 'Present' : 'Absent'}</span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold">Candida Peritoneal Fluid: </span>
            <span className="font-bold text-rose-700">
              {episode.peritoneal_fluid_yeast_candida_positive ? 'POSITIVE (Antifungal Mandatory)' : 'Negative / Pending'}
            </span>
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

      {/* Operative Strategy & Directives */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="border border-slate-200 rounded p-3">
          <h2 className="font-bold text-slate-800 uppercase text-[10px] mb-2 border-b pb-1">
            Bedside Primary Peritoneal Drainage Technique
          </h2>
          <ul className="space-y-1 text-[11px] text-slate-700 list-disc list-inside">
            {evaluation.drainageTechniqueDirectives.map((dir, idx) => (
              <li key={idx}>{dir}</li>
            ))}
          </ul>
        </div>

        <div className="border border-slate-200 rounded p-3">
          <h2 className="font-bold text-slate-800 uppercase text-[10px] mb-2 border-b pb-1">
            Conversion Criteria to Exploratory Laparotomy
          </h2>
          <ul className="space-y-1 text-[11px] text-slate-700 list-disc list-inside">
            {evaluation.laparotomyConversionCriteria.map((crit, idx) => (
              <li key={idx}>{crit}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Antimicrobial Directives */}
      <div className="mb-4 border border-slate-200 rounded p-3">
        <h2 className="font-bold text-slate-800 uppercase text-[10px] mb-2 border-b pb-1">
          Antimicrobial &amp; Antifungal Coverage Protocols
        </h2>
        <ul className="grid grid-cols-2 gap-1 text-[11px] text-slate-700 list-disc list-inside">
          {evaluation.antimicrobialDirectives.map((dir, idx) => (
            <li key={idx}>{dir}</li>
          ))}
        </ul>
      </div>

      {/* Flowsheet Log */}
      <div className="mb-6">
        <h2 className="font-bold text-slate-800 uppercase text-[10px] mb-2 border-b pb-1">
          Serial Peritoneal Drain Output &amp; Sepsis Flowsheet
        </h2>
        {flowsheet.length === 0 ? (
          <p className="text-slate-400 italic">No flowsheet checkpoints recorded.</p>
        ) : (
          <table className="w-full text-left border border-slate-200">
            <thead className="bg-slate-100 text-[10px] uppercase font-semibold text-slate-600">
              <tr>
                <th className="p-1.5 border">Time / Hours Post-Op</th>
                <th className="p-1.5 border">Drain Output (24h)</th>
                <th className="p-1.5 border">Character</th>
                <th className="p-1.5 border">Abdominal Girth</th>
                <th className="p-1.5 border">Airway Pressure &amp; Inotropes</th>
                <th className="p-1.5 border">Platelets &amp; CRP</th>
                <th className="p-1.5 border">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[10px]">
              {flowsheet.map((entry) => (
                <tr key={entry.id}>
                  <td className="p-1.5 border font-semibold">
                    +{entry.hours_from_intervention}h ({entry.log_datetime.slice(0, 16).replace('T', ' ')})
                  </td>
                  <td className="p-1.5 border font-bold text-amber-800">{entry.drain_output_ml_24h} mL</td>
                  <td className="p-1.5 border capitalize">{entry.drain_output_character.replace(/_/g, ' ')}</td>
                  <td className="p-1.5 border">{entry.abdominal_girth_cm} cm</td>
                  <td className="p-1.5 border">
                    {entry.mean_airway_pressure_cmh2o} cmH2O {entry.inotropic_support_active ? '(Inotropes)' : ''}
                  </td>
                  <td className="p-1.5 border">
                    {entry.platelet_count_k_ul}k / {entry.crp_mg_l} mg/L
                  </td>
                  <td className="p-1.5 border">{entry.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Surgical Sign-off */}
      <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <span className="block font-bold uppercase text-[9px] text-slate-500 mb-1">
            Attending Pediatric Surgeon / Neonatologist
          </span>
          <div className="h-8 border-b border-dashed border-slate-400"></div>
          <span className="block mt-1 font-semibold text-slate-700">Signature / Seal / Date</span>
        </div>
        <div>
          <span className="block font-bold uppercase text-[9px] text-slate-500 mb-1">
            Bedside NICU Charge Nurse / ECMO Specialist
          </span>
          <div className="h-8 border-b border-dashed border-slate-400"></div>
          <span className="block mt-1 font-semibold text-slate-700">Signature / Verification</span>
        </div>
      </div>
    </div>
  );
};
