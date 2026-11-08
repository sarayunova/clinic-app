import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPediatricIntussusceptionEpisode,
  type PediatricIntussusceptionRecord,
  type PediatricIntussusceptionFlowsheetRecord,
} from '../api';

export const PediatricIntussusceptionPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<PediatricIntussusceptionRecord | null>(null);
  const [logs, setLogs] = useState<PediatricIntussusceptionFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getPediatricIntussusceptionEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div className="p-8 text-center text-sm">Generating pediatric dossier...</div>;
  if (!episode) return <div className="p-8 text-center text-sm text-red-600">Episode not found.</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-gray-900 font-sans print:p-0">
      <div className="border-b-2 border-gray-900 pb-4 mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-950">
            PEDIATRIC INTUSSUSCEPTION & REDUCTION DOSSIER
          </h1>
          <p className="text-xs text-gray-600 uppercase font-semibold mt-1">
            Department of Pediatric Surgery & Radiology • ACR Appropriateness Criteria
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono font-bold block">{episode.episode_code}</span>
          <span className="text-xs text-gray-500">Date: {new Date(episode.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs mb-6 bg-gray-50 p-4 rounded border border-gray-200">
        <div>
          <p><span className="font-bold">Child Name:</span> {episode.patient_name || `Patient #${episode.patient_id}`}</p>
          <p><span className="font-bold">Patient Number:</span> {episode.patient_number || 'N/A'}</p>
          <p><span className="font-bold">Age:</span> {episode.age_months} months • <span className="font-bold">Weight:</span> {episode.weight_kg} kg</p>
        </div>
        <div>
          <p><span className="font-bold">Symptom Duration:</span> {episode.symptom_duration_hours} hours</p>
          <p><span className="font-bold">Presentation Date:</span> {new Date(episode.presentation_datetime).toLocaleString()}</p>
          <p><span className="font-bold">Attending Consultant:</span> {episode.consultant_name || 'Dr. Vivek Saxena'}</p>
        </div>
      </div>

      {evalResult && (
        <div className="mb-6 border border-gray-300 p-4 rounded bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-950">
              Clinical Assessment: {evalResult.intussusceptionDiagnosed ? 'Ultrasound Confirmed Intussusception' : 'Suspected Intussusception'}
            </h2>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${episode.reduction_successful ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
              {episode.reduction_successful ? 'Reduction Successful' : 'Reduction Incomplete / Surgical'}
            </span>
          </div>
          <p className="text-xs mb-2 leading-relaxed">{evalResult.summary}</p>

          {evalResult.criticalActionPlan && evalResult.criticalActionPlan.length > 0 && (
            <div className="text-xs bg-white p-2.5 rounded border border-gray-200">
              <span className="font-bold block text-gray-800">Directives & Action Plan:</span>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-gray-700">
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
          Enema Reduction Procedure Parameters
        </h2>
        <div className="grid grid-cols-4 gap-3 text-xs bg-white p-3 rounded border border-gray-200">
          <div>
            <span className="text-gray-500 block">Reduction Method</span>
            <span className="font-bold">{episode.reduction_method.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Max Pressure</span>
            <span className="font-bold">{episode.maximum_pressure_mmhg} mmHg</span>
          </div>
          <div>
            <span className="text-gray-500 block">Attempts / Reflux</span>
            <span className="font-bold">{episode.reduction_attempts_count} attempt(s) • {episode.cecal_ileal_reflux_visualized ? 'Ileal Reflux Present' : 'No Reflux'}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Lead Point</span>
            <span className="font-bold">{episode.lead_point_type.replace(/_/g, ' ')}</span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wider mb-2 text-gray-900 border-b pb-1">
          Post-Reduction Surveillance Flowsheet ({logs.length})
        </h2>
        {logs.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No flowsheet records logged.</p>
        ) : (
          <table className="w-full text-left text-xs border border-gray-300">
            <thead className="bg-gray-100 font-semibold">
              <tr>
                <th className="p-2 border">Elapsed</th>
                <th className="p-2 border">HR (bpm)</th>
                <th className="p-2 border">BP (mmHg)</th>
                <th className="p-2 border">Abdomen Exam</th>
                <th className="p-2 border">Colic Recurrence</th>
                <th className="p-2 border">Oral Feeding</th>
                <th className="p-2 border">Notes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((lg) => (
                <tr key={lg.id} className="border-t">
                  <td className="p-2 border font-bold">{lg.minutes_from_procedure} min</td>
                  <td className="p-2 border">{lg.heart_rate_bpm}</td>
                  <td className="p-2 border">{lg.blood_pressure_sys}/{lg.blood_pressure_dia}</td>
                  <td className="p-2 border">{lg.abdominal_soft_non_tender ? 'Soft, Non-tender' : 'Guarding'}</td>
                  <td className="p-2 border">{lg.colicky_pain_recurrence ? 'Recurred' : 'None'}</td>
                  <td className="p-2 border">{lg.oral_intake_tolerated ? 'Tolerated' : 'NPO'}</td>
                  <td className="p-2 border text-gray-600">{lg.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-400 flex justify-between text-xs text-gray-600">
        <div>
          <p className="font-bold">Attending Pediatric Surgeon</p>
          <div className="h-10"></div>
          <p>______________________________________</p>
        </div>
        <div className="text-right">
          <p className="font-bold">Pediatric Radiologist</p>
          <div className="h-10"></div>
          <p>______________________________________</p>
        </div>
      </div>
    </div>
  );
};
