import React, { useState, useEffect } from 'react';
import { getPediatricAppendicitisEpisodes, type PediatricAppendicitisRecord } from '../api';
import { PediatricAppendicitisModal } from '../components/PediatricAppendicitisModal';

interface Props {
  userRole?: string;
}

export const PediatricAppendicitisPage: React.FC<Props> = ({ userRole }) => {
  const [episodes, setEpisodes] = useState<PediatricAppendicitisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedEpisode, setSelectedEpisode] = useState<PediatricAppendicitisRecord | null>(null);
  const [showModal, setShowModal] = useState(false);

  const canManage = userRole === 'doctor' || userRole === 'nurse';

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getPediatricAppendicitisEpisodes(statusFilter ? { status: statusFilter } : undefined);
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
              Pediatric Acute Appendicitis & PAS Console
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
              Series 28C
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Samuel Pediatric Appendicitis Score (0-10) &bull; Graded-Compression Ultrasound &bull; Laparoscopic Appendectomy
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="triage_diagnostic_evaluation">Triage & Diagnostic Evaluation</option>
            <option value="operating_room_in_transit">In Transit to OR</option>
            <option value="postoperative_recovery">Postoperative Recovery</option>
            <option value="conservative_antibiotics_inpatient">Conservative Antibiotics</option>
            <option value="resolved_discharged">Resolved & Discharged</option>
          </select>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Total Appendicitis Triage</span>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{episodes.length}</p>
          <span className="text-xs text-gray-400">PAS registry</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">High-Risk (PAS &ge; 7)</span>
          <p className="text-2xl font-bold text-rose-600 mt-1">
            {episodes.filter((e) => e.pas_score_total >= 7).length}
          </p>
          <span className="text-xs text-gray-400">&gt; 90% probability</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Ultrasound Positive (&ge; 6mm)</span>
          <p className="text-2xl font-bold text-purple-600 mt-1">
            {episodes.filter((e) => e.outer_diameter_mm !== null && e.outer_diameter_mm >= 6.0).length}
          </p>
          <span className="text-xs text-gray-400">Sonographic confirmation</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">Perforation / Phlegmon</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            {episodes.filter((e) => e.perforation_or_abscess_suspected === 1).length}
          </p>
          <span className="text-xs text-gray-400">Complicated appendicitis</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 font-bold text-gray-800 text-sm">
          Active Pediatric Appendicitis Registry
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading episodes...</div>
        ) : episodes.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No pediatric appendicitis episodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">Episode</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Age / Wt</th>
                  <th className="py-3 px-4">Samuel PAS</th>
                  <th className="py-3 px-4">US Outer Diam</th>
                  <th className="py-3 px-4">WBC / CRP</th>
                  <th className="py-3 px-4">Pathway</th>
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
                        href={`/patients/${ep.patient_id}?tab=pediatric-appendicitis`}
                        className="text-indigo-700 font-semibold hover:underline"
                      >
                        {ep.patient_name || `Patient #${ep.patient_id}`}
                      </a>
                    </td>
                    <td className="py-3 px-4">
                      {ep.age_years}y / {ep.weight_kg} kg
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          ep.pas_score_total >= 7
                            ? 'bg-rose-100 text-rose-800'
                            : ep.pas_score_total >= 4
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {ep.pas_score_total}/10
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {ep.outer_diameter_mm ? `${ep.outer_diameter_mm} mm` : '-'}
                      {ep.perforation_or_abscess_suspected === 1 && (
                        <span className="text-red-700 block text-[10px] font-bold">Phlegmon/Abscess</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {ep.wbc_count_per_microliter ?? '-'} / {ep.crp_mg_l ? `${ep.crp_mg_l} mg/L` : '-'}
                    </td>
                    <td className="py-3 px-4 capitalize">
                      {ep.management_pathway.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          ep.status === 'triage_diagnostic_evaluation'
                            ? 'bg-amber-100 text-amber-800'
                            : ep.status === 'operating_room_in_transit'
                            ? 'bg-rose-100 text-rose-800'
                            : ep.status === 'postoperative_recovery'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 flex gap-2">
                      <a
                        href={`/pediatric-appendicitis/print?id=${ep.id}`}
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
                          className="text-indigo-600 hover:text-indigo-800 font-medium"
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
        <PediatricAppendicitisModal
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
