import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricHusEpisodes, type PediatricHusRecord } from '../api';

export const PediatricHusPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricHusRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricHusEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load HUS episodes:', err);
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
  const dialysisCount = episodes.filter((e) => e.dialysis_rrt_indicated === 1).length;
  const eculizumabCount = episodes.filter((e) => e.eculizumab_indicated === 1).length;
  const stage3Count = episodes.filter((e) => e.kdigo_aki_stage === 'stage_3_failure').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🔬</span> Pediatric Hemolytic Uremic Syndrome Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            IPNA Guidelines: Triad Assessment (MAHA + Thrombocytopenia + KDIGO AKI), Strict Antibiotic Avoidance & RRT
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total HUS Episodes
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {totalCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Pediatric episodes</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            KDIGO Stage 3 AKI
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
            {stage3Count}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Severe renal failure</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
            RRT / Dialysis Indicated
          </div>
          <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1">
            {dialysisCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">PD / CRRT ongoing</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            aHUS / Eculizumab Indicated
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
            {eculizumabCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">C5 terminal complement block</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[240px]">
          <input
            type="text"
            placeholder="Search by code, patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-white font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="active_fluid_electrolyte_management">Active Fluid & Electrolyte Management</option>
            <option value="dialysis_crrt_running">Dialysis / CRRT Running</option>
            <option value="eculizumab_infusion">Eculizumab Infusion</option>
            <option value="renal_recovery_phase">Renal Recovery Phase</option>
            <option value="resolved_normal_renal_function">Resolved / Normal Renal Function</option>
          </select>
        </div>
      </div>

      {/* Episode Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading episodes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No matching Pediatric HUS episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Episode Code</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Age / Wt</th>
                  <th className="p-3">Phenotype</th>
                  <th className="p-3">Platelets / Hb</th>
                  <th className="p-3">Cr / KDIGO</th>
                  <th className="p-3">Dialysis / RRT</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                    <td className="p-3 font-bold text-cyan-700 dark:text-cyan-400">
                      {ep.episode_code}
                    </td>
                    <td className="p-3">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=pediatric_hus`}
                        className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="p-3">
                      {ep.age_years} yrs • {ep.weight_kg} kg
                    </td>
                    <td className="p-3 capitalize">
                      {ep.hus_phenotype.replace(/_/g, ' ')}
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-amber-600 dark:text-amber-400">{ep.platelet_count.toLocaleString()}</span> • {ep.hemoglobin_g_dl} g/dL
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-cyan-600 dark:text-cyan-400">{ep.serum_creatinine_mg_dl}</span> mg/dL ({ep.kdigo_aki_stage.replace(/_/g, ' ')})
                    </td>
                    <td className="p-3 capitalize">
                      {ep.dialysis_rrt_indicated ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          {ep.dialysis_modality.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-medium">None (Medical)</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 capitalize">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=pediatric_hus`}
                        className="text-blue-600 hover:underline font-semibold"
                      >
                        View
                      </Link>
                      <a
                        href={`/pediatric-hus/${ep.id}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        Print 🖨
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
