import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricOsteomyelitisEpisodes, type PediatricOsteomyelitisRecord } from '../api';

export const PediatricOsteomyelitisPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricOsteomyelitisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricOsteomyelitisEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load pediatric osteomyelitis episodes:', err);
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
  const surgicalCount = episodes.filter((e) => e.surgical_decompression_performed === 1 || e.abscess_size_depth_mm >= 3.0).length;
  const oralStepCount = episodes.filter((e) => e.status === 'oral_step_down_therapy').length;
  const mrsaCount = episodes.filter((e) => e.isolated_pathogen === 'staphylococcus_aureus_mrsa').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🦴</span> Pediatric Acute Hematogenous Osteomyelitis (AHO) Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            AAP / PIDS / IDSA / ESPID: Kocher Criteria Triage • Subperiosteal Abscess Decompression • CRP Kinetics &amp; Early Oral Switch
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total AHO Cases
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Bone &amp; joint infections</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Subperiosteal Abscess / Surgical
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{surgicalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Cortical window &amp; I&amp;D</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Oral Step-Down Phase
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{oralStepCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">CRP lysis &gt;30-50%</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            CA-MRSA Isolated
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{mrsaCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Vancomycin / Clindamycin</div>
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

        <div className="w-56">
          <select
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Care Stages</option>
            <option value="initial_iv_empiric_therapy">Initial IV Empiric Phase</option>
            <option value="surgical_drainage_and_culture">Surgical Drainage &amp; Culture</option>
            <option value="pathogen_directed_iv_therapy">Pathogen-Directed IV</option>
            <option value="oral_step_down_therapy">Oral Step-Down Recovery</option>
            <option value="resolved_treatment_completed">Treatment Completed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading osteomyelitis protocols...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No matching protocols found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Episode Code</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Bone &amp; Side</th>
                  <th className="px-4 py-3">Kocher Criteria</th>
                  <th className="px-4 py-3">Peak CRP</th>
                  <th className="px-4 py-3">Subperiosteal Abscess</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-white">
                      {ep.episode_code}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=pediatric_osteomyelitis`}
                        className="text-blue-600 hover:underline"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-semibold">{ep.laterality.toUpperCase()} {ep.bone_involved.replace(/_/g, ' ')}</div>
                      <div className="text-slate-400">{ep.age_years} yrs • {ep.weight_kg} kg</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {ep.kocher_fever_gt_38_5 + ep.kocher_non_weight_bearing + ep.kocher_esr_gt_40 + ep.kocher_wbc_gt_12k} / 4
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-red-600">
                      {ep.crp_peak_mg_l} mg/L
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {ep.abscess_size_depth_mm >= 3.0 ? (
                        <span className="text-red-600 font-bold">{ep.abscess_size_depth_mm} mm (Drainage!)</span>
                      ) : ep.abscess_size_depth_mm > 0 ? (
                        <span>{ep.abscess_size_depth_mm} mm (Borderline)</span>
                      ) : (
                        <span className="text-emerald-600 font-medium">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=pediatric_osteomyelitis`}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        Open Chart
                      </Link>
                      <Link
                        to={`/pediatric-osteomyelitis/${ep.id}/print`}
                        className="text-xs text-slate-600 dark:text-slate-400 hover:underline font-medium"
                        target="_blank"
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
