import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricVasaPreviaEpisodes, type ObstetricVasaPreviaRecord } from '../api';

export const ObstetricVasaPreviaPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricVasaPreviaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricVasaPreviaEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load Vasa Previa episodes:', err);
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
  const crashCesareanCount = episodes.filter((e) => e.status === 'emergent_crash_cesarean_section').length;
  const aptPositiveCount = episodes.filter((e) => e.apt_test_result === 'positive_fetal_hemoglobin_pink').length;
  const inpatientCount = episodes.filter((e) => e.status === 'inpatient_rupture_precautions').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🩸</span> Obstetric Vasa Previa & Exsanguination Emergency Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ACOG PB #204 / SMFM: Transvaginal Color Doppler &lt;2cm • Apt Alkali Denaturation • Category 1 Crash Delivery
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Cases
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {totalCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Vasa previa episodes</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            Inpatient Precautions
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {inpatientCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Continuous EFM & pelvic rest</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Apt Test Positive (Pink)
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
            {aptPositiveCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Confirmed fetal HbF blood loss</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Category 1 Crash CS
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {crashCesareanCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Immediate delivery performed</div>
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
            <option value="antenatal_surveillance">Antenatal Surveillance</option>
            <option value="inpatient_rupture_precautions">Inpatient Rupture Precautions</option>
            <option value="emergent_crash_cesarean_section">Category 1 Crash Cesarean</option>
            <option value="postpartum_neonatal_resuscitation">Postpartum Neonatal Resuscitation</option>
            <option value="resolved_maternal_neonatal_discharge">Resolved Discharge</option>
          </select>
        </div>
      </div>

      {/* Episodes Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading Vasa Previa protocols...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No matching Vasa Previa records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Episode Code</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">GA</th>
                  <th className="py-3 px-4">Distance to Os</th>
                  <th className="py-3 px-4">Bleeding / Apt</th>
                  <th className="py-3 px-4">CTG Tracing</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                    <td className="py-3 px-4 font-mono font-bold text-rose-700 dark:text-rose-400">
                      {ep.episode_code}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=obstetric_vasa_previa`}
                        className="hover:underline text-rose-700 dark:text-rose-400 font-semibold"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-800 dark:text-slate-200">
                      {ep.vasa_previa_type.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 font-semibold">{ep.gestational_age_weeks}w</td>
                    <td className="py-3 px-4 font-bold text-rose-700">
                      {ep.distance_to_internal_os_mm} mm
                    </td>
                    <td className="py-3 px-4">
                      {ep.vaginal_bleeding_present ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800">
                          Bleeding ({ep.apt_test_result === 'positive_fetal_hemoglobin_pink' ? 'Apt+ Pink' : 'Apt-'})
                        </span>
                      ) : (
                        <span className="text-slate-500">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        ep.ctg_pattern === 'category_3_sinusoidal_pattern' ? 'bg-red-200 text-red-900 font-bold' : 'bg-slate-100 dark:bg-slate-700 text-slate-700'
                      }`}>
                        {ep.ctg_pattern.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 capitalize">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=obstetric_vasa_previa`}
                        className="text-rose-600 hover:text-rose-800 font-semibold"
                      >
                        Open Chart
                      </Link>
                      <a
                        href={`/obstetric-vasa-previa/${ep.id}/print`}
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
