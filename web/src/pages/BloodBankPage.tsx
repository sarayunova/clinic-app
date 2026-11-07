import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getBloodRequisitions,
  getActiveMtps,
  getTransfusions,
  updateBloodRequisitionStatus,
  type BloodRequisitionRecord,
  type MtpActivationRecord,
  type TransfusionRecord,
  type BloodRequisitionStatus,
} from '../api';
import { BloodRequisitionModal } from '../components/BloodRequisitionModal';
import { MtpFlowsheetDrawer } from '../components/MtpFlowsheetDrawer';
import { useAuth } from '../auth';

export function BloodBankPage() {
  const { can } = useAuth();
  const canWrite = can('patient:write_clinical') || can('care:write_nursing');

  const [loading, setLoading] = useState(true);
  const [requisitions, setRequisitions] = useState<BloodRequisitionRecord[]>([]);
  const [activeMtps, setActiveMtps] = useState<MtpActivationRecord[]>([]);
  const [transfusions, setTransfusions] = useState<TransfusionRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Active Flowsheet modal
  const [activeMtpId, setActiveMtpId] = useState<number | null>(null);
  const [showReqModal, setShowReqModal] = useState(false);

  // Patient selector cache
  const [patientsList, setPatientsList] = useState<{ id: number; fullName: string; patientNumber: string }[]>([]);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      getBloodRequisitions({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      }),
      getActiveMtps(),
      getTransfusions(),
    ])
      .then(([reqRes, mtpRes, transRes]) => {
        setRequisitions(reqRes.requisitions);
        setActiveMtps(mtpRes.activeMtps);
        setTransfusions(transRes.transfusions);
        setLoading(false);
      })
      .catch((err) => {
        alert('Failed to load blood bank data: ' + err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000); // 20s polling
    return () => clearInterval(interval);
  }, [statusFilter]);

  useEffect(() => {
    fetch('/api/patients?limit=50')
      .then((r) => r.json())
      .then((d) => {
        setPatientsList(
          (d.patients || []).map((p: any) => ({
            id: p.id,
            fullName: p.full_name || p.fullName,
            patientNumber: p.patient_number || p.uhid,
          }))
        );
      })
      .catch(() => {});
  }, []);

  const handleStatusChange = async (reqId: number, newStatus: BloodRequisitionStatus) => {
    try {
      await updateBloodRequisitionStatus(reqId, newStatus);
      loadData();
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    }
  };

  // Metrics
  const totalRequisitions = requisitions.length;
  const pendingCrossmatches = requisitions.filter(
    (r) => r.status === 'REQUESTED' || r.status === 'SAMPLE_RECEIVED'
  ).length;
  const unitsIssued = requisitions.filter((r) => r.status === 'ISSUED').length;
  const transfusionsActive = transfusions.filter((t) => t.transfusion_status === 'TRANSFUSING').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🩸</span>
            <h1 className="text-xl font-bold text-slate-800">
              Blood Bank Requisition & Massive Transfusion Protocol (MTP)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Emergency cross-match requisitions, bedside transfusion safety surveillance, and balanced 1:1:1 MTP resuscitation.
          </p>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={() => setShowReqModal(true)}
            className="px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
          >
            <span>+ Request Blood Components</span>
          </button>
        )}
      </div>

      {/* Active MTP Pulse Banner */}
      {activeMtps.length > 0 && (
        <div className="space-y-3">
          {activeMtps.map((mtp) => (
            <div
              key={mtp.id}
              className="bg-gradient-to-r from-red-600 to-rose-700 text-white p-4 rounded-xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">🚨</span>
                <div>
                  <div className="font-extrabold text-sm uppercase tracking-wide">
                    ACTIVE MASSIVE TRANSFUSION PROTOCOL ({mtp.mtp_code})
                  </div>
                  <div className="text-xs text-rose-100 mt-0.5">
                    Patient: <strong className="text-white">{mtp.patient_name}</strong> (UHID: {mtp.uhid})
                    &nbsp;|&nbsp; Reason: <strong>{mtp.trigger_reason.replace(/_/g, ' ')}</strong>
                    &nbsp;|&nbsp; Transfused: <strong>{mtp.total_prbc_transfused} PRBC : {mtp.total_ffp_transfused} FFP</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveMtpId(mtp.id)}
                className="px-4 py-2 bg-white text-rose-800 font-black rounded-lg shadow hover:bg-rose-50 transition-colors uppercase text-xs"
              >
                Open Live Resuscitation Flowsheet &rarr;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm bg-rose-50/20">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Active MTPs</div>
          <div className="text-2xl font-black text-rose-800 mt-1">{activeMtps.length}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm bg-amber-50/20">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Pending Crossmatches</div>
          <div className="text-2xl font-black text-amber-800 mt-1">{pendingCrossmatches}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm bg-blue-50/20">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Units Issued / In OT</div>
          <div className="text-2xl font-black text-blue-800 mt-1">{unitsIssued}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50/20">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Infusions In Progress</div>
          <div className="text-2xl font-black text-emerald-800 mt-1">{transfusionsActive}</div>
        </div>
      </div>

      {/* Requisitions Filter & Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-3">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3">
          <div className="font-bold text-xs uppercase text-slate-800 tracking-wider">
            Blood Bank Cross-Match & Transfusion Requisitions ({totalRequisitions})
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
            >
              <option value="ALL">All Requisitions</option>
              <option value="REQUESTED">Requested (Sample Sent)</option>
              <option value="SAMPLE_RECEIVED">Sample Received in Bank</option>
              <option value="CROSSMATCHED">Crossmatched & Reserved</option>
              <option value="ISSUED">Issued to Ward / OT</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 text-xs">Loading blood requisitions...</div>
        ) : requisitions.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs italic">
            No blood requisitions found matching current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-4">Req # & Time</th>
                  <th className="py-2.5 px-4">Patient Particulars</th>
                  <th className="py-2.5 px-4">Group</th>
                  <th className="py-2.5 px-4">Components Requested</th>
                  <th className="py-2.5 px-4">Clinical Indication & Urgency</th>
                  <th className="py-2.5 px-4">Doctor</th>
                  <th className="py-2.5 px-4">Status & Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requisitions.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 align-top">
                      <div className="font-mono font-bold text-rose-800 text-xs">{r.requisition_number}</div>
                      <div className="text-[10px] text-slate-400">{r.created_at.slice(0, 10)} {r.created_at.slice(11, 16)}</div>
                    </td>

                    <td className="py-3 px-4 align-top">
                      <Link
                        to={`/patients/${r.patient_id}`}
                        className="font-bold text-teal-700 hover:text-teal-900 block"
                      >
                        {r.patient_name}
                      </Link>
                      <div className="text-[10px] text-slate-500">
                        UHID: <span className="font-mono text-slate-700">{r.uhid}</span>
                        {r.patient_age ? ` • Age: ${r.patient_age}y` : ''}
                      </div>
                    </td>

                    <td className="py-3 px-4 align-top">
                      <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {r.blood_group_abo.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 align-top">
                      <div className="font-semibold text-slate-800">
                        {[
                          r.prbc_units > 0 ? `${r.prbc_units} PRBC` : null,
                          r.ffp_units > 0 ? `${r.ffp_units} FFP` : null,
                          r.platelet_units > 0 ? `${r.platelet_units} Plt` : null,
                          r.cryoprecipitate_units > 0 ? `${r.cryoprecipitate_units} Cryo` : null,
                          r.whole_blood_units > 0 ? `${r.whole_blood_units} WB` : null,
                        ]
                          .filter(Boolean)
                          .join(' • ') || 'None'}
                      </div>
                      {r.special_requirements && (
                        <div className="text-[10px] text-slate-500 mt-0.5">Req: {r.special_requirements}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 align-top">
                      <div className="font-semibold text-slate-800">{r.clinical_indication}</div>
                      <span
                        className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          r.urgency === 'STAT_EMERGENCY_UNMATCHED'
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : r.urgency === 'URGENT_WITHIN_2HR'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {r.urgency.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 align-top text-slate-600">
                      {r.requesting_doctor_name}
                    </td>

                    <td className="py-3 px-4 align-top">
                      <select
                        value={r.status}
                        disabled={!canWrite}
                        onChange={(e) => handleStatusChange(r.id, e.target.value as BloodRequisitionStatus)}
                        className={`px-2 py-1 rounded text-[11px] font-bold border ${
                          r.status === 'CROSSMATCHED' || r.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : r.status === 'ISSUED'
                            ? 'bg-blue-50 text-blue-800 border-blue-300'
                            : r.status === 'REQUESTED'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-slate-50 text-slate-800 border-slate-300'
                        }`}
                      >
                        <option value="REQUESTED">Requested</option>
                        <option value="SAMPLE_RECEIVED">Sample Received</option>
                        <option value="CROSSMATCHED">Crossmatched</option>
                        <option value="ISSUED">Issued to Ward</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
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
          patientsList={patientsList}
          onClose={() => setShowReqModal(false)}
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
    </div>
  );
}
