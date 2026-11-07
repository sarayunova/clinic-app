import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getNeonatalRdsEpisodes,
  updateNeonatalRdsEpisode,
  type NeonatalRdsRecord,
} from '../api';

export const NeonatalRdsPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalRdsRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNeonatalRdsEpisodes({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setEpisodes(res.episodes);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Neonatal RDS console');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [statusFilter]);

  const handleStatusUpdate = async (id: number, newStatus: any) => {
    try {
      await updateNeonatalRdsEpisode(id, { status: newStatus });
      fetchEpisodes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const totalCount = episodes.length;
  const activeNivCount = episodes.filter(e => e.status === 'active_niv').length;
  const surfactantCount = episodes.filter(e => e.surfactant_indicated === 1).length;
  const severeRetractionsCount = episodes.filter(e => e.silverman_anderson_score >= 7 || e.downes_score >= 8).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-gradient-to-r from-sky-900 to-indigo-900 text-white p-6 rounded-2xl shadow-md">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <span>🫁</span> NICU Level-3 Neonatal RDS & Bubble CPAP Console
          </h1>
          <p className="text-sm text-sky-200 mt-1">
            European Consensus Guidelines (2022/2023) Protocol • LISA Surfactant, PEEP Titration & Nasal Columella Surveillance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/patients"
            className="px-4 py-2 bg-sky-700 hover:bg-sky-600 text-white rounded-lg text-xs font-bold shadow"
          >
            ← Patient Directory
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase">Total RDS Admissions</span>
          <p className="text-2xl font-black text-gray-900 mt-1">{totalCount}</p>
          <span className="text-xs text-gray-400">Recorded cases</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-sky-200 shadow-sm">
          <span className="text-xs font-bold text-sky-700 uppercase">Active Bubble CPAP / NIV</span>
          <p className="text-2xl font-black text-sky-900 mt-1">{activeNivCount}</p>
          <span className="text-xs text-sky-700">Non-invasive respiratory support</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
          <span className="text-xs font-bold text-amber-700 uppercase">Surfactant Administered</span>
          <p className="text-2xl font-black text-amber-800 mt-1">{surfactantCount}</p>
          <span className="text-xs text-amber-700">LISA / MIST or InSurE</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm">
          <span className="text-xs font-bold text-red-700 uppercase">Severe Distress (Score ≥ 7)</span>
          <p className="text-2xl font-black text-red-700 mt-1">{severeRetractionsCount}</p>
          <span className="text-xs text-red-600">Impending CPAP failure risk</span>
        </div>
      </div>

      {/* Filter and Table Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3 border-b pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700">Status Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border rounded-lg px-3 py-1.5 font-medium bg-gray-50 text-gray-800"
            >
              <option value="all">All Statuses</option>
              <option value="active_niv">Active NIV / Bubble CPAP</option>
              <option value="surfactant_administered_stabilized">Surfactant Stabilized</option>
              <option value="escalated_to_invasive_ventilation">Escalated to Invasive CMV</option>
              <option value="weaned_to_room_air">Weaned to Room Air</option>
              <option value="discontinued">Discontinued</option>
            </select>
          </div>
          <button
            onClick={fetchEpisodes}
            className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 border rounded-lg bg-gray-50"
          >
            ↻ Refresh Roster
          </button>
        </div>

        {loading && <p className="text-center text-sm text-gray-500 py-8">Loading RDS roster...</p>}
        {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

        {!loading && episodes.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No neonatal RDS episodes found matching the selected filter.
          </div>
        )}

        {!loading && episodes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3 py-2 text-left">Code / Date</th>
                  <th className="px-3 py-2 text-left">Neonate / UHID</th>
                  <th className="px-3 py-2 text-center">GA / Weight</th>
                  <th className="px-3 py-2 text-center">Silverman / Downes</th>
                  <th className="px-3 py-2 text-center">Bubble CPAP (PEEP / FiO2)</th>
                  <th className="px-3 py-2 text-center">Surfactant (LISA)</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {episodes.map((ep) => {
                  return (
                    <tr key={ep.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 font-mono font-bold text-sky-900">
                        <div>{ep.episode_code}</div>
                        <div className="text-[10px] text-gray-400 font-normal">
                          {new Date(ep.onset_datetime).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          to={`/patients/${ep.patient_id}?tab=neonatal_rds`}
                          className="font-bold text-sky-700 hover:underline"
                        >
                          {ep.patient_name}
                        </Link>
                        <div className="text-[10px] text-gray-400">{ep.patient_uhid}</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="font-semibold">{ep.gestational_age_weeks} weeks</div>
                        <div className="text-[10px] text-gray-500">{ep.current_weight_kg} kg</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          ep.silverman_anderson_score >= 7 ? 'bg-red-100 text-red-800' : 'bg-indigo-50 text-indigo-900'
                        }`}>
                          Silverman: {ep.silverman_anderson_score}
                        </span>
                        <div className="text-[10px] text-gray-500 mt-0.5">Downes: {ep.downes_score}</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="font-bold text-sky-800">{ep.current_peep_cmh2o} cm H2O</div>
                        <div className="text-[10px] text-gray-500">FiO2 {ep.current_fio2_percent}% • {ep.current_flow_lpm} LPM</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {ep.surfactant_indicated === 1 ? (
                          <div>
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                              {(ep.surfactant_brand?.split('_')[0] ?? 'SURFACTANT').toUpperCase()} ({ep.surfactant_total_volume_ml} mL)
                            </span>
                            <div className="text-[10px] text-gray-500 mt-0.5 uppercase">{ep.administration_method?.replace(/_/g, ' ')}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[10px]">CPAP alone</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <select
                          value={ep.status}
                          onChange={(e) => handleStatusUpdate(ep.id, e.target.value)}
                          className="text-[10px] font-bold px-2 py-1 rounded border bg-sky-50 text-sky-900 border-sky-300"
                        >
                          <option value="active_niv">Active NIV</option>
                          <option value="surfactant_administered_stabilized">Surfactant Stabilized</option>
                          <option value="escalated_to_invasive_ventilation">Escalated CMV</option>
                          <option value="weaned_to_room_air">Weaned Room Air</option>
                          <option value="discontinued">Discontinued</option>
                        </select>
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            to={`/patients/${ep.patient_id}?tab=neonatal_rds`}
                            className="px-2 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded font-semibold text-[10px]"
                          >
                            Chart Tab
                          </Link>
                          <Link
                            to={`/neonatal-rds/print/${ep.id}`}
                            className="px-2 py-1 bg-gray-100 text-gray-800 hover:bg-gray-200 rounded font-semibold text-[10px]"
                          >
                            🖨️ Dossier
                          </Link>
                        </div>
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
  );
};
