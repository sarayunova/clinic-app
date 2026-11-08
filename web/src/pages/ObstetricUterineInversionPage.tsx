import React, { useState, useEffect } from 'react';
import { getObstetricUterineInversionEpisodes, type ObstetricUterineInversionRecord } from '../api';
import { ObstetricUterineInversionModal } from '../components/ObstetricUterineInversionModal';

interface Props {
  userRole?: string;
}

export const ObstetricUterineInversionPage: React.FC<Props> = ({ userRole }) => {
  const [episodes, setEpisodes] = useState<ObstetricUterineInversionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedEpisode, setSelectedEpisode] = useState<ObstetricUterineInversionRecord | null>(null);
  const [showModal, setShowModal] = useState(false);

  const canManage = userRole === 'doctor' || userRole === 'nurse';

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getObstetricUterineInversionEpisodes(statusFilter ? { status: statusFilter } : undefined);
      setEpisodes(res.episodes);
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
              Obstetric Acute Uterine Inversion Emergency Console
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
              Series 28B
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            RCOG Green-top 50 &bull; Johnson Manual Replacement &bull; O&apos;Sullivan Hydrostatic &bull; Neurogenic Shock Resuscitation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="acute_neurogenic_shock_reduction">Acute Shock & Reduction</option>
            <option value="post_reinversion_bimanual_compression">Bimanual Compression</option>
            <option value="laparotomy_operative_repair">Laparotomy Huntington/Haultain</option>
            <option value="stabilized_icu_surveillance">Stabilized ICU Surveillance</option>
            <option value="resolved_ward_recovery">Resolved & Ward Recovery</option>
          </select>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Total Inversion Cases</span>
          <p className="text-2xl font-bold text-rose-700 mt-1">{episodes.length}</p>
          <span className="text-xs text-gray-400">Emergent registry</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Successful Non-Operative</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {episodes.filter((e) => e.reinversion_successful === 1 && !e.reduction_technique_primary.includes('laparotomy')).length}
          </p>
          <span className="text-xs text-gray-400">Johnson / O&apos;Sullivan technique</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Operative Laparotomy</span>
          <p className="text-2xl font-bold text-purple-600 mt-1">
            {episodes.filter((e) => e.reduction_technique_primary.includes('laparotomy')).length}
          </p>
          <span className="text-xs text-gray-400">Huntington / Haultain repair</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Severe Shock Present</span>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {episodes.filter((e) => e.neurogenic_shock_present === 1 || e.systolic_bp_at_presentation < 80).length}
          </p>
          <span className="text-xs text-gray-400">Massive transfusion protocol</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 font-bold text-gray-800 text-sm">
          Emergent Inversion Case Log
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading episodes...</div>
        ) : episodes.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No uterine inversion episodes recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">Episode</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Inversion Degree</th>
                  <th className="py-3 px-4">BP / Shock</th>
                  <th className="py-3 px-4">Technique</th>
                  <th className="py-3 px-4">Tocolytic</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {episodes.map((ep) => (
                  <tr key={ep.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-bold text-gray-900">{ep.episode_code}</td>
                    <td className="py-3 px-4">
                      <a
                        href={`/patients/${ep.patient_id}?tab=obstetric-uterine-inversion`}
                        className="text-rose-700 font-semibold hover:underline"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </a>
                    </td>
                    <td className="py-3 px-4 capitalize font-medium text-gray-800">
                      {ep.inversion_degree.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4">
                      {ep.systolic_bp_at_presentation}/{ep.diastolic_bp_at_presentation} mmHg
                      {ep.neurogenic_shock_present === 1 && (
                        <span className="text-red-700 block font-bold text-[10px]">Neurogenic Shock</span>
                      )}
                    </td>
                    <td className="py-3 px-4 capitalize">
                      {ep.reduction_technique_primary.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 capitalize">
                      {ep.uterine_relaxant_agent.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4">
                      {ep.reinversion_successful === 1 ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                          Reinverted ({ep.time_to_reinversion_minutes ?? '-'}m)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">
                          Pending / Refractory
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          ep.status === 'acute_neurogenic_shock_reduction'
                            ? 'bg-rose-100 text-rose-800'
                            : ep.status === 'post_reinversion_bimanual_compression'
                            ? 'bg-amber-100 text-amber-800'
                            : ep.status === 'laparotomy_operative_repair'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 flex gap-2">
                      <a
                        href={`/obstetric-uterine-inversion/print?id=${ep.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-600 hover:text-gray-900 underline"
                      >
                        Print
                      </a>
                      {canManage && (
                        <button
                          onClick={() => {
                            setSelectedEpisode(ep);
                            setShowModal(true);
                          }}
                          className="text-rose-700 hover:text-rose-900 font-medium"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedEpisode && (
        <ObstetricUterineInversionModal
          patientId={selectedEpisode.patient_id}
          existingEpisode={selectedEpisode}
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedEpisode(null);
          }}
          onSaved={loadEpisodes}
        />
      )}
    </div>
  );
};
