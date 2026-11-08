import React, { useState, useEffect } from 'react';
import {
  getNeonatalChylothoraxEpisodes,
  type NeonatalChylothoraxRecord,
} from '../api';

export const NeonatalChylothoraxPage: React.FC = () => {
  const [episodes, setEpisodes] = useState<NeonatalChylothoraxRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNeonatalChylothoraxEpisodes({
        status: statusFilter || undefined,
      });
      setEpisodes(res.episodes);
    } catch (err: any) {
      setError(err.message || 'Failed to load neonatal chylothorax records');
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
            Neonatal Chylothorax & Pleural Effusion Octreotide Console
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Active surveillance of lymphatic pleural chyle drainage, octreotide titration, and MCT nutrition
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-xs text-gray-700 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="acute_chest_tube_drainage">Acute Chest Tube Drainage</option>
            <option value="octreotide_titration">Octreotide Titration</option>
            <option value="dietary_mct_transition">Dietary MCT Transition</option>
            <option value="resolved_tube_removed">Resolved (Tube Removed)</option>
            <option value="refractory_surgical_referral">Refractory (Surgical Referral)</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-500">Loading chylothorax registry...</div>
      ) : episodes.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-dashed border-gray-200">
          <p className="text-sm text-gray-500">No neonatal chylothorax episodes found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
              <tr>
                <th className="p-3">Episode Code</th>
                <th className="p-3">Patient</th>
                <th className="p-3">Laterality</th>
                <th className="p-3">Etiology</th>
                <th className="p-3">Drainage (mL/kg/d)</th>
                <th className="p-3">Dietary Regimen</th>
                <th className="p-3">Octreotide</th>
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
                  <td className="p-3 text-gray-600">{ep.effusion_laterality.replace(/_/g, ' ')}</td>
                  <td className="p-3 text-gray-600">{ep.etiology.replace(/_/g, ' ')}</td>
                  <td className="p-3">
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                        ep.drainage_ml_kg_day > 20
                          ? 'bg-rose-100 text-rose-800'
                          : ep.drainage_ml_kg_day >= 10
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {ep.drainage_ml_kg_day} mL/kg/d
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">{ep.dietary_regimen.replace(/_/g, ' ')}</td>
                  <td className="p-3 text-gray-600">
                    {ep.octreotide_prescribed ? `${ep.octreotide_current_dose_mcg_kg_hr} µg/kg/h` : 'None'}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-800">
                      {ep.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">{ep.consultant_name || 'Dr. Anand Joshi'}</td>
                  <td className="p-3">
                    <button
                      onClick={() => window.open(`/neonatal-chylothorax/${ep.id}/print`, '_blank')}
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
