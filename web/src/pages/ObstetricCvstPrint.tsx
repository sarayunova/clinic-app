import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getObstetricCvstEpisode,
  type ObstetricCvstRecord,
  type ObstetricCvstFlowsheetRecord,
} from '../api';
import { evaluateObstetricCvst } from '../obstetricCvstEngine';

export const ObstetricCvstPrint: React.FC = () => {
  const { id, episodeId } = useParams<{ id?: string; episodeId?: string }>();
  const targetId = id || episodeId;

  const [episode, setEpisode] = useState<ObstetricCvstRecord | null>(null);
  const [flowsheet, setFlowsheet] = useState<ObstetricCvstFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await getObstetricCvstEpisode(Number(targetId));
        setEpisode(res.episode);
        setFlowsheet(res.flowsheet || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load obstetric CVST dossier');
      } finally {
        setLoading(false);
      }
    })();
  }, [targetId]);

  if (loading) return <div className="p-8 text-center text-sm">Loading clinical dossier...</div>;
  if (error || !episode) return <div className="p-8 text-center text-red-600 text-sm">{error || 'Episode not found'}</div>;

  let sinuses: string[] = [];
  try {
    sinuses = JSON.parse(episode.thrombosed_sinus_locations_json || '[]');
  } catch {
    sinuses = [];
  }

  const evaluation = evaluateObstetricCvst({
    gestationalAgeWeeks: episode.gestational_age_weeks,
    clinicalTiming: episode.clinical_timing as any,
    presentingHeadacheType: episode.presenting_headache_type as any,
    seizuresPresent: Boolean(episode.seizures_present),
    papilledemaPresent: Boolean(episode.papilledema_present),
    focalNeurologicalDeficit: Boolean(episode.focal_neurological_deficit),
    alteredMentalStatusComa: Boolean(episode.altered_mental_status_coma),
    thrombosedSinusLocations: sinuses,
    intracranialHemorrhagicVenousInfarct: Boolean(episode.intracranial_hemorrhagic_venous_infarct),
    therapeuticAnticoagulationActive: Boolean(episode.therapeutic_anticoagulation_active),
    anticoagulantAgent: episode.anticoagulant_agent as any,
    intracranialHypertensionManagement: episode.intracranial_hypertension_management as any,
    antiepilepticTherapyActive: Boolean(episode.antiepileptic_therapy_active),
  });

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 text-black bg-white print:p-0">
      <div className="border-b-2 border-black pb-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider">
            Obstetric Cerebral Venous Sinus Thrombosis (CVST) Clinical Dossier
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            European Stroke Organisation (ESO) & AHA/ASA Guidelines on Pregnancy-Associated Stroke
          </p>
        </div>
        <div className="text-right text-xs">
          <div><strong>Episode:</strong> {episode.episode_code}</div>
          <div><strong>Onset:</strong> {new Date(episode.onset_datetime).toLocaleDateString()}</div>
          <button
            onClick={() => window.print()}
            className="mt-2 px-3 py-1 bg-black text-white text-xs rounded print:hidden"
          >
            Print Dossier
          </button>
        </div>
      </div>

      {/* Patient & Neuro Exam Banner */}
      <div className="grid grid-cols-2 gap-4 border border-black p-4 text-xs">
        <div>
          <div><strong>Patient Name:</strong> {episode.patient_name || `Patient #${episode.patient_id}`}</div>
          <div><strong>Clinical Timing:</strong> {episode.clinical_timing.replace(/_/g, ' ')} ({episode.gestational_age_weeks}w)</div>
          <div><strong>Attending Consultant:</strong> {episode.consultant_name || 'Dr. Demo Sharma'}</div>
        </div>
        <div>
          <div><strong>Headache Character:</strong> {episode.presenting_headache_type.replace(/_/g, ' ')}</div>
          <div><strong>Anticoagulant Regimen:</strong> {episode.anticoagulant_agent.replace(/_/g, ' ')}</div>
          <div><strong>Current Status:</strong> {episode.status.replace(/_/g, ' ')}</div>
        </div>
      </div>

      {/* Neuroimaging & Sinus Anatomy */}
      <div className="border border-black p-4 space-y-2 text-xs">
        <div className="font-bold border-b border-gray-300 pb-1 uppercase">
          Neuroimaging & Dural Venous Sinus Occlusion Findings
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><strong>Thrombosed Sinuses:</strong> {sinuses.length > 0 ? sinuses.map(s => s.replace(/_/g, ' ')).join(', ') : 'None documented'}</div>
          <div><strong>Hemorrhagic Venous Infarct:</strong> {episode.intracranial_hemorrhagic_venous_infarct ? 'YES (Confirmed on MRI/CT)' : 'None'}</div>
        </div>
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-gray-200">
          <div>Papilledema: {episode.papilledema_present ? 'Present' : 'Absent'}</div>
          <div>Seizures: {episode.seizures_present ? 'Present' : 'Absent'}</div>
          <div>Focal Deficit: {episode.focal_neurological_deficit ? 'Present' : 'Absent'}</div>
          <div>Altered Coma: {episode.altered_mental_status_coma ? 'Present' : 'Absent'}</div>
        </div>
      </div>

      {/* Anticoagulation & ICP Management */}
      <div className="border border-black p-4 space-y-2 text-xs">
        <div className="font-bold border-b border-gray-300 pb-1 uppercase">
          Therapeutic Anticoagulation & Intracranial Pressure Directives
        </div>
        {evaluation.alerts.length > 0 && (
          <div className="space-y-1">
            {evaluation.alerts.map((al, idx) => (
              <div key={idx} className="font-bold text-red-700">⚠️ {al}</div>
            ))}
          </div>
        )}
        {evaluation.anticoagulationDirectives.length > 0 && (
          <div>
            <strong>Anticoagulation Directives:</strong>
            <ul className="list-disc list-inside">
              {evaluation.anticoagulationDirectives.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
        )}
        {evaluation.elevatedIcpDirectives.length > 0 && (
          <div>
            <strong>Intracranial Pressure (ICP) Protocols:</strong>
            <ul className="list-disc list-inside">
              {evaluation.elevatedIcpDirectives.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Serial Neuro Surveillance Flowsheet */}
      {flowsheet.length > 0 && (
        <div className="border border-black p-4 space-y-2 text-xs">
          <div className="font-bold border-b border-gray-300 pb-1 uppercase">
            Serial Neuro Surveillance Flowsheet
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1">Timestamp</th>
                <th className="py-1">GCS</th>
                <th className="py-1">Pupils</th>
                <th className="py-1">Headache</th>
                <th className="py-1">BP (mmHg)</th>
                <th className="py-1">HR</th>
                <th className="py-1">Anti-Xa / aPTT</th>
                <th className="py-1">Seizure</th>
                <th className="py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {flowsheet.map((row) => (
                <tr key={row.id} className="border-b border-gray-200">
                  <td className="py-1">{new Date(row.log_datetime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="py-1 font-bold">{row.gcs_score}/15</td>
                  <td className="py-1 capitalize">{row.pupillary_reactivity.replace(/_/g, ' ')}</td>
                  <td className="py-1">{row.headache_severity_nrs}/10</td>
                  <td className="py-1">{row.systolic_bp_mmhg}/{row.diastolic_bp_mmhg}</td>
                  <td className="py-1">{row.heart_rate_bpm}</td>
                  <td className="py-1 font-mono font-semibold">{row.anti_xa_or_aptt_level}</td>
                  <td className="py-1">{row.seizure_activity_observed ? 'Yes' : 'No'}</td>
                  <td className="py-1">{row.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes and Sign-off */}
      {episode.clinical_notes && (
        <div className="border border-black p-4 text-xs">
          <div className="font-bold border-b border-gray-300 pb-1 uppercase">Neurology & Neurovascular Impression</div>
          <p className="mt-1 whitespace-pre-wrap">{episode.clinical_notes}</p>
        </div>
      )}

      <div className="pt-8 flex justify-between items-end text-xs">
        <div>Generated via LiVi Clinic Neuro-Obstetric Emergency System</div>
        <div className="text-right border-t border-black pt-2 w-48">
          Attending Neuro-Vascular Consultant Signature
        </div>
      </div>
    </div>
  );
};
