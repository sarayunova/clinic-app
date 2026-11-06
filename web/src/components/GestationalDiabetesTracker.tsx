import React, { useState, useEffect, useMemo } from 'react';
import type { GdmProfile, GdmGlucoseLog, GdmFetalSurveillance, GdmProfileResponse } from '../api';
import {
  evaluateOgttDipsi,
  evaluateOgttIadpsg,
  evaluateOgttCarpenterCoustan,
  classifyGlucoseReading,
  calculateGlycemicSummary,
  assessMacrosomiaRisk,
  getGdmDeliveryAdvisory,
  type MealSlot,
  type PostprandialWindow,
  type WhitesClassification,
  type CurrentManagement,
} from '../gdmEngine';

interface Props {
  patientId: number;
}

export function GestationalDiabetesTracker({ patientId }: Props) {
  const [profile, setProfile] = useState<GdmProfile | null>(null);
  const [logs, setLogs] = useState<GdmGlucoseLog[]>([]);
  const [surveillances, setSurveillances] = useState<GdmFetalSurveillance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showSurveillanceModal, setShowSurveillanceModal] = useState(false);

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    gestationalAgeWeeks: '28',
    diagnosticCriteria: 'dipsi' as GdmProfile['diagnostic_criteria'],
    diagnosticDate: new Date().toISOString().slice(0, 10),
    ogttFastingMgDl: '',
    ogtt1hrMgDl: '',
    ogtt2hrMgDl: '155',
    ogtt3hrMgDl: '',
    baselineHba1c: '5.6',
    whiteClassification: 'a1_diet' as WhitesClassification,
    currentManagement: 'medical_nutrition_therapy' as CurrentManagement,
    targetFastingMgDl: '95',
    targetPostprandialMgDl: '120',
    postprandialWindow: '2_hour' as PostprandialWindow,
    targetHba1c: '6.0',
    insulinRegimenType: 'none' as GdmProfile['insulin_regimen_type'],
    basalInsulinName: '',
    basalUnitsMorning: '',
    basalUnitsNight: '',
    bolusInsulinName: '',
    bolusUnitsBreakfast: '',
    bolusUnitsLunch: '',
    bolusUnitsDinner: '',
    metforminDoseMgDay: '',
    dietaryCaloriesPrescribed: '1800',
    fetalSurveillanceNotes: '',
    plannedDeliveryWeeks: '39',
    notes: 'Prescribed Medical Nutrition Therapy with 3 balanced meals and 2 low-glycemic snacks.',
  });

  // Glucose Log Form State
  const [logForm, setLogForm] = useState({
    logDate: new Date().toISOString().slice(0, 10),
    logTime: new Date().toTimeString().slice(0, 5),
    mealSlot: 'fasting' as MealSlot,
    bloodGlucoseMgDl: '90',
    carbsConsumedEstimate: '',
    insulinAdministeredUnits: '',
    physicalActivityMin: '',
    symptoms: '',
    actionTaken: '',
    source: 'patient_log' as GdmGlucoseLog['source'],
    notes: '',
  });

  // Surveillance Form State
  const [survForm, setSurvForm] = useState({
    assessmentDate: new Date().toISOString().slice(0, 10),
    gestationalAgeWeeks: '32',
    estimatedFetalWeightG: '2100',
    efwPercentile: '60',
    abdominalCircumferenceMm: '285',
    acPercentile: '65',
    amnioticFluidIndexCm: '16.0',
    singleDeepestPocketCm: '5.2',
    clinicalPlan: 'Adequate fetal growth. Fetal AC appropriate for GA. Continue MNT.',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load Profile & Summary
      const pRes = await fetch(`/api/patients/${patientId}/gdm/profile`);
      if (!pRes.ok) throw new Error('Failed to load GDM profile');
      const pData: GdmProfileResponse = await pRes.json();
      setProfile(pData.profile);

      if (pData.profile) {
        // Pre-fill profile form with existing values for easy editing
        setProfileForm({
          gestationalAgeWeeks: pData.profile.gestational_age_weeks ? String(pData.profile.gestational_age_weeks) : '',
          diagnosticCriteria: pData.profile.diagnostic_criteria,
          diagnosticDate: pData.profile.diagnostic_date,
          ogttFastingMgDl: pData.profile.ogtt_fasting_mg_dl ? String(pData.profile.ogtt_fasting_mg_dl) : '',
          ogtt1hrMgDl: pData.profile.ogtt_1hr_mg_dl ? String(pData.profile.ogtt_1hr_mg_dl) : '',
          ogtt2hrMgDl: pData.profile.ogtt_2hr_mg_dl ? String(pData.profile.ogtt_2hr_mg_dl) : '',
          ogtt3hrMgDl: pData.profile.ogtt_3hr_mg_dl ? String(pData.profile.ogtt_3hr_mg_dl) : '',
          baselineHba1c: pData.profile.baseline_hba1c ? String(pData.profile.baseline_hba1c) : '',
          whiteClassification: pData.profile.white_classification,
          currentManagement: pData.profile.current_management,
          targetFastingMgDl: String(pData.profile.target_fasting_mg_dl || 95),
          targetPostprandialMgDl: String(pData.profile.target_postprandial_mg_dl || 120),
          postprandialWindow: pData.profile.postprandial_window || '2_hour',
          targetHba1c: String(pData.profile.target_hba1c || 6.0),
          insulinRegimenType: pData.profile.insulin_regimen_type,
          basalInsulinName: pData.profile.basal_insulin_name || '',
          basalUnitsMorning: pData.profile.basal_units_morning ? String(pData.profile.basal_units_morning) : '',
          basalUnitsNight: pData.profile.basal_units_night ? String(pData.profile.basal_units_night) : '',
          bolusInsulinName: pData.profile.bolus_insulin_name || '',
          bolusUnitsBreakfast: pData.profile.bolus_units_breakfast ? String(pData.profile.bolus_units_breakfast) : '',
          bolusUnitsLunch: pData.profile.bolus_units_lunch ? String(pData.profile.bolus_units_lunch) : '',
          bolusUnitsDinner: pData.profile.bolus_units_dinner ? String(pData.profile.bolus_units_dinner) : '',
          metforminDoseMgDay: pData.profile.metformin_dose_mg_day ? String(pData.profile.metformin_dose_mg_day) : '',
          dietaryCaloriesPrescribed: pData.profile.dietary_calories_prescribed ? String(pData.profile.dietary_calories_prescribed) : '',
          fetalSurveillanceNotes: pData.profile.fetal_surveillance_notes || '',
          plannedDeliveryWeeks: pData.profile.planned_delivery_weeks ? String(pData.profile.planned_delivery_weeks) : '',
          notes: pData.profile.notes || '',
        });
      }

      // Load Logs
      const lRes = await fetch(`/api/patients/${patientId}/gdm/logs?limit=100`);
      if (lRes.ok) {
        const lData = await lRes.json();
        setLogs(lData.logs || []);
      }

      // Load Surveillance
      const sRes = await fetch(`/api/patients/${patientId}/gdm/surveillance`);
      if (sRes.ok) {
        const sData = await sRes.json();
        setSurveillances(sData.surveillance || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading GDM data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  // Live diagnostic evaluation during form entry
  const previewOgttResult = useMemo(() => {
    if (profileForm.diagnosticCriteria === 'dipsi') {
      const v = Number(profileForm.ogtt2hrMgDl);
      return v ? evaluateOgttDipsi(v) : null;
    }
    if (profileForm.diagnosticCriteria === 'iadpsg') {
      const f = profileForm.ogttFastingMgDl ? Number(profileForm.ogttFastingMgDl) : null;
      const one = profileForm.ogtt1hrMgDl ? Number(profileForm.ogtt1hrMgDl) : null;
      const two = profileForm.ogtt2hrMgDl ? Number(profileForm.ogtt2hrMgDl) : null;
      return evaluateOgttIadpsg(f, one, two);
    }
    if (profileForm.diagnosticCriteria === 'carpenter_coustan') {
      const f = profileForm.ogttFastingMgDl ? Number(profileForm.ogttFastingMgDl) : null;
      const one = profileForm.ogtt1hrMgDl ? Number(profileForm.ogtt1hrMgDl) : null;
      const two = profileForm.ogtt2hrMgDl ? Number(profileForm.ogtt2hrMgDl) : null;
      const three = profileForm.ogtt3hrMgDl ? Number(profileForm.ogtt3hrMgDl) : null;
      return evaluateOgttCarpenterCoustan(f, one, two, three);
    }
    return null;
  }, [profileForm]);

  // Live log reading classification
  const liveLogClassification = useMemo(() => {
    const val = Number(logForm.bloodGlucoseMgDl);
    if (!val) return null;
    const tf = profile ? profile.target_fasting_mg_dl : Number(profileForm.targetFastingMgDl) || 95;
    const tp = profile ? profile.target_postprandial_mg_dl : Number(profileForm.targetPostprandialMgDl) || 120;
    const win = profile ? profile.postprandial_window : profileForm.postprandialWindow;
    return classifyGlucoseReading(logForm.mealSlot, val, tf, tp, win);
  }, [logForm.mealSlot, logForm.bloodGlucoseMgDl, profile, profileForm]);

  // Computed Glycemic Summary
  const summary = useMemo(() => {
    return calculateGlycemicSummary(logs);
  }, [logs]);

  // Handle Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const payload = {
        gestationalAgeWeeks: profileForm.gestationalAgeWeeks ? Number(profileForm.gestationalAgeWeeks) : null,
        diagnosticCriteria: profileForm.diagnosticCriteria,
        diagnosticDate: profileForm.diagnosticDate,
        ogttFastingMgDl: profileForm.ogttFastingMgDl ? Number(profileForm.ogttFastingMgDl) : null,
        ogtt1hrMgDl: profileForm.ogtt1hrMgDl ? Number(profileForm.ogtt1hrMgDl) : null,
        ogtt2hrMgDl: profileForm.ogtt2hrMgDl ? Number(profileForm.ogtt2hrMgDl) : null,
        ogtt3hrMgDl: profileForm.ogtt3hrMgDl ? Number(profileForm.ogtt3hrMgDl) : null,
        baselineHba1c: profileForm.baselineHba1c ? Number(profileForm.baselineHba1c) : null,
        whiteClassification: profileForm.whiteClassification,
        currentManagement: profileForm.currentManagement,
        targetFastingMgDl: Number(profileForm.targetFastingMgDl) || 95,
        targetPostprandialMgDl: Number(profileForm.targetPostprandialMgDl) || 120,
        postprandialWindow: profileForm.postprandialWindow,
        targetHba1c: Number(profileForm.targetHba1c) || 6.0,
        insulinRegimenType: profileForm.insulinRegimenType,
        basalInsulinName: profileForm.basalInsulinName || null,
        basalUnitsMorning: profileForm.basalUnitsMorning ? Number(profileForm.basalUnitsMorning) : null,
        basalUnitsNight: profileForm.basalUnitsNight ? Number(profileForm.basalUnitsNight) : null,
        bolusInsulinName: profileForm.bolusInsulinName || null,
        bolusUnitsBreakfast: profileForm.bolusUnitsBreakfast ? Number(profileForm.bolusUnitsBreakfast) : null,
        bolusUnitsLunch: profileForm.bolusUnitsLunch ? Number(profileForm.bolusUnitsLunch) : null,
        bolusUnitsDinner: profileForm.bolusUnitsDinner ? Number(profileForm.bolusUnitsDinner) : null,
        metforminDoseMgDay: profileForm.metforminDoseMgDay ? Number(profileForm.metforminDoseMgDay) : null,
        dietaryCaloriesPrescribed: profileForm.dietaryCaloriesPrescribed ? Number(profileForm.dietaryCaloriesPrescribed) : null,
        fetalSurveillanceNotes: profileForm.fetalSurveillanceNotes || null,
        plannedDeliveryWeeks: profileForm.plannedDeliveryWeeks ? Number(profileForm.plannedDeliveryWeeks) : null,
        notes: profileForm.notes || null,
      };

      const res = await fetch(`/api/patients/${patientId}/gdm/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Failed to save GDM profile');
      }

      setShowProfileModal(false);
      setSuccessMsg('GDM Profile saved successfully!');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Error saving profile');
    }
  };

  // Handle Glucose Log Save
  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const val = Number(logForm.bloodGlucoseMgDl);
      if (!val || val <= 0) throw new Error('Valid blood glucose reading required');

      const payload = {
        logDate: logForm.logDate,
        logTime: logForm.logTime,
        mealSlot: logForm.mealSlot,
        bloodGlucoseMgDl: val,
        carbsConsumedEstimate: logForm.carbsConsumedEstimate || null,
        insulinAdministeredUnits: logForm.insulinAdministeredUnits ? Number(logForm.insulinAdministeredUnits) : null,
        physicalActivityMin: logForm.physicalActivityMin ? Number(logForm.physicalActivityMin) : null,
        symptoms: logForm.symptoms || null,
        actionTaken: logForm.actionTaken || null,
        source: logForm.source,
        notes: logForm.notes || null,
      };

      const res = await fetch(`/api/patients/${patientId}/gdm/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Failed to save glucose reading');
      }

      setShowLogModal(false);
      setSuccessMsg('Blood glucose reading logged!');
      // Reset form to current time
      setLogForm((prev) => ({
        ...prev,
        logTime: new Date().toTimeString().slice(0, 5),
        bloodGlucoseMgDl: '95',
      }));
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Error logging glucose');
    }
  };

  // Handle Delete Log
  const handleDeleteLog = async (logId: number) => {
    if (!window.confirm('Delete this glucose reading?')) return;
    try {
      setError(null);
      const res = await fetch(`/api/patients/${patientId}/gdm/logs/${logId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete reading');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Error deleting reading');
    }
  };

  // Handle Fetal Surveillance Save
  const handleSaveSurveillance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const payload = {
        assessmentDate: survForm.assessmentDate,
        gestationalAgeWeeks: survForm.gestationalAgeWeeks ? Number(survForm.gestationalAgeWeeks) : null,
        estimatedFetalWeightG: survForm.estimatedFetalWeightG ? Number(survForm.estimatedFetalWeightG) : null,
        efwPercentile: survForm.efwPercentile ? Number(survForm.efwPercentile) : null,
        abdominalCircumferenceMm: survForm.abdominalCircumferenceMm ? Number(survForm.abdominalCircumferenceMm) : null,
        acPercentile: survForm.acPercentile ? Number(survForm.acPercentile) : null,
        amnioticFluidIndexCm: survForm.amnioticFluidIndexCm ? Number(survForm.amnioticFluidIndexCm) : null,
        singleDeepestPocketCm: survForm.singleDeepestPocketCm ? Number(survForm.singleDeepestPocketCm) : null,
        clinicalPlan: survForm.clinicalPlan || null,
      };

      const res = await fetch(`/api/patients/${patientId}/gdm/surveillance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Failed to save fetal surveillance');
      }

      setShowSurveillanceModal(false);
      setSuccessMsg('Fetal macrosomia & AFI assessment recorded!');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Error recording surveillance');
    }
  };

  const getSlotLabel = (s: string) => {
    switch (s) {
      case 'fasting':
        return 'Fasting (Pre-Bkfst)';
      case 'post_breakfast':
        return 'Post-Breakfast';
      case 'pre_lunch':
        return 'Pre-Lunch';
      case 'post_lunch':
        return 'Post-Lunch';
      case 'pre_dinner':
        return 'Pre-Dinner';
      case 'post_dinner':
        return 'Post-Dinner';
      case 'bedtime':
        return 'Bedtime';
      case '3_am_nocturnal':
        return '3 AM (Nocturnal)';
      default:
        return 'Random';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_target':
        return <span className="badge badge-success">Target</span>;
      case 'mild_excursion':
        return <span className="badge badge-warning">Mild High</span>;
      case 'severe_excursion':
        return <span className="badge badge-danger">High Excursion</span>;
      case 'mild_hypoglycemia':
        return <span className="badge badge-warning">Hypo (60-69)</span>;
      case 'severe_hypoglycemia':
        return <span className="badge badge-danger">Severe Hypo (&lt;60)</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  const deliveryAdvisory = useMemo(() => {
    if (!profile) return '';
    const ctrl = summary.timeInRangePercent >= 75 ? 'good' : 'suboptimal';
    const latestSurv = surveillances[0];
    return getGdmDeliveryAdvisory(profile.white_classification, ctrl, latestSurv?.estimated_fetal_weight_g);
  }, [profile, summary, surveillances]);

  return (
    <div className="gdm-tracker space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span>🩸 Gestational Diabetes Mellitus (GDM) & Glycemic Tracker</span>
            {profile && (
              <span
                className={`text-xs px-2 py-0.5 rounded font-semibold uppercase ${
                  profile.white_classification === 'a1_diet'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                White {profile.white_classification.replace('_', ' ').toUpperCase()}
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-500">
            DIPSI / IADPSG / Carpenter-Coustan diagnostics, multi-point SMBG daily logbook, Time In Range (TIR), and fetal macrosomia surveillance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {profile && (
            <a
              href={`/patients/${patientId}/gdm/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn small secondary flex items-center gap-1"
            >
              <span>🖨️</span> Print GDM Chart
            </a>
          )}
          <button
            type="button"
            className="btn small secondary"
            onClick={() => setShowProfileModal(true)}
          >
            {profile ? '⚙️ Edit GDM Profile' : '➕ Setup GDM Profile'}
          </button>
          {profile && (
            <button
              type="button"
              className="btn small primary"
              onClick={() => setShowLogModal(true)}
            >
              ➕ Log Blood Sugar
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold">×</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm flex justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold">×</button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-400">Loading Gestational Diabetes records...</div>
      ) : !profile ? (
        /* Empty State */
        <div className="p-8 text-center bg-gray-50 border rounded-lg space-y-4">
          <div className="text-4xl">🩸</div>
          <h3 className="text-lg font-semibold text-gray-700">No GDM Profile Active</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            This patient has not yet been registered with Gestational Diabetes or impaired glucose tolerance. Setup an antenatal diagnostic profile (DIPSI 75g, IADPSG, or Carpenter-Coustan) to begin tracking daily capillary blood sugars and fetal growth.
          </p>
          <button
            type="button"
            className="btn primary"
            onClick={() => setShowProfileModal(true)}
          >
            Setup GDM Profile
          </button>
        </div>
      ) : (
        /* Active GDM Workspace */
        <div className="space-y-4">
          {/* Active Profile & Target Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-4 border rounded shadow-sm">
            <div className="border-r pr-3">
              <span className="text-xs text-gray-400 font-semibold uppercase">Diagnosis & Criteria</span>
              <div className="font-bold text-gray-800 text-base uppercase mt-1">
                {profile.diagnostic_criteria.replace('_', ' ')}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Diagnosed on {profile.diagnostic_date} (GA {profile.gestational_age_weeks || '—'}w)
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {profile.ogtt_2hr_mg_dl && <span>2-Hr OGTT: <b>{profile.ogtt_2hr_mg_dl} mg/dL</b> | </span>}
                {profile.baseline_hba1c && <span>HbA1c: <b>{profile.baseline_hba1c}%</b></span>}
              </div>
            </div>

            <div className="border-r pr-3">
              <span className="text-xs text-gray-400 font-semibold uppercase">Current Management</span>
              <div className="font-bold text-gray-800 text-base capitalize mt-1">
                {profile.current_management.replace(/_/g, ' ')}
              </div>
              <div className="text-xs text-purple-700 font-medium mt-0.5">
                {profile.insulin_regimen_type !== 'none'
                  ? `Insulin: ${profile.insulin_regimen_type.replace(/_/g, ' ')}`
                  : profile.metformin_dose_mg_day
                  ? `Metformin ${profile.metformin_dose_mg_day} mg/day`
                  : 'Medical Nutrition Therapy (MNT)'}
              </div>
              {profile.insulin_regimen_type !== 'none' && (
                <div className="text-xs text-gray-500 mt-0.5">
                  {profile.basal_units_night ? `Basal ${profile.basal_units_night}u night | ` : ''}
                  {profile.bolus_units_breakfast ? `Bolus ${profile.bolus_units_breakfast}-${profile.bolus_units_lunch || 0}-${profile.bolus_units_dinner || 0}u` : ''}
                </div>
              )}
            </div>

            <div className="border-r pr-3">
              <span className="text-xs text-gray-400 font-semibold uppercase">Pregnancy Targets</span>
              <div className="text-xs font-semibold text-gray-700 mt-1">
                Fasting: <span className="text-green-700 font-bold">&le; {profile.target_fasting_mg_dl} mg/dL</span>
              </div>
              <div className="text-xs font-semibold text-gray-700 mt-0.5">
                {profile.postprandial_window === '1_hour' ? '1-Hr' : '2-Hr'} Post-Meal: <span className="text-green-700 font-bold">&le; {profile.target_postprandial_mg_dl} mg/dL</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Target HbA1c: &lt; {profile.target_hba1c}%
              </div>
            </div>

            <div>
              <span className="text-xs text-gray-400 font-semibold uppercase">Planned Delivery</span>
              <div className="font-bold text-gray-800 text-base mt-1">
                {profile.planned_delivery_weeks ? `${profile.planned_delivery_weeks} Weeks` : '39-40 Weeks'}
              </div>
              <div className="text-xs text-blue-700 mt-0.5 line-clamp-2">
                {deliveryAdvisory}
              </div>
            </div>
          </div>

          {/* Glycemic Analytics Dashboard */}
          <div className="bg-white p-4 border rounded shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">
                📊 Glycemic Control & Time In Range (TIR)
              </h3>
              <span className="text-xs text-gray-500">
                Based on {summary.totalReadings} recorded readings
              </span>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-gray-50 border rounded text-center">
                <span className="text-xs text-gray-500 block">Time In Range (TIR)</span>
                <span className={`text-2xl font-black ${summary.timeInRangePercent >= 75 ? 'text-green-600' : 'text-amber-600'}`}>
                  {summary.timeInRangePercent}%
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">Target &ge; 75%</span>
              </div>

              <div className="p-3 bg-gray-50 border rounded text-center">
                <span className="text-xs text-gray-500 block">Mean Blood Glucose</span>
                <span className="text-2xl font-black text-blue-700">
                  {summary.meanBloodGlucose || '—'} <span className="text-xs font-normal">mg/dL</span>
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">Avg across all meals</span>
              </div>

              <div className="p-3 bg-gray-50 border rounded text-center">
                <span className="text-xs text-gray-500 block">Estimated HbA1c</span>
                <span className="text-2xl font-black text-purple-700">
                  {summary.estimatedHbA1c ? `${summary.estimatedHbA1c}%` : '—'}
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">Target &lt; 6.0%</span>
              </div>

              <div className="p-3 bg-gray-50 border rounded text-center">
                <span className="text-xs text-gray-500 block">Excursions / Hypos</span>
                <div className="text-2xl font-black flex items-center justify-center gap-2">
                  <span className="text-amber-600">{summary.excursionCount} ⬆</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-red-600">{summary.hypoglycemiaCount} ⬇</span>
                </div>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  Fasting High: {summary.fastingExcursionPercent}% | Post: {summary.postprandialExcursionPercent}%
                </span>
              </div>
            </div>

            {/* Time in range visual bar */}
            {summary.totalReadings > 0 && (
              <div className="space-y-1">
                <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${summary.timeBelowRangePercent}%` }}
                    className="bg-red-500 h-full"
                    title={`Hypoglycemia: ${summary.timeBelowRangePercent}%`}
                  />
                  <div
                    style={{ width: `${summary.timeInRangePercent}%` }}
                    className="bg-green-500 h-full"
                    title={`In Target: ${summary.timeInRangePercent}%`}
                  />
                  <div
                    style={{ width: `${summary.timeAboveRangePercent}%` }}
                    className="bg-amber-400 h-full"
                    title={`Excursions: ${summary.timeAboveRangePercent}%`}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span className="text-red-600">● Hypo &lt;70 ({summary.timeBelowRangePercent}%)</span>
                  <span className="text-green-600 font-semibold">● Target In-Range ({summary.timeInRangePercent}%)</span>
                  <span className="text-amber-600">● High &gt;Target ({summary.timeAboveRangePercent}%)</span>
                </div>
              </div>
            )}

            {/* Automated Advisory Banner */}
            <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-900 rounded text-xs">
              <b>Clinical Guidance:</b> {summary.advisory}
            </div>
          </div>

          {/* Fetal Macrosomia & Polyhydramnios Risk Surveillance */}
          <div className="bg-white p-4 border rounded shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide flex items-center gap-2">
                <span>👶 Fetal Macrosomia & Polyhydramnios Surveillance</span>
                {surveillances.length > 0 && surveillances[0] && (
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                    surveillances[0].macrosomia_risk_flag === 'normal'
                      ? 'bg-green-100 text-green-800'
                      : surveillances[0].macrosomia_risk_flag === 'borderline_ac_over_75'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {surveillances[0].macrosomia_risk_flag.replace(/_/g, ' ').toUpperCase()}
                  </span>
                )}
              </h3>
              <button
                type="button"
                className="btn small secondary"
                onClick={() => setShowSurveillanceModal(true)}
              >
                ➕ Record Scan Biometry
              </button>
            </div>

            {surveillances.length === 0 || !surveillances[0] ? (
              <p className="text-xs text-gray-500">
                No ultrasound growth surveillance recorded for GDM. Schedule serial scans at 28-32w and 36w to monitor fetal abdominal circumference (AC) and amniotic fluid index (AFI).
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-2.5 bg-gray-50 border rounded">
                  <span className="text-xs text-gray-500 block">Assessment Date</span>
                  <span className="font-bold text-sm text-gray-800">{surveillances[0].assessment_date}</span>
                  <span className="text-xs text-gray-500 block">GA {surveillances[0].gestational_age_weeks || '—'} Weeks</span>
                </div>
                <div className="p-2.5 bg-gray-50 border rounded">
                  <span className="text-xs text-gray-500 block">Fetal Abdominal Circumference</span>
                  <span className={`font-bold text-sm ${surveillances[0].ac_percentile && surveillances[0].ac_percentile >= 75 ? 'text-amber-600' : 'text-gray-800'}`}>
                    {surveillances[0].abdominal_circumference_mm ? `${surveillances[0].abdominal_circumference_mm} mm` : '—'}
                  </span>
                  <span className="text-xs text-gray-500 block">
                    {surveillances[0].ac_percentile ? `${surveillances[0].ac_percentile}th Centile` : '—'}
                  </span>
                </div>
                <div className="p-2.5 bg-gray-50 border rounded">
                  <span className="text-xs text-gray-500 block">Estimated Fetal Weight (EFW)</span>
                  <span className={`font-bold text-sm ${surveillances[0].estimated_fetal_weight_g && surveillances[0].estimated_fetal_weight_g >= 4000 ? 'text-red-600' : 'text-gray-800'}`}>
                    {surveillances[0].estimated_fetal_weight_g ? `${surveillances[0].estimated_fetal_weight_g} g` : '—'}
                  </span>
                  <span className="text-xs text-gray-500 block">
                    {surveillances[0].efw_percentile ? `${surveillances[0].efw_percentile}th Centile` : '—'}
                  </span>
                </div>
                <div className="p-2.5 bg-gray-50 border rounded">
                  <span className="text-xs text-gray-500 block">Amniotic Fluid Index (AFI)</span>
                  <span className={`font-bold text-sm ${surveillances[0].amniotic_fluid_index_cm && surveillances[0].amniotic_fluid_index_cm >= 24 ? 'text-red-600' : 'text-gray-800'}`}>
                    {surveillances[0].amniotic_fluid_index_cm ? `${surveillances[0].amniotic_fluid_index_cm} cm` : '—'}
                  </span>
                  <span className="text-xs text-gray-500 block">
                    SDP: {surveillances[0].single_deepest_pocket_cm ? `${surveillances[0].single_deepest_pocket_cm} cm` : '—'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Multi-Point Daily Glucose Readings Table */}
          <div className="bg-white border rounded shadow-sm overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">
                📋 Daily Capillary Blood Glucose Logbook ({logs.length} Readings)
              </h3>
              <button
                type="button"
                className="btn small primary"
                onClick={() => setShowLogModal(true)}
              >
                ➕ Log Reading
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No glucose readings logged yet. Click "Log Reading" to record fasting and postprandial levels.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                    <tr>
                      <th className="p-2.5">Date & Time</th>
                      <th className="p-2.5">Meal Slot</th>
                      <th className="p-2.5">Glucose Level</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Insulin / Carbs</th>
                      <th className="p-2.5">Symptoms / Action</th>
                      <th className="p-2.5">Source / Notes</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-gray-800">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="p-2.5 font-medium whitespace-nowrap">
                          {log.log_date} <span className="text-gray-400 text-[11px]">{log.log_time}</span>
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span className="font-semibold text-gray-700">{getSlotLabel(log.meal_slot)}</span>
                        </td>
                        <td className="p-2.5 font-bold text-sm">
                          {log.blood_glucose_mg_dl} <span className="text-[10px] font-normal text-gray-400">mg/dL</span>
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          {getStatusBadge(log.target_status)}
                        </td>
                        <td className="p-2.5 text-gray-600">
                          {log.insulin_administered_units ? (
                            <span className="text-purple-700 font-semibold">{log.insulin_administered_units}u insulin </span>
                          ) : null}
                          {log.carbs_consumed_estimate ? (
                            <span className="text-gray-500">({log.carbs_consumed_estimate})</span>
                          ) : '—'}
                        </td>
                        <td className="p-2.5 text-gray-600 max-w-xs truncate">
                          {log.symptoms ? <span className="text-amber-700 font-medium">{log.symptoms} </span> : null}
                          {log.action_taken ? <span>{log.action_taken}</span> : '—'}
                        </td>
                        <td className="p-2.5 text-gray-500 max-w-xs truncate">
                          <span className="capitalize">{log.source.replace(/_/g, ' ')}</span>
                          {log.notes ? ` • ${log.notes}` : ''}
                        </td>
                        <td className="p-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteLog(log.id)}
                            className="text-red-500 hover:text-red-700 font-bold px-1"
                            title="Delete entry"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-lg font-bold">⚙️ Setup / Update GDM Profile</h3>
              <button onClick={() => setShowProfileModal(false)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              {/* Diagnostic criteria row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Diagnostic Protocol</label>
                  <select
                    className="w-full border p-2 rounded"
                    value={profileForm.diagnosticCriteria}
                    onChange={(e) => setProfileForm({ ...profileForm, diagnosticCriteria: e.target.value as any })}
                  >
                    <option value="dipsi">DIPSI 75g (Single 2-Hr Test)</option>
                    <option value="iadpsg">IADPSG 75g (Fasting, 1-Hr, 2-Hr)</option>
                    <option value="carpenter_coustan">Carpenter-Coustan 100g (3-Hr)</option>
                    <option value="clinical_hba1c">HbA1c / Clinical Diagnosis</option>
                    <option value="prior_pregestational">Pregestational Overt Diabetes</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Diagnosis Date</label>
                  <input
                    type="date"
                    className="w-full border p-2 rounded"
                    value={profileForm.diagnosticDate}
                    onChange={(e) => setProfileForm({ ...profileForm, diagnosticDate: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Gestational Age (Weeks)</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={profileForm.gestationalAgeWeeks}
                    onChange={(e) => setProfileForm({ ...profileForm, gestationalAgeWeeks: e.target.value })}
                    placeholder="e.g. 26"
                  />
                </div>
              </div>

              {/* OGTT Results */}
              <div className="p-3 bg-gray-50 border rounded space-y-2">
                <span className="font-bold text-gray-700 block">Diagnostic OGTT Values (mg/dL)</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-500">Fasting</label>
                    <input
                      type="number"
                      className="w-full border p-1.5 rounded"
                      value={profileForm.ogttFastingMgDl}
                      onChange={(e) => setProfileForm({ ...profileForm, ogttFastingMgDl: e.target.value })}
                      placeholder="e.g. 96"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500">1-Hour</label>
                    <input
                      type="number"
                      className="w-full border p-1.5 rounded"
                      value={profileForm.ogtt1hrMgDl}
                      onChange={(e) => setProfileForm({ ...profileForm, ogtt1hrMgDl: e.target.value })}
                      placeholder="e.g. 182"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500">2-Hour</label>
                    <input
                      type="number"
                      className="w-full border p-1.5 rounded"
                      value={profileForm.ogtt2hrMgDl}
                      onChange={(e) => setProfileForm({ ...profileForm, ogtt2hrMgDl: e.target.value })}
                      placeholder="e.g. 155"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500">Baseline HbA1c (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full border p-1.5 rounded"
                      value={profileForm.baselineHba1c}
                      onChange={(e) => setProfileForm({ ...profileForm, baselineHba1c: e.target.value })}
                      placeholder="e.g. 5.7"
                    />
                  </div>
                </div>

                {previewOgttResult && (
                  <div className={`p-2 rounded text-xs mt-1 ${previewOgttResult.isGdm ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-900'}`}>
                    <b>Assessment:</b> {previewOgttResult.clinicalSummary}
                  </div>
                )}
              </div>

              {/* Classification & Management */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">White's Classification</label>
                  <select
                    className="w-full border p-2 rounded"
                    value={profileForm.whiteClassification}
                    onChange={(e) => setProfileForm({ ...profileForm, whiteClassification: e.target.value as any })}
                  >
                    <option value="a1_diet">Class A1: Diet Controlled GDM (GDMA1)</option>
                    <option value="a2_medication">Class A2: Medication Required GDM (GDMA2)</option>
                    <option value="class_b_pregestational">Class B: Pregestational (Onset &ge; 20yo)</option>
                    <option value="class_c">Class C: Pregestational (Onset 10-19yo)</option>
                    <option value="class_d">Class D: Pregestational with Retinopathy/Vascular</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Current Therapy Plan</label>
                  <select
                    className="w-full border p-2 rounded"
                    value={profileForm.currentManagement}
                    onChange={(e) => setProfileForm({ ...profileForm, currentManagement: e.target.value as any })}
                  >
                    <option value="medical_nutrition_therapy">Medical Nutrition Therapy (MNT)</option>
                    <option value="metformin">Oral Agent: Metformin</option>
                    <option value="insulin">Insulin Therapy</option>
                    <option value="insulin_plus_metformin">Insulin + Metformin</option>
                  </select>
                </div>
              </div>

              {/* Pharmacotherapy Details (if medication) */}
              {(profileForm.currentManagement !== 'medical_nutrition_therapy' || profileForm.whiteClassification === 'a2_medication') && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded space-y-2">
                  <span className="font-bold text-purple-900 block">Insulin & Medication Regimen</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] text-gray-600">Regimen Pattern</label>
                      <select
                        className="w-full border p-1.5 rounded"
                        value={profileForm.insulinRegimenType}
                        onChange={(e) => setProfileForm({ ...profileForm, insulinRegimenType: e.target.value as any })}
                      >
                        <option value="none">None</option>
                        <option value="basal_only">Basal Only (Night)</option>
                        <option value="bolus_only">Bolus Only (Pre-meals)</option>
                        <option value="basal_bolus">Basal-Bolus Multi-Dose</option>
                        <option value="split_mixed_nph_reg">Split-Mixed NPH/Regular</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-600">Basal Insulin & Night Dose</label>
                      <input
                        type="text"
                        className="w-full border p-1.5 rounded"
                        placeholder="e.g. Glargine 10u at 10 PM"
                        value={profileForm.basalUnitsNight ? `${profileForm.basalInsulinName || 'Glargine'} ${profileForm.basalUnitsNight}u` : ''}
                        onChange={(e) => {
                          const num = e.target.value.match(/\d+/);
                          setProfileForm({
                            ...profileForm,
                            basalInsulinName: 'Insulin Glargine',
                            basalUnitsNight: num ? num[0] : '',
                          });
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-600">Bolus Pre-Meals (B-L-D Units)</label>
                      <input
                        type="text"
                        className="w-full border p-1.5 rounded"
                        placeholder="e.g. 4-4-6 units Aspart"
                        value={profileForm.bolusUnitsBreakfast ? `${profileForm.bolusUnitsBreakfast}-${profileForm.bolusUnitsLunch || 0}-${profileForm.bolusUnitsDinner || 0}u` : ''}
                        onChange={(e) => {
                          const parts = e.target.value.split('-');
                          setProfileForm({
                            ...profileForm,
                            bolusInsulinName: 'Insulin Aspart',
                            bolusUnitsBreakfast: parts[0]?.trim() || '',
                            bolusUnitsLunch: parts[1]?.trim() || '',
                            bolusUnitsDinner: parts[2]?.trim() || '',
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Target thresholds */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Target Fasting (mg/dL)</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={profileForm.targetFastingMgDl}
                    onChange={(e) => setProfileForm({ ...profileForm, targetFastingMgDl: e.target.value })}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Post-Meal Window</label>
                  <select
                    className="w-full border p-2 rounded"
                    value={profileForm.postprandialWindow}
                    onChange={(e) => setProfileForm({ ...profileForm, postprandialWindow: e.target.value as any })}
                  >
                    <option value="2_hour">2-Hour Post-Meal (&le; 120)</option>
                    <option value="1_hour">1-Hour Post-Meal (&le; 140)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Target Postprandial</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={profileForm.targetPostprandialMgDl}
                    onChange={(e) => setProfileForm({ ...profileForm, targetPostprandialMgDl: e.target.value })}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Planned Delivery GA</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={profileForm.plannedDeliveryWeeks}
                    onChange={(e) => setProfileForm({ ...profileForm, plannedDeliveryWeeks: e.target.value })}
                    placeholder="e.g. 39"
                  />
                </div>
              </div>

              {/* Clinical notes */}
              <div>
                <label className="font-semibold block mb-1">Dietary & Clinical Instructions</label>
                <textarea
                  rows={2}
                  className="w-full border p-2 rounded"
                  value={profileForm.notes}
                  onChange={(e) => setProfileForm({ ...profileForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowProfileModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Save GDM Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Glucose Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-lg font-bold">➕ Log Blood Glucose Reading</h3>
              <button onClick={() => setShowLogModal(false)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveLog} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Date</label>
                  <input
                    type="date"
                    className="w-full border p-2 rounded"
                    value={logForm.logDate}
                    onChange={(e) => setLogForm({ ...logForm, logDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Time</label>
                  <input
                    type="time"
                    className="w-full border p-2 rounded"
                    value={logForm.logTime}
                    onChange={(e) => setLogForm({ ...logForm, logTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Meal Slot</label>
                  <select
                    className="w-full border p-2 rounded"
                    value={logForm.mealSlot}
                    onChange={(e) => setLogForm({ ...logForm, mealSlot: e.target.value as any })}
                  >
                    <option value="fasting">Fasting (Before Breakfast)</option>
                    <option value="post_breakfast">Post-Breakfast</option>
                    <option value="pre_lunch">Pre-Lunch</option>
                    <option value="post_lunch">Post-Lunch</option>
                    <option value="pre_dinner">Pre-Dinner</option>
                    <option value="post_dinner">Post-Dinner</option>
                    <option value="bedtime">Bedtime (10 PM)</option>
                    <option value="3_am_nocturnal">3 AM (Nocturnal Check)</option>
                    <option value="random">Random</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Blood Sugar (mg/dL)</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded font-bold text-base"
                    value={logForm.bloodGlucoseMgDl}
                    onChange={(e) => setLogForm({ ...logForm, bloodGlucoseMgDl: e.target.value })}
                    required
                    placeholder="e.g. 92"
                  />
                </div>
              </div>

              {/* Live Target Assessment Preview */}
              {liveLogClassification && (
                <div className={`p-2 rounded text-xs flex items-center justify-between ${
                  liveLogClassification.status === 'in_target'
                    ? 'bg-green-100 text-green-800'
                    : liveLogClassification.isHypo
                    ? 'bg-red-100 text-red-800 font-bold'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  <span><b>Status:</b> {liveLogClassification.label}</span>
                  <span>Target: {liveLogClassification.targetMin}-{liveLogClassification.targetMax} mg/dL</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Insulin Administered (Units)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="w-full border p-2 rounded"
                    value={logForm.insulinAdministeredUnits}
                    onChange={(e) => setLogForm({ ...logForm, insulinAdministeredUnits: e.target.value })}
                    placeholder="e.g. 4"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Carbs / Meal Eaten</label>
                  <input
                    type="text"
                    className="w-full border p-2 rounded"
                    value={logForm.carbsConsumedEstimate}
                    onChange={(e) => setLogForm({ ...logForm, carbsConsumedEstimate: e.target.value })}
                    placeholder="e.g. 2 chapatis + dal + salad"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Symptoms (if any)</label>
                  <input
                    type="text"
                    className="w-full border p-2 rounded"
                    value={logForm.symptoms}
                    onChange={(e) => setLogForm({ ...logForm, symptoms: e.target.value })}
                    placeholder="e.g. Shakiness, sweating, none"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Source</label>
                  <select
                    className="w-full border p-2 rounded"
                    value={logForm.source}
                    onChange={(e) => setLogForm({ ...logForm, source: e.target.value as any })}
                  >
                    <option value="patient_log">Patient Home Glucometer</option>
                    <option value="ward_nurse_glucometer">Inpatient Ward Bedside</option>
                    <option value="lab_venous">Hospital Lab Venous Plasma</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowLogModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Save Reading
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Surveillance Modal */}
      {showSurveillanceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-lg font-bold">👶 Ultrasound Fetal Growth & Macrosomia Check</h3>
              <button onClick={() => setShowSurveillanceModal(false)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveSurveillance} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Scan Date</label>
                  <input
                    type="date"
                    className="w-full border p-2 rounded"
                    value={survForm.assessmentDate}
                    onChange={(e) => setSurvForm({ ...survForm, assessmentDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Gestational Age (Weeks)</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={survForm.gestationalAgeWeeks}
                    onChange={(e) => setSurvForm({ ...survForm, gestationalAgeWeeks: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Abdominal Circ. (AC mm)</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={survForm.abdominalCircumferenceMm}
                    onChange={(e) => setSurvForm({ ...survForm, abdominalCircumferenceMm: e.target.value })}
                    placeholder="e.g. 290"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">AC Percentile (%)</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={survForm.acPercentile}
                    onChange={(e) => setSurvForm({ ...survForm, acPercentile: e.target.value })}
                    placeholder="e.g. 70"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Est. Fetal Weight (EFW g)</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={survForm.estimatedFetalWeightG}
                    onChange={(e) => setSurvForm({ ...survForm, estimatedFetalWeightG: e.target.value })}
                    placeholder="e.g. 2400"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">EFW Percentile (%)</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={survForm.efwPercentile}
                    onChange={(e) => setSurvForm({ ...survForm, efwPercentile: e.target.value })}
                    placeholder="e.g. 60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Amniotic Fluid Index (AFI cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full border p-2 rounded"
                    value={survForm.amnioticFluidIndexCm}
                    onChange={(e) => setSurvForm({ ...survForm, amnioticFluidIndexCm: e.target.value })}
                    placeholder="e.g. 16.5"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Single Deepest Pocket (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full border p-2 rounded"
                    value={survForm.singleDeepestPocketCm}
                    onChange={(e) => setSurvForm({ ...survForm, singleDeepestPocketCm: e.target.value })}
                    placeholder="e.g. 5.5"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Clinical Plan & Findings</label>
                <textarea
                  rows={2}
                  className="w-full border p-2 rounded"
                  value={survForm.clinicalPlan}
                  onChange={(e) => setSurvForm({ ...survForm, clinicalPlan: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowSurveillanceModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Save Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
