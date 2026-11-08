import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPediatricPyloricStenosisEpisodes, type PediatricPyloricStenosisRecord } from '../api';

export const PediatricPyloricStenosisPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricPyloricStenosisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getPediatricPyloricStenosisEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load Pyloric Stenosis episodes:', err);
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
            <span>🍼</span> Pediatric Infantile Hypertrophic Pyloric Stenosis (IHPS) Protocol Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pediatric Surgery Clinical Decision Support: Ultrasound Diagnostics, Metabolic Alkalosis Resuscitation & Pre-Op Clearance
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
            <option value="preop_fluid_resuscitation">Pre-Op Resuscitation</option>
            <option value="metabolically_cleared_for_or">Cleared for OR</option>
            <option value="surgery_in_progress">Surgery In Progress</option>
            <option value="postop_feeding_advancement">Post-Op Feeding</option>
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
          <div className="p-8 text-center text-slate-500">No matching IHPS episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Episode Code</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Age / Wt</th>
                  <th className="p-3">Ultrasound</th>
                  <th className="p-3">Cl- (≥100)</th>
                  <th className="p-3">HCO3- (≤28)</th>
                  <th className="p-3">UOP</th>
                  <th className="p-3">OR Cleared</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="p-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                      {ep.episode_code}
                    </td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">
                      <Link to={`/patients/${ep.patient_id}`} className="hover:underline">
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="p-3">
                      {ep.age_weeks} wks • {ep.weight_kg} kg
                    </td>
                    <td className="p-3 font-semibold">
                      {ep.pyloric_muscle_thickness_mm ?? '-'} mm / {ep.pyloric_channel_length_mm ?? '-'} mm
                    </td>
                    <td className={`p-3 font-bold ${ep.serum_chloride_meq_l >= 100 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {ep.serum_chloride_meq_l} mEq/L
                    </td>
                    <td className={`p-3 font-bold ${ep.serum_bicarbonate_meq_l <= 28 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {ep.serum_bicarbonate_meq_l} mEq/L
                    </td>
                    <td className={`p-3 font-bold ${ep.urine_output_ml_kg_hr >= 1.0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {ep.urine_output_ml_kg_hr} mL/kg/h
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ep.surgical_clearance_granted
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        }`}
                      >
                        {ep.surgical_clearance_granted ? 'CLEARED' : 'NOT READY'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 font-bold uppercase tracking-wider text-[10px] border border-amber-200 dark:border-amber-800">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=pediatric-pyloric-stenosis`}
                        className="rounded bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-1 font-semibold hover:bg-amber-100"
                      >
                        Chart View
                      </Link>
                      <a
                        href={`/pediatric-pyloric-stenosis/${ep.id}/print`}
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
