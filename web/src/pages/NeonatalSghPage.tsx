import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalSghEpisodes, type NeonatalSghRecord } from '../api';

export const NeonatalSghPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalSghRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalSghEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load SGH episodes:', err);
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

  const activeCount = episodes.filter(e => e.status === 'active_resuscitation' || e.status === 'mtp_massive_transfusion').length;
  const mtpCount = episodes.filter(e => e.mtp_activated === 1).length;
  const criticalCount = episodes.filter(e => e.shock_state === 'life_threatening_circulatory_collapse').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🩸</span> Neonatal Subgaleal Hemorrhage (SGH) Resuscitation Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            AAP & BAPM Birth Trauma Protocol: Occult Blood Loss Quantification & Emergent Massive Transfusion (MTP)
          </p>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-red-200 bg-red-50/70 shadow-sm">
          <div className="text-xs font-bold text-red-700 uppercase tracking-wider">Active Resuscitations</div>
          <div className="text-2xl font-black text-red-900 mt-1">{activeCount}</div>
          <div className="text-[11px] text-red-600 mt-0.5">Critical ongoing fluid & blood therapy</div>
        </div>

        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 shadow-sm">
          <div className="text-xs font-bold text-rose-700 uppercase tracking-wider">MTP Triggered</div>
          <div className="text-2xl font-black text-rose-900 mt-1">{mtpCount}</div>
          <div className="text-[11px] text-rose-600 mt-0.5">PRBC, FFP, Cryoprecipitate activated</div>
        </div>

        <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/70 shadow-sm">
          <div className="text-xs font-bold text-orange-700 uppercase tracking-wider">Circulatory Collapse</div>
          <div className="text-2xl font-black text-orange-900 mt-1">{criticalCount}</div>
          <div className="text-[11px] text-orange-600 mt-0.5">&gt; 30% Blood Volume Loss</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Evaluated</div>
          <div className="text-2xl font-black text-slate-800 dark:text-white mt-1">{episodes.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Vacuum & forceps surveillance</div>
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
            <option value="active_resuscitation">Active Resuscitation</option>
            <option value="mtp_massive_transfusion">MTP Massive Transfusion</option>
            <option value="stabilized_monitoring">Stabilized Monitoring</option>
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
          <div className="p-8 text-center text-slate-500">No matching SGH episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Episode Code</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Delivery Mode</th>
                  <th className="p-3">Δ HC & Occult Loss</th>
                  <th className="p-3">Circulating Loss</th>
                  <th className="p-3">Shock State</th>
                  <th className="p-3">MTP Status</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                    <td className="p-3 font-mono font-bold text-red-700 dark:text-red-400">
                      {ep.episode_code}
                    </td>
                    <td className="p-3 font-medium text-slate-900 dark:text-white">
                      <Link to={`/patients/${ep.patient_id}`} className="hover:underline">
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {ep.delivery_mode.replace(/_/g, ' ')}
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-red-600">+{ep.hc_increase_cm} cm</span>
                      <span className="text-slate-400 ml-1">(~{ep.estimated_occult_blood_loss_ml} mL)</span>
                    </td>
                    <td className="p-3 font-bold">
                      <span className={ep.circulating_volume_loss_pct >= 20 ? 'text-red-600' : 'text-slate-700'}>
                        {ep.circulating_volume_loss_pct}% TBV
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ep.shock_state === 'life_threatening_circulatory_collapse'
                          ? 'bg-red-600 text-white'
                          : ep.shock_state === 'uncompensated_hypotensive_shock'
                          ? 'bg-orange-500 text-white'
                          : 'bg-yellow-500 text-white'
                      }`}>
                        {ep.shock_state.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3">
                      {ep.mtp_activated === 1 ? (
                        <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-bold">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="text-slate-400">Standby</span>
                      )}
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
                        href={`/neonatal-sgh/${ep.id}/print`}
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
