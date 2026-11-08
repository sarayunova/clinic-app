import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getNeonatalChylothoraxEpisode,
  type NeonatalChylothoraxRecord,
  type NeonatalChylothoraxFlowsheetRecord,
} from '../api';

export const NeonatalChylothoraxPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<NeonatalChylothoraxRecord | null>(null);
  const [logs, setLogs] = useState<NeonatalChylothoraxFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getNeonatalChylothoraxEpisode(Number(id))
        .then((res) => {
          setEpisode(res.episode);
          setLogs(res.logs);
          setEvalResult(res.evalResult);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div className="p-8 text-center text-sm">Generating printable clinical dossier...</div>;
  if (!episode) return <div className="p-8 text-center text-sm text-red-600">Episode not found.</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-gray-900 font-sans print:p-0">
      <div className="border-b-2 border-gray-900 pb-4 mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-950">
            NEONATAL CHYLOTHORAX & OCTREOTIDE PROTOCOL DOSSIER
          </h1>
          <p className="text-xs text-gray-600 uppercase font-semibold mt-1">
            Department of Neonatology & Pediatric Pulmonology • BTS Pleural Guidelines
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono font-bold block">{episode.episode_code}</span>
          <span className="text-xs text-gray-500">Date: {new Date(episode.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs mb-6 bg-gray-50 p-4 rounded border border-gray-200">
        <div>
          <p><span className="font-bold">Patient Name:</span> {episode.patient_name || `Patient #${episode.patient_id}`}</p>
          <p><span className="font-bold">Patient Number:</span> {episode.patient_number || 'N/A'}</p>
          <p><span className="font-bold">Gestational Age:</span> {episode.gestational_age_weeks} weeks</p>
        </div>
        <div>
          <p><span className="font-bold">Weight:</span> {episode.current_weight_kg} kg (Birth: {episode.birth_weight_grams} g)</p>
          <p><span className="font-bold">Diagnosis Date:</span> {new Date(episode.diagnosis_datetime).toLocaleString()}</p>
          <p><span className="font-bold">Attending Consultant:</span> {episode.consultant_name || 'Dr. Anand Joshi'}</p>
        </div>
      </div>

      {evalResult && (
        <div className="mb-6 border border-gray-300 p-4 rounded bg-gray-50">
          <h2 className="text-sm font-bold uppercase tracking-wider mb-2 text-indigo-950">
            Clinical Assessment: {evalResult.drainageSeverityLabel}
          </h2>
          <p className="text-xs mb-2 leading-relaxed">{evalResult.summary}</p>

          {evalResult.diagnosticCriteriaMet && evalResult.diagnosticCriteriaMet.length > 0 && (
            <div className="mb-3 text-xs bg-white p-2.5 rounded border border-gray-200">
              <span className="font-bold block text-gray-800">Diagnostic Criteria Confirmed:</span>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-gray-700">
                {evalResult.diagnosticCriteriaMet.map((c: string, i: number) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

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
          Thoracostomy Drainage & Medical Management
        </h2>
        <div className="grid grid-cols-3 gap-3 text-xs bg-white p-3 rounded border border-gray-200">
          <div>
            <span className="text-gray-500 block">Initial 24h Drainage</span>
            <span className="font-bold">{episode.initial_24h_drainage_ml} mL ({episode.drainage_ml_kg_day} mL/kg/d)</span>
          </div>
          <div>
            <span className="text-gray-500 block">Dietary Protocol</span>
            <span className="font-bold">{episode.dietary_regimen.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Octreotide Regimen</span>
            <span className="font-bold">
              {episode.octreotide_prescribed ? `${episode.octreotide_current_dose_mcg_kg_hr} µg/kg/hr IV` : 'None'}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wider mb-2 text-gray-900 border-b pb-1">
          Serial Flowsheet Checkpoints ({logs.length})
        </h2>
        {logs.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No flowsheet records logged.</p>
        ) : (
          <table className="w-full text-left text-xs border border-gray-300">
            <thead className="bg-gray-100 font-semibold">
              <tr>
                <th className="p-2 border">Timestamp</th>
                <th className="p-2 border">Day</th>
                <th className="p-2 border">24h Drain</th>
                <th className="p-2 border">Rate (mL/kg/d)</th>
                <th className="p-2 border">Octreotide</th>
                <th className="p-2 border">Appearance</th>
                <th className="p-2 border">Notes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((lg) => (
                <tr key={lg.id} className="border-t">
                  <td className="p-2 border">{new Date(lg.log_datetime).toLocaleDateString()}</td>
                  <td className="p-2 border font-medium">Day {lg.days_from_diagnosis}</td>
                  <td className="p-2 border">{lg.drainage_24h_ml} mL</td>
                  <td className="p-2 border font-bold">{lg.drainage_ml_kg_day}</td>
                  <td className="p-2 border">{lg.octreotide_dose_mcg_kg_hr} µg/kg/h</td>
                  <td className="p-2 border">{lg.fluid_appearance.replace(/_/g, ' ')}</td>
                  <td className="p-2 border text-gray-600">{lg.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-400 flex justify-between text-xs text-gray-600">
        <div>
          <p className="font-bold">Attending Neonatologist Signature</p>
          <div className="h-10"></div>
          <p>______________________________________</p>
        </div>
        <div className="text-right">
          <p className="font-bold">Pediatric Surgical Liaison</p>
          <div className="h-10"></div>
          <p>______________________________________</p>
        </div>
      </div>
    </div>
  );
};
