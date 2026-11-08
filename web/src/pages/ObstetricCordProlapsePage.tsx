import React, { useState, useEffect } from 'react';
import {
  getObstetricCordProlapseEpisodes,
  type ObstetricCordProlapseRecord,
} from '../api';

export const ObstetricCordProlapsePage: React.FC = () => {
  const [episodes, setEpisodes] = useState<ObstetricCordProlapseRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getObstetricCordProlapseEpisodes({
        status: statusFilter || undefined,
      });
      setEpisodes(res.episodes);
    } catch (err: any) {
      setError(err.message || 'Failed to load cord prolapse records');
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
          <h1 className="text-xl font-bold text-red-950 flex items-center">
            <span className="mr-2">🚨</span> Obstetric Umbilical Cord Prolapse Emergency Console
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Real-time tracking of acute cord prolapse decompression, manual vaginal elevation, and Category-1 delivery audits
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-xs text-gray-700 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="emergent_decompression_active">Emergent Decompression Active</option>
            <option value="operating_room_in_transit">Operating Room in Transit</option>
            <option value="delivered_neonatal_resuscitation">Delivered (Resuscitation)</option>
            <option value="postpartum_surveillance_stable">Postpartum Stable</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-500">Loading cord prolapse events...</div>
      ) : episodes.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-dashed border-gray-200">
          <p className="text-sm text-gray-500">No umbilical cord prolapse emergencies recorded.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
              <tr>
                <th className="p-3">Episode Code</th>
                <th className="p-3">Patient</th>
                <th className="p-3">GA</th>
                <th className="p-3">FHR (bpm)</th>
                <th className="p-3">Manual Elevation</th>
                <th className="p-3">Position</th>
                <th className="p-3">Delivery Mode</th>
                <th className="p-3">DDI</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {episodes.map((ep) => (
                <tr key={ep.id} className="hover:bg-gray-50 transition">
                  <td className="p-3 font-bold text-red-950">{ep.episode_code}</td>
                  <td className="p-3">
                    <span className="font-semibold text-gray-800">{ep.patient_name || `Patient #${ep.patient_id}`}</span>
                  </td>
                  <td className="p-3 text-gray-600">{ep.gestational_age_weeks}w</td>
                  <td className="p-3 font-bold text-red-600">{ep.baseline_fhr_bpm} bpm</td>
                  <td className="p-3">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                        ep.manual_elevation_performed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {ep.manual_elevation_performed ? 'Maintained' : 'Not Maintained'}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">{ep.maternal_positioning.replace(/_/g, ' ')}</td>
                  <td className="p-3 text-gray-600">{ep.delivery_mode.replace(/_/g, ' ')}</td>
                  <td className="p-3 font-bold text-gray-800">
                    {ep.decision_to_delivery_minutes ? `${ep.decision_to_delivery_minutes} min` : '—'}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-800">
                      {ep.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => window.open(`/obstetric-cord-prolapse/${ep.id}/print`, '_blank')}
                      className="text-red-600 hover:text-red-800 font-semibold"
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
