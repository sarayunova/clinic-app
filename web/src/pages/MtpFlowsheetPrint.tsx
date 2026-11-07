import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import {
  getMtpDetails,
  auditMtpPrint,
  type MtpActivationRecord,
  type MtpRoundRecord,
} from '../api';

export function MtpFlowsheetPrint() {
  const { id } = useParams<{ id: string }>();
  const { clinic } = useClinic();
  const [data, setData] = useState<{
    mtp: MtpActivationRecord;
    rounds: MtpRoundRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const mtpId = Number(id);
    getMtpDetails(mtpId)
      .then((res) => {
        setData(res);
        setLoading(false);
        auditMtpPrint(mtpId).catch(() => {});
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (!clinic || loading || !data) {
    return <div className="p-8 text-center text-slate-500 text-sm">Generating MTP hemotherapy dossier...</div>;
  }

  const { mtp, rounds } = data;

  return (
    <Sheet
      clinic={clinic}
      title="MASSIVE TRANSFUSION PROTOCOL (MTP) & HEMOTHERAPY DOSSIER"
      back="/blood-bank"
      onPrint={() => window.print()}
    >
      <div className="space-y-6 text-xs text-slate-800">
        {/* Patient Demographics & Activation Banner */}
        <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Patient Name</span>
              <strong className="text-sm text-slate-900">{mtp.patient_name}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">UHID</span>
              <strong className="font-mono text-slate-900">{mtp.uhid}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Emergency Code</span>
              <strong className="font-mono text-rose-800">{mtp.mtp_code}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">MTP Status</span>
              <strong className={mtp.status === 'ACTIVE' ? 'text-red-700 font-black' : 'text-emerald-700'}>
                {mtp.status}
              </strong>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div>
              <span className="text-slate-500">Trigger Indication: </span>
              <strong>{mtp.trigger_reason.replace(/_/g, ' ')}</strong>
            </div>
            <div>
              <span className="text-slate-500">Activation Time: </span>
              <strong>{mtp.activation_time ? new Date(mtp.activation_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''}</strong>
            </div>
            <div>
              <span className="text-slate-500">Deactivation Time: </span>
              <strong>{mtp.deactivation_time ? new Date(mtp.deactivation_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Still Active'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Activated By: </span>
              <strong>{mtp.activator_name || mtp.activated_by_name}</strong>
            </div>
          </div>
        </div>

        {/* Cumulative Transfusion Tally */}
        <div>
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-300 pb-1 mb-2">
            Total Transfused Blood Components & Adjuncts
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 bg-white border border-slate-200 rounded-lg p-3 text-center">
            <div className="p-2 bg-rose-50 rounded border border-rose-100">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">PRBC Transfused</span>
              <strong className="text-base text-rose-800">{mtp.total_prbc_transfused} Units</strong>
            </div>
            <div className="p-2 bg-amber-50 rounded border border-amber-100">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">FFP Transfused</span>
              <strong className="text-base text-amber-800">{mtp.total_ffp_transfused} Units</strong>
            </div>
            <div className="p-2 bg-blue-50 rounded border border-blue-100">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Platelets Transfused</span>
              <strong className="text-base text-blue-800">{mtp.total_platelets_transfused} Doses</strong>
            </div>
            <div className="p-2 bg-purple-50 rounded border border-purple-100">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Cryoprecipitate</span>
              <strong className="text-base text-purple-800">{mtp.total_cryo_transfused} Units</strong>
            </div>
            <div className="p-2 bg-emerald-50 rounded border border-emerald-100">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">PRBC : FFP Ratio</span>
              <strong className="text-base text-emerald-800">
                {mtp.total_ffp_transfused ? `1 : ${(mtp.total_ffp_transfused / (mtp.total_prbc_transfused || 1)).toFixed(1)}` : '1 : 1'}
              </strong>
            </div>
          </div>

          <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-500 font-bold">Tranexamic Acid (TXA 1g IV): </span>
              <strong>{mtp.txa_given ? 'Administered ✓' : 'Not Recorded'}</strong>
            </div>
            <div>
              <span className="text-slate-500 font-bold">10% Calcium Gluconate (Citrate Antidote): </span>
              <strong>{mtp.calcium_gluconate_given ? 'Administered ✓' : 'Given as indicated'}</strong>
            </div>
          </div>
        </div>

        {/* Serial Resuscitation Rounds Log */}
        <div>
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-300 pb-1 mb-2">
            Resuscitation Rounds Timeline & Serial Parameters Log
          </h3>

          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="bg-slate-100 text-[10px] uppercase font-bold text-slate-700 border-b border-slate-300">
                  <th className="py-2 px-3">Round</th>
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3">PRBC : FFP : Plt : Cryo</th>
                  <th className="py-2 px-3">Vitals (BP, HR, Temp)</th>
                  <th className="py-2 px-3">POC Labs (Hb, Plt, Fib, INR)</th>
                  <th className="py-2 px-3">ABG / Lactate</th>
                  <th className="py-2 px-3">Notes & Attending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rounds.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 px-3 font-bold text-rose-800">Pack {r.round_number}</td>
                    <td className="py-2 px-3 text-slate-700">{r.round_start_time}</td>
                    <td className="py-2 px-3 font-semibold">
                      {r.prbc_transfused} PRBC : {r.ffp_transfused} FFP : {r.platelets_transfused} Plt : {r.cryo_transfused} Cryo
                    </td>
                    <td className="py-2 px-3">
                      {r.blood_pressure_sys ? `${r.blood_pressure_sys}/${r.blood_pressure_dia} mmHg` : ''}
                      {r.heart_rate ? ` • ${r.heart_rate} bpm` : ''}
                      {r.temp_celsius ? ` • ${r.temp_celsius}°C` : ''}
                    </td>
                    <td className="py-2 px-3">
                      {r.hb_g_dl ? `Hb ${r.hb_g_dl}g` : ''}
                      {r.platelets_k_ul ? ` • Plt ${r.platelets_k_ul}k` : ''}
                      {r.fibrinogen_mg_dl ? ` • Fib ${r.fibrinogen_mg_dl}mg` : ''}
                      {r.inr ? ` • INR ${r.inr}` : ''}
                    </td>
                    <td className="py-2 px-3">
                      {r.ph_abg ? `pH ${r.ph_abg}` : ''}
                      {r.lactate_mmol_l ? ` • Lac ${r.lactate_mmol_l}` : ''}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      <div>{r.clinical_notes || 'Round completed'}</div>
                      <div className="text-[10px] text-slate-400">By {r.recorded_by_name}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deactivation & Clinical Outcome Summary */}
        <div>
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-300 pb-1 mb-2">
            MTP Deactivation & Clinical Disposition
          </h3>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-[11px]">
            <div>
              <span className="text-slate-500 font-bold">Clinical Outcome Summary: </span>
              <strong className="text-slate-900">{mtp.outcome_summary || 'Resuscitation in progress.'}</strong>
            </div>
            {mtp.deactivated_by_name && (
              <div className="text-slate-500">
                Protocol Deactivated By: <strong>{mtp.deactivated_by_name}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Dual Signature Blocks */}
        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300">
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500 mb-6">
              Consultant Anesthesiologist / Transfusion Officer
            </div>
            <SignatureBlock
              clinic={clinic}
              signatoryName="Consultant Anesthesiology & Critical Care"
              designation="Attending Anesthesiologist"
            />
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500 mb-6">
              Lead Resuscitating Obstetrician / Surgeon
            </div>
            <SignatureBlock
              clinic={clinic}
              signatoryName={mtp.activator_name || mtp.activated_by_name || clinic.doctorName}
              designation="Consultant Obstetrician & Gynecologist"
            />
          </div>
        </div>
      </div>
    </Sheet>
  );
}
