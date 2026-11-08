import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getNeonatalEaTefEpisode,
  type NeonatalEaTefRecord,
  type NeonatalEaTefFlowsheetRecord,
} from '../api';
import { type NeonatalEaTefEvaluationResult } from '../neonatalEaTefEngine';

export const NeonatalEaTefPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: NeonatalEaTefRecord;
    evaluation: NeonatalEaTefEvaluationResult;
    flowsheet: NeonatalEaTefFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getNeonatalEaTefEpisode(Number(id))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load EA/TEF dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating EA/TEF Clinical Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Neonatal EA/TEF Episode not found.</div>;
  }

  const { episode, evaluation, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0 print:max-w-none text-xs leading-normal">
      {/* Print Trigger Button */}
      <div className="flex justify-end mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-cyan-800"
        >
          Print Dossier 🖨
        </button>
      </div>

      {/* Hospital Header */}
      <div className="border-b-2 border-cyan-800 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black text-cyan-900 uppercase tracking-tight">
            Neonatal Intensive Care & Pediatric Surgery Division
          </h1>
          <p className="text-xs font-semibold text-slate-600">
            Neonatal Esophageal Atresia & Tracheoesophageal Fistula (EA/TEF) Protocol
          </p>
          <p className="text-[10px] text-slate-500">
            Reference: AAP Section on Surgery / BAPS / ESPGHAN-NASPGHAN Consensus
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-black text-slate-800">{episode.episode_code}</div>
          <div className="text-[10px] text-slate-500">
            Generated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Patient & Episode Summary Card */}
      <div className="grid grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200 mb-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Patient Name</span>
          <span className="font-bold text-slate-900">{episode.patient_name || `Patient #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Age / Weight</span>
          <span className="font-semibold">{episode.age_hours} hrs • {episode.weight_kg} kg</span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Gross Classification</span>
          <span className="font-semibold text-cyan-800 capitalize">
            {episode.gross_classification_type.replace(/_/g, ' ')}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Status</span>
          <span className="font-semibold uppercase text-slate-800">
            {episode.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Clinical Urgency & Protocol Directives */}
      <div className="border border-slate-200 rounded p-4 mb-4 bg-slate-50/50">
        <div className="flex justify-between items-center mb-2 border-b pb-2">
          <h2 className="text-sm font-black uppercase text-cyan-900">
            Clinical Decision Engine & Anatomical Lateralization
          </h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white border border-slate-300">
            {evaluation.urgencyTierLabel}
          </span>
        </div>

        <p className="text-xs mb-2 text-slate-700">{evaluation.grossTypeDescription}</p>

        <div className="p-2 bg-white rounded border border-cyan-300 text-xs font-semibold mb-2 text-cyan-900">
          SURGICAL INCISION LATERALIZATION: {evaluation.surgicalThoracotomySideLabel}
        </div>

        {evaluation.alerts.length > 0 && (
          <div className="mb-3 space-y-1">
            {evaluation.alerts.map((al, idx) => (
              <div key={idx} className="text-xs font-semibold text-red-700 flex items-start gap-1">
                <span>⚠️</span>
                <span>{al}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-3">
          <div className="bg-white p-2.5 rounded border border-slate-200">
            <h3 className="font-bold text-[11px] uppercase text-slate-700 mb-1">
              Replogle Double-Lumen Sump Directives
            </h3>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700">
              {evaluation.replogleProtocolDirectives.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
          <div className="bg-white p-2.5 rounded border border-slate-200">
            <h3 className="font-bold text-[11px] uppercase text-slate-700 mb-1">
              Airway & Ventilation Directives
            </h3>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700">
              {evaluation.preoperativeAirwayDirectives.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* VACTERL Workup Details */}
      <div className="border border-slate-200 rounded p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-black uppercase text-amber-900">
            VACTERL Association Multi-System Screening
          </h2>
          <span className="text-xs font-bold text-amber-800">
            Score: {evaluation.vacterlFeatureCount} / 6 Identified
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {evaluation.vacterlDefectsIdentified.map((def, idx) => (
            <div key={idx} className="p-2 bg-amber-50 rounded border border-amber-200 font-medium">
              ✓ {def}
            </div>
          ))}
        </div>
      </div>

      {/* Flowsheet Log Table */}
      <div className="border border-slate-200 rounded p-4 mb-4">
        <h2 className="text-sm font-black uppercase text-slate-800 mb-2">
          Replogle Sump Suction & Airway Decompression Flowsheet
        </h2>
        {flowsheet.length === 0 ? (
          <p className="text-slate-400 italic">No flowsheet entries recorded.</p>
        ) : (
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100 font-bold text-slate-700">
                <th className="py-1.5 px-2">Time</th>
                <th className="py-1.5 px-2">Hours</th>
                <th className="py-1.5 px-2">Flushed</th>
                <th className="py-1.5 px-2">Aspirate</th>
                <th className="py-1.5 px-2">Character</th>
                <th className="py-1.5 px-2">HR / RR</th>
                <th className="py-1.5 px-2">SpO2</th>
                <th className="py-1.5 px-2">Girth</th>
                <th className="py-1.5 px-2">Logged By</th>
              </tr>
            </thead>
            <tbody>
              {flowsheet.map((l) => (
                <tr key={l.id} className="border-b border-slate-200">
                  <td className="py-1.5 px-2 font-mono">{l.log_datetime.replace('T', ' ')}</td>
                  <td className="py-1.5 px-2">{l.hours_from_admission}h</td>
                  <td className="py-1.5 px-2">{l.replogle_saline_flushed ? 'Yes' : 'No'}</td>
                  <td className="py-1.5 px-2 font-semibold text-cyan-800">
                    {l.replogle_aspirate_volume_ml !== null ? `${l.replogle_aspirate_volume_ml} mL` : '—'}
                  </td>
                  <td className="py-1.5 px-2 capitalize">{l.replogle_aspirate_character.replace(/_/g, ' ')}</td>
                  <td className="py-1.5 px-2">{l.heart_rate} / {l.respiratory_rate}</td>
                  <td className="py-1.5 px-2">{l.oxygen_saturation_pct}%</td>
                  <td className="py-1.5 px-2">{l.abdominal_girth_cm ? `${l.abdominal_girth_cm} cm` : '—'}</td>
                  <td className="py-1.5 px-2 text-slate-500">{l.logged_by_name || `User #${l.logged_by_id}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Clinical Sign-off */}
      <div className="border-t-2 border-slate-300 pt-4 mt-8 flex justify-between items-end text-xs">
        <div>
          <p className="font-semibold">Consultant Pediatric Surgeon / Neonatologist</p>
          <p className="text-slate-500">{episode.consultant_name || `User #${episode.consultant_id}`}</p>
        </div>
        <div className="text-right">
          <div className="w-48 border-b border-slate-400 mb-1"></div>
          <p className="text-slate-500">Attending Signature & Date</p>
        </div>
      </div>
    </div>
  );
};
