import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNeonatalHyperammonemiaEpisodes, type NeonatalHyperammonemiaRecord } from '../api';

export const NeonatalHyperammonemiaPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalHyperammonemiaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getNeonatalHyperammonemiaEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load neonatal hyperammonemia episodes:', err);
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
  const extremeCrisisCount = episodes.filter((e) => e.plasma_ammonia_umol_l >= 400).length;
  const crrtActiveCount = episodes.filter((e) => e.crrt_dialysis_active === 1 || e.crrt_dialysis_indicated === 1).length;
  const ucdCount = episodes.filter((e) => e.suspected_disorder_category === 'urea_cycle_disorder_ucd').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🧬</span> Neonatal Inborn Errors of Metabolism (IEM) Hyperammonemia Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ACMG / SIMD Guidelines: Toxic Hyperammonemia • Protein Cessation • Ammonul Scavengers • Emergency CRRT
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
          <div className="text-xs font-semibold text-red-600 uppercase tracking-wider">
            Extreme Crisis (&ge;400)
          </div>
          <div className="text-2xl font-black text-red-600 mt-1">{extremeCrisisCount}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
            CRRT / CVVHD Active
          </div>
          <div className="text-2xl font-black text-purple-600 mt-1">{crrtActiveCount}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-fuchsia-600 uppercase tracking-wider">
            Urea Cycle Defects
          </div>
          <div className="text-2xl font-black text-fuchsia-600 mt-1">{ucdCount}</div>
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
            <option value="acute_hyperammonemic_crisis">Acute Hyperammonemic Crisis</option>
            <option value="medical_scavenger_infusion">Medical Scavenger Infusion</option>
            <option value="emergency_crrt_hemodialysis">Emergency CRRT Hemodialysis</option>
            <option value="catabolism_reversal_stabilization">Catabolism Reversal</option>
            <option value="controlled_protein_reintroduction">Protein Reintroduction</option>
            <option value="convalescent_metabolic_maintenance">Convalescent Maintenance</option>
            <option value="neonatal_demise">Neonatal Demise</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading hyperammonemia records...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No matching episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-xs uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Episode</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Onset</th>
                  <th className="py-3 px-4">Ammonia / Blood Gas</th>
                  <th className="py-3 px-4">Suspected Disorder</th>
                  <th className="py-3 px-4">Scavengers / CRRT</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20">
                    <td className="py-3 px-4 font-bold text-purple-700 dark:text-purple-400">
                      <Link to={`/patients/${ep.patient_id}?tab=neonatal_hyperammonemia`}>
                        {ep.episode_code}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                      {ep.patient_name || `Patient #${ep.patient_id}`}
                      <div className="text-xs text-slate-400">{ep.age_hours}h • {ep.birth_weight_grams}g • {ep.gestational_age_weeks}w</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                      {ep.onset_datetime.replace('T', ' ')}
                    </td>
                    <td className="py-3 px-4">
                      <div className={`font-bold ${ep.plasma_ammonia_umol_l >= 250 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                        {ep.plasma_ammonia_umol_l} umol/L NH3
                      </div>
                      <div className="text-xs text-slate-500">{ep.blood_gas_acid_base_pattern.replace(/_/g, ' ')}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-semibold">{ep.suspected_disorder_category.replace(/_/g, ' ')}</div>
                      <div className="text-slate-400">{ep.urine_ketones_present ? 'Ketonuria +' : 'No Ketones'}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-semibold text-purple-700">
                        {ep.nitrogen_scavenger_ammonul_active ? 'Ammonul Active' : 'No Scavengers'}
                      </div>
                      <div className="text-slate-400">
                        {ep.crrt_dialysis_active ? 'CRRT Active' : `GIR ${ep.gir_mg_kg_min}`}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/patients/${ep.patient_id}?tab=neonatal_hyperammonemia`}
                          className="text-purple-600 hover:text-purple-800 font-medium"
                        >
                          View
                        </Link>
                        <a
                          href={`/neonatal-hyperammonemia/${ep.id}/print`}
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
