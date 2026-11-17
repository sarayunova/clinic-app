import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalSeizuresEpisodes, type NeonatalSeizuresRecord } from '../api';

export const NeonatalSeizuresPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalSeizuresRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalSeizuresEpisodes();
      setEpisodes(res.episodes || []);
    } catch (err) {
      console.error('Failed to load neonatal seizures episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, []);

  const filtered = episodes.filter((ep) => {
    const matchesSearch =
      ep.episode_number.toLowerCase().includes(search.toLowerCase()) ||
      (ep.patient_name && ep.patient_name.toLowerCase().includes(search.toLowerCase())) ||
      ep.seizure_semiology.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ep.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCount = episodes.length;
  const statusEpilepticusCount = episodes.filter((e) => e.seizure_duration_category === 'status_epilepticus').length;
  const phenoLoadedCount = episodes.filter((e) => e.first_line_phenobarbital_given === 1).length;
  const refractoryCount = episodes.filter((e) => e.cumulative_phenobarbital_mg_kg >= 20 || e.second_line_given === 1).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>⚡</span> Neonatal Seizures & Status Epilepticus Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            WHO Guidelines (2023) • ILAE Semiology Classification • Weight-Based Phenobarbital & Metabolic Rescue Pathway
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Cohort
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Neonatal seizures tracked</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-red-200 dark:border-red-900 shadow-sm">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Status Epilepticus
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{statusEpilepticusCount}</div>
          <div className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">&ge; 30 min / 50% runtime</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-blue-200 dark:border-blue-900 shadow-sm">
          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Phenobarbital Loaded
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{phenoLoadedCount}</div>
          <div className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">20 mg/kg 1st line bolus</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-amber-200 dark:border-amber-900 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Refractory / Escalated
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{refractoryCount}</div>
          <div className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">2nd line / B6 trial active</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[240px]">
          <input
            type="text"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
            placeholder="Search by episode number, patient name, semiology..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Status:</span>
          <select
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="stabilized">Stabilized</option>
            <option value="resolved">Resolved</option>
            <option value="transferred">Transferred</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading neonatal seizure cohorts...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No neonatal seizure records found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Episode #</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Gest / Postnatal / Wt</th>
                  <th className="px-4 py-3">Semiology & Duration</th>
                  <th className="px-4 py-3">Etiology</th>
                  <th className="px-4 py-3">ASM Status</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {ep.episode_number}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/patient/${ep.patient_id}`} className="text-blue-600 hover:underline font-medium">
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {ep.gestational_age_weeks}w • {ep.postnatal_age_days}d • {ep.current_weight_kg}kg
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-semibold text-slate-900 dark:text-white capitalize">
                        {ep.seizure_semiology.replace(/_/g, ' ')}
                      </div>
                      <div className="text-slate-400 capitalize">{ep.seizure_duration_category.replace(/_/g, ' ')}</div>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium uppercase">
                      {ep.suspected_etiology.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>PB: {ep.cumulative_phenobarbital_mg_kg} mg/kg</div>
                      {ep.second_line_given === 1 && (
                        <div className="text-amber-600 dark:text-amber-400 font-semibold">
                          2nd: {ep.second_line_anticonvulsant || 'Given'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          ep.status === 'active'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                            : ep.status === 'stabilized'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {ep.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link
                        to={`/patient/${ep.patient_id}`}
                        className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
                      >
                        View Bedside
                      </Link>
                      <a
                        href={`/protocols/neonatal-seizures/print/${ep.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 hover:bg-blue-100"
                      >
                        Print Dossier
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
