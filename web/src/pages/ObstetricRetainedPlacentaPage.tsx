import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricRetainedPlacentaEpisodes, type ObstetricRetainedPlacentaRecord } from '../api';

export const ObstetricRetainedPlacentaPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricRetainedPlacentaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricRetainedPlacentaEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load Retained Placenta episodes:', err);
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
            <span>🩸</span> Obstetric Retained Placenta & MROP Protocol Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Labor & Delivery Decision Support: Third Stage Timing, IUV Oxytocin Trial, Emergent MROP in Theater & PPH Prevention
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
            <option value="under_conservative_management">Conservative Management</option>
            <option value="iuv_oxytocin_in_progress">IUV Oxytocin Trial</option>
            <option value="mrop_in_theater">MROP in Theater</option>
            <option value="post_removal_recovery">Post-Removal Recovery</option>
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
          <div className="p-8 text-center text-slate-500">No matching Retained Placenta episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Episode Code</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Blood Loss</th>
                  <th className="p-3">Stability</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">IUV Trial</th>
                  <th className="p-3">MROP Performed</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="p-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                      {ep.episode_code}
                    </td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">
                      <Link to={`/patients/${ep.patient_id}`} className="hover:underline">
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="p-3 font-bold">
                      {ep.third_stage_duration_minutes} min
                    </td>
                    <td className={`p-3 font-bold ${ep.estimated_blood_loss_ml >= 1000 ? 'text-red-600' : ep.estimated_blood_loss_ml >= 500 ? 'text-amber-600' : ''}`}>
                      {ep.estimated_blood_loss_ml} mL
                    </td>
                    <td className="p-3 capitalize">{ep.hemodynamic_stability.replace(/_/g, ' ')}</td>
                    <td className="p-3 capitalize">{ep.retained_placenta_type.replace(/_/g, ' ')}</td>
                    <td className="p-3">
                      {ep.iuv_oxytocin_attempted ? (ep.iuv_oxytocin_successful ? <span className="text-emerald-600 font-bold">Success ✓</span> : 'Failed') : 'Not trialed'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ep.mrop_performed
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {ep.mrop_performed ? 'PERFORMED' : 'PENDING'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-2 py-0.5 font-bold uppercase tracking-wider text-[10px] border border-rose-200 dark:border-rose-800">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=obstetric-retained-placenta`}
                        className="rounded bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2 py-1 font-semibold hover:bg-rose-100"
                      >
                        Chart View
                      </Link>
                      <a
                        href={`/obstetric-retained-placenta/${ep.id}/print`}
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
