import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricToxicologyEpisodes, type PediatricToxicologyRecord } from '../api';

export const PediatricToxicologyPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricToxicologyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricToxicologyEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load pediatric toxicology episodes:', err);
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
  const apapCount = episodes.filter((e) => e.substance_category === 'acetaminophen_paracetamol').length;
  const antidoteCount = episodes.filter((e) => e.antidote_indicated === 1).length;
  const hepaticCount = episodes.filter((e) => e.alt_u_l > 100 || e.ast_u_l > 100).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🧪</span> Pediatric Acute Toxic Ingestion & Antidote Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            AAP / ACMT Guidelines: Rumack-Matthew APAP Nomogram • IV NAC • Deferoxamine • Toxidromes & Endoscopy
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Active Cohort
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
            APAP Overdoses
          </div>
          <div className="text-2xl font-black text-amber-600 mt-1">{apapCount}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
            Antidote Administered
          </div>
          <div className="text-2xl font-black text-rose-600 mt-1">{antidoteCount}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-red-600 uppercase tracking-wider">
            Hepatotoxicity (ALT &gt; 100)
          </div>
          <div className="text-2xl font-black text-red-600 mt-1">{hepaticCount}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-3 flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by code or patient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="acute_poisoning_triage">Acute Poisoning Triage</option>
            <option value="antidote_infusion_active">Antidote Infusion Active</option>
            <option value="picu_organ_support_monitoring">PICU Organ Support</option>
            <option value="toxic_levels_clearing">Toxic Levels Clearing</option>
            <option value="convalescent_hepatic_recovery">Convalescent Hepatic Recovery</option>
            <option value="resolved_discharged_home">Resolved</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading toxicology records...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No matching episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-xs uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Episode</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Ingestion Time</th>
                  <th className="py-3 px-4">Substance</th>
                  <th className="py-3 px-4">Dose / Level</th>
                  <th className="py-3 px-4">Antidote</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20">
                    <td className="py-3 px-4 font-bold text-amber-700 dark:text-amber-400">
                      <Link to={`/patients/${ep.patient_id}?tab=pediatric_toxicology`}>
                        {ep.episode_code}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                      {ep.patient_name || `Patient #${ep.patient_id}`}
                      <div className="text-xs text-slate-400">{ep.age_years} yrs • {ep.weight_kg} kg</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                      {ep.ingestion_datetime.replace('T', ' ')}
                      <div className="text-slate-400">{ep.hours_post_ingestion}h post-ingestion</div>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      {ep.substance_category.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {ep.ingested_dose_mg_kg} mg/kg
                      </div>
                      <div className="text-xs text-slate-500">Level: {ep.serum_level_value}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-semibold text-rose-700">{ep.antidote_administered.replace(/_/g, ' ')}</div>
                      <div className="text-slate-400">{ep.rumack_matthew_line_breached ? 'Rumack Breached' : 'Subtoxic'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/patients/${ep.patient_id}?tab=pediatric_toxicology`}
                          className="text-amber-600 hover:text-amber-800 font-medium"
                        >
                          View
                        </Link>
                        <a
                          href={`/pediatric-toxicology/${ep.id}/print`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-slate-600 font-medium"
                        >
                          Print
                        </a>
                      </div>
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
