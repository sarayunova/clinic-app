import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getPediatricSepticShockEpisodes,
  updatePediatricSepticShockEpisode,
  type PediatricSepticShockRecord,
} from '../api';

export const PediatricSepticShockPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricSepticShockRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPediatricSepticShockEpisodes({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setEpisodes(res.episodes);
    } catch (err: any) {
      setError(err.message || 'Failed to load septic shock episodes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [statusFilter]);

  const handleUpdateStatus = async (id: number, newStatus: any) => {
    try {
      await updatePediatricSepticShockEpisode(id, { status: newStatus });
      fetchEpisodes();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-800 to-rose-900 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-semibold mb-2">
            <span>Pediatric ER & PICU Critical Care Console</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Pediatric Septic Shock & VIS Resuscitation Console
          </h1>
          <p className="text-blue-100 mt-2 max-w-2xl text-sm leading-relaxed">
            PALS & Surviving Sepsis Campaign Children 2020 algorithm: cold vs. warm shock recognition, balanced crystalloid safety titration, and continuous Vasoactive-Inotropic Score (VIS) surveillance.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-center min-w-[180px]">
          <span className="text-xs uppercase tracking-wider text-blue-200 font-bold block">
            Active Resuscitations
          </span>
          <span className="text-3xl font-black mt-1 block">
            {episodes.filter((e) => e.status === 'resuscitating' || e.status === 'fluid_refractory').length}
          </span>
          <span className="text-[11px] text-blue-100">Children in acute resuscitation</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold border rounded-lg px-3 py-1.5 bg-gray-50 border-gray-300"
          >
            <option value="all">All Resuscitations</option>
            <option value="resuscitating">Resuscitating</option>
            <option value="fluid_refractory">Fluid-Refractory</option>
            <option value="picu_transferred">Transferred to PICU</option>
            <option value="stabilized">Stabilized</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <button
          onClick={fetchEpisodes}
          className="text-xs text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1"
        >
          <span>🔄</span> Refresh Roster
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Episode Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-500 text-sm">Loading pediatric septic shock records...</div>
        ) : episodes.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            No pediatric septic shock episodes found matching the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left divide-y divide-gray-200">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Episode</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Age / Weight</th>
                  <th className="px-4 py-3">Phenotype</th>
                  <th className="px-4 py-3">Crystalloids Administered</th>
                  <th className="px-4 py-3">VIS Score</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {episodes.map((ep) => (
                  <tr key={ep.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-900">
                      <div>{ep.episode_code}</div>
                      <span className="text-[10px] text-gray-400 font-normal">
                        {new Date(ep.recognition_datetime).toLocaleDateString()}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        to={`/patients/${ep.patient_id}`}
                        className="font-bold text-indigo-700 hover:underline"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                      <div className="text-[10px] text-gray-400">{ep.patient_uhid}</div>
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      <div>{ep.weight_kg} kg</div>
                      <span className="text-gray-500 text-[10px]">{ep.age_months} months</span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          ep.shock_phenotype === 'cold_shock'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {ep.shock_phenotype.replace('_', ' ')}
                      </span>
                      <div className="text-[10px] text-gray-500 mt-0.5 capitalize">
                        1st-line: {ep.first_line_vasoactive}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900">{ep.cumulative_fluid_ml_kg} mL/kg</div>
                      <span
                        className={`text-[10px] font-semibold ${
                          ep.fluid_overload_alert ? 'text-red-600' : 'text-gray-500'
                        }`}
                      >
                        {ep.fluid_overload_alert ? '⚠️ Overload Alert' : `${ep.cumulative_fluid_ml} mL`}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-sm font-black text-indigo-900">{ep.current_vis_score}</div>
                      <span
                        className={`text-[10px] font-bold ${
                          ep.current_vis_score >= 20
                            ? 'text-rose-700'
                            : ep.current_vis_score >= 10
                            ? 'text-amber-700'
                            : 'text-gray-500'
                        }`}
                      >
                        {ep.current_vis_score >= 20 ? 'Critical' : ep.current_vis_score >= 10 ? 'Moderate' : 'Low'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={ep.status}
                        onChange={(e) => handleUpdateStatus(ep.id, e.target.value)}
                        className={`text-xs font-bold rounded-lg px-2 py-1 border ${
                          ep.status === 'resuscitating'
                            ? 'bg-red-50 text-red-800 border-red-300'
                            : ep.status === 'fluid_refractory'
                            ? 'bg-purple-50 text-purple-800 border-purple-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        <option value="resuscitating">Resuscitating</option>
                        <option value="fluid_refractory">Fluid-Refractory</option>
                        <option value="picu_transferred">PICU Transferred</option>
                        <option value="stabilized">Stabilized</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </td>

                    <td className="px-4 py-3 text-right space-x-2">
                      <a
                        href={`/patients/${ep.patient_id}/pediatric-septic-shock/${ep.id}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold text-[11px]"
                      >
                        🖨️ Dossier
                      </a>
                      <Link
                        to={`/patients/${ep.patient_id}`}
                        className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded font-semibold text-[11px]"
                      >
                        Open Chart
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
