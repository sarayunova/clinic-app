import React, { useState, useEffect } from 'react';
import { getPediatricMeningitisEpisodes, type PediatricBacterialMeningitisRecord } from '../api';

interface Props {
  userRole?: string;
}

export const PediatricBacterialMeningitisPage: React.FC<Props> = ({ userRole }) => {
  const [episodes, setEpisodes] = useState<PediatricBacterialMeningitisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const res = await getPediatricMeningitisEpisodes();
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
              Pediatric Bacterial Meningitis & Nigrovic BMS Console
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              Series 29C
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Nigrovic Bacterial Meningitis Score &bull; CSF Cytology & Chemistry &bull; Empiric Ceftriaxone/Vancomycin &bull; Pre-antibiotic Dexamethasone
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700"
          >
            <option value="">All Statuses</option>
            <option value="active_triage">Active Triage</option>
            <option value="picu_critical_care">PICU Critical Care</option>
            <option value="ward_antimicrobial_therapy">Ward Antimicrobial Therapy</option>
            <option value="aseptic_meningitis_weaning">Aseptic / Weaning Antibiotics</option>
            <option value="resolved_discharged">Resolved / Discharged</option>
          </select>
        </div>
      </div>

      {/* Episode Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-sm font-bold text-gray-800">
            Active & Historical Meningitis Patient Records ({episodes.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading Meningitis records...</div>
        ) : episodes.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No episodes matching current filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-100/70 text-gray-600 border-b">
                <tr>
                  <th className="p-3">Episode Code</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Age / Wt</th>
                  <th className="p-3">GCS</th>
                  <th className="p-3">CSF WBC (ANC)</th>
                  <th className="p-3">BMS Score</th>
                  <th className="p-3">Risk Tier</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {episodes.map((ep) => (
                  <tr key={ep.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold text-amber-950">{ep.episode_code}</td>
                    <td className="p-3">
                      <a href={`/patients/${ep.patient_id}`} className="font-semibold text-amber-700 hover:underline">
                        {ep.patient_name || 'Patient'}
                      </a>
                    </td>
                    <td className="p-3">{ep.age_months}m / {ep.weight_kg}kg</td>
                    <td className="p-3 font-bold">{ep.gcs_score}/15</td>
                    <td className="p-3">{ep.csf_wbc_count} ({ep.csf_anc_calculated}/mm³)</td>
                    <td className="p-3 font-bold text-amber-950">{ep.bms_score} / 6</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded font-bold ${ep.risk_tier === 'high_risk' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {ep.risk_tier.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                        {ep.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 space-x-2">
                      <a
                        href={`/patients/${ep.patient_id}`}
                        className="text-amber-600 hover:underline font-semibold"
                      >
                        Chart
                      </a>
                      <a
                        href={`/patients/${ep.patient_id}/pediatric-meningitis/${ep.id}/print`}
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
