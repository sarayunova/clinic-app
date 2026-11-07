import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type Patient,
  type SncuAdmission,
  type UserRow,
  getSncuAdmissions,
  createSncuAdmission,
  updateSncuAdmission,
  deleteSncuAdmission,
} from '../api';
import { useAuth, useMe } from '../auth';
import {
  calculateSilvermanScore,
  calculateDownesScore,
  calculateDailyFluidGoal,
  calculateWeightVelocity,
  type SilvermanScoreInput,
  type DownesScoreInput,
} from '../sncuEngine';

interface Props {
  patient: Patient;
}

export function SncuTracker({ patient }: Props) {
  const { can } = useAuth();
  const me = useMe();

  const [admissions, setAdmissions] = useState<SncuAdmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState<Partial<SncuAdmission>>({
    patientId: patient.id,
    admissionDatetime: new Date().toISOString().substring(0, 16),
    birthWeightG: 1850,
    gestationalAgeWeeks: 33,
    gestationalAgeDays: 4,
    admissionIndication: 'respiratory_distress',

    respiratorySupport: 'bubble_cpap',
    fio2Percent: 30,
    peepCmH2o: 5,
    flowRateLMin: 5,
    silvermanAndersonScore: 4,
    downesScore: 4,

    phototherapyStatus: 'none',
    kmcDurationHoursToday: 2.5,
    temperatureCelsius: 36.8,

    currentWeightG: 1810,
    totalFluidGoalMlKgDay: 95,
    feedingMode: 'og_tube_ebm',
    feedingVolumeMl: 15,
    feedingFrequencyHours: 2,
    ivFluidTypeRate: '10% Dextrose with 0.225% NS @ 4 mL/hr',
    dailyWeightGainGKgDay: -20,

    heartRateBpm: 142,
    respiratoryRateBpm: 64,
    spo2Percent: 94,
    capillaryBloodGlucoseMgDl: 68,
    antibioticRegimen: 'Inj Ampicillin 50mg/kg q12h + Inj Gentamicin 4mg/kg q24h',
    clinicalNotes:
      'Preterm 33+4 weeks LBW infant admitted for moderate respiratory distress syndrome. On Bubble CPAP with good bilateral air entry. Minimal subcostal retractions.',

    status: 'admitted',
    attendingPediatrician: 'Dr. Lingeshwar / Consultant Neonatologist',
    reviewedBy: me?.id || 1,
  });

  // Live Silverman & Downes inputs inside modal
  const [silvermanInputs, setSilvermanInputs] = useState<SilvermanScoreInput>({
    upperChestRetraction: 1,
    lowerChestRetraction: 1,
    xiphoidRetraction: 1,
    naresDilation: 1,
    expiratoryGrunt: 0,
  });

  const [downesInputs, setDownesInputs] = useState<DownesScoreInput>({
    respiratoryRateScore: 1,
    cyanosisScore: 0,
    airEntryScore: 1,
    gruntingScore: 1,
    retractionsScore: 1,
  });

  const [dayOfLife, setDayOfLife] = useState<number>(2);

  const loadAdmissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSncuAdmissions(patient.id);
      setAdmissions(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load SNCU records');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const u = await api<UserRow[]>('GET', '/api/users');
      setUsers(u);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadAdmissions();
    loadUsers();
  }, [patient.id]);

  // Real-time calculations
  const silvermanEval = calculateSilvermanScore(silvermanInputs);
  const downesEval = calculateDownesScore(downesInputs);
  const fluidGoalEval = calculateDailyFluidGoal(
    form.gestationalAgeWeeks || 34,
    dayOfLife,
    form.phototherapyStatus !== 'none',
  );
  const weightVelocityEval = calculateWeightVelocity(
    form.birthWeightG || 1850,
    form.currentWeightG || form.birthWeightG || 1850,
    dayOfLife,
  );

  const handleOpenNew = () => {
    setEditingId(null);
    setForm({
      patientId: patient.id,
      admissionDatetime: new Date().toISOString().substring(0, 16),
      birthWeightG: 1900,
      gestationalAgeWeeks: 34,
      gestationalAgeDays: 0,
      admissionIndication: 'respiratory_distress',
      respiratorySupport: 'bubble_cpap',
      fio2Percent: 30,
      peepCmH2o: 5,
      flowRateLMin: 5,
      silvermanAndersonScore: 4,
      downesScore: 4,
      phototherapyStatus: 'none',
      kmcDurationHoursToday: 2,
      temperatureCelsius: 36.8,
      currentWeightG: 1860,
      totalFluidGoalMlKgDay: 95,
      feedingMode: 'og_tube_ebm',
      feedingVolumeMl: 15,
      feedingFrequencyHours: 2,
      ivFluidTypeRate: '10% Dextrose with electrolytes @ 4.5 mL/hr',
      dailyWeightGainGKgDay: -20,
      heartRateBpm: 144,
      respiratoryRateBpm: 62,
      spo2Percent: 93,
      capillaryBloodGlucoseMgDl: 70,
      antibioticRegimen: 'Inj Ampicillin + Inj Gentamicin Day 2',
      clinicalNotes: '',
      status: 'admitted',
      attendingPediatrician: 'Consultant Neonatologist',
      reviewedBy: me?.id || 1,
    });
    setSilvermanInputs({
      upperChestRetraction: 1,
      lowerChestRetraction: 1,
      xiphoidRetraction: 1,
      naresDilation: 1,
      expiratoryGrunt: 0,
    });
    setDownesInputs({
      respiratoryRateScore: 1,
      cyanosisScore: 0,
      airEntryScore: 1,
      gruntingScore: 1,
      retractionsScore: 1,
    });
    setDayOfLife(2);
    setShowModal(true);
  };

  const handleOpenEdit = (adm: SncuAdmission) => {
    setEditingId(adm.id);
    setForm({
      ...adm,
      admissionDatetime: adm.admissionDatetime ? adm.admissionDatetime.substring(0, 16) : '',
      dischargeDatetime: adm.dischargeDatetime ? adm.dischargeDatetime.substring(0, 16) : undefined,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this SNCU admission record?')) return;
    try {
      await deleteSncuAdmission(id);
      loadAdmissions();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete SNCU record');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      const payload = {
        ...form,
        silvermanAndersonScore: silvermanEval.score,
        downesScore: downesEval.score,
        totalFluidGoalMlKgDay: form.totalFluidGoalMlKgDay || fluidGoalEval.recommendedMlKgDay,
        dailyWeightGainGKgDay: weightVelocityEval.velocityGPerDay,
      };

      if (editingId) {
        await updateSncuAdmission(editingId, payload);
      } else {
        await createSncuAdmission(payload);
      }

      setShowModal(false);
      loadAdmissions();
    } catch (err: any) {
      setError(err?.message || 'Failed to save SNCU admission');
    } finally {
      setSaving(false);
    }
  };

  const canWrite = can('patient:write_clinical') || can('care:write_nursing');
  const canDelete = can('patient:write_clinical') || can('user:manage');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-sky-700 to-indigo-800 text-white p-6 rounded-xl shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">👶</span>
              <h2 className="text-2xl font-bold tracking-tight">
                Special Newborn Care Unit (SNCU / Level-2 NICU)
              </h2>
            </div>
            <p className="text-blue-100 mt-1 max-w-2xl text-sm leading-relaxed">
              High-risk neonatal inpatient admission &amp; acuity surveillance. Automated
              Silverman-Anderson &amp; Downes respiratory distress scoring, CPAP flowsheet,
              gestational fluid &amp; caloric requirements, and Kangaroo Mother Care (KMC) logger.
            </p>
          </div>
          {canWrite && (
            <button
              onClick={handleOpenNew}
              className="bg-white text-blue-900 font-semibold px-4 py-2.5 rounded-lg shadow hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              <span>+</span>
              <span>New SNCU Admission / Round</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading SNCU clinical records...</div>
      ) : admissions.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-gray-200 text-center text-gray-500 space-y-3">
          <div className="text-4xl">🏥</div>
          <p className="font-medium text-gray-700">No SNCU inpatient records on file for this infant.</p>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Click &quot;New SNCU Admission / Round&quot; above to log an admission, calculate respiratory distress
            indices, CPAP flow rates, and daily fluid goals.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {admissions.map((adm) => {
            const isAdmitted = adm.status === 'admitted';
            return (
              <div
                key={adm.id}
                className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${
                  isAdmitted ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'
                }`}
              >
                {/* Card Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                        adm.status === 'admitted'
                          ? 'bg-blue-100 text-blue-800'
                          : adm.status === 'discharged_to_mother' || adm.status === 'discharged_home'
                            ? 'bg-green-100 text-green-800'
                            : adm.status === 'transferred_tertiary_nicu'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {adm.status.replace(/_/g, ' ')}
                    </span>
                    <span className="font-semibold text-gray-800 text-base">
                      Admitted: {adm.admissionDatetime?.replace('T', ' ')}
                    </span>
                    <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">
                      Indication: {adm.admissionIndication.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/patients/${patient.id}/sncu/${adm.id}/print`}
                      className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded border border-gray-300 flex items-center gap-1.5 transition-colors"
                      target="_blank"
                    >
                      <span>🖨️</span>
                      <span>Print Round Sheet</span>
                    </Link>

                    {canWrite && (
                      <button
                        onClick={() => handleOpenEdit(adm)}
                        className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded border border-blue-200 transition-colors"
                      >
                        Edit
                      </button>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => handleDelete(adm.id)}
                        className="text-xs px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded border border-red-200 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Body Grid */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Gestational & Weight Profile */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <span>⚖️</span>
                      <span>Gestation &amp; Weights</span>
                    </h4>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Gestational Age:</span>
                        <span className="font-medium text-gray-800">
                          {adm.gestationalAgeWeeks}w {adm.gestationalAgeDays}d
                          {adm.gestationalAgeWeeks < 37 ? ' (Preterm)' : ' (Term)'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Birth Weight:</span>
                        <span className="font-semibold text-gray-900">{adm.birthWeightG} g</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Current Weight:</span>
                        <span className="font-semibold text-blue-700">
                          {adm.currentWeightG ? `${adm.currentWeightG} g` : 'Not recorded'}
                        </span>
                      </div>
                      {adm.currentWeightG && (
                        <div className="flex justify-between text-xs pt-1 border-t border-slate-200">
                          <span className="text-gray-500">Weight Velocity:</span>
                          <span
                            className={`font-semibold ${
                              (adm.currentWeightG - adm.birthWeightG) / adm.birthWeightG < -0.1
                                ? 'text-amber-600'
                                : 'text-gray-700'
                            }`}
                          >
                            {Math.round(((adm.currentWeightG - adm.birthWeightG) / adm.birthWeightG) * 1000) / 10}%
                            ({adm.currentWeightG - adm.birthWeightG} g)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Respiratory Support & Distress Scores */}
                  <div className="bg-sky-50 p-4 rounded-lg border border-sky-200 space-y-2.5">
                    <h4 className="text-xs font-bold text-sky-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🫁</span>
                      <span>Respiratory &amp; CPAP Support</span>
                    </h4>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Support Mode:</span>
                        <span className="font-semibold text-sky-900 uppercase">
                          {adm.respiratorySupport.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">FiO2 / PEEP / Flow:</span>
                        <span className="font-medium text-gray-800">
                          {adm.fio2Percent || 21}% / {adm.peepCmH2o || 0} cmH2O / {adm.flowRateLMin || 0} L/m
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-sky-200">
                        <span className="text-gray-600 text-xs">Silverman Score:</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            (adm.silvermanAndersonScore || 0) > 6
                              ? 'bg-red-100 text-red-800'
                              : (adm.silvermanAndersonScore || 0) > 3
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {adm.silvermanAndersonScore ?? 'N/A'} / 10
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 text-xs">Downes Score:</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            (adm.downesScore || 0) > 7
                              ? 'bg-red-100 text-red-800'
                              : (adm.downesScore || 0) > 3
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {adm.downesScore ?? 'N/A'} / 10
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fluids, Phototherapy & Nutrition */}
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 space-y-2.5">
                    <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🍼</span>
                      <span>Fluids, Feeding &amp; KMC</span>
                    </h4>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Fluid Goal:</span>
                        <span className="font-semibold text-amber-900">
                          {adm.totalFluidGoalMlKgDay || '—'} mL/kg/day
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Feeding Mode:</span>
                        <span className="font-medium text-gray-800">
                          {adm.feedingMode.replace(/_/g, ' ')}
                          {adm.feedingVolumeMl ? ` (${adm.feedingVolumeMl} mL q${adm.feedingFrequencyHours}h)` : ''}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Phototherapy:</span>
                        <span className="font-medium text-gray-800">
                          {adm.phototherapyStatus.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs pt-1 border-t border-amber-200">
                        <span className="text-gray-600">KMC Duration Today:</span>
                        <span className="font-bold text-amber-800">
                          {adm.kmcDurationHoursToday || 0} Hours
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vitals Bar & Clinical Notes */}
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-600">
                  <div className="flex flex-wrap items-center gap-4">
                    <span>
                      <strong>HR:</strong> {adm.heartRateBpm ? `${adm.heartRateBpm} bpm` : '—'}
                    </span>
                    <span>
                      <strong>RR:</strong> {adm.respiratoryRateBpm ? `${adm.respiratoryRateBpm} /min` : '—'}
                    </span>
                    <span>
                      <strong>SpO2:</strong> {adm.spo2Percent ? `${adm.spo2Percent}%` : '—'}
                    </span>
                    <span>
                      <strong>Temp:</strong> {adm.temperatureCelsius ? `${adm.temperatureCelsius} °C` : '—'}
                    </span>
                    <span>
                      <strong>CBG:</strong> {adm.capillaryBloodGlucoseMgDl ? `${adm.capillaryBloodGlucoseMgDl} mg/dL` : '—'}
                    </span>
                  </div>

                  <div className="text-gray-500">
                    Pediatrician: <strong>{adm.attendingPediatrician || 'On Duty'}</strong>
                  </div>
                </div>

                {adm.clinicalNotes && (
                  <div className="px-6 py-3 border-t border-gray-100 bg-white text-xs text-gray-700 italic">
                    &quot;{adm.clinicalNotes}&quot;
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: New / Edit Admission Round */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="sticky top-0 bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center z-10">
              <h3 className="font-bold text-lg">
                {editingId ? 'Edit SNCU Clinical Round / Admission' : 'New SNCU Inpatient Admission & Round'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-gray-200 text-2xl font-bold p-1 leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
              {/* Section 1: Admission & Gestation */}
              <div className="border border-gray-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>👶</span>
                  <span>1. Infant Gestational &amp; Admission Metrics</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Admission Date &amp; Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={form.admissionDatetime || ''}
                      onChange={(e) => setForm({ ...form, admissionDatetime: e.target.value })}
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Day of Life (DOL)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={dayOfLife}
                      onChange={(e) => setDayOfLife(Number(e.target.value) || 1)}
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Gestational Age (Weeks)
                    </label>
                    <input
                      type="number"
                      min={22}
                      max={45}
                      required
                      value={form.gestationalAgeWeeks ?? ''}
                      onChange={(e) =>
                        setForm({ ...form, gestationalAgeWeeks: Number(e.target.value) })
                      }
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Gestational Days (0-6)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={6}
                      value={form.gestationalAgeDays ?? 0}
                      onChange={(e) =>
                        setForm({ ...form, gestationalAgeDays: Number(e.target.value) })
                      }
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Birth Weight (grams)
                    </label>
                    <input
                      type="number"
                      min={300}
                      max={8000}
                      required
                      value={form.birthWeightG ?? ''}
                      onChange={(e) => setForm({ ...form, birthWeightG: Number(e.target.value) })}
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Current Weight (grams)
                    </label>
                    <input
                      type="number"
                      min={300}
                      max={8000}
                      value={form.currentWeightG ?? ''}
                      onChange={(e) =>
                        setForm({ ...form, currentWeightG: Number(e.target.value) || undefined })
                      }
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Primary Admission Indication
                    </label>
                    <select
                      value={form.admissionIndication || 'respiratory_distress'}
                      onChange={(e) => setForm({ ...form, admissionIndication: e.target.value as any })}
                      className="w-full text-xs p-2 border rounded-md"
                    >
                      <option value="respiratory_distress">Respiratory Distress (RDS / TTN)</option>
                      <option value="prematurity_lbw">Prematurity &amp; Low Birth Weight (LBW)</option>
                      <option value="neonatal_sepsis">Suspected / Proven Neonatal Sepsis</option>
                      <option value="hyperbilirubinemia_severe">Severe Hyperbilirubinemia (Phototherapy)</option>
                      <option value="hypoglycemia">Neonatal Hypoglycemia / IDM</option>
                      <option value="perinatal_asphyxia">Perinatal Asphyxia / HIE</option>
                      <option value="feeding_difficulty">Feeding Intolerance / Poor Suck</option>
                      <option value="congenital_anomaly">Congenital Malformation</option>
                      <option value="other">Other Clinical Neonatal Condition</option>
                    </select>
                  </div>
                </div>

                {/* Weight Velocity Pill */}
                {weightVelocityEval.percentageChangeFromBirth !== 0 && (
                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-center justify-between ${
                      weightVelocityEval.weightLossExceedsThreshold
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-blue-50 text-blue-900 border border-blue-200'
                    }`}
                  >
                    <span>
                      <strong>Weight Trend:</strong> {weightVelocityEval.summary}
                    </span>
                    <span className="font-bold">
                      {weightVelocityEval.percentageChangeFromBirth > 0 ? '+' : ''}
                      {weightVelocityEval.percentageChangeFromBirth}%
                    </span>
                  </div>
                )}
              </div>

              {/* Section 2: Respiratory Distress & Silverman-Anderson / Downes Calculators */}
              <div className="border border-sky-200 rounded-xl p-4 bg-sky-50/40 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🫁</span>
                    <span>2. Respiratory Support &amp; Distress Scores</span>
                  </h4>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold bg-white px-2.5 py-1 rounded border border-sky-300 text-sky-900 shadow-sm">
                      Silverman: {silvermanEval.score}/10 ({silvermanEval.severity.replace(/_/g, ' ')})
                    </span>
                    <span className="text-xs font-bold bg-white px-2.5 py-1 rounded border border-sky-300 text-sky-900 shadow-sm">
                      Downes: {downesEval.score}/10 ({downesEval.severity})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Respiratory Support Mode
                    </label>
                    <select
                      value={form.respiratorySupport || 'room_air'}
                      onChange={(e) => setForm({ ...form, respiratorySupport: e.target.value as any })}
                      className="w-full text-xs p-2 border rounded-md"
                    >
                      <option value="room_air">Room Air (Spontaneous)</option>
                      <option value="low_flow_nasal_prongs">Low Flow Nasal Prongs O2</option>
                      <option value="bubble_cpap">Bubble CPAP</option>
                      <option value="high_flow_nasal_cannula">High Flow Nasal Cannula (HFNC)</option>
                      <option value="mechanical_ventilation">Invasive Mechanical Ventilation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      FiO2 (%)
                    </label>
                    <input
                      type="number"
                      min={21}
                      max={100}
                      value={form.fio2Percent ?? 21}
                      onChange={(e) => setForm({ ...form, fio2Percent: Number(e.target.value) })}
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      PEEP (cm H2O)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={15}
                      step={0.5}
                      value={form.peepCmH2o ?? 5}
                      onChange={(e) => setForm({ ...form, peepCmH2o: Number(e.target.value) })}
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Flow Rate (L/min)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={15}
                      step={0.5}
                      value={form.flowRateLMin ?? 5}
                      onChange={(e) => setForm({ ...form, flowRateLMin: Number(e.target.value) })}
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>
                </div>

                {/* Silverman-Anderson 5 parameters */}
                <div className="bg-white p-3 rounded-lg border border-sky-200 space-y-2">
                  <div className="text-xs font-semibold text-sky-800">
                    Silverman-Anderson Distress Grid (0 = Normal, 1 = Moderate, 2 = Severe):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                    <div>
                      <span className="block text-gray-600 mb-1">Upper Chest:</span>
                      <select
                        value={silvermanInputs.upperChestRetraction}
                        onChange={(e) =>
                          setSilvermanInputs({
                            ...silvermanInputs,
                            upperChestRetraction: Number(e.target.value) as any,
                          })
                        }
                        className="w-full p-1.5 border rounded text-xs"
                      >
                        <option value={0}>0: Synchronized</option>
                        <option value={1}>1: Lag on inspiration</option>
                        <option value={2}>2: See-saw breathing</option>
                      </select>
                    </div>

                    <div>
                      <span className="block text-gray-600 mb-1">Lower Chest:</span>
                      <select
                        value={silvermanInputs.lowerChestRetraction}
                        onChange={(e) =>
                          setSilvermanInputs({
                            ...silvermanInputs,
                            lowerChestRetraction: Number(e.target.value) as any,
                          })
                        }
                        className="w-full p-1.5 border rounded text-xs"
                      >
                        <option value={0}>0: None</option>
                        <option value={1}>1: Just visible</option>
                        <option value={2}>2: Marked</option>
                      </select>
                    </div>

                    <div>
                      <span className="block text-gray-600 mb-1">Xiphoid Retraction:</span>
                      <select
                        value={silvermanInputs.xiphoidRetraction}
                        onChange={(e) =>
                          setSilvermanInputs({
                            ...silvermanInputs,
                            xiphoidRetraction: Number(e.target.value) as any,
                          })
                        }
                        className="w-full p-1.5 border rounded text-xs"
                      >
                        <option value={0}>0: None</option>
                        <option value={1}>1: Just visible</option>
                        <option value={2}>2: Marked</option>
                      </select>
                    </div>

                    <div>
                      <span className="block text-gray-600 mb-1">Nares Dilation:</span>
                      <select
                        value={silvermanInputs.naresDilation}
                        onChange={(e) =>
                          setSilvermanInputs({
                            ...silvermanInputs,
                            naresDilation: Number(e.target.value) as any,
                          })
                        }
                        className="w-full p-1.5 border rounded text-xs"
                      >
                        <option value={0}>0: None</option>
                        <option value={1}>1: Minimal flaring</option>
                        <option value={2}>2: Marked flaring</option>
                      </select>
                    </div>

                    <div>
                      <span className="block text-gray-600 mb-1">Expiratory Grunt:</span>
                      <select
                        value={silvermanInputs.expiratoryGrunt}
                        onChange={(e) =>
                          setSilvermanInputs({
                            ...silvermanInputs,
                            expiratoryGrunt: Number(e.target.value) as any,
                          })
                        }
                        className="w-full p-1.5 border rounded text-xs"
                      >
                        <option value={0}>0: None</option>
                        <option value={1}>1: Stethoscope only</option>
                        <option value={2}>2: Naked ear</option>
                      </select>
                    </div>
                  </div>

                  <div className="text-xs text-sky-800 bg-sky-50 p-2 rounded border border-sky-100">
                    💡 <strong>Clinical Guidance:</strong> {silvermanEval.respiratoryRecommendation}
                  </div>
                </div>
              </div>

              {/* Section 3: Fluids, Nutrition, Phototherapy & KMC */}
              <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/40 space-y-4">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🍼</span>
                  <span>3. Fluid Goal, Nutrition, Phototherapy &amp; Thermoregulation</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Fluid Target (mL/kg/day)
                    </label>
                    <input
                      type="number"
                      min={40}
                      max={220}
                      value={form.totalFluidGoalMlKgDay ?? fluidGoalEval.recommendedMlKgDay}
                      onChange={(e) =>
                        setForm({ ...form, totalFluidGoalMlKgDay: Number(e.target.value) })
                      }
                      className="w-full text-xs p-2 border rounded-md"
                    />
                    <span className="text-[10px] text-gray-500">
                      Standard: {fluidGoalEval.recommendedMlKgDay} mL/kg/d ({fluidGoalEval.scheduleBasis})
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Feeding Mode
                    </label>
                    <select
                      value={form.feedingMode || 'og_tube_ebm'}
                      onChange={(e) => setForm({ ...form, feedingMode: e.target.value as any })}
                      className="w-full text-xs p-2 border rounded-md"
                    >
                      <option value="npo_iv_fluids">NPO (Total IV Fluids)</option>
                      <option value="og_tube_ebm">OG / NG Tube (Expressed Breast Milk)</option>
                      <option value="paladai_ebm">Paladai / Cup EBM</option>
                      <option value="direct_breastfeeding">Direct Breastfeeding</option>
                      <option value="formula">Preterm Infant Formula</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Feed Vol (mL) / Frequency
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="mL"
                        value={form.feedingVolumeMl ?? ''}
                        onChange={(e) =>
                          setForm({ ...form, feedingVolumeMl: Number(e.target.value) || undefined })
                        }
                        className="w-1/2 text-xs p-2 border rounded-md"
                      />
                      <select
                        value={form.feedingFrequencyHours || 2}
                        onChange={(e) =>
                          setForm({ ...form, feedingFrequencyHours: Number(e.target.value) })
                        }
                        className="w-1/2 text-xs p-2 border rounded-md"
                      >
                        <option value={1}>q1h</option>
                        <option value={2}>q2h</option>
                        <option value={3}>q3h</option>
                        <option value={4}>q4h</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Phototherapy Status
                    </label>
                    <select
                      value={form.phototherapyStatus || 'none'}
                      onChange={(e) => setForm({ ...form, phototherapyStatus: e.target.value as any })}
                      className="w-full text-xs p-2 border rounded-md"
                    >
                      <option value="none">None (No Phototherapy)</option>
                      <option value="single_surface_led">Single Surface LED</option>
                      <option value="double_surface_led">Double Surface LED</option>
                      <option value="biliblanket">BiliBlanket / Fiberoptic</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      KMC Duration Today (Hours)
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={24}
                      value={form.kmcDurationHoursToday ?? 0}
                      onChange={(e) =>
                        setForm({ ...form, kmcDurationHoursToday: Number(e.target.value) })
                      }
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Temperature (°C)
                    </label>
                    <input
                      type="number"
                      step={0.1}
                      min={32}
                      max={42}
                      value={form.temperatureCelsius ?? 36.8}
                      onChange={(e) =>
                        setForm({ ...form, temperatureCelsius: Number(e.target.value) })
                      }
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      IV Fluid Infusion Regimen
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 10% Dextrose with 0.225% NS @ 3.5 mL/hr"
                      value={form.ivFluidTypeRate || ''}
                      onChange={(e) => setForm({ ...form, ivFluidTypeRate: e.target.value })}
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Vitals, Antibiotics & Status */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-4">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🩺</span>
                  <span>4. Vitals, Antibiotics &amp; Clinical Progress</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Heart Rate (bpm)
                    </label>
                    <input
                      type="number"
                      value={form.heartRateBpm ?? ''}
                      onChange={(e) =>
                        setForm({ ...form, heartRateBpm: Number(e.target.value) || undefined })
                      }
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Resp Rate (/min)
                    </label>
                    <input
                      type="number"
                      value={form.respiratoryRateBpm ?? ''}
                      onChange={(e) =>
                        setForm({ ...form, respiratoryRateBpm: Number(e.target.value) || undefined })
                      }
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      SpO2 Target %
                    </label>
                    <input
                      type="number"
                      value={form.spo2Percent ?? ''}
                      onChange={(e) =>
                        setForm({ ...form, spo2Percent: Number(e.target.value) || undefined })
                      }
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      CBG Glucose (mg/dL)
                    </label>
                    <input
                      type="number"
                      value={form.capillaryBloodGlucoseMgDl ?? ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          capillaryBloodGlucoseMgDl: Number(e.target.value) || undefined,
                        })
                      }
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Antibiotic &amp; Medication Regimen
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Inj Ampicillin + Inj Gentamicin"
                      value={form.antibioticRegimen || ''}
                      onChange={(e) => setForm({ ...form, antibioticRegimen: e.target.value })}
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Inpatient Status
                    </label>
                    <select
                      value={form.status || 'admitted'}
                      onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                      className="w-full text-xs p-2 border rounded-md"
                    >
                      <option value="admitted">Admitted in SNCU</option>
                      <option value="transferred_tertiary_nicu">Transferred to Tertiary NICU</option>
                      <option value="discharged_to_mother">Discharged to Mother (PNC Ward)</option>
                      <option value="discharged_home">Discharged Home</option>
                      <option value="deceased">Deceased</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Attending Pediatrician
                    </label>
                    <input
                      type="text"
                      value={form.attendingPediatrician || ''}
                      onChange={(e) => setForm({ ...form, attendingPediatrician: e.target.value })}
                      className="w-full text-xs p-2 border rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Clinical Notes &amp; Round Directives
                  </label>
                  <textarea
                    rows={2}
                    value={form.clinicalNotes || ''}
                    onChange={(e) => setForm({ ...form, clinicalNotes: e.target.value })}
                    className="w-full text-xs p-2 border rounded-md"
                    placeholder="Document clinical evolution, feeding tolerance, surfactant response, or next step orders..."
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg shadow"
                >
                  {saving ? 'Saving...' : editingId ? 'Update SNCU Record' : 'Save SNCU Admission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
