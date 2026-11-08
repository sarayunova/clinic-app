import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPediatricToxicologyEpisode,
  type PediatricToxicologyRecord,
  type PediatricToxicologyFlowsheetRecord,
} from '../api';
import { evaluatePediatricToxicology } from '../pediatricToxicologyEngine';

export const PediatricToxicologyPrint: React.FC = () => {
  const { id, episodeId } = useParams<{ id?: string; episodeId?: string }>();
  const targetId = id || episodeId;

  const [episode, setEpisode] = useState<PediatricToxicologyRecord | null>(null);
  const [flowsheet, setFlowsheet] = useState<PediatricToxicologyFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await getPediatricToxicologyEpisode(Number(targetId));
        setEpisode(res.episode);
        setFlowsheet(res.flowsheet || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load pediatric toxicology dossier');
      } finally {
        setLoading(false);
      }
    })();
  }, [targetId]);

  if (loading) return <div className="p-8 text-center text-sm">Loading clinical dossier...</div>;
  if (error || !episode) return <div className="p-8 text-center text-red-600 text-sm">{error || 'Episode not found'}</div>;

  const evaluation = evaluatePediatricToxicology({
    ageYears: episode.age_years,
    weightKg: episode.weight_kg,
    substanceCategory: episode.substance_category,
    ingestedDoseMgKg: episode.ingested_dose_mg_kg,
    hoursPostIngestion: episode.hours_post_ingestion,
    serumLevelValue: episode.serum_level_value,
    rumackMatthewLineBreached: Boolean(episode.rumack_matthew_line_breached),
    altUL: episode.alt_u_l,
    astUL: episode.ast_u_l,
    totalBilirubinMgDl: episode.total_bilirubin_mg_dl,
    prothrombinTimeInr: episode.prothrombin_time_inr,
    antidoteIndicated: Boolean(episode.antidote_indicated),
    antidoteAdministered: episode.antidote_administered,
    gastricDecontaminationContraindicated: Boolean(episode.gastric_decontamination_contraindicated),
  });

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 text-black bg-white print:p-0">
      <div className="border-b-2 border-black pb-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider">
            Pediatric Acute Ingestion & Toxic Exposure Dossier
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Clinical Reference: AAP / ACMT / Rumack-Matthew Nomogram Protocol
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold">{episode.episode_code}</div>
          <div className="text-xs text-gray-500">{new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Patient & Ingestion Info */}
      <div className="grid grid-cols-4 gap-4 p-4 border rounded text-xs bg-gray-50">
        <div>
          <span className="text-gray-500 block">Patient Name:</span>
          <span className="font-bold text-sm">{episode.patient_name || `Patient #${episode.patient_id}`}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Age / Weight:</span>
          <span className="font-bold">{episode.age_years} yrs • {episode.weight_kg} kg</span>
        </div>
        <div>
          <span className="text-gray-500 block">Ingestion Time:</span>
          <span className="font-bold">{episode.ingestion_datetime.replace('T', ' ')}</span>
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
            {evaluation.toxicityRiskLabel}
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

      {/* Exposure & Lab Parameters */}
      <div className="border rounded p-4 text-xs space-y-3">
        <h3 className="font-bold uppercase tracking-wider border-b pb-1">Substance & Hepatic Biomarkers</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-gray-500 block">Substance Category:</span>
            <span className="font-bold text-base">{episode.substance_category.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Ingested Dose / Timing:</span>
            <span className="font-bold text-base">{episode.ingested_dose_mg_kg} mg/kg ({episode.hours_post_ingestion}h)</span>
          </div>
          <div>
            <span className="text-gray-500 block">Serum Level:</span>
            <span className="font-bold text-base">{episode.serum_level_value}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Rumack-Matthew Status:</span>
            <span className="font-bold">{episode.rumack_matthew_line_breached ? 'BREACHED (Treatment Indicated)' : 'Subtoxic'}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Liver Enzymes (ALT / AST):</span>
            <span className="font-bold">{episode.alt_u_l} / {episode.ast_u_l} U/L</span>
          </div>
          <div>
            <span className="text-gray-500 block">Coagulation (INR / Bilirubin):</span>
            <span className="font-bold">INR {episode.prothrombin_time_inr} • Bili {episode.total_bilirubin_mg_dl} mg/dL</span>
          </div>
        </div>
      </div>

      {/* Directives */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="border rounded p-3 space-y-2">
          <h3 className="font-bold uppercase tracking-wider border-b pb-1">Antidote Regimen Directives</h3>
          <ul className="space-y-1 list-disc list-inside">
            {evaluation.antidoteDosingDirectives.map((d, idx) => (
              <li key={idx}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="border rounded p-3 space-y-2">
          <h3 className="font-bold uppercase tracking-wider border-b pb-1">Decontamination & Surveillance</h3>
          <ul className="space-y-1 list-disc list-inside">
            {evaluation.decontaminationDirectives.concat(evaluation.organMonitoringDirectives).map((d, idx) => (
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
                <th className="py-1">HR/BP</th>
                <th className="py-1">ALT/AST</th>
                <th className="py-1">Level</th>
                <th className="py-1">Vin-Rosé</th>
                <th className="py-1">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {flowsheet.map((f) => (
                <tr key={f.id}>
                  <td className="py-1">{f.log_datetime.replace('T', ' ')}</td>
                  <td className="py-1">{f.hours_from_ingestion}h</td>
                  <td className="py-1">{f.heart_rate_bpm} / {f.systolic_bp_mmhg}</td>
                  <td className="py-1 font-bold">{f.alt_u_l}/{f.ast_u_l}</td>
                  <td className="py-1">{f.toxin_serum_level}</td>
                  <td className="py-1">{f.vin_rose_urine_observed ? 'YES' : '-'}</td>
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
          <p className="font-bold">Attending Pediatrician / Medical Toxicologist:</p>
          <div className="h-12 border-b border-gray-400 mt-2"></div>
          <p className="text-gray-500 mt-1">Signature & Medical Registration Number</p>
        </div>
        <div className="text-right">
          <p className="font-bold">PICU Nursing Verification:</p>
          <div className="h-12 border-b border-gray-400 mt-2"></div>
          <p className="text-gray-500 mt-1">Signature & Date/Time</p>
        </div>
      </div>
    </div>
  );
};
