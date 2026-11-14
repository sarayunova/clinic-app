import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPediatricAcuteLiverFailureEpisode,
  type PediatricAcuteLiverFailureRecord,
  type PediatricAcuteLiverFailureFlowsheetRecord,
} from '../api';
import { evaluatePediatricAcuteLiverFailure } from '../pediatricAcuteLiverFailureEngine';

export const PediatricAcuteLiverFailurePrint: React.FC = () => {
  const { id, episodeId } = useParams<{ id?: string; episodeId?: string }>();
  const targetId = id || episodeId;

  const [episode, setEpisode] = useState<PediatricAcuteLiverFailureRecord | null>(null);
  const [flowsheet, setFlowsheet] = useState<PediatricAcuteLiverFailureFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await getPediatricAcuteLiverFailureEpisode(Number(targetId));
        setEpisode(res.episode);
        setFlowsheet(res.flowsheet || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load PALF dossier');
      } finally {
        setLoading(false);
      }
    })();
  }, [targetId]);

  if (loading) return <div className="p-8 text-center text-sm">Loading clinical dossier...</div>;
  if (error || !episode) return <div className="p-8 text-center text-red-600 text-sm">{error || 'Episode not found'}</div>;

  const evaluation = evaluatePediatricAcuteLiverFailure({
    ageMonths: episode.age_months,
    weightKg: episode.weight_kg,
    suspectedEtiology: episode.suspected_etiology,
    encephalopathyStage: episode.encephalopathy_stage as any,
    inr: episode.inr,
    totalBilirubinMgDl: episode.total_bilirubin_mg_dl,
    directBilirubinMgDl: episode.direct_bilirubin_mg_dl,
    altUL: episode.alt_u_l,
    astUL: episode.ast_u_l,
    serumAmmoniaUmolL: episode.serum_ammonia_umol_l,
    bloodGlucoseMgDl: episode.blood_glucose_mg_dl,
    serumSodiumMeqL: episode.serum_sodium_meq_l,
    serumCreatinineMgDl: episode.serum_creatinine_mg_dl,
    hasCerebralEdema: Boolean(episode.has_cerebral_edema),
  });

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 text-black bg-white print:p-0">
      <div className="border-b-2 border-black pb-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider">
            Pediatric Acute Liver Failure (PALF) & Neuroprotection Dossier
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            PALF Study Group Criteria • King&apos;s College Criteria • Hypertonic Saline & Antioxidant Salvage
          </p>
        </div>
        <div className="text-right text-xs">
          <div><strong>Episode:</strong> {episode.episode_number}</div>
          <div><strong>Diagnosis:</strong> {new Date(episode.diagnosis_datetime).toLocaleString()}</div>
          <button
            onClick={() => window.print()}
            className="mt-2 px-3 py-1 bg-black text-white text-xs rounded print:hidden"
          >
            Print Dossier
          </button>
        </div>
      </div>

      {/* Patient & Laboratory Summary */}
      <div className="grid grid-cols-2 gap-4 text-xs border p-3 rounded bg-gray-50">
        <div>
          <div><strong>Patient:</strong> {episode.patient_name || `Patient #${episode.patient_id}`}</div>
          <div><strong>Age / Weight:</strong> {(episode.age_months / 12).toFixed(1)} years ({episode.age_months} months) • {episode.weight_kg} kg</div>
          <div><strong>Suspected Etiology:</strong> {episode.suspected_etiology.replace(/_/g, ' ')}</div>
          <div><strong>INR:</strong> {episode.inr} (PALF criteria: &ge; 1.5 with HE or &ge; 2.0 without)</div>
          <div><strong>Encephalopathy:</strong> Grade {episode.encephalopathy_stage}</div>
        </div>
        <div>
          <div><strong>Total / Direct Bilirubin:</strong> {episode.total_bilirubin_mg_dl} / {episode.direct_bilirubin_mg_dl ?? '-'} mg/dL</div>
          <div><strong>ALT / AST:</strong> {episode.alt_u_l} / {episode.ast_u_l} U/L</div>
          <div><strong>Ammonia:</strong> {episode.serum_ammonia_umol_l ?? '-'} µmol/L</div>
          <div><strong>Sodium / Glucose:</strong> {episode.serum_sodium_meq_l ?? '-'} mEq/L • {episode.blood_glucose_mg_dl} mg/dL</div>
          <div><strong>Status:</strong> {episode.status.toUpperCase()}</div>
        </div>
      </div>

      {/* Prognosis & Neuroprotection Directives */}
      <div className="border p-4 rounded text-xs space-y-2">
        <h2 className="font-bold text-sm uppercase border-b pb-1">
          Transplant Urgency & Cerebral Edema Prevention Bundle
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div>
              <strong>King&apos;s College Criteria:</strong>{' '}
              <span className={evaluation.kingsCollege.isCriteriaMet ? 'font-bold text-red-700' : 'text-gray-700'}>
                {evaluation.kingsCollege.isCriteriaMet ? 'POSITIVE (Emergent Transplant Listing)' : 'Negative (Active PICU Surveillance)'}
              </span>
            </div>
            <div className="mt-1 text-gray-700">{evaluation.kingsCollege.rationale}</div>
            {evaluation.kingsCollege.criteriaDetails.length > 0 && (
              <ul className="list-disc ml-4 mt-1 text-gray-600">
                {evaluation.kingsCollege.criteriaDetails.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div><strong>Neuroprotection:</strong> {evaluation.neuroprotectionPlan.targetSodiumMeqL}</div>
            <div className="text-gray-600 mt-1">{evaluation.neuroprotectionPlan.hypertonicSalineDirectives}</div>
            <div className="text-gray-600 mt-1">{evaluation.neuroprotectionPlan.nAcetylcysteineDirectives}</div>
            <div className="text-gray-600 mt-1">{evaluation.neuroprotectionPlan.lactuloseDirectives}</div>
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

      {/* Flowsheet Log Table */}
      <div className="space-y-2 text-xs">
        <h2 className="font-bold text-sm uppercase border-b pb-1">Bedside Neurological & PICU Flowsheet Log</h2>
        {flowsheet.length === 0 ? (
          <p className="text-gray-500 italic">No flowsheet checks recorded yet.</p>
        ) : (
          <table className="w-full border-collapse border border-gray-300 text-left">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="p-1 border-r">Time</th>
                <th className="p-1 border-r">Grade / GCS</th>
                <th className="p-1 border-r">Pupils</th>
                <th className="p-1 border-r">MAP / HR</th>
                <th className="p-1 border-r">Na+ / Gluc</th>
                <th className="p-1 border-r">Ammonia</th>
                <th className="p-1 border-r">Stools</th>
                <th className="p-1 border-r">Neuro-Checks & Notes</th>
                <th className="p-1">Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {flowsheet.map((f) => (
                <tr key={f.id} className="border-b border-gray-200">
                  <td className="p-1 border-r">{new Date(f.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-1 border-r font-bold">Grade {f.encephalopathy_stage} (GCS {f.gcs_score ?? '-'})</td>
                  <td className="p-1 border-r">{f.pupil_reactivity}</td>
                  <td className="p-1 border-r">{f.mean_arterial_pressure_mmhg ? `${f.mean_arterial_pressure_mmhg} mmHg` : '-'} ({f.heart_rate_bpm ?? '-'})</td>
                  <td className="p-1 border-r">Na: {f.serum_sodium_meq_l ?? '-'} | G: {f.blood_glucose_mg_dl ?? '-'}</td>
                  <td className="p-1 border-r">{f.serum_ammonia_umol_l ?? '-'}</td>
                  <td className="p-1 border-r">{f.daily_stool_count}</td>
                  <td className="p-1 border-r">
                    {f.icp_monitoring_notes && <div><strong>ICP:</strong> {f.icp_monitoring_notes}</div>}
                    {f.nurse_notes && <div className="text-gray-600">{f.nurse_notes}</div>}
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
          <p>Pediatric Hepatologist / PICU Intensivist: ___________________________</p>
          <p className="text-gray-500 mt-1">Signature & Medical Registration Number</p>
        </div>
        <div className="text-right">
          <p>Date & Time: ___________________________</p>
          <p className="text-gray-500 mt-1">Liver Transplant Coordination Archive</p>
        </div>
      </div>
    </div>
  );
};
