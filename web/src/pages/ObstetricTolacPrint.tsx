import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getObstetricTolacEpisode,
  type ObstetricTolacRecord,
  type ObstetricTolacFlowsheetRecord,
} from '../api';
import { type ObstetricTolacResult } from '../obstetricTolacEngine';

export const ObstetricTolacPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: ObstetricTolacRecord;
    evaluation: ObstetricTolacResult;
    flowsheet: ObstetricTolacFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getObstetricTolacEpisode(Number(id))
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load TOLAC dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating TOLAC Clinical Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Obstetric TOLAC Episode not found.</div>;
  }

  const { episode, evaluation, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0 print:max-w-none text-xs leading-normal">
      {/* Print Trigger Button (Hidden in Print) */}
      <div className="flex justify-end mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-800"
        >
          Print Dossier 🖨
        </button>
      </div>

      {/* Hospital Dossier Header */}
      <div className="border-b-2 border-emerald-800 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-emerald-900">
            Maternal-Fetal Medicine & Labor Ward
          </h1>
          <p className="text-sm font-semibold text-slate-800">
            Trial of Labor After Cesarean (TOLAC) & Uterine Rupture Protocol Dossier
          </p>
          <p className="text-[10px] text-slate-500">
            ACOG Practice Bulletin No. 205 / RCOG Green-top Guideline No. 45
          </p>
        </div>
        <div className="text-right">
          <div className="text-base font-black font-mono text-emerald-700">{episode.episode_code}</div>
          <div className="text-[10px] text-slate-600">Generated: {new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Patient & Baseline Information */}
      <div className="grid grid-cols-4 gap-2 border border-slate-300 p-2.5 rounded mb-4 bg-slate-50">
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Patient Name</span>
          <span className="font-bold text-xs">{episode.patient_name || `Patient #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Gestational Age</span>
          <span className="font-semibold">{episode.gestational_age_weeks} weeks</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Maternal Age / BMI</span>
          <span className="font-semibold">{episode.maternal_age} yrs / {episode.maternal_bmi} kg/m²</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Prior Incision</span>
          <span className="font-semibold capitalize">{episode.prior_uterine_incision_type.replace(/_/g, ' ')}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Prior Vaginal Delivery</span>
          <span className="font-semibold capitalize">{episode.prior_vaginal_delivery.replace(/_/g, ' ')}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Prior CS Count & Indication</span>
          <span className="font-semibold">{episode.prior_cesarean_count} ({episode.indication_for_prior_cesarean})</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Status</span>
          <span className="font-bold uppercase text-emerald-700">{episode.status.replace(/_/g, ' ')}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Consultant Obstetrician</span>
          <span className="font-semibold">{episode.consultant_name || 'Staff Obstetrician'}</span>
        </div>
      </div>

      {/* Grobman VBAC Probability & Rupture Risk Matrix */}
      <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded">
        <h3 className="font-bold text-emerald-900 text-xs uppercase mb-2">
          Grobman VBAC Probability & Uterine Rupture Risk Stratification
        </h3>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="border-r border-emerald-200">
            <span className="block text-[10px] text-emerald-700 uppercase font-semibold">Grobman VBAC Score</span>
            <span className="text-xl font-black text-emerald-900">{evaluation.grobmanVbacSuccessPct}%</span>
            <span className="block text-[9px] text-slate-500">Calculated Success Probability</span>
          </div>
          <div className="border-r border-emerald-200">
            <span className="block text-[10px] text-emerald-700 uppercase font-semibold">Admission Bishop</span>
            <span className="text-xl font-black text-emerald-900">{episode.bishop_score} / 13</span>
            <span className="block text-[9px] text-slate-500">Cervical Ripeness</span>
          </div>
          <div className="border-r border-emerald-200">
            <span className="block text-[10px] text-emerald-700 uppercase font-semibold">Rupture Risk Tier</span>
            <span className="text-sm font-black text-slate-800 uppercase">
              {evaluation.ruptureRiskTier.replace(/_/g, ' ')}
            </span>
            <span className="block text-[9px] text-slate-500">{evaluation.ruptureRiskTierLabel}</span>
          </div>
          <div>
            <span className="block text-[10px] text-emerald-700 uppercase font-semibold">Crash CS Indication</span>
            <span className={`text-sm font-black uppercase ${
              evaluation.isCrashCesareanIndicated ? 'text-red-700' : 'text-emerald-700'
            }`}>
              {evaluation.isCrashCesareanIndicated ? 'IMMEDIATE CATEGORY-1' : 'NOT INDICATED'}
            </span>
            <span className="block text-[9px] text-slate-500">Target &le; 30 min DDI</span>
          </div>
        </div>
      </div>

      {/* Contraindications & Impending Rupture Triad */}
      <div className="mb-4 border border-slate-300 rounded p-3">
        <h3 className="font-bold text-slate-800 text-xs uppercase mb-2">
          Impending Uterine Rupture Surveillance Checkpoints
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-slate-700">
          <div>• Fetal Heart Tracing: <strong>{episode.efm_abnormality.replace(/_/g, ' ')}</strong></div>
          <div>• IUPC Loss of Tone: <strong>{episode.iupc_loss_of_uterine_tone ? 'POSITIVE ⚠️' : 'Normal'}</strong></div>
          <div>• Lower Scar Pain: <strong>{episode.acute_scar_tenderness ? 'ACUTE TENDERNESS ⚠️' : 'Absent'}</strong></div>
          <div>• Fresh Vaginal Bleeding: <strong>{episode.vaginal_bleeding_fresh ? 'OVERT BLEEDING ⚠️' : 'None'}</strong></div>
          <div>• Cessation of Contractions: <strong>{episode.cessation_of_contractions ? 'ABRUPT STOP ⚠️' : 'Active'}</strong></div>
          <div>• Presenting Part Retraction: <strong>{episode.presenting_part_retraction ? 'RETRACTED 🚨' : 'Engaged'}</strong></div>
        </div>
      </div>

      {/* Serial Active Labor Progression Flowsheet */}
      <div className="mb-4">
        <h3 className="font-bold text-slate-800 text-xs uppercase mb-1">Serial Labor Progression & Fetal Heart Tracing Log</h3>
        <table className="w-full border-collapse border border-slate-300 text-[10px]">
          <thead className="bg-slate-100">
            <tr>
              <th className="border border-slate-300 p-1">Time</th>
              <th className="border border-slate-300 p-1">Active Labor</th>
              <th className="border border-slate-300 p-1">Cervical Dilation</th>
              <th className="border border-slate-300 p-1">FHR Baseline</th>
              <th className="border border-slate-300 p-1">EFM Tracing</th>
              <th className="border border-slate-300 p-1">Contr./10m</th>
              <th className="border border-slate-300 p-1">Resting Tone</th>
              <th className="border border-slate-300 p-1">Scar Pain</th>
              <th className="border border-slate-300 p-1">Intervention / Staff</th>
            </tr>
          </thead>
          <tbody>
            {flowsheet.length === 0 ? (
              <tr>
                <td colSpan={9} className="border border-slate-300 p-2 text-center text-slate-400 italic">
                  No labor progression checkpoints recorded.
                </td>
              </tr>
            ) : (
              flowsheet.map((f) => (
                <tr key={f.id} className="text-center">
                  <td className="border border-slate-300 p-1">{f.log_datetime?.slice(11, 16)}</td>
                  <td className="border border-slate-300 p-1">{f.hours_in_active_labor}h</td>
                  <td className="border border-slate-300 p-1 font-bold text-emerald-700">{f.cervical_dilation_cm} cm</td>
                  <td className="border border-slate-300 p-1">{f.fetal_heart_rate_baseline} bpm</td>
                  <td className="border border-slate-300 p-1">{f.efm_category.replace(/_/g, ' ')}</td>
                  <td className="border border-slate-300 p-1">{f.contractions_per_10min}</td>
                  <td className="border border-slate-300 p-1">{f.resting_uterine_tone_mmhg ? `${f.resting_uterine_tone_mmhg} mmHg` : '-'}</td>
                  <td className="border border-slate-300 p-1 font-semibold text-red-600">{f.lower_segment_scar_pain ? 'YES' : 'No'}</td>
                  <td className="border border-slate-300 p-1 text-left">{f.intervention_applied || f.logged_by_name || 'Staff'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Clinical Recommendations & Alerts */}
      <div className="mb-4 space-y-2">
        {evaluation.alerts.length > 0 && (
          <div className="p-2.5 border border-red-300 rounded bg-red-50">
            <span className="font-bold text-[10px] text-red-800 block uppercase mb-1">
              Critical Alerts & Rupture Warnings:
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-[10px] text-red-700">
              {evaluation.alerts.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {evaluation.recommendations.length > 0 && (
          <div className="p-2.5 border border-slate-300 rounded bg-slate-50">
            <span className="font-bold text-[10px] text-slate-700 block uppercase mb-1">
              ACOG Management Directives:
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-[10px] text-slate-600">
              {evaluation.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Sign-off */}
      <div className="border-t border-slate-400 pt-6 mt-8 grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <div className="border-b border-slate-400 pb-8 mb-1"></div>
          <span className="font-semibold text-slate-600">Attending Obstetrician Signature</span>
        </div>
        <div className="text-right">
          <div className="border-b border-slate-400 pb-8 mb-1"></div>
          <span className="font-semibold text-slate-600">Labor Ward Lead Midwife Signature</span>
        </div>
      </div>
    </div>
  );
};
