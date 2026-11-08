import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPediatricKawasakiEpisode,
  type PediatricKawasakiRecord,
  type PediatricKawasakiFlowsheetRecord,
} from '../api';
import { type PediatricKawasakiResult } from '../pediatricKawasakiEngine';

export const PediatricKawasakiPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: PediatricKawasakiRecord;
    evaluation: PediatricKawasakiResult;
    flowsheet: PediatricKawasakiFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getPediatricKawasakiEpisode(Number(id))
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load Kawasaki dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating Kawasaki Disease Clinical Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Pediatric Kawasaki Episode not found.</div>;
  }

  const { episode, evaluation, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0 print:max-w-none text-xs leading-normal">
      {/* Print Trigger Button (Hidden in Print) */}
      <div className="flex justify-end mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-800"
        >
          Print Dossier 🖨
        </button>
      </div>

      {/* Hospital Dossier Header */}
      <div className="border-b-2 border-amber-800 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-amber-900">
            Pediatric Cardiology & Infectious Diseases
          </h1>
          <p className="text-sm font-semibold text-slate-800">
            Kawasaki Disease (KD) & Coronary Artery Aneurysm Prevention Protocol Dossier
          </p>
          <p className="text-[10px] text-slate-500">
            American Heart Association (AHA) 2017 Guidelines / Kobayashi Score for IVIG Resistance
          </p>
        </div>
        <div className="text-right">
          <div className="text-base font-black font-mono text-amber-700">{episode.episode_code}</div>
          <div className="text-[10px] text-slate-600">Generated: {new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Patient & Baseline Information */}
      <div className="grid grid-cols-4 gap-2 border border-slate-300 p-2.5 rounded mb-4 bg-slate-50">
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Patient Name</span>
          <span className="font-bold text-xs">{episode.patient_name || `Patient #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Age / Weight</span>
          <span className="font-semibold">{episode.age_months} months ({episode.weight_kg} kg)</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Fever Duration</span>
          <span className="font-semibold">{episode.fever_duration_days} days</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Diagnostic Class</span>
          <span className="font-semibold capitalize">{episode.diagnosis_classification.replace(/_/g, ' ')}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Presentation Time</span>
          <span className="font-semibold">{episode.presentation_datetime}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Principal Criteria</span>
          <span className="font-semibold">{episode.principal_criteria_count} of 5 Present</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Status</span>
          <span className="font-bold uppercase text-amber-700">{episode.status.replace(/_/g, ' ')}</span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 block">Pediatrician</span>
          <span className="font-semibold">{episode.consultant_name || 'Staff Pediatrician'}</span>
        </div>
      </div>

      {/* Kobayashi IVIG Resistance & Coronary Risk Stratification */}
      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
        <h3 className="font-bold text-amber-900 text-xs uppercase mb-2">
          Kobayashi IVIG Resistance Risk & Echocardiographic Coronary Dimensions
        </h3>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="border-r border-amber-200">
            <span className="block text-[10px] text-amber-700 uppercase font-semibold">Kobayashi Score</span>
            <span className="text-xl font-black text-amber-900">{evaluation.kobayashiScore} / 11</span>
            <span className="block text-[9px] text-slate-500">Cut-off &ge; 5 is High Risk</span>
          </div>
          <div className="border-r border-amber-200">
            <span className="block text-[10px] text-amber-700 uppercase font-semibold">IVIG Resistance</span>
            <span className={`text-base font-black uppercase ${
              evaluation.ivigResistanceRisk === 'high_risk' ? 'text-red-700' : 'text-emerald-700'
            }`}>
              {evaluation.ivigResistanceRisk.replace(/_/g, ' ')}
            </span>
            <span className="block text-[9px] text-slate-500">{evaluation.ivigResistanceRiskLabel}</span>
          </div>
          <div className="border-r border-amber-200">
            <span className="block text-[10px] text-amber-700 uppercase font-semibold">Max Coronary Z-Score</span>
            <span className="text-xl font-black text-rose-900">{evaluation.maxCoronaryZScore.toFixed(1)}</span>
            <span className="block text-[9px] text-slate-500">LAD: {episode.lad_z_score ?? '-'} | RCA: {episode.rca_z_score ?? '-'}</span>
          </div>
          <div>
            <span className="block text-[10px] text-amber-700 uppercase font-semibold">Coronary Classification</span>
            <span className="text-xs font-black uppercase text-slate-800">
              {evaluation.coronaryAneurysmClassification.replace(/_/g, ' ')}
            </span>
            <span className="block text-[9px] text-slate-500">{evaluation.coronaryAneurysmClassificationLabel}</span>
          </div>
        </div>
      </div>

      {/* Pharmacotherapy Dosing Calculations */}
      <div className="mb-4 border border-slate-300 rounded overflow-hidden">
        <div className="bg-slate-100 p-2 font-bold text-slate-800 border-b border-slate-300">
          AHA Guideline Pharmacotherapy Regimen (Weight: {episode.weight_kg} kg)
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-200 text-center p-3">
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase">IVIG Single Infusion (2 g/kg)</span>
            <span className="text-lg font-black text-blue-700">{evaluation.treatmentRegimen.ivigDoseGrams} g</span>
            <span className="block text-[9px] text-slate-500">Continuous IV over 10 to 12 hours</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase">Acute High-Dose Aspirin (40 mg/kg/d)</span>
            <span className="text-lg font-black text-amber-700">{evaluation.treatmentRegimen.aspirinAcuteDoseMgDay} mg/day</span>
            <span className="block text-[9px] text-slate-500">Divided into 4 doses until afebrile 48h</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase">Maintenance Low-Dose Aspirin (4 mg/kg/d)</span>
            <span className="text-lg font-black text-emerald-700">{evaluation.treatmentRegimen.aspirinMaintenanceDoseMgDay} mg/day</span>
            <span className="block text-[9px] text-slate-500">Once daily for 6-8 weeks antiplatelet</span>
          </div>
        </div>
      </div>

      {/* Clinical Exam Findings & Labs */}
      <div className="mb-4 border border-slate-300 rounded p-3">
        <h3 className="font-bold text-slate-800 text-xs uppercase mb-2">Principal Clinical Features & Laboratory Workup</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-slate-700">
          <div>• Conjunctival injection: <strong>{episode.conjunctivitis_bilateral_bulbar ? 'PRESENT' : 'Absent'}</strong></div>
          <div>• Strawberry tongue / oral: <strong>{episode.oral_mucosal_changes ? 'PRESENT' : 'Absent'}</strong></div>
          <div>• Polymorphous rash: <strong>{episode.polymorphous_exanthem_rash ? 'PRESENT' : 'Absent'}</strong></div>
          <div>• Extremity erythema/edema: <strong>{episode.peripheral_extremity_changes ? 'PRESENT' : 'Absent'}</strong></div>
          <div>• Cervical node &ge;1.5cm: <strong>{episode.cervical_lymphadenopathy_ge_1_5cm ? 'PRESENT' : 'Absent'}</strong></div>
          <div>• BCG scar erythema: <strong>{episode.bcg_scar_erythema ? 'PRESENT' : 'Absent'}</strong></div>
          <div>• CRP: <strong>{episode.crp_mg_l} mg/L</strong></div>
          <div>• ESR: <strong>{episode.esr_mm_hr} mm/hr</strong></div>
          <div>• Serum Sodium: <strong>{episode.serum_sodium_meq_l ?? 'N/A'} mEq/L</strong></div>
          <div>• Serum Albumin: <strong>{episode.serum_albumin_g_dl ?? 'N/A'} g/dL</strong></div>
          <div>• Platelets: <strong>{episode.platelet_count?.toLocaleString() ?? 'N/A'} /mcL</strong></div>
          <div>• ALT / SGPT: <strong>{episode.alt_u_l ?? 'N/A'} U/L</strong></div>
        </div>
      </div>

      {/* Serial Flowsheet */}
      <div className="mb-4">
        <h3 className="font-bold text-slate-800 text-xs uppercase mb-1">Serial Temperature Curve & Infusion Monitoring</h3>
        <table className="w-full border-collapse border border-slate-300 text-[10px]">
          <thead className="bg-slate-100">
            <tr>
              <th className="border border-slate-300 p-1">Time</th>
              <th className="border border-slate-300 p-1">Hours</th>
              <th className="border border-slate-300 p-1">Temp (°C)</th>
              <th className="border border-slate-300 p-1">HR (bpm)</th>
              <th className="border border-slate-300 p-1">BP (mmHg)</th>
              <th className="border border-slate-300 p-1">IVIG Running</th>
              <th className="border border-slate-300 p-1">Aspirin (mg)</th>
              <th className="border border-slate-300 p-1">Rash / Response</th>
              <th className="border border-slate-300 p-1">Staff</th>
            </tr>
          </thead>
          <tbody>
            {flowsheet.length === 0 ? (
              <tr>
                <td colSpan={9} className="border border-slate-300 p-2 text-center text-slate-400 italic">
                  No vital signs or infusion checkpoints recorded.
                </td>
              </tr>
            ) : (
              flowsheet.map((f) => (
                <tr key={f.id} className="text-center">
                  <td className="border border-slate-300 p-1">{f.log_datetime?.slice(11, 16)}</td>
                  <td className="border border-slate-300 p-1">{f.hours_from_admission}h</td>
                  <td className={`border border-slate-300 p-1 font-bold ${f.temperature_celsius >= 38.0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {f.temperature_celsius}°C
                  </td>
                  <td className="border border-slate-300 p-1">{f.heart_rate}</td>
                  <td className="border border-slate-300 p-1">{f.blood_pressure_sys ? `${f.blood_pressure_sys}/${f.blood_pressure_dia || '-'}` : '-'}</td>
                  <td className="border border-slate-300 p-1 font-semibold text-blue-700">
                    {f.ivig_infusion_running ? 'RUNNING' : 'Complete'}
                  </td>
                  <td className="border border-slate-300 p-1">{f.aspirin_dose_given_mg ? `${f.aspirin_dose_given_mg} mg` : '-'}</td>
                  <td className="border border-slate-300 p-1 text-left">{f.rash_appearance || f.extremity_edema || '-'}</td>
                  <td className="border border-slate-300 p-1">{f.logged_by_name || 'Staff'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Clinical Directives */}
      <div className="mb-4 space-y-2">
        {evaluation.alerts.length > 0 && (
          <div className="p-2.5 border border-red-300 rounded bg-red-50">
            <span className="font-bold text-[10px] text-red-800 block uppercase mb-1">
              Critical Cardiology Alerts:
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-[10px] text-red-700">
              {evaluation.alerts.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {evaluation.recommendations.length > 0 && (
          <div className="p-2.5 border border-slate-300 rounded bg-slate-50">
            <span className="font-bold text-[10px] text-slate-700 block uppercase mb-1">
              AHA Clinical Recommendations:
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-[10px] text-slate-600">
              {evaluation.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Sign-off */}
      <div className="border-t border-slate-400 pt-6 mt-8 grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <div className="border-b border-slate-400 pb-8 mb-1"></div>
          <span className="font-semibold text-slate-600">Consultant Pediatric Cardiologist Signature</span>
        </div>
        <div className="text-right">
          <div className="border-b border-slate-400 pb-8 mb-1"></div>
          <span className="font-semibold text-slate-600">Attending Pediatrician Signature</span>
        </div>
      </div>
    </div>
  );
};
