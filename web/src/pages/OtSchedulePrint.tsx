import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import {
  getOtSchedule,
  auditOtPrint,
  type OtScheduleRecord,
  type PacClearanceRecord,
  type WhoChecklistRecord,
} from '../api';
import { ASA_DEFINITIONS } from '../otPacEngine';

export function OtSchedulePrint() {
  const { id } = useParams<{ id: string }>();
  const { clinic } = useClinic();
  const [data, setData] = useState<{
    schedule: OtScheduleRecord;
    pac: PacClearanceRecord | null;
    whoChecklist: WhoChecklistRecord | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const schedId = Number(id);
    getOtSchedule(schedId)
      .then((res) => {
        setData(res);
        setLoading(false);
        auditOtPrint(schedId).catch(() => {});
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (!clinic || loading || !data) {
    return <div className="p-8 text-center text-slate-500 text-sm">Generating surgical theater dossier...</div>;
  }

  const { schedule, pac, whoChecklist } = data;
  const asaInfo = pac ? ASA_DEFINITIONS[pac.asa_grade] : null;

  return (
    <Sheet
      clinic={clinic}
      title="OPERATING THEATER DOSSIER & WHO SURGICAL SAFETY CHECKLIST"
      back="/ot-schedule"
      onPrint={() => window.print()}
    >
      <div className="space-y-6 text-xs text-slate-800">
        {/* Patient Demographics Banner */}
        <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Patient Name</span>
              <strong className="text-sm text-slate-900">{schedule.patient_name}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">UHID</span>
              <strong className="font-mono text-slate-900">{schedule.uhid}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Age & Gender</span>
              <span>{schedule.patient_age ? `${schedule.patient_age} Years` : 'Adult'} / Female</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Contact Phone</span>
              <span>{schedule.patient_phone || 'N/A'}</span>
            </div>
          </div>

          {(schedule.gravida !== null && schedule.gravida !== undefined) && (
            <div className="mt-2 pt-2 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500">Obstetric History: </span>
                <strong>G{schedule.gravida} P{schedule.para ?? 0}</strong>
              </div>
              {schedule.lastMenstrualPeriod && (
                <div>
                  <span className="text-slate-500">LMP: </span>
                  <strong>{schedule.lastMenstrualPeriod}</strong>
                </div>
              )}
              {schedule.patient_address && (
                <div className="sm:col-span-2">
                  <span className="text-slate-500">Address: </span>
                  <span>{schedule.patient_address}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Surgical Operation Schedule Details */}
        <div>
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-300 pb-1 mb-2 flex justify-between">
            <span>Surgical Booking Particulars</span>
            <span>Status: <strong>{schedule.status.replace(/_/g, ' ')}</strong></span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-white border border-slate-200 rounded-lg p-3">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Scheduled Procedure</span>
              <strong className="text-slate-900">{schedule.procedure_name}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Theater Suite</span>
              <strong>{schedule.ot_room.replace(/_/g, ' ')}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Date & Time</span>
              <strong>{schedule.scheduled_date} at {schedule.scheduled_start_time}</strong> ({schedule.estimated_duration_minutes} min)
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Primary Surgeon</span>
              <strong>{schedule.primary_surgeon_name}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Anesthesiologist</span>
              <span>{schedule.anesthesiologist_name || 'Duty Anesthesiologist'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Surgical Priority</span>
              <strong className={schedule.priority === 'EMERGENCY_CAT_1' ? 'text-red-700 font-bold' : ''}>
                {schedule.priority.replace(/_/g, ' ')}
              </strong>
            </div>
            {schedule.assistant_surgeon_name && (
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Assistant Surgeon</span>
                <span>{schedule.assistant_surgeon_name}</span>
              </div>
            )}
            {schedule.scrub_nurse_name && (
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Scrub Nurse</span>
                <span>{schedule.scrub_nurse_name}</span>
              </div>
            )}
            {schedule.pediatrician_standby_name && (
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Standby Pediatrician</span>
                <span>{schedule.pediatrician_standby_name}</span>
              </div>
            )}
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Blood Reserved</span>
              <span>{schedule.blood_units_reserved} Unit(s)</span>
            </div>
            {schedule.special_equipment_needed && (
              <div className="sm:col-span-2">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Special Equipment</span>
                <span>{schedule.special_equipment_needed}</span>
              </div>
            )}
          </div>
        </div>

        {/* Pre-Anesthesia Clearance (PAC) */}
        <div>
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-300 pb-1 mb-2 flex justify-between">
            <span>Pre-Anesthesia Clearance (PAC) Record</span>
            {pac ? (
              <span className="text-emerald-700 font-bold">
                Clearance: {pac.pac_clearance_status.replace(/_/g, ' ')}
              </span>
            ) : (
              <span className="text-amber-700 font-semibold">PAC Clearance Pending</span>
            )}
          </h3>

          {pac ? (
            <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">ASA Physical Status</span>
                  <strong>{asaInfo?.title || pac.asa_grade}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Airway Assessment</span>
                  <span>{pac.mallampati_class.replace(/_/g, ' ')} | Mouth: {pac.mouth_opening_cm}cm</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Thyromental Dist / Neck</span>
                  <span>{pac.thyromental_distance_cm}cm | {pac.neck_mobility.replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">NPO Fasting</span>
                  <span>Solid: {pac.npo_solid_hours}h | Clear: {pac.npo_clear_liquid_hours}h</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                <div>
                  <span className="text-slate-500 font-bold">Cardiovascular / Respiratory: </span>
                  <span>{pac.cardiovascular_assessment || 'Normal'} | {pac.respiratory_assessment || 'Normal'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold">Planned Anesthesia: </span>
                  <span>{pac.planned_anesthesia_technique.replace(/_/g, ' ')}</span>
                </div>
                {pac.high_risk_warnings && (
                  <div className="sm:col-span-2 text-red-700">
                    <strong>High Risk Alerts: </strong>
                    <span>{pac.high_risk_warnings}</span>
                  </div>
                )}
                {pac.preop_orders_instructions && (
                  <div className="sm:col-span-2 text-slate-700">
                    <strong>Preop Instructions: </strong>
                    <span>{pac.preop_orders_instructions}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-slate-300 p-3 rounded-lg text-slate-500 italic text-center">
              No formal pre-anesthesia clearance record attached to this surgical booking.
            </div>
          )}
        </div>

        {/* WHO Surgical Safety Checklist (Safe Surgery Saves Lives) */}
        <div>
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-300 pb-1 mb-2">
            WHO Surgical Safety Checklist (3-Phase Flowsheet)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border border-slate-300 rounded-lg overflow-hidden">
            {/* Phase 1: SIGN IN */}
            <div className="p-3 bg-slate-50/60 border-r border-slate-200 space-y-2">
              <div className="border-b border-slate-200 pb-1">
                <strong className="text-slate-900 block text-[11px]">PHASE 1: SIGN IN</strong>
                <span className="text-[10px] text-slate-500">Before Induction of Anesthesia</span>
                <div className="text-[10px] font-bold text-teal-700 mt-0.5">
                  {whoChecklist?.signin_completed ? 'COMPLETED ✓' : 'PENDING'}
                </div>
              </div>

              <ul className="space-y-1.5 text-[10px]">
                <li className="flex items-start gap-1.5">
                  <span>{whoChecklist?.signin_patient_confirmed ? '☑' : '☐'}</span>
                  <span>Patient identity, site, procedure & consent confirmed</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span>{whoChecklist?.signin_site_marked ? '☑' : '☐'}</span>
                  <span>Surgical site marked / NA</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span>{whoChecklist?.signin_anesthesia_safety_check ? '☑' : '☐'}</span>
                  <span>Anesthesia safety check complete</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span>{whoChecklist?.signin_pulse_oximeter_functioning ? '☑' : '☐'}</span>
                  <span>Pulse oximeter on patient & functioning</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span>{whoChecklist?.signin_known_allergy ? '☒' : '☑'}</span>
                  <span>{whoChecklist?.signin_known_allergy ? 'Known allergy: YES' : 'No known allergy'}</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span>{whoChecklist?.signin_difficult_airway_risk ? '☒' : '☑'}</span>
                  <span>{whoChecklist?.signin_difficult_airway_risk ? 'Difficult airway risk: Equipment ready' : 'Standard airway'}</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span>{whoChecklist?.signin_blood_loss_risk ? '☒' : '☑'}</span>
                  <span>Risk of &gt;500mL blood loss: {whoChecklist?.signin_blood_loss_risk ? 'Yes (fluids/blood ready)' : 'Low risk'}</span>
                </li>
              </ul>

              <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                Verified: <strong>{whoChecklist?.signin_nurse_anesthetist_name || 'Anesthesia Team'}</strong>
                {whoChecklist?.signin_timestamp && <div>Time: {new Date(whoChecklist.signin_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
              </div>
            </div>

            {/* Phase 2: TIME OUT */}
            <div className="p-3 bg-slate-50/60 border-r border-slate-200 space-y-2">
              <div className="border-b border-slate-200 pb-1">
                <strong className="text-slate-900 block text-[11px]">PHASE 2: TIME OUT</strong>
                <span className="text-[10px] text-slate-500">Before Skin Incision</span>
                <div className="text-[10px] font-bold text-teal-700 mt-0.5">
                  {whoChecklist?.timeout_completed ? 'COMPLETED ✓' : 'PENDING'}
                </div>
              </div>

              <ul className="space-y-1.5 text-[10px]">
                <li className="flex items-start gap-1.5">
                  <span>{whoChecklist?.timeout_team_introduced ? '☑' : '☐'}</span>
                  <span>All team members introduced by name & role</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span>{whoChecklist?.timeout_verbal_confirmation ? '☑' : '☐'}</span>
                  <span>Verbal confirmation: patient, site, & procedure</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span>{whoChecklist?.timeout_nursing_sterility_confirmed ? '☑' : '☐'}</span>
                  <span>Nursing sterility & indicator confirmation</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span>{whoChecklist?.timeout_antibiotic_prophylaxis_given ? '☑' : '☐'}</span>
                  <span>Antibiotic prophylaxis given within 60 min: {whoChecklist?.timeout_antibiotic_name_dose || 'Yes'}</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span>{whoChecklist?.timeout_imaging_displayed ? '☑' : '☐'}</span>
                  <span>Essential imaging displayed</span>
                </li>
                {whoChecklist?.timeout_surgeon_review && (
                  <li className="text-slate-600">
                    <strong>Surgeon review: </strong>{whoChecklist.timeout_surgeon_review}
                  </li>
                )}
                {whoChecklist?.timeout_anesthetist_review && (
                  <li className="text-slate-600">
                    <strong>Anesthetist review: </strong>{whoChecklist.timeout_anesthetist_review}
                  </li>
                )}
              </ul>

              <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                Verified: <strong>{whoChecklist?.timeout_completed_by_name || 'Lead Surgeon'}</strong>
                {whoChecklist?.timeout_timestamp && <div>Time: {new Date(whoChecklist.timeout_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
              </div>
            </div>

            {/* Phase 3: SIGN OUT */}
            <div className="p-3 bg-slate-50/60 space-y-2">
              <div className="border-b border-slate-200 pb-1">
                <strong className="text-slate-900 block text-[11px]">PHASE 3: SIGN OUT</strong>
                <span className="text-[10px] text-slate-500">Before Leaving Operating Theater</span>
                <div className="text-[10px] font-bold text-teal-700 mt-0.5">
                  {whoChecklist?.signout_completed ? 'COMPLETED ✓' : 'PENDING'}
                </div>
              </div>

              <ul className="space-y-1.5 text-[10px]">
                <li className="flex items-start gap-1.5">
                  <span>{whoChecklist?.signout_procedure_recorded_name ? '☑' : '☐'}</span>
                  <span>Procedure recorded: <strong>{whoChecklist?.signout_procedure_recorded_name || schedule.procedure_name}</strong></span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span>{whoChecklist?.signout_counts_correct ? '☑' : '☐'}</span>
                  <span>Instrument, swab/sponge and needle counts correct</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span>{whoChecklist?.signout_specimen_labeled ? '☑' : '☐'}</span>
                  <span>Specimen labeled (including patient name read aloud)</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span>{whoChecklist?.signout_equipment_problems ? '☒' : '☑'}</span>
                  <span>Equipment issues: {whoChecklist?.signout_equipment_problems || 'None'}</span>
                </li>
                {whoChecklist?.signout_recovery_concerns && (
                  <li className="text-slate-600">
                    <strong>PACU concerns: </strong>{whoChecklist.signout_recovery_concerns}
                  </li>
                )}
              </ul>

              <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                Verified: <strong>{whoChecklist?.signout_completed_by_name || 'Circulating Nurse'}</strong>
                {whoChecklist?.signout_timestamp && <div>Time: {new Date(whoChecklist.signout_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Dual Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300">
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500 mb-6">
              Consultant Anesthesiologist
            </div>
            <SignatureBlock
              clinic={clinic}
              signatoryName={schedule.anesthesiologist_name || 'Consultant Anesthesiologist'}
              designation="Consultant Anesthesiology & Critical Care"
            />
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500 mb-6">
              Primary Operating Surgeon
            </div>
            <SignatureBlock
              clinic={clinic}
              signatoryName={schedule.primary_surgeon_name || clinic.doctorName}
              designation="Consultant Obstetrician & Gynecologist / Surgeon"
            />
          </div>
        </div>
      </div>
    </Sheet>
  );
}
