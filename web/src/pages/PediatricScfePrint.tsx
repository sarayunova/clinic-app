import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPediatricScfeEpisode,
  type PediatricScfeRecord,
  type PediatricScfeFlowsheetRecord,
} from '../api';
import { type PediatricScfeEvaluationResult } from '../pediatricScfeEngine';

export const PediatricScfePrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: PediatricScfeRecord;
    evaluation: PediatricScfeEvaluationResult;
    flowsheet: PediatricScfeFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getPediatricScfeEpisode(Number(id))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load pediatric SCFE dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating Pediatric SCFE Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Pediatric SCFE Record not found.</div>;
  }

  const { episode, evaluation, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0 print:max-w-none text-xs leading-normal">
      {/* Print Trigger Button */}
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
          <h1 className="text-xl font-black text-amber-950 uppercase tracking-tight">
            Pediatric Orthopaedic Surgery &amp; Traumatology Division
          </h1>
          <p className="text-xs font-semibold text-slate-700">
            Pediatric Slipped Capital Femoral Epiphysis (SCFE) &amp; Loder Instability Protocol Dossier
          </p>
          <p className="text-[10px] text-slate-500">
            Reference: POSNA / AAOS Evidence-Based Clinical Practice Guidelines
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
          <span className="text-slate-500 block text-[10px]">Age &amp; Habitus:</span>
          <span className="font-semibold text-slate-700">
            {episode.age_years} yrs • {episode.weight_kg} kg (BMI {episode.bmi_percentile}th %ile)
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">Affected Hip:</span>
          <span className="font-bold font-mono text-slate-800 uppercase">{episode.affected_hip} hip</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">Urgency Tier:</span>
          <span className="font-bold text-amber-800 uppercase text-[11px]">{evaluation.urgencyTierLabel}</span>
        </div>
      </div>

      {/* Primary Staging & Risk Badges */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded">
          <div className="text-[10px] font-bold uppercase text-amber-900">Loder Clinical Stability</div>
          <div className="font-bold text-sm text-amber-950 mt-1">{evaluation.loderClassificationLabel}</div>
          <div className="text-[10px] text-red-700 font-bold mt-1 font-mono">
            AVN Risk: {evaluation.avascularNecrosisRiskPct}
          </div>
        </div>

        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded">
          <div className="text-[10px] font-bold uppercase text-indigo-900">Southwick Slip Angle</div>
          <div className="font-bold text-sm text-indigo-950 mt-1">{evaluation.southwickSeverityLabel}</div>
          <div className="text-[10px] text-slate-600 mt-1">
            Frog-Leg Angle: {episode.southwick_slip_angle_degrees}°
          </div>
        </div>

        <div className="p-3 bg-purple-50 border border-purple-200 rounded">
          <div className="text-[10px] font-bold uppercase text-purple-900">Contralateral Prophylaxis</div>
          <div className="font-bold text-sm text-purple-950 mt-1">
            {evaluation.isContralateralProphylacticPinningIndicated ? 'Pinning Indicated' : 'Close Surveillance'}
          </div>
          <div className="text-[10px] text-slate-600 mt-1">
            Endocrinopathy: {episode.endocrine_disorder_suspected === 1 ? 'Suspected' : 'None'}
          </div>
        </div>
      </div>

      {/* Clinical Directives */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border border-slate-200 rounded p-3">
          <h2 className="font-bold text-slate-800 border-b pb-1 mb-2 text-xs uppercase">
            Emergency Preoperative Safety Directives
          </h2>
          <div className="text-[11px] font-semibold text-red-900 mb-1">
            Strict Non-Weight Bearing: {episode.strict_non_weight_bearing_enforced === 1 ? 'Enforced' : 'Pending'}
          </div>
          <ul className="list-disc pl-4 space-y-1 text-slate-700">
            {evaluation.preoperativeDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>

        <div className="border border-slate-200 rounded p-3">
          <h2 className="font-bold text-slate-800 border-b pb-1 mb-2 text-xs uppercase">
            Surgical Fixation Directives &amp; Technique
          </h2>
          <div className="text-[11px] font-semibold text-indigo-900 mb-1">
            Procedure: {episode.surgical_procedure_performed.replace(/_/g, ' ')}
          </div>
          <ul className="list-disc pl-4 space-y-1 text-slate-700">
            {evaluation.surgicalDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Postoperative Mobility & Contralateral Rationale */}
      <div className="border border-slate-200 rounded p-3 mb-4">
        <h2 className="font-bold text-slate-800 border-b pb-1 mb-2 text-xs uppercase">
          Rehabilitation &amp; Contralateral Hip Surveillance
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Mobility Protocol</div>
            <ul className="list-disc pl-4 space-y-1 text-slate-700">
              {evaluation.postoperativeMobilityDirectives.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Contralateral Pinning Rationale</div>
            <p className="text-slate-800 font-medium mb-2">{evaluation.contralateralPinningRationale}</p>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Diagnostic Referral Note</div>
            <p className="text-slate-700">
              {episode.referred_knee_thigh_pain === 1
                ? 'Patient presented with referred knee/distal thigh pain; obturator nerve referral accounted for.'
                : 'Isolated hip and groin symptoms.'}
            </p>
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
          Serial SCFE Flowsheet &amp; Rehabilitation Audits ({flowsheet.length} records)
        </div>
        {flowsheet.length === 0 ? (
          <div className="p-4 text-center text-slate-400">No serial flowsheet logs recorded.</div>
        ) : (
          <table className="w-full text-left text-[10px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-3 py-1.5">Date</th>
                <th className="px-3 py-1.5">Day</th>
                <th className="px-3 py-1.5">VAS Pain</th>
                <th className="px-3 py-1.5">NWB Compliance</th>
                <th className="px-3 py-1.5">Hip IR</th>
                <th className="px-3 py-1.5">Wound</th>
                <th className="px-3 py-1.5">Neurovascular</th>
                <th className="px-3 py-1.5">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {flowsheet.map((f) => (
                <tr key={f.id}>
                  <td className="px-3 py-1 font-mono">{new Date(f.log_datetime).toLocaleDateString()}</td>
                  <td className="px-3 py-1 font-semibold">Day {f.day_from_presentation}</td>
                  <td className="px-3 py-1 font-bold text-amber-700">{f.pain_score_vas}/10</td>
                  <td className="px-3 py-1 capitalize">{f.non_weight_bearing_compliance.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-1 font-mono">{f.hip_internal_rotation_degrees}°</td>
                  <td className="px-3 py-1">{f.wound_dressing_clean === 1 ? 'Clean' : 'Attention'}</td>
                  <td className="px-3 py-1 capitalize">{f.distal_neurovascular_status.replace(/_/g, ' ')}</td>
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
          <div className="font-semibold text-slate-800">Primary Pediatric Orthopaedic Surgeon:</div>
          <div className="mt-8 border-b border-dashed border-slate-400 w-3/4"></div>
          <div className="text-[10px] text-slate-500 mt-1">Signature &amp; Stamp / Date</div>
        </div>
        <div>
          <div className="font-semibold text-slate-800">Pediatric Rehabilitation Specialist:</div>
          <div className="mt-8 border-b border-dashed border-slate-400 w-3/4"></div>
          <div className="text-[10px] text-slate-500 mt-1">Signature &amp; Stamp / Date</div>
        </div>
      </div>
    </div>
  );
};
