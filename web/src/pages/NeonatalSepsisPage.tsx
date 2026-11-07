import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getNeonatalSepsisEpisodes,
  updateNeonatalSepsisEpisode,
  type NeonatalSepsisRecord,
} from '../api';

export const NeonatalSepsisPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalSepsisRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNeonatalSepsisEpisodes({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setEpisodes(res.episodes);
    } catch (err: any) {
      setError(err.message || 'Failed to load sepsis records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [statusFilter]);

  const handleUpdateStatus = async (id: number, newStatus: any) => {
    try {
      await updateNeonatalSepsisEpisode(id, { status: newStatus });
      fetchEpisodes();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 via-rose-700 to-indigo-900 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-semibold mb-2">
            <span>NICU / SNCU Sepsis Tracker</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Neonatal Sepsis & Inotrope Hemodynamics Console
          </h1>
          <p className="text-amber-100 mt-2 max-w-2xl text-sm leading-relaxed">
            Population-level early-onset sepsis surveillance, Kaiser Permanente multi-parameter risk stratification, blood culture stewardship, and targeted inotrope titration for neonatal septic shock.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-center min-w-[180px]">
          <span className="text-xs uppercase tracking-wider text-amber-200 font-bold block">
            Active Sepsis Surveillance
          </span>
          <span className="text-3xl font-black mt-1 block">
            {episodes.filter((e) => e.status !== 'resolved' && e.status !== 'surveillance_complete').length}
          </span>
          <span className="text-[11px] text-amber-100">Infants under review</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold border rounded-lg px-3 py-1.5 bg-gray-50 border-gray-300"
          >
            <option value="all">All Episodes</option>
            <option value="evaluating">Evaluating</option>
            <option value="active_treatment">Active Treatment</option>
            <option value="escalated_septic_shock">Escalated to Septic Shock</option>
            <option value="surveillance_complete">Surveillance Complete</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <button
          onClick={fetchEpisodes}
          className="text-xs text-rose-700 hover:text-rose-900 font-bold flex items-center gap-1"
        >
          <span>🔄</span> Refresh Roster
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Episode Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-500 text-sm">Loading neonatal sepsis records...</div>
        ) : episodes.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            No sepsis episodes found matching the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left divide-y divide-gray-200">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Episode</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">GA / Birth Wt</th>
                  <th className="px-4 py-3">EOS Risk / Rec</th>
                  <th className="px-4 py-3">Left Shift (I/T)</th>
                  <th className="px-4 py-3">Antibiotic Status</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {episodes.map((ep) => (
                  <tr key={ep.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-900">
                      <div>{ep.episode_code}</div>
                      <span className="text-[10px] text-gray-400 font-normal">
                        {new Date(ep.evaluation_datetime).toLocaleDateString()}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        to={`/patients/${ep.patient_id}`}
                        className="font-bold text-rose-800 hover:underline"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </Link>
                      <div className="text-[10px] text-gray-400">{ep.patient_uhid}</div>
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      <div>{ep.gestational_age_weeks}w {ep.gestational_age_days}d</div>
                      <span className="text-gray-500">{ep.birth_weight_kg} kg</span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900">{ep.eos_risk_per_1000}/1,000</div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          ep.eos_recommendation === 'blood_culture_empiric_antibiotics'
                            ? 'bg-rose-100 text-rose-800'
                            : ep.eos_recommendation === 'serial_physical_exams'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {ep.eos_recommendation.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {ep.it_ratio ? (
                        <span
                          className={`font-semibold ${
                            ep.it_ratio >= 0.2 ? 'text-rose-700 font-bold' : 'text-gray-700'
                          }`}
                        >
                          {ep.it_ratio} {ep.it_ratio >= 0.2 && '⚠️'}
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {ep.empiric_antibiotics_started ? (
                        <div>
                          <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-800 font-medium rounded text-[10px]">
                            Amp + Gent
                          </span>
                          <div className="text-[10px] text-gray-500">
                            {ep.blood_culture_drawn ? 'Culture drawn' : 'Culture pending'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Not started</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={ep.status}
                        onChange={(e) => handleUpdateStatus(ep.id, e.target.value)}
                        className={`text-xs font-bold rounded-lg px-2 py-1 border ${
                          ep.status === 'escalated_septic_shock'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : ep.status === 'active_treatment'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        <option value="evaluating">Evaluating</option>
                        <option value="active_treatment">Active Treatment</option>
                        <option value="escalated_septic_shock">Escalated (Shock)</option>
                        <option value="surveillance_complete">Surveillance Done</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </td>

                    <td className="px-4 py-3 text-right space-x-2">
                      <a
                        href={`/patients/${ep.patient_id}/neonatal-sepsis/${ep.id}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold text-[11px]"
                      >
                        🖨️ Dossier
                      </a>
                      <Link
                        to={`/patients/${ep.patient_id}`}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold text-[11px]"
                      >
                        Open Chart
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
