import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getObstetricDicEpisode,
  type ObstetricDicRecord,
  type ObstetricDicFlowsheetRecord,
} from '../api';
import { evaluateObstetricDic } from '../obstetricDicEngine';

export const ObstetricDicPrint: React.FC = () => {
  const { id, episodeId } = useParams<{ id?: string; episodeId?: string }>();
  const targetId = id || episodeId;

  const [episode, setEpisode] = useState<ObstetricDicRecord | null>(null);
  const [flowsheet, setFlowsheet] = useState<ObstetricDicFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await getObstetricDicEpisode(Number(targetId));
        setEpisode(res.episode);
        setFlowsheet(res.flowsheet || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load obstetric DIC dossier');
      } finally {
        setLoading(false);
      }
    })();
  }, [targetId]);

  if (loading) return <div className="p-8 text-center text-sm">Loading clinical dossier...</div>;
  if (error || !episode) return <div className="p-8 text-center text-red-600 text-sm">{error || 'Episode not found'}</div>;

  const evaluation = evaluateObstetricDic({
    gestationalAgeWeeks: episode.gestational_age_weeks,
    clinicalTrigger: episode.clinical_trigger,
    plateletCountKUl: episode.platelet_count_k_ul,
    fibrinogenMgDl: episode.fibrinogen_mg_dl,
    inr: episode.inr,
    prothrombinTimeSec: episode.prothrombin_time_sec,
    controlPtSec: episode.control_pt_sec,
    apttSec: episode.aptt_sec,
    dDimerUgMl: episode.d_dimer_ug_ml,
    estimatedBloodLossMl: episode.estimated_blood_loss_ml,
    overtBleedingSites: episode.overt_bleeding_sites,
    isMtpActivated: Boolean(episode.is_mtp_activated),
    ionizedCalciumMmolL: episode.ionized_calcium_mmol_l,
    coreTemperatureC: episode.core_temperature_c,
  });

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 text-black bg-white print:p-0">
      <div className="border-b-2 border-black pb-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider">
            Obstetric DIC & Fibrinogen-Guided Resuscitation Dossier
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Pregnancy-Modified ISTH Scoring • Fibrinogen-Guided Hemostasis • Balanced MTP Protocol
          </p>
        </div>
        <div className="text-right text-xs">
          <div><strong>Episode:</strong> {episode.episode_number}</div>
          <div><strong>Onset:</strong> {new Date(episode.diagnosis_datetime).toLocaleString()}</div>
          <button
            onClick={() => window.print()}
            className="mt-2 px-3 py-1 bg-black text-white text-xs rounded print:hidden"
          >
            Print Dossier
          </button>
        </div>
      </div>

      {/* Patient & Hemorrhage Summary */}
      <div className="grid grid-cols-2 gap-4 text-xs border p-3 rounded bg-gray-50">
        <div>
          <div><strong>Patient:</strong> {episode.patient_name || `Patient #${episode.patient_id}`}</div>
          <div><strong>Gestational Age:</strong> {episode.gestational_age_weeks ? `${episode.gestational_age_weeks} weeks` : 'Postpartum'}</div>
          <div><strong>Clinical Trigger:</strong> {episode.clinical_trigger.replace(/_/g, ' ')}</div>
          <div><strong>Estimated Blood Loss:</strong> {episode.estimated_blood_loss_ml} mL</div>
          <div><strong>Overt Bleeding Sites:</strong> {episode.overt_bleeding_sites.replace(/_/g, ' ')}</div>
        </div>
        <div>
          <div><strong>Fibrinogen:</strong> {episode.fibrinogen_mg_dl} mg/dL (Target &ge; 200 mg/dL)</div>
          <div><strong>Platelet Count:</strong> {episode.platelet_count_k_ul} x10^3/µL</div>
          <div><strong>INR:</strong> {episode.inr} | <strong>aPTT:</strong> {episode.aptt_sec ?? '-'} s</div>
          <div><strong>MTP Activated:</strong> {episode.is_mtp_activated ? 'YES (1:1:1)' : 'NO'}</div>
          <div><strong>Status:</strong> {episode.status.toUpperCase()}</div>
        </div>
      </div>

      {/* Evaluation & Fibrinogen Deficit Engine Outputs */}
      <div className="border p-4 rounded text-xs space-y-2">
        <h2 className="font-bold text-sm uppercase border-b pb-1">
          Coagulopathy Stratification & Cryoprecipitate Titration
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div>
              <strong>Modified ISTH DIC Score:</strong> {evaluation.modifiedIsthDicScore} / 8 ({evaluation.severityLabel})
            </div>
            <div className="mt-1">
              <strong>Fibrinogen Deficit:</strong> {evaluation.fibrinogenPlan.fibrinogenDeficitMgDl} mg/dL below target
            </div>
            <div className="mt-1 font-bold text-red-700">
              Cryoprecipitate Required: {evaluation.fibrinogenPlan.recommendedCryoprecipitateUnits} Units (or {evaluation.fibrinogenPlan.recommendedFibrinogenConcentrateGrams}g Concentrate)
            </div>
          </div>
          <div>
            <div><strong>Balanced Transfusion (MTP):</strong> {evaluation.mtpPlan.isMtpIndicated ? 'Indicated' : 'Monitor'}</div>
            <div className="text-gray-600 mt-1">{evaluation.mtpPlan.txaDosingDirectives}</div>
            <div className="text-gray-600 mt-1">{evaluation.mtpPlan.calciumRepletionDirectives}</div>
            <div className="text-gray-600 mt-1">{evaluation.mtpPlan.temperatureMaintenanceDirectives}</div>
          </div>
        </div>

        {evaluation.clinicalAlerts.length > 0 && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
            <strong className="text-red-700">Critical Clinical Alerts:</strong>
            <ul className="list-disc ml-5 mt-1">
              {evaluation.clinicalAlerts.map((alert, idx) => (
                <li key={idx}>{alert}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Transfusion History & Hourly Flowsheet */}
      <div className="space-y-2 text-xs">
        <h2 className="font-bold text-sm uppercase border-b pb-1">Bedside Transfusion & Coagulation Surveillance</h2>
        {flowsheet.length === 0 ? (
          <p className="text-gray-500 italic">No hourly flowsheet checks recorded yet.</p>
        ) : (
          <table className="w-full border-collapse border border-gray-300 text-left">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="p-1 border-r">Time</th>
                <th className="p-1 border-r">BP / HR</th>
                <th className="p-1 border-r">EBL (mL)</th>
                <th className="p-1 border-r">Fibrinogen</th>
                <th className="p-1 border-r">Platelets</th>
                <th className="p-1 border-r">INR</th>
                <th className="p-1 border-r">Urine</th>
                <th className="p-1 border-r">Hemostasis & Infused Components</th>
                <th className="p-1">Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {flowsheet.map((f) => (
                <tr key={f.id} className="border-b border-gray-200">
                  <td className="p-1 border-r">{new Date(f.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-1 border-r">{f.systolic_bp && f.diastolic_bp ? `${f.systolic_bp}/${f.diastolic_bp}` : '-'} ({f.heart_rate_bpm ?? '-'})</td>
                  <td className="p-1 border-r font-bold">{f.hourly_blood_loss_ml}</td>
                  <td className="p-1 border-r font-semibold" style={{ color: f.serial_fibrinogen_mg_dl && f.serial_fibrinogen_mg_dl < 200 ? 'red' : 'inherit' }}>
                    {f.serial_fibrinogen_mg_dl ?? '-'}
                  </td>
                  <td className="p-1 border-r">{f.serial_platelets_k_ul ?? '-'}</td>
                  <td className="p-1 border-r">{f.serial_inr ?? '-'}</td>
                  <td className="p-1 border-r">{f.urine_output_ml_hr ?? '-'}</td>
                  <td className="p-1 border-r">
                    <div><strong>{f.clinical_hemostasis_state}</strong></div>
                    {f.blood_components_infused && <div className="text-gray-600">{f.blood_components_infused}</div>}
                  </td>
                  <td className="p-1">{f.recorded_by_name || 'Staff'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Signature Section */}
      <div className="pt-8 border-t flex justify-between text-xs">
        <div>
          <p>Obstetrician / Anesthesiologist: ___________________________</p>
          <p className="text-gray-500 mt-1">Signature & Medical Registration Number</p>
        </div>
        <div className="text-right">
          <p>Date & Time: ___________________________</p>
          <p className="text-gray-500 mt-1">Hospital Emergency Blood Bank Archive</p>
        </div>
      </div>
    </div>
  );
};
