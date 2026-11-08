import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalIntestinalAtresiaEpisodes, type NeonatalIntestinalAtresiaRecord } from '../api';

export const NeonatalIntestinalAtresiaPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalIntestinalAtresiaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalIntestinalAtresiaEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load neonatal intestinal atresia episodes:', err);
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
  const duodenalCount = episodes.filter(
    (e) => e.atresia_level === 'duodenal_atresia_complete' || e.atresia_level === 'duodenal_web_stenosis'
  ).length;
  const applePeelCount = episodes.filter(
    (e) => e.atresia_level === 'jejunoileal_atresia_type_3b_apple_peel'
  ).length;
  const t21Count = episodes.filter(
    (e) => e.karyotype_trisomy_21_confirmed === 1 || e.down_syndrome_features_present === 1
  ).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>👶</span> Neonatal Intestinal Atresia Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            AAP / APSA / BAPS: Duodenal Kimura Diamond Anastomosis • Trisomy 21 &amp; Cardiac Screening • Apple-Peel Short Bowel Protocol
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Atresia Cohort
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Duodenal &amp; Jejunoileal</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Duodenal Atresia / Web
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{duodenalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Double-bubble decompression</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Apple-Peel (Type IIIb)
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{applePeelCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Extreme short bowel risk</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Trisomy 21 / Syndromic
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{t21Count}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">ECHO / AVSD screening</div>
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
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Status:</span>
          <select
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="suspected">Suspected</option>
            <option value="preop_decompression">Pre-op Decompression</option>
            <option value="operative_intervention">Operative Intervention</option>
            <option value="postop_tat_feeds">Post-op TAT Feeds</option>
            <option value="tpn_dependent">TPN Dependent</option>
            <option value="recovering_full_enteral">Recovering Full Enteral</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading neonatal intestinal atresia episodes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No neonatal intestinal atresia episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Episode Code</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Atresia Level</th>
                  <th className="px-4 py-3">Age / Weight</th>
                  <th className="px-4 py-3">Gas Pattern</th>
                  <th className="px-4 py-3">T21 / Cardiac</th>
                  <th className="px-4 py-3">Decompression / Feeds</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                      {ep.episode_code}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=neonatal_intestinal_atresia`}
                        className="hover:underline text-indigo-600 dark:text-indigo-400 font-semibold"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {ep.atresia_level.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {ep.age_hours}h • {ep.weight_kg} kg
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {ep.radiographic_gas_pattern.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      {ep.karyotype_trisomy_21_confirmed === 1 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                          T21 Confirmed
                        </span>
                      ) : ep.down_syndrome_features_present === 1 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          T21 Suspected
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">Non-syndromic</span>
                      )}
                      {ep.echocardiogram_cardiac_defect === 1 && (
                        <div className="text-[10px] text-red-600 font-bold mt-0.5">Cardiac Defect (ECHO)</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-600 dark:text-slate-400">
                      <div>Replogle: {ep.replogle_decompression_active === 1 ? 'Active' : 'No'}</div>
                      <div>TAT: {ep.transanastomotic_tube_placed === 1 ? 'Yes' : 'No'} | TPN: {ep.tpn_central_line_in_situ === 1 ? 'Yes' : 'No'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 capitalize">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=neonatal_intestinal_atresia`}
                        className="px-2 py-1 text-xs rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 font-semibold"
                      >
                        Chart Tab
                      </Link>
                      <Link
                        to={`/neonatal-intestinal-atresia/${ep.id}/print`}
                        className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300"
                      >
                        Print 🖨
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
