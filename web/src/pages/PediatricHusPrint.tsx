import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPediatricHusEpisode,
  type PediatricHusRecord,
  type PediatricHusFlowsheetRecord,
} from '../api';
import { type PediatricHusEvaluationResult } from '../pediatricHusEngine';

export const PediatricHusPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: PediatricHusRecord;
    evaluation: PediatricHusEvaluationResult;
    flowsheet: PediatricHusFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getPediatricHusEpisode(Number(id))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheet || res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load HUS dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating Pediatric HUS Clinical Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Pediatric HUS Episode not found.</div>;
  }

  const { episode, evaluation, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0 print:max-w-none text-xs leading-normal">
      {/* Print Trigger Button */}
      <div className="flex justify-end mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-cyan-800"
        >
          Print Dossier 🖨
        </button>
      </div>

      {/* Hospital Header */}
      <div className="border-b-2 border-cyan-800 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black text-cyan-900 uppercase tracking-tight">
            Pediatric Nephrology & Intensive Care Division
          </h1>
          <p className="text-xs font-semibold text-slate-600">
            Pediatric Hemolytic Uremic Syndrome Protocol (STEC-HUS & Atypical HUS)
          </p>
          <p className="text-[10px] text-slate-500">
            Reference: IPNA Clinical Practice Guidelines / AAP Pediatric Nephrology
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
          <span className="text-[10px] text-slate-500 uppercase block">Age / Weight</span>
          <span className="font-bold text-slate-900">{episode.age_years} yrs • {episode.weight_kg} kg</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block">HUS Phenotype</span>
          <span className="font-bold capitalize text-slate-900">{episode.hus_phenotype.replace(/_/g, ' ')}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block">Clinical Status</span>
          <span className="font-bold capitalize text-cyan-700">{episode.status.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Evaluation Assessment Banner */}
      <div className={`border rounded p-3 mb-4 ${
        evaluation.dialysisRrtIndicated
          ? 'bg-red-50 border-red-300'
          : 'bg-emerald-50 border-emerald-300'
      }`}>
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold text-sm text-slate-900">
            {evaluation.kdigoAkiStageLabel}
          </span>
          <span className="font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white border">
            Triad: {evaluation.isTriadDiagnosticMet ? 'Diagnostic Triad Confirmed' : 'Incomplete Triad'}
          </span>
        </div>

        {evaluation.dialysisRrtIndicated && (
          <p className="font-bold text-red-900 text-xs mb-1">
            Renal Replacement Recommendation: {evaluation.dialysisModalityRecommendation}
          </p>
        )}

        {/* Strict Antibiotic Warning Notice */}
        <div className="p-2 bg-red-100 rounded border border-red-300 text-[11px] font-black text-red-900 mt-2">
          {evaluation.antibioticContraindicationAlert}
        </div>

        {evaluation.alerts.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {evaluation.alerts.map((alt, i) => (
              <div key={i} className="text-[11px] text-red-700 font-semibold">
                ⚠️ {alt}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clinical Findings & Laboratory Tables */}
      <div className="mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b pb-1 mb-2">
          Diagnostic Triad Biomarkers & Clinical Examination
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <table className="w-full text-[11px] border">
            <tbody>
              <tr className="border-b bg-slate-50">
                <td className="p-1.5 font-medium text-slate-600">Hemoglobin</td>
                <td className="p-1.5 font-bold text-rose-700">{episode.hemoglobin_g_dl} g/dL (MAHA)</td>
              </tr>
              <tr className="border-b">
                <td className="p-1.5 font-medium text-slate-600">Platelet Count</td>
                <td className="p-1.5 font-bold text-amber-700">{episode.platelet_count.toLocaleString()}/mcL (&lt;100k)</td>
              </tr>
              <tr className="border-b bg-slate-50">
                <td className="p-1.5 font-medium text-slate-600">Schistocytes on Smear</td>
                <td className="p-1.5 font-bold">{episode.schistocytes_present_pct}% (&ge; 1.0% diagnostic)</td>
              </tr>
              <tr className="border-b">
                <td className="p-1.5 font-medium text-slate-600">Serum LDH</td>
                <td className="p-1.5 font-bold">{episode.serum_ldh_u_l} U/L</td>
              </tr>
              <tr>
                <td className="p-1.5 font-medium text-slate-600">Direct Coombs Test</td>
                <td className="p-1.5 capitalize font-bold">{episode.direct_coombs_test.replace(/_/g, ' ')}</td>
              </tr>
            </tbody>
          </table>

          <table className="w-full text-[11px] border">
            <tbody>
              <tr className="border-b bg-slate-50">
                <td className="p-1.5 font-medium text-slate-600">Serum Creatinine</td>
                <td className="p-1.5 font-bold text-cyan-700">{episode.serum_creatinine_mg_dl} mg/dL (Baseline {episode.baseline_creatinine_mg_dl})</td>
              </tr>
              <tr className="border-b">
                <td className="p-1.5 font-medium text-slate-600">Serum Potassium</td>
                <td className="p-1.5 font-bold text-red-700">{episode.serum_potassium_meq_l} mEq/L</td>
              </tr>
              <tr className="border-b bg-slate-50">
                <td className="p-1.5 font-medium text-slate-600">Oliguria / Anuria</td>
                <td className="p-1.5 font-bold">{episode.oliguria_anuria_duration_hours} hours</td>
              </tr>
              <tr className="border-b">
                <td className="p-1.5 font-medium text-slate-600">Shiga Toxin Stool Test</td>
                <td className="p-1.5 capitalize font-bold">{episode.shiga_toxin_result.replace(/_/g, ' ')}</td>
              </tr>
              <tr>
                <td className="p-1.5 font-medium text-slate-600">Neurological Status</td>
                <td className="p-1.5 capitalize font-bold">{episode.neurological_involvement.replace(/_/g, ' ')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* IPNA Directives */}
      <div className="mb-4 p-3 border rounded bg-cyan-50/50">
        <h3 className="font-bold text-[11px] text-cyan-900 mb-1">
          IPNA Fluid Management & Supportive Directives
        </h3>
        <ul className="text-[10px] text-slate-700 list-disc pl-4 space-y-0.5">
          {evaluation.fluidManagementDirectives.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>

      {/* Serial Flowsheet Table */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b pb-1 mb-2">
          Serial Nephrology & UOP Flowsheet Checkpoints ({flowsheet.length})
        </h2>
        {flowsheet.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic">No flowsheet entries recorded.</p>
        ) : (
          <table className="w-full text-[10px] border">
            <thead className="bg-slate-100 font-bold border-b">
              <tr>
                <th className="p-1.5 text-left">Time</th>
                <th className="p-1.5 text-left">Hrs</th>
                <th className="p-1.5 text-left">UOP (mL/kg/h)</th>
                <th className="p-1.5 text-left">Balance (mL)</th>
                <th className="p-1.5 text-left">Cr (mg/dL)</th>
                <th className="p-1.5 text-left">K+ (mEq/L)</th>
                <th className="p-1.5 text-left">Plt</th>
                <th className="p-1.5 text-left">BP (mmHg)</th>
                <th className="p-1.5 text-left">Neuro</th>
                <th className="p-1.5 text-left">UF (mL)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {flowsheet.map((log) => (
                <tr key={log.id}>
                  <td className="p-1.5 whitespace-nowrap">{new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-1.5">{log.hours_from_onset}h</td>
                  <td className="p-1.5 font-bold">{log.urine_output_ml_kg_hr}</td>
                  <td className="p-1.5">{log.fluid_balance_24h_ml ? `${log.fluid_balance_24h_ml > 0 ? '+' : ''}${log.fluid_balance_24h_ml}` : '—'}</td>
                  <td className="p-1.5 font-bold text-cyan-700">{log.serum_creatinine_mg_dl}</td>
                  <td className="p-1.5 font-bold text-red-700">{log.serum_potassium_meq_l}</td>
                  <td className="p-1.5">{log.platelet_count.toLocaleString()}</td>
                  <td className="p-1.5">{log.blood_pressure_sys}/{log.blood_pressure_dia}</td>
                  <td className="p-1.5 capitalize">{log.neurological_status.replace(/_/g, ' ')}</td>
                  <td className="p-1.5">{log.dialysis_ultrafiltration_ml ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Signature and Attestation */}
      <div className="pt-6 border-t grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <span className="block text-slate-500 mb-1">Attending Pediatric Nephrologist:</span>
          <div className="border-b border-slate-400 h-6 mb-1"></div>
          <span className="font-bold text-slate-800">
            Dr. {episode.consultant_name || 'Attending Pediatric Nephrologist'}
          </span>
        </div>
        <div>
          <span className="block text-slate-500 mb-1">PICU Attending Physician:</span>
          <div className="border-b border-slate-400 h-6 mb-1"></div>
          <span className="font-bold text-slate-800">{new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};
