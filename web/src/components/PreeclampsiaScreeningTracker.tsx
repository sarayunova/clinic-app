import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, type Patient, type PreeclampsiaScreeningRecord } from '../api';
import { useAuth, useMe } from '../auth';
import {
  calculatePreeclampsiaScreening,
  calculateMap,
  type PreeclampsiaScreeningResult,
  type Ethnicity,
  type ParityStatus,
  type ConceptionMethod,
  type SmokingStatus,
} from '../preeclampsiaEngine';

interface Props {
  patient: Patient;
}

export function PreeclampsiaScreeningTracker({ patient }: Props) {
  const { can } = useAuth();
  const me = useMe();

  const [screenings, setScreenings] = useState<PreeclampsiaScreeningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Compute default GA from LMP (11w to 14w if applicable)
  const computeDefaultGa = (): { weeks: number; days: number } => {
    if (!patient.lastMenstrualPeriod || typeof patient.lastMenstrualPeriod !== 'string') {
      return { weeks: 12, days: 2 };
    }
    const lmp = new Date(patient.lastMenstrualPeriod);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lmp.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 70 && diffDays <= 110) {
      return { weeks: Math.floor(diffDays / 7), days: diffDays % 7 };
    }
    return { weeks: 12, days: 2 };
  };

  const initialForm = (): Partial<PreeclampsiaScreeningRecord> => {
    const ga = computeDefaultGa();
    let age = 28;
    if (patient.dateOfBirth && typeof patient.dateOfBirth === 'string') {
      const birth = new Date(patient.dateOfBirth);
      const diffYears = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 3600 * 1000));
      if (diffYears > 15 && diffYears < 60) age = diffYears;
    }

    return {
      patientId: patient.id,
      assessmentDate: new Date().toISOString().substring(0, 10),
      assessmentTime: new Date().toTimeString().substring(0, 5),
      gestationalAgeWeeks: ga.weeks,
      gestationalAgeDays: ga.days,
      crlMm: 60.0,

      maternalAge: age,
      maternalWeightKg: 62.0,
      maternalHeightCm: 160.0,
      bmi: 24.2,
      ethnicity: 'south_asian',
      parity: 'nulliparous',
      priorPeOnsetGestation: null,
      conceptionMethod: 'spontaneous',
      smokingStatus: 'non_smoker',
      familyHistoryPe: false,
      chronicHypertension: false,
      pregestationalDiabetes: false,
      systemicLupusOrAps: false,
      chronicKidneyDisease: false,
      interpregnancyIntervalYears: null,

      sbpRight: 116,
      dbpRight: 74,
      sbpLeft: 114,
      dbpLeft: 72,
      meanArterialPressure: 88.0,

      utaPiLeft: 1.55,
      utaPiRight: 1.65,
      utaPiMean: 1.60,
      utaBilateralNotching: false,

      serumPlgfPgMl: 38.0,
      serumPappaIuL: 1.0,

      clinicalNotes: 'First trimester combined screening per FMF / FIGO 2019 guidelines.',
      performedBy: me.fullName || 'Attending Obstetrician',
    };
  };

  const [form, setForm] = useState<Partial<PreeclampsiaScreeningRecord>>(initialForm());

  const loadScreenings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<PreeclampsiaScreeningRecord[]>(
        'GET',
        `/api/patients/${patient.id}/preeclampsia`,
      );
      setScreenings(res || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pre-eclampsia screenings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScreenings();
  }, [patient.id]);

  // Recalculate BMI when weight/height changes
  useEffect(() => {
    if (form.maternalWeightKg && form.maternalHeightCm) {
      const hM = form.maternalHeightCm / 100.0;
      const b = Math.round((form.maternalWeightKg / (hM * hM)) * 10) / 10;
      setForm((prev) => ({ ...prev, bmi: b }));
    }
  }, [form.maternalWeightKg, form.maternalHeightCm]);

  // Recalculate MAP when blood pressure values change
  useEffect(() => {
    if (form.sbpRight && form.dbpRight) {
      const calculatedMap = calculateMap(
        form.sbpRight,
        form.dbpRight,
        form.sbpLeft ?? undefined,
        form.dbpLeft ?? undefined,
      );
      setForm((prev) => ({ ...prev, meanArterialPressure: calculatedMap }));
    }
  }, [form.sbpRight, form.dbpRight, form.sbpLeft, form.dbpLeft]);

  // Recalculate Mean UtA PI when left/right changes
  useEffect(() => {
    if (form.utaPiLeft && form.utaPiRight) {
      const mean = Math.round(((form.utaPiLeft + form.utaPiRight) / 2.0) * 100) / 100;
      setForm((prev) => ({ ...prev, utaPiMean: mean }));
    }
  }, [form.utaPiLeft, form.utaPiRight]);

  // Live real-time calculations
  let liveCalc: PreeclampsiaScreeningResult | null = null;
  if (form.gestationalAgeWeeks && form.maternalAge && form.meanArterialPressure) {
    liveCalc = calculatePreeclampsiaScreening({
      gestationalAgeWeeks: Number(form.gestationalAgeWeeks),
      gestationalAgeDays: Number(form.gestationalAgeDays) || 0,
      crlMm: form.crlMm ? Number(form.crlMm) : undefined,
      maternalAge: Number(form.maternalAge),
      maternalWeightKg: form.maternalWeightKg ? Number(form.maternalWeightKg) : undefined,
      maternalHeightCm: form.maternalHeightCm ? Number(form.maternalHeightCm) : undefined,
      bmi: form.bmi ? Number(form.bmi) : undefined,
      ethnicity: (form.ethnicity as Ethnicity) || 'south_asian',
      parity: (form.parity as ParityStatus) || 'nulliparous',
      priorPeOnsetGestation: form.priorPeOnsetGestation || undefined,
      conceptionMethod: (form.conceptionMethod as ConceptionMethod) || 'spontaneous',
      smokingStatus: (form.smokingStatus as SmokingStatus) || 'non_smoker',
      familyHistoryPe: Boolean(form.familyHistoryPe),
      chronicHypertension: Boolean(form.chronicHypertension),
      pregestationalDiabetes: Boolean(form.pregestationalDiabetes),
      systemicLupusOrAps: Boolean(form.systemicLupusOrAps),
      chronicKidneyDisease: Boolean(form.chronicKidneyDisease),
      interpregnancyIntervalYears: form.interpregnancyIntervalYears ? Number(form.interpregnancyIntervalYears) : undefined,
      sbpRight: form.sbpRight ? Number(form.sbpRight) : undefined,
      dbpRight: form.dbpRight ? Number(form.dbpRight) : undefined,
      sbpLeft: form.sbpLeft ? Number(form.sbpLeft) : undefined,
      dbpLeft: form.dbpLeft ? Number(form.dbpLeft) : undefined,
      meanArterialPressure: Number(form.meanArterialPressure),
      utaPiLeft: form.utaPiLeft ? Number(form.utaPiLeft) : undefined,
      utaPiRight: form.utaPiRight ? Number(form.utaPiRight) : undefined,
      utaPiMean: form.utaPiMean ? Number(form.utaPiMean) : undefined,
      utaBilateralNotching: Boolean(form.utaBilateralNotching),
      serumPlgfPgMl: form.serumPlgfPgMl ? Number(form.serumPlgfPgMl) : undefined,
      serumPappaIuL: form.serumPappaIuL ? Number(form.serumPappaIuL) : undefined,
    });
  }

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(initialForm());
    setShowModal(true);
  };

  const handleOpenEdit = (rec: PreeclampsiaScreeningRecord) => {
    setEditingId(rec.id);
    setForm({ ...rec });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await api('PUT', `/api/preeclampsia/${editingId}`, form);
      } else {
        await api('POST', '/api/preeclampsia', form);
      }
      setShowModal(false);
      await loadScreenings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pre-eclampsia screening');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this pre-eclampsia screening record?')) return;
    try {
      await api('DELETE', `/api/preeclampsia/${id}`);
      await loadScreenings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete screening record');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🩺</span>
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Pre-eclampsia First-Trimester Screening (FMF Triad) & Aspirin Prophylaxis
                </h2>
                <p className="text-sm text-slate-500">
                  ASPRE Protocol: Combined 11–13⁺⁶ weeks screening using Maternal Risk Factors, Mean Arterial Pressure (MAP),
                  Mean Uterine Artery PI, and Serum PlGF to prevent preterm pre-eclampsia (&lt;37 weeks)
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {(can('patient:write_clinical') || can('care:write_nursing')) && (
              <button
                onClick={handleOpenCreate}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition"
              >
                <span>➕</span> Record 1st Trimester PE Screen
              </button>
            )}
          </div>
        </div>

        {/* Clinical Evidence Box */}
        <div className="mt-4 p-4 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <span className="font-semibold block">🎯 Timing is Critical:</span>
            Screening window is strictly 11⁺⁰ to 13⁺⁶ weeks (CRL 45–84 mm).
          </div>
          <div>
            <span className="font-semibold block">💊 Aspirin 150 mg Nightly:</span>
            Initiation before 16⁺⁰ weeks reduces preterm pre-eclampsia by 62% and early PE (&lt;34w) by 82% (ASPRE Trial).
          </div>
          <div>
            <span className="font-semibold block">⚖️ Cut-off Criteria:</span>
            High-risk threshold is $\ge 1:100$ or $\ge 1$ NICE high-risk factor ($\ge 2$ moderate factors).
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-800 font-bold">✕</button>
        </div>
      )}

      {/* Screenings Timeline / List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-semibold text-slate-800">
            Recorded Pre-eclampsia Screenings ({screenings.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading screening records...</div>
        ) : screenings.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-slate-600 font-medium">No pre-eclampsia screenings recorded yet.</p>
            <p className="text-slate-400 text-sm mt-1">
              Screening at 11–13⁺⁶ weeks allows timely initiation of Aspirin 150 mg before 16 weeks.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {screenings.map((rec) => {
              const isHighRisk = rec.overallRiskTier === 'high_risk';
              return (
                <div key={rec.id} className="p-6 hover:bg-slate-50/60 transition">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-bold text-slate-900">
                          {rec.assessmentDate}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          GA: {rec.gestationalAgeWeeks}w {rec.gestationalAgeDays}d
                        </span>
                        {rec.crlMm && (
                          <span className="text-xs text-slate-500 font-medium">
                            CRL: {rec.crlMm} mm
                          </span>
                        )}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            isHighRisk
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {isHighRisk ? '🚨 High Risk (Aspirin Indicated)' : '✅ Low Risk (< 1:100)'}
                        </span>
                      </div>

                      {/* Metrics Badges */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                        <div>
                          <span className="text-slate-400 block">FMF Preterm PE Risk</span>
                          <span className={`font-bold text-sm ${isHighRisk ? 'text-red-700' : 'text-slate-800'}`}>
                            {rec.fmfRiskRatio}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Mean Arterial Pressure</span>
                          <span className="font-semibold text-slate-800">
                            {rec.meanArterialPressure.toFixed(1)} mmHg ({rec.mapMom.toFixed(2)} MoM)
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Mean UtA PI</span>
                          <span className="font-semibold text-slate-800">
                            {rec.utaPiMean.toFixed(2)} ({rec.utaPiMom.toFixed(2)} MoM)
                            {rec.utaBilateralNotching ? ' • Bilat Notch' : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Serum PlGF</span>
                          <span className="font-semibold text-slate-800">
                            {rec.plgfMom ? `${rec.plgfMom.toFixed(2)} MoM` : (rec.serumPlgfPgMl ? `${rec.serumPlgfPgMl} pg/mL` : 'Not tested')}
                          </span>
                        </div>
                      </div>

                      {/* Aspirin Prophylaxis Box */}
                      {rec.aspirinIndicated ? (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-1">
                          <div className="flex items-center gap-2 text-rose-800 font-bold">
                            <span>💊</span> ASPIRIN PROPHYLAXIS PRESCRIBED: {rec.aspirinDoseMg} mg PO nightly at bedtime
                          </div>
                          <p className="text-rose-700">{rec.aspirinTimingRationale}</p>
                          <p className="text-rose-900 font-medium">
                            • Calcium: {rec.calciumDoseMg} mg/day elemental calcium | Surveillance: {rec.surveillanceInterval}
                          </p>
                          <p className="text-rose-600">
                            • Next milestone: {rec.repeatScanWeeks}
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                          <span className="font-semibold">Standard Care:</span> Routine antenatal surveillance, healthy lifestyle advice, standard calcium/iron supplementation.
                        </div>
                      )}

                      {rec.clinicalNotes && (
                        <p className="text-xs text-slate-600 italic">
                          Notes: {rec.clinicalNotes}
                        </p>
                      )}

                      <div className="text-[11px] text-slate-400">
                        Performed by: {rec.performedBy || 'Clinician'} • Reviewed by: {rec.reviewedByName || 'Doctor'}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-start">
                      <Link
                        to={`/patients/${patient.id}/preeclampsia/${rec.id}/print`}
                        target="_blank"
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <span>🖨️</span> Print Report
                      </Link>

                      {(can('patient:write_clinical') || can('care:write_nursing')) && (
                        <button
                          onClick={() => handleOpenEdit(rec)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition"
                        >
                          Edit
                        </button>
                      )}

                      {(can('user:manage') || can('patient:write_clinical')) && (
                        <button
                          onClick={() => handleDelete(rec.id)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs font-semibold transition"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto my-8">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-slate-800">
                {editingId ? 'Edit Pre-eclampsia Screening Record' : 'New First-Trimester Pre-eclampsia Screen (FMF)'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
              {/* SECTION 1: Timing & Gestation */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  1. Assessment Timing & Gestation (11⁺⁰ to 13⁺⁶ weeks)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={form.assessmentDate}
                      onChange={(e) => setForm({ ...form, assessmentDate: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Time</label>
                    <input
                      type="time"
                      value={form.assessmentTime || ''}
                      onChange={(e) => setForm({ ...form, assessmentTime: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">GA Weeks (11–14)</label>
                    <input
                      type="number"
                      min={11}
                      max={14}
                      required
                      value={form.gestationalAgeWeeks}
                      onChange={(e) => setForm({ ...form, gestationalAgeWeeks: Number(e.target.value) })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">GA Days (0–6)</label>
                    <input
                      type="number"
                      min={0}
                      max={6}
                      required
                      value={form.gestationalAgeDays}
                      onChange={(e) => setForm({ ...form, gestationalAgeDays: Number(e.target.value) })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">CRL (mm) [45–84 mm]</label>
                    <input
                      type="number"
                      step="0.1"
                      min={45}
                      max={84}
                      value={form.crlMm ?? ''}
                      onChange={(e) => setForm({ ...form, crlMm: e.target.value ? Number(e.target.value) : null })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Maternal Characteristics & History */}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  2. Maternal Characteristics & Risk Profile
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Maternal Age (yrs)</label>
                    <input
                      type="number"
                      min={12}
                      max={60}
                      required
                      value={form.maternalAge}
                      onChange={(e) => setForm({ ...form, maternalAge: Number(e.target.value) })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.maternalWeightKg ?? ''}
                      onChange={(e) => setForm({ ...form, maternalWeightKg: e.target.value ? Number(e.target.value) : null })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Height (cm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={form.maternalHeightCm ?? ''}
                      onChange={(e) => setForm({ ...form, maternalHeightCm: e.target.value ? Number(e.target.value) : null })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Calculated BMI</label>
                    <div className="w-full text-xs bg-slate-100 border border-slate-300 rounded-lg p-2 text-slate-700 font-bold">
                      {form.bmi ? `${form.bmi} kg/m²` : '—'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Ethnicity</label>
                    <select
                      value={form.ethnicity}
                      onChange={(e) => setForm({ ...form, ethnicity: e.target.value as Ethnicity })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="south_asian">South Asian</option>
                      <option value="caucasian">Caucasian</option>
                      <option value="afro_caribbean">Afro-Caribbean</option>
                      <option value="east_asian">East Asian</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Obstetric Parity</label>
                    <select
                      value={form.parity}
                      onChange={(e) => setForm({ ...form, parity: e.target.value as ParityStatus })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="nulliparous">Nulliparous (1st pregnancy)</option>
                      <option value="multiparous_no_pe">Multiparous (No previous PE)</option>
                      <option value="multiparous_prior_pe">Multiparous (Previous PE)</option>
                    </select>
                  </div>
                  {form.parity === 'multiparous_prior_pe' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Prior PE Onset</label>
                      <select
                        value={form.priorPeOnsetGestation || ''}
                        onChange={(e) => setForm({ ...form, priorPeOnsetGestation: (e.target.value || null) as any })}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500"
                      >
                        <option value="">Unspecified</option>
                        <option value="early_lt_34">Early-onset (&lt;34 weeks)</option>
                        <option value="preterm_34_37">Preterm (34–37 weeks)</option>
                        <option value="term_gt_37">Term (&gt;37 weeks)</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Conception Method</label>
                    <select
                      value={form.conceptionMethod}
                      onChange={(e) => setForm({ ...form, conceptionMethod: e.target.value as ConceptionMethod })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="spontaneous">Spontaneous</option>
                      <option value="ivf_art">IVF / ART</option>
                      <option value="ovulation_induction">Ovulation Induction</option>
                    </select>
                  </div>
                </div>

                {/* Medical History Checkboxes (NICE Major & Moderate Factors) */}
                <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.chronicHypertension)}
                      onChange={(e) => setForm({ ...form, chronicHypertension: e.target.checked })}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-medium text-slate-800">Chronic Hypertension</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.pregestationalDiabetes)}
                      onChange={(e) => setForm({ ...form, pregestationalDiabetes: e.target.checked })}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-medium text-slate-800">Pre-gestational Diabetes (Type 1/2)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.systemicLupusOrAps)}
                      onChange={(e) => setForm({ ...form, systemicLupusOrAps: e.target.checked })}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-medium text-slate-800">Autoimmune SLE or APS</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.chronicKidneyDisease)}
                      onChange={(e) => setForm({ ...form, chronicKidneyDisease: e.target.checked })}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-medium text-slate-800">Chronic Kidney Disease</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.familyHistoryPe)}
                      onChange={(e) => setForm({ ...form, familyHistoryPe: e.target.checked })}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-medium text-slate-800">Family History of PE (Mother/Sister)</span>
                  </label>
                </div>
              </div>

              {/* SECTION 3: Biophysical Markers (MAP & UtA PI) */}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  3. Biophysical Markers (Blood Pressure & Uterine Artery Doppler)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Right Arm BP (SBP/DBP)</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        placeholder="SBP"
                        value={form.sbpRight ?? ''}
                        onChange={(e) => setForm({ ...form, sbpRight: e.target.value ? Number(e.target.value) : null })}
                        className="w-1/2 text-xs border border-slate-300 rounded p-1.5 focus:ring-2 focus:ring-rose-500"
                      />
                      <input
                        type="number"
                        placeholder="DBP"
                        value={form.dbpRight ?? ''}
                        onChange={(e) => setForm({ ...form, dbpRight: e.target.value ? Number(e.target.value) : null })}
                        className="w-1/2 text-xs border border-slate-300 rounded p-1.5 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Left Arm BP (SBP/DBP)</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        placeholder="SBP"
                        value={form.sbpLeft ?? ''}
                        onChange={(e) => setForm({ ...form, sbpLeft: e.target.value ? Number(e.target.value) : null })}
                        className="w-1/2 text-xs border border-slate-300 rounded p-1.5 focus:ring-2 focus:ring-rose-500"
                      />
                      <input
                        type="number"
                        placeholder="DBP"
                        value={form.dbpLeft ?? ''}
                        onChange={(e) => setForm({ ...form, dbpLeft: e.target.value ? Number(e.target.value) : null })}
                        className="w-1/2 text-xs border border-slate-300 rounded p-1.5 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mean Arterial Pressure (MAP)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={form.meanArterialPressure ?? ''}
                      onChange={(e) => setForm({ ...form, meanArterialPressure: Number(e.target.value) })}
                      className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500 bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">UtA PI (Left / Right)</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Left PI"
                        value={form.utaPiLeft ?? ''}
                        onChange={(e) => setForm({ ...form, utaPiLeft: e.target.value ? Number(e.target.value) : null })}
                        className="w-1/2 text-xs border border-slate-300 rounded p-1.5 focus:ring-2 focus:ring-rose-500"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Right PI"
                        value={form.utaPiRight ?? ''}
                        onChange={(e) => setForm({ ...form, utaPiRight: e.target.value ? Number(e.target.value) : null })}
                        className="w-1/2 text-xs border border-slate-300 rounded p-1.5 focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mean UtA PI</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={form.utaPiMean ?? ''}
                      onChange={(e) => setForm({ ...form, utaPiMean: Number(e.target.value) })}
                      className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500 bg-slate-50"
                    />
                  </div>
                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={Boolean(form.utaBilateralNotching)}
                        onChange={(e) => setForm({ ...form, utaBilateralNotching: e.target.checked })}
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span className="font-semibold text-slate-800">Bilateral Early Diastolic Notch</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Serum Biomarkers (Optional) */}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  4. Serum Biomarkers (PlGF & PAPP-A) [Optional]
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Serum PlGF (pg/mL)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 38.0"
                      value={form.serumPlgfPgMl ?? ''}
                      onChange={(e) => setForm({ ...form, serumPlgfPgMl: e.target.value ? Number(e.target.value) : null })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Serum PAPP-A (IU/L or MoM)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 1.0"
                      value={form.serumPappaIuL ?? ''}
                      onChange={(e) => setForm({ ...form, serumPappaIuL: e.target.value ? Number(e.target.value) : null })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>
              </div>

              {/* REAL-TIME PREVIEW CALLOUT */}
              {liveCalc && (
                <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                  liveCalc.overallRiskTier === 'high_risk'
                    ? 'bg-rose-50 border-rose-300 text-rose-900'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-sm">
                      ⚡ Live Calculation Preview: {liveCalc.overallRiskTier === 'high_risk' ? '🚨 HIGH RISK' : '✅ LOW RISK'}
                    </span>
                    <span className="text-sm">
                      Preterm PE Risk: {liveCalc.fmfRiskRatio}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                    <div>MAP MoM: <b>{liveCalc.mapMom.toFixed(2)}</b></div>
                    <div>UtA PI MoM: <b>{liveCalc.utaPiMom.toFixed(2)}</b></div>
                    <div>PlGF MoM: <b>{liveCalc.plgfMom ? liveCalc.plgfMom.toFixed(2) : '—'}</b></div>
                    <div>Aspirin: <b>{liveCalc.aspirinIndicated ? 'Indicated (150 mg)' : 'Not indicated'}</b></div>
                  </div>
                  {liveCalc.aspirinIndicated && (
                    <div className="font-semibold text-rose-800 pt-1">
                      💊 Action: {liveCalc.aspirinTimingRationale}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 5: Notes & Attending */}
              <div className="border-t border-slate-200 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical Notes</label>
                    <textarea
                      rows={2}
                      value={form.clinicalNotes || ''}
                      onChange={(e) => setForm({ ...form, clinicalNotes: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Performed By</label>
                    <input
                      type="text"
                      value={form.performedBy || ''}
                      onChange={(e) => setForm({ ...form, performedBy: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-slate-200 pt-4 flex justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Screening' : 'Save 1st Trimester PE Screen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
