import React, { useState, useEffect } from 'react';
import {
  getNeonatalBindEpisodes,
  getNeonatalBindEpisode,
  deleteNeonatalBindEpisode,
  deleteNeonatalBindFlowsheet,
  NeonatalBindAabrRecord,
  NeonatalBindFlowsheetRecord,
} from '../api';
import { NeonatalBindAabrModal } from './NeonatalBindAabrModal';
import { NeonatalBindFlowsheetModal } from './NeonatalBindFlowsheetModal';

interface Props {
  patientId: number;
  gestationalAgeWeeks?: number;
  birthWeightGrams?: number;
}

export const NeonatalBindAabrTab: React.FC<Props> = ({
  patientId,
  gestationalAgeWeeks,
  birthWeightGrams,
}) => {
  const [episodes, setEpisodes] = useState<NeonatalBindAabrRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<NeonatalBindAabrRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<NeonatalBindFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const fetchEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getNeonatalBindEpisodes({ patientId });
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
      const res = await getNeonatalBindEpisode(id);
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
    if (!confirm('Are you sure you want to delete this neonatal BIND assessment?')) return;
    try {
      await deleteNeonatalBindEpisode(id);
      fetchEpisodes();
    } catch (err: any) {
      alert(err.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !confirm('Delete this serial BIND checkpoint?')) return;
    try {
      await deleteNeonatalBindFlowsheet(selectedEpisode.id, logId);
      loadEpisodeDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete log');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading BIND & AABR clinical records...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>🧠</span> Neonatal BIND Scoring & AABR Hearing Screening
          </h2>
          <p className="text-xs text-gray-500">
            AAP 2022 Neurotoxicity Surveillance, B/A Ratio & Auditory Neuropathy Screening
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedEpisode && (
            <a
              href={`/neonatal-bind-aabr/${selectedEpisode.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"
            >
              <span>🖨️</span> Print Dossier
            </a>
          )}
          <button
            onClick={() => setShowEpisodeModal(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1"
          >
            <span>+</span> New BIND Assessment
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 p-6">
          <div className="text-4xl mb-2">👶</div>
          <h3 className="text-base font-semibold text-gray-800">No BIND Neuro-Auditory Records</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-4">
            Evaluate neonates with severe hyperbilirubinemia for Acute Bilirubin Encephalopathy (BIND 0-9), Bilirubin/Albumin ratio, and automated AABR hearing screening.
          </p>
          <button
            onClick={() => setShowEpisodeModal(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow"
          >
            Initiate BIND Assessment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Episode List Selector */}
          <div className="space-y-3 lg:col-span-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
              Assessment History ({episodes.length})
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
                        ? 'bg-amber-50/80 border-amber-400 shadow-sm ring-1 ring-amber-400'
                        : 'bg-white border-gray-200 hover:border-amber-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-xs text-gray-900">{ep.episode_code}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ep.total_bind_score >= 7
                            ? 'bg-red-100 text-red-800'
                            : ep.total_bind_score >= 4
                            ? 'bg-amber-100 text-amber-800'
                            : ep.total_bind_score >= 1
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        BIND {ep.total_bind_score}/9
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-600 my-1.5">
                      <div>TSB: <strong className="text-amber-800">{ep.peak_tsb_mg_dl} mg/dL</strong></div>
                      <div>B/A: <strong>{ep.calculated_b_a_ratio ? `${ep.calculated_b_a_ratio} mg/g` : 'N/A'}</strong></div>
                      <div>R-Ear: <strong className={ep.aabr_right_ear === 'refer' ? 'text-red-700' : 'text-emerald-700'}>{ep.aabr_right_ear.toUpperCase()}</strong></div>
                      <div>L-Ear: <strong className={ep.aabr_left_ear === 'refer' ? 'text-red-700' : 'text-emerald-700'}>{ep.aabr_left_ear.toUpperCase()}</strong></div>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-gray-400 pt-1 border-t border-gray-100">
                      <span>{new Date(ep.assessment_datetime).toLocaleDateString()}</span>
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

          {/* Active Episode Detail & Flowsheet */}
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
                        GA: {selectedEpisode.gestational_age_weeks}w | BW: {selectedEpisode.birth_weight_grams}g
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Evaluated on {new Date(selectedEpisode.assessment_datetime).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                      selectedEpisode.status === 'cleared_pass'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedEpisode.status === 'post_exchange_transfusion'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedEpisode.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Score Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">Total BIND Score</span>
                    <span className="text-lg font-black text-amber-900">{selectedEpisode.total_bind_score}/9</span>
                    <span className="text-[10px] text-gray-500 block">
                      M:{selectedEpisode.mental_status_score} T:{selectedEpisode.muscle_tone_score} C:{selectedEpisode.cry_score}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">Peak TSB</span>
                    <span className="text-lg font-black text-amber-900">{selectedEpisode.peak_tsb_mg_dl}</span>
                    <span className="text-[10px] text-gray-500 block">mg/dL</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">B/A Ratio</span>
                    <span className="text-lg font-black text-amber-900">
                      {selectedEpisode.calculated_b_a_ratio ?? 'N/A'}
                    </span>
                    <span className="text-[10px] text-gray-500 block">mg/g</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">AABR Result</span>
                    <span
                      className={`text-sm font-black block mt-1 ${
                        selectedEpisode.aabr_right_ear === 'pass' && selectedEpisode.aabr_left_ear === 'pass'
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      R: {selectedEpisode.aabr_right_ear.toUpperCase()} | L: {selectedEpisode.aabr_left_ear.toUpperCase()}
                    </span>
                  </div>
                </div>

                {selectedEpisode.neuro_auditory_followup_plan && (
                  <div className="text-xs bg-amber-50/70 border border-amber-200 p-3 rounded text-amber-950">
                    <strong>Neuro-Auditory Follow-Up Plan:</strong> {selectedEpisode.neuro_auditory_followup_plan}
                  </div>
                )}
              </div>

              {/* Serial BIND Flowsheet */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <span>⏱️</span> Bedside Acute Encephalopathy Serial Flowsheet
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Tracking mental status, muscle tone, and cry evolution under phototherapy
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFlowsheetModal(true)}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shadow"
                  >
                    + Add Log
                  </button>
                </div>

                {flowsheetLogs.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400 bg-gray-50 rounded border border-dashed">
                    No bedside serial checkpoints logged yet. Click &quot;+ Add Log&quot; to begin.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 text-gray-700 border-b">
                        <tr>
                          <th className="py-2 px-2.5 font-bold">Time / Elapsed</th>
                          <th className="py-2 px-2.5 font-bold">BIND (M/T/C)</th>
                          <th className="py-2 px-2.5 font-bold">Total Score</th>
                          <th className="py-2 px-2.5 font-bold">TSB (mg/dL)</th>
                          <th className="py-2 px-2.5 font-bold">Phototherapy</th>
                          <th className="py-2 px-2.5 font-bold">Notes</th>
                          <th className="py-2 px-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {flowsheetLogs.map((lg) => (
                          <tr key={lg.id} className="hover:bg-amber-50/40">
                            <td className="py-2 px-2.5 font-medium text-gray-900">
                              {new Date(lg.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              <span className="text-gray-400 block text-[10px]">+{lg.hours_from_admission}h</span>
                            </td>
                            <td className="py-2 px-2.5 font-mono">
                              M:{lg.mental_status_score} T:{lg.muscle_tone_score} C:{lg.cry_score}
                            </td>
                            <td className="py-2 px-2.5">
                              <span
                                className={`px-2 py-0.5 rounded font-bold ${
                                  lg.total_bind_score >= 4
                                    ? 'bg-red-100 text-red-800'
                                    : lg.total_bind_score >= 1
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {lg.total_bind_score}/9
                              </span>
                            </td>
                            <td className="py-2 px-2.5 font-semibold text-amber-900">
                              {lg.tsb_mg_dl ? `${lg.tsb_mg_dl} mg/dL` : '-'}
                            </td>
                            <td className="py-2 px-2.5 text-gray-700">
                              {lg.phototherapy_type?.replace(/_/g, ' ') ?? 'None'}
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
        <NeonatalBindAabrModal
          patientId={patientId}
          gestationalAgeWeeks={gestationalAgeWeeks}
          birthWeightGrams={birthWeightGrams}
          onClose={() => setShowEpisodeModal(false)}
          onSuccess={() => fetchEpisodes()}
        />
      )}

      {showFlowsheetModal && selectedEpisode && (
        <NeonatalBindFlowsheetModal
          episodeId={selectedEpisode.id}
          onClose={() => setShowFlowsheetModal(false)}
          onSuccess={() => loadEpisodeDetail(selectedEpisode.id)}
        />
      )}
    </div>
  );
};
