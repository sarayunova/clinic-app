import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPediatricRefractoryAsthmaEpisode,
  type PediatricRefractoryAsthmaRecord,
  type PediatricRefractoryAsthmaFlowsheetRecord,
} from '../api';
import { evaluatePediatricRefractoryAsthma } from '../pediatricRefractoryAsthmaEngine';

export const PediatricRefractoryAsthmaPrint: React.FC = () => {
  const { id, episodeId } = useParams<{ id?: string; episodeId?: string }>();
  const targetId = id || episodeId;

  const [episode, setEpisode] = useState<PediatricRefractoryAsthmaRecord | null>(null);
  const [flowsheet, setFlowsheet] = useState<PediatricRefractoryAsthmaFlowsheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await getPediatricRefractoryAsthmaEpisode(Number(targetId));
        setEpisode(res.episode);
        setFlowsheet(res.flowsheet || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load pediatric refractory status asthmaticus dossier');
      } finally {
        setLoading(false);
      }
    })();
  }, [targetId]);

  if (loading) return <div className="p-8 text-center text-sm">Loading resuscitation dossier...</div>;
  if (error || !episode) return <div className="p-8 text-center text-red-600 text-sm">{error || 'Episode not found'}</div>;

  const evaluation = evaluatePediatricRefractoryAsthma({
    ageYears: episode.age_years,
    weightKg: episode.weight_kg,
    initialPediatricAsthmaScore: episode.initial_pediatric_asthma_score,
    respiratoryRate: episode.respiratory_rate,
    heartRateBpm: episode.heart_rate_bpm,
    spo2Percent: episode.spo2_percent,
    pco2Mmhg: episode.pco2_mmhg,
    phValue: episode.ph_value,
    silentChestOrExhaustion: Boolean(episode.silent_chest_or_exhaustion),
    refractoryToFirstLine: Boolean(episode.refractory_to_first_line),
    continuousIvTerbutalineActive: Boolean(episode.continuous_iv_terbutaline_active),
    terbutalineDoseMcgKgMin: episode.terbutaline_dose_mcg_kg_min,
    ivKetamineInfusionActive: Boolean(episode.iv_ketamine_infusion_active),
    ketamineDoseMgKgHr: episode.ketamine_dose_mg_kg_hr,
    helioxInhalationActive: Boolean(episode.heliox_inhalation_active),
    helioxMixtureRatio: episode.heliox_mixture_ratio as any,
    ivTheophyllineAminophyllineActive: Boolean(episode.iv_theophylline_aminophylline_active),
    ventilatorySupportMode: episode.ventilatory_support_mode as any,
    status: episode.status as any,
  });

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 text-black bg-white print:p-0">
      <div className="border-b-2 border-black pb-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider">
            Pediatric Refractory Status Asthmaticus (PICU Rescue) Dossier
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            BTS / SIGN Guideline 158 • PALS Refractory Bronchospasm • IV Terbutaline & Ketamine Infusion Protocol
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

      {/* Patient & Physiological Demographics Banner */}
      <div className="grid grid-cols-2 gap-4 border border-black p-4 text-xs">
        <div>
          <div><strong>Patient Name:</strong> {episode.patient_name || `Patient #${episode.patient_id}`}</div>
          <div><strong>Age & Weight:</strong> {episode.age_years} yrs • {episode.weight_kg} kg</div>
          <div><strong>Attending Consultant:</strong> {episode.consultant_name || 'Dr. Demo Sharma'}</div>
        </div>
        <div>
          <div><strong>Pediatric Asthma Score:</strong> {episode.initial_pediatric_asthma_score} / 12</div>
          <div><strong>Ventilation Mode:</strong> {episode.ventilatory_support_mode.replace(/_/g, ' ')}</div>
          <div><strong>Clinical Status:</strong> {episode.status.replace(/_/g, ' ')}</div>
        </div>
      </div>

      {/* Blood Gas & Airway Danger Indicators */}
      <div className="border border-black p-4 space-y-2 text-xs">
        <div className="font-bold border-b border-gray-300 pb-1 uppercase">
          Blood Gas & Physiological Exhaustion Markers
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <strong>pCO₂ Level:</strong> {episode.pco2_mmhg} mmHg {episode.pco2_mmhg >= 42 ? '⚠️ (Hypercapnic Exhaustion)' : ''}
          </div>
          <div>
            <strong>Arterial/Capillary pH:</strong> {episode.ph_value} {episode.ph_value <= 7.28 ? '⚠️ (Acidosis)' : ''}
          </div>
          <div>
            <strong>Silent Chest / Exhaustion:</strong> {episode.silent_chest_or_exhaustion ? 'PRESENT (Extremis)' : 'Absent'}
          </div>
          <div>
            <strong>Respiratory Rate:</strong> {episode.respiratory_rate} bpm
          </div>
          <div>
            <strong>Heart Rate:</strong> {episode.heart_rate_bpm} bpm
          </div>
          <div>
            <strong>SpO₂ Level:</strong> {episode.spo2_percent}%
          </div>
        </div>
      </div>

      {/* PICU Resuscitation Directives */}
      <div className="border border-black p-4 space-y-3 text-xs">
        <div className="font-bold border-b border-gray-300 pb-1 uppercase">
          PICU Pharmacotherapy & Ventilatory Strategy Directives
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div><strong>Severity Assessment:</strong> {evaluation.severityCategory.replace(/_/g, ' ').toUpperCase()}</div>
            <div className="mt-1">
              <strong>Continuous IV Terbutaline:</strong>{' '}
              {episode.continuous_iv_terbutaline_active ? `Active (${episode.terbutaline_dose_mcg_kg_min} µg/kg/min)` : 'Not Infusing'}
            </div>
            <div className="text-gray-600">
              Guideline Dosing: {evaluation.terbutalineDosingDirectives.initialBolusMcgKg} µg/kg load → {evaluation.terbutalineDosingDirectives.maintenanceMcgKgMin} µg/kg/min (Max: {evaluation.terbutalineDosingDirectives.maxRateMcgKgMin} µg/kg/min)
            </div>

            <div className="mt-2">
              <strong>IV Ketamine Bronchodilator:</strong>{' '}
              {episode.iv_ketamine_infusion_active ? `Active (${episode.ketamine_dose_mg_kg_hr} mg/kg/hr)` : 'Not Infusing'}
            </div>
            <div className="text-gray-600">
              Guideline Dosing: {evaluation.ketamineDosingDirectives.bolusDoseMgKg} mg/kg load → {evaluation.ketamineDosingDirectives.infusionRateMgKgHr} mg/kg/hr (Max: {evaluation.ketamineDosingDirectives.maxRateMgKgHr} mg/kg/hr)
            </div>
          </div>

          <div>
            <div><strong>Heliox Inhalation:</strong> {episode.heliox_inhalation_active ? episode.heliox_mixture_ratio.replace(/_/g, ' ') : 'None'}</div>
            <div className="mt-1"><strong>Ventilator Tidal Volume:</strong> {evaluation.ventilatoryStrategyDirectives.targetTidalVolumeMlKg}</div>
            <div><strong>Target I:E Ratio:</strong> {evaluation.ventilatoryStrategyDirectives.targetIeRatio}</div>
            <div><strong>Permissive Hypercapnia Target:</strong> {evaluation.ventilatoryStrategyDirectives.permissiveHypercapniaTarget}</div>
          </div>
        </div>

        {evaluation.resuscitationActionChecklist && evaluation.resuscitationActionChecklist.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <strong>Resuscitation Priorities:</strong>
            <ul className="list-disc pl-4 mt-1 space-y-0.5">
              {evaluation.resuscitationActionChecklist.map((act, i) => (
                <li key={i}>{act}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Serial Blood Gas & Flowsheet Checkpoints */}
      <div className="border border-black p-4 space-y-2 text-xs">
        <div className="font-bold border-b border-gray-300 pb-1 uppercase">
          Serial Blood Gas & Bronchodilator Flowsheet Log ({flowsheet.length} Checkpoints)
        </div>
        {flowsheet.length === 0 ? (
          <div className="text-gray-500 py-2">No serial flowsheet checkpoints recorded.</div>
        ) : (
          <table className="w-full text-left border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-1">Time</th>
                <th className="border border-gray-300 p-1">PICU Hrs</th>
                <th className="border border-gray-300 p-1">RR / HR</th>
                <th className="border border-gray-300 p-1">SpO₂</th>
                <th className="border border-gray-300 p-1">pCO₂ (mmHg)</th>
                <th className="border border-gray-300 p-1">pH</th>
                <th className="border border-gray-300 p-1">Terbutaline</th>
                <th className="border border-gray-300 p-1">Ketamine</th>
                <th className="border border-gray-300 p-1">Auscultation</th>
                <th className="border border-gray-300 p-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {flowsheet.map((l) => (
                <tr key={l.id}>
                  <td className="border border-gray-300 p-1">{new Date(l.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="border border-gray-300 p-1">+{l.hours_from_picu_admission}h</td>
                  <td className="border border-gray-300 p-1">{l.respiratory_rate} / {l.heart_rate_bpm}</td>
                  <td className="border border-gray-300 p-1">{l.spo2_percent}%</td>
                  <td className="border border-gray-300 p-1 font-bold">{l.pco2_mmhg}</td>
                  <td className="border border-gray-300 p-1 font-bold">{l.ph_value}</td>
                  <td className="border border-gray-300 p-1">{l.terbutaline_infusion_rate > 0 ? `${l.terbutaline_infusion_rate} µg` : '—'}</td>
                  <td className="border border-gray-300 p-1">{l.ketamine_infusion_rate > 0 ? `${l.ketamine_infusion_rate} mg` : '—'}</td>
                  <td className="border border-gray-300 p-1">{l.air_entry_auscultation.replace(/_/g, ' ')}</td>
                  <td className="border border-gray-300 p-1">{l.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Clinician Sign-Off Block */}
      <div className="grid grid-cols-2 gap-8 pt-8 text-xs">
        <div className="border-t border-black pt-2">
          <div><strong>Attending Pediatric Intensivist / Resuscitator Signature:</strong></div>
          <div className="h-8"></div>
          <div>Date & Time: __________________________________</div>
        </div>
        <div className="border-t border-black pt-2">
          <div><strong>PICU Nursing Lead Verification:</strong></div>
          <div className="h-8"></div>
          <div>Date & Time: __________________________________</div>
        </div>
      </div>
    </div>
  );
};
