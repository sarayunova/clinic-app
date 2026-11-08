import React, { useState, useEffect } from 'react';
import {
  getPediatricIntussusceptionEpisodes,
  type PediatricIntussusceptionRecord,
} from '../api';

export const PediatricIntussusceptionPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<PediatricIntussusceptionRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPediatricIntussusceptionEpisodes({
        status: statusFilter || undefined,
      });
      setEpisodes(res.episodes);
    } catch (err: any) {
      setError(err.message || 'Failed to load intussusception records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            Pediatric Intussusception & Enema Reduction Console
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Surveillance of pediatric intussusception diagnosis, pneumatic air pressure auditing, and post-reduction recovery
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-xs text-gray-700 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="evaluation_ultrasound">Evaluation / Ultrasound</option>
            <option value="reduction_in_progress">Reduction In Progress</option>
            <option value="reduction_successful_observation">Reduction Successful (Observation)</option>
            <option value="operating_room_exploration">Operating Room Exploration</option>
            <option value="resolved_discharged">Resolved & Discharged</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-500">Loading intussusception registry...</div>
      ) : episodes.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-dashed border-gray-200">
          <p className="text-sm text-gray-500">No intussusception episodes recorded.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
              <tr>
                <th className="p-3">Episode Code</th>
                <th className="p-3">Patient</th>
                <th className="p-3">Age</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Method</th>
                <th className="p-3">Max Pressure</th>
                <th className="p-3">Outcome</th>
                <th className="p-3">Status</th>
                <th className="p-3">Consultant</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {episodes.map((ep) => (
                <tr key={ep.id} className="hover:bg-gray-50 transition">
                  <td className="p-3 font-bold text-indigo-900">{ep.episode_code}</td>
                  <td className="p-3">
                    <span className="font-semibold text-gray-800">{ep.patient_name || `Patient #${ep.patient_id}`}</span>
                  </td>
                  <td className="p-3 text-gray-600">{ep.age_months}m ({ep.weight_kg}kg)</td>
                  <td className="p-3 text-gray-600">{ep.symptom_duration_hours}h</td>
                  <td className="p-3 text-gray-600">{ep.reduction_method.replace(/_/g, ' ')}</td>
                  <td className="p-3 font-bold text-indigo-700">{ep.maximum_pressure_mmhg} mmHg</td>
                  <td className="p-3">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                        ep.reduction_successful ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {ep.reduction_successful ? 'Reduced' : 'Unreduced'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-800">
                      {ep.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">{ep.consultant_name || 'Dr. Vivek Saxena'}</td>
                  <td className="p-3">
                    <button
                      onClick={() => window.open(`/pediatric-intussusception/${ep.id}/print`, '_blank')}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold"
                    >
                      Print Dossier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
