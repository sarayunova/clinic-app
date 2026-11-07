import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getOtSchedules,
  createOtSchedule,
  updateOtSchedule,
  deleteOtSchedule,
  getOtStaff,
  type OtScheduleRecord,
  type OtRoom,
  type OtPriority,
  type OtStatus,
} from '../api';
import { WhoChecklistDrawer } from '../components/WhoChecklistDrawer';
import { useMe, useAuth } from '../auth';

const OT_ROOMS: { id: OtRoom; name: string }[] = [
  { id: 'OT_1_MAIN', name: 'OT-1 (Main Operating Theater)' },
  { id: 'OT_2_MATERNITY', name: 'OT-2 (Maternity & Obstetric OT)' },
  { id: 'OT_3_MINOR', name: 'OT-3 (Daycare & Minor OT)' },
  { id: 'LABOR_OT', name: 'Labor Room Emergency OT' },
];

const PROCEDURE_PRESETS = [
  { name: 'Elective Lower Segment Cesarean Section (LSCS)', category: 'OBSTETRIC', duration: 60, priority: 'ELECTIVE' },
  { name: 'Emergency Category-1 Cesarean Section', category: 'OBSTETRIC', duration: 45, priority: 'EMERGENCY_CAT_1' },
  { name: 'Total Laparoscopic Hysterectomy (TLH) +/- BSO', category: 'LAPAROSCOPIC', duration: 120, priority: 'ELECTIVE' },
  { name: 'Diagnostic Laparoscopy & Chromopertubation', category: 'INFERTILITY_REPRODUCTIVE', duration: 45, priority: 'ELECTIVE' },
  { name: 'Cervical Encircle / Cerclage (McDonald)', category: 'OBSTETRIC', duration: 30, priority: 'ELECTIVE' },
  { name: 'Suction Evacuation & Curettage (MTP / Missed Abortion)', category: 'GYNECOLOGICAL', duration: 30, priority: 'URGENT' },
  { name: 'Laparoscopic Ovarian Cystectomy', category: 'LAPAROSCOPIC', duration: 75, priority: 'ELECTIVE' },
];

