import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getObstetricSptEpisode,
  type ObstetricSptRecord,
  type ObstetricSptFlowsheetRecord,
} from '../api';
import { type ObstetricSptEvaluationResult } from '../obstetricSptEngine';

export const ObstetricSptPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: ObstetricSptRecord;
    evaluation: ObstetricSptEvaluationResult;
    flowsheet: ObstetricSptFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getObstetricSptEpisode(Number(id))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load obstetric SPT dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating Septic Pelvic Thrombophlebitis Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Obstetric SPT Record not found.</div>;
  }

  const { episode, evaluation, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0 print:max-w-none text-xs leading-normal">
      {/* Print Trigger Button */}
      <div className="flex justify-end mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-800"
        >
          Print Dossier 🖨
        </button>
      </div>

      {/* Hospital Header */}
      <div className="border-b-2 border-red-800 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black text-red-900 uppercase tracking-tight">
            Maternal-Fetal Medicine &amp; High-Risk Obstetrics
          </h1>
          <p className="text-xs font-semibold text-slate-600">
            Obstetric Septic Pelvic Thrombophlebitis (SPT) &amp; Heparin Challenge Protocol
          </p>
          <p className="text-[10px] text-slate-500">
            Reference: ACOG Practice Bulletin / SMFM Consults / CDC Postpartum Guidelines
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
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Patient Name</span>
          <span className="font-bold text-slate-900">{episode.patient_name || `Patient #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Delivery Details</span>
          <span className="font-semibold">{episode.delivery_mode.replace(/_/g, ' ')} • PPD {episode.postpartum_day}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Phenotype &amp; Territory</span>
          <span className="font-semibold">{episode.spt_phenotype.replace(/_/g, ' ')} ({episode.affected_vein.replace(/_/g, ' ')})</span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Consultant</span>
          <span className="font-semibold">{episode.consultant_name || 'Attending Obstetrician'}</span>
        </div>
      </div>

      {/* Diagnostic Likelihood & Challenge Result */}
      <div className="p-3 bg-slate-50 rounded border border-slate-200 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold text-slate-900 text-sm">Diagnostic Classification</span>
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-900">
            {evaluation.urgencyTierLabel}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-2 text-slate-700">
          <div><strong>Peak Temp:</strong> {episode.peak_temperature_celsius}°C ({episode.hours_refractory_triple_antibiotics}h on triple IV Abx)</div>
          <div><strong>Pelvic Imaging:</strong> {episode.pelvic_ct_mri_findings.replace(/_/g, ' ')}</div>
          <div><strong>Heparin Response:</strong> {episode.heparin_challenge_response.replace(/_/g, ' ')}</div>
        </div>

        <div className="mt-1 text-slate-600">
          <strong>Heparin Challenge Interpretation:</strong> {evaluation.heparinChallengeInterpretation}
        </div>

        <div className="mt-1 text-slate-600">
          <strong>Recommended Anticoagulation Duration:</strong> {evaluation.recommendedAnticoagulationDuration}
        </div>

        {evaluation.alerts.length > 0 && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-800">
            <strong>Safety Alerts:</strong>
            <ul className="list-disc pl-4 mt-1 space-y-0.5">
              {evaluation.alerts.map((al, idx) => (
                <li key={idx}>{al}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Protocol Directives */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 border border-slate-200 rounded">
          <h3 className="font-bold text-red-900 mb-1">Anticoagulation Dosing Directives</h3>
          <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11px]">
            {evaluation.heparinDosingDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>

        <div className="p-3 border border-slate-200 rounded">
          <h3 className="font-bold text-red-900 mb-1">Broad-Spectrum Antimicrobial Directives</h3>
          <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11px]">
            {evaluation.antimicrobialDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Flowsheet Log Checkpoints Table */}
      <div className="border border-slate-200 rounded overflow-hidden mb-4">
        <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-800">
          Heparin Titration &amp; Defervescence Surveillance Log
        </div>
        <table className="w-full text-left text-[10px] divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-1">Hours</th>
              <th className="px-2 py-1">Time</th>
              <th className="px-2 py-1">Temp (°C)</th>
              <th className="px-2 py-1">HR</th>
              <th className="px-2 py-1">BP</th>
              <th className="px-2 py-1">aPTT</th>
              <th className="px-2 py-1">Heparin Rate</th>
              <th className="px-2 py-1">Pain (0-10)</th>
              <th className="px-2 py-1">Bleeding</th>
              <th className="px-2 py-1">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {flowsheet.map((l) => (
              <tr key={l.id}>
                <td className="px-2 py-1 font-semibold">{l.hours_since_heparin_start} hrs</td>
                <td className="px-2 py-1">{new Date(l.log_datetime).toLocaleDateString()} {new Date(l.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-2 py-1 font-semibold text-red-600">{l.temperature_celsius}°C</td>
                <td className="px-2 py-1">{l.heart_rate} bpm</td>
                <td className="px-2 py-1">{l.systolic_bp}/{l.diastolic_bp} mmHg</td>
                <td className="px-2 py-1 font-semibold">{l.aptt_seconds ? `${l.aptt_seconds}s` : '—'}</td>
                <td className="px-2 py-1">{l.heparin_infusion_rate_units_hr ? `${l.heparin_infusion_rate_units_hr} U/h` : '—'}</td>
                <td className="px-2 py-1">{l.flank_abdominal_pain_score} / 10</td>
                <td className="px-2 py-1">{l.bleeding_signs.replace(/_/g, ' ')}</td>
                <td className="px-2 py-1 text-slate-500">{l.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Signature Section */}
      <div className="pt-6 mt-6 border-t border-slate-300 flex justify-between items-end text-[10px] text-slate-500">
        <div>
          <div>Consultant: {episode.consultant_name || 'Attending Obstetrician'}</div>
          <div>Division of Maternal-Fetal Medicine</div>
        </div>
        <div className="text-right">
          <div className="border-b border-slate-400 w-48 mb-1"></div>
          <div>Authorized Signature &amp; Stamp</div>
        </div>
      </div>
    </div>
  );
};
