import React, { useState, useEffect } from 'react';
import {
  getPediatricAppendicitisEpisodes,
  getPediatricAppendicitisEpisode,
  deletePediatricAppendicitisEpisode,
  deletePediatricAppendicitisFlowsheet,
  type PediatricAppendicitisRecord,
  type PediatricAppendicitisFlowsheetRecord,
} from '../api';
import { PediatricAppendicitisModal } from './PediatricAppendicitisModal';
import { PediatricAppendicitisFlowsheetModal } from './PediatricAppendicitisFlowsheetModal';

interface Props {
  patientId: number;
  userRole?: string;
}

export const PediatricAppendicitisTab: React.FC<Props> = ({ patientId, userRole }) => {
  const [episodes, setEpisodes] = useState<PediatricAppendicitisRecord[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PediatricAppendicitisRecord | null>(null);
  const [logs, setLogs] = useState<PediatricAppendicitisFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [showFlowsheetModal, setShowFlowsheetModal] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<PediatricAppendicitisRecord | null>(null);

  const isDoctor = userRole === 'doctor';
  const isNurse = userRole === 'nurse';
  const canManage = isDoctor || isNurse;

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getPediatricAppendicitisEpisodes({ patientId });
      setEpisodes(res.episodes);
      if (res.episodes.length > 0 && res.episodes[0]) {
        await selectEpisode(res.episodes[0].id);
      } else {
        setSelectedEpisode(null);
        setLogs([]);
        setEvalResult(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load appendicitis records');
    } finally {
      setLoading(false);
    }
  };

  const selectEpisode = async (id: number) => {
    try {
      const res = await getPediatricAppendicitisEpisode(id);
      setSelectedEpisode(res.episode);
      setLogs(res.logs);
      setEvalResult(res.evalResult);
    } catch (err: any) {
      setError(err?.message || 'Failed to load episode details');
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const handleDeleteEpisode = async (id: number) => {
    if (!window.confirm('Delete this pediatric appendicitis episode?')) return;
    try {
      await deletePediatricAppendicitisEpisode(id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete record');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!selectedEpisode) return;
    if (!window.confirm('Delete this flowsheet log?')) return;
    try {
      await deletePediatricAppendicitisFlowsheet(selectedEpisode.id, logId);
      await selectEpisode(selectedEpisode.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete log');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">Pediatric Acute Appendicitis Protocol</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              Samuel PAS Score (0-10) &bull; APSA Surgical Guidelines
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Graded-Compression Ultrasound &bull; Risk Stratification &bull; Laparoscopic Appendectomy vs Non-Operative Trial
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedEpisode && (
            <button
              onClick={() => window.open(`/pediatric-appendicitis/print?id=${selectedEpisode.id}`, '_blank')}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
            >
              Print Dossier
            </button>
          )}

          {canManage && (
            <button
              onClick={() => {
                setEditingEpisode(null);
                setShowModal(true);
              }}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              + Record PAS Evaluation
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="p-8 text-center text-gray-500 text-sm">Loading appendicitis records...</div>
      ) : episodes.length === 0 ? (
        <div className="p-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500 text-sm">No appendicitis evaluations recorded for this child.</p>
          {canManage && (
            <button
              onClick={() => {
                setEditingEpisode(null);
                setShowModal(true);
              }}
              className="mt-3 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
            >
              Record PAS Evaluation
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Episode List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700 text-xs uppercase tracking-wider">PAS Evaluations</h3>
            {episodes.map((ep) => (
              <div
                key={ep.id}
                onClick={() => selectEpisode(ep.id)}
                className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                  selectedEpisode?.id === ep.id
                    ? 'bg-indigo-50 border-indigo-500 shadow-sm'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-gray-900 text-sm">{ep.episode_code}</span>
                    <p className="text-xs text-gray-500">{new Date(ep.triage_datetime).toLocaleString()}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      ep.pas_score_total >= 7
                        ? 'bg-rose-100 text-rose-800'
                        : ep.pas_score_total >= 4
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    PAS {ep.pas_score_total}/10
                  </span>
                </div>

                <div className="mt-2 text-xs text-gray-600 grid grid-cols-2 gap-1 border-t pt-2">
                  <div>
                    US Diam:{' '}
                    <strong className="text-gray-900">
                      {ep.outer_diameter_mm ? `${ep.outer_diameter_mm} mm` : 'N/A'}
                    </strong>
                  </div>
                  <div>
                    WBC: <strong className="text-gray-900">{ep.wbc_count_per_microliter ?? '-'}</strong>
                  </div>
                  <div>
                    Pathway: <span className="capitalize">{ep.management_pathway.split('_')[0]}</span>
                  </div>
                  <div>
                    Status: <span className="capitalize">{ep.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Details Panel */}
          {selectedEpisode && (
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex flex-wrap justify-between items-center pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{selectedEpisode.episode_code}</h3>
                    <p className="text-xs text-gray-500">
                      Triaged {new Date(selectedEpisode.triage_datetime).toLocaleString()} &bull; Age{' '}
                      {selectedEpisode.age_years}y &bull; Weight {selectedEpisode.weight_kg} kg &bull; Duration{' '}
                      {selectedEpisode.symptom_duration_hours}h
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManage && (
                      <button
                        onClick={() => {
                          setEditingEpisode(selectedEpisode);
                          setShowModal(true);
                        }}
                        className="px-2.5 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                    )}
                    {isDoctor && (
                      <button
                        onClick={() => handleDeleteEpisode(selectedEpisode.id)}
                        className="px-2.5 py-1 border border-red-300 rounded text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Decision Support */}
                {evalResult && (
                  <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs space-y-2">
                    <div className="flex flex-wrap justify-between items-center">
                      <span className="font-bold text-indigo-950 uppercase tracking-wide">
                        Samuel Pediatric Appendicitis Score (PAS): {evalResult.pasScoreTotal}/10
                      </span>
                      <span className="px-2 py-0.5 rounded font-bold bg-indigo-200 text-indigo-900">
                        {evalResult.riskTierLabel}
                      </span>
                    </div>

                    {evalResult.criteriaMetList.length > 0 && (
                      <div className="pt-2 border-t border-indigo-200 grid grid-cols-2 gap-1 text-[11px] text-indigo-950">
                        {evalResult.criteriaMetList.map((crit: string, idx: number) => (
                          <div key={idx} className="flex gap-1">
                            <span className="text-indigo-600 font-bold">&#10003;</span>
                            <span>{crit}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {evalResult.clinicalDirectives.length > 0 && (
                      <div className="pt-2 border-t border-indigo-200 space-y-1">
                        {evalResult.clinicalDirectives.map((d: string, idx: number) => (
                          <div key={idx} className="text-amber-900 font-medium flex gap-1.5">
                            <span>&#9888;</span>
                            <span>{d}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Key Ultrasound & Management Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-gray-50 p-2.5 rounded border">
                    <span className="text-gray-500 block">US Outer Diameter</span>
                    <strong className="text-sm text-gray-900">
                      {selectedEpisode.outer_diameter_mm ? `${selectedEpisode.outer_diameter_mm} mm` : 'Not Measured'}
                    </strong>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded border">
                    <span className="text-gray-500 block">Non-Compressible Loop</span>
                    <strong className="text-sm text-gray-900">
                      {selectedEpisode.non_compressible === 1 ? 'Yes (Positive)' : 'No'}
                    </strong>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded border">
                    <span className="text-gray-500 block">Pathway</span>
                    <strong className="text-sm text-indigo-700 capitalize">
                      {selectedEpisode.management_pathway.replace(/_/g, ' ')}
                    </strong>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded border">
                    <span className="text-gray-500 block">Antibiotics</span>
                    <strong className="text-sm text-gray-900 capitalize">
                      {selectedEpisode.empiric_antibiotic_regimen.replace(/_/g, ' ')}
                    </strong>
                  </div>
                </div>

                {selectedEpisode.clinical_notes && (
                  <div className="bg-gray-50 p-3 rounded-lg border text-xs">
                    <strong className="text-gray-700 block mb-1">Clinical Assessment Notes:</strong>
                    <p className="text-gray-800 whitespace-pre-wrap">{selectedEpisode.clinical_notes}</p>
                  </div>
                )}
              </div>

              {/* Flowsheet Log */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-gray-900 text-sm">Serial Abdominal Exam & FLACC Pain Log</h4>
                  {canManage && (
                    <button
                      onClick={() => setShowFlowsheetModal(true)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium"
                    >
                      + Add Checkpoint
                    </button>
                  )}
                </div>

                {logs.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4 bg-gray-50 rounded">
                    No observation checkpoints logged yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 text-gray-600 border-b">
                        <tr>
                          <th className="py-2 px-2">Time / Hr</th>
                          <th className="py-2 px-2">Temp (&deg;C)</th>
                          <th className="py-2 px-2">HR / RR</th>
                          <th className="py-2 px-2">Pain (0-10)</th>
                          <th className="py-2 px-2">Abdominal Exam</th>
                          <th className="py-2 px-2">Oral Intake</th>
                          <th className="py-2 px-2">Notes</th>
                          {canManage && <th className="py-2 px-2">Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {logs.map((lg) => (
                          <tr key={lg.id} className="hover:bg-gray-50">
                            <td className="py-2 px-2 whitespace-nowrap">
                              {new Date(lg.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              <span className="text-gray-400 block text-[10px]">+{lg.hours_from_triage}h</span>
                            </td>
                            <td className="py-2 px-2 font-semibold">{lg.temperature_celsius}&deg;C</td>
                            <td className="py-2 px-2">
                              {lg.heart_rate_bpm} / {lg.respiratory_rate}
                            </td>
                            <td className="py-2 px-2 font-bold text-rose-700">{lg.pain_score_flacc_wong_baker}/10</td>
                            <td className="py-2 px-2 capitalize font-medium text-gray-900">
                              {lg.abdominal_exam_findings.replace(/_/g, ' ')}
                            </td>
                            <td className="py-2 px-2 capitalize">{lg.oral_intake_status.replace(/_/g, ' ')}</td>
                            <td className="py-2 px-2 text-gray-600 max-w-xs truncate">{lg.notes || '-'}</td>
                            {canManage && (
                              <td className="py-2 px-2">
                                <button
                                  onClick={() => handleDeleteLog(lg.id)}
                                  className="text-red-500 hover:text-red-700 text-xs"
                                >
                                  &times;
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <PediatricAppendicitisModal
        patientId={patientId}
        existingEpisode={editingEpisode}
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingEpisode(null);
        }}
        onSaved={loadData}
      />

      {selectedEpisode && (
        <PediatricAppendicitisFlowsheetModal
          episodeId={selectedEpisode.id}
          isOpen={showFlowsheetModal}
          onClose={() => setShowFlowsheetModal(false)}
          onSaved={() => selectEpisode(selectedEpisode.id)}
        />
      )}
    </div>
  );
};
