import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getNeonatalMeconiumIleusEpisode,
  type NeonatalMeconiumIleusRecord,
  type NeonatalMeconiumIleusFlowsheetRecord,
} from '../api';
import { type NeonatalMeconiumIleusEvaluationResult } from '../neonatalMeconiumIleusEngine';

export const NeonatalMeconiumIleusPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: NeonatalMeconiumIleusRecord;
    evaluation: NeonatalMeconiumIleusEvaluationResult;
    flowsheet: NeonatalMeconiumIleusFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getNeonatalMeconiumIleusEpisode(Number(id))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheet || res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load meconium ileus dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating Meconium Ileus Clinical Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Neonatal Meconium Ileus Episode not found.</div>;
  }

  const { episode, evaluation, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0 print:max-w-none text-xs leading-normal">
      {/* Print Trigger Button */}
      <div className="flex justify-end mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700"
        >
          Print Dossier 🖨
        </button>
      </div>

      {/* Hospital Header */}
      <div className="border-b-2 border-amber-800 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black text-amber-900 uppercase tracking-tight">
            Neonatal Intensive Care & Pediatric Surgery Division
          </h1>
          <p className="text-xs font-semibold text-slate-600">
            Neonatal Meconium Ileus & Cystic Fibrosis Gastrografin Decompression Protocol
          </p>
          <p className="text-[10px] text-slate-500">
            Reference: AAP Section on Surgery / Cystic Fibrosis Foundation Guidelines
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-black text-slate-800">{episode.episode_code}</div>
          <div className="text-[10px] text-slate-500">
            Dossier Generated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Patient & Case Demographics */}
      <div className="bg-slate-50 border border-slate-200 rounded p-3 mb-4 grid grid-cols-4 gap-2">
        <div>
          <span className="text-[10px] text-slate-500 uppercase block">Patient Name</span>
          <span className="font-bold text-slate-900">{episode.patient_name || `Patient #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block">Age at Onset</span>
          <span className="font-bold text-slate-900">{episode.age_hours} hours of life</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block">Birth Weight</span>
          <span className="font-bold text-slate-900">{episode.weight_kg} kg</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block">Status</span>
          <span className="font-bold capitalize text-amber-700">{episode.status.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Evaluation Assessment Banner */}
      <div className={`border rounded p-3 mb-4 ${
        evaluation.surgeryIndicated ? 'bg-red-50 border-red-300' : 'bg-emerald-50 border-emerald-300'
      }`}>
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold text-sm text-slate-900">
            Protocol Category: {evaluation.urgencyTierLabel}
          </span>
          <span className="font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white border">
            CF Correlation: {evaluation.isCysticFibrosisSuspected ? 'CF Strongly Suspected' : 'Low Suspicion'}
          </span>
        </div>
        <p className="font-medium text-slate-800 text-xs mb-2">
          {evaluation.recommendedProcedure}
        </p>

        {evaluation.alerts.length > 0 && (
          <div className="mt-2 space-y-1">
            {evaluation.alerts.map((alt, i) => (
              <div key={i} className="text-[11px] text-red-700 font-semibold">
                ⚠️ {alt}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clinical Presentation & Imaging Table */}
      <div className="mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b pb-1 mb-2">
          Clinical Examination & Fluoroscopic Imaging
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <table className="w-full text-[11px] border">
            <tbody>
              <tr className="border-b bg-slate-50">
                <td className="p-1.5 font-medium text-slate-600">Meconium Passage</td>
                <td className="p-1.5 font-bold">{episode.meconium_passed_yet ? 'Passed' : 'Delayed / None in >24-48h'}</td>
              </tr>
              <tr className="border-b">
                <td className="p-1.5 font-medium text-slate-600">Abdominal Distension</td>
                <td className="p-1.5 capitalize font-bold">{episode.abdominal_distension.replace(/_/g, ' ')}</td>
              </tr>
              <tr className="border-b bg-slate-50">
                <td className="p-1.5 font-medium text-slate-600">Emesis Character</td>
                <td className="p-1.5 capitalize font-bold">{episode.emesis_character.replace(/_/g, ' ')}</td>
              </tr>
              <tr className="border-b">
                <td className="p-1.5 font-medium text-slate-600">Palpable Doughy Masses</td>
                <td className="p-1.5 font-bold">{episode.palpable_doughy_masses ? 'Yes (Lower Quadrant Pellets)' : 'No'}</td>
              </tr>
              <tr>
                <td className="p-1.5 font-medium text-slate-600">Family History CF</td>
                <td className="p-1.5 font-bold">{episode.family_history_cystic_fibrosis ? 'Positive Family History' : 'Negative / Unknown'}</td>
              </tr>
            </tbody>
          </table>

          <table className="w-full text-[11px] border">
            <tbody>
              <tr className="border-b bg-slate-50">
                <td className="p-1.5 font-medium text-slate-600">Plain Abdominal X-Ray</td>
                <td className="p-1.5 capitalize font-bold">{episode.plain_abdominal_xray_findings.replace(/_/g, ' ')}</td>
              </tr>
              <tr className="border-b">
                <td className="p-1.5 font-medium text-slate-600">Disuse Microcolon</td>
                <td className="p-1.5 font-bold">{episode.microcolon_confirmed ? 'Confirmed Visualized' : 'Normal Caliber'}</td>
              </tr>
              <tr className="border-b bg-slate-50">
                <td className="p-1.5 font-medium text-slate-600">Contrast Enema Agent</td>
                <td className="p-1.5 capitalize font-bold">{episode.contrast_enema_type.replace(/_/g, ' ')}</td>
              </tr>
              <tr className="border-b">
                <td className="p-1.5 font-medium text-slate-600">Enema Decompression Outcome</td>
                <td className="p-1.5 capitalize font-bold">{episode.enema_success_outcome.replace(/_/g, ' ')}</td>
              </tr>
              <tr>
                <td className="p-1.5 font-medium text-slate-600">CFTR Gene Panel Sent</td>
                <td className="p-1.5 font-bold">{episode.cftr_gene_mutation_sent ? 'Sent (Pending)' : 'Not Sent'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Protocols & Directives */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 border rounded bg-amber-50/50">
          <h3 className="font-bold text-[11px] text-amber-900 mb-1">
            Gastrografin Decompression Protocols
          </h3>
          <ul className="text-[10px] text-slate-700 list-disc pl-4 space-y-0.5">
            {evaluation.gastrografinProtocolDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>

        <div className="p-3 border rounded bg-blue-50/50">
          <h3 className="font-bold text-[11px] text-blue-900 mb-1">
            Cystic Fibrosis Directives
          </h3>
          <ul className="text-[10px] text-slate-700 list-disc pl-4 space-y-0.5">
            {evaluation.cysticFibrosisDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Serial Flowsheet Table */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b pb-1 mb-2">
          Serial Flowsheet Checkpoints ({flowsheet.length})
        </h2>
        {flowsheet.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic">No flowsheet entries recorded.</p>
        ) : (
          <table className="w-full text-[10px] border">
            <thead className="bg-slate-100 font-bold border-b">
              <tr>
                <th className="p-1.5 text-left">Time</th>
                <th className="p-1.5 text-left">Hrs</th>
                <th className="p-1.5 text-left">Girth (cm)</th>
                <th className="p-1.5 text-left">Meconium Passage</th>
                <th className="p-1.5 text-left">Hydration</th>
                <th className="p-1.5 text-left">UOP (mL/kg/h)</th>
                <th className="p-1.5 text-left">Na+ (mEq/L)</th>
                <th className="p-1.5 text-left">HR</th>
                <th className="p-1.5 text-left">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {flowsheet.map((log) => (
                <tr key={log.id}>
                  <td className="p-1.5 whitespace-nowrap">{new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-1.5">{log.hours_from_onset}h</td>
                  <td className="p-1.5 font-bold">{log.abdominal_girth_cm}</td>
                  <td className="p-1.5 capitalize">{log.meconium_evacuated_amount.replace(/_/g, ' ')}</td>
                  <td className="p-1.5 capitalize">{log.hydration_status.replace(/_/g, ' ')}</td>
                  <td className="p-1.5">{log.urine_output_ml_kg_hr ?? '—'}</td>
                  <td className="p-1.5">{log.serum_sodium_meq_l ?? '—'}</td>
                  <td className="p-1.5">{log.heart_rate}</td>
                  <td className="p-1.5">{log.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Signature and Attestation */}
      <div className="pt-6 border-t grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <span className="block text-slate-500 mb-1">Attending Neonatologist / Pediatric Surgeon:</span>
          <div className="border-b border-slate-400 h-6 mb-1"></div>
          <span className="font-bold text-slate-800">
            Dr. {episode.consultant_name || 'Attending Neonatologist'}
          </span>
        </div>
        <div>
          <span className="block text-slate-500 mb-1">Verified / Attestation Date:</span>
          <div className="border-b border-slate-400 h-6 mb-1"></div>
          <span className="font-bold text-slate-800">{new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};
