import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricTolacEpisodes, type ObstetricTolacRecord } from '../api';

export const ObstetricTolacPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricTolacRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricTolacEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load TOLAC episodes:', err);
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

  const activeCount = episodes.filter(e => e.status === 'active_labor_efm_monitoring').length;
  const crashCount = episodes.filter(e => e.rupture_risk_tier === 'impending_or_active_uterine_rupture' || e.status === 'crash_cesarean_transfer').length;
  const successfulVbacCount = episodes.filter(e => e.status === 'successful_vbac').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🤰</span> Obstetric TOLAC & Impending Uterine Rupture Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ACOG Practice Bulletin No. 205: Grobman VBAC Probability, Continuous EFM Tracing & Crash Cesarean Mobilization
          </p>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 shadow-sm">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Active TOLAC Labors</div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{activeCount}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Continuous EFM & IUPC monitoring</div>
        </div>

        <div className="p-4 rounded-xl border border-red-200 bg-red-50/70 shadow-sm">
          <div className="text-xs font-bold text-red-700 uppercase tracking-wider">Impending Rupture / Crash</div>
          <div className="text-2xl font-black text-red-900 mt-1">{crashCount}</div>
          <div className="text-[11px] text-red-600 mt-0.5">Category-1 transfer indicated</div>
        </div>

        <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/70 shadow-sm">
          <div className="text-xs font-bold text-teal-700 uppercase tracking-wider">Successful VBACs</div>
          <div className="text-2xl font-black text-teal-900 mt-1">{successfulVbacCount}</div>
          <div className="text-[11px] text-teal-600 mt-0.5">Delivered safely with intact uterus</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Evaluated</div>
          <div className="text-2xl font-black text-slate-800 dark:text-white mt-1">{episodes.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Trial of labor assessments</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by code or patient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white"
          >
            <option value="all">All Statuses</option>
            <option value="eligible_tolac_counseled">Eligible TOLAC Counseled</option>
            <option value="active_labor_efm_monitoring">Active Labor EFM Monitoring</option>
            <option value="impending_rupture_detected">Impending Rupture Detected</option>
            <option value="crash_cesarean_transfer">Transfer for Crash CS</option>
            <option value="successful_vbac">Successful VBAC</option>
            <option value="elective_repeat_cesarean">Elective Repeat CS</option>
          </select>
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Showing {filtered.length} of {episodes.length} episodes
        </div>
      </div>

      {/* Episodes Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading episodes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No matching TOLAC episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Episode Code</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">GA / Prior Incision</th>
                  <th className="p-3">VBAC Probability</th>
                  <th className="p-3">EFM Tracing</th>
                  <th className="p-3">Rupture Risk Tier</th>
                  <th className="p-3">Contraindication</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                    <td className="p-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {ep.episode_code}
                    </td>
                    <td className="p-3 font-medium text-slate-900 dark:text-white">
                      <Link to={`/patients/${ep.patient_id}`} className="hover:underline">
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      <div className="font-semibold">{ep.gestational_age_weeks}w</div>
                      <div className="text-[10px] text-slate-500">{ep.prior_uterine_incision_type.replace(/_/g, ' ')}</div>
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-emerald-700">{ep.grobman_vbac_success_pct}%</span>
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300 capitalize">
                      {ep.efm_abnormality.replace(/_/g, ' ')}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ep.rupture_risk_tier === 'impending_or_active_uterine_rupture'
                          ? 'bg-red-600 text-white animate-pulse'
                          : ep.rupture_risk_tier === 'elevated_rupture_risk'
                          ? 'bg-orange-500 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}>
                        {ep.rupture_risk_tier.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3">
                      {ep.contraindications_present === 1 ? (
                        <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-bold">
                          CONTRAINDICATED
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-semibold">Eligible</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        Chart
                      </Link>
                      <a
                        href={`/obstetric-tolac/${ep.id}/print`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-slate-600 hover:text-slate-800"
                      >
                        Print
                      </a>
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
