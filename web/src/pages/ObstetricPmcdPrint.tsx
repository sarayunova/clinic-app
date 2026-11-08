import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getObstetricPmcdEpisode,
  type ObstetricPmcdRecord,
  type ObstetricPmcdFlowsheetRecord,
} from '../api';
import { type ObstetricPmcdEvaluationResult } from '../obstetricPmcdEngine';

export const ObstetricPmcdPrint: React.FC = () => {
  const { id, episodeId } = useParams<{ id?: string; episodeId?: string }>();
  const targetId = id || episodeId;
  const [data, setData] = useState<{
    episode: ObstetricPmcdRecord;
    evaluation: ObstetricPmcdEvaluationResult;
    flowsheet: ObstetricPmcdFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetId) return;
    getObstetricPmcdEpisode(Number(targetId))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load obstetric PMCD dossier:', err);
        setLoading(false);
      });
  }, [targetId]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating Obstetric PMCD Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Obstetric PMCD Record not found.</div>;
  }

  const { episode, evaluation, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0 print:max-w-none text-xs leading-normal">
      {/* Print Button */}
      <div className="flex justify-end mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-800"
        >
          Print Dossier 🖨
        </button>
      </div>

      {/* Hospital Header */}
      <div className="border-b-2 border-rose-900 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-rose-950 uppercase">
            Code Blue Obstetric Dossier: Resuscitative Hysterotomy (PMCD)
          </h1>
          <p className="text-xs text-slate-600">
            AHA CPR in Pregnancy / SOAP / RCOG Green-top Guideline No. 56 • The Strict 4-to-5 Minute Rule
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-rose-900">{episode.episode_code}</div>
          <div className="text-[10px] text-slate-500">Generated: {new Date().toLocaleDateString()}</div>
        </div>
      </div>

      {/* Patient & Arrest Demographics */}
      <div className="mb-4 bg-slate-50 border border-slate-200 rounded p-3 grid grid-cols-4 gap-2">
        <div>
          <span className="block text-[10px] uppercase font-bold text-slate-500">Maternal Patient</span>
          <span className="font-semibold text-slate-900">{episode.patient_name || `ID #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-bold text-slate-500">Gestational Age</span>
          <span className="font-semibold text-slate-900">{episode.gestational_age_weeks} weeks</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-bold text-slate-500">Initial Arrest Rhythm</span>
          <span className="font-semibold text-slate-900 uppercase">{episode.initial_arrest_rhythm}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-bold text-slate-500">Attending Resuscitation Lead</span>
          <span className="font-semibold text-slate-900">{episode.consultant_name || 'Code Blue Team Lead'}</span>
        </div>
      </div>

      {/* Resuscitation Timing & 4-Minute Compliance */}
      <div className="mb-4 border border-rose-200 rounded p-3 bg-rose-50/50 space-y-2">
        <div className="flex justify-between items-center border-b border-rose-200 pb-1">
          <span className="font-bold text-rose-950 uppercase">
            Timing Benchmark: {evaluation.timeComplianceLabel}
          </span>
          <span className="font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-rose-200 text-rose-900">
            {evaluation.urgencyTierLabel}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
          <div>
            <span className="text-slate-500 font-semibold">Decision / Incision: </span>
            <span className="font-bold">Minute {episode.pmcd_decision_minute} post-arrest</span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold">Arrest-to-Delivery: </span>
            <span className="font-bold">
              {episode.elapsed_arrest_to_delivery_minutes !== null ? `${episode.elapsed_arrest_to_delivery_minutes} min` : 'Not recorded'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold">Maternal ROSC: </span>
            <span className="font-bold text-rose-800">
              {episode.rosc_achieved_post_delivery ? 'ACHIEVED POST-DELIVERY 💓' : 'No ROSC'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <span className="text-slate-500 font-semibold">Manual Left Uterine Displacement: </span>
            <span className="font-bold">
              {episode.continuous_left_uterine_displacement ? 'Maintained Continuously (≥30°)' : 'Absent / Interrupted'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold">BEAU-CHOPS Etiology: </span>
            <span className="font-bold capitalize">{episode.primary_etiology_beau_chops.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold">Uterine Closure: </span>
            <span className="font-bold capitalize">{episode.uterine_closure_method.replace(/_/g, ' ')}</span>
          </div>
        </div>

        {evaluation.alerts.length > 0 && (
          <div className="mt-2 p-2 bg-rose-100/70 border border-rose-300 rounded text-rose-900 space-y-0.5">
            {evaluation.alerts.map((al, idx) => (
              <div key={idx} className="font-medium">🚨 {al}</div>
            ))}
          </div>
        )}
      </div>

      {/* Operative Strategy & Directives */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="border border-slate-200 rounded p-3">
          <h2 className="font-bold text-slate-800 uppercase text-[10px] mb-2 border-b pb-1">
            Bedside Resuscitative Hysterotomy Operative Technique
          </h2>
          <ul className="space-y-1 text-[11px] text-slate-700 list-disc list-inside">
            {evaluation.operativeHysterotomyDirectives.map((dir, idx) => (
              <li key={idx}>{dir}</li>
            ))}
          </ul>
        </div>

        <div className="border border-slate-200 rounded p-3">
          <h2 className="font-bold text-slate-800 uppercase text-[10px] mb-2 border-b pb-1">
            Post-ROSC Intensive Care &amp; Targeted Temperature (TTM)
          </h2>
          <ul className="space-y-1 text-[11px] text-slate-700 list-disc list-inside">
            {evaluation.postRoscCareDirectives.map((care, idx) => (
              <li key={idx}>{care}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Etiology Specific Directives */}
      <div className="mb-4 border border-slate-200 rounded p-3">
        <h2 className="font-bold text-slate-800 uppercase text-[10px] mb-2 border-b pb-1">
          BEAU-CHOPS Etiology Interventions: {episode.primary_etiology_beau_chops.replace(/_/g, ' ').toUpperCase()}
        </h2>
        <ul className="grid grid-cols-2 gap-1 text-[11px] text-slate-700 list-disc list-inside">
          {evaluation.etiologySpecificDirectives.map((dir, idx) => (
            <li key={idx}>{dir}</li>
          ))}
        </ul>
      </div>

      {/* Resuscitation Checkpoints Flowsheet */}
      <div className="mb-6">
        <h2 className="font-bold text-slate-800 uppercase text-[10px] mb-2 border-b pb-1">
          Resuscitation &amp; Post-ROSC Checkpoints Flowsheet
        </h2>
        {flowsheet.length === 0 ? (
          <p className="text-slate-400 italic">No flowsheet checkpoints recorded.</p>
        ) : (
          <table className="w-full text-left border border-slate-200">
            <thead className="bg-slate-100 text-[10px] uppercase font-semibold text-slate-600">
              <tr>
                <th className="p-1.5 border">Time / Min Post-Arrest</th>
                <th className="p-1.5 border">Vitals (HR • BP)</th>
                <th className="p-1.5 border">EtCO2</th>
                <th className="p-1.5 border">Pupils</th>
                <th className="p-1.5 border">CPR / ROSC</th>
                <th className="p-1.5 border">TTM &amp; Transfusions</th>
                <th className="p-1.5 border">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[10px]">
              {flowsheet.map((entry) => (
                <tr key={entry.id}>
                  <td className="p-1.5 border font-semibold">
                    +{entry.minutes_post_arrest} min ({entry.log_datetime.slice(0, 16).replace('T', ' ')})
                  </td>
                  <td className="p-1.5 border">
                    {entry.heart_rate_bpm} bpm • {entry.systolic_bp}/{entry.diastolic_bp}
                  </td>
                  <td className="p-1.5 border font-bold text-rose-800">{entry.end_tidal_co2_mmhg} mmHg</td>
                  <td className="p-1.5 border capitalize">{entry.pupillary_response.replace(/_/g, ' ')}</td>
                  <td className="p-1.5 border capitalize">{entry.chest_compressions_quality.replace(/_/g, ' ')}</td>
                  <td className="p-1.5 border">
                    Epi: {entry.epinephrine_cumulative_doses} doses / {entry.blood_products_transfused_units} blood units
                  </td>
                  <td className="p-1.5 border">{entry.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Code Leader Sign-off */}
      <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <span className="block font-bold uppercase text-[9px] text-slate-500 mb-1">
            Obstetric Code Leader / Operating Surgeon
          </span>
          <div className="h-8 border-b border-dashed border-slate-400"></div>
          <span className="block mt-1 font-semibold text-slate-700">Signature / License / Date</span>
        </div>
        <div>
          <span className="block font-bold uppercase text-[9px] text-slate-500 mb-1">
            ICU Intensivist / Anesthesiologist in Charge
          </span>
          <div className="h-8 border-b border-dashed border-slate-400"></div>
          <span className="block mt-1 font-semibold text-slate-700">Signature / Verification</span>
        </div>
      </div>
    </div>
  );
};
