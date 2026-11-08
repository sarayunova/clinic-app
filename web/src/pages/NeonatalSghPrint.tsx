import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getNeonatalSghEpisode,
  type NeonatalSghRecord,
  type NeonatalSghFlowsheetRecord,
} from '../api';
import { type NeonatalSghEvaluationResult } from '../neonatalSghEngine';

export const NeonatalSghPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: NeonatalSghRecord;
    evaluation: NeonatalSghEvaluationResult;
    flowsheet: NeonatalSghFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getNeonatalSghEpisode(Number(id))
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load SGH dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating SGH Clinical Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Neonatal SGH Episode not found.</div>;
  }

  const { episode, evaluation, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0 print:max-w-none text-xs leading-normal">
      {/* Print Trigger Button (Hidden in Print) */}
      <div className="flex justify-end mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-800"
        >
          Print Dossier 🖨
        </button>
      </div>

      {/* Hospital Dossier Header */}
      <div className="border-b-2 border-red-800 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-red-900">
            Neonatal Resuscitation & Intensive Care (NICU)
          </h1>
          <p className="text-sm font-semibold text-slate-800">
            Subgaleal Hemorrhage (SGH) Resuscitation & Massive Transfusion Protocol Dossier
          </p>
          <p className="text-[10px] text-slate-500">
            AAP Guidelines / British Association of Perinatal Medicine (BAPM) Framework
          </p>
        </div>
        <div className="text-right">
          <div className="text-base font-black font-mono text-red-700">{episode.episode_code}</div>
          <div className="text-[10px] text-slate-600">Generated: {new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Patient & Baseline Information */}
      <div className="grid grid-cols-4 gap-2 border border-slate-300 p-2.5 rounded mb-4 bg-slate-50">
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Infant Name</span>
          <span className="font-bold text-xs">{episode.patient_name || `Patient #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Birth Weight</span>
          <span className="font-semibold">{episode.birth_weight_kg} kg</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Delivery Mode</span>
          <span className="font-semibold capitalize">{episode.delivery_mode.replace(/_/g, ' ')}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Vacuum Pop-offs</span>
          <span className="font-semibold">{episode.vacuum_cup_popoffs}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Birth Timestamp</span>
          <span className="font-semibold">{episode.birth_datetime}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Diagnosis Timestamp</span>
          <span className="font-semibold">{episode.diagnosis_datetime}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Status</span>
          <span className="font-bold uppercase text-red-700">{episode.status.replace(/_/g, ' ')}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Consultant</span>
          <span className="font-semibold">{episode.consultant_name || 'Staff Neonatologist'}</span>
        </div>
      </div>

      {/* Occult Blood Loss & Shock Severity Quantification */}
      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
        <h3 className="font-bold text-red-900 text-xs uppercase mb-2">
          Occult Blood Loss & Volumetric Resuscitation Matrix
        </h3>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="border-r border-red-200">
            <span className="block text-[10px] text-red-700 uppercase font-semibold">Head Circ. Increase</span>
            <span className="text-base font-black text-red-900">+{evaluation.hcIncreaseCm} cm</span>
            <span className="block text-[9px] text-slate-500">
              ({episode.initial_head_circumference_cm} → {episode.current_head_circumference_cm} cm)
            </span>
          </div>
          <div className="border-r border-red-200">
            <span className="block text-[10px] text-red-700 uppercase font-semibold">Occult Blood Loss</span>
            <span className="text-base font-black text-red-900">~{evaluation.estimatedOccultBloodLossMl} mL</span>
            <span className="block text-[9px] text-slate-500">Formula: 38 mL per 1 cm ΔHC</span>
          </div>
          <div className="border-r border-red-200">
            <span className="block text-[10px] text-red-700 uppercase font-semibold">% Circulating Loss</span>
            <span className="text-base font-black text-red-900">{evaluation.circulatingVolumeLossPct}%</span>
            <span className="block text-[9px] text-slate-500">Est. Total Vol: {evaluation.estimatedTotalBloodVolumeMl} mL</span>
          </div>
          <div>
            <span className="block text-[10px] text-red-700 uppercase font-semibold">Shock Severity State</span>
            <span className="text-sm font-black uppercase text-red-800">
              {evaluation.shockState.replace(/_/g, ' ')}
            </span>
            <span className="block text-[9px] text-slate-500">
              Shock Index: {episode.shock_index ? episode.shock_index.toFixed(2) : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Massive Transfusion Guidance */}
      <div className="mb-4 border border-slate-300 rounded overflow-hidden">
        <div className="bg-slate-100 p-2 font-bold text-slate-800 border-b border-slate-300">
          Massive Transfusion Protocol (MTP) Dosing Guidelines (Weight: {episode.birth_weight_kg} kg)
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-200 text-center p-3">
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase">PRBC (20 mL/kg)</span>
            <span className="text-lg font-black text-red-700">{evaluation.mtpGuidance.prbcVolumeMl} mL</span>
            <span className="block text-[9px] text-slate-500">O-Negative uncrossed / emergency matched</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase">FFP (15 mL/kg)</span>
            <span className="text-lg font-black text-blue-700">{evaluation.mtpGuidance.ffpVolumeMl} mL</span>
            <span className="block text-[9px] text-slate-500">AB plasma / thaw immediately</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase">Cryoprecipitate (10 mL/kg)</span>
            <span className="text-lg font-black text-purple-700">{evaluation.mtpGuidance.cryoprecipitateVolumeMl} mL</span>
            <span className="block text-[9px] text-slate-500">Target Fibrinogen &gt; 150 mg/dL</span>
          </div>
        </div>
      </div>

      {/* Clinical Exam Findings */}
      <div className="mb-4 border border-slate-300 rounded p-3">
        <h3 className="font-bold text-slate-800 text-xs uppercase mb-2">Physical Examination & Signs</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-slate-700">
          <div>• Swelling crosses sutures: <strong>{episode.swelling_crosses_sutures ? 'YES (SGH)' : 'NO'}</strong></div>
          <div>• Fluctuant fluid wave: <strong>{episode.swelling_fluctuant_pitting ? 'YES' : 'NO'}</strong></div>
          <div>• Periorbital ecchymosis: <strong>{episode.periorbital_ecchymosis ? 'PRESENT' : 'ABSENT'}</strong></div>
          <div>• Ear displacement: <strong>{episode.ear_displacement ? 'PRESENT' : 'ABSENT'}</strong></div>
          <div>• Severe cutaneous pallor: <strong>{episode.pallor_severe ? 'PRESENT' : 'ABSENT'}</strong></div>
          <div>• MTP Status: <strong>{episode.mtp_activated ? 'ACTIVATED' : 'STANDBY'}</strong></div>
        </div>
      </div>

      {/* Serial Head Circumference & Flowsheet */}
      <div className="mb-4">
        <h3 className="font-bold text-slate-800 text-xs uppercase mb-1">Serial Head Circumference & Vitals Log</h3>
        <table className="w-full border-collapse border border-slate-300 text-[10px]">
          <thead className="bg-slate-100">
            <tr>
              <th className="border border-slate-300 p-1">Time</th>
              <th className="border border-slate-300 p-1">Hours</th>
              <th className="border border-slate-300 p-1">HC (cm)</th>
              <th className="border border-slate-300 p-1">HR (bpm)</th>
              <th className="border border-slate-300 p-1">BP (mmHg)</th>
              <th className="border border-slate-300 p-1">Cap Refill</th>
              <th className="border border-slate-300 p-1">Hct (%)</th>
              <th className="border border-slate-300 p-1">Transfusion / Bolus</th>
              <th className="border border-slate-300 p-1">Staff</th>
            </tr>
          </thead>
          <tbody>
            {flowsheet.length === 0 ? (
              <tr>
                <td colSpan={9} className="border border-slate-300 p-2 text-center text-slate-400 italic">
                  No serial flowsheet checkpoints recorded.
                </td>
              </tr>
            ) : (
              flowsheet.map((f) => (
                <tr key={f.id} className="text-center">
                  <td className="border border-slate-300 p-1">{f.log_datetime?.slice(11, 16)}</td>
                  <td className="border border-slate-300 p-1">{f.hours_from_birth}h</td>
                  <td className="border border-slate-300 p-1 font-bold text-red-700">{f.head_circumference_cm}</td>
                  <td className="border border-slate-300 p-1">{f.heart_rate}</td>
                  <td className="border border-slate-300 p-1">{f.blood_pressure_sys ? `${f.blood_pressure_sys}/${f.blood_pressure_dia || '-'}` : '-'}</td>
                  <td className="border border-slate-300 p-1">{f.capillary_refill_seconds ? `${f.capillary_refill_seconds}s` : '-'}</td>
                  <td className="border border-slate-300 p-1">{f.hematocrit_pct ? `${f.hematocrit_pct}%` : '-'}</td>
                  <td className="border border-slate-300 p-1 text-left">{f.blood_products_transfused || '-'}</td>
                  <td className="border border-slate-300 p-1">{f.logged_by_name || 'Staff'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Clinical Recommendations */}
      {evaluation.recommendations && (
        <div className="mb-4 p-2.5 border border-slate-300 rounded bg-slate-50">
          <span className="font-bold text-[10px] text-slate-700 block uppercase mb-1">
            Resuscitation Directives:
          </span>
          <ul className="list-disc list-inside space-y-0.5 text-[10px] text-slate-600">
            {evaluation.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Sign-off */}
      <div className="border-t border-slate-400 pt-6 mt-8 grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <div className="border-b border-slate-400 pb-8 mb-1"></div>
          <span className="font-semibold text-slate-600">Attending Neonatologist / NICU Fellow Signature</span>
        </div>
        <div className="text-right">
          <div className="border-b border-slate-400 pb-8 mb-1"></div>
          <span className="font-semibold text-slate-600">Bedside NICU Resuscitation Lead Signature</span>
        </div>
      </div>
    </div>
  );
};
