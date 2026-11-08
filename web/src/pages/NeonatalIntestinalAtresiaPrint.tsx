import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getNeonatalIntestinalAtresiaEpisode,
  type NeonatalIntestinalAtresiaRecord,
  type NeonatalIntestinalAtresiaFlowsheetRecord,
} from '../api';
import { type NeonatalIntestinalAtresiaEvaluationResult } from '../neonatalIntestinalAtresiaEngine';

export const NeonatalIntestinalAtresiaPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: NeonatalIntestinalAtresiaRecord;
    evaluation: NeonatalIntestinalAtresiaEvaluationResult;
    flowsheet: NeonatalIntestinalAtresiaFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getNeonatalIntestinalAtresiaEpisode(Number(id))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load neonatal intestinal atresia dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating Neonatal Intestinal Atresia Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Neonatal Intestinal Atresia Record not found.</div>;
  }

  const { episode, evaluation, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0 print:max-w-none text-xs leading-normal">
      {/* Print Trigger Button */}
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
          <h1 className="text-xl font-black text-indigo-950 uppercase tracking-tight">
            Pediatric Surgery &amp; Neonatal Intensive Care Division
          </h1>
          <p className="text-xs font-semibold text-slate-700">
            Neonatal Intestinal Atresia Protocol • Duodenal &amp; Jejunoileal Obstruction Dossier
          </p>
          <p className="text-[10px] text-slate-500">
            Reference: AAP / APSA (American Pediatric Surgical Association) / BAPS Consensus Guidelines
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-black text-slate-800">{episode.episode_code}</div>
          <div className="text-[10px] text-slate-500">
            Generated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Patient & Summary Card */}
      <div className="grid grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200 mb-4">
        <div>
          <span className="text-slate-500 block text-[10px]">Patient Name:</span>
          <span className="font-bold text-slate-800 text-sm">{episode.patient_name || `Patient #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">Age &amp; Weight:</span>
          <span className="font-semibold text-slate-700">{episode.age_hours} hours • {episode.weight_kg} kg</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">Status:</span>
          <span className="font-bold text-indigo-800 uppercase text-[11px]">{episode.status.replace(/_/g, ' ')}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">Urgency Tier:</span>
          <span className="font-bold text-red-700 uppercase text-[11px]">{evaluation.urgencyTierLabel}</span>
        </div>
      </div>

      {/* Primary Surgical Classification & Risk Badges */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded">
          <div className="text-[10px] font-bold uppercase text-indigo-900">Atresia Type &amp; Anatomy</div>
          <div className="font-bold text-sm text-indigo-950 mt-1">{evaluation.atresiaClassificationLabel}</div>
          <div className="text-[10px] text-slate-600 mt-1">Gas: {episode.radiographic_gas_pattern.replace(/_/g, ' ')}</div>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded">
          <div className="text-[10px] font-bold uppercase text-amber-900">Trisomy 21 / Syndromic Risk</div>
          <div className="font-bold text-sm text-amber-950 mt-1">{evaluation.syndromicTrisomy21Label}</div>
          <div className="text-[10px] text-slate-600 mt-1">
            ECHO Defect: {episode.echocardiogram_cardiac_defect === 1 ? 'Present (AVSD/VSD risk)' : 'None detected'}
          </div>
        </div>

        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <div className="text-[10px] font-bold uppercase text-red-900">Short Bowel Syndrome Risk</div>
          <div className="font-bold text-sm text-red-950 mt-1">{evaluation.shortBowelSyndromeRiskLabel}</div>
          <div className="text-[10px] text-slate-600 mt-1">
            TAT Placed: {episode.transanastomotic_tube_placed === 1 ? 'Yes' : 'No'} | TPN: {episode.tpn_central_line_in_situ === 1 ? 'Yes' : 'No'}
          </div>
        </div>
      </div>

      {/* Clinical Directives */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border border-slate-200 rounded p-3">
          <h2 className="font-bold text-slate-800 border-b pb-1 mb-2 text-xs uppercase">
            Preoperative Decompression Directives
          </h2>
          <ul className="list-disc pl-4 space-y-1 text-slate-700">
            {evaluation.decompressionDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>

        <div className="border border-slate-200 rounded p-3">
          <h2 className="font-bold text-slate-800 border-b pb-1 mb-2 text-xs uppercase">
            Operative Procedure &amp; Technique
          </h2>
          <div className="font-semibold text-indigo-900 mb-1">
            Planned: {episode.surgical_procedure_planned.replace(/_/g, ' ')}
          </div>
          <ul className="list-disc pl-4 space-y-1 text-slate-700">
            {evaluation.surgicalDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Nutritional Directives & Recommendations */}
      <div className="border border-slate-200 rounded p-3 mb-4">
        <h2 className="font-bold text-slate-800 border-b pb-1 mb-2 text-xs uppercase">
          Enteral Nutrition &amp; Systemic Recommendations
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Enteral / TPN Guidelines</div>
            <ul className="list-disc pl-4 space-y-1 text-slate-700">
              {evaluation.nutritionalDirectives.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Clinical Recommendations</div>
            <ul className="list-disc pl-4 space-y-1 text-slate-700">
              {evaluation.recommendations.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Clinical Alerts */}
      {evaluation.alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
          <div className="font-bold text-red-900 text-xs uppercase mb-1">Critical Alerts</div>
          <ul className="list-disc pl-4 space-y-1 text-red-800">
            {evaluation.alerts.map((alert, i) => (
              <li key={i} className="font-medium">{alert}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Flowsheet Log Table */}
      <div className="border border-slate-200 rounded mb-4 overflow-hidden">
        <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-700 text-xs border-b border-slate-200">
          NICU &amp; Surgical Flowsheet Observations ({flowsheet.length} records)
        </div>
        {flowsheet.length === 0 ? (
          <div className="p-4 text-center text-slate-400">No flowsheet logs recorded.</div>
        ) : (
          <table className="w-full text-left text-[10px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-3 py-1.5">Recorded At</th>
                <th className="px-3 py-1.5">+Hrs</th>
                <th className="px-3 py-1.5">NG Output &amp; Character</th>
                <th className="px-3 py-1.5">Abdominal Girth</th>
                <th className="px-3 py-1.5">Enteral Feed Rate</th>
                <th className="px-3 py-1.5">Vitals (HR / RR)</th>
                <th className="px-3 py-1.5">Stool Passed</th>
                <th className="px-3 py-1.5">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {flowsheet.map((f) => (
                <tr key={f.id}>
                  <td className="px-3 py-1 font-mono">{new Date(f.log_datetime).toLocaleString()}</td>
                  <td className="px-3 py-1 font-mono">+{f.hours_from_admission}h</td>
                  <td className="px-3 py-1 font-medium">{f.nasogastric_output_ml} mL • {f.nasogastric_aspirate_character.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-1">{f.abdominal_girth_cm} cm</td>
                  <td className="px-3 py-1">{f.enteral_feed_rate_ml_hr} mL/hr</td>
                  <td className="px-3 py-1">{f.heart_rate} bpm • {f.respiratory_rate}/min</td>
                  <td className="px-3 py-1">{f.stool_passage_observed === 1 ? `Yes (${f.stool_character.replace(/_/g, ' ')})` : 'No'}</td>
                  <td className="px-3 py-1">{f.logged_by_name || 'Staff'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Signature Section */}
      <div className="mt-8 pt-4 border-t border-slate-300 grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <div className="font-semibold text-slate-800">Primary Pediatric Surgeon:</div>
          <div className="mt-8 border-b border-dashed border-slate-400 w-3/4"></div>
          <div className="text-[10px] text-slate-500 mt-1">Signature &amp; Stamp / Date</div>
        </div>
        <div>
          <div className="font-semibold text-slate-800">Attending Neonatologist (NICU):</div>
          <div className="mt-8 border-b border-dashed border-slate-400 w-3/4"></div>
          <div className="text-[10px] text-slate-500 mt-1">Signature &amp; Stamp / Date</div>
        </div>
      </div>
    </div>
  );
};
