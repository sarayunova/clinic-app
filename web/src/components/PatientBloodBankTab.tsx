import React, { useEffect, useState } from 'react';
import {
  getPatientBloodBankHistory,
  activateMtp,
  type BloodRequisitionRecord,
  type MtpActivationRecord,
  type TransfusionRecord,
  type MtpTriggerReason,
} from '../api';
import { BloodRequisitionModal } from './BloodRequisitionModal';
import { TransfusionLogModal } from './TransfusionLogModal';
import { MtpFlowsheetDrawer } from './MtpFlowsheetDrawer';
import { useAuth } from '../auth';

interface PatientBloodBankTabProps {
  patientId: number;
  patientName: string;
  uhid: string;
}

export function PatientBloodBankTab({
  patientId,
  patientName,
  uhid,
}: PatientBloodBankTabProps) {
  const { can } = useAuth();
  const canWrite = can('patient:write_clinical') || can('care:write_nursing');

  const [loading, setLoading] = useState(true);
  const [requisitions, setRequisitions] = useState<BloodRequisitionRecord[]>([]);
  const [mtpActivations, setMtpActivations] = useState<MtpActivationRecord[]>([]);
  const [transfusions, setTransfusions] = useState<TransfusionRecord[]>([]);

  // Modals
  const [showReqModal, setShowReqModal] = useState(false);
  const [showTransModal, setShowTransModal] = useState(false);
  const [activeMtpId, setActiveMtpId] = useState<number | null>(null);

  // MTP Trigger Modal
  const [showMtpTriggerModal, setShowMtpTriggerModal] = useState(false);
  const [triggerReason, setTriggerReason] = useState<MtpTriggerReason>('PPH_ATONY');
  const [shockIndex, setShockIndex] = useState<number | ''>(1.25);
  const [bloodLossMl, setBloodLossMl] = useState(1500);
  const [activatingMtp, setActivatingMtp] = useState(false);

  const loadData = () => {
    setLoading(true);
    getPatientBloodBankHistory(patientId)
      .then((res) => {
        setRequisitions(res.requisitions);
        setMtpActivations(res.mtpActivations);
        setTransfusions(res.transfusions);
        setLoading(false);
      })
      .catch((err) => {
        alert('Failed to load blood bank history: ' + err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  const activeMtp = mtpActivations.find((m) => m.status === 'ACTIVE');

  const handleTriggerMtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActivatingMtp(true);
      const res = await activateMtp({
        patientId,
        triggerReason,
        baselineShockIndex: shockIndex !== '' ? Number(shockIndex) : null,
        baselineEstimatedBloodLossMl: Number(bloodLossMl),
      });

      alert(`Massive Transfusion Protocol activated! Emergency Code: ${res.mtp_code}`);
      setShowMtpTriggerModal(false);
      loadData();
      setActiveMtpId(res.id);
    } catch (err: any) {
      alert('Failed to activate MTP: ' + err.message);
    } finally {
      setActivatingMtp(false);
    }
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>🩸</span> Blood Bank Requisitions, Transfusion Safety & MTP Flowsheet
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Component ordering, 2-nurse bedside verification, and Massive Transfusion Protocol balanced resuscitation management.
          </p>
        </div>

        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowReqModal(true)}
              className="px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span>+ Request Blood Products</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTransModal(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span>🩺 Log Unit Administration</span>
            </button>

            {!activeMtp && (
              <button
                type="button"
                onClick={() => setShowMtpTriggerModal(true)}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-extrabold shadow-sm transition-colors flex items-center gap-1.5 animate-pulse"
              >
                <span>🚨 ACTIVATE MTP</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Active MTP Pulse Alert Banner */}
      {activeMtp && (
        <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white p-4 rounded-xl shadow-lg flex justify-between items-center animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <div className="font-extrabold text-sm uppercase tracking-wide">
                MASSIVE TRANSFUSION PROTOCOL ACTIVE (Code: {activeMtp.mtp_code})
              </div>
              <div className="text-xs text-rose-100">
                Trigger: <strong>{activeMtp.trigger_reason.replace(/_/g, ' ')}</strong> • Round: <strong>Pack {activeMtp.current_pack_round}</strong> • Transfused: <strong>{activeMtp.total_prbc_transfused} PRBC : {activeMtp.total_ffp_transfused} FFP</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveMtpId(activeMtp.id)}
            className="px-4 py-2 bg-white text-rose-800 font-black rounded-lg shadow hover:bg-rose-50 transition-colors uppercase text-xs"
          >
            Open Live MTP Flowsheet &rarr;
          </button>
        </div>
      )}

      {/* Requisitions List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-xs uppercase text-slate-700 flex justify-between items-center">
          <span>Blood Component Requisitions</span>
          <span className="text-[10px] text-slate-400 font-normal">Cross-match orders sent to Blood Bank</span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading requisitions...</div>
        ) : requisitions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 italic">No blood requisitions requested for this patient.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-3">Req Number</th>
                  <th className="py-2.5 px-3">Blood Group</th>
                  <th className="py-2.5 px-3">Components Requested</th>
                  <th className="py-2.5 px-3">Indication & Urgency</th>
                  <th className="py-2.5 px-3">Requested By</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requisitions.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono font-bold text-rose-800">{r.requisition_number}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">{r.blood_group_abo.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700">
                      {[
                        r.prbc_units > 0 ? `${r.prbc_units} PRBC` : null,
                        r.ffp_units > 0 ? `${r.ffp_units} FFP` : null,
                        r.platelet_units > 0 ? `${r.platelet_units} Platelets` : null,
                        r.cryoprecipitate_units > 0 ? `${r.cryoprecipitate_units} Cryo` : null,
                        r.whole_blood_units > 0 ? `${r.whole_blood_units} WB` : null,
                      ]
                        .filter(Boolean)
                        .join(' • ') || 'None specified'}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-800">{r.clinical_indication}</div>
                      <span
                        className={`inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          r.urgency === 'STAT_EMERGENCY_UNMATCHED'
                            ? 'bg-red-100 text-red-800'
                            : r.urgency === 'URGENT_WITHIN_2HR'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {r.urgency.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <div>{r.requesting_doctor_name}</div>
                      <div className="text-[10px] text-slate-400">{r.created_at.slice(0, 10)}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          r.status === 'CROSSMATCHED' || r.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'ISSUED'
                            ? 'bg-blue-100 text-blue-800'
                            : r.status === 'REQUESTED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bedside Transfusion Administrations Log */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-xs uppercase text-slate-700 flex justify-between items-center">
          <span>Bedside Transfusion Administration Record</span>
          <span className="text-[10px] text-slate-400 font-normal">2-Nurse verified unit-level infusion log</span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading transfusion logs...</div>
        ) : transfusions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 italic">No blood component units transfused yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-3">Component & Unit Barcode</th>
                  <th className="py-2.5 px-3">Group</th>
                  <th className="py-2.5 px-3">Start Time</th>
                  <th className="py-2.5 px-3">Verifiers</th>
                  <th className="py-2.5 px-3">Baseline Vitals</th>
                  <th className="py-2.5 px-3">15m Check</th>
                  <th className="py-2.5 px-3">Adverse Reaction</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfusions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{t.component_type}</div>
                      <div className="font-mono text-[10px] text-rose-800">{t.unit_number}</div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{t.unit_blood_group.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3 text-slate-600">{t.start_time}</td>
                    <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                      <div>{t.two_nurse_verifier_1}</div>
                      <div>{t.two_nurse_verifier_2}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <div>BP: {t.pre_vitals_bp || 'N/A'}</div>
                      <div>HR: {t.pre_vitals_hr || '--'} | T: {t.pre_vitals_temp || '--'}°C</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <div>BP: {t.vitals_15m_bp || 'N/A'}</div>
                      <div>HR: {t.vitals_15m_hr || '--'} | T: {t.vitals_15m_temp || '--'}°C</div>
                    </td>
                    <td className="py-2.5 px-3">
                      {t.adverse_reaction_observed ? (
                        <div className="text-red-700 font-bold bg-red-50 p-1 rounded border border-red-200">
                          <div>⚠️ {t.reaction_type?.replace(/_/g, ' ')}</div>
                          <div className="text-[10px] font-normal text-slate-600">{t.reaction_details}</div>
                        </div>
                      ) : (
                        <span className="text-emerald-700 font-semibold">None (Tolerated)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          t.transfusion_status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.transfusion_status === 'STOPPED_REACTION'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {t.transfusion_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showReqModal && (
        <BloodRequisitionModal
          isOpen={true}
          patientId={patientId}
          onClose={() => setShowReqModal(false)}
          onSuccess={() => loadData()}
        />
      )}

      {showTransModal && (
        <TransfusionLogModal
          isOpen={true}
          patientId={patientId}
          patientName={patientName}
          uhid={uhid}
          onClose={() => setShowTransModal(false)}
          onSuccess={() => loadData()}
        />
      )}

      {activeMtpId && (
        <MtpFlowsheetDrawer
          isOpen={true}
          mtpId={activeMtpId}
          onClose={() => setActiveMtpId(null)}
          onChanged={() => loadData()}
        />
      )}

      {/* MTP Trigger Modal */}
      {showMtpTriggerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleTriggerMtp}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-red-300 space-y-4 text-xs"
          >
            <div className="font-bold text-red-700 text-sm flex items-center gap-2">
              <span className="text-xl">🚨</span> Activate Massive Transfusion Protocol (MTP)
            </div>
            <p className="text-slate-600">
              Triggering MTP alerts Blood Bank to immediately prepare Pack 1 (4 PRBC : 4 FFP), draws critical trauma lab panels, and mobilizes senior resuscitation team.
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Trigger Indication *</label>
              <select
                value={triggerReason}
                onChange={(e) => setTriggerReason(e.target.value as MtpTriggerReason)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white font-bold text-slate-800"
              >
                <option value="PPH_ATONY">Postpartum Hemorrhage (Severe Uterine Atony)</option>
                <option value="PLACENTA_ACCRETA_SPECTRUM">Placenta Accreta / Increta / Percreta Spectrum</option>
                <option value="UTERINE_RUPTURE">Uterine Rupture with Hemoperitoneum</option>
                <option value="ABRUPTIO_PLACENTAE_DIC">Abruptio Placentae with Disseminated Coagulopathy</option>
                <option value="ECTOPIC_HEMORRHAGE">Ruptured Ectopic with Hemorrhagic Shock</option>
                <option value="SURGICAL_TRAUMA">Intra-operative Vascular or Surgical Trauma</option>
                <option value="OTHER">Other Life-Threatening Obstetric/Surgical Hemorrhage</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Baseline Shock Index</label>
                <input
                  type="number"
                  step="0.05"
                  value={shockIndex}
                  onChange={(e) => setShockIndex(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-center font-bold text-red-700"
                />
                <span className="text-[10px] text-slate-400">Target &ge; 1.0 indicates severe shock</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Estimated Blood Loss (mL)</label>
                <input
                  type="number"
                  step="100"
                  value={bloodLossMl}
                  onChange={(e) => setBloodLossMl(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-center font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowMtpTriggerModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={activatingMtp}
                className="px-5 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded text-xs font-bold uppercase"
              >
                {activatingMtp ? 'Activating...' : 'Activate MTP Stat'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
