import React, { useState, useEffect } from 'react';
import {
  getObstetricIcpEpisodes,
  getObstetricIcpEpisode,
  deleteObstetricIcpEpisode,
  deleteObstetricIcpFlowsheet,
  ObstetricIcpRecord,
  ObstetricIcpFlowsheetRecord,
} from '../api';
import { ObstetricIcpModal } from './ObstetricIcpModal';
import { ObstetricIcpFlowsheetModal } from './ObstetricIcpFlowsheetModal';

interface Props {
  patientId: number;
  gestationWeeks?: number;
}

export const ObstetricIcpTab: React.FC<Props> = ({
  patientId,
  gestationWeeks,
}) => {
  const [episodes, setEpisodes] = useState<ObstetricIcpRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<ObstetricIcpRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<ObstetricIcpFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const fetchEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getObstetricIcpEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        loadEpisodeDetail(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setFlowsheetLogs([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetail = async (id: number) => {
    try {
      const res = await getObstetricIcpEpisode(id);
      setSelectedEpisode(res.episode);
      setFlowsheetLogs(res.logs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [patientId]);

  const handleDeleteEpisode = async (id: number) => {
    if (!confirm('Are you sure you want to delete this obstetric cholestasis (ICP) record?')) return;
    try {
      await deleteObstetricIcpEpisode(id);
      fetchEpisodes();
    } catch (err: any) {
      alert(err.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !confirm('Delete this surveillance flowsheet entry?')) return;
    try {
      await deleteObstetricIcpFlowsheet(selectedEpisode.id, logId);
      loadEpisodeDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete log');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading obstetric cholestasis records...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>🩺</span> Intrahepatic Cholestasis of Pregnancy (ICP / Obstetric Cholestasis)
          </h2>
          <p className="text-xs text-gray-500">
            SMFM 2021 / RCOG 43 Fasting Bile Acids Risk Stratification, UDCA Titration & Delivery Protocol
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedEpisode && (
            <a
              href={`/obstetric-icp/${selectedEpisode.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"
            >
              <span>🖨️</span> Print Dossier
            </a>
          )}
          <button
            onClick={() => setShowEpisodeModal(true)}
            className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1"
          >
            <span>+</span> New ICP Assessment
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 p-6">
          <div className="text-4xl mb-2">🤰</div>
          <h3 className="text-base font-semibold text-gray-800">No ICP Episodes Recorded</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-4">
            Evaluate pregnant patients presenting with pruritus (palms/soles, nocturnal) using total serum bile acids (TSBA) to stratify stillbirth risk and schedule delivery timing.
          </p>
          <button
            onClick={() => setShowEpisodeModal(true)}
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow"
          >
            Initiate ICP Evaluation
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Episode List */}
          <div className="space-y-3 lg:col-span-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
              Episodes ({episodes.length})
            </h3>
            <div className="space-y-2">
              {episodes.map((ep) => {
                const isSelected = selectedEpisode?.id === ep.id;
                return (
                  <div
                    key={ep.id}
                    onClick={() => loadEpisodeDetail(ep.id)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50/80 border-teal-400 shadow-sm ring-1 ring-teal-400'
                        : 'bg-white border-gray-200 hover:border-teal-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-xs text-gray-900">{ep.episode_code}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ep.icp_severity_tier === 'severe_ge_100'
                            ? 'bg-red-100 text-red-800'
                            : ep.icp_severity_tier === 'moderate_40_99'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {ep.icp_severity_tier.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-600 my-1.5">
                      <div>Peak TSBA: <strong className="text-teal-900">{ep.peak_tsba_umol_l} umol/L</strong></div>
                      <div>Delivery GA: <strong>{ep.planned_delivery_weeks}w</strong></div>
                      <div>UDCA: <strong>{ep.udca_dose_mg_day} mg/d</strong></div>
                      <div>Pruritus: <strong>{ep.pruritus_severity_score}/10</strong></div>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-gray-400 pt-1 border-t border-gray-100">
                      <span>{new Date(ep.diagnosis_datetime).toLocaleDateString()} ({ep.gestation_weeks}w)</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEpisode(ep.id);
                        }}
                        className="text-gray-400 hover:text-red-600 font-semibold"
                        title="Delete Episode"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Detail & Flowsheet */}
          {selectedEpisode && (
            <div className="space-y-5 lg:col-span-2">
              {/* Detailed Summary Card */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-4">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-gray-900">
                        {selectedEpisode.episode_code}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-700 font-semibold px-2 py-0.5 rounded">
                        GA at Diagnosis: {selectedEpisode.gestation_weeks} weeks
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Diagnosed on {new Date(selectedEpisode.diagnosis_datetime).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                      selectedEpisode.status === 'delivered'
                        ? 'bg-purple-100 text-purple-800'
                        : selectedEpisode.status === 'planned_induction'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-teal-100 text-teal-800'
                    }`}
                  >
                    {selectedEpisode.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Score Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">Peak TSBA</span>
                    <span className="text-lg font-black text-teal-900">{selectedEpisode.peak_tsba_umol_l}</span>
                    <span className="text-[10px] text-gray-500 block">umol/L</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">Delivery Timing</span>
                    <span className="text-lg font-black text-gray-900">{selectedEpisode.planned_delivery_weeks}</span>
                    <span className="text-[10px] text-gray-500 block">weeks GA</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">UDCA Dose</span>
                    <span className="text-lg font-black text-teal-900">{selectedEpisode.udca_dose_mg_day}</span>
                    <span className="text-[10px] text-gray-500 block">mg / day</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">Surveillance</span>
                    <span className="text-xs font-bold text-gray-800 block mt-1 uppercase">
                      {selectedEpisode.ctg_surveillance_frequency.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {selectedEpisode.delivery_timing_rationale && (
                  <div className="text-xs bg-teal-50 border border-teal-200 p-3 rounded text-teal-950">
                    <strong>Delivery Strategy Rationale:</strong> {selectedEpisode.delivery_timing_rationale}
                  </div>
                )}
              </div>

              {/* Longitudinal ICP Flowsheet */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <span>📊</span> Serial Fasting Bile Acids & Fetal Surveillance Flowsheet
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Tracking TSBA trajectory, transaminases, pruritus VAS, and CTG reactivity
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFlowsheetModal(true)}
                    className="px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded text-xs font-semibold shadow"
                  >
                    + Add Checkpoint
                  </button>
                </div>

                {flowsheetLogs.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400 bg-gray-50 rounded border border-dashed">
                    No surveillance checkpoints logged yet. Click &quot;+ Add Checkpoint&quot; to begin.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 text-gray-700 border-b">
                        <tr>
                          <th className="py-2 px-2.5 font-bold">Date / GA</th>
                          <th className="py-2 px-2.5 font-bold">TSBA (umol/L)</th>
                          <th className="py-2 px-2.5 font-bold">ALT / AST</th>
                          <th className="py-2 px-2.5 font-bold">Pruritus</th>
                          <th className="py-2 px-2.5 font-bold">CTG Result</th>
                          <th className="py-2 px-2.5 font-bold">UDCA Dose</th>
                          <th className="py-2 px-2.5 font-bold">Notes</th>
                          <th className="py-2 px-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {flowsheetLogs.map((lg) => (
                          <tr key={lg.id} className="hover:bg-teal-50/40">
                            <td className="py-2 px-2.5 font-medium text-gray-900">
                              {new Date(lg.log_datetime).toLocaleDateString()}
                              <span className="text-gray-400 block text-[10px]">{lg.gestation_weeks} weeks</span>
                            </td>
                            <td className="py-2 px-2.5 font-bold text-teal-950">
                              <span
                                className={`px-2 py-0.5 rounded ${
                                  lg.current_tsba_umol_l >= 100
                                    ? 'bg-red-100 text-red-800 font-extrabold'
                                    : lg.current_tsba_umol_l >= 40
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {lg.current_tsba_umol_l} umol/L
                              </span>
                            </td>
                            <td className="py-2 px-2.5 text-gray-700 font-mono">
                              {lg.alt_u_l ?? '-'}/{lg.ast_u_l ?? '-'} U/L
                            </td>
                            <td className="py-2 px-2.5 font-semibold text-gray-900">
                              {lg.pruritus_score}/10
                            </td>
                            <td className="py-2 px-2.5">
                              <span
                                className={`px-1.5 py-0.5 rounded font-bold text-[10px] uppercase ${
                                  lg.ctg_result === 'reactive'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : lg.ctg_result === 'equivocal'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {lg.ctg_result}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 text-gray-800 font-medium">
                              {lg.udca_current_dose_mg_day} mg/d
                            </td>
                            <td className="py-2 px-2.5 text-gray-600 max-w-xs truncate">
                              {lg.notes || '-'}
                            </td>
                            <td className="py-2 px-2.5 text-right">
                              <button
                                onClick={() => handleDeleteLog(lg.id)}
                                className="text-gray-400 hover:text-red-600 font-bold"
                                title="Delete Log"
                              >
                                &times;
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
        </div>
      )}

      {showEpisodeModal && (
        <ObstetricIcpModal
          patientId={patientId}
          gestationWeeks={gestationWeeks}
          onClose={() => setShowEpisodeModal(false)}
          onSuccess={() => fetchEpisodes()}
        />
      )}

      {showFlowsheetModal && selectedEpisode && (
        <ObstetricIcpFlowsheetModal
          episodeId={selectedEpisode.id}
          gestationWeeks={selectedEpisode.gestation_weeks}
          currentUdcaDose={selectedEpisode.udca_dose_mg_day}
          onClose={() => setShowFlowsheetModal(false)}
          onSuccess={() => loadEpisodeDetail(selectedEpisode.id)}
        />
      )}
    </div>
  );
};
