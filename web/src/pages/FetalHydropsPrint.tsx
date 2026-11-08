import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getFetalHydropsEpisode,
  type FetalHydropsRecord,
  type FetalHydropsFlowsheetRecord,
} from '../api';
import { evaluateFetalHydrops } from '../fetalHydropsEngine';

export const FetalHydropsPrint: React.FC = () => {
  const { id, episodeId } = useParams<{ id?: string; episodeId?: string }>();
  const targetId = id || episodeId;

  const [episode, setEpisode] = useState<FetalHydropsRecord | null>(null);
  const [flowsheet, setFlowsheet] = useState<FetalHydropsFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await getFetalHydropsEpisode(Number(targetId));
        setEpisode(res.episode);
        setFlowsheet(res.flowsheet || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load fetal hydrops dossier');
      } finally {
        setLoading(false);
      }
    })();
  }, [targetId]);

  if (loading) return <div className="p-8 text-center text-sm">Loading clinical dossier...</div>;
  if (error || !episode) return <div className="p-8 text-center text-red-600 text-sm">{error || 'Episode not found'}</div>;

  const evaluation = evaluateFetalHydrops({
    gestationalAgeWeeks: episode.gestational_age_weeks,
    ascitesPresent: Boolean(episode.ascites_present),
    pleuralEffusionPresent: Boolean(episode.pleural_effusion_present),
    pericardialEffusionPresent: Boolean(episode.pericardial_effusion_present),
    skinEdemaPresent: Boolean(episode.skin_edema_present),
    placentalEdemaPresent: Boolean(episode.placental_edema_present),
    polyhydramniosPresent: Boolean(episode.polyhydramnios_present),
    mcaPsvMom: episode.mca_psv_mom,
    suspectedEtiologyCategory: episode.suspected_etiology_category,
    fetalArrhythmiaDetected: Boolean(episode.fetal_arrhythmia_detected),
    maternalMirrorSyndromeSuspected: Boolean(episode.maternal_mirror_syndrome_suspected),
    maternalSystolicBpMmhg: episode.maternal_systolic_bp_mmhg,
    maternalDiastolicBpMmhg: episode.maternal_diastolic_bp_mmhg,
    maternalProteinuriaGrade: episode.maternal_proteinuria_grade,
    maternalGeneralizedAnasarca: Boolean(episode.maternal_generalized_anasarca),
    inUteroInterventionPlanned: episode.in_utero_intervention_planned,
  });

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 text-black bg-white print:p-0">
      <div className="border-b-2 border-black pb-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider">
            Non-Immune Fetal Hydrops (NIHF) & Mirror Syndrome Clinical Dossier
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Society for Maternal-Fetal Medicine (SMFM) Consult Series #37 Guidelines
          </p>
        </div>
        <div className="text-right text-xs">
          <div><strong>Episode:</strong> {episode.episode_code}</div>
          <div><strong>Date:</strong> {new Date(episode.diagnosis_datetime).toLocaleDateString()}</div>
          <button
            onClick={() => window.print()}
            className="mt-2 px-3 py-1 bg-black text-white text-xs rounded print:hidden"
          >
            Print Dossier
          </button>
        </div>
      </div>

      {/* Patient & GA Banner */}
      <div className="grid grid-cols-2 gap-4 border border-black p-4 text-xs">
        <div>
          <div><strong>Patient Name:</strong> {episode.patient_name || `Patient #${episode.patient_id}`}</div>
          <div><strong>Gestational Age:</strong> {episode.gestational_age_weeks} weeks</div>
          <div><strong>Attending MFM:</strong> {episode.consultant_name || 'Dr. Demo Sharma'}</div>
        </div>
        <div>
          <div><strong>Etiology Category:</strong> {episode.suspected_etiology_category.replace(/_/g, ' ')}</div>
          <div><strong>Intervention Plan:</strong> {episode.in_utero_intervention_planned.replace(/_/g, ' ')}</div>
          <div><strong>Current Status:</strong> {episode.status.replace(/_/g, ' ')}</div>
        </div>
      </div>

      {/* Compartments & Doppler Box */}
      <div className="border border-black p-4 space-y-2 text-xs">
        <div className="font-bold border-b border-gray-300 pb-1 uppercase">
          Sonographic Compartment Survey & MCA Doppler Velocimetry
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><strong>Fluid Spaces:</strong> {episode.fetal_compartments_involved_count} compartments</div>
          <div><strong>MCA PSV:</strong> {episode.mca_psv_mom} MoM {episode.mca_psv_mom >= 1.5 ? '(Severe Anemia)' : ''}</div>
          <div><strong>Fetal Arrhythmia:</strong> {episode.fetal_arrhythmia_detected ? 'Detected' : 'None'}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200">
          <div>Ascites: {episode.ascites_present ? 'Present' : 'Absent'}</div>
          <div>Pleural Effusion: {episode.pleural_effusion_present ? 'Present' : 'Absent'}</div>
          <div>Pericardial Effusion: {episode.pericardial_effusion_present ? 'Present' : 'Absent'}</div>
          <div>Skin Edema: {episode.skin_edema_present ? 'Present (&ge;5mm)' : 'Absent'}</div>
          <div>Placentomegaly: {episode.placental_edema_present ? 'Present' : 'Absent'}</div>
          <div>Polyhydramnios: {episode.polyhydramnios_present ? 'Present' : 'Absent'}</div>
        </div>
      </div>

      {/* Mirror Syndrome Screen */}
      <div className="border border-black p-4 space-y-2 text-xs">
        <div className="font-bold border-b border-gray-300 pb-1 uppercase">
          Maternal Mirror Syndrome (Ballantyne) Evaluation
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><strong>Maternal Blood Pressure:</strong> {episode.maternal_systolic_bp_mmhg}/{episode.maternal_diastolic_bp_mmhg} mmHg</div>
          <div><strong>Maternal Proteinuria:</strong> {episode.maternal_proteinuria_grade}</div>
          <div><strong>Generalized Anasarca:</strong> {episode.maternal_generalized_anasarca ? 'YES' : 'NO'}</div>
        </div>
        <div className="mt-1 font-semibold">
          Mirror Syndrome Status: {evaluation.isMirrorSyndromeTriggered ? 'TRIGGERED (CRITICAL MATERNAL-FETAL EMERGENCY)' : 'Negative Screen'}
        </div>
      </div>

      {/* Directives & Recommendations */}
      <div className="border border-black p-4 space-y-2 text-xs">
        <div className="font-bold border-b border-gray-300 pb-1 uppercase">
          Clinical Decision Support Directives & Management
        </div>
        {evaluation.alerts.length > 0 && (
          <div className="space-y-1">
            {evaluation.alerts.map((al, idx) => (
              <div key={idx} className="font-bold text-red-700">⚠️ {al}</div>
            ))}
          </div>
        )}
        {evaluation.mirrorSyndromeDirectives.length > 0 && (
          <div>
            <strong>Mirror Syndrome Protocols:</strong>
            <ul className="list-disc list-inside">
              {evaluation.mirrorSyndromeDirectives.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
        )}
        {evaluation.interventionDirectives.length > 0 && (
          <div>
            <strong>In-Utero Interventions:</strong>
            <ul className="list-disc list-inside">
              {evaluation.interventionDirectives.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Serial Flowsheet */}
      {flowsheet.length > 0 && (
        <div className="border border-black p-4 space-y-2 text-xs">
          <div className="font-bold border-b border-gray-300 pb-1 uppercase">
            Serial Ultrasound & Maternal Surveillance Flowsheet
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1">Timestamp</th>
                <th className="py-1">GA</th>
                <th className="py-1">FHR</th>
                <th className="py-1">MCA PSV</th>
                <th className="py-1">Pleural (mm)</th>
                <th className="py-1">Ascites (mm)</th>
                <th className="py-1">Maternal BP</th>
                <th className="py-1">Weight</th>
                <th className="py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {flowsheet.map((row) => (
                <tr key={row.id} className="border-b border-gray-200">
                  <td className="py-1">{new Date(row.log_datetime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="py-1">{row.gestational_age_weeks}w</td>
                  <td className="py-1">{row.fetal_heart_rate_bpm} bpm</td>
                  <td className="py-1 font-semibold">{row.mca_psv_mom} MoM ({row.mca_psv_cm_s} cm/s)</td>
                  <td className="py-1">{row.pleural_effusion_depth_mm} mm</td>
                  <td className="py-1">{row.ascites_depth_mm} mm</td>
                  <td className="py-1">{row.maternal_bp_systolic}/{row.maternal_bp_diastolic}</td>
                  <td className="py-1">{row.maternal_weight_kg} kg</td>
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
          <div className="font-bold border-b border-gray-300 pb-1 uppercase">Clinical Notes & MFM Opinion</div>
          <p className="mt-1 whitespace-pre-wrap">{episode.clinical_notes}</p>
        </div>
      )}

      <div className="pt-8 flex justify-between items-end text-xs">
        <div>Generated via LiVi Clinic MFM Emergency System</div>
        <div className="text-right border-t border-black pt-2 w-48">
          Attending Maternal-Fetal Subspecialist Signature
        </div>
      </div>
    </div>
  );
};
