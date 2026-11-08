import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getNeonatalVolvulusEpisode,
  type NeonatalVolvulusRecord,
  type NeonatalVolvulusFlowsheetRecord,
} from '../api';
import { type NeonatalVolvulusEvaluationResult } from '../neonatalVolvulusEngine';

export const NeonatalVolvulusPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: NeonatalVolvulusRecord;
    evaluation: NeonatalVolvulusEvaluationResult;
    flowsheet: NeonatalVolvulusFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getNeonatalVolvulusEpisode(Number(id))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheet || res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load volvulus dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating Volvulus Clinical Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Neonatal Volvulus Episode not found.</div>;
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
          <h1 className="text-xl font-black uppercase tracking-wider text-red-900">
            Pediatric Surgery & Neonatal Intensive Care Unit (NICU)
          </h1>
          <p className="text-sm font-semibold text-slate-800">
            Neonatal Bilious Emesis & Malrotation with Midgut Volvulus Clinical Dossier
          </p>
          <p className="text-slate-500 text-[10px]">
            Reference: AAP Section on Surgery / Emergent Ladd Detorsion & Bowel Viability Protocol
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-bold text-red-700">{episode.episode_code}</div>
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
          <span className="font-bold">Day {episode.age_days} &middot; {episode.weight_kg} kg</span>
        </div>
        <div>
          <span className="text-slate-500 block">Onset Datetime:</span>
          <span className="font-bold">{new Date(episode.onset_datetime).toLocaleString()}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Attending Consultant:</span>
          <span className="font-bold">{episode.consultant_name || 'Pediatric Surgeon'}</span>
        </div>
      </div>

      {/* Urgency & Decision Tier */}
      <div className={`p-4 rounded border mb-4 ${
        evaluation.urgencyTier === 'immediate_operating_room_crash'
          ? 'bg-red-50 border-red-300'
          : evaluation.urgencyTier === 'emergent_imaging_workup'
          ? 'bg-amber-50 border-amber-300'
          : 'bg-green-50 border-green-300'
      }`}>
        <div className="flex justify-between items-center mb-1">
          <span className="font-black text-sm uppercase text-slate-900">{evaluation.urgencyTierLabel}</span>
          <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
            evaluation.laddProcedureIndicated ? 'bg-red-700 text-white' : 'bg-slate-200 text-slate-800'
          }`}>
            {evaluation.laddProcedureIndicated ? 'LADD PROCEDURE INDICATED' : 'STABLE OBSERVATION'}
          </span>
        </div>
        <p className="text-xs text-slate-700 mt-1">{evaluation.imagingRecommendation}</p>

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

      {/* Presentation & Imaging Breakdown */}
      <div className="border border-slate-200 rounded p-3 mb-4">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2 border-b pb-1">
          Clinical Signs, Labs & Fluoroscopic Findings
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500 block">Emesis Character:</span>
            <span className="font-bold capitalize">{episode.emesis_color.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Abdominal Distension:</span>
            <span className="font-bold capitalize">{episode.abdominal_distension.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Serum Lactate:</span>
            <span className="font-bold text-red-700">{episode.serum_lactate_mmol_l} mmol/L</span>
          </div>
          <div>
            <span className="text-slate-500 block">Blood Gas (pH / BE):</span>
            <span className="font-bold">{episode.blood_ph ?? '—'} / {episode.base_excess_meq_l ?? '—'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Plain Radiograph:</span>
            <span className="font-bold capitalize">{episode.plain_radiograph_finding.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Upper GI Contrast:</span>
            <span className="font-bold capitalize">{episode.upper_gi_finding ? episode.upper_gi_finding.replace(/_/g, ' ') : 'Not performed'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Doppler Whirlpool:</span>
            <span className="font-bold">{Boolean(episode.doppler_us_whirlpool_sign) ? 'Positive Sign (+)' : 'Negative'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">SMA/SMV Transposition:</span>
            <span className="font-bold">{Boolean(episode.doppler_sma_smv_inversion) ? 'Inverted Transposition' : 'Normal'}</span>
          </div>
        </div>
      </div>

      {/* Resuscitation Protocol */}
      {evaluation.resuscitationDirectives.length > 0 && (
        <div className="border border-blue-200 bg-blue-50/50 rounded p-3 mb-4">
          <h3 className="font-bold text-xs uppercase tracking-wider text-blue-900 mb-2">
            Standard Pre-Operative Resuscitation Protocol
          </h3>
          <ul className="list-disc list-inside space-y-1 text-slate-800 text-xs">
            {evaluation.resuscitationDirectives.map((dir, idx) => (
              <li key={idx}>{dir}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Flowsheet Log */}
      <div className="border border-slate-200 rounded p-3 mb-6">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2 border-b pb-1">
          Serial Flowsheet Checkpoints & Bowel Decompression Log
        </h3>
        {flowsheet.length === 0 ? (
          <p className="text-slate-500 italic py-2">No flowsheet checkpoints logged.</p>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 font-semibold text-slate-600">
                <th className="p-1.5">Hours</th>
                <th className="p-1.5">Lactate</th>
                <th className="p-1.5">HR / BP</th>
                <th className="p-1.5">Cap Refill</th>
                <th className="p-1.5">NG Output</th>
                <th className="p-1.5">Aspirate Notes</th>
                <th className="p-1.5">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-800">
              {flowsheet.map((l) => (
                <tr key={l.id}>
                  <td className="p-1.5 whitespace-nowrap font-medium">+{l.hours_from_onset}h</td>
                  <td className="p-1.5 font-bold text-red-700">{l.serum_lactate_mmol_l != null ? `${l.serum_lactate_mmol_l}` : '—'}</td>
                  <td className="p-1.5">{l.heart_rate} bpm &middot; {l.blood_pressure_sys ? `${l.blood_pressure_sys}/${l.blood_pressure_dia}` : '—'}</td>
                  <td className="p-1.5">{l.capillary_refill_seconds ? `${l.capillary_refill_seconds}s` : '—'}</td>
                  <td className="p-1.5">{l.ng_tube_output_ml != null ? `${l.ng_tube_output_ml} mL` : '—'}</td>
                  <td className="p-1.5 max-w-xs truncate">{l.ng_aspirate_appearance || l.notes || '—'}</td>
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
          <span className="font-semibold block text-slate-700">Attending Pediatric Surgeon</span>
          <span className="text-slate-500">Date & Stamp: __________________</span>
        </div>
        <div className="text-right">
          <div className="border-b border-slate-400 w-48 h-8 mb-1 ml-auto"></div>
          <span className="font-semibold block text-slate-700">Operating Room / NICU Team Lead</span>
          <span className="text-slate-500">Date & Stamp: __________________</span>
        </div>
      </div>
    </div>
  );
};
