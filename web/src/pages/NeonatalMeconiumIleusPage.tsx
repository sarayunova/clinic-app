import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalMeconiumIleusEpisodes, type NeonatalMeconiumIleusRecord } from '../api';

export const NeonatalMeconiumIleusPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalMeconiumIleusRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalMeconiumIleusEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load Meconium Ileus episodes:', err);
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
  const surgicalCount = episodes.filter((e) => e.surgery_indicated === 1).length;
  const cfCount = episodes.filter((e) => e.family_history_cystic_fibrosis === 1 || e.cftr_gene_mutation_sent === 1).length;
  const enemaSuccessCount = episodes.filter((e) => e.enema_success_outcome === 'successful_evacuation_reflux_into_ileum').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🍼</span> Neonatal Meconium Ileus & Cystic Fibrosis Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            AAP Surgical / CF Foundation: Dilute Gastrografin Decompression & Bishop-Koop / Santulli Enterostomy
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Protocols
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {totalCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Neonatal episodes</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Enema Decompression Success
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {enemaSuccessCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Reflux into dilated ileum</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Surgical Enterostomies
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
            {surgicalCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Bishop-Koop / Santulli</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            CF Panel Surveillance
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {cfCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">CFTR gene screening sent</div>
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
            <option value="initial_contrast_decompression">Initial Contrast Decompression</option>
            <option value="repeat_enema_observation">Repeat Enema Observation</option>
            <option value="in_operating_room_enterostomy">In Operating Room (Enterostomy)</option>
            <option value="post_op_stoma_recovery">Post-Op Stoma Recovery</option>
            <option value="resolved_normal_stooling">Resolved / Normal Stooling</option>
          </select>
        </div>
      </div>

      {/* Episode Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading episodes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No matching Neonatal Meconium Ileus episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Episode Code</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Age / Weight</th>
                  <th className="p-3">Enema Outcome</th>
                  <th className="p-3">Microcolon</th>
                  <th className="p-3">Intervention</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Onset</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                    <td className="p-3 font-bold text-amber-600 dark:text-amber-400">
                      {ep.episode_code}
                    </td>
                    <td className="p-3">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=neonatal_meconium_ileus`}
                        className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="p-3">
                      {ep.age_hours}h • {ep.weight_kg} kg
                    </td>
                    <td className="p-3 capitalize">
                      {ep.enema_success_outcome.replace(/_/g, ' ')}
                    </td>
                    <td className="p-3">
                      {ep.microcolon_confirmed ? (
                        <span className="text-amber-600 font-semibold">Disuse Microcolon</span>
                      ) : (
                        <span className="text-slate-500">Normal</span>
                      )}
                    </td>
                    <td className="p-3">
                      {ep.surgery_indicated ? (
                        <span className="text-red-600 dark:text-red-400 font-bold">
                          Surgery: {ep.surgical_procedure_planned.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          Contrast Enema
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 capitalize">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">
                      {new Date(ep.onset_datetime).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=neonatal_meconium_ileus`}
                        className="text-blue-600 hover:underline font-semibold"
                      >
                        View
                      </Link>
                      <a
                        href={`/neonatal-meconium-ileus/${ep.id}/print`}
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
