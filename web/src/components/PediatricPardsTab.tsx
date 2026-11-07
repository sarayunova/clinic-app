import React, { useState, useEffect } from 'react';
import {
  getPediatricPardsEpisodes,
  getPediatricPardsEpisode,
  updatePediatricPardsEpisode,
  deletePediatricPardsFlowsheet,
  type PediatricPardsRecord,
  type PediatricPardsFlowsheetRecord,
} from '../api';
import { PediatricPardsModal } from './PediatricPardsModal';
import { PardsVentFlowsheetModal } from './PardsVentFlowsheetModal';

interface Props {
  patientId: number;
}

export const PediatricPardsTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<PediatricPardsRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PediatricPardsRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<PediatricPardsFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);

  const fetchEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getPediatricPardsEpisodes({ patientId });
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
      const res = await getPediatricPardsEpisode(id);
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
      const res = await updatePediatricPardsEpisode(selectedEpisode.id, { status: newStatus });
      setSelectedEpisode(res.episode);
      setEpisodes(episodes.map((e) => (e.id === res.episode.id ? res.episode : e)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode || !window.confirm('Delete this ventilation flowsheet log?')) return;
    try {
      await deletePediatricPardsFlowsheet(selectedEpisode.id, logId);
      loadEpisodeDetail(selectedEpisode.id);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading PARDS ventilation records...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>Pediatric ARDS (PARDS) & PALICC-2 Ventilation Stewardship</span>
            <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
              PALICC-2 & PALS 2025
            </span>
          </h2>
          <p className="text-xs text-gray-500">
            Oxygenation Index (OI/OSI), Lung-Protective Mechanics (Driving Pressure &lt; 15) & Prone Positioning
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedEpisode && (
            <a
              href={`/pediatric-pards/${selectedEpisode.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 flex items-center gap-1.5"
            >
              Print Dossier
            </a>
          )}
          <button
            onClick={() => setShowEpisodeModal(true)}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1"
          >
            + Initiate PARDS Protocol
          </button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-sm text-gray-600">No PARDS ventilation episodes recorded for this patient.</p>
          <button
            onClick={() => setShowEpisodeModal(true)}
            className="mt-3 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700"
          >
            Initiate PARDS & PALICC-2 Ventilation
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
                      ? 'bg-indigo-600 text-white border-indigo-600'
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
                      Diagnosed: {new Date(selectedEpisode.diagnosis_datetime).toLocaleString()} ({selectedEpisode.trigger_cause.replace(/_/g, ' ')})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-600">Status:</span>
                    <select
                      value={selectedEpisode.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="text-xs font-semibold border rounded px-2 py-1 bg-gray-50"
                    >
                      <option value="acute_management">Acute Management</option>
                      <option value="stabilized_weaning">Stabilized / Weaning</option>
                      <option value="extubated">Extubated</option>
                      <option value="picu_stepdown">PICU Stepdown</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-lg">
                    <div className="text-[11px] text-indigo-700 font-semibold uppercase">PARDS Severity</div>
                    <div className="text-2xl font-black text-indigo-950 mt-0.5 uppercase">
                      {selectedEpisode.pards_severity.replace(/_/g, ' ')}
                    </div>
                    <div className="text-[11px] text-indigo-800 mt-1 font-semibold">
                      {selectedEpisode.calculated_oi !== null
                        ? `OI: ${selectedEpisode.calculated_oi}`
                        : selectedEpisode.calculated_osi !== null
                        ? `OSI: ${selectedEpisode.calculated_osi}`
                        : 'At Risk'}
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg">
                    <div className="text-[11px] text-blue-800 font-semibold uppercase">Vent Mechanics</div>
                    <div className="text-lg font-black text-blue-950 mt-0.5">
                      MAP {selectedEpisode.current_map_cmh2o} | PEEP {selectedEpisode.current_peep_cmh2o}
                    </div>
                    <div className="text-[11px] text-blue-800 mt-1">
                      FiO2: {selectedEpisode.current_fio2_percent}% | SpO2: {selectedEpisode.spo2_percent}%
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg">
                    <div className="text-[11px] text-emerald-700 font-semibold uppercase">Target Tidal Vol (Vt)</div>
                    <div className="text-xl font-black text-emerald-950 mt-0.5">
                      {selectedEpisode.target_tidal_volume_ml_min} - {selectedEpisode.target_tidal_volume_ml_max} mL
                    </div>
                    <div className="text-[11px] text-emerald-800 mt-1">
                      Weight: {selectedEpisode.predicted_body_weight_kg || selectedEpisode.weight_kg} kg
                    </div>
                  </div>

                  <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-lg">
                    <div className="text-[11px] text-purple-800 font-semibold uppercase">Adjuvants Active</div>
                    <div className="text-sm font-bold text-purple-950 mt-1">
                      {selectedEpisode.prone_positioning_active ? 'Prone Active' : 'Supine'}
                    </div>
                    <div className="text-[11px] text-purple-800 mt-1">
                      NMB: {selectedEpisode.neuromuscular_blockade_active ? 'Yes (Infusion)' : 'No'}
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
                    <h3 className="text-sm font-bold text-gray-900">Bedside PARDS Ventilation Mechanics Flowsheet</h3>
                    <p className="text-xs text-gray-500">Serial pressures, driving pressure, tidal volumes & ABG</p>
                  </div>
                  <button
                    onClick={() => setShowFlowsheetModal(true)}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700"
                  >
                    + Record Flowsheet Entry
                  </button>
                </div>

                {flowsheetLogs.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-500 border border-dashed rounded-lg">
                    No ventilation logs yet. Click "+ Record Flowsheet Entry" to record pressures & blood gas.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 border-y text-gray-600 font-semibold">
                        <tr>
                          <th className="py-2 px-2.5">Time</th>
                          <th className="py-2 px-2.5">Hour</th>
                          <th className="py-2 px-2.5">Pplat / PEEP</th>
                          <th className="py-2 px-2.5">Driving &Delta;P</th>
                          <th className="py-2 px-2.5">MAP / FiO2</th>
                          <th className="py-2 px-2.5">Tidal Vol (Vt)</th>
                          <th className="py-2 px-2.5">OI / OSI</th>
                          <th className="py-2 px-2.5">ABG (pH/PaO2/PCO2)</th>
                          <th className="py-2 px-2.5">Prone (h)</th>
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
                            <td className="py-2 px-2.5 font-mono">
                              {lg.plateau_pressure_cmh2o ?? '-'}/{lg.peep_cmh2o}
                            </td>
                            <td className="py-2 px-2.5">
                              <span
                                className={`px-2 py-0.5 rounded font-bold ${
                                  lg.calculated_driving_pressure_cmh2o != null && lg.calculated_driving_pressure_cmh2o >= 15
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {lg.calculated_driving_pressure_cmh2o != null ? `${lg.calculated_driving_pressure_cmh2o} cmH2O` : '-'}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 font-medium">
                              {lg.map_cmh2o} cmH2O @ {lg.fio2_percent}%
                            </td>
                            <td className="py-2 px-2.5 font-semibold">
                              {lg.tidal_volume_set_ml ? `${lg.tidal_volume_set_ml} mL` : '-'}
                              {lg.tidal_volume_measured_ml_kg ? ` (${lg.tidal_volume_measured_ml_kg} mL/kg)` : ''}
                            </td>
                            <td className="py-2 px-2.5 font-bold text-indigo-900">
                              {lg.calculated_oi !== null ? `OI: ${lg.calculated_oi}` : lg.calculated_osi !== null ? `OSI: ${lg.calculated_osi}` : '-'}
                            </td>
                            <td className="py-2 px-2.5 font-mono">
                              {lg.abg_ph ? `${lg.abg_ph} / ${lg.abg_pao2_mmhg ?? '-'} / ${lg.abg_pco2_mmhg ?? '-'}` : '-'}
                            </td>
                            <td className="py-2 px-2.5">{lg.prone_positioning_hours > 0 ? `${lg.prone_positioning_hours}h` : '-'}</td>
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
        <PediatricPardsModal
          patientId={patientId}
          onClose={() => setShowEpisodeModal(false)}
          onSuccess={(ep) => {
            setShowEpisodeModal(false);
            fetchEpisodes();
          }}
        />
      )}

      {showFlowsheetModal && selectedEpisode && (
        <PardsVentFlowsheetModal
          episodeId={selectedEpisode.id}
          weightKg={selectedEpisode.predicted_body_weight_kg || selectedEpisode.weight_kg}
          currentPeep={selectedEpisode.current_peep_cmh2o}
          currentMap={selectedEpisode.current_map_cmh2o}
          currentFio2={selectedEpisode.current_fio2_percent}
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
