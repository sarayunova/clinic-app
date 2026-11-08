import React, { useState, useEffect } from 'react';
import { getObstetricPdphEpisodes, type ObstetricPdphRecord } from '../api';

interface Props {
  userRole?: string;
}

export const ObstetricPdphPage: React.FC<Props> = ({ userRole }) => {
  const [episodes, setEpisodes] = useState<ObstetricPdphRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getObstetricPdphEpisodes();
      if (statusFilter) {
        setEpisodes(res.episodes.filter(e => e.status === statusFilter));
      } else {
        setEpisodes(res.episodes);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [statusFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Obstetric Postdural Puncture Headache (PDPH) Console
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
              Series 29B
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Postural Pain Stratification &bull; Epidural Blood Patch (EBP) Protocol &bull; Red Flag Exclusion &bull; OAA/SOAP Guidelines
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700"
          >
            <option value="">All Statuses</option>
            <option value="conservative_management">Conservative Management</option>
            <option value="ebp_scheduled">EBP Scheduled</option>
            <option value="ebp_completed_resolving">EBP Completed / Resolving</option>
            <option value="headache_resolved">Headache Resolved</option>
            <option value="referred_neurology_imaging">Referred for Neuroimaging</option>
          </select>
        </div>
      </div>

      {/* Episode Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-sm font-bold text-gray-800">
            Active & Historical PDPH Patient Records ({episodes.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading PDPH records...</div>
        ) : episodes.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No PDPH episodes matching current filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-100/70 text-gray-600 border-b">
                <tr>
                  <th className="p-3">Episode Code</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Procedure & Needle</th>
                  <th className="p-3">Onset</th>
                  <th className="p-3">Initial VAS</th>
                  <th className="p-3">EBP Indicated</th>
                  <th className="p-3">EBP Status</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {episodes.map((ep) => (
                  <tr key={ep.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold text-rose-950">{ep.episode_code}</td>
                    <td className="p-3">
                      <a href={`/patients/${ep.patient_id}`} className="font-semibold text-rose-700 hover:underline">
                        {ep.patient_name || 'Patient'}
                      </a>
                    </td>
                    <td className="p-3">{ep.procedure_type.replace(/_/g, ' ')} ({ep.needle_gauge})</td>
                    <td className="p-3">{new Date(ep.headache_onset_datetime).toLocaleDateString()}</td>
                    <td className="p-3 font-bold text-rose-900">VAS {ep.initial_vas_score}/10</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded font-bold ${ep.ebp_indicated ? 'bg-rose-100 text-rose-800' : 'bg-gray-100 text-gray-700'}`}>
                        {ep.ebp_indicated ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="p-3">
                      {ep.ebp_performed ? (
                        <span className="text-emerald-700 font-bold">Performed ({ep.ebp_blood_volume_ml}mL)</span>
                      ) : (
                        <span className="text-gray-500">Conservative</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 space-x-2">
                      <a
                        href={`/patients/${ep.patient_id}`}
                        className="text-rose-600 hover:underline font-semibold"
                      >
                        Chart
                      </a>
                      <a
                        href={`/patients/${ep.patient_id}/obstetric-pdph/${ep.id}/print`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-500 hover:text-gray-800"
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
