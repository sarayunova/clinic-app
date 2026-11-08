import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getObstetricEcvEpisodes, type ObstetricEcvRecord } from '../api';

export const ObstetricEcvPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricEcvRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const res = await getObstetricEcvEpisodes();
      setEpisodes(res.episodes);
    } catch (err) {
      console.error('Failed to load ECV episodes:', err);
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

  const successfulCount = episodes.filter(e => e.ecv_outcome === 'successful_cephalic_conversion').length;
  const tocolysisCount = episodes.filter(e => e.terbutaline_given === 1).length;
  const rhNegCount = episodes.filter(e => e.maternal_rh_negative === 1).length;
  const emergencyCsCount = episodes.filter(e => e.ecv_outcome === 'emergency_cesarean_transfer').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🔄</span> Obstetric External Cephalic Version (ECV) Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ACOG & RCOG Breech Conversion Protocol: Terbutaline Tocolysis, Rh Anti-D Prophylaxis & Continuous EFM Safety
          </p>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 shadow-sm">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Successful Versions</div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{successfulCount}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Cephalic presentation achieved</div>
        </div>

        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/70 shadow-sm">
          <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Tocolysis Premedicated</div>
          <div className="text-2xl font-black text-indigo-900 mt-1">{tocolysisCount}</div>
          <div className="text-[11px] text-indigo-600 mt-0.5">Terbutaline 0.25 mg SC given</div>
        </div>

        <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/70 shadow-sm">
          <div className="text-xs font-bold text-purple-700 uppercase tracking-wider">Rh-Negative Mothers</div>
          <div className="text-2xl font-black text-purple-900 mt-1">{rhNegCount}</div>
          <div className="text-[11px] text-purple-600 mt-0.5">Anti-D & Kleihauer-Betke protocol</div>
        </div>

        <div className="p-4 rounded-xl border border-red-200 bg-red-50/70 shadow-sm">
          <div className="text-xs font-bold text-red-700 uppercase tracking-wider">Emergency Deliveries</div>
          <div className="text-2xl font-black text-red-900 mt-1">{emergencyCsCount}</div>
          <div className="text-[11px] text-red-600 mt-0.5">Persistent FHR bradycardia CS</div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search code or patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs text-gray-500 whitespace-nowrap">Status Filter:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-2.5 py-1 text-xs bg-gray-50"
          >
            <option value="all">All Statuses</option>
            <option value="pre_procedure_assessment">Pre-Procedure</option>
            <option value="tocolysis_in_progress">Tocolysis Active</option>
            <option value="version_attempts_active">Version Active</option>
            <option value="successful_monitoring_discharge">Successful & Monitored</option>
            <option value="emergency_delivery_transfer">Emergency Transfer</option>
            <option value="elective_cesarean_scheduled">Elective CS</option>
          </select>
        </div>
      </div>

      {/* Episodes Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mb-2"></div>
            <p className="text-xs">Loading ECV episodes...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-xs">
            No ECV protocol records match your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                <tr>
                  <th className="py-2.5 px-4">Episode Code</th>
                  <th className="py-2.5 px-4">Patient</th>
                  <th className="py-2.5 px-4">GA / Parity</th>
                  <th className="py-2.5 px-4">Initial Lie</th>
                  <th className="py-2.5 px-4">AFI / Weight</th>
                  <th className="py-2.5 px-4">Success Prob</th>
                  <th className="py-2.5 px-4">Outcome</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-800">
                {filtered.map((ep) => (
                  <tr key={ep.id} className="hover:bg-gray-50">
                    <td className="py-2.5 px-4 font-mono font-bold text-indigo-900">
                      {ep.episode_code}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-gray-900">
                      <Link to={`/patients/${ep.patient_id}`} className="hover:underline text-indigo-600">
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                    </td>
                    <td className="py-2.5 px-4">
                      {ep.gestational_age_weeks}w &middot; P{ep.maternal_parity}
                    </td>
                    <td className="py-2.5 px-4 capitalize font-medium">
                      {ep.fetal_presentation_initial.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-4">
                      {ep.amniotic_fluid_index_cm} cm &middot; {ep.estimated_fetal_weight_g} g
                    </td>
                    <td className="py-2.5 px-4 font-bold text-indigo-700">
                      {ep.calculated_success_probability_pct}%
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          ep.ecv_outcome === 'successful_cephalic_conversion'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ep.ecv_outcome === 'emergency_cesarean_transfer'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {ep.ecv_outcome === 'successful_cephalic_conversion' ? 'Cephalic (+)' : ep.ecv_outcome.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-800">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-2">
                      <Link
                        to={`/patients/${ep.patient_id}?tab=obstetric_ecv`}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-semibold"
                      >
                        Open Chart
                      </Link>
                      <a
                        href={`#/print/obstetric-ecv/${ep.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[11px] font-medium"
                      >
                        🖨️ Dossier
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
