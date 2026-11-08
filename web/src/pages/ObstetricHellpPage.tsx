import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricHellpEpisodes, type ObstetricHellpRecord } from '../api';

export const ObstetricHellpPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricHellpRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricHellpEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load obstetric HELLP episodes:', err);
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
  const class1Count = episodes.filter((e) => e.platelet_count_per_ul < 50000).length;
  const hepaticRiskCount = episodes.filter(
    (e) =>
      e.hepatic_subcapsular_hematoma_suspected === 1 ||
      e.hepatic_imaging_performed === 'subcapsular_hematoma_contained' ||
      e.hepatic_imaging_performed === 'hepatic_rupture_hemoperitoneum'
  ).length;
  const dexPulseCount = episodes.filter((e) => e.dexamethasone_pulse_initiated === 1).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🩸</span> Obstetric HELLP Syndrome Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ACOG Practice Bulletin No. 222 • Mississippi Triple-Class • Subcapsular Hepatic Hematoma &amp; Rupture Surveillance
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total HELLP Cohort
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Maternal-fetal episodes</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            Mississippi Class 1 (&lt; 50k)
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{class1Count}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Severe thrombocytopenia</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Hepatic Hematoma / Rupture Risk
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{hepaticRiskCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Glisson capsule compromise</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Dexamethasone Pulse
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{dexPulseCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">10mg q12h x 2, 5mg q12h x 2</div>
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
            <option value="active_icu_resuscitation">Active ICU Resuscitation</option>
            <option value="operative_delivery">Operative Delivery</option>
            <option value="postpartum_stabilization">Postpartum Stabilization</option>
            <option value="recovering_platelets_rising">Recovering (Platelets Rising)</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading obstetric HELLP episodes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No obstetric HELLP episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Episode Code</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Gestational Age</th>
                  <th className="px-4 py-3">Platelets</th>
                  <th className="px-4 py-3">AST / ALT</th>
                  <th className="px-4 py-3">LDH / TBil</th>
                  <th className="px-4 py-3">Hepatic Imaging</th>
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
                        to={`/patients/${ep.patient_id}?tab=obstetric_hellp`}
                        className="hover:underline text-rose-600 dark:text-rose-400 font-semibold"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {ep.gestational_age_weeks} weeks
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                      {ep.platelet_count_per_ul.toLocaleString()} /µL
                      {ep.platelet_count_per_ul < 50000 && (
                        <span className="block text-[10px] text-red-600">Class 1</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {ep.ast_u_l} / {ep.alt_u_l} U/L
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {ep.ldh_u_l} U/L • {ep.total_bilirubin_mg_dl} mg/dL
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-[11px] text-slate-700 dark:text-slate-300">
                        {ep.hepatic_imaging_performed.replace(/_/g, ' ')}
                      </span>
                      {ep.epigastric_ruq_pain === 1 && (
                        <div className="text-[10px] text-rose-600 font-semibold">RUQ Pain Active</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 capitalize">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=obstetric_hellp`}
                        className="px-2 py-1 text-xs rounded bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:hover:bg-rose-900/60 dark:text-rose-300 font-semibold"
                      >
                        Chart Tab
                      </Link>
                      <Link
                        to={`/obstetric-hellp/${ep.id}/print`}
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
