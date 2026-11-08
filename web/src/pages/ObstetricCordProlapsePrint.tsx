import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getObstetricCordProlapseEpisode,
  type ObstetricCordProlapseRecord,
  type ObstetricCordProlapseFlowsheetRecord,
} from '../api';

export const ObstetricCordProlapsePrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<ObstetricCordProlapseRecord | null>(null);
  const [logs, setLogs] = useState<ObstetricCordProlapseFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getObstetricCordProlapseEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div className="p-8 text-center text-sm">Generating emergency obstetric dossier...</div>;
  if (!episode) return <div className="p-8 text-center text-sm text-red-600">Episode not found.</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-gray-900 font-sans print:p-0">
      <div className="border-b-2 border-red-900 pb-4 mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-red-950">
            EMERGENCY UMBILICAL CORD PROLAPSE RESUSCITATION DOSSIER
          </h1>
          <p className="text-xs text-red-700 uppercase font-semibold mt-1">
            Department of Obstetrics & Gynecology • RCOG Green-top 50 Clinical Protocol
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono font-bold block text-red-900">{episode.episode_code}</span>
          <span className="text-xs text-gray-500">Date: {new Date(episode.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs mb-6 bg-red-50 p-4 rounded border border-red-200">
        <div>
          <p><span className="font-bold">Patient Name:</span> {episode.patient_name || `Patient #${episode.patient_id}`}</p>
          <p><span className="font-bold">Patient Number:</span> {episode.patient_number || 'N/A'}</p>
          <p><span className="font-bold">Gestational Age:</span> {episode.gestational_age_weeks} weeks</p>
        </div>
        <div>
          <p><span className="font-bold">Cervical Dilation:</span> {episode.cervical_dilation_cm} cm</p>
          <p><span className="font-bold">Detection Time:</span> {new Date(episode.detection_datetime).toLocaleString()}</p>
          <p><span className="font-bold">Consultant Obstetrician:</span> {episode.consultant_name || 'Dr. Ananya Rao'}</p>
        </div>
      </div>

      {evalResult && (
        <div className="mb-6 border border-red-300 p-4 rounded bg-red-50/50">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-950">
              Clinical Assessment: {evalResult.fetalHypoxiaRiskLabel}
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-600 text-white">
              Decompression Quality: {evalResult.decompressionQualityScore}/5
            </span>
          </div>
          <p className="text-xs mb-2 leading-relaxed">{evalResult.summary}</p>

          {evalResult.criticalActionPlan && evalResult.criticalActionPlan.length > 0 && (
            <div className="text-xs bg-white p-2.5 rounded border border-red-200">
              <span className="font-bold block text-red-900">Directives & Time-Critical Actions:</span>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-gray-800">
                {evalResult.criticalActionPlan.map((act: string, i: number) => (
                  <li key={i}>{act}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wider mb-2 text-gray-900 border-b pb-1">
          Decompression Interventions & Delivery Audit
        </h2>
        <div className="grid grid-cols-4 gap-3 text-xs bg-white p-3 rounded border border-gray-200">
          <div>
            <span className="text-gray-500 block">Baseline FHR</span>
            <span className="font-bold text-red-600">{episode.baseline_fhr_bpm} bpm</span>
          </div>
          <div>
            <span className="text-gray-500 block">Manual Elevation</span>
            <span className="font-bold">{episode.manual_elevation_performed ? 'Maintained Digital Elevation' : 'Not Maintained'}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Positioning</span>
            <span className="font-bold">{episode.maternal_positioning.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Delivery Mode / DDI</span>
            <span className="font-bold">{episode.delivery_mode.replace(/_/g, ' ')} ({episode.decision_to_delivery_minutes ? `${episode.decision_to_delivery_minutes} min` : 'N/A'})</span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wider mb-2 text-gray-900 border-b pb-1">
          Minute-by-Minute Decompression Flowsheet ({logs.length})
        </h2>
        {logs.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No flowsheet records logged.</p>
        ) : (
          <table className="w-full text-left text-xs border border-gray-300">
            <thead className="bg-gray-100 font-semibold">
              <tr>
                <th className="p-2 border">Elapsed</th>
                <th className="p-2 border">FHR (bpm)</th>
                <th className="p-2 border">Cord Pulsation</th>
                <th className="p-2 border">Elevation Status</th>
                <th className="p-2 border">Maternal BP</th>
                <th className="p-2 border">Notes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((lg) => (
                <tr key={lg.id} className="border-t">
                  <td className="p-2 border font-bold">{lg.minutes_from_detection} min</td>
                  <td className="p-2 border font-bold text-red-600">{lg.fetal_heart_rate_bpm} bpm</td>
                  <td className="p-2 border">{lg.cord_pulsation_palpable ? 'Palpable' : 'Absent'}</td>
                  <td className="p-2 border">{lg.manual_elevation_maintained ? 'Active' : 'Released'}</td>
                  <td className="p-2 border">{lg.maternal_blood_pressure_sys}/{lg.maternal_blood_pressure_dia}</td>
                  <td className="p-2 border text-gray-600">{lg.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-400 flex justify-between text-xs text-gray-600">
        <div>
          <p className="font-bold">Consultant Obstetrician Signature</p>
          <div className="h-10"></div>
          <p>______________________________________</p>
        </div>
        <div className="text-right">
          <p className="font-bold">Labor Ward Coordinator</p>
          <div className="h-10"></div>
          <p>______________________________________</p>
        </div>
      </div>
    </div>
  );
};
