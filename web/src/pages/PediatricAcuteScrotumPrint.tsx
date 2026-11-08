import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPediatricAcuteScrotumEpisode,
  type PediatricAcuteScrotumRecord,
  type PediatricAcuteScrotumFlowsheetRecord,
} from '../api';
import { type PediatricAcuteScrotumEvaluationResult } from '../pediatricAcuteScrotumEngine';

export const PediatricAcuteScrotumPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: PediatricAcuteScrotumRecord;
    evaluation: PediatricAcuteScrotumEvaluationResult;
    flowsheet: PediatricAcuteScrotumFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getPediatricAcuteScrotumEpisode(Number(id))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load acute scrotum dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating Pediatric Acute Scrotum Protocol Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Pediatric Acute Scrotum Record not found.</div>;
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
            LiVi Pediatric Surgery &amp; Urological Emergency Center
          </h1>
          <p className="text-xs text-slate-600 font-medium">
            Pediatric Acute Scrotum &amp; TWIST Score Protocol Dossier
          </p>
          <p className="text-[10px] text-slate-500">
            AUA / ESPU Guidelines • TWIST Scoring (0–7) • 6-Hour Golden Salvage Window • Bilateral Dartos Orchiopexy
          </p>
        </div>
        <div className="text-right font-mono text-[11px]">
          <div><span className="font-semibold">Episode:</span> {episode.episode_code}</div>
          <div><span className="font-semibold">Generated:</span> {new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Patient & Triage Demographics */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Patient Name</span>
          <span className="font-bold text-slate-900 text-sm">{episode.patient_name || 'Pediatric Patient'}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Age / Affected Side</span>
          <span className="font-semibold text-slate-900 capitalize">
            {episode.age_years} yrs / {episode.affected_side} testis
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold">TWIST Score &amp; Risk</span>
          <span className="font-bold text-indigo-700 text-sm">
            {evaluation.twistScoreTotal} / 7 ({evaluation.twistRiskCategory.replace('_', ' ')})
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Triage Status</span>
          <span className="font-bold text-slate-900 capitalize">{episode.status.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Critical Directives & Alerts */}
      {evaluation.alerts.length > 0 && (
        <div className="border border-rose-400 bg-rose-50 rounded-lg p-3 mb-4">
          <div className="font-bold text-rose-800 text-[11px] uppercase tracking-wide mb-1">
            ⚠️ Critical Emergency Scrotum Alerts &amp; Directives
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
          1. TWIST Criteria &amp; Diagnostic Findings
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <span className="text-slate-500 text-[10px] block">Testicular Swelling (+2)</span>
            <span className="font-bold text-slate-800">
              {episode.twist_testis_swelling === 2 ? '✅ Present (+2 pts)' : '❌ Absent (0 pts)'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Hard Testis (+2)</span>
            <span className="font-bold text-slate-800">
              {episode.twist_hard_testis === 2 ? '✅ Present (+2 pts)' : '❌ Absent (0 pts)'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Absent Cremasteric (+1)</span>
            <span className="font-bold text-slate-800">
              {episode.twist_absent_cremasteric_reflex === 1 ? '✅ Absent Reflex (+1 pt)' : '❌ Normal (0 pts)'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Nausea / High Riding (+1 each)</span>
            <span className="font-bold text-slate-800">
              N/V: {episode.twist_nausea_vomiting ? '+1' : '0'} | High-Ride: {episode.twist_high_riding_testis ? '+1' : '0'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <span className="text-slate-500 text-[10px] block">Symptom Duration</span>
            <span className="font-bold text-slate-800">{episode.symptom_duration_hours} hours</span>
            <div className="text-[10px] text-slate-500">{evaluation.salvageProbabilityEstimate}</div>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Doppler Ultrasound</span>
            <span className="font-bold text-slate-800 capitalize">
              {episode.doppler_findings.replace(/_/g, ' ')}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Intraoperative Findings</span>
            <span className="font-bold text-slate-800 capitalize">
              {episode.intraoperative_findings.replace(/_/g, ' ')}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Bilateral Dartos Orchiopexy</span>
            <span className="font-bold text-indigo-700">
              {episode.bilateral_orchiopexy_performed === 1 ? '✅ Performed (Dartos Pouch)' : '❌ Incomplete'}
            </span>
          </div>
        </div>
      </div>

      {/* Protocol Directives */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="border border-slate-200 rounded-lg p-2.5">
          <div className="font-bold text-slate-800 text-[11px] uppercase mb-1">Pre-op &amp; Triage Directives</div>
          <ul className="list-disc pl-3 text-[11px] text-slate-700 space-y-0.5">
            {evaluation.preoperativeDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="border border-slate-200 rounded-lg p-2.5">
          <div className="font-bold text-slate-800 text-[11px] uppercase mb-1">Surgical Exploration Directives</div>
          <ul className="list-disc pl-3 text-[11px] text-slate-700 space-y-0.5">
            {evaluation.surgicalExplorationDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="border border-slate-200 rounded-lg p-2.5">
          <div className="font-bold text-slate-800 text-[11px] uppercase mb-1">Post-op Recovery Directives</div>
          <ul className="list-disc pl-3 text-[11px] text-slate-700 space-y-0.5">
            {evaluation.postoperativeDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Serial Recovery Flowsheet */}
      <div className="border border-slate-200 rounded-lg p-3 mb-6">
        <h2 className="font-bold text-slate-800 uppercase text-[11px] tracking-wide mb-2">
          2. Post-Torsion Scrotal Recovery &amp; Pain Flowsheet Checkpoints
        </h2>
        {flowsheet.length === 0 ? (
          <div className="text-slate-400 italic">No recovery flowsheet checkpoints recorded.</div>
        ) : (
          <table className="w-full text-left font-mono text-[10px]">
            <thead className="bg-slate-100 uppercase text-slate-600">
              <tr>
                <th className="p-1">Time / Post-Op</th>
                <th className="p-1">Pain (0–10)</th>
                <th className="p-1">Scrotal Edema</th>
                <th className="p-1">Cremasteric</th>
                <th className="p-1">Dressing</th>
                <th className="p-1">Ambulation</th>
                <th className="p-1">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {flowsheet.map((f) => (
                <tr key={f.id}>
                  <td className="p-1 font-sans">+{f.hours_from_presentation}h ({new Date(f.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</td>
                  <td className="p-1 font-bold">{f.pain_score_flacc_or_vas} / 10</td>
                  <td className="p-1 uppercase">{f.scrotal_edema_erythema.replace('_', ' ')}</td>
                  <td className="p-1 uppercase">{f.cremasteric_reflex_status.replace('_', ' ')}</td>
                  <td className="p-1 font-sans">{f.wound_dressing_clean === 1 ? '✅ Clean' : '⚠️ Checked'}</td>
                  <td className="p-1 font-sans truncate max-w-xs">{f.ambulation_status.replace(/_/g, ' ')}</td>
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
          <div className="font-bold text-slate-800 text-[11px] uppercase mb-1">Operative Details &amp; Plan</div>
          <p className="text-slate-700 whitespace-pre-wrap">{episode.clinical_notes}</p>
        </div>
      )}

      {/* Physician Sign-Off */}
      <div className="border-t border-slate-300 pt-6 mt-8 grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <div className="h-10 border-b border-dashed border-slate-400"></div>
          <div className="mt-1 font-semibold text-slate-700">Attending Pediatric Urologist / Surgeon</div>
          <div className="text-slate-500">Date &amp; Time: ___________________________</div>
        </div>
        <div>
          <div className="h-10 border-b border-dashed border-slate-400"></div>
          <div className="mt-1 font-semibold text-slate-700">Pediatric Emergency Attending / Fellow</div>
          <div className="text-slate-500">Date &amp; Time: ___________________________</div>
        </div>
      </div>
    </div>
  );
};
