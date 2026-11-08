import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getPediatricAppendicitisEpisode,
  type PediatricAppendicitisRecord,
  type PediatricAppendicitisFlowsheetRecord,
} from '../api';

export const PediatricAppendicitisPrint: React.FC = () => {
  const [searchParams] = useSearchParams();
  const idStr = searchParams.get('id');
  const id = idStr ? parseInt(idStr) : 0;

  const [episode, setEpisode] = useState<PediatricAppendicitisRecord | null>(null);
  const [logs, setLogs] = useState<PediatricAppendicitisFlowsheetRecord[]>([]);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getPediatricAppendicitisEpisode(id)
      .then((res) => {
        setEpisode(res.episode);
        setLogs(res.logs);
        setEvalResult(res.evalResult);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-sm">Loading printable clinical dossier...</div>;
  if (!episode) return <div className="p-8 text-center text-sm text-red-600">Episode not found.</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-gray-900 font-sans print:p-0">
      {/* Print Trigger Button */}
      <div className="mb-6 flex justify-between items-center print:hidden">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded shadow hover:bg-indigo-700 text-sm"
        >
          Print Dossier / Save PDF
        </button>
        <span className="text-xs text-gray-500">Official Pediatric Surgery Clinical Record</span>
      </div>

      {/* Header */}
      <div className="border-b-2 border-indigo-900 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-indigo-950">
              Pediatric Acute Appendicitis & Samuel PAS Dossier
            </h1>
            <p className="text-xs text-gray-600 mt-1">
              Guidelines: Samuel M (Pediatric Appendicitis Score) &bull; APSA Surgical Evidence &bull; Graded Ultrasound
            </p>
          </div>
          <div className="text-right text-xs">
            <span className="font-bold text-sm text-gray-900 block">{episode.episode_code}</span>
            <span className="text-gray-500">
              Date: {new Date(episode.triage_datetime).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Demographics & Presentation */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-xs bg-gray-50 p-4 rounded border border-gray-200">
        <div>
          <span className="text-gray-500 block">Patient Name</span>
          <strong className="text-sm text-gray-900">{episode.patient_name || `Patient #${episode.patient_id}`}</strong>
        </div>
        <div>
          <span className="text-gray-500 block">Age, Weight & Symptoms</span>
          <strong className="text-sm text-gray-900">
            {episode.age_years} years &bull; {episode.weight_kg} kg &bull; Duration: {episode.symptom_duration_hours} hours
          </strong>
        </div>
        <div>
          <span className="text-gray-500 block">Samuel PAS Score & Probability</span>
          <strong className="text-indigo-900 text-sm">
            {episode.pas_score_total} / 10 points ({evalResult ? `${evalResult.predictedProbabilityPercent}% probability` : ''})
          </strong>
        </div>
        <div>
          <span className="text-gray-500 block">Pathway & Antibiotics</span>
          <strong className="capitalize">
            {episode.management_pathway.replace(/_/g, ' ')} &bull; {episode.empiric_antibiotic_regimen.replace(/_/g, ' ')}
          </strong>
        </div>
      </div>

      {/* Criteria Breakdown */}
      <div className="mb-6">
        <h2 className="text-sm font-bold uppercase border-b border-gray-300 pb-1 mb-3 text-indigo-950">
          Samuel PAS Scoring Criteria Met
        </h2>
        {evalResult && evalResult.criteriaMetList.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {evalResult.criteriaMetList.map((crit: string, idx: number) => (
              <div key={idx} className="p-2 border rounded bg-indigo-50/50 flex gap-2">
                <span className="text-indigo-600 font-bold">&#10003;</span>
                <span className="font-medium text-gray-800">{crit}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">No PAS score criteria met.</p>
        )}
      </div>

      {/* Ultrasound & Pathology */}
      <div className="mb-6">
        <h2 className="text-sm font-bold uppercase border-b border-gray-300 pb-1 mb-3 text-indigo-950">
          Graded-Compression Ultrasound Diagnostics
        </h2>
        <div className="grid grid-cols-4 gap-3 text-xs">
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">Appendix Visualized</span>
            <strong>{episode.appendix_visualized === 1 ? 'Yes' : 'No'}</strong>
          </div>
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">Max Outer Diameter</span>
            <strong className="text-indigo-900 text-sm">
              {episode.outer_diameter_mm ? `${episode.outer_diameter_mm} mm (&ge; 6 mm)` : 'N/A'}
            </strong>
          </div>
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">Non-Compressible Loop</span>
            <strong>{episode.non_compressible === 1 ? 'Positive' : 'Negative'}</strong>
          </div>
          <div className="p-3 border rounded">
            <span className="text-gray-500 block">Appendicolith / Fecalith</span>
            <strong>{episode.appendicolith_fecalith_present === 1 ? 'Present' : 'Absent'}</strong>
          </div>
        </div>
      </div>

      {/* Clinical Action Directives */}
      {evalResult && (
        <div className="mb-6 bg-indigo-50 p-4 rounded border border-indigo-200 text-xs space-y-2">
          <strong className="text-indigo-950 uppercase block font-bold">
            Pediatric Surgical Action Plan:
          </strong>
          {evalResult.actionPlan.map((act: string, idx: number) => (
            <div key={idx} className="flex gap-2 text-indigo-950">
              <span>{act}</span>
            </div>
          ))}
        </div>
      )}

      {/* Flowsheet Table */}
      <div className="mb-8">
        <h2 className="text-sm font-bold uppercase border-b border-gray-300 pb-1 mb-3 text-indigo-950">
          Serial Bedside Observations & FLACC Pain Log
        </h2>
        {logs.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No observation logs recorded.</p>
        ) : (
          <table className="w-full text-xs text-left border border-collapse">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="py-2 px-2 border">Timestamp</th>
                <th className="py-2 px-2 border">Temp (&deg;C)</th>
                <th className="py-2 px-2 border">HR / RR</th>
                <th className="py-2 px-2 border">Pain (0-10)</th>
                <th className="py-2 px-2 border">Abdominal Exam</th>
                <th className="py-2 px-2 border">Oral Intake</th>
                <th className="py-2 px-2 border">Notes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((lg) => (
                <tr key={lg.id} className="border-b">
                  <td className="py-1.5 px-2 border whitespace-nowrap">
                    {new Date(lg.log_datetime).toLocaleString()} (+{lg.hours_from_triage}h)
                  </td>
                  <td className="py-1.5 px-2 border">{lg.temperature_celsius}&deg;C</td>
                  <td className="py-1.5 px-2 border">
                    {lg.heart_rate_bpm} / {lg.respiratory_rate}
                  </td>
                  <td className="py-1.5 px-2 border font-bold text-rose-700">{lg.pain_score_flacc_wong_baker}/10</td>
                  <td className="py-1.5 px-2 border capitalize">{lg.abdominal_exam_findings.replace(/_/g, ' ')}</td>
                  <td className="py-1.5 px-2 border capitalize">{lg.oral_intake_status.replace(/_/g, ' ')}</td>
                  <td className="py-1.5 px-2 border">{lg.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-12 pt-8 border-t border-gray-300 text-xs">
        <div>
          <span className="text-gray-500 block mb-8">Pediatric Surgeon / Consultant:</span>
          <div className="border-b border-gray-400 w-3/4 mb-1"></div>
          <strong>{episode.consultant_name || 'Dr. Vivek Saxena, MCh (Pediatric Surgery)'}</strong>
        </div>
        <div>
          <span className="text-gray-500 block mb-8">Pediatric Surgical Ward Sister:</span>
          <div className="border-b border-gray-400 w-3/4 mb-1"></div>
          <strong>Staff Signature & Date</strong>
        </div>
      </div>
    </div>
  );
};
