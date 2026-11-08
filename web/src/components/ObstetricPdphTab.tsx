import React, { useState, useEffect } from 'react';
import {
  getObstetricPdphEpisodes,
  getObstetricPdphEpisode,
  updateObstetricPdphStatus,
  deleteObstetricPdphFlowsheet,
  type ObstetricPdphRecord,
  type ObstetricPdphFlowsheetRecord,
} from '../api';
import { ObstetricPdphModal } from './ObstetricPdphModal';
import { ObstetricPdphFlowsheetModal } from './ObstetricPdphFlowsheetModal';

interface Props {
  patientId: number;
}

export const ObstetricPdphTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<ObstetricPdphRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<ObstetricPdphRecord | null>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [flowsheet, setFlowsheet] = useState<ObstetricPdphFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFlowsheetModalOpen, setIsFlowsheetModalOpen] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getObstetricPdphEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        const firstId = res.episodes[0].id;
        setSelectedEpisodeId(firstId);
        await loadEpisodeDetails(firstId);
      } else {
        setSelectedEpisodeId(null);
        setSelectedEpisode(null);
        setEvaluation(null);
        setFlowsheet([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load obstetric PDPH records');
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getObstetricPdphEpisode(id);
      setSelectedEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheet);
    } catch (err: any) {
      setError(err?.message || 'Failed to load episode details');
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [patientId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisodeId) return;
    try {
      await updateObstetricPdphStatus(selectedEpisodeId, { status: newStatus });
      await loadEpisodeDetails(selectedEpisodeId);
      const res = await getObstetricPdphEpisodes({ patientId });
      setEpisodes(res.episodes);
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisodeId || !window.confirm('Delete this PDPH observation log?')) return;
    try {
      await deleteObstetricPdphFlowsheet(selectedEpisodeId, logId);
      await loadEpisodeDetails(selectedEpisodeId);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  if (loading && !selectedEpisode) {
    return <div className="p-6 text-center text-sm text-gray-500">Loading Obstetric PDPH data...</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Header Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border flex-wrap gap-2">
        <div className="flex items-center space-x-3">
          <h3 className="text-base font-bold text-gray-800">
            Obstetric Postdural Puncture Headache (PDPH) & Epidural Blood Patch (EBP)
          </h3>
          {episodes.length > 1 && (
            <select
              value={selectedEpisodeId ?? ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                setSelectedEpisodeId(id);
                loadEpisodeDetails(id);
              }}
              className="text-xs border rounded p-1"
            >
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.episode_code} ({ep.status})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {selectedEpisode && (
            <a
              href={`/patients/${patientId}/obstetric-pdph/${selectedEpisode.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 border border-rose-600 text-rose-700 text-xs font-semibold rounded hover:bg-rose-50"
            >
              Print Dossier
            </a>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded hover:bg-rose-700"
          >
            + New PDPH Episode
          </button>
        </div>
      </div>

      {!selectedEpisode ? (
        <div className="bg-white p-8 rounded-lg border text-center text-gray-500">
          <p className="text-sm">No postdural puncture headache episodes logged for this patient.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-3 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded hover:bg-rose-700"
          >
            Initiate PDPH Assessment
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Episode Diagnostic Summary */}
          <div className="bg-white p-5 rounded-lg border shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3 flex-wrap gap-2">
              <div>
                <span className="text-xs font-semibold text-gray-500">Episode:</span>
                <span className="ml-1 text-sm font-bold text-rose-950">{selectedEpisode.episode_code}</span>
                <span className="ml-3 text-xs text-gray-500">
                  Onset: {new Date(selectedEpisode.headache_onset_datetime).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-gray-500">Status:</span>
                <select
                  value={selectedEpisode.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="text-xs font-bold border rounded px-2 py-1 bg-gray-50 text-rose-950"
                >
                  <option value="conservative_management">Conservative Management</option>
                  <option value="ebp_scheduled">EBP Scheduled</option>
                  <option value="ebp_completed_resolving">EBP Completed / Resolving</option>
                  <option value="headache_resolved">Headache Resolved</option>
                  <option value="referred_neurology_imaging">Referred for Neuroimaging</option>
                </select>
              </div>
            </div>

            {/* Score & Urgency Display */}
            {evaluation && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-rose-50/60 p-4 rounded border border-rose-200">
                <div>
                  <div className="text-xs text-rose-800 font-semibold uppercase">Initial Pain Severity</div>
                  <div className="text-3xl font-extrabold text-rose-950 mt-1">
                    VAS {selectedEpisode.initial_vas_score} / 10
                  </div>
                  <div className="text-xs font-bold text-rose-800 mt-1">
                    {evaluation.severityTierLabel}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-rose-800 font-semibold uppercase">EBP Urgency Recommendation</div>
                  <div className="text-lg font-extrabold text-gray-800 mt-1 uppercase">
                    {evaluation.ebpUrgency.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Patch Volume: {evaluation.recommendedEbpVolumeMl}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-rose-800 font-semibold uppercase">EBP Procedure Status</div>
                  <div className="text-sm font-bold mt-1">
                    {selectedEpisode.ebp_performed ? (
                      <span className="text-emerald-700">
                        Performed ({selectedEpisode.ebp_blood_volume_ml} mL at {selectedEpisode.ebp_interspace || 'lumbar'})
                        {selectedEpisode.post_ebp_vas_score !== null && ` - Post VAS: ${selectedEpisode.post_ebp_vas_score}/10`}
                      </span>
                    ) : (
                      <span className="text-amber-700">Not Performed (Conservative Stage)</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Hydration Target: {selectedEpisode.conservative_hydration_ml_24h} mL/24h | Caffeine: {selectedEpisode.caffeine_administered ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>
            )}

            {/* Clinical & Red Flag Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="border rounded p-3 bg-gray-50">
                <span className="font-bold text-gray-700 block mb-1">Index Procedure & Puncture:</span>
                <p className="text-gray-800">
                  {selectedEpisode.procedure_type.replace(/_/g, ' ')} using {selectedEpisode.needle_gauge.replace(/_/g, ' ')}
                </p>
                <div className="mt-2 text-gray-600">
                  <span>Puncture Timestamp: {new Date(selectedEpisode.puncture_datetime).toLocaleString()}</span>
                  <br />
                  <span>Analgesics: {selectedEpisode.analgesics_prescribed || 'Standard multimodal'}</span>
                </div>
              </div>

              <div className="border rounded p-3 bg-gray-50">
                <span className="font-bold text-gray-700 block mb-1">Cranial Nerve & Orthostatic Findings:</span>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li>Postural component: {selectedEpisode.postural_component ? 'Confirmed (worse upright)' : 'Atypical (non-postural)'}</li>
                  <li>Neck stiffness: {selectedEpisode.neck_stiffness ? 'Present' : 'Absent'}</li>
                  <li>Auditory symptoms: {selectedEpisode.auditory_symptoms ? 'Present (tinnitus/hypoacusia)' : 'None'}</li>
                  <li>Visual/Diplopia: {selectedEpisode.visual_symptoms_diplopia ? 'Present (CN VI palsy)' : 'None'}</li>
                </ul>
              </div>
            </div>

            {/* Red Flag Alerts */}
            {evaluation?.redFlagWarnings?.length > 0 && (
              <div className="bg-red-50 border border-red-300 rounded p-3 text-xs space-y-1">
                <span className="font-bold text-red-900 block">Critical Red Flag Exclusion:</span>
                {evaluation.redFlagWarnings.map((rf: string, idx: number) => (
                  <div key={idx} className="text-red-800 flex items-center gap-1 font-semibold">
                    <span>⚠</span> {rf}
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {evaluation?.proceduralRecommendations?.length > 0 && (
              <div className="bg-rose-50/70 border border-rose-200 rounded p-3 text-xs space-y-1">
                <span className="font-bold text-rose-950 block">Procedural Directives:</span>
                <ul className="list-disc list-inside space-y-1 text-rose-900">
                  {evaluation.proceduralRecommendations.map((rec: string, i: number) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Flowsheet Table */}
          <div className="bg-white p-5 rounded-lg border shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-gray-800">
                Serial Bedside PDPH Flowsheet ({flowsheet.length} logs)
              </h4>
              <button
                onClick={() => setIsFlowsheetModalOpen(true)}
                className="px-3 py-1 bg-rose-600 text-white text-xs font-semibold rounded hover:bg-rose-700"
              >
                + Add Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <p className="text-xs text-gray-500 py-3 text-center border rounded">
                No flowsheet entries recorded yet. Track posture, pain score, and relief on lying above.
              </p>
            ) : (
              <div className="overflow-x-auto border rounded">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-gray-100 text-gray-700 border-b">
                    <tr>
                      <th className="p-2">Timestamp</th>
                      <th className="p-2">Posture Assessed</th>
                      <th className="p-2">VAS (0-10)</th>
                      <th className="p-2">Lying Relief</th>
                      <th className="p-2">BP (mmHg)</th>
                      <th className="p-2">HR (bpm)</th>
                      <th className="p-2">Temp (°C)</th>
                      <th className="p-2">Interventions</th>
                      <th className="p-2">Staff</th>
                      <th className="p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-gray-800">
                    {flowsheet.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="p-2 whitespace-nowrap">{new Date(log.log_datetime).toLocaleString()}</td>
                        <td className="p-2 font-medium">{log.posture_assessed.replace(/_/g, ' ')}</td>
                        <td className="p-2 font-bold text-rose-900">{log.vas_pain_score}</td>
                        <td className="p-2">{log.headache_relief_on_lying ? 'Yes' : 'No'}</td>
                        <td className="p-2">{log.blood_pressure_sys ? `${log.blood_pressure_sys}/${log.blood_pressure_dia}` : '-'}</td>
                        <td className="p-2">{log.heart_rate ?? '-'}</td>
                        <td className="p-2">{log.temperature_celsius ?? '-'}</td>
                        <td className="p-2">{log.interventions_given ?? '-'}</td>
                        <td className="p-2 text-gray-600">{log.logged_by_name ?? 'Staff'}</td>
                        <td className="p-2">
                          <button
                            onClick={() => handleDeleteFlowsheet(log.id)}
                            className="text-red-600 hover:text-red-800 font-semibold"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <ObstetricPdphModal
        patientId={patientId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadEpisodes}
      />

      {selectedEpisodeId && (
        <ObstetricPdphFlowsheetModal
          episodeId={selectedEpisodeId}
          isOpen={isFlowsheetModalOpen}
          onClose={() => setIsFlowsheetModalOpen(false)}
          onSaved={() => loadEpisodeDetails(selectedEpisodeId)}
        />
      )}
    </div>
  );
};
