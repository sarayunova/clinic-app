import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricAcuteLiverFailureEpisodes, type PediatricAcuteLiverFailureRecord } from '../api';

export const PediatricAcuteLiverFailurePage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricAcuteLiverFailureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricAcuteLiverFailureEpisodes();
      setEpisodes(res.episodes || []);
    } catch (err) {
      console.error('Failed to load pediatric acute liver failure episodes:', err);
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
      ep.suspected_etiology.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ep.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCount = episodes.length;
  const fulminantCount = episodes.filter((e) => e.encephalopathy_stage >= 2 || e.inr >= 3.0 || e.has_cerebral_edema === 1).length;
  const transplantAlertCount = episodes.filter((e) => e.transplant_center_contacted === 1).length;
  const nacActiveCount = episodes.filter((e) => e.nac_infusion_active === 1).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🫁</span> Pediatric Acute Liver Failure (PALF) & Neuroprotection Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            PALF Study Group Criteria • King&apos;s College Prognostic Indices • 3% NaCl / Mannitol Cerebral Edema Protocol & IV NAC
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
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">PALF episodes tracked</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-red-200 dark:border-red-900 shadow-sm">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Fulminant Liver Failure
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{fulminantCount}</div>
          <div className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">Grade &ge; 2 HE / INR &ge; 3.0 / Edema</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-purple-200 dark:border-purple-900 shadow-sm">
          <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            Transplant Center Contacted
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{transplantAlertCount}</div>
          <div className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-1">Emergency listing readiness</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            IV NAC Active
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{nacActiveCount}</div>
          <div className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">Antioxidant hepatic salvage</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[240px]">
          <input
            type="text"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
            placeholder="Search by episode number, patient name, etiology..."
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
          <div className="p-8 text-center text-slate-500">Loading PALF cohorts...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No PALF records found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Episode #</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Age / Wt</th>
                  <th className="px-4 py-3">Etiology</th>
                  <th className="px-4 py-3">INR & HE Grade</th>
                  <th className="px-4 py-3">Enzymes & Bili</th>
                  <th className="px-4 py-3">Neuroprotection</th>
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
                      {(ep.age_months / 12).toFixed(1)}y • {ep.weight_kg}kg
                    </td>
                    <td className="px-4 py-3 text-xs font-medium capitalize">
                      {ep.suspected_etiology.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-bold text-red-600 dark:text-red-400">INR: {ep.inr}</div>
                      <div>Grade {ep.encephalopathy_stage} HE</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>ALT: {ep.alt_u_l} | AST: {ep.ast_u_l}</div>
                      <div>Bili: {ep.total_bilirubin_mg_dl} mg/dL</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>3% NaCl: {ep.hypertonic_saline_3pct_active ? 'Yes' : 'No'}</div>
                      <div>NAC: {ep.nac_infusion_active ? 'Yes' : 'No'}</div>
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
                        href={`/protocols/palf/print/${ep.id}`}
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
