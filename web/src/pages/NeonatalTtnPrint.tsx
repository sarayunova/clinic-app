import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getNeonatalTtnEpisode, type NeonatalTtnRecord, type NeonatalTtnFlowsheetRecord } from '../api';

export const NeonatalTtnPrint: React.FC = () => {
  const { episodeId } = useParams<{ episodeId: string }>();
  const [episode, setEpisode] = useState<NeonatalTtnRecord | null>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [flowsheet, setFlowsheet] = useState<NeonatalTtnFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!episodeId) return;
    (async () => {
      try {
        const res = await getNeonatalTtnEpisode(Number(episodeId));
        setEpisode(res.episode);
        setEvaluation(res.evaluation);
        setFlowsheet(res.flowsheet);
      } catch (err: any) {
        setError(err?.message || 'Failed to load TTN episode dossier');
      } finally {
        setLoading(false);
      }
    })();
  }, [episodeId]);

  if (loading) return <div className="p-8 text-center text-sm">Generating TTN Clinical Dossier...</div>;
  if (error || !episode) {
    return <div className="p-8 text-center text-red-600 text-sm">{error || 'Episode not found'}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-gray-900 text-xs font-sans print:p-0">
      {/* Header */}
      <div className="border-b-2 border-sky-800 pb-3 mb-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-sky-900">
            NEONATAL TRANSIENT TACHYPNEA (TTN) CLINICAL DOSSIER
          </h1>
          <p className="text-[11px] text-gray-600">
            Silverman-Anderson Retraction Score &bull; Lung Fluid Resorption &bull; Bubble CPAP Stewardship
          </p>
        </div>
        <div className="text-right">
          <span className="font-mono text-sm font-bold text-sky-950">{episode.episode_code}</span>
          <div className="text-[10px] text-gray-500">Printed: {new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Patient & Birth Overview */}
      <div className="grid grid-cols-4 gap-2 bg-gray-50 p-3 rounded border mb-4">
        <div>
          <span className="text-gray-500 block text-[10px]">Patient Name</span>
          <span className="font-bold">{episode.patient_name || 'Patient'}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Gestational Age / Weight</span>
          <span className="font-semibold">{episode.gestational_age_weeks} weeks / {episode.birth_weight_kg} kg</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Delivery Mode</span>
          <span className="font-semibold">{episode.delivery_mode.replace(/_/g, ' ')}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Episode Status</span>
          <span className="font-bold text-sky-900 uppercase">{episode.status.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Primary Scoring & Severity */}
      {evaluation && (
        <div className="border border-sky-200 bg-sky-50/50 p-4 rounded mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-sky-950">
              Silverman-Anderson Retraction Score: {evaluation.silvermanAndersonScore} / 10
            </span>
            <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-sky-200 text-sky-900">
              {evaluation.distressSeverityLabel}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2 text-[11px]">
            <div>
              <span className="font-semibold text-gray-700 block">Feeding Strategy:</span>
              <p className="text-gray-800">{evaluation.feedingRecommendation}</p>
            </div>
            <div>
              <span className="font-semibold text-gray-700 block">Respiratory Support Guidance:</span>
              <p className="text-gray-800">{evaluation.respiratorySupportGuidance}</p>
            </div>
          </div>
        </div>
      )}

      {/* Radiographic & Clinical Parameters */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border p-3 rounded bg-gray-50/50">
          <span className="font-bold text-gray-800 block mb-1">Radiographic Evaluation</span>
          <p className="text-gray-700">{evaluation?.cxrInterpretation || episode.cxr_findings}</p>
          <div className="mt-2 text-[11px] text-gray-600">
            <span>Initial RR: {episode.initial_respiratory_rate} bpm | Support: {episode.respiratory_support_initial.replace(/_/g, ' ')} ({episode.initial_fio2_percent}% FiO2)</span>
          </div>
        </div>

        <div className="border p-3 rounded bg-gray-50/50">
          <span className="font-bold text-gray-800 block mb-1">Maternal Predisposing Factors</span>
          <ul className="list-disc list-inside text-gray-700">
            {evaluation?.riskFactorSummary?.length ? (
              evaluation.riskFactorSummary.map((item: string, idx: number) => <li key={idx}>{item}</li>)
            ) : (
              <li>None recorded</li>
            )}
          </ul>
        </div>
      </div>

      {/* Flowsheet Table */}
      <div className="mb-4">
        <h3 className="font-bold text-gray-900 mb-2 border-b pb-1">
          Bedside Flowsheet Checkpoints ({flowsheet.length})
        </h3>
        {flowsheet.length === 0 ? (
          <p className="text-gray-500 italic">No flowsheet entries recorded.</p>
        ) : (
          <table className="w-full text-left text-[11px] border-collapse border">
            <thead className="bg-gray-100 text-gray-700">
              <tr className="border-b">
                <th className="p-1.5 border-r">Date/Time</th>
                <th className="p-1.5 border-r">RR</th>
                <th className="p-1.5 border-r">HR</th>
                <th className="p-1.5 border-r">SpO2</th>
                <th className="p-1.5 border-r">FiO2</th>
                <th className="p-1.5 border-r">CPAP</th>
                <th className="p-1.5 border-r">Silverman</th>
                <th className="p-1.5 border-r">Feeding</th>
                <th className="p-1.5">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-800">
              {flowsheet.map((f) => (
                <tr key={f.id}>
                  <td className="p-1.5 border-r">{new Date(f.log_datetime).toLocaleString()}</td>
                  <td className="p-1.5 border-r font-bold">{f.respiratory_rate}</td>
                  <td className="p-1.5 border-r">{f.heart_rate}</td>
                  <td className="p-1.5 border-r">{f.spo2_percent}%</td>
                  <td className="p-1.5 border-r">{f.fio2_percent}%</td>
                  <td className="p-1.5 border-r">{f.cpap_peep_cmh2o ?? '-'}</td>
                  <td className="p-1.5 border-r font-bold text-sky-900">{f.silverman_anderson_score}</td>
                  <td className="p-1.5 border-r">{f.feeding_route ?? '-'}</td>
                  <td className="p-1.5">{f.logged_by_name ?? 'Staff'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Signatures */}
      <div className="mt-8 pt-4 border-t border-gray-400 grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <span className="block text-gray-500">Attending Neonatologist / Pediatrician:</span>
          <span className="font-bold text-gray-800">{episode.consultant_name || 'Medical Officer'}</span>
          <div className="mt-6 border-b border-gray-300 w-48"></div>
          <span className="text-[10px] text-gray-400">Signature & Stamp</span>
        </div>
        <div className="text-right">
          <span className="block text-gray-500">Document Generated:</span>
          <span>{new Date().toISOString()}</span>
        </div>
      </div>
    </div>
  );
};
