import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalAbdominalDefectsEpisodes, type NeonatalAbdominalDefectRecord } from '../api';

export const NeonatalAbdominalDefectsPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalAbdominalDefectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalAbdominalDefectsEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load abdominal wall defect episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, []);

  const filtered = episodes.filter((ep) => {
    const matchesSearch =
      ep.episode_code.toLowerCase().includes(search.toLowerCase()) ||
      (ep.patient_name && ep.patient_name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || ep.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCount = episodes.length;
  const gastroschisisCount = episodes.filter((e) => e.defect_type === 'gastroschisis').length;
  const omphaloceleCount = episodes.filter((e) => e.defect_type.startsWith('omphalocele')).length;
  const activeSiloCount = episodes.filter(
    (e) => e.status === 'initial_stabilization_silo_placement' || e.status === 'active_daily_serial_reduction'
  ).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>👶</span> Neonatal Abdominal Wall Defects (Gastroschisis vs Omphalocele) Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            APSA / AAP / BAPS: Spring-Loaded Staged Silo Reduction • Bladder Pressure IAH/ACS Surveillance • Beckwith-Wiedemann &amp; Cardiac Screening
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Defect Protocols
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active &amp; resolved cases</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
            Gastroschisis
          </div>
          <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1">{gastroschisisCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">High fluid loss, no sac</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            Omphalocele
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{omphaloceleCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Midline, syndromic risk</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Active Silo Reduction
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{activeSiloCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Serial manometry monitoring</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            placeholder="Search by episode code or patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="w-56">
          <select
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Care Stages</option>
            <option value="initial_stabilization_silo_placement">Initial Silo Placement</option>
            <option value="active_daily_serial_reduction">Active Daily Reduction</option>
            <option value="ready_for_fascial_closure">Ready for Fascial Closure</option>
            <option value="post_closure_compartment_monitoring">Post-Closure Monitoring</option>
            <option value="resolved_enteral_feeds_established">Resolved (Full Feeds)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading abdominal wall defect protocols...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No matching protocols found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Episode Code</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Defect Type</th>
                  <th className="px-4 py-3">Diameter</th>
                  <th className="px-4 py-3">Closure &amp; Silo</th>
                  <th className="px-4 py-3">Bladder P.</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-white">
                      {ep.episode_code}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=neonatal_abdominal_defects`}
                        className="text-blue-600 hover:underline"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                          ep.defect_type === 'gastroschisis'
                            ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                        }`}
                      >
                        {ep.defect_type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {ep.defect_diameter_cm} cm {ep.defect_diameter_cm >= 5.0 && <span className="text-red-500 font-bold">(Giant)</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>{ep.closure_approach.replace(/_/g, ' ')}</div>
                      <div className="text-slate-400">{ep.silo_height_cm ? `${ep.silo_height_cm} cm silo` : ep.silo_type}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${
                          ep.current_bladder_pressure_mmhg >= 15
                            ? 'text-red-600'
                            : ep.current_bladder_pressure_mmhg >= 12
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {ep.current_bladder_pressure_mmhg} mmHg
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=neonatal_abdominal_defects`}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        Open Chart
                      </Link>
                      <Link
                        to={`/neonatal-abdominal-defects/${ep.id}/print`}
                        className="text-xs text-slate-600 dark:text-slate-400 hover:underline font-medium"
                        target="_blank"
                      >
                        Print
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
