import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getObstetricEcvEpisode,
  type ObstetricEcvRecord,
  type ObstetricEcvFlowsheetRecord,
} from '../api';
import { type ObstetricEcvEvaluationResult } from '../obstetricEcvEngine';

export const ObstetricEcvPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: ObstetricEcvRecord;
    evaluation: ObstetricEcvEvaluationResult;
    flowsheet: ObstetricEcvFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getObstetricEcvEpisode(Number(id))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheet || res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load ECV dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating ECV Clinical Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Obstetric ECV Episode not found.</div>;
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
      <div className="border-b-2 border-indigo-800 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-indigo-900">
            Obstetrics & Maternal-Fetal Medicine (MFM)
          </h1>
          <p className="text-sm font-semibold text-slate-800">
            External Cephalic Version (ECV) & Breech Conversion Clinical Dossier
          </p>
          <p className="text-slate-500 text-[10px]">
            Reference: ACOG Practice Bulletin No. 13 / RCOG Green-top Guideline No. 20a
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-bold text-indigo-700">{episode.episode_code}</div>
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
          <span className="text-slate-500 block">GA & Parity:</span>
          <span className="font-bold">{episode.gestational_age_weeks} weeks &middot; Para {episode.maternal_parity}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Procedure Datetime:</span>
          <span className="font-bold">{new Date(episode.procedure_datetime).toLocaleString()}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Attending Obstetrician:</span>
          <span className="font-bold">{episode.consultant_name || 'Consultant Obstetrician'}</span>
        </div>
      </div>

      {/* Predictive Success & Eligibility Card */}
      <div className={`p-4 rounded border mb-4 ${
        evaluation.hasAbsoluteContraindications
          ? 'bg-red-50 border-red-300'
          : evaluation.successLikelihoodTier === 'high'
          ? 'bg-emerald-50 border-emerald-300'
          : 'bg-amber-50 border-amber-300'
      }`}>
        <div className="flex justify-between items-center mb-1">
          <div>
            <span className="font-black text-sm uppercase text-slate-900">
              {evaluation.calculatedSuccessProbabilityPct}% Estimated Conversion Probability
            </span>
            <div className="text-xs font-semibold text-slate-700 mt-0.5">{evaluation.successLikelihoodTierLabel}</div>
          </div>
          <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
            evaluation.isEligibleForEcv ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'
          }`}>
            {evaluation.isEligibleForEcv ? 'ELIGIBLE CANDIDATE' : 'CONTRAINDICATED'}
          </span>
        </div>

        {evaluation.alerts.length > 0 && (
          <div className="mt-2 space-y-1">
            {evaluation.alerts.map((alt, idx) => (
              <div key={idx} className="font-bold text-red-900 flex items-center gap-1">
                <span>⚠️</span> {alt}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ultrasound & Tocolysis Breakdown */}
      <div className="border border-slate-200 rounded p-3 mb-4">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2 border-b pb-1">
          Ultrasound Parameters, Tocolytic Premedication & Rh Protocol
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500 block">Initial Presentation:</span>
            <span className="font-bold capitalize">{episode.fetal_presentation_initial.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Placental Location:</span>
            <span className="font-bold capitalize">{episode.placental_location.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-slate-500 block">AFI:</span>
            <span className="font-bold">{episode.amniotic_fluid_index_cm} cm</span>
          </div>
          <div>
            <span className="text-slate-500 block">Estimated Fetal Weight:</span>
            <span className="font-bold">{episode.estimated_fetal_weight_g} g</span>
          </div>
          <div>
            <span className="text-slate-500 block">Spine & Engagement:</span>
            <span className="font-bold capitalize">{episode.fetal_spine_position} &middot; {episode.fetal_engagement_level.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Tocolytic Agent:</span>
            <span className="font-bold capitalize">{episode.tocolytic_agent_administered.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Maternal Rh Status:</span>
            <span className="font-bold">{Boolean(episode.maternal_rh_negative) ? 'Rh-Negative (D-)' : 'Rh-Positive (D+)'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Anti-D & Kleihauer-Betke:</span>
            <span className="font-bold">
              {Boolean(episode.rh_anti_d_administered) ? 'Anti-D Given' : 'None'} &middot; {Boolean(episode.kleihauer_betke_sent) ? 'KB Sent' : 'KB Not Sent'}
            </span>
          </div>
        </div>
      </div>

      {/* Procedural Outcome & Technique */}
      <div className="border border-indigo-200 bg-indigo-50/40 rounded p-3 mb-4">
        <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-900 mb-2">
          Maneuver Vectors & Final Procedure Outcome
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500 block">Attempts Count:</span>
            <span className="font-bold">{episode.attempts_count}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Forward Roll:</span>
            <span className="font-bold">{Boolean(episode.forward_roll_attempted) ? 'Yes' : 'No'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Backward Flip:</span>
            <span className="font-bold">{Boolean(episode.backward_flip_attempted) ? 'Yes' : 'No'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Final Outcome:</span>
            <span className="font-bold capitalize text-indigo-900">{episode.ecv_outcome.replace(/_/g, ' ')}</span>
          </div>
        </div>
      </div>

      {/* Flowsheet Log */}
      <div className="border border-slate-200 rounded p-3 mb-6">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2 border-b pb-1">
          Serial Cardiotocography & Procedural Monitoring Flowsheet
        </h3>
        {flowsheet.length === 0 ? (
          <p className="text-slate-500 italic py-2">No flowsheet checkpoints logged.</p>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 font-semibold text-slate-600">
                <th className="p-1.5">Minutes</th>
                <th className="p-1.5">FHR Baseline</th>
                <th className="p-1.5">EFM Pattern</th>
                <th className="p-1.5">Maternal HR / BP</th>
                <th className="p-1.5">Uterine Tone</th>
                <th className="p-1.5">Notes</th>
                <th className="p-1.5">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-800">
              {flowsheet.map((l) => (
                <tr key={l.id}>
                  <td className="p-1.5 whitespace-nowrap font-medium">+{l.minutes_from_start}m</td>
                  <td className="p-1.5 font-bold text-indigo-700">{l.fetal_heart_rate_baseline} bpm</td>
                  <td className="p-1.5 capitalize">{l.efm_pattern.replace(/_/g, ' ')}</td>
                  <td className="p-1.5">{l.maternal_heart_rate} bpm &middot; {l.maternal_blood_pressure_sys ? `${l.maternal_blood_pressure_sys}/${l.maternal_blood_pressure_dia}` : '—'}</td>
                  <td className="p-1.5">{Boolean(l.uterine_relaxation_adequate) ? 'Relaxed' : 'Contracting'}</td>
                  <td className="p-1.5 max-w-xs truncate">{l.notes || '—'}</td>
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
          <span className="font-semibold block text-slate-700">Attending Obstetrician / MFM</span>
          <span className="text-slate-500">Date & Stamp: __________________</span>
        </div>
        <div className="text-right">
          <div className="border-b border-slate-400 w-48 h-8 mb-1 ml-auto"></div>
          <span className="font-semibold block text-slate-700">Labor & Delivery Charge Nurse</span>
          <span className="text-slate-500">Date & Stamp: __________________</span>
        </div>
      </div>
    </div>
  );
};
