import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getObstetricHellpEpisode,
  type ObstetricHellpRecord,
  type ObstetricHellpFlowsheetRecord,
} from '../api';
import { type ObstetricHellpEvaluationResult } from '../obstetricHellpEngine';

export const ObstetricHellpPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: ObstetricHellpRecord;
    evaluation: ObstetricHellpEvaluationResult;
    flowsheet: ObstetricHellpFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getObstetricHellpEpisode(Number(id))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load obstetric HELLP dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating Obstetric HELLP Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Obstetric HELLP Record not found.</div>;
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
      <div className="border-b-2 border-rose-900 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black text-rose-950 uppercase tracking-tight">
            Maternal-Fetal Medicine (MFM) &amp; Obstetric Critical Care Division
          </h1>
          <p className="text-xs font-semibold text-slate-700">
            Obstetric HELLP Syndrome Protocol • Mississippi Triple-Class Staging Dossier
          </p>
          <p className="text-[10px] text-slate-500">
            Reference: ACOG Practice Bulletin No. 222 / SMFM Consult Series
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
          <span className="text-slate-500 block text-[10px]">Gestational Age:</span>
          <span className="font-semibold text-slate-700">{episode.gestational_age_weeks} weeks</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">Blood Pressure:</span>
          <span className="font-bold font-mono text-slate-800">{episode.systolic_bp}/{episode.diastolic_bp} mmHg</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">Urgency Tier:</span>
          <span className="font-bold text-rose-800 uppercase text-[11px]">{evaluation.urgencyTierLabel}</span>
        </div>
      </div>

      {/* Staging & Classification Badges */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 bg-rose-50 border border-rose-200 rounded">
          <div className="text-[10px] font-bold uppercase text-rose-900">Mississippi Staging</div>
          <div className="font-bold text-sm text-rose-950 mt-1">{evaluation.mississippiClassLabel}</div>
          <div className="text-[10px] text-slate-600 mt-1">
            Platelets: {episode.platelet_count_per_ul.toLocaleString()} /µL
          </div>
        </div>

        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded">
          <div className="text-[10px] font-bold uppercase text-indigo-900">Tennessee Classification</div>
          <div className="font-bold text-sm text-indigo-950 mt-1">{evaluation.tennesseeClassificationLabel}</div>
          <div className="text-[10px] text-slate-600 mt-1">
            AST: {episode.ast_u_l} U/L • LDH: {episode.ldh_u_l} U/L
          </div>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded">
          <div className="text-[10px] font-bold uppercase text-amber-900">Hepatic Complication Risk</div>
          <div className="font-bold text-sm text-amber-950 mt-1">{evaluation.hepaticComplicationLabel}</div>
          <div className="text-[10px] text-slate-600 mt-1 capitalize">
            Imaging: {episode.hepatic_imaging_performed.replace(/_/g, ' ')}
          </div>
        </div>
      </div>

      {/* Clinical Directives */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border border-slate-200 rounded p-3">
          <h2 className="font-bold text-slate-800 border-b pb-1 mb-2 text-xs uppercase">
            Dexamethasone High-Dose Pulse Protocol
          </h2>
          <div className="text-[11px] font-semibold text-rose-900 mb-1">
            Initiated: {episode.dexamethasone_pulse_initiated === 1 ? 'Yes (Active)' : 'No'}
          </div>
          <ul className="list-disc pl-4 space-y-1 text-slate-700">
            {evaluation.dexamethasoneDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>

        <div className="border border-slate-200 rounded p-3">
          <h2 className="font-bold text-slate-800 border-b pb-1 mb-2 text-xs uppercase">
            Magnesium Sulfate &amp; Delivery Directives
          </h2>
          <div className="text-[11px] font-semibold text-indigo-900 mb-1">
            MgSO4 Prophylaxis: {episode.magnesium_sulfate_seizure_prophylaxis === 1 ? 'Active' : 'No'} • Plan: {episode.delivery_timing_plan.replace(/_/g, ' ')}
          </div>
          <ul className="list-disc pl-4 space-y-1 text-slate-700">
            {evaluation.deliveryDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Platelet Transfusion & Recommendations */}
      <div className="border border-slate-200 rounded p-3 mb-4">
        <h2 className="font-bold text-slate-800 border-b pb-1 mb-2 text-xs uppercase">
          Platelet Transfusion Thresholds &amp; Recommendations
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Transfusion Strategy</div>
            <p className="text-slate-800 font-medium">{evaluation.plateletTransfusionThresholdMessage}</p>
            <div className="mt-2 text-[10px] text-slate-600">
              Administered: {episode.platelet_transfusion_administered === 1 ? 'Yes' : 'Not yet'}
            </div>
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
          Serial HELLP Flowsheet Observations ({flowsheet.length} records)
        </div>
        {flowsheet.length === 0 ? (
          <div className="p-4 text-center text-slate-400">No serial flowsheet logs recorded.</div>
        ) : (
          <table className="w-full text-left text-[10px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-3 py-1.5">Timestamp</th>
                <th className="px-3 py-1.5">+Hrs</th>
                <th className="px-3 py-1.5">Platelets</th>
                <th className="px-3 py-1.5">AST / LDH</th>
                <th className="px-3 py-1.5">BP (mmHg)</th>
                <th className="px-3 py-1.5">Urine (mL/h)</th>
                <th className="px-3 py-1.5">Reflexes</th>
                <th className="px-3 py-1.5">RUQ Pain</th>
                <th className="px-3 py-1.5">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {flowsheet.map((f) => (
                <tr key={f.id}>
                  <td className="px-3 py-1 font-mono">{new Date(f.log_datetime).toLocaleString()}</td>
                  <td className="px-3 py-1 font-mono">+{f.hours_from_admission}h</td>
                  <td className="px-3 py-1 font-mono font-bold text-rose-700">{f.platelet_count_per_ul.toLocaleString()}</td>
                  <td className="px-3 py-1">{f.ast_u_l} / {f.ldh_u_l}</td>
                  <td className="px-3 py-1 font-mono">{f.systolic_bp}/{f.diastolic_bp}</td>
                  <td className="px-3 py-1">{f.urine_output_ml_hr}</td>
                  <td className="px-3 py-1 capitalize">{f.deep_tendon_reflexes.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-1">Score {f.epigastric_pain_score}/10</td>
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
          <div className="font-semibold text-slate-800">Attending MFM Obstetrician:</div>
          <div className="mt-8 border-b border-dashed border-slate-400 w-3/4"></div>
          <div className="text-[10px] text-slate-500 mt-1">Signature &amp; Stamp / Date</div>
        </div>
        <div>
          <div className="font-semibold text-slate-800">Intensive Care / Anesthesiology Consultant:</div>
          <div className="mt-8 border-b border-dashed border-slate-400 w-3/4"></div>
          <div className="text-[10px] text-slate-500 mt-1">Signature &amp; Stamp / Date</div>
        </div>
      </div>
    </div>
  );
};
