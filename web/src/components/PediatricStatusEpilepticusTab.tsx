import React, { useState, useEffect } from 'react';
import {
  getPediatricStatusEpilepticusEpisodes,
  getPediatricStatusEpilepticusEpisode,
  deletePediatricStatusEpilepticusEpisode,
  deletePediatricSeizureFlowsheet,
  PediatricStatusEpilepticusRecord,
  PediatricSeizureFlowsheetRecord,
} from '../api';
import { PediatricStatusEpilepticusModal } from './PediatricStatusEpilepticusModal';
import { PediatricSeizureFlowsheetModal } from './PediatricSeizureFlowsheetModal';

interface Props {
  patientId: number;
  ageMonths?: number;
  weightKg?: number;
}

export const PediatricStatusEpilepticusTab: React.FC<Props> = ({
  patientId,
  ageMonths,
  weightKg,
}) => {
  const [episodes, setEpisodes] = useState<PediatricStatusEpilepticusRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PediatricStatusEpilepticusRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<PediatricSeizureFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const fetchEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getPediatricStatusEpilepticusEpisodes({ patientId });
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
      const res = await getPediatricStatusEpilepticusEpisode(id);
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
    if (!confirm('Are you sure you want to delete this status epilepticus record?')) return;
    try {
      await deletePediatricStatusEpilepticusEpisode(id);
      fetchEpisodes();
    } catch (err: any) {
      alert(err.message || 'Failed to delete episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !confirm('Delete this seizure flowsheet log?')) return;
    try {
      await deletePediatricSeizureFlowsheet(selectedEpisode.id, logId);
      loadEpisodeDetail(selectedEpisode.id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete log');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading pediatric status epilepticus records...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>⚡</span> Pediatric Status Epilepticus Resuscitation Protocol
          </h2>
          <p className="text-xs text-gray-500">
            AES 2016 / PALS 2025 / ESETT Stepwise Benzodiazepine &rarr; Second-Line AED &rarr; PICU Infusion Protocol
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedEpisode && (
            <a
              href={`/pediatric-status-epilepticus/${selectedEpisode.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"
            >
              <span>🖨️</span> Print Dossier
            </a>
          )}
          <button
            onClick={() => setShowEpisodeModal(true)}
            className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1"
          >
            <span>+</span> New Seizure Resuscitation
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 p-6">
          <div className="text-4xl mb-2">🧒</div>
          <h3 className="text-base font-semibold text-gray-800">No Status Epilepticus Episodes</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-4">
            Record pediatric patients in convulsive status epilepticus (&ge; 5 minutes) to calculate precise weight-based Lorazepam/Midazolam, Levetiracetam/Fosphenytoin, and PICU continuous infusions.
          </p>
          <button
            onClick={() => setShowEpisodeModal(true)}
            className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-semibold shadow"
          >
            Initiate Seizure Protocol
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Episode List */}
          <div className="space-y-3 lg:col-span-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
              Seizure Episodes ({episodes.length})
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
                        ? 'bg-red-50/80 border-red-400 shadow-sm ring-1 ring-red-400'
                        : 'bg-white border-gray-200 hover:border-red-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-xs text-gray-900">{ep.episode_code}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ep.status === 'active_seizure'
                            ? 'bg-red-100 text-red-800 animate-pulse'
                            : ep.status === 'refractory_status'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {ep.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-600 my-1.5">
                      <div>Weight: <strong>{ep.weight_kg} kg</strong></div>
                      <div>Etiology: <strong className="capitalize">{ep.etiology.replace(/_/g, ' ')}</strong></div>
                      <div>Phase 1 Benzo: <strong>{ep.phase1_benzo_given ? 'YES' : 'NO'}</strong></div>
                      <div>Phase 2 AED: <strong>{ep.phase2_second_line_given ? 'YES' : 'NO'}</strong></div>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-gray-400 pt-1 border-t border-gray-100">
                      <span>{new Date(ep.seizure_onset_datetime).toLocaleDateString()}</span>
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
                        Age: {selectedEpisode.age_months}m | Weight: {selectedEpisode.weight_kg} kg
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Seizure Onset: {new Date(selectedEpisode.seizure_onset_datetime).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                      selectedEpisode.status === 'active_seizure'
                        ? 'bg-red-100 text-red-800 animate-pulse'
                        : selectedEpisode.status === 'refractory_status'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {selectedEpisode.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Score Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">Etiology</span>
                    <span className="text-sm font-black text-gray-900 block mt-1 capitalize">
                      {selectedEpisode.etiology.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">Semiology</span>
                    <span className="text-xs font-bold text-gray-800 block mt-1 capitalize">
                      {selectedEpisode.seizure_semiology.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">Phase 1 Benzo</span>
                    <span className="text-sm font-black text-red-900 block mt-1">
                      {selectedEpisode.phase1_benzo_agent ? `${selectedEpisode.phase1_benzo_dose_mg} mg` : 'None'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">Phase 2 AED</span>
                    <span className="text-sm font-black text-amber-900 block mt-1">
                      {selectedEpisode.phase2_agent ? `${selectedEpisode.phase2_dose_mg} mg` : 'None'}
                    </span>
                  </div>
                </div>

                {selectedEpisode.seizure_cessation_minute && (
                  <div className="text-xs bg-emerald-50 border border-emerald-200 p-3 rounded text-emerald-950">
                    <strong>Seizure Control Achieved:</strong> Minute {selectedEpisode.seizure_cessation_minute} from onset.
                  </div>
                )}
              </div>

              {/* Bedside Seizure Timeline Flowsheet */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <span>⏱️</span> Bedside Status Epilepticus Vital Signs & Airway Timeline
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Minute-by-minute tracking of AED infusions, airway support, vitals, and electrographic activity
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFlowsheetModal(true)}
                    className="px-2.5 py-1 bg-red-700 hover:bg-red-800 text-white rounded text-xs font-semibold shadow"
                  >
                    + Add Timeline Checkpoint
                  </button>
                </div>

                {flowsheetLogs.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400 bg-gray-50 rounded border border-dashed">
                    No resuscitation checkpoints logged yet. Click &quot;+ Add Timeline Checkpoint&quot; to begin.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 text-gray-700 border-b">
                        <tr>
                          <th className="py-2 px-2.5 font-bold">Minute / Time</th>
                          <th className="py-2 px-2.5 font-bold">Phase Active</th>
                          <th className="py-2 px-2.5 font-bold">Convulsion</th>
                          <th className="py-2 px-2.5 font-bold">Vitals (HR / BP / SpO2)</th>
                          <th className="py-2 px-2.5 font-bold">Airway Support</th>
                          <th className="py-2 px-2.5 font-bold">Notes</th>
                          <th className="py-2 px-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {flowsheetLogs.map((lg) => (
                          <tr key={lg.id} className="hover:bg-red-50/40">
                            <td className="py-2 px-2.5 font-bold text-gray-900">
                              Minute {lg.minutes_from_onset}
                              <span className="text-gray-400 block text-[10px] font-normal">
                                {new Date(lg.log_datetime).toLocaleTimeString()}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 text-gray-800 font-medium">
                              {lg.phase_active.replace(/_/g, ' ')}
                            </td>
                            <td className="py-2 px-2.5">
                              <span
                                className={`px-2 py-0.5 rounded font-extrabold text-[10px] uppercase ${
                                  lg.seizure_activity_present === 1
                                    ? 'bg-red-100 text-red-800 animate-pulse'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {lg.seizure_activity_present === 1 ? 'ONGOING' : 'ABATED'}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 font-mono text-gray-700">
                              {lg.vitals_hr ?? '-'}/min | {lg.vitals_sbp ?? '-'}/{lg.vitals_dbp ?? '-'} | {lg.vitals_spo2 ? `${lg.vitals_spo2}%` : '-'}
                            </td>
                            <td className="py-2 px-2.5 text-gray-800">
                              {lg.airway_status.replace(/_/g, ' ')}
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
        <PediatricStatusEpilepticusModal
          patientId={patientId}
          ageMonths={ageMonths}
          weightKg={weightKg}
          onClose={() => setShowEpisodeModal(false)}
          onSuccess={() => fetchEpisodes()}
        />
      )}

      {showFlowsheetModal && selectedEpisode && (
        <PediatricSeizureFlowsheetModal
          episodeId={selectedEpisode.id}
          minutesFromOnset={flowsheetLogs.length > 0 ? (flowsheetLogs[flowsheetLogs.length - 1]?.minutes_from_onset ?? 0) + 10 : 10}
          onClose={() => setShowFlowsheetModal(false)}
          onSuccess={() => loadEpisodeDetail(selectedEpisode.id)}
        />
      )}
    </div>
  );
};