export function OtSchedulerPage() {
  const me = useMe();
  const { can } = useAuth();
  const canWrite = me.role === 'doctor' || me.role === 'nurse';
  const isDoctor = me.role === 'doctor';

  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const [schedules, setSchedules] = useState<OtScheduleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Active WHO Checklist modal
  const [activeChecklistId, setActiveChecklistId] = useState<number | null>(null);

  // Booking Modal
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingSaving, setBookingSaving] = useState(false);

  // Staff options for dropdowns
  const [staffList, setStaffList] = useState<{ id: number; fullName: string; role: string }[]>([]);

  // Booking Form State
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | ''>('');
  const [bookRoom, setBookRoom] = useState<OtRoom>('OT_2_MATERNITY');
  const [bookDate, setBookDate] = useState(todayStr);
  const [bookStartTime, setBookStartTime] = useState('09:00');
  const [bookDuration, setBookDuration] = useState(60);
  const [bookProcedure, setBookProcedure] = useState(PROCEDURE_PRESETS[0]!.name);
  const [bookCategory, setBookCategory] = useState(PROCEDURE_PRESETS[0]!.category);
  const [bookPriority, setBookPriority] = useState<OtPriority>('ELECTIVE');
  const [bookSurgeonId, setBookSurgeonId] = useState<number | ''>('');
  const [bookAssistantName, setBookAssistantName] = useState('');
  const [bookAnesId, setBookAnesId] = useState<number | ''>('');
  const [bookNurseName, setBookNurseName] = useState('');
  const [bookPediatrician, setBookPediatrician] = useState('');
  const [bookBloodUnits, setBookBloodUnits] = useState(1);
  const [bookEquipment, setBookEquipment] = useState('Neonatal Resuscitation Trolley Standby');

  const loadSchedules = () => {
    setLoading(true);
    getOtSchedules({
      date: selectedDate,
      otRoom: selectedRoom !== 'ALL' ? selectedRoom : undefined,
      status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
    })
      .then((res) => {
        setSchedules(res.schedules);
        setLoading(false);
      })
      .catch((err) => {
        alert('Failed to load OT schedules: ' + err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadSchedules();
  }, [selectedDate, selectedRoom, selectedStatus]);

  useEffect(() => {
    getOtStaff()
      .then((res) => {
        setStaffList(res.staff);
        const docs = res.staff.filter((s) => s.role === 'doctor');
        if (docs.length > 0 && docs[0]) {
          setBookSurgeonId(docs[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const searchPatients = async (query: string) => {
    setPatientSearch(query);
    if (query.trim().length < 2) return;
    try {
      const res = await fetch(`/api/patients?q=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setPatients(data.patients || []);
        if (data.patients?.length > 0 && selectedPatientId === '') {
          setSelectedPatientId(data.patients[0].id);
        }
      }
    } catch {}
  };

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleApplyPreset = (preset: typeof PROCEDURE_PRESETS[0]) => {
    setBookProcedure(preset.name);
    setBookCategory(preset.category);
    setBookDuration(preset.duration);
    setBookPriority(preset.priority as OtPriority);
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !bookSurgeonId) {
      alert('Please select both a patient and the primary surgeon.');
      return;
    }

    try {
      setBookingSaving(true);
      await createOtSchedule({
        patientId: Number(selectedPatientId),
        otRoom: bookRoom,
        scheduledDate: bookDate,
        scheduledStartTime: bookStartTime,
        estimatedDurationMinutes: Number(bookDuration),
        procedureName: bookProcedure,
        procedureCategory: bookCategory,
        priority: bookPriority,
        primarySurgeonId: Number(bookSurgeonId),
        assistantSurgeonName: bookAssistantName || null,
        anesthesiologistId: bookAnesId ? Number(bookAnesId) : null,
        scrubNurseName: bookNurseName || null,
        pediatricianStandbyName: bookPediatrician || null,
        bloodUnitsReserved: Number(bookBloodUnits),
        specialEquipmentNeeded: bookEquipment || null,
      });

      alert('Operating Theater surgery scheduled successfully!');
      setShowBookingModal(false);
      loadSchedules();
    } catch (err: any) {
      alert('Failed to book surgery: ' + err.message);
    } finally {
      setBookingSaving(false);
    }
  };

  const handleStatusChange = async (scheduleId: number, newStatus: OtStatus) => {
    try {
      await updateOtSchedule(scheduleId, { status: newStatus });
      loadSchedules();
    } catch (err: any) {
      alert('Failed to update surgery status: ' + err.message);
    }
  };

  const handleDeleteSurgery = async (scheduleId: number) => {
    if (!window.confirm('Are you sure you want to cancel and remove this surgical booking?')) return;
    try {
      await deleteOtSchedule(scheduleId);
      loadSchedules();
    } catch (err: any) {
      alert('Failed to delete booking: ' + err.message);
    }
  };

  // Metrics
  const totalCount = schedules.length;
  const inProgressCount = schedules.filter((s) => s.status === 'SURGERY_IN_PROGRESS').length;
  const inPacuCount = schedules.filter((s) => s.status === 'PACU_RECOVERY').length;
  const completedCount = schedules.filter((s) => s.status === 'COMPLETED').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏥</span>
            <h1 className="text-xl font-bold text-slate-800">
              Operating Theater (OT) Scheduler & Surgical Management
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Theater roster, Pre-Anesthesia Clearances (PAC), and WHO 3-Phase Surgical Safety Checklist flowsheets.
          </p>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={() => {
              setBookDate(selectedDate);
              setShowBookingModal(true);
            }}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
          >
            <span>+ Book Surgical Operation</span>
          </button>
        )}
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Scheduled Today</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{totalCount}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm bg-blue-50/30">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700">In Surgery (OT)</div>
          <div className="text-2xl font-black text-blue-700 mt-1">{inProgressCount}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm bg-amber-50/30">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">In PACU Recovery</div>
          <div className="text-2xl font-black text-amber-700 mt-1">{inPacuCount}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50/30">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Completed</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{completedCount}</div>
        </div>
      </div>

      {/* Date & Filter Navigation Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevDay}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            &larr; Prev
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
          />
          <button
            type="button"
            onClick={handleNextDay}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            Next &rarr;
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(todayStr)}
            className="px-2.5 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 mr-2">Theater Room:</label>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-white"
            >
              <option value="ALL">All Operating Theaters</option>
              {OT_ROOMS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 mr-2">Status:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="PATIENT_IN_OT">Patient In OT</option>
              <option value="SURGERY_IN_PROGRESS">Surgery In Progress</option>
              <option value="PACU_RECOVERY">PACU Recovery</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Schedules Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-500 text-sm">Loading theater schedules...</div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-16 text-slate-500 space-y-2">
            <p className="font-semibold text-sm">No surgical operations scheduled for {selectedDate}.</p>
            <p className="text-xs text-slate-400">Click &quot;+ Book Surgical Operation&quot; to reserve an OT suite.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Time & OT Room</th>
                  <th className="py-3 px-4">Patient Particulars</th>
                  <th className="py-3 px-4">Procedure & Priority</th>
                  <th className="py-3 px-4">Surgical & Anesthetic Team</th>
                  <th className="py-3 px-4">PAC Clearance</th>
                  <th className="py-3 px-4">WHO Safety Checklist</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map((s) => {
                  const isEmergency = s.priority === 'EMERGENCY_CAT_1';
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Time & OT Room */}
                      <td className="py-3 px-4 align-top">
                        <div className="font-bold text-slate-900 text-sm">{s.scheduled_start_time}</div>
                        <div className="text-[11px] text-slate-500">({s.estimated_duration_minutes} mins)</div>
                        <span className="inline-block mt-1 font-semibold text-[10px] uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {s.ot_room.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Patient Particulars */}
                      <td className="py-3 px-4 align-top">
                        <Link
                          to={`/patients/${s.patient_id}`}
                          className="font-bold text-teal-700 hover:text-teal-900 text-sm block"
                        >
                          {s.patient_name}
                        </Link>
                        <div className="text-slate-500 text-[11px]">
                          UHID: <span className="font-mono text-slate-700">{s.uhid}</span>
                          {s.patient_age ? ` • Age: ${s.patient_age}y` : ''}
                        </div>
                        {s.patient_phone && (
                          <div className="text-slate-400 text-[10px]">Ph: {s.patient_phone}</div>
                        )}
                      </td>

                      {/* Procedure & Priority */}
                      <td className="py-3 px-4 align-top">
                        <div className="font-bold text-slate-800 text-xs">{s.procedure_name}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isEmergency
                                ? 'bg-red-100 text-red-800 border border-red-300 animate-pulse'
                                : s.priority === 'URGENT'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {s.priority.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-slate-400">• {s.procedure_category}</span>
                        </div>
                      </td>

                      {/* Team */}
                      <td className="py-3 px-4 align-top text-[11px] space-y-0.5">
                        <div>
                          Surgeon: <strong className="text-slate-800">{s.primary_surgeon_name}</strong>
                        </div>
                        {s.anesthesiologist_name && (
                          <div className="text-slate-600">
                            Anes: <strong className="text-slate-700">{s.anesthesiologist_name}</strong>
                          </div>
                        )}
                        {s.scrub_nurse_name && (
                          <div className="text-slate-500">Nurse: {s.scrub_nurse_name}</div>
                        )}
                        {s.pediatrician_standby_name && (
                          <div className="text-emerald-700 font-medium">Peds: {s.pediatrician_standby_name}</div>
                        )}
                      </td>

                      {/* PAC Clearance */}
                      <td className="py-3 px-4 align-top">
                        {s.pac_clearance_status ? (
                          <div className="space-y-1">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                s.pac_clearance_status === 'FIT_FOR_SURGERY'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : s.pac_clearance_status === 'FIT_WITH_HIGH_RISK'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-red-100 text-red-800 border border-red-300'
                              }`}
                            >
                              {s.pac_clearance_status.replace(/_/g, ' ')}
                            </span>
                            {s.asa_grade && (
                              <div className="text-[10px] font-semibold text-slate-600">
                                Grade: {s.asa_grade.replace(/_/g, ' ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-50 text-yellow-800 border border-yellow-200">
                            PAC Pending
                          </span>
                        )}
                      </td>

                      {/* WHO Checklist */}
                      <td className="py-3 px-4 align-top">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className={`w-2 h-2 rounded-full ${s.signin_completed ? 'bg-emerald-600' : 'bg-slate-300'}`}></span>
                            <span className={s.signin_completed ? 'text-emerald-700 font-bold' : 'text-slate-400'}>Sign In</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className={`w-2 h-2 rounded-full ${s.timeout_completed ? 'bg-emerald-600' : 'bg-slate-300'}`}></span>
                            <span className={s.timeout_completed ? 'text-emerald-700 font-bold' : 'text-slate-400'}>Time Out</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className={`w-2 h-2 rounded-full ${s.signout_completed ? 'bg-emerald-600' : 'bg-slate-300'}`}></span>
                            <span className={s.signout_completed ? 'text-emerald-700 font-bold' : 'text-slate-400'}>Sign Out</span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 align-top">
                        <select
                          value={s.status}
                          disabled={!canWrite}
                          onChange={(e) => handleStatusChange(s.id, e.target.value as OtStatus)}
                          className={`px-2 py-1 rounded text-[11px] font-bold border ${
                            s.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : s.status === 'SURGERY_IN_PROGRESS'
                              ? 'bg-blue-50 text-blue-800 border-blue-300 animate-pulse'
                              : s.status === 'PACU_RECOVERY'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : s.status === 'PATIENT_IN_OT'
                              ? 'bg-purple-50 text-purple-800 border-purple-300'
                              : s.status === 'CANCELLED'
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : 'bg-slate-50 text-slate-800 border-slate-300'
                          }`}
                        >
                          <option value="SCHEDULED">Scheduled</option>
                          <option value="PATIENT_IN_OT">Patient In OT</option>
                          <option value="SURGERY_IN_PROGRESS">Surgery In Progress</option>
                          <option value="PACU_RECOVERY">PACU Recovery</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 align-top text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveChecklistId(s.id)}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded font-bold text-[11px] border border-teal-200 transition-colors flex items-center gap-1"
                          >
                            <span>📋 WHO Checklist</span>
                          </button>

                          <Link
                            to={`/ot-schedule/${s.id}/print`}
                            target="_blank"
                            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded font-semibold text-[11px] border border-slate-200 transition-colors flex items-center gap-1"
                          >
                            <span>🖨️ Print Docket</span>
                          </Link>

                          {isDoctor && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSurgery(s.id)}
                              className="text-red-500 hover:text-red-700 font-semibold text-[10px] mt-0.5"
                            >
                              Cancel Booking
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Booking Surgery Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateBooking}
            className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
          >
            <div className="bg-teal-700 text-white p-4 flex justify-between items-center">
              <h2 className="font-bold text-base flex items-center gap-2">
                <span>🔪</span> Schedule Operating Theater Booking
              </h2>
              <button
                type="button"
                onClick={() => setShowBookingModal(false)}
                className="text-white/80 hover:text-white font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs bg-slate-50/50">
              {/* Presets Quick Picker */}
              <div className="bg-teal-50 p-3 rounded-lg border border-teal-200">
                <span className="font-bold text-teal-800 block mb-1.5">Common Surgical Procedures:</span>
                <div className="flex flex-wrap gap-1.5">
                  {PROCEDURE_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="px-2 py-1 bg-white hover:bg-teal-100 text-teal-800 rounded border border-teal-300 text-[11px] font-medium transition-colors"
                    >
                      {p.name.split('(')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Patient Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Search Patient (Name or UHID)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => searchPatients(e.target.value)}
                    placeholder="Type patient name or UHID..."
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(Number(e.target.value))}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-semibold bg-white"
                  >
                    <option value="">-- Choose Patient --</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name || p.fullName} ({p.patient_number || p.uhid})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Theater Room, Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Operating Theater Room</label>
                  <select
                    value={bookRoom}
                    onChange={(e) => setBookRoom(e.target.value as OtRoom)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {OT_ROOMS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    required
                    value={bookDate}
                    onChange={(e) => setBookDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block font-semibold text-slate-700 mb-1">Start Time</label>
                    <input
                      type="time"
                      required
                      value={bookStartTime}
                      onChange={(e) => setBookStartTime(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className="w-20">
                    <label className="block font-semibold text-slate-700 mb-1">Duration</label>
                    <input
                      type="number"
                      min="15"
                      step="15"
                      value={bookDuration}
                      onChange={(e) => setBookDuration(Number(e.target.value))}
                      className="w-full px-2 py-2 border border-slate-300 rounded-lg bg-white text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Procedure Name, Category & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Procedure Name</label>
                  <input
                    type="text"
                    required
                    value={bookProcedure}
                    onChange={(e) => setBookProcedure(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Surgical Priority</label>
                  <select
                    value={bookPriority}
                    onChange={(e) => setBookPriority(e.target.value as OtPriority)}
                    className={`w-full px-3 py-2 border rounded-lg font-bold bg-white ${
                      bookPriority === 'EMERGENCY_CAT_1'
                        ? 'border-red-400 text-red-700 bg-red-50'
                        : bookPriority === 'URGENT'
                        ? 'border-amber-400 text-amber-700 bg-amber-50'
                        : 'border-slate-300 text-slate-800'
                    }`}
                  >
                    <option value="ELECTIVE">Elective Planned</option>
                    <option value="URGENT">Urgent (Within 4-6 Hours)</option>
                    <option value="EMERGENCY_CAT_1">Category 1 Emergency (Immediate)</option>
                  </select>
                </div>
              </div>

              {/* Surgical Staff */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Primary Operating Surgeon *</label>
                  <select
                    required
                    value={bookSurgeonId}
                    onChange={(e) => setBookSurgeonId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    <option value="">-- Choose Surgeon --</option>
                    {staffList
                      .filter((s) => s.role === 'doctor')
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.fullName}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assistant Surgeon (Optional)</label>
                  <input
                    type="text"
                    value={bookAssistantName}
                    onChange={(e) => setBookAssistantName(e.target.value)}
                    placeholder="Assistant Surgeon Name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Consultant Anesthesiologist</label>
                  <select
                    value={bookAnesId}
                    onChange={(e) => setBookAnesId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- On-Call Anesthesiologist --</option>
                    {staffList
                      .filter((s) => s.role === 'doctor')
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.fullName}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Scrub Nurse Name</label>
                  <input
                    type="text"
                    value={bookNurseName}
                    onChange={(e) => setBookNurseName(e.target.value)}
                    placeholder="Staff Nurse / Scrub"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pediatrician Standby (LSCS/Birth)</label>
                  <input
                    type="text"
                    value={bookPediatrician}
                    onChange={(e) => setBookPediatrician(e.target.value)}
                    placeholder="Standby Pediatrician / Neonatologist"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Blood Units Reserved</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={bookBloodUnits}
                    onChange={(e) => setBookBloodUnits(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Special Equipment Needed</label>
                  <input
                    type="text"
                    value={bookEquipment}
                    onChange={(e) => setBookEquipment(e.target.value)}
                    placeholder="e.g. Laparoscopic tower, C-Arm, infant radiant warmer"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowBookingModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={bookingSaving}
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
              >
                {bookingSaving ? 'Booking...' : 'Confirm & Schedule Surgery'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Interactive WHO Checklist Drawer */}
      {activeChecklistId && (
        <WhoChecklistDrawer
          isOpen={true}
          scheduleId={activeChecklistId}
          onClose={() => setActiveChecklistId(null)}
          onSaved={() => loadSchedules()}
        />
      )}
    </div>
  );
}
