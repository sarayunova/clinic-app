import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getObstetricPlacentalAbruptionEpisode,
  type ObstetricPlacentalAbruptionRecord,
  type ObstetricPlacentalAbruptionFlowsheetRecord,
} from '../api';
import { type ObstetricPlacentalAbruptionEvaluationResult } from '../obstetricPlacentalAbruptionEngine';

export const ObstetricPlacentalAbruptionPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: ObstetricPlacentalAbruptionRecord;
    evaluation: ObstetricPlacentalAbruptionEvaluationResult;
    flowsheet: ObstetricPlacentalAbruptionFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getObstetricPlacentalAbruptionEpisode(Number(id))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheet || res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load abruption dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating Placental Abruption Clinical Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Placental Abruption Episode not found.</div>;
  }

  const { episode, evaluation, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0 print:max-w-none text-xs leading-normal">
      {/* Print Trigger Button */}
      <div className="flex justify-end mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-800"
        >
          Print Dossier 🖨
        </button>
      </div>

      {/* Hospital Header */}
      <div className="border-b-2 border-rose-800 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black text-rose-900 uppercase tracking-tight">
            Maternal-Fetal Medicine & Obstetric Emergency Service
          </h1>
          <p className="text-xs font-semibold text-slate-600">
            Placental Abruption (Abruptio Placentae) & Consumptive Coagulopathy Protocol
          </p>
          <p className="text-[10px] text-slate-500">
            Reference: ACOG Practice Bulletin No. 183 / RCOG Green-top Guideline on Antepartum Hemorrhage
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
          <span className="text-[10px] text-slate-500 uppercase block">Gestational Age / Parity</span>
          <span className="font-bold text-slate-900">{episode.gestational_age_weeks} weeks • Para {episode.maternal_parity}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block">MTP Status</span>
          <span className="font-bold text-slate-900">{episode.mtp_activated ? 'MTP ACTIVATED (1:1:1)' : 'Standby'}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block">Clinical Status</span>
          <span className="font-bold capitalize text-rose-700">{episode.status.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Evaluation Assessment Banner */}
      <div className={`border rounded p-3 mb-4 ${
        evaluation.pageClassificationGrade === 'grade_3_severe_maternal_shock_demise_or_dic'
          ? 'bg-red-50 border-red-300'
          : 'bg-amber-50 border-amber-300'
      }`}>
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold text-sm text-slate-900">
            Page Classification: {evaluation.pageClassificationGradeLabel}
          </span>
          <span className="font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white border">
            Shock Index: {evaluation.shockIndex} ({evaluation.shockIndex >= 0.9 ? 'HEMODYNAMIC COLLAPSE' : 'Compensated'})
          </span>
        </div>
        <p className="font-bold text-rose-900 text-xs mb-1">
          Recommended Obstetric Plan: {evaluation.deliveryModeIndicatedLabel}
        </p>

        {evaluation.isConsumptiveCoagulopathyPresent && (
          <div className="text-[11px] font-black text-red-700 mt-1">
            🩸 CRITICAL CONSUMPTIVE HYPOFIBRINOGENEMIA: Fibrinogen {episode.serum_fibrinogen_mg_dl} mg/dL. Target &ge; 200 mg/dL with Cryoprecipitate.
          </div>
        )}

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

      {/* Clinical Findings & Coagulation Tables */}
      <div className="mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b pb-1 mb-2">
          Obstetric Examination, Fetal Monitoring & Coagulation Labs
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <table className="w-full text-[11px] border">
            <tbody>
              <tr className="border-b bg-slate-50">
                <td className="p-1.5 font-medium text-slate-600">Vaginal Bleeding</td>
                <td className="p-1.5 capitalize font-bold">{episode.vaginal_bleeding_severity.replace(/_/g, ' ')}</td>
              </tr>
              <tr className="border-b">
                <td className="p-1.5 font-medium text-slate-600">Abdominal Pain</td>
                <td className="p-1.5 capitalize font-bold">{episode.abdominal_pain_character.replace(/_/g, ' ')}</td>
              </tr>
              <tr className="border-b bg-slate-50">
                <td className="p-1.5 font-medium text-slate-600">Uterine Tonus</td>
                <td className="p-1.5 capitalize font-bold text-rose-700">{episode.uterine_tonus.replace(/_/g, ' ')}</td>
              </tr>
              <tr className="border-b">
                <td className="p-1.5 font-medium text-slate-600">Fetal Heart Rate Status</td>
                <td className="p-1.5 capitalize font-bold">{episode.fetal_heart_rate_status.replace(/_/g, ' ')}</td>
              </tr>
              <tr>
                <td className="p-1.5 font-medium text-slate-600">Retroplacental Hematoma</td>
                <td className="p-1.5 capitalize font-bold">{episode.ultrasound_retroplacental_hematoma.replace(/_/g, ' ')}</td>
              </tr>
            </tbody>
          </table>

          <table className="w-full text-[11px] border">
            <tbody>
              <tr className="border-b bg-slate-50">
                <td className="p-1.5 font-medium text-slate-600">Maternal BP & Heart Rate</td>
                <td className="p-1.5 font-bold">{episode.maternal_systolic_bp}/{episode.maternal_diastolic_bp} mmHg • HR {episode.maternal_heart_rate} bpm</td>
              </tr>
              <tr className="border-b">
                <td className="p-1.5 font-medium text-slate-600">Serum Fibrinogen</td>
                <td className="p-1.5 font-bold text-rose-700">{episode.serum_fibrinogen_mg_dl} mg/dL (Target &ge; 200)</td>
              </tr>
              <tr className="border-b bg-slate-50">
                <td className="p-1.5 font-medium text-slate-600">Platelets / Hemoglobin</td>
                <td className="p-1.5 font-bold">{episode.platelet_count.toLocaleString()}/mcL • {episode.hemoglobin_g_dl} g/dL</td>
              </tr>
              <tr className="border-b">
                <td className="p-1.5 font-medium text-slate-600">PT / INR</td>
                <td className="p-1.5 font-bold">{episode.pt_inr ?? '—'}</td>
              </tr>
              <tr>
                <td className="p-1.5 font-medium text-slate-600">Kleihauer-Betke Test</td>
                <td className="p-1.5 font-bold">{episode.kleihauer_betke_sent ? 'Sent' : 'Not Performed'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Resuscitation & Blood Product Directives */}
      <div className="mb-4 p-3 border rounded bg-rose-50/50">
        <h3 className="font-bold text-[11px] text-rose-900 mb-1">
          ACOG / RCOG Resuscitation & Coagulation Directives
        </h3>
        <ul className="text-[10px] text-slate-700 list-disc pl-4 space-y-0.5">
          {evaluation.resuscitationDirectives.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>

      {/* Serial Flowsheet Table */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b pb-1 mb-2">
          Serial Hemodynamic Checkpoints & Transfusion Log ({flowsheet.length})
        </h2>
        {flowsheet.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic">No flowsheet entries recorded.</p>
        ) : (
          <table className="w-full text-[10px] border">
            <thead className="bg-slate-100 font-bold border-b">
              <tr>
                <th className="p-1.5 text-left">Time</th>
                <th className="p-1.5 text-left">Mins</th>
                <th className="p-1.5 text-left">BP (mmHg)</th>
                <th className="p-1.5 text-left">HR</th>
                <th className="p-1.5 text-left">Shock Index</th>
                <th className="p-1.5 text-left">FHR</th>
                <th className="p-1.5 text-left">Uterine Tone</th>
                <th className="p-1.5 text-left">Loss (mL)</th>
                <th className="p-1.5 text-left">Fibrinogen</th>
                <th className="p-1.5 text-left">Transfused Products</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {flowsheet.map((log) => {
                const si = (log.maternal_heart_rate / (log.maternal_blood_pressure_sys || 1)).toFixed(2);
                return (
                  <tr key={log.id}>
                    <td className="p-1.5 whitespace-nowrap">{new Date(log.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-1.5">{log.minutes_from_presentation}m</td>
                    <td className="p-1.5">{log.maternal_blood_pressure_sys}/{log.maternal_blood_pressure_dia}</td>
                    <td className="p-1.5">{log.maternal_heart_rate}</td>
                    <td className="p-1.5 font-bold">{si}</td>
                    <td className="p-1.5">{log.fetal_heart_rate ?? '—'}</td>
                    <td className="p-1.5 capitalize">{log.uterine_tone_assessment.replace(/_/g, ' ')}</td>
                    <td className="p-1.5">{log.vaginal_blood_loss_ml ?? '—'}</td>
                    <td className="p-1.5 font-bold text-rose-700">{log.fibrinogen_mg_dl ?? '—'}</td>
                    <td className="p-1.5">{log.blood_products_infused || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Signature and Attestation */}
      <div className="pt-6 border-t grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <span className="block text-slate-500 mb-1">Attending Obstetrician / Maternal-Fetal Specialist:</span>
          <div className="border-b border-slate-400 h-6 mb-1"></div>
          <span className="font-bold text-slate-800">
            Dr. {episode.consultant_name || 'Attending Obstetrician'}
          </span>
        </div>
        <div>
          <span className="block text-slate-500 mb-1">Attending Anesthesiologist:</span>
          <div className="border-b border-slate-400 h-6 mb-1"></div>
          <span className="font-bold text-slate-800">{new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};
