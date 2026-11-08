import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPediatricMeningitisEpisode, type PediatricBacterialMeningitisRecord, type PediatricBacterialMeningitisFlowsheetRecord } from '../api';

export const PediatricBacterialMeningitisPrint: React.FC = () => {
  const { episodeId } = useParams<{ episodeId: string }>();
  const [episode, setEpisode] = useState<PediatricBacterialMeningitisRecord | null>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [flowsheet, setFlowsheet] = useState<PediatricBacterialMeningitisFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!episodeId) return;
    (async () => {
      try {
        const res = await getPediatricMeningitisEpisode(Number(episodeId));
        setEpisode(res.episode);
        setEvaluation(res.evaluation);
        setFlowsheet(res.flowsheet);
      } catch (err: any) {
        setError(err?.message || 'Failed to load Meningitis episode dossier');
      } finally {
        setLoading(false);
      }
    })();
  }, [episodeId]);

  if (loading) return <div className="p-8 text-center text-sm">Generating Meningitis Clinical Dossier...</div>;
  if (error || !episode) {
    return <div className="p-8 text-center text-red-600 text-sm">{error || 'Episode not found'}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-gray-900 text-xs font-sans print:p-0">
      {/* Header */}
      <div className="border-b-2 border-amber-800 pb-3 mb-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-amber-950">
            PEDIATRIC BACTERIAL MENINGITIS & NIGROVIC BMS CLINICAL DOSSIER
          </h1>
          <p className="text-[11px] text-gray-600">
            Nigrovic Clinical Prediction Rule &bull; CSF Cytology & Chemistry &bull; Empiric Antimicrobial Stewardship
          </p>
        </div>
        <div className="text-right">
          <span className="font-mono text-sm font-bold text-amber-950">{episode.episode_code}</span>
          <div className="text-[10px] text-gray-500">Printed: {new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Patient & Presentation Overview */}
      <div className="grid grid-cols-4 gap-2 bg-gray-50 p-3 rounded border mb-4">
        <div>
          <span className="text-gray-500 block text-[10px]">Patient Name</span>
          <span className="font-bold">{episode.patient_name || 'Patient'}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Age / Weight</span>
          <span className="font-semibold">{episode.age_months} months / {episode.weight_kg} kg</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">GCS / Seizures</span>
          <span className="font-semibold">{episode.gcs_score}/15 | {episode.seizure_at_presentation ? 'Seizure Present' : 'No Seizure'}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Episode Status</span>
          <span className="font-bold text-amber-950 uppercase">{episode.status.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Primary Scoring & Severity */}
      {evaluation && (
        <div className="border border-amber-200 bg-amber-50/50 p-4 rounded mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-amber-950">
              Nigrovic BMS Score: {evaluation.bmsBreakdown.totalBmsScore} / 6
            </span>
            <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-950">
              {evaluation.riskTierLabel}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2 text-[11px]">
            <div>
              <span className="font-semibold text-gray-700 block">CSF Profile:</span>
              <p className="text-gray-800">
                WBC {episode.csf_wbc_count} ({episode.csf_neutrophil_percent}% PMN, ANC {episode.csf_anc_calculated}/mm³)
              </p>
              <p className="text-gray-800">
                Protein: {episode.csf_protein_mg_dl} mg/dL | Glucose: {episode.csf_glucose_mg_dl} (Ratio {episode.csf_to_blood_glucose_ratio})
              </p>
              <p className="text-gray-800">
                Gram Stain: {episode.csf_gram_stain_positive ? `Positive (${episode.csf_gram_stain_organism})` : 'Negative'}
              </p>
            </div>
            <div>
              <span className="font-semibold text-gray-700 block">Empiric Regimen Doses:</span>
              <p className="text-gray-800">Ceftriaxone: {evaluation.antibioticRecommendations.ceftriaxoneDoseMg} mg IV Q12H</p>
              <p className="text-gray-800">Vancomycin: {evaluation.antibioticRecommendations.vancomycinDoseMg} mg IV Q6H</p>
              <p className="text-gray-800">Dexamethasone: {evaluation.antibioticRecommendations.dexamethasoneDoseMg} mg IV (prior to/with abx)</p>
            </div>
          </div>
        </div>
      )}

      {/* Clinical Notes & Precautions */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border p-3 rounded bg-gray-50/50">
          <span className="font-bold text-gray-800 block mb-1">Meningeal & Physical Signs</span>
          <ul className="list-disc list-inside text-gray-700 space-y-0.5">
            <li>Kernig/Brudzinski sign: {episode.kernig_brudzinski_sign ? 'Positive' : 'Negative'}</li>
            <li>Bulging fontanelle: {episode.fontanelle_bulging ? 'Yes' : 'No'}</li>
            <li>Purpuric rash: {episode.purpuric_rash ? 'Present (Meningococcemia Alert)' : 'Absent'}</li>
            <li>Prior antibiotics (72h): {episode.prior_antibiotic_exposure_72h ? 'Yes (Confounder)' : 'None'}</li>
            <li>Isolation: {episode.isolation_precautions.replace(/_/g, ' ')}</li>
          </ul>
        </div>

        <div className="border p-3 rounded bg-gray-50/50">
          <span className="font-bold text-gray-800 block mb-1">Clinical Directives</span>
          <ul className="list-disc list-inside text-gray-700 space-y-0.5">
            {evaluation?.recommendations?.map((r: string, i: number) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Flowsheet Table */}
      <div className="mb-4">
        <h3 className="font-bold text-gray-900 mb-2 border-b pb-1">
          Neurological Checkpoints ({flowsheet.length})
        </h3>
        {flowsheet.length === 0 ? (
          <p className="text-gray-500 italic">No flowsheet entries recorded.</p>
        ) : (
          <table className="w-full text-left text-[11px] border-collapse border">
            <thead className="bg-gray-100 text-gray-700">
              <tr className="border-b">
                <th className="p-1.5 border-r">Date/Time</th>
                <th className="p-1.5 border-r">GCS</th>
                <th className="p-1.5 border-r">Pupils</th>
                <th className="p-1.5 border-r">Temp</th>
                <th className="p-1.5 border-r">HR/BP</th>
                <th className="p-1.5 border-r">Seizures</th>
                <th className="p-1.5 border-r">Antibiotic Given</th>
                <th className="p-1.5">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-800">
              {flowsheet.map((f) => (
                <tr key={f.id}>
                  <td className="p-1.5 border-r">{new Date(f.log_datetime).toLocaleString()}</td>
                  <td className="p-1.5 border-r font-bold">{f.gcs_score}/15</td>
                  <td className="p-1.5 border-r">{f.pupil_reactivity.replace(/_/g, ' ')}</td>
                  <td className="p-1.5 border-r font-bold text-red-700">{f.temperature_celsius}°C</td>
                  <td className="p-1.5 border-r">{f.heart_rate} ({f.blood_pressure_sys}/{f.blood_pressure_dia})</td>
                  <td className="p-1.5 border-r">{f.seizure_activity_observed ? 'Yes' : 'No'}</td>
                  <td className="p-1.5 border-r">{f.antibiotic_dose_administered ?? '-'}</td>
                  <td className="p-1.5">{f.logged_by_name ?? 'Staff'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Signatures */}
      <div className="mt-8 pt-4 border-t border-gray-400 grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <span className="block text-gray-500">Attending Pediatrician / Infectious Disease:</span>
          <span className="font-bold text-gray-800">{episode.consultant_name || 'Staff Pediatrician'}</span>
          <div className="mt-6 border-b border-gray-300 w-48"></div>
          <span className="text-[10px] text-gray-400">Signature & Stamp</span>
        </div>
        <div className="text-right">
          <span className="block text-gray-500">Document Generated:</span>
          <span>{new Date().toISOString()}</span>
        </div>
      </div>
    </div>
  );
};
