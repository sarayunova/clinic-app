import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getTeleconsultations,
  createTeleconsultation,
  updateTeleconsultation,
  signTeleconsultation,
  sendTeleconsultationWhatsAppInvite,
  deleteTeleconsultation,
  type TeleconsultationRecord,
  api,
} from '../api';
import { buildWhatsAppDeepLink } from '../teleconsultationEngine';

interface PatientOption {
  id: number;
  fullName: string;
  patientNumber: string;
  phone?: string;
}

interface UserOption {
  id: number;
  fullName: string;
  role: string;
}

export function TeleconsultationsPage() {
  const [teleconsultations, setTeleconsultations] = useState<TeleconsultationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // New Consultation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [doctors, setDoctors] = useState<UserOption[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | ''>('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | ''>('');
  const [scheduledAt, setScheduledAt] = useState<string>(
    new Date(Date.now() + 3600000).toISOString().slice(0, 16)
  );
  const [consultType, setConsultType] = useState<string>('FOLLOW_UP');
  const [videoPlatform, setVideoPlatform] = useState<string>('WHATSAPP_VIDEO');
  const [chiefComplaint, setChiefComplaint] = useState<string>('');
  const [savingCreate, setSavingCreate] = useState(false);

  // Clinical Consultation Drawer / Modal
  const [activeConsult, setActiveConsult] = useState<TeleconsultationRecord | null>(null);
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editAdvice, setEditAdvice] = useState('');
  const [medicines, setMedicines] = useState<Array<{ name: string; dosage: string; frequency: string; duration: string; instructions: string }>>([]);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedFreq, setNewMedFreq] = useState('Once daily');
  const [newMedDuration, setNewMedDuration] = useState('14 days');
  const [newMedInst, setNewMedInst] = useState('After meals');
  const [signing, setSigning] = useState(false);

  const fetchTeleconsultations = async () => {
    try {
      const res = await getTeleconsultations({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setTeleconsultations(res.teleconsultations);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load teleconsultations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeleconsultations();
  }, [statusFilter]);

  // Load patients and doctors when opening modal
  useEffect(() => {
    if (showCreateModal) {
      api<{ patients: any[] }>('GET', '/api/patients?limit=50').then(
        (res) => {
          setPatients(
            res.patients.map((p) => ({
              id: p.id,
              fullName: p.full_name || p.fullName,
              patientNumber: p.patient_number || p.uhid,
              phone: p.phone,
            }))
          );
          if (res.patients.length > 0 && selectedPatientId === '') {
            setSelectedPatientId(res.patients[0].id);
          }
        },
        () => {}
      );

      api<{ users: any[] }>('GET', '/api/users').then(
        (res) => {
          const docs = res.users.filter((u) => u.role === 'doctor');
          setDoctors(docs);
          if (docs.length > 0 && selectedDoctorId === '') {
            setSelectedDoctorId(docs[0].id);
          }
        },
        () => {}
      );
    }
  }, [showCreateModal]);

  const handleOpenConsultDrawer = (consult: TeleconsultationRecord) => {
    setActiveConsult(consult);
    setEditDiagnosis(consult.provisional_diagnosis || '');
    setEditNotes(consult.clinical_notes || '');
    setEditAdvice(consult.advice_instructions || '');

    let parsedMeds: any[] = [];
    if (consult.prescription_medicines) {
      if (typeof consult.prescription_medicines === 'string') {
        try {
          parsedMeds = JSON.parse(consult.prescription_medicines);
        } catch {
          parsedMeds = [];
        }
      } else if (Array.isArray(consult.prescription_medicines)) {
        parsedMeds = consult.prescription_medicines;
      }
    }
    setMedicines(parsedMeds);
  };

  const handleAddMedicine = () => {
    if (!newMedName.trim()) return;
    setMedicines([
      ...medicines,
      {
        name: newMedName.trim(),
        dosage: newMedDosage.trim(),
        frequency: newMedFreq.trim(),
        duration: newMedDuration.trim(),
        instructions: newMedInst.trim(),
      },
    ]);
    setNewMedName('');
    setNewMedDosage('');
  };

  const handleRemoveMedicine = (idx: number) => {
    setMedicines(medicines.filter((_, i) => i !== idx));
  };

  const handleSaveConsult = async () => {
    if (!activeConsult) return;
    try {
      const updated = await updateTeleconsultation(activeConsult.id, {
        provisional_diagnosis: editDiagnosis,
        clinical_notes: editNotes,
        advice_instructions: editAdvice,
        prescription_medicines: medicines,
      });
      setActiveConsult(updated);
      await fetchTeleconsultations();
      alert('Consultation updated successfully');
    } catch (err: any) {
      alert(err?.message || 'Error updating consultation');
    }
  };

  const handleSignPrescription = async () => {
    if (!activeConsult) return;
    if (!confirm('Are you sure you want to digitally sign and lock this e-prescription?')) return;
    setSigning(true);
    try {
      // Save changes first
      await updateTeleconsultation(activeConsult.id, {
        provisional_diagnosis: editDiagnosis,
        clinical_notes: editNotes,
        advice_instructions: editAdvice,
        prescription_medicines: medicines,
      });

      const signed = await signTeleconsultation(activeConsult.id);
      setActiveConsult(signed);
      await fetchTeleconsultations();
      alert('Prescription digitally signed and verified with cryptographic SHA-256 seal!');
    } catch (err: any) {
      alert(err?.message || 'Error signing prescription');
    } finally {
      setSigning(false);
    }
  };

  const handleSendWhatsAppInvite = async (id: number) => {
    try {
      const res = await sendTeleconsultationWhatsAppInvite(id);
      window.open(res.whatsappUrl, '_blank');
      await fetchTeleconsultations();
    } catch (err: any) {
      alert(err?.message || 'Error sending WhatsApp invite');
    }
  };

  const handleDeleteConsult = async (id: number) => {
    if (!confirm('Are you sure you want to cancel and delete this teleconsultation?')) return;
    try {
      await deleteTeleconsultation(id);
      await fetchTeleconsultations();
      if (activeConsult?.id === id) setActiveConsult(null);
    } catch (err: any) {
      alert(err?.message || 'Error deleting teleconsultation');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedDoctorId) {
      alert('Please select patient and doctor');
      return;
    }
    setSavingCreate(true);
    try {
      await createTeleconsultation({
        patientId: Number(selectedPatientId),
        doctorId: Number(selectedDoctorId),
        scheduledAt,
        consultType,
        videoPlatform,
        chiefComplaint,
      });
      setShowCreateModal(false);
      setChiefComplaint('');
      await fetchTeleconsultations();
    } catch (err: any) {
      alert(err?.message || 'Error scheduling teleconsultation');
    } finally {
      setSavingCreate(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Teleconsultations & E-Prescriptions</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
              NMC Telemedicine Compliant
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Remote video appointments, automated WhatsApp invite links, and SHA-256 digitally signed e-prescriptions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition flex items-center justify-center gap-2"
        >
          <span>+</span> Schedule Teleconsultation
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {['ALL', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === st
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Table / List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading teleconsultations...</div>
        ) : teleconsultations.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No teleconsultation appointments found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">Patient / UHID</th>
                  <th className="py-3 px-4">Scheduled Time</th>
                  <th className="py-3 px-4">Consult Type</th>
                  <th className="py-3 px-4">Platform & Link</th>
                  <th className="py-3 px-4">Status & Signature</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teleconsultations.map((c) => {
                  const dateStr = new Date(c.scheduled_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{c.patient_name}</div>
                        <div className="text-xs text-slate-500">
                          UHID: {c.uhid} · {c.patient_phone}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-medium">{dateStr}</div>
                        <div className="text-xs text-slate-500">Dr: {c.doctor_name}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          {c.consult_type.replace('_', ' ')}
                        </span>
                        <div className="text-xs text-slate-500 truncate max-w-xs mt-0.5">{c.chief_complaint}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-700">
                            {c.video_platform === 'WHATSAPP_VIDEO' ? 'WhatsApp Video' : 'Jitsi Meet'}
                          </span>
                        </div>
                        {c.meeting_link && (
                          <a
                            href={c.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:text-indigo-800 underline truncate max-w-[180px] inline-block"
                          >
                            Join Video Call
                          </a>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              c.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : c.status === 'CANCELLED'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {c.status}
                          </span>
                          {c.digital_signature_hash && (
                            <span className="text-[10px] text-emerald-700 font-mono font-semibold flex items-center gap-1">
                              ✓ Signed ({c.digital_signature_hash.slice(0, 8)}...)
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Send WhatsApp Invite */}
                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppInvite(c.id)}
                            className="p-1.5 text-xs rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                            title="Send WhatsApp Invite Link"
                          >
                            💬 Invite
                          </button>

                          {/* Open Clinical Drawer */}
                          <button
                            type="button"
                            onClick={() => handleOpenConsultDrawer(c)}
                            className="px-2.5 py-1 text-xs rounded font-semibold bg-slate-800 text-white hover:bg-slate-900"
                          >
                            Consult & Rx
                          </button>

                          {/* Print E-Prescription */}
                          <Link
                            to={`/teleconsultations/${c.id}/print`}
                            className="p-1.5 text-xs rounded bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300"
                            title="Print Legal E-Prescription"
                          >
                            🖨️
                          </Link>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteConsult(c.id)}
                            className="p-1.5 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100"
                            title="Delete / Cancel"
                          >
                            ✕
                          </button>
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

      {/* Schedule Consultation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-slate-800">Schedule Teleconsultation</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Patient</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(Number(e.target.value))}
                  className="w-full rounded-lg border-slate-300 text-sm p-2 border"
                  required
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.patientNumber}) · {p.phone || 'No phone'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Consulting Doctor</label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(Number(e.target.value))}
                  className="w-full rounded-lg border-slate-300 text-sm p-2 border"
                  required
                >
                  <option value="">-- Choose Doctor --</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date & Time</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full rounded-lg border-slate-300 text-sm p-2 border"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Consultation Type</label>
                  <select
                    value={consultType}
                    onChange={(e) => setConsultType(e.target.value)}
                    className="w-full rounded-lg border-slate-300 text-sm p-2 border"
                  >
                    <option value="FOLLOW_UP">Follow-Up Consult</option>
                    <option value="REPORT_REVIEW">Lab / USG Report Review</option>
                    <option value="FIRST_CONSULT">First Consultation</option>
                    <option value="POST_OP_CHECK">Post-Op / Post-Discharge Check</option>
                    <option value="EMERGENCY_TRIAGE">Emergency Triage</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Video Platform</label>
                <select
                  value={videoPlatform}
                  onChange={(e) => setVideoPlatform(e.target.value)}
                  className="w-full rounded-lg border-slate-300 text-sm p-2 border"
                >
                  <option value="WHATSAPP_VIDEO">WhatsApp Video (Direct Click-to-Chat Link)</option>
                  <option value="JITSI">Jitsi Meet (In-browser Secure Room)</option>
                  <option value="PHONE_CALL">Voice Phone Call</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chief Complaint / Reason for Teleconsultation
                </label>
                <textarea
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="e.g. Follow-up for thyroid panel results, reports mild fatigue."
                  rows={2}
                  className="w-full rounded-lg border-slate-300 text-sm p-2 border"
                  required
                />
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-700">✓ NMC Guidelines Compliance Note:</div>
                <div>Patient identity is confirmed via registered phone number and clinic UHID.</div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCreate}
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingCreate ? 'Scheduling...' : 'Schedule Consult'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clinical Notes & E-Prescription Drawer */}
      {activeConsult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  Telemedicine Clinical Encounter
                </span>
                <h2 className="text-xl font-bold text-slate-800">{activeConsult.patient_name}</h2>
                <p className="text-xs text-slate-500">
                  UHID: {activeConsult.uhid} · Doctor: {activeConsult.doctor_name} · Platform: {activeConsult.video_platform}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveConsult(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Video Launcher Strip */}
            <div className="my-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
              <div className="text-xs text-indigo-900">
                <strong>Meeting Link:</strong> {activeConsult.meeting_link || 'Link generated'}
              </div>
              <div className="flex gap-2">
                {activeConsult.meeting_link && (
                  <a
                    href={activeConsult.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    🚀 Start Video Call
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleSendWhatsAppInvite(activeConsult.id)}
                  className="px-3 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  💬 Send WA Invite
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Chief Complaint</label>
                <div className="p-2 bg-slate-50 border rounded-lg text-sm text-slate-800">
                  {activeConsult.chief_complaint}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Provisional Diagnosis</label>
                <input
                  type="text"
                  value={editDiagnosis}
                  onChange={(e) => setEditDiagnosis(e.target.value)}
                  placeholder="e.g. Gestational Hypothyroidism, 28 weeks gestation"
                  className="w-full rounded-lg border-slate-300 text-sm p-2 border"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Consultation / Progress Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Patient reports no headache, vision changes or bleeding. TSH report 2.1 mIU/L reviewed."
                  rows={2}
                  className="w-full rounded-lg border-slate-300 text-sm p-2 border"
                />
              </div>

              {/* Prescription Builder */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    ℞ Prescribed Medicines (E-Prescription)
                  </h4>
                  <span className="text-[11px] text-slate-500">NMC Specific List compliant</span>
                </div>

                {medicines.length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {medicines.map((m, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded bg-white border border-slate-200 text-xs"
                      >
                        <div>
                          <strong className="text-slate-800">{m.name}</strong> · {m.dosage} · {m.frequency} ·{' '}
                          {m.duration} ({m.instructions})
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMedicine(idx)}
                          className="text-red-500 hover:text-red-700 font-bold ml-2"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 bg-white p-2 rounded-lg border border-slate-200">
                  <input
                    type="text"
                    value={newMedName}
                    onChange={(e) => setNewMedName(e.target.value)}
                    placeholder="Medicine Name"
                    className="sm:col-span-2 text-xs p-1.5 border rounded"
                  />
                  <input
                    type="text"
                    value={newMedDosage}
                    onChange={(e) => setNewMedDosage(e.target.value)}
                    placeholder="Dosage (e.g. 50mcg)"
                    className="text-xs p-1.5 border rounded"
                  />
                  <input
                    type="text"
                    value={newMedFreq}
                    onChange={(e) => setNewMedFreq(e.target.value)}
                    placeholder="Freq (e.g. OD in morning)"
                    className="text-xs p-1.5 border rounded"
                  />
                  <button
                    type="button"
                    onClick={handleAddMedicine}
                    className="text-xs bg-slate-800 text-white rounded font-semibold py-1.5 hover:bg-slate-900"
                  >
                    + Add Med
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Advice & Instructions</label>
                <textarea
                  value={editAdvice}
                  onChange={(e) => setEditAdvice(e.target.value)}
                  placeholder="Take Thyroxine tablet empty stomach 30 mins before breakfast. Repeat TSH after 6 weeks."
                  rows={2}
                  className="w-full rounded-lg border-slate-300 text-sm p-2 border"
                />
              </div>

              {/* Digital Signature Hash Status */}
              {activeConsult.digital_signature_hash ? (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                    <span>🛡️ Cryptographically Signed & Locked</span>
                  </div>
                  <div>
                    Signed by: <strong>{activeConsult.signed_by_doctor_name}</strong> (Reg No:{' '}
                    {activeConsult.doctor_reg_number})
                  </div>
                  <div className="font-mono text-[11px] text-emerald-700 break-all">
                    SHA-256 Digest: {activeConsult.digital_signature_hash}
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  ⚠️ Draft Prescription. Click <strong>&quot;Digitally Sign & Lock&quot;</strong> to apply official cryptographic verification seal.
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
                <Link
                  to={`/teleconsultations/${activeConsult.id}/print`}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border"
                >
                  🖨️ Open Printable E-Prescription
                </Link>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveConsult}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-200 text-slate-800 hover:bg-slate-300"
                  >
                    Save Draft
                  </button>

                  <button
                    type="button"
                    onClick={handleSignPrescription}
                    disabled={signing}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:opacity-50"
                  >
                    {signing ? 'Signing...' : '✓ Digitally Sign & Lock'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
