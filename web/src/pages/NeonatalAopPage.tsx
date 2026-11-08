import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalAopEpisodes, type NeonatalAopRecord } from '../api';

export const NeonatalAopPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalAopRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalAopEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load AOP episodes:', err);
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🫁</span> Neonatal Apnea of Prematurity (AOP) Protocol Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            NICU Clinical Decision Support: Methylxanthine (Caffeine Citrate) Therapy, PCA Tracking & Weaning Readiness
          </p>
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
            <option value="active_treatment">Active Treatment</option>
            <option value="dose_escalation_refractory">Dose Escalation / Refractory</option>
            <option value="weaning_phase">Weaning Phase</option>
            <option value="caffeine_discontinued_monitoring">Discontinued Monitoring</option>
            <option value="resolved_discharged">Resolved / Discharged</option>
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
          <div className="p-8 text-center text-slate-500">No matching AOP episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Episode Code</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">GA / Chron / PCA</th>
                  <th className="p-3">Weight</th>
                  <th className="p-3">Subtype & Freq</th>
                  <th className="p-3">Caffeine Dose</th>
                  <th className="p-3">Weaning Ready</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {ep.episode_code}
                    </td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">
                      <Link to={`/patients/${ep.patient_id}`} className="hover:underline">
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="p-3">
                      {ep.gestational_age_weeks}w + {ep.chronological_age_days}d ({ep.post_conceptional_age_weeks}w PCA)
                    </td>
                    <td className="p-3 font-semibold">{ep.current_weight_kg} kg</td>
                    <td className="p-3 capitalize">
                      {ep.apnea_subtype} ({ep.apnea_frequency_per_24h}/24h)
                    </td>
                    <td className="p-3 font-semibold text-emerald-600">
                      Load: {ep.caffeine_loading_dose_mg_kg} mg/kg | Maint: {ep.caffeine_maintenance_dose_mg_kg_day} mg/kg/d
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ep.weaning_eligible
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {ep.weaning_eligible ? 'ELIGIBLE' : 'NOT READY'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 font-bold uppercase tracking-wider text-[10px] border border-indigo-200 dark:border-indigo-800">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=neonatal-aop`}
                        className="rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-1 font-semibold hover:bg-indigo-100"
                      >
                        Chart View
                      </Link>
                      <a
                        href={`/neonatal-aop/${ep.id}/print`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1 font-semibold hover:bg-slate-200"
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
