import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getNeonatalAbdominalDefectsEpisode,
  type NeonatalAbdominalDefectRecord,
  type NeonatalAbdominalDefectFlowsheetRecord,
} from '../api';
import { type NeonatalAbdominalDefectsEvaluationResult } from '../neonatalAbdominalDefectsEngine';

export const NeonatalAbdominalDefectsPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: NeonatalAbdominalDefectRecord;
    evaluation: NeonatalAbdominalDefectsEvaluationResult;
    flowsheet: NeonatalAbdominalDefectFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getNeonatalAbdominalDefectsEpisode(Number(id))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load abdominal wall defect dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating Abdominal Wall Defect Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Abdominal Wall Defect Record not found.</div>;
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
            Neonatal Intensive Care &amp; Pediatric Surgery Division
          </h1>
          <p className="text-xs font-semibold text-slate-600">
            Neonatal Abdominal Wall Defects (Gastroschisis vs Omphalocele) Protocol
          </p>
          <p className="text-[10px] text-slate-500">
            Reference: APSA / AAP Section on Surgery / BAPS Consensus Guidelines
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-black text-slate-800">{episode.episode_code}</div>
          <div className="text-[10px] text-slate-500">
            Generated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Patient & Summary Card */}
      <div className="grid grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200 mb-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Patient Name</span>
          <span className="font-bold text-slate-900">{episode.patient_name || `Patient #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Defect Type</span>
          <span className="font-semibold">{evaluation.defectClassificationLabel}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Diameter &amp; Sac</span>
          <span className="font-semibold">{episode.defect_diameter_cm} cm • {episode.membrane_sac_present ? 'Sac Intact' : 'No Sac / Ruptured'}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Consultant</span>
          <span className="font-semibold">{episode.consultant_name || 'Attending Neonatologist'}</span>
        </div>
      </div>

      {/* Clinical Metrics & Risk Evaluation */}
      <div className="p-3 bg-slate-50 rounded border border-slate-200 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold text-slate-900 text-sm">IAH / Abdominal Compartment Status</span>
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-100 text-cyan-900">
            {evaluation.urgencyTierLabel}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-2 text-slate-700">
          <div><strong>Bladder Pressure:</strong> {episode.current_bladder_pressure_mmhg} mmHg ({evaluation.iahGradeLabel})</div>
          <div><strong>Peak Insp. Pressure:</strong> {episode.peak_inspiratory_pressure_cmh2o} cmH2O</div>
          <div><strong>Closure Approach:</strong> {episode.closure_approach.replace(/_/g, ' ')}</div>
          <div><strong>Silo Height:</strong> {episode.silo_height_cm ?? 'N/A'} cm</div>
        </div>

        {evaluation.alerts.length > 0 && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-800">
            <strong>Critical Directives &amp; Alerts:</strong>
            <ul className="list-disc pl-4 mt-1 space-y-0.5">
              {evaluation.alerts.map((al, idx) => (
                <li key={idx}>{al}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Protocol Directives */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 border border-slate-200 rounded">
          <h3 className="font-bold text-cyan-900 mb-1">Fluid &amp; Thermal Care Directives</h3>
          <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11px]">
            {evaluation.fluidManagementDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>

        <div className="p-3 border border-slate-200 rounded">
          <h3 className="font-bold text-cyan-900 mb-1">Bedside Silo &amp; Reduction Protocol</h3>
          <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11px]">
            {evaluation.bedsideSiloDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Flowsheet Log Checkpoints Table */}
      <div className="border border-slate-200 rounded overflow-hidden mb-4">
        <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-800">
          Bedside Reduction &amp; Compartment Manometry Log
        </div>
        <table className="w-full text-left text-[10px] divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-1">Day</th>
              <th className="px-2 py-1">Time</th>
              <th className="px-2 py-1">Reduced</th>
              <th className="px-2 py-1">Residual Silo</th>
              <th className="px-2 py-1">Bladder P.</th>
              <th className="px-2 py-1">PIP</th>
              <th className="px-2 py-1">Urine Output</th>
              <th className="px-2 py-1">Perfusion</th>
              <th className="px-2 py-1">Visceral Color</th>
              <th className="px-2 py-1">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {flowsheet.map((l) => (
              <tr key={l.id}>
                <td className="px-2 py-1 font-semibold">Day {l.day_of_reduction}</td>
                <td className="px-2 py-1">{new Date(l.log_datetime).toLocaleDateString()} {new Date(l.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-2 py-1">{l.silo_height_reduced_cm} cm</td>
                <td className="px-2 py-1 font-semibold">{l.residual_silo_height_cm} cm</td>
                <td className="px-2 py-1 font-semibold">{l.bladder_pressure_mmhg} mmHg</td>
                <td className="px-2 py-1">{l.peak_inspiratory_pressure_cmh2o} cmH2O</td>
                <td className="px-2 py-1">{l.urine_output_ml_kg_hr} mL/kg/h</td>
                <td className="px-2 py-1">{l.lower_extremity_perfusion.replace(/_/g, ' ')}</td>
                <td className="px-2 py-1">{l.bowel_visceral_color.replace(/_/g, ' ')}</td>
                <td className="px-2 py-1 text-slate-500">{l.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Signature Section */}
      <div className="pt-6 mt-6 border-t border-slate-300 flex justify-between items-end text-[10px] text-slate-500">
        <div>
          <div>Consultant: {episode.consultant_name || 'Attending Neonatologist / Pediatric Surgeon'}</div>
          <div>Department of Pediatric Surgery &amp; Neonatology</div>
        </div>
        <div className="text-right">
          <div className="border-b border-slate-400 w-48 mb-1"></div>
          <div>Authorized Signature &amp; Stamp</div>
        </div>
      </div>
    </div>
  );
};
