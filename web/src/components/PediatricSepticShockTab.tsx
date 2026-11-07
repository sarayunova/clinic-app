import React, { useState, useEffect, useCallback } from 'react';
import {
  getPediatricSepticShockEpisodes,
  getPediatricSepticShockEpisode,
  deletePediatricSepticShockEpisode,
  deletePediatricSepticShockFlowsheet,
  type PediatricSepticShockRecord,
  type PediatricSepticShockFlowsheetRecord,
} from '../api';
import { PediatricSepticShockModal } from './PediatricSepticShockModal';
import { SepticShockFlowsheetModal } from './SepticShockFlowsheetModal';

interface PediatricSepticShockTabProps {
  patientId: number;
  patientName: string;
}

export const PediatricSepticShockTab: React.FC<PediatricSepticShockTabProps> = ({
  patientId,
  patientName,
}) => {
  const [episodes, setEpisodes] = useState<PediatricSepticShockRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<PediatricSepticShockRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<PediatricSepticShockFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isShockModalOpen, setIsShockModalOpen] = useState<boolean>(false);
  const [isFlowsheetModalOpen, setIsFlowsheetModalOpen] = useState<boolean>(false);

  const fetchEpisodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPediatricSepticShockEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0) {
        const targetId = selectedEpisodeId && res.episodes.some((e) => e.id === selectedEpisodeId)
          ? selectedEpisodeId
          : res.episodes[0]!.id;
        setSelectedEpisodeId(targetId);
      } else {
        setSelectedEpisodeId(null);
        setCurrentEpisode(null);
        setFlowsheetLogs([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load septic shock episodes');
    } finally {
      setLoading(false);
    }
  }, [patientId, selectedEpisodeId]);

  const fetchEpisodeDetails = useCallback(async (id: number) => {
    try {
      const res = await getPediatricSepticShockEpisode(id);
      setCurrentEpisode(res.episode);
      setFlowsheetLogs(res.flowsheetLogs);
    } catch (err: any) {
      setError(err.message || 'Failed to load episode details');
    }
  }, []);

  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  useEffect(() => {
    if (selectedEpisodeId) {
      fetchEpisodeDetails(selectedEpisodeId);
    }
  }, [selectedEpisodeId, fetchEpisodeDetails]);

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this septic shock resuscitation record?')) return;
    try {
      await deletePediatricSepticShockEpisode(id);
      fetchEpisodes();
    } catch (err: any) {
      alert(err.message || 'Failed to delete record');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deletePediatricSepticShockFlowsheet(logId);
      if (selectedEpisodeId) fetchEpisodeDetails(selectedEpisodeId);
    } catch (err: any) {
      alert(err.message || 'Failed to delete log');
    }
  };

  const nextMinutes =
    flowsheetLogs.length > 0 && flowsheetLogs[flowsheetLogs.length - 1]
      ? flowsheetLogs[flowsheetLogs.length - 1]!.minutes_from_recognition + 15
      : 15;

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-800 to-rose-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧸</span>
            <h2 className="text-2xl font-bold tracking-tight">
              Pediatric Septic Shock & VIS Resuscitation Engine
            </h2>
          </div>
          <p className="text-blue-100 text-sm mt-1 max-w-2xl">
            Surviving Sepsis Campaign Pediatric (2020) & PALS resuscitation guidelines. Cold vs. warm shock differentiation, crystalloid titration with fluid overload safety stops, and continuous Vasoactive-Inotropic Score (VIS) surveillance.
          </p>
        </div>

        <button
          onClick={() => setIsShockModalOpen(true)}
          className="px-5 py-2.5 bg-white text-indigo-900 hover:bg-blue-50 font-bold rounded-xl shadow-md transition-all text-sm flex items-center gap-2"
        >
          <span>➕</span> New Shock Resuscitation
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {loading && episodes.length === 0 ? (
        <div className="py-12 text-center text-gray-500">Loading septic shock records...</div>
      ) : episodes.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl text-gray-500">
          <p className="text-base font-semibold">No septic shock episodes recorded for this pediatric patient.</p>
          <p className="text-xs text-gray-400 mt-1">
            Initiate a resuscitation protocol if signs of sepsis with impaired perfusion or hypotension are present.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Episode List (Sidebar) */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Episodes History</h3>
            <div className="space-y-2">
              {episodes.map((ep) => {
                const isSelected = ep.id === selectedEpisodeId;
                return (
                  <div
                    key={ep.id}
                    onClick={() => setSelectedEpisodeId(ep.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50 border-blue-400 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm text-gray-900">{ep.episode_code}</span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          ep.status === 'resuscitating'
                            ? 'bg-red-100 text-red-800'
                            : ep.status === 'fluid_refractory'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {ep.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600">
                      Phenotype: <span className="font-semibold capitalize text-gray-900">{ep.shock_phenotype.replace('_', ' ')}</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      Fluids: <span className="font-semibold text-gray-900">{ep.cumulative_fluid_ml_kg} mL/kg</span> | VIS:{' '}
                      <span className="font-bold text-indigo-700">{ep.current_vis_score}</span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      {new Date(ep.recognition_datetime).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Episode Detail View */}
          {currentEpisode && (
            <div className="lg:col-span-3 space-y-6">
              {/* Overview Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-gray-100 gap-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-gray-900">{currentEpisode.episode_code}</h3>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                          currentEpisode.shock_phenotype === 'cold_shock'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {currentEpisode.shock_phenotype.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Recognized: {new Date(currentEpisode.recognition_datetime).toLocaleString()} | Weight:{' '}
                      <span className="font-semibold">{currentEpisode.weight_kg} kg</span> ({currentEpisode.age_months} months)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/patients/${patientId}/pediatric-septic-shock/${currentEpisode.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <span>🖨️</span> Dossier
                    </a>
                    <button
                      onClick={() => handleDeleteEpisode(currentEpisode.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Hemodynamic & Perfusion Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50/70 p-4 rounded-xl border border-gray-100 text-xs">
                  <div>
                    <span className="text-gray-500 block">Initial Vitals (HR/BP):</span>
                    <span className="font-bold text-gray-800 text-sm">
                      {currentEpisode.heart_rate_bpm} bpm | {currentEpisode.sbp}/{currentEpisode.dbp} ({currentEpisode.map_mmhg} MAP)
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Capillary Refill / Temp:</span>
                    <span className="font-bold text-gray-800 text-sm">
                      {currentEpisode.capillary_refill_seconds}s ({currentEpisode.extremity_temperature.replace('_', ' ')})
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">First-Line Vasoactive:</span>
                    <span className="font-bold text-indigo-700 text-sm uppercase">
                      {currentEpisode.first_line_vasoactive} Infusion
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Mental Status (AVPU):</span>
                    <span className="font-bold text-gray-800 text-sm uppercase">
                      {currentEpisode.mental_status}
                    </span>
                  </div>
                </div>

                {/* Resuscitation Status Strips */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div
                    className={`border rounded-xl p-3.5 text-xs space-y-1 ${
                      currentEpisode.fluid_overload_alert
                        ? 'bg-red-50 border-red-300'
                        : 'bg-blue-50/50 border-blue-200'
                    }`}
                  >
                    <span className="font-bold text-blue-900 block uppercase tracking-wider text-[11px]">
                      Cumulative Crystalloid Resuscitation
                    </span>
                    <div className="text-xl font-black text-blue-900">
                      {currentEpisode.cumulative_fluid_ml} mL ({currentEpisode.cumulative_fluid_ml_kg} mL/kg)
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {currentEpisode.fluid_overload_alert
                        ? '⚠️ Overload Alert: Fluids Held'
                        : 'Pre-bolus safety checks clear'}
                    </div>
                  </div>

                  <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-3.5 text-xs space-y-1">
                    <span className="font-bold text-indigo-900 block uppercase tracking-wider text-[11px]">
                      Vasoactive-Inotropic Score (VIS)
                    </span>
                    <div className="text-xl font-black text-indigo-900">
                      {currentEpisode.current_vis_score}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {currentEpisode.current_vis_score >= 20
                        ? 'Severe Tier (VIS ≥ 20)'
                        : currentEpisode.current_vis_score >= 10
                        ? 'Moderate Inotrope Support'
                        : 'Low / Minimal Support'}
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1">
                    <span className="font-bold text-slate-800 block uppercase tracking-wider text-[11px]">
                      Refractory Shock & Steroids
                    </span>
                    <div className="text-gray-800">
                      Fluid-Refractory:{' '}
                      <span className="font-bold">
                        {currentEpisode.fluid_refractory ? 'Yes (≥ 40 mL/kg)' : 'No'}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Hydrocortisone: {currentEpisode.stress_hydrocortisone_administered ? '✅ Given' : 'Not given'}
                    </div>
                  </div>
                </div>

                {/* Flowsheet Log Chronology */}
                <div className="pt-4 border-t border-gray-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                        <span>⏱️</span> Resuscitation Timeline & VIS Flowsheet
                      </h4>
                      <p className="text-xs text-gray-500">
                        Serial 15-minute vital sign tracking, crystalloid boluses, and vasoactive titration.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsFlowsheetModalOpen(true)}
                      className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <span>➕</span> Log Flowsheet Checkpoint
                    </button>
                  </div>

                  {flowsheetLogs.length === 0 ? (
                    <div className="py-6 text-center bg-gray-50 border border-gray-200 rounded-xl text-gray-400 text-xs">
                      No flowsheet checkpoints logged yet. Click above to record serial vitals, boluses, or inotropes.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="min-w-full text-xs text-left divide-y divide-gray-200">
                        <thead className="bg-gray-50 text-gray-600 font-semibold">
                          <tr>
                            <th className="px-3 py-2">Min</th>
                            <th className="px-3 py-2">Time</th>
                            <th className="px-3 py-2">HR (bpm)</th>
                            <th className="px-3 py-2">BP (MAP)</th>
                            <th className="px-3 py-2">Cap Refill</th>
                            <th className="px-3 py-2">Bolus / Total Fluids</th>
                            <th className="px-3 py-2">Vasoactives (VIS)</th>
                            <th className="px-3 py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {flowsheetLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-bold text-gray-900">{log.minutes_from_recognition}m</td>
                              <td className="px-3 py-2 text-gray-500">
                                {new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-3 py-2 font-bold text-gray-800">{log.heart_rate_bpm ?? '-'}</td>
                              <td className="px-3 py-2">
                                <span className="font-semibold text-gray-900">
                                  {log.sbp}/{log.dbp}
                                </span>{' '}
                                <span className="text-indigo-700 font-bold text-[11px]">({log.map_mmhg} MAP)</span>
                              </td>
                              <td className="px-3 py-2 text-gray-700">
                                {log.capillary_refill_seconds ? `${log.capillary_refill_seconds}s` : '-'}
                              </td>
                              <td className="px-3 py-2">
                                {log.bolus_fluid_volume_ml > 0 ? (
                                  <span className="font-bold text-blue-700">
                                    +{log.bolus_fluid_volume_ml} mL ({log.bolus_fluid_type})
                                  </span>
                                ) : (
                                  <span className="text-gray-400">No bolus</span>
                                )}
                                <div className="text-[10px] text-gray-500">Total: {log.total_fluid_ml_kg} mL/kg</div>
                              </td>
                              <td className="px-3 py-2">
                                <span className="font-black text-indigo-900">VIS: {log.vis_score}</span>
                                <div className="text-[10px] text-gray-500">
                                  {[
                                    log.epinephrine_mcg_kg_min > 0 ? `Epi ${log.epinephrine_mcg_kg_min}` : '',
                                    log.norepinephrine_mcg_kg_min > 0 ? `Norepi ${log.norepinephrine_mcg_kg_min}` : '',
                                    log.dopamine_mcg_kg_min > 0 ? `Dopa ${log.dopamine_mcg_kg_min}` : '',
                                  ]
                                    .filter(Boolean)
                                    .join(', ') || 'No infusions'}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => handleDeleteLog(log.id)}
                                  className="text-red-500 hover:text-red-700 text-xs"
                                >
                                  ✕
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
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <PediatricSepticShockModal
        patientId={patientId}
        patientName={patientName}
        isOpen={isShockModalOpen}
        onClose={() => setIsShockModalOpen(false)}
        onSuccess={(newEp) => {
          setSelectedEpisodeId(newEp.id);
          fetchEpisodes();
        }}
      />

      {currentEpisode && (
        <SepticShockFlowsheetModal
          episodeId={currentEpisode.id}
          patientId={patientId}
          weightKg={currentEpisode.weight_kg}
          currentTotalFluidMl={currentEpisode.cumulative_fluid_ml}
          defaultMinutes={nextMinutes}
          isOpen={isFlowsheetModalOpen}
          onClose={() => setIsFlowsheetModalOpen(false)}
          onSuccess={() => {
            fetchEpisodeDetails(currentEpisode.id);
          }}
        />
      )}
    </div>
  );
};
