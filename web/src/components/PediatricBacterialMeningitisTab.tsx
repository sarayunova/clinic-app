import React, { useState, useEffect } from 'react';
import {
  getPediatricMeningitisEpisodes,
  getPediatricMeningitisEpisode,
  updatePediatricMeningitisStatus,
  deletePediatricMeningitisFlowsheet,
  type PediatricBacterialMeningitisRecord,
  type PediatricBacterialMeningitisFlowsheetRecord,
} from '../api';
import { PediatricBacterialMeningitisModal } from './PediatricBacterialMeningitisModal';
import { PediatricBacterialMeningitisFlowsheetModal } from './PediatricBacterialMeningitisFlowsheetModal';

interface Props {
  patientId: number;
}

export const PediatricBacterialMeningitisTab: React.FC<Props> = ({ patientId }) => {
  const [episodes, setEpisodes] = useState<PediatricBacterialMeningitisRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<PediatricBacterialMeningitisRecord | null>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [flowsheet, setFlowsheet] = useState<PediatricBacterialMeningitisFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFlowsheetModalOpen, setIsFlowsheetModalOpen] = useState(false);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getPediatricMeningitisEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        const firstId = res.episodes[0].id;
        setSelectedEpisodeId(firstId);
        await loadEpisodeDetails(firstId);
      } else {
        setSelectedEpisodeId(null);
        setSelectedEpisode(null);
        setEvaluation(null);
        setFlowsheet([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load pediatric meningitis records');
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodeDetails = async (id: number) => {
    try {
      const res = await getPediatricMeningitisEpisode(id);
      setSelectedEpisode(res.episode);
      setEvaluation(res.evaluation);
      setFlowsheet(res.flowsheet);
    } catch (err: any) {
      setError(err?.message || 'Failed to load episode details');
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [patientId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEpisodeId) return;
    try {
      await updatePediatricMeningitisStatus(selectedEpisodeId, { status: newStatus });
      await loadEpisodeDetails(selectedEpisodeId);
      const res = await getPediatricMeningitisEpisodes({ patientId });
      setEpisodes(res.episodes);
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    }
  };

  const handleDeleteFlowsheet = async (logId: number) => {
    if (!selectedEpisodeId || !window.confirm('Delete this neuro flowsheet entry?')) return;
    try {
      await deletePediatricMeningitisFlowsheet(selectedEpisodeId, logId);
      await loadEpisodeDetails(selectedEpisodeId);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete flowsheet log');
    }
  };

  if (loading && !selectedEpisode) {
    return <div className="p-6 text-center text-sm text-gray-500">Loading Meningitis Protocol data...</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Header Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border flex-wrap gap-2">
        <div className="flex items-center space-x-3">
          <h3 className="text-base font-bold text-gray-800">
            Pediatric Bacterial Meningitis & Nigrovic Score (BMS) Protocol
          </h3>
          {episodes.length > 1 && (
            <select
              value={selectedEpisodeId ?? ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                setSelectedEpisodeId(id);
                loadEpisodeDetails(id);
              }}
              className="text-xs border rounded p-1"
            >
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.episode_code} ({ep.status})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {selectedEpisode && (
            <a
              href={`/patients/${patientId}/pediatric-meningitis/${selectedEpisode.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 border border-amber-600 text-amber-700 text-xs font-semibold rounded hover:bg-amber-50"
            >
              Print Dossier
            </a>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700"
          >
            + Triage Meningitis Episode
          </button>
        </div>
      </div>

      {!selectedEpisode ? (
        <div className="bg-white p-8 rounded-lg border text-center text-gray-500">
          <p className="text-sm">No pediatric meningitis episodes logged for this patient.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-3 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700"
          >
            Start Meningitis Triage & BMS Scoring
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Episode Diagnostic Overview */}
          <div className="bg-white p-5 rounded-lg border shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3 flex-wrap gap-2">
              <div>
                <span className="text-xs font-semibold text-gray-500">Episode:</span>
                <span className="ml-1 text-sm font-bold text-amber-950">{selectedEpisode.episode_code}</span>
                <span className="ml-3 text-xs text-gray-500">
                  Triaged: {new Date(selectedEpisode.triage_datetime).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-gray-500">Status:</span>
                <select
                  value={selectedEpisode.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="text-xs font-bold border rounded px-2 py-1 bg-gray-50 text-amber-950"
                >
                  <option value="active_triage">Active Triage</option>
                  <option value="picu_critical_care">PICU Critical Care</option>
                  <option value="ward_antimicrobial_therapy">Ward Antimicrobial Therapy</option>
                  <option value="aseptic_meningitis_weaning">Aseptic / Weaning Antibiotics</option>
                  <option value="resolved_discharged">Resolved / Discharged</option>
                </select>
              </div>
            </div>

            {/* Score & Risk Tiers */}
            {evaluation && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-amber-50/60 p-4 rounded border border-amber-200">
                <div>
                  <div className="text-xs text-amber-900 font-semibold uppercase">Nigrovic BMS Score</div>
                  <div className="text-3xl font-extrabold text-amber-950 mt-1">
                    {evaluation.bmsBreakdown.totalBmsScore} / 6
                  </div>
                  <div className="text-xs font-bold text-amber-900 mt-1">
                    {evaluation.riskTierLabel}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-amber-900 font-semibold uppercase">CSF Indices</div>
                  <div className="text-sm font-bold text-gray-800 mt-1">
                    CSF WBC: {selectedEpisode.csf_wbc_count} ({selectedEpisode.csf_neutrophil_percent}% PMN)
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    CSF:Blood Ratio: <strong>{evaluation.csfToBloodGlucoseRatio}</strong> | CSF ANC: <strong>{evaluation.csfAncCalculated}</strong>/mm³
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    CSF Protein: {selectedEpisode.csf_protein_mg_dl} mg/dL | Gram Stain: {selectedEpisode.csf_gram_stain_positive ? selectedEpisode.csf_gram_stain_organism.replace(/_/g, ' ') : 'Negative'}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-amber-900 font-semibold uppercase">Empiric Regimen</div>
                  <div className="text-xs text-gray-800 mt-1 space-y-0.5 font-medium">
                    <p>Ceftriaxone: {evaluation.antibioticRecommendations.ceftriaxoneDoseMg} mg IV Q12H</p>
                    <p>Vancomycin: {evaluation.antibioticRecommendations.vancomycinDoseMg} mg IV Q6H</p>
                    <p>Dexamethasone: {evaluation.antibioticRecommendations.dexamethasoneDoseMg} mg IV (pre-abx)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Clinical Alerts & Recommendations */}
            {evaluation?.alerts?.length > 0 && (
              <div className="bg-red-50 border border-red-300 rounded p-3 text-xs space-y-1">
                <span className="font-bold text-red-900 block">Emergency Alerts:</span>
                {evaluation.alerts.map((a: string, idx: number) => (
                  <div key={idx} className="text-red-800 flex items-center gap-1 font-semibold">
                    <span>⚠</span> {a}
                  </div>
                ))}
              </div>
            )}

            {evaluation?.recommendations?.length > 0 && (
              <div className="bg-amber-50/70 border border-amber-200 rounded p-3 text-xs space-y-1">
                <span className="font-bold text-amber-950 block">Clinical Management Directives:</span>
                <ul className="list-disc list-inside space-y-1 text-amber-900">
                  {evaluation.recommendations.map((rec: string, i: number) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Flowsheet Table */}
          <div className="bg-white p-5 rounded-lg border shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-gray-800">
                Serial Bedside Neurological & Vitals Flowsheet ({flowsheet.length} logs)
              </h4>
              <button
                onClick={() => setIsFlowsheetModalOpen(true)}
                className="px-3 py-1 bg-amber-600 text-white text-xs font-semibold rounded hover:bg-amber-700"
              >
                + Add Checkpoint
              </button>
            </div>

            {flowsheet.length === 0 ? (
              <p className="text-xs text-gray-500 py-3 text-center border rounded">
                No neurological observation logs recorded yet. Track serial GCS, pupils, and temperatures above.
              </p>
            ) : (
              <div className="overflow-x-auto border rounded">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-gray-100 text-gray-700 border-b">
                    <tr>
                      <th className="p-2">Timestamp</th>
                      <th className="p-2">GCS</th>
                      <th className="p-2">Pupils</th>
                      <th className="p-2">Temp (°C)</th>
                      <th className="p-2">HR / BP</th>
                      <th className="p-2">RR</th>
                      <th className="p-2">Seizures</th>
                      <th className="p-2">Antibiotic Admin</th>
                      <th className="p-2">Staff</th>
                      <th className="p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-gray-800">
                    {flowsheet.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="p-2 whitespace-nowrap">{new Date(log.log_datetime).toLocaleString()}</td>
                        <td className="p-2 font-bold">{log.gcs_score}/15</td>
                        <td className="p-2">{log.pupil_reactivity.replace(/_/g, ' ')}</td>
                        <td className="p-2 font-bold text-red-700">{log.temperature_celsius}°C</td>
                        <td className="p-2">{log.heart_rate} bpm ({log.blood_pressure_sys}/{log.blood_pressure_dia})</td>
                        <td className="p-2">{log.respiratory_rate}</td>
                        <td className="p-2">{log.seizure_activity_observed ? 'Observed' : 'None'}</td>
                        <td className="p-2">{log.antibiotic_dose_administered ?? '-'}</td>
                        <td className="p-2 text-gray-600">{log.logged_by_name ?? 'Staff'}</td>
                        <td className="p-2">
                          <button
                            onClick={() => handleDeleteFlowsheet(log.id)}
                            className="text-red-600 hover:text-red-800 font-semibold"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <PediatricBacterialMeningitisModal
        patientId={patientId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadEpisodes}
      />

      {selectedEpisodeId && (
        <PediatricBacterialMeningitisFlowsheetModal
          episodeId={selectedEpisodeId}
          isOpen={isFlowsheetModalOpen}
          onClose={() => setIsFlowsheetModalOpen(false)}
          onSaved={() => loadEpisodeDetails(selectedEpisodeId)}
        />
      )}
    </div>
  );
};
