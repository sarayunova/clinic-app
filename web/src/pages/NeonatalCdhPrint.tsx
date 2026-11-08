import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getNeonatalCdhEpisode,
  type NeonatalCdhRecord,
  type NeonatalCdhFlowsheetRecord,
} from '../api';
import { type NeonatalCdhEvaluationResult } from '../neonatalCdhEngine';

export const NeonatalCdhPrint: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    episode: NeonatalCdhRecord;
    evaluation: NeonatalCdhEvaluationResult;
    flowsheet: NeonatalCdhFlowsheetRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getNeonatalCdhEpisode(Number(id))
      .then((res) => {
        setData({
          episode: res.episode,
          evaluation: res.evaluation,
          flowsheet: res.flowsheetLogs || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load neonatal CDH dossier:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Generating Neonatal CDH Protocol Dossier...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Neonatal CDH Record not found.</div>;
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
            LiVi Neonatal Intensive Care &amp; Pediatric Surgery Center
          </h1>
          <p className="text-xs text-slate-600 font-medium">
            Congenital Diaphragmatic Hernia (CDH) &amp; Gentle Ventilation Clinical Dossier
          </p>
          <p className="text-[10px] text-slate-500">
            AAP / EURO-CDH Consensus • Delivery Room Intubation • Lung-Protective Ventilation • PPHN Protocol
          </p>
        </div>
        <div className="text-right font-mono text-[11px]">
          <div><span className="font-semibold">Episode:</span> {episode.episode_code}</div>
          <div><span className="font-semibold">Generated:</span> {new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Patient & Resuscitation Demographics */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Patient Name</span>
          <span className="font-bold text-slate-900 text-sm">{episode.patient_name || 'Neonatal Patient'}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Postnatal Age / Weight</span>
          <span className="font-semibold text-slate-900">
            {episode.age_hours} hrs / {episode.weight_kg} kg
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Hernia Defect Side</span>
          <span className="font-bold text-slate-900 capitalize">{episode.defect_side.replace('_', ' ')}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Protocol Status</span>
          <span className="font-bold text-indigo-700 capitalize">{episode.status.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Critical Directives & Alerts */}
      {evaluation.alerts.length > 0 && (
        <div className="border border-rose-400 bg-rose-50 rounded-lg p-3 mb-4">
          <div className="font-bold text-rose-800 text-[11px] uppercase tracking-wide mb-1">
            ⚠️ Critical Protocol Directives &amp; Alerts
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
          1. CDH Phenotype &amp; Ventilatory Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <span className="text-slate-500 text-[10px] block">o/e LHR Severity</span>
            <span className="font-bold text-slate-800">{episode.observed_expected_lhr_percent}%</span>
            <div className="text-[10px] text-slate-500">{evaluation.hypoplasiaSeverityLabel}</div>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Intrathoracic Liver</span>
            <span className="font-bold text-slate-800">
              {episode.liver_herniation_up === 1 ? 'Liver-Up (Gore-Tex Likely)' : 'Liver-Down'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Pre / Post-Ductal SpO2</span>
            <span className="font-bold text-slate-800">
              {episode.preductal_spo2_percent}% / {episode.postductal_spo2_percent}%
            </span>
            <div className="text-[10px] text-slate-500">Gradient: {evaluation.ductalGradientPercent}% Δ</div>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Gentle Ventilation</span>
            <span className="font-bold text-slate-800">
              PIP {episode.peak_inspiratory_pressure_cmh2o} / PEEP {episode.peep_cmh2o} cmH2O
            </span>
            <div className="text-[10px] text-slate-500">PaCO2: {episode.paco2_mmhg} mmHg</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <span className="text-slate-500 text-[10px] block">Bag-Mask Avoided</span>
            <span className="font-bold text-slate-800">
              {episode.bag_mask_avoided_in_delivery_room === 1 ? '✅ Strictly Avoided' : '❌ Bagged'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Replogle Continuous Sump</span>
            <span className="font-bold text-slate-800">
              {episode.replogle_sump_decompression_active === 1 ? '✅ 10 Fr Low Suction Active' : '❌ Inactive'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Inhaled Nitric Oxide</span>
            <span className="font-bold text-slate-800">
              {episode.inhaled_nitric_oxide_active === 1 ? '✅ Active (10–20 ppm)' : 'Not running'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Surgical Repair Stage</span>
            <span className="font-bold text-indigo-700 capitalize">
              {episode.surgical_repair_status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Protocol Directives */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="border border-slate-200 rounded-lg p-2.5">
          <div className="font-bold text-slate-800 text-[11px] uppercase mb-1">Delivery Room Management</div>
          <ul className="list-disc pl-3 text-[11px] text-slate-700 space-y-0.5">
            {evaluation.deliveryRoomDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="border border-slate-200 rounded-lg p-2.5">
          <div className="font-bold text-slate-800 text-[11px] uppercase mb-1">Gentle Ventilation Directives</div>
          <ul className="list-disc pl-3 text-[11px] text-slate-700 space-y-0.5">
            {evaluation.gentleVentilationDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="border border-slate-200 rounded-lg p-2.5">
          <div className="font-bold text-slate-800 text-[11px] uppercase mb-1">PPHN &amp; Surgical Readiness</div>
          <ul className="list-disc pl-3 text-[11px] text-slate-700 space-y-0.5">
            {evaluation.pulmonaryHypertensionDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
            {evaluation.surgicalRepairDirectives.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Serial Ventilatory Flowsheet */}
      <div className="border border-slate-200 rounded-lg p-3 mb-6">
        <h2 className="font-bold text-slate-800 uppercase text-[11px] tracking-wide mb-2">
          2. Serial Ventilatory &amp; Hemodynamic Flowsheet Logs
        </h2>
        {flowsheet.length === 0 ? (
          <div className="text-slate-400 italic">No flowsheet entries recorded.</div>
        ) : (
          <table className="w-full text-left font-mono text-[10px]">
            <thead className="bg-slate-100 uppercase text-slate-600">
              <tr>
                <th className="p-1">Hours / Time</th>
                <th className="p-1">Pre/Post SpO2</th>
                <th className="p-1">Δ Gradient</th>
                <th className="p-1">PIP / PEEP</th>
                <th className="p-1">FiO2 %</th>
                <th className="p-1">MAP mmHg</th>
                <th className="p-1">PaCO2 / pH</th>
                <th className="p-1">iNO</th>
                <th className="p-1">Lactate</th>
                <th className="p-1">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {flowsheet.map((f) => (
                <tr key={f.id}>
                  <td className="p-1 font-sans">+{f.hours_from_admission}h ({new Date(f.log_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</td>
                  <td className="p-1">{f.preductal_spo2}% / {f.postductal_spo2}%</td>
                  <td className="p-1 font-bold">{Math.max(0, f.preductal_spo2 - f.postductal_spo2)}%</td>
                  <td className="p-1">{f.pip_cmh2o} / {f.peep_cmh2o}</td>
                  <td className="p-1">{f.fio2_percent}%</td>
                  <td className="p-1">{f.mean_arterial_pressure_mmhg ?? '—'}</td>
                  <td className="p-1">{f.paco2_mmhg} / {f.arterial_ph ?? '—'}</td>
                  <td className="p-1">{f.ino_ppm ? `${f.ino_ppm} ppm` : '0'}</td>
                  <td className="p-1">{f.lactate_mmol_l ? `${f.lactate_mmol_l}` : '—'}</td>
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
          <div className="font-bold text-slate-800 text-[11px] uppercase mb-1">Clinical Notes &amp; Plan</div>
          <p className="text-slate-700 whitespace-pre-wrap">{episode.clinical_notes}</p>
        </div>
      )}

      {/* Physician Sign-Off */}
      <div className="border-t border-slate-300 pt-6 mt-8 grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <div className="h-10 border-b border-dashed border-slate-400"></div>
          <div className="mt-1 font-semibold text-slate-700">Attending Neonatologist / NICU Fellow</div>
          <div className="text-slate-500">Date &amp; Time: ___________________________</div>
        </div>
        <div>
          <div className="h-10 border-b border-dashed border-slate-400"></div>
          <div className="mt-1 font-semibold text-slate-700">Pediatric Surgeon / Fellow</div>
          <div className="text-slate-500">Date &amp; Time: ___________________________</div>
        </div>
      </div>
    </div>
  );
};
