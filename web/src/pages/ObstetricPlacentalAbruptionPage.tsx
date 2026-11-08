import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricPlacentalAbruptionEpisodes, type ObstetricPlacentalAbruptionRecord } from '../api';

export const ObstetricPlacentalAbruptionPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricPlacentalAbruptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricPlacentalAbruptionEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load Abruption episodes:', err);
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
  const grade3Count = episodes.filter((e) => e.page_classification_grade === 'grade_3_severe_maternal_shock_demise_or_dic').length;
  const mtpActiveCount = episodes.filter((e) => e.mtp_activated === 1).length;
  const hypofibrinogenemiaCount = episodes.filter((e) => e.serum_fibrinogen_mg_dl < 200).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🩸</span> Obstetric Placental Abruption & Coagulopathy Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ACOG Practice Bulletin No. 183 / RCOG Green-top: Page Classification & MTP Cryoprecipitate Resuscitation
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Abruptions
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {totalCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Obstetric episodes</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Grade 3 Severe (Shock/DIC)
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
            {grade3Count}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">High maternal-fetal risk</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            MTP Protocols Active
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {mtpActiveCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">1:1:1 Rapid transfusion</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Consumptive Fibrinogen (&lt;200)
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {hypofibrinogenemiaCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Cryoprecipitate indicated</div>
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
            <option value="emergent_stabilization">Emergent Stabilization</option>
            <option value="crash_cesarean_in_progress">Crash Cesarean in Progress</option>
            <option value="postpartum_dic_resuscitation">Postpartum DIC Resuscitation</option>
            <option value="stabilized_ward_observation">Stabilized Ward Observation</option>
            <option value="resolved_discharged">Resolved / Discharged</option>
          </select>
        </div>
      </div>

      {/* Episode Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading episodes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No matching Obstetric Placental Abruption episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Episode Code</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">GA (Wks)</th>
                  <th className="p-3">Page Grade</th>
                  <th className="p-3">Fibrinogen</th>
                  <th className="p-3">Shock Index</th>
                  <th className="p-3">Delivery Mode</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => {
                  const si = (ep.maternal_heart_rate / (ep.maternal_systolic_bp || 1)).toFixed(2);
                  return (
                    <tr key={ep.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                      <td className="p-3 font-bold text-rose-700 dark:text-rose-400">
                        {ep.episode_code}
                      </td>
                      <td className="p-3">
                        <Link
                          to={`/patients/${ep.patient_id}?tab=obstetric_placental_abruption`}
                          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {ep.patient_name || `Patient #${ep.patient_id}`}
                        </Link>
                      </td>
                      <td className="p-3 font-medium">
                        {ep.gestational_age_weeks} wks
                      </td>
                      <td className="p-3 capitalize">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ep.page_classification_grade === 'grade_3_severe_maternal_shock_demise_or_dic'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {ep.page_classification_grade.replace('grade_', 'Grade ')}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-rose-600 dark:text-rose-400">
                        {ep.serum_fibrinogen_mg_dl} mg/dL
                      </td>
                      <td className={`p-3 font-bold ${parseFloat(si) >= 0.9 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {si}
                      </td>
                      <td className="p-3 capitalize font-medium">
                        {ep.delivery_mode_indicated.replace(/_/g, ' ')}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 capitalize">
                          {ep.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <Link
                          to={`/patients/${ep.patient_id}?tab=obstetric_placental_abruption`}
                          className="text-blue-600 hover:underline font-semibold"
                        >
                          View
                        </Link>
                        <a
                          href={`/obstetric-placental-abruption/${ep.id}/print`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        >
                          Print 🖨
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
