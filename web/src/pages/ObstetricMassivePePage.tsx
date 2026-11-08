import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricMassivePeEpisodes, type ObstetricMassivePeRecord } from '../api';

export const ObstetricMassivePePage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricMassivePeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricMassivePeEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load obstetric massive PE episodes:', err);
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
  const shockCount = episodes.filter((e) => e.systolic_bp_mmhg < 90 || e.hemodynamic_instability_shock === 1).length;
  const thrombolysisCount = episodes.filter((e) => e.thrombolytic_therapy_administered === 1).length;
  const ufhActiveCount = episodes.filter((e) => e.systemic_ufh_infusion_active === 1).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🫀</span> Obstetric Massive Pulmonary Embolism (PE) Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            RCOG Green-top 37b / ESC Guidelines: Massive Shock, RV Strain, Alteplase Thrombolysis & UFH Titration
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
            Massive Shock (SBP &lt; 90)
          </div>
          <div className="text-2xl font-black text-red-600 mt-1">{shockCount}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
            Thrombolysis Infused
          </div>
          <div className="text-2xl font-black text-rose-600 mt-1">{thrombolysisCount}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-teal-600 uppercase tracking-wider">
            Therapeutic UFH Titration
          </div>
          <div className="text-2xl font-black text-teal-600 mt-1">{ufhActiveCount}</div>
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
            <option value="acute_massive_pe_resuscitation">Acute Massive PE Resuscitation</option>
            <option value="thrombolytic_infusion_icu">Thrombolytic Infusion ICU</option>
            <option value="therapeutic_heparin_titration">Therapeutic Heparin Titration</option>
            <option value="catheter_embolectomy_surgical">Catheter / Surgical Embolectomy</option>
            <option value="subacute_transition_lmwh">Subacute Transition to LMWH</option>
            <option value="convalescent_anticoagulation_plan">Convalescent Anticoagulation Plan</option>
            <option value="maternal_demise">Maternal Demise</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading obstetric PE records...</div>
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
                  <th className="py-3 px-4">BP / HR / SpO2</th>
                  <th className="py-3 px-4">Risk Tier</th>
                  <th className="py-3 px-4">Thrombolysis / UFH</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20">
                    <td className="py-3 px-4 font-bold text-rose-700 dark:text-rose-400">
                      <Link to={`/patients/${ep.patient_id}?tab=obstetric_massive_pe`}>
                        {ep.episode_code}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                      {ep.patient_name || `Patient #${ep.patient_id}`}
                      <div className="text-xs text-slate-400">{ep.gestational_age_weeks} wks • {ep.clinical_setting.replace(/_/g, ' ')}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                      {ep.onset_datetime.replace('T', ' ')}
                    </td>
                    <td className="py-3 px-4">
                      <div className={`font-bold ${ep.systolic_bp_mmhg < 90 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                        {ep.systolic_bp_mmhg} mmHg SBP
                      </div>
                      <div className="text-xs text-slate-500">{ep.heart_rate_bpm} bpm • {ep.spo2_percent}% SpO2</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-semibold">{ep.pe_risk_stratification.replace(/_/g, ' ')}</div>
                      <div className="text-slate-400">{ep.rv_dysfunction_echo_confirmed ? 'RV Strain +' : 'RV Normal'}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-semibold text-rose-700">{ep.thrombolytic_agent_dose.replace(/_/g, ' ')}</div>
                      <div className="text-slate-400">{ep.systemic_ufh_infusion_active ? `UFH (Target ${ep.target_aptt_seconds}s)` : 'No UFH'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/patients/${ep.patient_id}?tab=obstetric_massive_pe`}
                          className="text-rose-600 hover:text-rose-800 font-medium"
                        >
                          View
                        </Link>
                        <a
                          href={`/obstetric-massive-pe/${ep.id}/print`}
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
