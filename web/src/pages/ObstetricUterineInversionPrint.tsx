import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getObstetricUterineInversionEpisode,
  type ObstetricUterineInversionRecord,
  type ObstetricUterineInversionFlowsheetRecord,
} from '../api';

export const ObstetricUterineInversionPrint: React.FC = () => {
  const [searchParams] = useSearchParams();
  const idStr = searchParams.get('id');
  const id = idStr ? parseInt(idStr) : 0;

  const [episode, setEpisode] = useState<ObstetricUterineInversionRecord | null>(null);
  const [logs, setLogs] = useState<ObstetricUterineInversionFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getObstetricUterineInversionEpisode(id)
      .then((res) => {
        setEpisode(res.episode);
        setLogs(res.logs);
        setEvalResult(res.evalResult);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-sm">Loading printable clinical dossier...</div>;
  if (!episode) return <div className="p-8 text-center text-sm text-red-600">Episode not found.</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-gray-900 font-sans print:p-0">
      {/* Print Trigger Button */}
      <div className="mb-6 flex justify-between items-center print:hidden">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-rose-700 text-white font-semibold rounded shadow hover:bg-rose-800 text-sm"
        >
          Print Dossier / Save PDF
        </button>
        <span className="text-xs text-gray-500">Official Labor & Delivery Emergency Drill Record</span>
      </div>

      {/* Header */}
      <div className="border-b-2 border-rose-800 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-rose-950">
              Obstetric Acute Uterine Inversion Protocol Dossier
            </h1>
            <p className="text-xs text-gray-600 mt-1">
              Guidelines: RCOG Green-top 50 &bull; ACOG Practice Bulletin &bull; Johnson Manual Reduction Drill
            </p>
          </div>
          <div className="text-right text-xs">
            <span className="font-bold text-sm text-gray-900 block">{episode.episode_code}</span>
            <span className="text-gray-500">
              Date: {new Date(episode.occurrence_datetime).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Demographics & Presentation */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-xs bg-gray-50 p-4 rounded border border-gray-200">
        <div>
          <span className="text-gray-500 block">Patient Name</span>
          <strong className="text-sm text-gray-900">{episode.patient_name || `Patient #${episode.patient_id}`}</strong>
        </div>
        <div>
          <span className="text-gray-500 block">Parity & Delivery Mode</span>
          <strong className="text-sm text-gray-900 capitalize">
            Para {episode.parity} &bull; {episode.delivery_mode.replace(/_/g, ' ')}
          </strong>
        </div>
        <div>
          <span className="text-gray-500 block">Inversion Degree</span>
          <strong className="text-rose-900 text-sm capitalize">
            {episode.inversion_degree.replace(/_/g, ' ')}
          </strong>
        </div>
        <div>
          <span className="text-gray-500 block">Placental Attachment at Inversion</span>
          <strong className="capitalize">{episode.placental_status_at_inversion.replace(/_/g, ' ')}</strong>
        </div>
      </div>

      {/* Hemodynamics & Shock State */}
      <div className="mb-6">
        <h2 className="text-sm font-bold uppercase border-b border-gray-300 pb-1 mb-3 text-rose-950">
          Hemodynamic Presentation & Neurogenic Shock Assessment
        </h2>
        <div className="grid grid-cols-4 gap-3 text-xs">
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">Blood Pressure</span>
            <strong className="text-gray-900 text-sm">
              {episode.systolic_bp_at_presentation}/{episode.diastolic_bp_at_presentation} mmHg
            </strong>
          </div>
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">Heart Rate</span>
            <strong className="text-gray-900">{episode.heart_rate_at_presentation} bpm</strong>
          </div>
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">Obstetric Shock Index</span>
            <strong className="text-rose-700 text-sm">
              {evalResult ? evalResult.shockIndex : '-'}
            </strong>
          </div>
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">Estimated Blood Loss</span>
            <strong className="text-gray-900">{episode.estimated_blood_loss_ml} mL</strong>
          </div>
        </div>
      </div>

      {/* Emergent Reduction Protocol Execution */}
      <div className="mb-6">
        <h2 className="text-sm font-bold uppercase border-b border-gray-300 pb-1 mb-3 text-rose-950">
          Reduction Technique & Critical Safety Checklist
        </h2>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">Primary Reduction Technique</span>
            <strong className="text-gray-900 capitalize">
              {episode.reduction_technique_primary.replace(/_/g, ' ')}
            </strong>
          </div>
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">Uterine Relaxant Tocolytic</span>
            <strong className="text-purple-900 capitalize">
              {episode.uterine_relaxant_agent.replace(/_/g, ' ')}
            </strong>
          </div>
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">Reinversion Outcome</span>
            <strong className={episode.reinversion_successful === 1 ? 'text-emerald-800' : 'text-red-700'}>
              {episode.reinversion_successful === 1
                ? `Reinversion Achieved (${episode.time_to_reinversion_minutes ?? '-'} min)`
                : 'Refractory / Unresolved'}
            </strong>
          </div>
        </div>

        <div className="mt-3 p-3 bg-gray-50 rounded border text-xs grid grid-cols-2 gap-2">
          <div>
            Uterotonics Withheld Prior to Reinversion:{' '}
            <strong>{episode.uterotonic_given_before_replacement === 0 ? 'Yes (Compliant)' : 'No (Breach)'}</strong>
          </div>
          <div>
            Placenta Kept In Situ Until Reinversion:{' '}
            <strong>{episode.placenta_removed_before_reinversion === 0 ? 'Yes (Compliant)' : 'No (Breach)'}</strong>
          </div>
          <div>
            Post-Replacement High-Dose Oxytocin Infused:{' '}
            <strong>{episode.post_replacement_uterotonics_started === 1 ? 'Yes' : 'No'}</strong>
          </div>
          <div>
            Internal Bimanual Compression Maintained:{' '}
            <strong>{episode.bimanual_uterine_compression_maintained === 1 ? 'Yes' : 'No'}</strong>
          </div>
        </div>
      </div>

      {/* Protocol Directives */}
      {evalResult && (
        <div className="mb-6 bg-rose-50 p-4 rounded border border-rose-200 text-xs space-y-2">
          <strong className="text-rose-950 uppercase block font-bold">
            Step-by-Step Clinical Action Directives:
          </strong>
          {evalResult.stepByStepProtocolPlan.map((step: string, idx: number) => (
            <div key={idx} className="flex gap-2 text-rose-950">
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}

      {/* Flowsheet Table */}
      <div className="mb-8">
        <h2 className="text-sm font-bold uppercase border-b border-gray-300 pb-1 mb-3 text-rose-950">
          Post-Reinversion Hemodynamics & Myometrial Tone Log
        </h2>
        {logs.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No flowsheet logs recorded.</p>
        ) : (
          <table className="w-full text-xs text-left border border-collapse">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="py-2 px-2 border">Timestamp</th>
                <th className="py-2 px-2 border">BP (mmHg)</th>
                <th className="py-2 px-2 border">HR (bpm)</th>
                <th className="py-2 px-2 border">Uterine Tone</th>
                <th className="py-2 px-2 border">Bimanual Active</th>
                <th className="py-2 px-2 border">Ongoing Loss</th>
                <th className="py-2 px-2 border">Notes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((lg) => (
                <tr key={lg.id} className="border-b">
                  <td className="py-1.5 px-2 border whitespace-nowrap">
                    {new Date(lg.log_datetime).toLocaleString()} (+{lg.minutes_from_inversion}m)
                  </td>
                  <td className="py-1.5 px-2 border">
                    {lg.systolic_bp}/{lg.diastolic_bp}
                  </td>
                  <td className="py-1.5 px-2 border">{lg.heart_rate_bpm}</td>
                  <td className="py-1.5 px-2 border capitalize font-semibold">
                    {lg.uterine_tone.replace(/_/g, ' ')}
                  </td>
                  <td className="py-1.5 px-2 border">
                    {lg.bimanual_compression_active === 1 ? 'Yes' : 'No'}
                  </td>
                  <td className="py-1.5 px-2 border">{lg.estimated_ongoing_blood_loss_ml} mL</td>
                  <td className="py-1.5 px-2 border">{lg.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-12 pt-8 border-t border-gray-300 text-xs">
        <div>
          <span className="text-gray-500 block mb-8">Consultant Obstetrician / Surgeon:</span>
          <div className="border-b border-gray-400 w-3/4 mb-1"></div>
          <strong>{episode.consultant_name || 'Dr. Anita Desai, MS (Obstetrics & Gynecology)'}</strong>
        </div>
        <div>
          <span className="text-gray-500 block mb-8">Labor Ward Senior Sister:</span>
          <div className="border-b border-gray-400 w-3/4 mb-1"></div>
          <strong>Staff Signature & Date</strong>
        </div>
      </div>
    </div>
  );
};
