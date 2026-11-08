import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getObstetricMassivePeEpisode,
  type ObstetricMassivePeRecord,
  type ObstetricMassivePeFlowsheetRecord,
} from '../api';
import { evaluateObstetricMassivePe } from '../obstetricMassivePeEngine';

export const ObstetricMassivePePrint: React.FC = () => {
  const { id, episodeId } = useParams<{ id?: string; episodeId?: string }>();
  const targetId = id || episodeId;

  const [episode, setEpisode] = useState<ObstetricMassivePeRecord | null>(null);
  const [flowsheet, setFlowsheet] = useState<ObstetricMassivePeFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await getObstetricMassivePeEpisode(Number(targetId));
        setEpisode(res.episode);
        setFlowsheet(res.flowsheet || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load obstetric massive PE dossier');
      } finally {
        setLoading(false);
      }
    })();
  }, [targetId]);

  if (loading) return <div className="p-8 text-center text-sm">Loading clinical dossier...</div>;
  if (error || !episode) return <div className="p-8 text-center text-red-600 text-sm">{error || 'Episode not found'}</div>;

  const evaluation = evaluateObstetricMassivePe({
    gestationalAgeWeeks: episode.gestational_age_weeks,
    clinicalSetting: episode.clinical_setting,
    systolicBpMmhg: episode.systolic_bp_mmhg,
    heartRateBpm: episode.heart_rate_bpm,
    respiratoryRate: episode.respiratory_rate,
    spo2Percent: episode.spo2_percent,
    hemodynamicInstabilityShock: Boolean(episode.hemodynamic_instability_shock),
    rvDysfunctionEchoConfirmed: Boolean(episode.rv_dysfunction_echo_confirmed),
    cardiacBiomarkersElevated: Boolean(episode.cardiac_biomarkers_elevated),
    peRiskStratification: episode.pe_risk_stratification,
    thrombolyticTherapyAdministered: Boolean(episode.thrombolytic_therapy_administered),
    thrombolyticAgentDose: episode.thrombolytic_agent_dose as any,
    systemicUfhInfusionActive: Boolean(episode.systemic_ufh_infusion_active),
    targetApttSeconds: episode.target_aptt_seconds,
    catheterDirectedOrSurgicalEmbolectomy: Boolean(episode.catheter_directed_or_surgical_embolectomy),
    inferiorVenaCavaFilterPlaced: Boolean(episode.inferior_vena_cava_filter_placed),
  });

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 text-black bg-white print:p-0">
      <div className="border-b-2 border-black pb-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider">
            Obstetric Massive Pulmonary Embolism (PE) Clinical Dossier
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Clinical Reference: RCOG Green-top 37b / ESC Pregnancy PE / AHA Guidelines
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold">{episode.episode_code}</div>
          <div className="text-xs text-gray-500">{new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Patient & Setting Info */}
      <div className="grid grid-cols-4 gap-4 p-4 border rounded text-xs bg-gray-50">
        <div>
          <span className="text-gray-500 block">Patient Name:</span>
          <span className="font-bold text-sm">{episode.patient_name || `Patient #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Gestation / Setting:</span>
          <span className="font-bold">{episode.gestational_age_weeks} wks • {episode.clinical_setting.replace(/_/g, ' ')}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Onset:</span>
          <span className="font-bold">{episode.onset_datetime.replace('T', ' ')}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Consultant:</span>
          <span className="font-bold">{episode.consultant_name || `Dr. ID #${episode.consultant_id}`}</span>
        </div>
      </div>

      {/* Stratification Banner */}
      <div className="p-4 border rounded text-xs space-y-2">
        <div className="flex justify-between items-center border-b pb-2">
          <span className="font-bold text-sm uppercase">{evaluation.urgencyTierLabel}</span>
          <span className="font-bold px-2 py-0.5 rounded bg-gray-200">
            {evaluation.thrombolysisIndicated ? 'Thrombolysis Indicated' : 'Anticoagulation Only'}
          </span>
        </div>
        {evaluation.alerts.length > 0 && (
          <div className="space-y-1 pt-1">
            {evaluation.alerts.map((al, idx) => (
              <div key={idx} className="font-semibold text-red-700">⚠️ {al}</div>
            ))}
          </div>
        )}
      </div>

      {/* Vitals & Biomarkers */}
      <div className="border rounded p-4 text-xs space-y-3">
        <h3 className="font-bold uppercase tracking-wider border-b pb-1">Hemodynamics & RV Strain Parameters</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-gray-500 block">Blood Pressure:</span>
            <span className="font-bold text-base">{episode.systolic_bp_mmhg} mmHg SBP</span>
          </div>
          <div>
            <span className="text-gray-500 block">Heart Rate / SpO2:</span>
            <span className="font-bold text-base">{episode.heart_rate_bpm} bpm • {episode.spo2_percent}%</span>
          </div>
          <div>
            <span className="text-gray-500 block">Risk Stratification:</span>
            <span className="font-bold">{episode.pe_risk_stratification.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Echocardiography RV Strain:</span>
            <span className="font-bold">{episode.rv_dysfunction_echo_confirmed ? 'Positive (McConnell / TAPSE < 16)' : 'Normal'}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Cardiac Biomarkers:</span>
            <span className="font-bold">{episode.cardiac_biomarkers_elevated ? 'Elevated Troponin / NT-proBNP' : 'Normal'}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Target aPTT:</span>
            <span className="font-bold">{episode.target_aptt_seconds} s (1.5–2.5x control)</span>
          </div>
        </div>
      </div>

      {/* Directives */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="border rounded p-3 space-y-2">
          <h3 className="font-bold uppercase tracking-wider border-b pb-1">Thrombolysis & Hemodynamic Directives</h3>
          <ul className="space-y-1 list-disc list-inside">
            {evaluation.thrombolysisDirectives.concat(evaluation.hemodynamicSupportDirectives).map((d, idx) => (
              <li key={idx}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="border rounded p-3 space-y-2">
          <h3 className="font-bold uppercase tracking-wider border-b pb-1">Anticoagulation & Neuraxial Safety</h3>
          <ul className="space-y-1 list-disc list-inside">
            {evaluation.anticoagulationDirectives.concat(evaluation.neuraxialContraindicationDirectives).map((d, idx) => (
              <li key={idx}>{d}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Flowsheet Table */}
      <div className="border rounded p-4 text-xs space-y-2">
        <h3 className="font-bold uppercase tracking-wider border-b pb-1">
          Serial Flowsheet Checkpoints ({flowsheet.length})
        </h3>
        {flowsheet.length === 0 ? (
          <p className="text-gray-500 py-2">No serial flowsheet entries recorded.</p>
        ) : (
          <table className="w-full text-left">
            <thead className="border-b font-semibold text-gray-600">
              <tr>
                <th className="py-1">Time</th>
                <th className="py-1">Hrs</th>
                <th className="py-1">BP</th>
                <th className="py-1">HR/SpO2</th>
                <th className="py-1">aPTT</th>
                <th className="py-1">Heparin</th>
                <th className="py-1">Norepi</th>
                <th className="py-1">Bleeding</th>
                <th className="py-1">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {flowsheet.map((f) => (
                <tr key={f.id}>
                  <td className="py-1">{f.log_datetime.replace('T', ' ')}</td>
                  <td className="py-1">{f.hours_from_presentation}h</td>
                  <td className="py-1 font-bold">{f.systolic_bp_mmhg}/{f.diastolic_bp_mmhg}</td>
                  <td className="py-1">{f.heart_rate_bpm} / {f.spo2_percent}%</td>
                  <td className="py-1 font-bold">{f.aptt_seconds}s</td>
                  <td className="py-1">{f.heparin_infusion_rate_units_hr} U/h</td>
                  <td className="py-1">{f.vasopressor_norepinephrine_mcg_min}</td>
                  <td className="py-1">{f.bleeding_complication_observed ? 'YES' : 'None'}</td>
                  <td className="py-1 text-gray-600">{f.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Signature Box */}
      <div className="pt-8 grid grid-cols-2 gap-8 text-xs border-t">
        <div>
          <p className="font-bold">Attending Obstetrician / Maternal-Fetal Medicine:</p>
          <div className="h-12 border-b border-gray-400 mt-2"></div>
          <p className="text-gray-500 mt-1">Signature & Medical Registration Number</p>
        </div>
        <div className="text-right">
          <p className="font-bold">ICU / Anesthesiology Intensivist:</p>
          <div className="h-12 border-b border-gray-400 mt-2"></div>
          <p className="text-gray-500 mt-1">Signature & Date/Time</p>
        </div>
      </div>
    </div>
  );
};
