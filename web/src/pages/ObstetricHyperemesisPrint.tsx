import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getObstetricHyperemesisEpisode,
  type ObstetricHyperemesisRecord,
  type ObstetricHyperemesisFlowsheetRecord,
} from '../api';
import { type ObstetricHyperemesisEvaluationResult } from '../obstetricHyperemesisEngine';

export const ObstetricHyperemesisPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: ObstetricHyperemesisRecord;
    evaluation: ObstetricHyperemesisEvaluationResult;
    flowsheet: ObstetricHyperemesisFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getObstetricHyperemesisEpisode(Number(id))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load hyperemesis dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating Hyperemesis Gravidarum Protocol Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Hyperemesis Gravidarum Record not found.</div>;
  }

  const { episode, evaluation, flowsheet } = data;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0 print:max-w-none text-xs leading-normal">
      {/* Print Trigger Button */}
      <div className="flex justify-end mb-6 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-800"
        >
          Print Dossier 🖨
        </button>
      </div>

      {/* Hospital Header */}
      <div className="border-b-2 border-indigo-900 pb-3 mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black text-indigo-950 uppercase tracking-wide">
            LiVi Maternity &amp; Obstetric Special Care Center
          </h1>
          <p className="text-xs text-slate-600 font-medium">
            Obstetric Hyperemesis Gravidarum (HG) &amp; PUQE-24 Protocol Dossier
          </p>
          <p className="text-[10px] text-slate-500">
            ACOG Practice Bulletin No. 189 / RCOG Guideline No. 69 • Mandatory Parenteral Thiamine • Tiered Antiemetics
          </p>
        </div>
        <div className="text-right font-mono text-[11px]">
          <div><span className="font-semibold">Episode:</span> {episode.episode_code}</div>
          <div><span className="font-semibold">Generated:</span> {new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Patient & Gestational Demographics */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Patient Name</span>
          <span className="font-bold text-slate-900 text-sm">{episode.patient_name || 'Obstetric Patient'}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Gestational Age</span>
          <span className="font-semibold text-slate-900">{episode.gestational_age_weeks} weeks</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold">PUQE-24 Score</span>
          <span className="font-bold text-indigo-700 text-sm">{evaluation.puqeScoreTotal} / 15 ({evaluation.puqeSeverityCategory})</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Current Care Stage</span>
          <span className="font-bold text-slate-900 capitalize">{episode.status.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Critical Directives & Alerts */}
      {evaluation.alerts.length > 0 && (
        <div className="border border-rose-400 bg-rose-50 rounded-lg p-3 mb-4">
          <div className="font-bold text-rose-800 text-[11px] uppercase tracking-wide mb-1">
            ⚠️ Critical Protocol Alerts &amp; Directives
          </div>
          <ul className="list-disc pl-4 text-rose-900 space-y-0.5">
            {evaluation.alerts.map((alert, i) => (
              <li key={i}>{alert}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Clinical Assessment Grid */}
      <div className="border border-slate-200 rounded-lg p-3 mb-4 space-y-3">
        <h2 className="font-bold text-slate-800 uppercase text-[11px] tracking-wide border-b pb-1">
          1. Hyperemesis Gravidarum Stratification &amp; Biochemistry
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <span className="text-slate-500 text-[10px] block">PUQE Severity</span>
            <span className="font-bold text-slate-800">{evaluation.puqeSeverityLabel}</span>
            <div className="text-[10px] text-slate-500">
              Nausea: {episode.puqe_nausea_hours}h | Vomits: {episode.puqe_vomiting_episodes} | Retch: {episode.puqe_retching_episodes}
            </div>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Weight Loss &amp; Starvation</span>
            <span className="font-bold text-slate-800">{episode.weight_loss_percent}% wt loss</span>
            <div className="text-[10px] text-slate-500 uppercase">Ketones: {episode.ketonuria_level.replace('_', ' ')}</div>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Electrolytes (K+ / Na+ / Cl-)</span>
            <span className="font-bold text-slate-800">
              K: {episode.serum_potassium_mmol_l} | Na: {episode.serum_sodium_mmol_l} | Cl: {episode.serum_chloride_mmol_l}
            </span>
            <div className="text-[10px] text-slate-500">HCO3-: {episode.bicarbonate_mmol_l} mmol/L</div>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Wernicke Protection</span>
            <span className="font-bold text-slate-800">
              {episode.parenteral_thiamine_given_before_dextrose === 1 ? '✅ Thiamine Pre-Dextrose' : '❌ Thiamine Due'}
            </span>
            <div className="text-[10px] text-slate-500">{evaluation.wernickeRiskLabel}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div>
            <span className="text-slate-500 text-[10px] block">Antiemetic Regimen Tier</span>
            <span className="font-bold text-slate-800 capitalize">
              {episode.current_antiemetic_tier.replace(/_/g, ' ')}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Thromboprophylaxis</span>
            <span className="font-bold text-slate-800">
              {episode.thromboprophylaxis_lmwh_prescribed === 1 ? '✅ LMWH Prescribed' : 'Not prescribed'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Wernicke Triad Symptoms</span>
            <span className="font-bold text-slate-800">
              {episode.wernicke_triad_symptoms_present === 1 ? '⚠️ Triad Symptoms Present' : 'None Reported'}
            </span>
          </div>
        </div>
      </div>

      {/* Protocol Directives */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="border border-slate-200 rounded-lg p-2.5">
          <div className="font-bold text-slate-800 text-[11px] uppercase mb-1">Thiamine &amp; Wernicke Protocol</div>
          <ul className="list-disc pl-3 text-[11px] text-slate-700 space-y-0.5">
            {evaluation.thiamineDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="border border-slate-200 rounded-lg p-2.5">
          <div className="font-bold text-slate-800 text-[11px] uppercase mb-1">Hydration &amp; Electrolytes</div>
          <ul className="list-disc pl-3 text-[11px] text-slate-700 space-y-0.5">
            {evaluation.hydrationDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="border border-slate-200 rounded-lg p-2.5">
          <div className="font-bold text-slate-800 text-[11px] uppercase mb-1">Antiemetics &amp; LMWH</div>
          <ul className="list-disc pl-3 text-[11px] text-slate-700 space-y-0.5">
            {evaluation.antiemeticEscalationDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
            {evaluation.thromboprophylaxisDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Serial Daily Flowsheet */}
      <div className="border border-slate-200 rounded-lg p-3 mb-6">
        <h2 className="font-bold text-slate-800 uppercase text-[11px] tracking-wide mb-2">
          2. Daily Clinical &amp; Intake Flowsheet Checkpoints
        </h2>
        {flowsheet.length === 0 ? (
          <div className="text-slate-400 italic">No flowsheet checkpoints recorded.</div>
        ) : (
          <table className="w-full text-left font-mono text-[10px]">
            <thead className="bg-slate-100 uppercase text-slate-600">
              <tr>
                <th className="p-1">Day / Date</th>
                <th className="p-1">PUQE Score</th>
                <th className="p-1">24h Vomits</th>
                <th className="p-1">Ketones</th>
                <th className="p-1">IV Balance</th>
                <th className="p-1">Oral Intake</th>
                <th className="p-1">Serum K+</th>
                <th className="p-1">Thiamine</th>
                <th className="p-1">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {flowsheet.map((f) => (
                <tr key={f.id}>
                  <td className="p-1 font-sans">Day {f.day_of_treatment} ({new Date(f.log_datetime).toLocaleDateString()})</td>
                  <td className="p-1 font-bold">{f.puqe_score_total} / 15</td>
                  <td className="p-1">{f.vomiting_episodes_24h}</td>
                  <td className="p-1 uppercase">{f.ketonuria_dipstick.replace('_', ' ')}</td>
                  <td className="p-1">{f.iv_fluid_balance_ml_24h} mL</td>
                  <td className="p-1">{f.oral_fluid_intake_ml} mL</td>
                  <td className="p-1">{f.potassium_mmol_l}</td>
                  <td className="p-1 font-sans">{f.thiamine_administered === 1 ? '✅ Given' : '❌ Missed'}</td>
                  <td className="p-1 font-sans truncate max-w-xs">{f.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Clinical Notes */}
      {episode.clinical_notes && (
        <div className="border border-slate-200 rounded-lg p-3 mb-6">
          <div className="font-bold text-slate-800 text-[11px] uppercase mb-1">Clinical Notes &amp; Nutritional Plan</div>
          <p className="text-slate-700 whitespace-pre-wrap">{episode.clinical_notes}</p>
        </div>
      )}

      {/* Physician Sign-Off */}
      <div className="border-t border-slate-300 pt-6 mt-8 grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <div className="h-10 border-b border-dashed border-slate-400"></div>
          <div className="mt-1 font-semibold text-slate-700">Attending Obstetrician / Gynecologist</div>
          <div className="text-slate-500">Date &amp; Time: ___________________________</div>
        </div>
        <div>
          <div className="h-10 border-b border-dashed border-slate-400"></div>
          <div className="mt-1 font-semibold text-slate-700">Clinical Nutritionist / Perinatal Pharmacist</div>
          <div className="text-slate-500">Date &amp; Time: ___________________________</div>
        </div>
      </div>
    </div>
  );
};
