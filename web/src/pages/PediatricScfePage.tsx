import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricScfeEpisodes, type PediatricScfeRecord } from '../api';

export const PediatricScfePage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricScfeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricScfeEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load pediatric SCFE episodes:', err);
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
  const unstableCount = episodes.filter(
    (e) => e.loder_stability === 'unstable_cannot_bear_weight'
  ).length;
  const severeSlipCount = episodes.filter(
    (e) => e.southwick_slip_angle_degrees > 50.0
  ).length;
  const contralateralCount = episodes.filter(
    (e) => e.contralateral_hip_prophylactic_pinning === 1 || e.endocrine_disorder_suspected === 1
  ).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🦴</span> Pediatric SCFE &amp; Loder Instability Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            POSNA / AAOS: Loder Stability AVN Risk • Southwick Slip Angle • Avoid Forceful Reduction • In-Situ Screw Fixation
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total SCFE Cohort
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Adolescent hip episodes</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Unstable SCFE
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{unstableCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">40–50% osteonecrosis risk</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Severe Slip (&gt; 50°)
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{severeSlipCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">High FAI &amp; arthrosis risk</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            Contralateral / Endocrine
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{contralateralCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Prophylactic pinning cohort</div>
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
            <option value="strict_bedrest_non_weight_bearing">Strict Bedrest Non-Weight Bearing</option>
            <option value="urgent_preop_radiographic_workup">Urgent Pre-op Radiographic Workup</option>
            <option value="in_situ_percutaneous_pinning_performed">In-Situ Pinning Performed</option>
            <option value="postop_protected_weight_bearing">Post-op Protected Weight Bearing</option>
            <option value="contralateral_surveillance">Contralateral Surveillance</option>
            <option value="resolved_physeal_fusion">Resolved (Physeal Fusion Complete)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading pediatric SCFE episodes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No pediatric SCFE episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Episode Code</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Side &amp; Age</th>
                  <th className="px-4 py-3">Loder Stability</th>
                  <th className="px-4 py-3">Southwick Angle</th>
                  <th className="px-4 py-3">Trethowan &amp; Knee Pain</th>
                  <th className="px-4 py-3">Procedure Performed</th>
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
                        to={`/patients/${ep.patient_id}?tab=pediatric_scfe`}
                        className="hover:underline text-amber-600 dark:text-amber-400 font-semibold"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-700 dark:text-slate-300">
                      {ep.affected_hip} hip • {ep.age_years}y ({ep.weight_kg} kg)
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ep.loder_stability === 'unstable_cannot_bear_weight' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'}`}>
                        {ep.loder_stability === 'unstable_cannot_bear_weight' ? 'Unstable (AVN 50%)' : 'Stable (AVN < 2%)'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {ep.southwick_slip_angle_degrees}°
                      <span className="block text-[10px] text-slate-500 font-normal">
                        {ep.southwick_slip_angle_degrees > 50 ? 'Severe' : ep.southwick_slip_angle_degrees >= 30 ? 'Moderate' : 'Mild'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        Klein: {ep.klein_line_trethowan_abnormal === 1 ? 'Positive' : 'Normal'}
                      </div>
                      {ep.referred_knee_thigh_pain === 1 && (
                        <div className="text-[10px] text-amber-600 font-semibold">Knee Pain Referral</div>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize text-[11px] text-slate-700 dark:text-slate-300">
                      {ep.surgical_procedure_performed.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 capitalize">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=pediatric_scfe`}
                        className="px-2 py-1 text-xs rounded bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 dark:text-amber-300 font-semibold"
                      >
                        Chart Tab
                      </Link>
                      <Link
                        to={`/pediatric-scfe/${ep.id}/print`}
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
