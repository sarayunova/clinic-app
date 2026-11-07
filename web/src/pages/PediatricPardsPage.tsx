import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getPediatricPardsEpisodes,
  updatePediatricPardsEpisode,
  type PediatricPardsRecord,
} from '../api';

export const PediatricPardsPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricPardsRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPediatricPardsEpisodes({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setEpisodes(res.episodes);
    } catch (err: any) {
      setError(err.message || 'Failed to load pediatric PARDS records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [statusFilter]);

  const handleUpdateStatus = async (id: number, newStatus: any) => {
    try {
      await updatePediatricPardsEpisode(id, { status: newStatus });
      fetchEpisodes();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-800 via-blue-900 to-slate-900 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-semibold mb-2">
            <span>PICU Respiratory Failure Registry</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Pediatric ARDS (PARDS) & PALICC-2 Ventilation Console
          </h1>
          <p className="text-indigo-200 mt-2 max-w-2xl text-sm leading-relaxed">
            Oxygenation Index (OI/OSI) severity classification, lung-protective mechanical ventilation mechanics (&Delta;P &lt; 15, Pplat &le; 28), tidal volume limits, and adjuvant prone positioning.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-center min-w-[180px]">
          <span className="text-xs uppercase tracking-wider text-indigo-300 font-bold block">
            Active Ventilated Patients
          </span>
          <span className="text-3xl font-black mt-1 block">
            {episodes.filter((e) => e.status !== 'resolved' && e.status !== 'extubated').length}
          </span>
          <span className="text-[11px] text-indigo-200">Children on invasive/NIV protocol</span>
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
            <option value="acute_management">Acute Management</option>
            <option value="stabilized_weaning">Stabilized / Weaning</option>
            <option value="extubated">Extubated</option>
            <option value="picu_stepdown">PICU Stepdown</option>
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
          <p className="text-sm text-gray-600">No PARDS ventilation episodes matching this filter.</p>
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
                    <span className="text-xs font-mono font-bold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-md">
                      {ep.episode_code}
                    </span>
                    <div className="text-[11px] text-gray-500 mt-1 capitalize font-medium">
                      {ep.trigger_cause.replace(/_/g, ' ')} ({ep.age_months}m | {ep.weight_kg} kg)
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize ${
                      ep.pards_severity === 'severe'
                        ? 'bg-red-100 text-red-800'
                        : ep.pards_severity === 'moderate'
                        ? 'bg-amber-100 text-amber-800'
                        : ep.pards_severity === 'mild'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {ep.pards_severity.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-lg text-xs">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">Oxygenation Index</span>
                    <span className="font-extrabold text-indigo-950 text-base">
                      {ep.calculated_oi !== null ? `OI: ${ep.calculated_oi}` : ep.calculated_osi !== null ? `OSI: ${ep.calculated_osi}` : 'At Risk'}
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      MAP: {ep.current_map_cmh2o} | PEEP: {ep.current_peep_cmh2o}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">Target Tidal Vol</span>
                    <span className="font-extrabold text-emerald-700 text-base">
                      {ep.target_tidal_volume_ml_min} - {ep.target_tidal_volume_ml_max}
                    </span>
                    <span className="text-[10px] text-gray-500 block">mL (PBW {ep.predicted_body_weight_kg} kg)</span>
                  </div>
                </div>

                <div className="text-xs space-y-1 text-gray-700">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Mode:</span>
                    <span className="font-semibold capitalize text-[11px]">{ep.ventilation_mode.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">FiO2 / SpO2:</span>
                    <span className="font-medium">
                      {ep.current_fio2_percent}% / {ep.spo2_percent}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Prone Positioning:</span>
                    <span className="font-medium text-purple-900">
                      {ep.prone_positioning_active ? 'Active (>=16h/d)' : 'Not active'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">NMB Infusion:</span>
                    <span className="font-medium text-purple-900">
                      {ep.neuromuscular_blockade_active ? 'Active' : 'No'}
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
                  to={`/patients/${ep.patient_id}?tab=pediatric_pards`}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                >
                  Open Chart &rarr;
                </Link>
                <div className="flex items-center gap-2">
                  <a
                    href={`/pediatric-pards/${ep.id}/print`}
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
                    <option value="acute_management">Acute</option>
                    <option value="stabilized_weaning">Weaning</option>
                    <option value="extubated">Extubated</option>
                    <option value="picu_stepdown">Stepdown</option>
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
