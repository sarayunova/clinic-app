import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFetalHydropsEpisodes, type FetalHydropsRecord } from '../api';

export const FetalHydropsPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<FetalHydropsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getFetalHydropsEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load fetal hydrops episodes:', err);
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
  const severeAnemiaCount = episodes.filter((e) => e.mca_psv_mom >= 1.5).length;
  const mirrorSyndromeCount = episodes.filter((e) => e.maternal_mirror_syndrome_suspected === 1 || e.maternal_generalized_anasarca === 1).length;
  const interventionActiveCount = episodes.filter((e) => e.status === 'in_utero_intervention_active').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🌊</span> Non-Immune Fetal Hydrops (NIHF) & Mirror Syndrome Registry
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            SMFM Consult Series #37 • MCA Doppler Velocimetry • In-Utero Transfusions & Shunts • Ballantyne Syndrome Surveillance
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
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Under MFM surveillance</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-red-200 dark:border-red-900 shadow-sm">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Severe Fetal Anemia
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{severeAnemiaCount}</div>
          <div className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">MCA PSV &ge; 1.5 MoM (IUT Candidates)</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-amber-200 dark:border-amber-900 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Mirror Syndrome
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{mirrorSyndromeCount}</div>
          <div className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">Maternal hydrops / anasarca</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 shadow-sm">
          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Intervention Active
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{interventionActiveCount}</div>
          <div className="text-xs text-indigo-600/80 dark:text-indigo-400/80 mt-1">IUT / Shunt / Transplacental</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[240px]">
          <input
            type="text"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
            placeholder="Search by episode code or patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Status:</label>
          <select
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="diagnostic_workup">Diagnostic Workup</option>
            <option value="in_utero_intervention_active">In-Utero Intervention Active</option>
            <option value="mirror_syndrome_monitoring">Mirror Syndrome Monitoring</option>
            <option value="fetal_hydrops_resolving">Fetal Hydrops Resolving</option>
            <option value="preterm_emergency_delivery">Preterm Emergency Delivery</option>
            <option value="resolved_neonatal_transition">Resolved / Neonatal Transition</option>
          </select>
        </div>
      </div>

      {/* Episodes Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading fetal hydrops episodes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No fetal hydrops records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Episode Code</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">GA</th>
                  <th className="px-4 py-3">Etiology</th>
                  <th className="px-4 py-3">Compartments</th>
                  <th className="px-4 py-3">MCA PSV</th>
                  <th className="px-4 py-3">Mirror Syndrome</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                      {ep.episode_code}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link to={`/patients/${ep.patient_id}`} className="text-blue-600 hover:underline">
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{ep.gestational_age_weeks}w</td>
                    <td className="px-4 py-3 text-xs capitalize">
                      {ep.suspected_etiology_category.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {ep.fetal_compartments_involved_count} spaces
                    </td>
                    <td className="px-4 py-3 font-mono font-bold">
                      <span className={ep.mca_psv_mom >= 1.5 ? 'text-red-600 dark:text-red-400' : ''}>
                        {ep.mca_psv_mom} MoM
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {ep.maternal_mirror_syndrome_suspected === 1 || ep.maternal_generalized_anasarca === 1 ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold dark:bg-red-900/40 dark:text-red-300">
                          ⚠️ Mirror Syn
                        </span>
                      ) : (
                        <span className="text-slate-400">Normal</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=fetal-hydrops`}
                        className="text-xs text-blue-600 font-semibold hover:underline"
                      >
                        Manage
                      </Link>
                      <Link
                        to={`/fetal-hydrops/${ep.id}/print`}
                        target="_blank"
                        className="text-xs text-slate-600 font-semibold hover:underline"
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
