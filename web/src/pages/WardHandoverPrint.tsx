import React, { useEffect, useState } from 'react';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { getLiveWardBoard, auditWardHandoverPrint, type LiveWardBoardResponse } from '../api';

export function WardHandoverPrint() {
  const { clinic } = useClinic();
  const [data, setData] = useState<LiveWardBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLiveWardBoard()
      .then((res) => {
        setData(res);
        setLoading(false);
        auditWardHandoverPrint(undefined, 'All Wards').catch(() => {});
      })
      .catch(() => setLoading(false));
  }, []);

  if (!clinic || loading || !data) {
    return <div className="p-8 text-center text-slate-500">Preparing shift handover sheet...</div>;
  }

  const shiftDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Sheet
      clinic={clinic}
      title="INPATIENT NURSING SHIFT HANDOVER SHEET"
      back="/ward-board"
      onPrint={() => window.print()}
    >
      <div className="space-y-6 text-sm text-slate-800">
        {/* Shift Meta Banner */}
        <div className="border border-slate-300 rounded-lg p-3 bg-slate-50 flex flex-wrap justify-between items-center text-xs">
          <div>
            <strong>Report Date:</strong> {shiftDate}
          </div>
          <div>
            <strong>Active Admissions:</strong> {data.stats.occupiedCount} / {data.stats.totalBeds} Beds
          </div>
          <div>
            <strong>Critical Deterioration Alerts:</strong>{' '}
            <span className={data.stats.criticalRedCount > 0 ? 'text-red-700 font-bold' : 'text-slate-700'}>
              {data.stats.criticalRedCount} Red / {data.stats.warningYellowCount} Yellow
            </span>
          </div>
        </div>

        {/* Occupied Inpatient Beds Table */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b pb-1">
            Bedside SBAR Roster
          </h3>

          {data.occupiedAdmissions.length === 0 ? (
            <div className="text-center py-6 text-slate-400 italic">No patients currently admitted in ward beds.</div>
          ) : (
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800 text-left">
                  <th className="border border-slate-300 p-2 w-24">Bed / Ward</th>
                  <th className="border border-slate-300 p-2 w-44">Patient & Demographics</th>
                  <th className="border border-slate-300 p-2">SBAR Clinical Handover</th>
                  <th className="border border-slate-300 p-2 w-48">IV Fluids & Pending Tasks</th>
                </tr>
              </thead>
              <tbody>
                {data.occupiedAdmissions.map((occ) => {
                  const sbar = occ.latestHandover;
                  const alerts = occ.triggerReasons || [];

                  return (
                    <tr key={occ.bedId} className="align-top border-b border-slate-300">
                      <td className="border border-slate-300 p-2 font-bold">
                        <div>Bed {occ.bedNumber}</div>
                        <div className="text-[10px] text-slate-500 font-normal">{occ.ward}</div>
                        <div className="mt-1">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              occ.deteriorationStatus === 'CRITICAL_RED'
                                ? 'bg-red-600 text-white'
                                : occ.deteriorationStatus === 'WARNING_YELLOW'
                                ? 'bg-amber-500 text-white'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {occ.deteriorationStatus === 'CRITICAL_RED'
                              ? 'RED ALERT'
                              : occ.deteriorationStatus === 'WARNING_YELLOW'
                              ? 'WARNING'
                              : 'STABLE'}
                          </span>
                        </div>
                      </td>

                      <td className="border border-slate-300 p-2">
                        <div className="font-bold text-slate-900">{occ.patientName}</div>
                        <div className="text-[10px] text-slate-600">
                          UHID: {occ.uhid} · {occ.ageYears ? `${occ.ageYears}y` : ''}
                          {occ.gravida !== null && occ.gravida !== undefined ? ` · G${occ.gravida}P${occ.para ?? 0}` : ''}
                        </div>
                        <div className="text-[10px] text-slate-700 mt-1">
                          <strong>Diag:</strong> {occ.primaryDiagnosis || 'Inpatient'}
                        </div>
                        <div className="text-[10px] text-slate-500">Doc: {occ.attendingDoctorName || 'Consultant'}</div>
                      </td>

                      <td className="border border-slate-300 p-2 space-y-1">
                        {alerts.length > 0 && (
                          <div className="text-[10px] text-red-700 font-bold">
                            ⚠️ Alerts: {alerts.join('; ')}
                          </div>
                        )}

                        {sbar ? (
                          <>
                            <div>
                              <strong>S:</strong> {sbar.situation}
                            </div>
                            <div>
                              <strong>B:</strong> {sbar.background}
                            </div>
                            <div>
                              <strong>A:</strong> {sbar.assessment}
                            </div>
                            <div>
                              <strong>R:</strong> {sbar.recommendation}
                            </div>
                            <div className="text-[10px] text-slate-500 italic mt-0.5">
                              Logged by: {sbar.nurse_name} ({sbar.shift_type} shift)
                            </div>
                          </>
                        ) : (
                          <div className="italic text-slate-400">
                            No shift handover recorded yet for this admission.
                          </div>
                        )}
                      </td>

                      <td className="border border-slate-300 p-2 text-[10px] space-y-1">
                        <div>
                          <strong>Fluids:</strong> {sbar?.iv_fluids_status || 'Charted as per orders'}
                        </div>
                        <div>
                          <strong>Diet:</strong> {sbar?.dietary_order || 'As tolerated'}
                        </div>
                        <div>
                          <strong>Pending Tasks:</strong>
                          <div className="text-slate-600 whitespace-pre-line mt-0.5">
                            {sbar?.pending_tasks
                              ? Array.isArray(sbar.pending_tasks)
                                ? sbar.pending_tasks.join('\n')
                                : sbar.pending_tasks
                              : 'None'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Dual Nurse Sign-off Block */}
        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300">
          <div className="border border-slate-300 rounded p-4 text-center">
            <div className="h-12"></div>
            <div className="border-t border-slate-400 pt-1 font-bold">Relieving (Off-going) Staff Nurse</div>
            <div className="text-xs text-slate-500">Name, Registration & Signature</div>
          </div>

          <div className="border border-slate-300 rounded p-4 text-center">
            <div className="h-12"></div>
            <div className="border-t border-slate-400 pt-1 font-bold">Reliever (On-coming) Staff Nurse</div>
            <div className="text-xs text-slate-500">Name, Registration & Signature</div>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
