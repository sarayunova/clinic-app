import React, { useState, useEffect } from 'react';
import {
  getNeonatalTtnEpisodes,
  getNeonatalTtnEpisode,
  updateNeonatalTtnStatus,
  deleteNeonatalTtnFlowsheet,
  type NeonatalTtnRecord,
  type NeonatalTtnFlowsheetRecord,
} from '../api';
import { NeonatalTtnModal } from './NeonatalTtnModal';
import { NeonatalTtnFlowsheetModal } from './NeonatalTtnFlowsheetModal';

interface Props {
  patientId: number;
}

export const NeonatalTtnTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<NeonatalTtnRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<NeonatalTtnRecord | null>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [flowsheet, setFlowsheet] = useState<NeonatalTtnFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFlowsheetModalOpen, setIsFlowsheetModalOpen] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getNeonatalTtnEpisodes({ patientId });
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
      setError(err?.message || 'Failed to load neonatal TTN records');
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getNeonatalTtnEpisode(id);
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
      await updateNeonatalTtnStatus(selectedEpisodeId, { status: newStatus });
      await loadEpisodeDetails(selectedEpisodeId);
      const res = await getNeonatalTtnEpisodes({ patientId });
      setEpisodes(res.episodes);
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisodeId || !window.confirm('Delete this observation log?')) return;
    try {
      await deleteNeonatalTtnFlowsheet(selectedEpisodeId, logId);
      await loadEpisodeDetails(selectedEpisodeId);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  if (loading && !selectedEpisode) {
    return <div className="p-6 text-center text-sm text-gray-500">Loading Neonatal TTN Protocol data...</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Header Controls */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border flex-wrap gap-2">
        <div className="flex items-center space-x-3">
          <h3 className="text-base font-bold text-gray-800">
            Transient Tachypnea of the Newborn (TTN) & Lung Fluid Resorption
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
              href={`/patients/${patientId}/neonatal-ttn/${selectedEpisode.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 border border-sky-600 text-sky-700 text-xs font-semibold rounded hover:bg-sky-50"
            >
              Print Dossier
            </a>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 bg-sky-600 text-white text-xs font-bold rounded hover:bg-sky-700"
          >
            + Initiate TTN Episode
          </button>
        </div>
      </div>

      {!selectedEpisode ? (
        <div className="bg-white p-8 rounded-lg border text-center text-gray-500">
          <p className="text-sm">No active Neonatal TTN episodes logged for this patient.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-3 px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded hover:bg-sky-700"
          >
            Start TTN Clinical Protocol
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Diagnostic & Risk Overview Card */}
          <div className="bg-white p-5 rounded-lg border shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3 flex-wrap gap-2">
              <div>
                <span className="text-xs font-semibold text-gray-500">Episode:</span>
                <span className="ml-1 text-sm font-bold text-sky-900">{selectedEpisode.episode_code}</span>
                <span className="ml-3 text-xs text-gray-500">
                  Diagnosed: {new Date(selectedEpisode.diagnosis_datetime).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-gray-500">Status:</span>
                <select
                  value={selectedEpisode.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="text-xs font-bold border rounded px-2 py-1 bg-gray-50 text-sky-900"
                >
                  <option value="active_monitoring">Active Monitoring</option>
                  <option value="weaning_support">Weaning Support</option>
                  <option value="resolved_discharged">Resolved / Discharged</option>
                  <option value="escalated_to_rds_surfactant">Escalated to RDS / Surfactant</option>
                  <option value="escalated_to_pphn">Escalated to PPHN</option>
                </select>
              </div>
            </div>

            {/* Score & Tiers */}
            {evaluation && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-sky-50/60 p-4 rounded border border-sky-200">
                <div>
                  <div className="text-xs text-sky-800 font-semibold uppercase">Silverman-Anderson Score</div>
                  <div className="text-3xl font-extrabold text-sky-950 mt-1">
                    {evaluation.silvermanAndersonScore} / 10
                  </div>
                  <div className="text-xs font-bold text-sky-700 mt-1">
                    {evaluation.distressSeverityLabel}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-sky-800 font-semibold uppercase">Initial Respiratory Rate</div>
                  <div className="text-3xl font-extrabold text-gray-800 mt-1">
                    {selectedEpisode.initial_respiratory_rate} <span className="text-base font-normal">bpm</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Support: {selectedEpisode.respiratory_support_initial.replace(/_/g, ' ')} ({selectedEpisode.initial_fio2_percent}% FiO2)
                  </div>
                </div>

                <div>
                  <div className="text-xs text-sky-800 font-semibold uppercase">Feeding Plan</div>
                  <p className="text-xs text-gray-800 mt-1 font-medium leading-relaxed">
                    {evaluation.feedingRecommendation}
                  </p>
                </div>
              </div>
            )}

            {/* CXR & Risk Factors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="border rounded p-3 bg-gray-50">
                <span className="font-bold text-gray-700 block mb-1">Radiographic CXR Finding:</span>
                <p className="text-gray-800">{evaluation?.cxrInterpretation || selectedEpisode.cxr_findings}</p>
                <div className="mt-2 text-gray-600">
                  <span>Gestational Age: {selectedEpisode.gestational_age_weeks} wks | Birth Weight: {selectedEpisode.birth_weight_kg} kg</span>
                  <br />
                  <span>Delivery: {selectedEpisode.delivery_mode.replace(/_/g, ' ')}</span>
                </div>
              </div>

              <div className="border rounded p-3 bg-gray-50">
                <span className="font-bold text-gray-700 block mb-1">Maternal & Clinical Factors:</span>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  {evaluation?.riskFactorSummary?.length ? (
                    evaluation.riskFactorSummary.map((rf: string, i: number) => <li key={i}>{rf}</li>)
                  ) : (
                    <li>No high-risk maternal predisposing factors logged</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Guidance & Alerts */}
            {evaluation?.alerts?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-xs space-y-1">
                <span className="font-bold text-red-900 block">Clinical Alerts:</span>
                {evaluation.alerts.map((a: string, i: number) => (
                  <div key={i} className="text-red-700 flex items-center gap-1 font-medium">
                    <span>⚠</span> {a}
                  </div>
                ))}
              </div>
            )}

            {evaluation?.recommendations?.length > 0 && (
              <div className="bg-sky-50/70 border border-sky-200 rounded p-3 text-xs space-y-1">
                <span className="font-bold text-sky-950 block">Management Directives:</span>
                <ul className="list-disc list-inside space-y-1 text-sky-900">
                  {evaluation.recommendations.map((rec: string, i: number) => (
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
                Serial Bedside TTN Flowsheet ({flowsheet.length} logs)
              </h4>
              <button
                onClick={() => setIsFlowsheetModalOpen(true)}
                className="px-3 py-1 bg-sky-600 text-white text-xs font-semibold rounded hover:bg-sky-700"
              >
                + Add Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <p className="text-xs text-gray-500 py-3 text-center border rounded">
                No flowsheet entries recorded yet. Track respiratory rate, Silverman score, and CPAP weaning above.
              </p>
            ) : (
              <div className="overflow-x-auto border rounded">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-gray-100 text-gray-700 border-b">
                    <tr>
                      <th className="p-2">Timestamp</th>
                      <th className="p-2">RR (bpm)</th>
                      <th className="p-2">HR (bpm)</th>
                      <th className="p-2">SpO2 (%)</th>
                      <th className="p-2">FiO2 (%)</th>
                      <th className="p-2">CPAP (cmH2O)</th>
                      <th className="p-2">Silverman</th>
                      <th className="p-2">Feeding</th>
                      <th className="p-2">Logged By</th>
                      <th className="p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-gray-800">
                    {flowsheet.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="p-2 whitespace-nowrap">{new Date(log.log_datetime).toLocaleString()}</td>
                        <td className="p-2 font-bold">{log.respiratory_rate}</td>
                        <td className="p-2">{log.heart_rate}</td>
                        <td className="p-2">{log.spo2_percent}%</td>
                        <td className="p-2">{log.fio2_percent}%</td>
                        <td className="p-2">{log.cpap_peep_cmh2o ?? '-'}</td>
                        <td className="p-2 font-bold text-sky-900">{log.silverman_anderson_score}</td>
                        <td className="p-2">{log.feeding_route ?? '-'}</td>
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
      <NeonatalTtnModal
        patientId={patientId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadEpisodes}
      />

      {selectedEpisodeId && (
        <NeonatalTtnFlowsheetModal
          episodeId={selectedEpisodeId}
          isOpen={isFlowsheetModalOpen}
          onClose={() => setIsFlowsheetModalOpen(false)}
          onSaved={() => loadEpisodeDetails(selectedEpisodeId)}
        />
      )}
    </div>
  );
};
