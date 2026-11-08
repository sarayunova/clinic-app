import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricKawasakiEpisodes, type PediatricKawasakiRecord } from '../api';

export const PediatricKawasakiPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricKawasakiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricKawasakiEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load Kawasaki episodes:', err);
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

  const activeInfusions = episodes.filter(e => e.status === 'ivig_infusion_in_progress').length;
  const highRiskCount = episodes.filter(e => e.ivig_resistance_risk === 'high_risk').length;
  const aneurysmCount = episodes.filter(e => e.coronary_aneurysm_classification !== 'normal_z_lt_2').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>❤️</span> Pediatric Kawasaki Disease (KD) Protocol Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            AHA 2017 Guidelines: High-Dose IVIG & Aspirin, Kobayashi IVIG Resistance Scoring & Coronary Aneurysm Prevention
          </p>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 shadow-sm">
          <div className="text-xs font-bold text-amber-700 uppercase tracking-wider">IVIG In Progress</div>
          <div className="text-2xl font-black text-amber-900 mt-1">{activeInfusions}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">2 g/kg continuous infusion</div>
        </div>

        <div className="p-4 rounded-xl border border-red-200 bg-red-50/70 shadow-sm">
          <div className="text-xs font-bold text-red-700 uppercase tracking-wider">High Risk IVIG Resistance</div>
          <div className="text-2xl font-black text-red-900 mt-1">{highRiskCount}</div>
          <div className="text-[11px] text-red-600 mt-0.5">Kobayashi Score &ge; 5 points</div>
        </div>

        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 shadow-sm">
          <div className="text-xs font-bold text-rose-700 uppercase tracking-wider">Coronary Dilation/Aneurysm</div>
          <div className="text-2xl font-black text-rose-900 mt-1">{aneurysmCount}</div>
          <div className="text-[11px] text-rose-600 mt-0.5">Coronary Z-score &ge; 2.0</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Evaluated</div>
          <div className="text-2xl font-black text-slate-800 dark:text-white mt-1">{episodes.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Kawasaki presentations</div>
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
            <option value="active_diagnostic_workup">Active Diagnostic Workup</option>
            <option value="ivig_infusion_in_progress">IVIG Infusion in Progress</option>
            <option value="afebrile_post_ivig_monitoring">Afebrile Post-IVIG Monitoring</option>
            <option value="ivig_resistant_retreatment">IVIG-Resistant Retreatment</option>
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
          <div className="p-8 text-center text-slate-500">No matching Kawasaki episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Episode Code</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Age / Weight</th>
                  <th className="p-3">Classification</th>
                  <th className="p-3">Kobayashi Score</th>
                  <th className="p-3">Coronary Z-Score</th>
                  <th className="p-3">IVIG Dose</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                    <td className="p-3 font-mono font-bold text-amber-700 dark:text-amber-400">
                      {ep.episode_code}
                    </td>
                    <td className="p-3 font-medium text-slate-900 dark:text-white">
                      <Link to={`/patients/${ep.patient_id}`} className="hover:underline">
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {ep.age_months}m | {ep.weight_kg} kg
                    </td>
                    <td className="p-3 capitalize font-semibold text-slate-800 dark:text-slate-200">
                      {ep.diagnosis_classification.replace(/_/g, ' ')}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ep.ivig_resistance_risk === 'high_risk'
                          ? 'bg-red-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}>
                        Score {ep.kobayashi_score} ({ep.ivig_resistance_risk.toUpperCase()})
                      </span>
                    </td>
                    <td className="p-3 font-bold">
                      {ep.lad_z_score || ep.rca_z_score ? (
                        <span className={Number(ep.lad_z_score || 0) >= 2.5 || Number(ep.rca_z_score || 0) >= 2.5 ? 'text-red-600' : 'text-slate-700'}>
                          LAD {ep.lad_z_score ?? '-'} | RCA {ep.rca_z_score ?? '-'}
                        </span>
                      ) : (
                        <span className="text-slate-400">Pending</span>
                      )}
                    </td>
                    <td className="p-3 text-blue-700 font-semibold">
                      {(ep.weight_kg * ep.ivig_dose_g_kg).toFixed(1)} g
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
                        href={`/pediatric-kawasaki/${ep.id}/print`}
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
