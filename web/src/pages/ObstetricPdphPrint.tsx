import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getObstetricPdphEpisode, type ObstetricPdphRecord, type ObstetricPdphFlowsheetRecord } from '../api';

export const ObstetricPdphPrint: React.FC = () => {
  const { episodeId } = useParams<{ episodeId: string }>();
  const [episode, setEpisode] = useState<ObstetricPdphRecord | null>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [flowsheet, setFlowsheet] = useState<ObstetricPdphFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!episodeId) return;
    (async () => {
      try {
        const res = await getObstetricPdphEpisode(Number(episodeId));
        setEpisode(res.episode);
        setEvaluation(res.evaluation);
        setFlowsheet(res.flowsheet);
      } catch (err: any) {
        setError(err?.message || 'Failed to load PDPH episode dossier');
      } finally {
        setLoading(false);
      }
    })();
  }, [episodeId]);

  if (loading) return <div className="p-8 text-center text-sm">Generating PDPH Clinical Dossier...</div>;
  if (error || !episode) {
    return <div className="p-8 text-center text-red-600 text-sm">{error || 'Episode not found'}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-gray-900 text-xs font-sans print:p-0">
      {/* Header */}
      <div className="border-b-2 border-rose-800 pb-3 mb-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-rose-950">
            OBSTETRIC POSTDURAL PUNCTURE HEADACHE (PDPH) CLINICAL DOSSIER
          </h1>
          <p className="text-[11px] text-gray-600">
            Postural Cephalalgia Protocol &bull; Autologous Epidural Blood Patch (EBP) Stewardship &bull; OAA/SOAP Guidelines
          </p>
        </div>
        <div className="text-right">
          <span className="font-mono text-sm font-bold text-rose-950">{episode.episode_code}</span>
          <div className="text-[10px] text-gray-500">Printed: {new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Patient & Procedure Overview */}
      <div className="grid grid-cols-4 gap-2 bg-gray-50 p-3 rounded border mb-4">
        <div>
          <span className="text-gray-500 block text-[10px]">Patient Name</span>
          <span className="font-bold">{episode.patient_name || 'Patient'}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Puncture Procedure</span>
          <span className="font-semibold">{episode.procedure_type.replace(/_/g, ' ')} ({episode.needle_gauge})</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Puncture Date/Time</span>
          <span className="font-semibold">{new Date(episode.puncture_datetime).toLocaleString()}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Episode Status</span>
          <span className="font-bold text-rose-950 uppercase">{episode.status.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Primary Severity & EBP Strategy */}
      {evaluation && (
        <div className="border border-rose-200 bg-rose-50/50 p-4 rounded mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-rose-950">
              Headache Severity: VAS {episode.initial_vas_score} / 10 ({evaluation.severityTierLabel})
            </span>
            <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-rose-200 text-rose-900">
              EBP: {evaluation.ebpUrgency.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2 text-[11px]">
            <div>
              <span className="font-semibold text-gray-700 block">EBP Recommendation:</span>
              <p className="text-gray-800">{evaluation.recommendedEbpVolumeMl}</p>
              <div className="mt-1 text-gray-600">
                EBP Performed: {episode.ebp_performed ? `Yes (${episode.ebp_blood_volume_ml} mL at ${episode.ebp_interspace}) - Post VAS: ${episode.post_ebp_vas_score ?? '-'}/10` : 'No (Conservative)'}
              </div>
            </div>
            <div>
              <span className="font-semibold text-gray-700 block">Conservative Directives:</span>
              <p className="text-gray-800">
                Hydration target {episode.conservative_hydration_ml_24h} mL/day | Caffeine: {episode.caffeine_administered ? 'Administered' : 'Withheld'}
              </p>
              <p className="text-gray-600 mt-1">Analgesia: {episode.analgesics_prescribed || 'Standard'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Symptomatology & Red Flags */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border p-3 rounded bg-gray-50/50">
          <span className="font-bold text-gray-800 block mb-1">Cranial & Postural Features</span>
          <ul className="list-disc list-inside text-gray-700 space-y-0.5">
            <li>Postural orthostatic worsening: {episode.postural_component ? 'Confirmed' : 'Atypical'}</li>
            <li>Neck stiffness: {episode.neck_stiffness ? 'Present' : 'Absent'}</li>
            <li>Auditory symptoms (tinnitus/hypoacusia): {episode.auditory_symptoms ? 'Present' : 'None'}</li>
            <li>Visual symptoms / CN VI diplopia: {episode.visual_symptoms_diplopia ? 'Present' : 'None'}</li>
          </ul>
        </div>

        <div className="border p-3 rounded bg-gray-50/50">
          <span className="font-bold text-gray-800 block mb-1">Red Flag Differential Exclusions</span>
          {episode.red_flags_present ? (
            <div className="text-red-700 font-semibold">
              <span>⚠ Red flags identified: {episode.red_flag_notes || 'Rule out CVST / Meningitis / SDH'}</span>
            </div>
          ) : (
            <p className="text-gray-700">No atypical red flags detected. Pure postural intracranial hypotension profile.</p>
          )}
        </div>
      </div>

      {/* Flowsheet Table */}
      <div className="mb-4">
        <h3 className="font-bold text-gray-900 mb-2 border-b pb-1">
          Bedside Flowsheet Observations ({flowsheet.length})
        </h3>
        {flowsheet.length === 0 ? (
          <p className="text-gray-500 italic">No flowsheet entries recorded.</p>
        ) : (
          <table className="w-full text-left text-[11px] border-collapse border">
            <thead className="bg-gray-100 text-gray-700">
              <tr className="border-b">
                <th className="p-1.5 border-r">Date/Time</th>
                <th className="p-1.5 border-r">Posture</th>
                <th className="p-1.5 border-r">VAS</th>
                <th className="p-1.5 border-r">Lying Relief</th>
                <th className="p-1.5 border-r">BP</th>
                <th className="p-1.5 border-r">HR</th>
                <th className="p-1.5 border-r">Temp</th>
                <th className="p-1.5 border-r">Interventions</th>
                <th className="p-1.5">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-800">
              {flowsheet.map((f) => (
                <tr key={f.id}>
                  <td className="p-1.5 border-r">{new Date(f.log_datetime).toLocaleString()}</td>
                  <td className="p-1.5 border-r">{f.posture_assessed.replace(/_/g, ' ')}</td>
                  <td className="p-1.5 border-r font-bold text-rose-900">{f.vas_pain_score}</td>
                  <td className="p-1.5 border-r">{f.headache_relief_on_lying ? 'Yes' : 'No'}</td>
                  <td className="p-1.5 border-r">{f.blood_pressure_sys ? `${f.blood_pressure_sys}/${f.blood_pressure_dia}` : '-'}</td>
                  <td className="p-1.5 border-r">{f.heart_rate ?? '-'}</td>
                  <td className="p-1.5 border-r">{f.temperature_celsius ?? '-'}</td>
                  <td className="p-1.5 border-r">{f.interventions_given ?? '-'}</td>
                  <td className="p-1.5">{f.logged_by_name ?? 'Staff'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Signatures */}
      <div className="mt-8 pt-4 border-t border-gray-400 grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <span className="block text-gray-500">Attending Obstetric Anesthesiologist:</span>
          <span className="font-bold text-gray-800">{episode.consultant_name || 'Staff Anesthesiologist'}</span>
          <div className="mt-6 border-b border-gray-300 w-48"></div>
          <span className="text-[10px] text-gray-400">Signature & Stamp</span>
        </div>
        <div className="text-right">
          <span className="block text-gray-500">Document Generated:</span>
          <span>{new Date().toISOString()}</span>
        </div>
      </div>
    </div>
  );
};
