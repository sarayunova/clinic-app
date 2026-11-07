import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getNeonatalRdsEpisodes,
  getNeonatalRdsEpisode,
  updateNeonatalRdsEpisode,
  deleteNeonatalRdsEpisode,
  deleteNeonatalNivFlowsheet,
  type NeonatalRdsRecord,
  type NeonatalNivFlowsheetRecord,
} from '../api';
import { NeonatalRdsModal } from './NeonatalRdsModal';
import { NivFlowsheetModal } from './NivFlowsheetModal';

interface NeonatalRdsTabProps {
  patientId: number;
  patientName: string;
}

export const NeonatalRdsTab: React.FC<NeonatalRdsTabProps> = ({ patientId, patientName }) => {
  const [episodes, setEpisodes] = useState<NeonatalRdsRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<NeonatalRdsRecord | null>(null);
  const [flowsheetLogs, setFlowsheetLogs] = useState<NeonatalNivFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isRdsModalOpen, setIsRdsModalOpen] = useState<boolean>(false);
  const [isFlowsheetModalOpen, setIsFlowsheetModalOpen] = useState<boolean>(false);

  const fetchEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNeonatalRdsEpisodes({ patientId });
      setEpisodes(res.episodes);
      const first = res.episodes[0];
      if (first) {
        setSelectedEpisodeId(first.id);
        fetchDetails(first.id);
      } else {
        setSelectedEpisodeId(null);
        setActiveEpisode(null);
        setFlowsheetLogs([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load Neonatal RDS episodes');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async (id: number) => {
    try {
      const res = await getNeonatalRdsEpisode(id);
      setActiveEpisode(res.episode);
      setFlowsheetLogs(res.flowsheetLogs);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [patientId]);

  const handleSelectEpisode = (id: number) => {
    setSelectedEpisodeId(id);
    fetchDetails(id);
  };

  const handleStatusChange = async (newStatus: any) => {
    if (!activeEpisode) return;
    try {
      const res = await updateNeonatalRdsEpisode(activeEpisode.id, { status: newStatus });
      setActiveEpisode(res.episode);
      fetchEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update episode status');
    }
  };

  const handleDeleteEpisode = async () => {
    if (!activeEpisode || !window.confirm(`Delete RDS episode ${activeEpisode.episode_code}?`)) return;
    try {
      await deleteNeonatalRdsEpisode(activeEpisode.id);
      fetchEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete RDS episode');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!window.confirm('Delete this flowsheet checkpoint?')) return;
    try {
      await deleteNeonatalNivFlowsheet(logId);
      if (selectedEpisodeId) fetchDetails(selectedEpisodeId);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-sky-950 flex items-center gap-2">
            <span>🫁</span> Neonatal RDS, Bubble CPAP & LISA Surfactant
          </h2>
          <p className="text-xs text-gray-500">
            European Consensus Guidelines 2022/2023 • Silverman-Anderson, Downes, a/A ratio & Columella Surveillance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeEpisode && (
            <Link
              to={`/neonatal-rds/print/${activeEpisode.id}`}
              className="px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 rounded border flex items-center gap-1"
            >
              <span>🖨️</span> Print Dossier
            </Link>
          )}
          <button
            onClick={() => setIsRdsModalOpen(true)}
            className="px-3 py-1.5 text-xs font-bold bg-sky-700 hover:bg-sky-800 text-white rounded shadow flex items-center gap-1"
          >
            <span>+</span> Initiate RDS Protocol
          </button>
        </div>
      </div>

      {loading && <p className="text-center text-sm text-gray-500 py-6">Loading RDS episodes...</p>}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

      {!loading && episodes.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500 text-sm">No Neonatal RDS episodes recorded for {patientName}.</p>
          <button
            onClick={() => setIsRdsModalOpen(true)}
            className="mt-3 px-4 py-2 text-xs font-bold bg-sky-700 text-white rounded hover:bg-sky-800"
          >
            Initiate First RDS Protocol
          </button>
        </div>
      )}

      {episodes.length > 0 && activeEpisode && (
        <div className="space-y-6">
          {/* Episode Selector Tabs */}
          {episodes.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {episodes.map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => handleSelectEpisode(ep.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    selectedEpisodeId === ep.id
                      ? 'bg-sky-800 text-white border-sky-800 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {ep.episode_code} ({new Date(ep.onset_datetime).toLocaleDateString()}) - {ep.status.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}

          {/* Episode Hero Summary Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                  {activeEpisode.episode_code}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  Onset: {new Date(activeEpisode.onset_datetime).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={activeEpisode.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="text-xs font-semibold px-2.5 py-1 rounded border bg-sky-50 text-sky-900 border-sky-300"
                >
                  <option value="active_niv">Active NIV / Bubble CPAP</option>
                  <option value="surfactant_administered_stabilized">Surfactant Given / Stabilized</option>
                  <option value="escalated_to_invasive_ventilation">Escalated to Invasive CMV</option>
                  <option value="weaned_to_room_air">Weaned to Room Air</option>
                  <option value="discontinued">Discontinued</option>
                </select>
                <button
                  onClick={handleDeleteEpisode}
                  className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg border">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Gestational Age / Wt</span>
                <p className="text-sm font-bold text-gray-900">{activeEpisode.gestational_age_weeks}w • {activeEpisode.current_weight_kg} kg</p>
                <span className="text-[10px] text-gray-500">Birth Wt: {activeEpisode.birth_weight_kg} kg</span>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                <span className="text-[10px] font-bold text-indigo-700 uppercase">Silverman-Anderson</span>
                <p className="text-lg font-black text-indigo-900">{activeEpisode.silverman_anderson_score} / 10</p>
                <span className="text-[10px] text-indigo-700">{activeEpisode.silverman_anderson_score <= 3 ? 'Mild' : activeEpisode.silverman_anderson_score <= 6 ? 'Moderate' : 'Severe Failure'}</span>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                <span className="text-[10px] font-bold text-purple-700 uppercase">Downes Score</span>
                <p className="text-lg font-black text-purple-900">{activeEpisode.downes_score} / 10</p>
                <span className="text-[10px] text-purple-700">{activeEpisode.downes_score <= 3 ? 'Mild' : activeEpisode.downes_score <= 7 ? 'Significant' : 'Severe'}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">a/A Ratio & OI</span>
                <p className="text-sm font-bold text-emerald-950">a/A: {activeEpisode.a_a_ratio ?? 'N/A'}</p>
                <span className="text-[10px] text-emerald-800">OI: {activeEpisode.oxygenation_index ?? 'N/A'}</span>
              </div>
              <div className="p-3 bg-sky-50 rounded-lg border border-sky-100">
                <span className="text-[10px] font-bold text-sky-700 uppercase">Bubble CPAP PEEP</span>
                <p className="text-lg font-black text-sky-900">{activeEpisode.current_peep_cmh2o} cm H2O</p>
                <span className="text-[10px] text-sky-700">{activeEpisode.current_flow_lpm} LPM • FiO2 {activeEpisode.current_fio2_percent}%</span>
              </div>
            </div>

            {/* Surfactant & LISA Banner */}
            {activeEpisode.surfactant_indicated === 1 && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <span>💉</span> Surfactant Protocol: {activeEpisode.surfactant_brand?.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Dose: <span className="font-semibold">{activeEpisode.surfactant_total_dose_mg} mg</span> ({activeEpisode.surfactant_total_volume_ml} mL) via{' '}
                    <span className="font-semibold text-sky-900 uppercase">{activeEpisode.administration_method?.replace(/_/g, ' ')}</span>
                  </p>
                </div>
                <div className="text-right text-xs text-amber-900">
                  <span>Administered: {activeEpisode.surfactant_administered_at ? new Date(activeEpisode.surfactant_administered_at).toLocaleString() : 'Pending'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Flowsheet Table Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-sky-950 flex items-center gap-2">
                  <span>📊</span> Bedside Bubble CPAP Flowsheet & Columella Checks
                </h3>
                <p className="text-xs text-gray-500">
                  Continuous water seal bubbling, hourly Silverman/Downes progression, and septal skin surveillance.
                </p>
              </div>
              <button
                onClick={() => setIsFlowsheetModalOpen(true)}
                className="px-3 py-1.5 text-xs font-bold bg-sky-700 text-white rounded hover:bg-sky-800 shadow"
              >
                + Log Flowsheet Checkpoint
              </button>
            </div>

            {flowsheetLogs.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-6">
                No flowsheet checkpoints logged yet. Click above to record hourly vital signs and nasal columella check.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3 py-2 text-left">Time / Hr</th>
                      <th className="px-3 py-2 text-center">RR / HR</th>
                      <th className="px-3 py-2 text-center">SpO2</th>
                      <th className="px-3 py-2 text-center">Silverman / Downes</th>
                      <th className="px-3 py-2 text-center">PEEP / Flow / FiO2</th>
                      <th className="px-3 py-2 text-center">Nasal Columella Check</th>
                      <th className="px-3 py-2 text-center">ABG (pH / PaCO2 / PaO2)</th>
                      <th className="px-3 py-2 text-left">Notes / Nurse</th>
                      <th className="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {flowsheetLogs.map((log) => {
                      const columellaBadgeColor =
                        log.nasal_columella_skin_check === 'intact'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.nasal_columella_skin_check === 'erythema'
                          ? 'bg-amber-100 text-amber-800 font-bold'
                          : 'bg-red-100 text-red-800 font-bold';

                      return (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 whitespace-nowrap font-medium text-gray-900">
                            <div>Hr {log.hours_on_protocol}</div>
                            <div className="text-[10px] text-gray-400">{new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            {log.respiratory_rate_bpm} bpm • {log.heart_rate_bpm} bpm
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap font-bold text-blue-700">
                            {log.spo2_percent}%
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap font-semibold">
                            {log.silverman_score} / {log.downes_score}
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap font-medium text-sky-900">
                            {log.peep_cmh2o} cmH2O • {log.flow_lpm} L • {log.fio2_percent}%
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${columellaBadgeColor}`}>
                              {log.nasal_columella_skin_check.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap text-gray-600">
                            {log.arterial_blood_gas_ph ? `${log.arterial_blood_gas_ph} / ${log.arterial_pco2_mmhg} / ${log.arterial_pao2_mmhg}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 max-w-xs truncate">
                            {log.notes || '—'}
                            {log.logged_by_name && <div className="text-[10px] text-gray-400">By {log.logged_by_name}</div>}
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleDeleteLog(log.id)}
                              className="text-red-500 hover:text-red-700 font-bold"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <NeonatalRdsModal
        patientId={patientId}
        patientName={patientName}
        isOpen={isRdsModalOpen}
        onClose={() => setIsRdsModalOpen(false)}
        onSuccess={() => {
          setIsRdsModalOpen(false);
          fetchEpisodes();
        }}
      />

      {activeEpisode && (
        <NivFlowsheetModal
          rdsEpisodeId={activeEpisode.id}
          isOpen={isFlowsheetModalOpen}
          onClose={() => setIsFlowsheetModalOpen(false)}
          onSuccess={() => {
            setIsFlowsheetModalOpen(false);
            fetchDetails(activeEpisode.id);
          }}
          defaultHoursOnProtocol={
            flowsheetLogs.length > 0 && flowsheetLogs[flowsheetLogs.length - 1]
              ? flowsheetLogs[flowsheetLogs.length - 1]!.hours_on_protocol + 1
              : 1
          }
          currentPeep={activeEpisode.current_peep_cmh2o}
          currentFlow={activeEpisode.current_flow_lpm}
          currentFio2={activeEpisode.current_fio2_percent}
        />
      )}
    </div>
  );
};
