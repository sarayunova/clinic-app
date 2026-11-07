import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getNeonatalHypoglycemiaEpisodes,
  updateNeonatalHypoglycemiaEpisode,
  type NeonatalHypoglycemiaRecord,
} from '../api';

export const NeonatalHypoglycemiaPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalHypoglycemiaRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNeonatalHypoglycemiaEpisodes({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setEpisodes(res.episodes);
    } catch (err: any) {
      setError(err.message || 'Failed to load neonatal hypoglycemia records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [statusFilter]);

  const handleUpdateStatus = async (id: number, newStatus: any) => {
    try {
      await updateNeonatalHypoglycemiaEpisode(id, { status: newStatus });
      fetchEpisodes();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-800 to-sky-900 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-semibold mb-2">
            <span>NICU / Special Care Nursery Registry</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Neonatal Hypoglycemia, GIR & aEEG Seizure Console
          </h1>
          <p className="text-blue-100 mt-2 max-w-2xl text-sm leading-relaxed">
            AAP 2011 Postnatal Glucose Homeostasis, continuous Glucose Infusion Rate (GIR) stewardship, D10W mini-boluses, and bedside aEEG neuro-monitoring per WHO/ILAE 2021 guidelines.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-center min-w-[180px]">
          <span className="text-xs uppercase tracking-wider text-blue-200 font-bold block">
            Active Glucose Protocols
          </span>
          <span className="text-3xl font-black mt-1 block">
            {episodes.filter((e) => e.status !== 'resolved').length}
          </span>
          <span className="text-[11px] text-blue-100">Infants on active surveillance</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-700">Status Filter:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border rounded-lg px-2.5 py-1.5 bg-gray-50 font-medium"
          >
            <option value="all">All Episodes ({episodes.length})</option>
            <option value="evaluating">Evaluating</option>
            <option value="active_infusion">Active IV GIR Infusion</option>
            <option value="stabilized_weaning">Stabilized / Weaning</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <button
          onClick={fetchEpisodes}
          className="px-3 py-1.5 border rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Refresh Registry
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-sm text-gray-500">Loading episodes...</div>
      ) : episodes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
          <p className="text-sm text-gray-600">No neonatal hypoglycemia episodes matching this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {episodes.map((ep) => (
            <div
              key={ep.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-mono font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md">
                      {ep.episode_code}
                    </span>
                    <div className="text-[11px] text-gray-500 mt-1">
                      Age: {ep.age_hours}h | Wt: {ep.current_weight_kg} kg
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize ${
                      ep.status === 'active_infusion'
                        ? 'bg-amber-100 text-amber-800'
                        : ep.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {ep.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-lg text-xs">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">Blood Sugar</span>
                    <span className="font-extrabold text-blue-900 text-base">
                      {ep.initial_blood_glucose_mg_dl} mg/dL
                    </span>
                    <span className="text-[10px] text-gray-500 block">Target: &gt;={ep.glucose_target_mg_dl}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">Active GIR</span>
                    <span className="font-extrabold text-emerald-700 text-base">
                      {ep.current_gir_mg_kg_min}
                    </span>
                    <span className="text-[10px] text-gray-500 block">mg/kg/min</span>
                  </div>
                </div>

                <div className="text-xs space-y-1 text-gray-700">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fluid Rx:</span>
                    <span className="font-medium">
                      {ep.fluid_dextrose_percent}% @ {ep.fluid_rate_ml_hr} mL/hr
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">D10W Bolus:</span>
                    <span className="font-medium">{ep.d10w_bolus_given_ml > 0 ? `${ep.d10w_bolus_given_ml} mL` : 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">aEEG Pattern:</span>
                    <span className="font-mono text-[11px] text-purple-800">
                      {ep.aeeg_background_pattern.slice(0, 15)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Seizures:</span>
                    <span className="font-medium text-purple-900">
                      {ep.seizure_activity_observed ? ep.seizure_type.replace(/_/g, ' ') : 'None'}
                    </span>
                  </div>
                </div>

                {ep.clinical_notes && (
                  <p className="text-xs text-gray-600 line-clamp-2 bg-gray-50/80 p-2 rounded border border-gray-100">
                    {ep.clinical_notes}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t flex justify-between items-center gap-2">
                <Link
                  to={`/patients/${ep.patient_id}?tab=neonatal_hypoglycemia`}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800"
                >
                  Open Chart &rarr;
                </Link>
                <div className="flex items-center gap-2">
                  <a
                    href={`/neonatal-hypoglycemia/${ep.id}/print`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-gray-600 hover:text-gray-900 underline"
                  >
                    Print
                  </a>
                  <select
                    value={ep.status}
                    onChange={(e) => handleUpdateStatus(ep.id, e.target.value)}
                    className="text-[11px] font-semibold border rounded px-1.5 py-0.5 bg-gray-50"
                  >
                    <option value="evaluating">Evaluating</option>
                    <option value="active_infusion">Active IV</option>
                    <option value="stabilized_weaning">Weaning</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
