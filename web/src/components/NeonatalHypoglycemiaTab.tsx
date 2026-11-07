import React, { useState, useEffect } from 'react';
import {
  getNeonatalHypoglycemiaEpisodes,
  getNeonatalHypoglycemiaEpisode,
  updateNeonatalHypoglycemiaEpisode,
  deleteNeonatalGirFlowsheet,
  type NeonatalHypoglycemiaRecord,
  type NeonatalGirFlowsheetRecord,
} from '../api';
import { NeonatalHypoglycemiaModal } from './NeonatalHypoglycemiaModal';
import { NeonatalGirFlowsheetModal } from './NeonatalGirFlowsheetModal';

interface Props {
  patientId: number;
}

export const NeonatalHypoglycemiaTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<NeonatalHypoglycemiaRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<NeonatalHypoglycemiaRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<NeonatalGirFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const fetchEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getNeonatalHypoglycemiaEpisodes({ patientId });
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
      const res = await getNeonatalHypoglycemiaEpisode(id);
      setSelectedEpisode(res.episode);
      setFlowsheetLogs(res.logs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [patientId]);

  const handleStatusChange = async (newStatus: any) => {
    if (!selectedEpisode) return;
    try {
      const res = await updateNeonatalHypoglycemiaEpisode(selectedEpisode.id, { status: newStatus });
      setSelectedEpisode(res.episode);
      setEpisodes(episodes.map((e) => (e.id === res.episode.id ? res.episode : e)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this flowsheet log?')) return;
    try {
      await deleteNeonatalGirFlowsheet(selectedEpisode.id, logId);
      loadEpisodeDetail(selectedEpisode.id);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading hypoglycemia records...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>Neonatal Hypoglycemia, GIR & aEEG Seizure Management</span>
            <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
              AAP 2011 & WHO/ILAE 2021
            </span>
          </h2>
          <p className="text-xs text-gray-500">
            Automated glucose infusion rate (GIR), mini-bolus titration & bedside neuro-monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedEpisode && (
            <a
              href={`/neonatal-hypoglycemia/${selectedEpisode.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 flex items-center gap-1.5"
            >
              Print Dossier
            </a>
          )}
          <button
            onClick={() => setShowEpisodeModal(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 flex items-center gap-1"
          >
            + New Episode
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-sm text-gray-600">No neonatal hypoglycemia episodes recorded for this patient.</p>
          <button
            onClick={() => setShowEpisodeModal(true)}
            className="mt-3 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700"
          >
            Initiate Hypoglycemia & GIR Protocol
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Episode Selector if multiple */}
          {episodes.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {episodes.map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => loadEpisodeDetail(ep.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium border whitespace-nowrap ${
                    selectedEpisode?.id === ep.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {ep.episode_code} ({ep.status})
                </button>
              ))}
            </div>
          )}

          {selectedEpisode && (
            <>
              {/* Active Episode Summary Card */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-gray-500">
                      {selectedEpisode.episode_code}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      Evaluated: {new Date(selectedEpisode.evaluation_datetime).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-600">Status:</span>
                    <select
                      value={selectedEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="text-xs font-semibold border rounded px-2 py-1 bg-gray-50"
                    >
                      <option value="evaluating">Evaluating</option>
                      <option value="active_infusion">Active IV GIR Infusion</option>
                      <option value="stabilized_weaning">Stabilized / Weaning</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-lg">
                    <div className="text-[11px] text-blue-700 font-semibold uppercase">Initial Glucose</div>
                    <div className="text-2xl font-black text-blue-900 mt-0.5">
                      {selectedEpisode.initial_blood_glucose_mg_dl}{' '}
                      <span className="text-xs font-normal text-blue-700">mg/dL</span>
                    </div>
                    <div className="text-[11px] text-blue-800 mt-1">
                      Target: &gt;={selectedEpisode.glucose_target_mg_dl} mg/dL
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-lg">
                    <div className="text-[11px] text-emerald-700 font-semibold uppercase">Active GIR</div>
                    <div className="text-2xl font-black text-emerald-900 mt-0.5">
                      {selectedEpisode.current_gir_mg_kg_min}{' '}
                      <span className="text-xs font-normal text-emerald-700">mg/kg/min</span>
                    </div>
                    <div className="text-[11px] text-emerald-800 mt-1">
                      {selectedEpisode.fluid_dextrose_percent}% @ {selectedEpisode.fluid_rate_ml_hr} mL/hr
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-lg">
                    <div className="text-[11px] text-amber-700 font-semibold uppercase">D10W Bolus</div>
                    <div className="text-2xl font-black text-amber-900 mt-0.5">
                      {selectedEpisode.d10w_bolus_given_ml}{' '}
                      <span className="text-xs font-normal text-amber-700">mL</span>
                    </div>
                    <div className="text-[11px] text-amber-800 mt-1">
                      Weight: {selectedEpisode.current_weight_kg} kg (2 mL/kg)
                    </div>
                  </div>

                  <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-lg">
                    <div className="text-[11px] text-purple-700 font-semibold uppercase">aEEG & Seizures</div>
                    <div className="text-sm font-bold text-purple-950 mt-1 truncate">
                      {selectedEpisode.aeeg_background_pattern.replace(/_/g, ' ').toUpperCase()}
                    </div>
                    <div className="text-[11px] text-purple-800 mt-1">
                      {selectedEpisode.seizure_activity_observed ? 'Seizures Observed' : 'No clinical seizures'}
                    </div>
                  </div>
                </div>

                {selectedEpisode.clinical_notes && (
                  <div className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded border border-gray-200">
                    <strong>Clinical Notes:</strong> {selectedEpisode.clinical_notes}
                  </div>
                )}
              </div>

              {/* Flowsheet Table */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Bedside Glucose & GIR Flowsheet</h3>
                    <p className="text-xs text-gray-500">Hourly monitoring checkpoints & feed volumes</p>
                  </div>
                  <button
                    onClick={() => setShowFlowsheetModal(true)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700"
                  >
                    + Record Checkpoint
                  </button>
                </div>

                {flowsheetLogs.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-500 border border-dashed rounded-lg">
                    No bedside logs yet. Click "+ Record Checkpoint" to log blood sugar & GIR.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 border-y text-gray-600 font-semibold">
                        <tr>
                          <th className="py-2 px-2.5">Time</th>
                          <th className="py-2 px-2.5">Hour</th>
                          <th className="py-2 px-2.5">Blood Sugar</th>
                          <th className="py-2 px-2.5">Fluid Infusion</th>
                          <th className="py-2 px-2.5">Calculated GIR</th>
                          <th className="py-2 px-2.5">D10W Bolus</th>
                          <th className="py-2 px-2.5">Feeding</th>
                          <th className="py-2 px-2.5">aEEG / Seizures</th>
                          <th className="py-2 px-2.5">Notes</th>
                          <th className="py-2 px-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-gray-800">
                        {flowsheetLogs.map((lg) => (
                          <tr key={lg.id} className="hover:bg-gray-50/80">
                            <td className="py-2 px-2.5 whitespace-nowrap">
                              {new Date(lg.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2 px-2.5">+{lg.hours_on_protocol}h</td>
                            <td className="py-2 px-2.5 font-bold">
                              <span
                                className={`px-2 py-0.5 rounded ${
                                  lg.blood_glucose_mg_dl < 45
                                    ? 'bg-red-100 text-red-800 font-black'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {lg.blood_glucose_mg_dl} mg/dL
                              </span>
                            </td>
                            <td className="py-2 px-2.5">
                              {lg.fluid_dextrose_percent}% @ {lg.fluid_rate_ml_hr} mL/h
                            </td>
                            <td className="py-2 px-2.5 font-semibold text-blue-700">
                              {lg.calculated_gir_mg_kg_min} mg/kg/min
                            </td>
                            <td className="py-2 px-2.5">{lg.d10w_bolus_ml > 0 ? `${lg.d10w_bolus_ml} mL` : '-'}</td>
                            <td className="py-2 px-2.5">
                              {lg.feeding_volume_ml > 0 ? `${lg.feeding_volume_ml} mL (${lg.feeding_type})` : '-'}
                            </td>
                            <td className="py-2 px-2.5">
                              <span className="text-[11px] font-mono text-gray-600 block">
                                {lg.aeeg_pattern.slice(0, 15)}
                              </span>
                              {lg.seizure_events_count > 0 && (
                                <span className="text-[10px] text-red-700 font-bold">
                                  {lg.seizure_events_count} sz events
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 max-w-[150px] truncate">{lg.notes || '-'}</td>
                            <td className="py-2 px-2.5 text-right">
                              <button
                                onClick={() => handleDeleteLog(lg.id)}
                                className="text-red-500 hover:text-red-700 font-semibold"
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
            </>
          )}
        </div>
      )}

      {showEpisodeModal && (
        <NeonatalHypoglycemiaModal
          patientId={patientId}
          onClose={() => setShowEpisodeModal(false)}
          onSuccess={(ep) => {
            setShowEpisodeModal(false);
            fetchEpisodes();
          }}
        />
      )}

      {showFlowsheetModal && selectedEpisode && (
        <NeonatalGirFlowsheetModal
          episodeId={selectedEpisode.id}
          weightKg={selectedEpisode.current_weight_kg}
          currentDextrosePercent={selectedEpisode.fluid_dextrose_percent}
          currentRateMlHr={selectedEpisode.fluid_rate_ml_hr}
          onClose={() => setShowFlowsheetModal(false)}
          onSuccess={() => {
            setShowFlowsheetModal(false);
            loadEpisodeDetail(selectedEpisode.id);
          }}
        />
      )}
    </div>
  );
};
