import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalEaTefEpisodes, type NeonatalEaTefRecord } from '../api';

export const NeonatalEaTefPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalEaTefRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalEaTefEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load EA/TEF episodes:', err);
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
  const typeCCount = episodes.filter((e) => e.gross_classification_type === 'type_c_ea_with_distal_tef').length;
  const rightArchCount = episodes.filter((e) => e.vacterl_right_aortic_arch === 1).length;
  const activeSumpCount = episodes.filter((e) => e.status === 'preop_replogle_sump_decompression').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🫁</span> Neonatal EA/TEF & Replogle Sump Suction Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            AAP / BAPS / ESPGHAN: Gross Types A-E • VACTERL Association • Right Arch Left Thoracotomy Lateralization
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
          <div className="text-[11px] text-slate-400 mt-0.5">EA/TEF episodes</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
            Gross Type C (Classic)
          </div>
          <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1">
            {typeCCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Distal TEF with aerated bowel</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Right Aortic Arch
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
            {rightArchCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Left thoracotomy mandated</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Pre-Op Replogle Sump
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {activeSumpCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">20-30 mmHg low suction</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <input
            type="text"
            placeholder="Search by episode code or patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-3.5 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
          >
            <option value="all">All Statuses</option>
            <option value="preop_replogle_sump_decompression">Pre-op Replogle Sump</option>
            <option value="in_operating_room_thoracotomy">In Operating Room</option>
            <option value="postop_transanastomotic_tube_recovery">Post-op Tube Recovery</option>
            <option value="esophagram_contrast_clearance">Esophagram Clearance</option>
            <option value="resolved_full_oral_feeding">Resolved Oral Feeding</option>
          </select>
        </div>
      </div>

      {/* Episodes Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading EA/TEF protocols...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No matching EA/TEF records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Episode Code</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Gross Type</th>
                  <th className="py-3 px-4">OG Arrest</th>
                  <th className="py-3 px-4">Replogle Suction</th>
                  <th className="py-3 px-4">Arch Laterality</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Consultant</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                    <td className="py-3 px-4 font-mono font-bold text-cyan-700 dark:text-cyan-400">
                      {ep.episode_code}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=neonatal_ea_tef`}
                        className="hover:underline text-cyan-700 dark:text-cyan-400 font-semibold"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {ep.gross_classification_type.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-amber-700">
                      {ep.og_tube_coiling_distance_cm} cm
                    </td>
                    <td className="py-3 px-4">
                      {ep.replogle_tube_in_situ ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-100 text-cyan-800">
                          {ep.replogle_suction_pressure_mmhg} mmHg
                        </span>
                      ) : (
                        <span className="text-red-600 font-bold">No Tube</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {ep.vacterl_right_aortic_arch ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800">
                          Right Arch (Left Thoracotomy)
                        </span>
                      ) : (
                        <span className="text-slate-500">Left Arch (Right Thoracotomy)</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 capitalize">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {ep.consultant_name || `User #${ep.consultant_id}`}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=neonatal_ea_tef`}
                        className="text-cyan-600 hover:text-cyan-800 font-semibold"
                      >
                        Open Chart
                      </Link>
                      <a
                        href={`/neonatal-ea-tef/${ep.id}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-600 hover:text-slate-800 font-semibold"
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
