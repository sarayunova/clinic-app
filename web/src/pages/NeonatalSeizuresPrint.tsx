import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getNeonatalSeizuresEpisode,
  type NeonatalSeizuresRecord,
  type NeonatalSeizuresFlowsheetRecord,
} from '../api';
import { evaluateNeonatalSeizures } from '../neonatalSeizuresEngine';

export const NeonatalSeizuresPrint: React.FC = () => {
  const { id, episodeId } = useParams<{ id?: string; episodeId?: string }>();
  const targetId = id || episodeId;

  const [episode, setEpisode] = useState<NeonatalSeizuresRecord | null>(null);
  const [flowsheet, setFlowsheet] = useState<NeonatalSeizuresFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await getNeonatalSeizuresEpisode(Number(targetId));
        setEpisode(res.episode);
        setFlowsheet(res.flowsheet || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load neonatal seizures dossier');
      } finally {
        setLoading(false);
      }
    })();
  }, [targetId]);

  if (loading) return <div className="p-8 text-center text-sm">Loading clinical dossier...</div>;
  if (error || !episode) return <div className="p-8 text-center text-red-600 text-sm">{error || 'Episode not found'}</div>;

  const evaluation = evaluateNeonatalSeizures({
    gestationalAgeWeeks: episode.gestational_age_weeks,
    postnatalAgeDays: episode.postnatal_age_days,
    currentWeightKg: episode.current_weight_kg,
    seizureSemiology: episode.seizure_semiology,
    seizureDurationCategory: episode.seizure_duration_category,
    suspectedEtiology: episode.suspected_etiology,
    bloodGlucoseMgDl: episode.blood_glucose_mg_dl,
    ionizedCalciumMmolL: episode.ionized_calcium_mmol_l,
    serumMagnesiumMgDl: episode.serum_magnesium_mg_dl,
    sodiumMeqL: episode.sodium_meq_l,
    cumulativePhenobarbitalMgKg: episode.cumulative_phenobarbital_mg_kg,
    secondLineGiven: Boolean(episode.second_line_given),
    pyridoxineTrialDone: Boolean(episode.pyridoxine_trial_done),
  });

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 text-black bg-white print:p-0">
      <div className="border-b-2 border-black pb-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider">
            Neonatal Seizures & Status Epilepticus Clinical Dossier
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            WHO Neonatal Guidelines (2023) • ILAE Semiology • Phenobarbital & Metabolic Directives
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

      {/* Patient & Resuscitation Summary */}
      <div className="grid grid-cols-2 gap-4 text-xs border p-3 rounded bg-gray-50">
        <div>
          <div><strong>Patient:</strong> {episode.patient_name || `Patient #${episode.patient_id}`}</div>
          <div><strong>Gestational Age:</strong> {episode.gestational_age_weeks} weeks</div>
          <div><strong>Postnatal Age:</strong> {episode.postnatal_age_days} days</div>
          <div><strong>Current Weight:</strong> {episode.current_weight_kg} kg</div>
          <div><strong>Respiratory Support:</strong> {episode.respiratory_support_status}</div>
        </div>
        <div>
          <div><strong>Semiology:</strong> {episode.seizure_semiology}</div>
          <div><strong>Duration:</strong> {episode.seizure_duration_category}</div>
          <div><strong>Suspected Etiology:</strong> {episode.suspected_etiology}</div>
          <div><strong>Status:</strong> {episode.status.toUpperCase()}</div>
          <div><strong>Created By:</strong> {episode.created_by_name || 'Staff Clinician'}</div>
        </div>
      </div>

      {/* Evaluation & Dosing Engine Outputs */}
      <div className="border p-4 rounded text-xs space-y-2">
        <h2 className="font-bold text-sm uppercase border-b pb-1">Emergency Pharmacotherapy Directives</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div>
              <strong>1st Line Phenobarbital Bolus (20 mg/kg):</strong>{' '}
              {evaluation.phenobarbitalLoading.bolusDoseMg} mg IV ({evaluation.phenobarbitalLoading.bolusVolumeMl} mL) over {evaluation.phenobarbitalLoading.administrationRate}
            </div>
            <div className="text-gray-600 mt-1">
              Maintenance: {evaluation.phenobarbitalLoading.maintenanceDailyMg} mg/day ({evaluation.phenobarbitalLoading.maintenanceSchedule})
            </div>
          </div>
          <div>
            {evaluation.secondLineRecommendation ? (
              <div>
                <strong>Second-Line Agent ({evaluation.secondLineRecommendation.drug}):</strong>{' '}
                {evaluation.secondLineRecommendation.bolusDoseMg} mg IV over {evaluation.secondLineRecommendation.administrationRate}
              </div>
            ) : (
              <div><strong>Second-Line Agent:</strong> Not indicated unless seizures persist after 20-40 mg/kg Phenobarbital</div>
            )}
          </div>
        </div>

        {evaluation.metabolicDirectives.some((m) => m.isTriggered) && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
            <strong className="text-red-700">Triggered Emergency Metabolic Interventions:</strong>
            <ul className="list-disc ml-5 mt-1">
              {evaluation.metabolicDirectives
                .filter((m) => m.isTriggered)
                .map((m, idx) => (
                  <li key={idx}>
                    <strong>{m.condition}:</strong> {m.intervention} ({m.volumeMl} mL via {m.route})
                  </li>
                ))}
            </ul>
          </div>
        )}

        {evaluation.clinicalAlerts.length > 0 && (
          <div className="mt-2 text-gray-700">
            <strong>Clinical Safety Directives:</strong>
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
        <h2 className="font-bold text-sm uppercase border-b pb-1">Bedside Seizure Surveillance Log</h2>
        {flowsheet.length === 0 ? (
          <p className="text-gray-500 italic">No flowsheet checks logged for this episode.</p>
        ) : (
          <table className="w-full border-collapse border border-gray-300 text-left">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="p-1 border-r">Time</th>
                <th className="p-1 border-r">Count/hr</th>
                <th className="p-1 border-r">State</th>
                <th className="p-1 border-r">HR/RR/SpO2</th>
                <th className="p-1 border-r">BP</th>
                <th className="p-1 border-r">Sedation</th>
                <th className="p-1 border-r">aEEG</th>
                <th className="p-1 border-r">Medications</th>
                <th className="p-1">Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {flowsheet.map((f) => (
                <tr key={f.id} className="border-b border-gray-200">
                  <td className="p-1 border-r">{new Date(f.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-1 border-r font-bold">{f.seizure_count_past_hour}</td>
                  <td className="p-1 border-r">{f.current_seizure_state}</td>
                  <td className="p-1 border-r">{f.heart_rate_bpm ?? '-'}/{f.respiratory_rate_bpm ?? '-'}/{f.spo2_percent ? `${f.spo2_percent}%` : '-'}</td>
                  <td className="p-1 border-r">{f.blood_pressure_sys && f.blood_pressure_dia ? `${f.blood_pressure_sys}/${f.blood_pressure_dia}` : '-'}</td>
                  <td className="p-1 border-r">{f.sedation_score}</td>
                  <td className="p-1 border-r">{f.eeg_background}</td>
                  <td className="p-1 border-r">{f.medication_administered || '-'}</td>
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
          <p>Treating Neonatologist / Pediatrician: ___________________________</p>
          <p className="text-gray-500 mt-1">Signature & Medical Registration Number</p>
        </div>
        <div className="text-right">
          <p>Date & Time: ___________________________</p>
          <p className="text-gray-500 mt-1">Hospital Clinical Record Archive</p>
        </div>
      </div>
    </div>
  );
};
