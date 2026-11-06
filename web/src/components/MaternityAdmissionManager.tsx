import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type MaternityAdmission,
  type MaternityHandoverEntry,
  type OxytocinTitrationLog,
  type EmergencyLscsChecklist,
  type Patient,
} from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, Field, fieldErrorsOf, todayLocal } from './ui';
import {
  calculateBishopScore,
  calculateRuptureHours,
  isProlongedProm,
  isTachysystole,
  BISHOP_DILATION_OPTIONS,
  BISHOP_EFFACEMENT_OPTIONS,
  BISHOP_STATION_OPTIONS,
  BISHOP_CONSISTENCY_OPTIONS,
  BISHOP_POSITION_OPTIONS,
} from '../maternityScoring';

export const LABOR_STAGE_LABELS: Record<string, string> = {
  not_in_labor: 'Not in Labor (Antenatal / Triage)',
  latent_phase: 'Latent Phase (< 5 cm)',
  active_phase: 'Active Phase (≥ 5 cm)',
  second_stage: 'Second Stage (Full Dilation to Birth)',
  third_stage: 'Third Stage (Placental Expulsion)',
  immediate_postpartum: 'Immediate Postpartum Recovery',
};

export const INDICATION_LABELS: Record<string, string> = {
  in_labor: 'Spontaneous Labor Onset',
  prom: 'Premature Rupture of Membranes (PROM)',
  postdated: 'Postdated Pregnancy (≥ 40+w)',
  induction_of_labor: 'Planned Labor Induction',
  pre_eclampsia: 'Pre-eclampsia / Gestational HTN',
  gdm_monitoring: 'Gestational Diabetes Mellitus (GDM)',
  fetal_growth_restriction: 'Fetal Growth Restriction (FGR)',
  reduced_fetal_movements: 'Reduced Fetal Movements',
  antepartum_hemorrhage: 'Antepartum Hemorrhage (APH)',
  elective_lscs_planned: 'Elective LSCS Planned',
  other: 'Other Obstetric Indication',
};

export const MEMBRANE_STATUS_LABELS: Record<string, string> = {
  intact: 'Membranes Intact',
  ruptured_clear: 'Ruptured — Clear Liquor',
  ruptured_meconium_thin: 'Ruptured — Thin Meconium Stained',
  ruptured_meconium_thick: 'Ruptured — Thick Meconium (Warning)',
  ruptured_blood_stained: 'Ruptured — Blood Stained Liquor',
};

export const LOCATION_LABELS: Record<string, string> = {
  triage: 'Maternity Triage',
  antenatal_ward: 'Antenatal Ward',
  labor_room: 'Labor Room (L&D)',
  delivery_suite: 'Delivery Suite',
  operating_theatre: 'Operating Theatre (OT)',
  recovery_postnatal: 'Postnatal Recovery',
};

interface MaternityAdmissionManagerProps {
  patient: Patient;
  onChanged?: () => void;
}

export function MaternityAdmissionManager({ patient, onChanged }: MaternityAdmissionManagerProps) {
  const { can } = useAuth();
  const canWrite = can('patient:write_clinical') || can('care:write_nursing') || can('ipd:write');

  const [admissions, setAdmissions] = useState<MaternityAdmission[]>([]);
  const [selectedAdmission, setSelectedAdmission] = useState<MaternityAdmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Modals state
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showOxytocinModal, setShowOxytocinModal] = useState(false);
  const [showLscsModal, setShowLscsModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);

  // New Admission Form State
  const [admissionDate, setAdmissionDate] = useState(todayLocal());
  const [laborStage, setLaborStage] = useState<string>('latent_phase');
  const [admissionIndication, setAdmissionIndication] = useState<string>('in_labor');
  const [indicationDetails, setIndicationDetails] = useState('');
  const [contractionOnsetAt, setContractionOnsetAt] = useState('');
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState(
    patient.lastMenstrualPeriod ? '39' : '38'
  );
  const [gestationalAgeDays, setGestationalAgeDays] = useState('2');
  const [gravida, setGravida] = useState(patient.gravida != null ? String(patient.gravida) : '1');
  const [para, setPara] = useState(patient.para != null ? String(patient.para) : '0');
  const [bloodGroup, setBloodGroup] = useState('');
  const [allergiesSummary, setAllergiesSummary] = useState(patient.allergyDetails || 'No known allergies');
  const [highRiskAlerts, setHighRiskAlerts] = useState('');

  // Bishop Score Form State
  const [bishopDilation, setBishopDilation] = useState(1);
  const [bishopEffacement, setBishopEffacement] = useState(1);
  const [bishopStation, setBishopStation] = useState(1);
  const [bishopConsistency, setBishopConsistency] = useState(1);
  const [bishopPosition, setBishopPosition] = useState(1);

  // Membranes Form State
  const [membraneStatus, setMembraneStatus] = useState<string>('intact');
  const [membraneRupturedAt, setMembraneRupturedAt] = useState('');
  const [promAntibioticsGiven, setPromAntibioticsGiven] = useState(false);
  const [liquorNotes, setLiquorNotes] = useState('');

  // Fetal & Maternal Form State
  const [fetalHeartRate, setFetalHeartRate] = useState('140');
  const [fetalPresentation, setFetalPresentation] = useState<string>('cephalic_vertex');
  const [ctgCategory, setCtgCategory] = useState<string>('category_1');
  const [bpSystolic, setBpSystolic] = useState('120');
  const [bpDiastolic, setBpDiastolic] = useState('80');
  const [pulse, setPulse] = useState('82');
  const [temperatureF, setTemperatureF] = useState('98.4');
  const [spo2, setSpo2] = useState('99');
  const [urineProtein, setUrineProtein] = useState<string>('nil');

  // Location Form State
  const [currentLocation, setCurrentLocation] = useState<string>('labor_room');
  const [attendingMidwifeNurse, setAttendingMidwifeNurse] = useState('');
  const [primaryObstetrician, setPrimaryObstetrician] = useState('');
  const [status, setStatus] = useState<string>('in_labor');

  // Handover Form State
  const [handoverShift, setHandoverShift] = useState<'morning' | 'evening' | 'night'>('morning');
  const [handoverOutgoing, setHandoverOutgoing] = useState('');
  const [handoverIncoming, setHandoverIncoming] = useState('');
  const [handoverSituation, setHandoverSituation] = useState('');
  const [handoverBackground, setHandoverBackground] = useState('');
  const [handoverAssessment, setHandoverAssessment] = useState('');
  const [handoverRecommendation, setHandoverRecommendation] = useState('');
  const [handoverUrgency, setHandoverUrgency] = useState<'routine' | 'watch_closely' | 'immediate_attention'>('routine');

  // Oxytocin Log Form State
  const [oxyRate, setOxyRate] = useState('2');
  const [oxyDrops, setOxyDrops] = useState('6');
  const [oxyContractions, setOxyContractions] = useState('3');
  const [oxyDuration, setOxyDuration] = useState('45');
  const [oxyIntensity, setOxyIntensity] = useState<'mild' | 'moderate' | 'strong'>('moderate');
  const [oxyFhr, setOxyFhr] = useState('142');
  const [oxyAction, setOxyAction] = useState('Dose titrated per protocol. Contractions adequate, FHR reassuring.');

  // Emergency LSCS Form State
  const [lscsCategory, setLscsCategory] = useState<string>('category_1_immediate_threat');
  const [lscsTargetMins, setLscsTargetMins] = useState(30);
  const [lscsIndication, setLscsIndication] = useState('');
  const [lscsSurgeon, setLscsSurgeon] = useState('');
  const [lscsAnesthetistNotified, setLscsAnesthetistNotified] = useState(false);
  const [lscsAnesthetistName, setLscsAnesthetistName] = useState('');
  const [lscsPediatricianNotified, setLscsPediatricianNotified] = useState(false);
  const [lscsPediatricianName, setLscsPediatricianName] = useState('');
  const [lscsConsentSigned, setLscsConsentSigned] = useState(false);
  const [lscsIvAccess, setLscsIvAccess] = useState(false);
  const [lscsBloodArranged, setLscsBloodArranged] = useState(false);
  const [lscsBloodUnits, setLscsBloodUnits] = useState('2');
  const [lscsAntacidGiven, setLscsAntacidGiven] = useState(false);
  const [lscsAntibioticsGiven, setLscsAntibioticsGiven] = useState(false);
  const [lscsFoley, setLscsFoley] = useState(false);
  const [lscsAbdominalPrep, setLscsAbdominalPrep] = useState(false);
  const [lscsOtReady, setLscsOtReady] = useState(false);
  const [lscsNotes, setLscsNotes] = useState('');

  // Quick Progress State
  const [quickDilation, setQuickDilation] = useState('5');
  const [quickStation, setQuickStation] = useState('-1');
  const [quickStage, setQuickStage] = useState('active_phase');
  const [quickMembrane, setQuickMembrane] = useState('ruptured_clear');
  const [quickLocation, setQuickLocation] = useState('labor_room');

  const loadAdmissionData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api<{ admissions: MaternityAdmission[] }>(
        'GET',
        `/api/patients/${patient.id}/maternity-admissions`
      );
      setAdmissions(res.admissions);
      if (res.admissions.length > 0 && res.admissions[0]) {
        // Fetch detailed record of the latest admission
        const full = await api<MaternityAdmission>('GET', `/api/maternity-admissions/${res.admissions[0].id}`);
        setSelectedAdmission(full);
      } else {
        setSelectedAdmission(null);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [patient.id]);

  useEffect(() => {
    void loadAdmissionData();
  }, [loadAdmissionData]);

  const activeAdmission = selectedAdmission || admissions[0] || null;

  // Live Bishop Score Calculation
  const bishopResult = calculateBishopScore({
    dilation: bishopDilation,
    effacement: bishopEffacement,
    station: bishopStation,
    consistency: bishopConsistency,
    position: bishopPosition,
  });

  const handleCreateAdmission = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccessBanner(null);

    const payload = {
      admissionDate,
      laborStage,
      admissionIndication,
      indicationDetails: indicationDetails.trim() || null,
      contractionOnsetAt: contractionOnsetAt.trim() || null,
      gestationalAgeWeeks: gestationalAgeWeeks ? Number(gestationalAgeWeeks) : null,
      gestationalAgeDays: gestationalAgeDays ? Number(gestationalAgeDays) : null,
      gravida: gravida ? Number(gravida) : null,
      para: para ? Number(para) : null,
      bloodGroup: bloodGroup.trim() || null,
      allergiesSummary: allergiesSummary.trim() || null,
      highRiskAlerts: highRiskAlerts.trim() || null,
      bishopDilation,
      bishopEffacement,
      bishopStation,
      bishopConsistency,
      bishopPosition,
      membraneStatus,
      membraneRupturedAt: membraneRupturedAt.trim() || null,
      promAntibioticsGiven,
      liquorNotes: liquorNotes.trim() || null,
      fetalHeartRate: fetalHeartRate ? Number(fetalHeartRate) : null,
      fetalPresentation,
      ctgCategory,
      bpSystolic: bpSystolic ? Number(bpSystolic) : null,
      bpDiastolic: bpDiastolic ? Number(bpDiastolic) : null,
      pulse: pulse ? Number(pulse) : null,
      temperatureF: temperatureF ? Number(temperatureF) : null,
      spo2: spo2 ? Number(spo2) : null,
      urineProtein,
      currentLocation,
      attendingMidwifeNurse: attendingMidwifeNurse.trim() || null,
      primaryObstetrician: primaryObstetrician.trim() || null,
      status,
    };

    try {
      const created = await api<MaternityAdmission>('POST', `/api/patients/${patient.id}/maternity-admissions`, payload);
      setSuccessBanner('Maternity Admission Card created and patient placed on Delivery Ward Handover Board.');
      setCreating(false);
      await loadAdmissionData();
      onChanged?.();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveHandover = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeAdmission) return;
    setBusy(true);
    setError(null);
    try {
      await api('POST', `/api/maternity-admissions/${activeAdmission.id}/handover`, {
        shiftName: handoverShift,
        outgoingStaff: handoverOutgoing.trim(),
        incomingStaff: handoverIncoming.trim(),
        situation: handoverSituation.trim(),
        background: handoverBackground.trim(),
        assessment: handoverAssessment.trim(),
        recommendation: handoverRecommendation.trim(),
        urgencyLevel: handoverUrgency,
      });
      setShowHandoverModal(false);
      setSuccessBanner('SBAR shift handover note recorded successfully.');
      await loadAdmissionData();
      onChanged?.();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveOxytocin = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeAdmission) return;
    setBusy(true);
    setError(null);
    try {
      await api('POST', `/api/maternity-admissions/${activeAdmission.id}/oxytocin`, {
        infusionRateMUPerMin: Number(oxyRate),
        dropsPerMin: oxyDrops ? Number(oxyDrops) : null,
        contractionsPer10min: Number(oxyContractions),
        contractionDurationSec: Number(oxyDuration),
        contractionIntensity: oxyIntensity,
        fetalHeartRate: Number(oxyFhr),
        actionTaken: oxyAction.trim() || null,
      });
      setShowOxytocinModal(false);
      setSuccessBanner(`Oxytocin titration step (${oxyRate} mU/min) recorded.`);
      await loadAdmissionData();
      onChanged?.();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveLscsChecklist = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeAdmission) return;
    setBusy(true);
    setError(null);
    try {
      await api('PUT', `/api/maternity-admissions/${activeAdmission.id}/lscs-checklist`, {
        lscsCategory,
        decisionToDeliveryTargetMins: lscsTargetMins,
        surgicalIndication: lscsIndication.trim() || 'Fetal distress / Failure to progress',
        operatingSurgeon: lscsSurgeon.trim() || null,
        anesthetistNotified: lscsAnesthetistNotified,
        anesthetistName: lscsAnesthetistName.trim() || null,
        pediatricianNotified: lscsPediatricianNotified,
        pediatricianName: lscsPediatricianName.trim() || null,
        consentSigned: lscsConsentSigned,
        wideBoreIvAccess: lscsIvAccess,
        bloodArranged: lscsBloodArranged,
        bloodUnitsArranged: lscsBloodUnits ? Number(lscsBloodUnits) : null,
        preopAntacidGiven: lscsAntacidGiven,
        antibioticProphylaxisGiven: lscsAntibioticsGiven,
        foleyCatheterInserted: lscsFoley,
        abdominalPrepDone: lscsAbdominalPrep,
        otReady: lscsOtReady,
        notes: lscsNotes.trim() || null,
      });
      setShowLscsModal(false);
      setSuccessBanner('Emergency LSCS preparation checklist updated.');
      await loadAdmissionData();
      onChanged?.();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleQuickProgressUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeAdmission) return;
    setBusy(true);
    setError(null);
    try {
      await api('PATCH', `/api/maternity-admissions/${activeAdmission.id}`, {
        latestCervicalDilationCm: Number(quickDilation),
        latestFetalStation: quickStation,
        laborStage: quickStage,
        membraneStatus: quickMembrane,
        currentLocation: quickLocation,
      });
      setShowProgressModal(false);
      setSuccessBanner('Labor progress & cervical status updated.');
      await loadAdmissionData();
      onChanged?.();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const fe = fieldErrorsOf(error);
  const ruptureHours = calculateRuptureHours(activeAdmission?.membraneRupturedAt);
  const prolongedProm = isProlongedProm(ruptureHours);

  return (
    <div className="stack" style={{ gap: '1.25rem' }}>
      {/* Top Action Bar */}
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🏥</span> Maternity Admission & Delivery Ward Handover Board
          </h3>
          <p className="muted small" style={{ margin: '0.2rem 0 0 0' }}>
            Admission Bishop score, SBAR shift handover, active oxytocin titration, PROM timer, and emergency LSCS checklist.
          </p>
        </div>
        <div className="row wrap" style={{ gap: '0.5rem' }}>
          <Link to="/delivery-ward" className="btn small">
            📋 Delivery Ward Board
          </Link>
          {activeAdmission && (
            <Link to={`/maternity-admissions/${activeAdmission.id}/print`} className="btn small primary">
              🖨️ Print Admission & Handover Sheet
            </Link>
          )}
          {!creating && canWrite && (
            <button
              type="button"
              className="btn primary small"
              onClick={() => {
                setCreating(true);
              }}
            >
              + New Maternity Admission
            </button>
          )}
        </div>
      </div>

      <ErrorBanner error={error} />

      {successBanner && (
        <div className="banner ok" role="status">
          ✓ {successBanner}
        </div>
      )}

      {/* New Maternity Admission Form */}
      {creating ? (
        <form onSubmit={handleCreateAdmission} className="card stack" style={{ border: '2px solid #2563eb', background: '#f8fafc' }}>
          <div className="page-head" style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
            <h4 style={{ margin: 0 }}>Labor Admission Assessment & Bishop Score Card</h4>
            <div className="row" style={{ gap: '0.5rem' }}>
              <button type="button" className="btn small" onClick={() => setCreating(false)} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn primary small" disabled={busy}>
                {busy ? 'Admitting…' : 'Save & Admit to Delivery Ward'}
              </button>
            </div>
          </div>

          {/* Section 1: Clinical Presentation & Risk Profile */}
          <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem', background: '#fff' }}>
            <legend style={{ fontWeight: 600, color: '#1e293b', padding: '0 0.5rem' }}>
              1. Admission Indication & Patient Background
            </legend>
            <div className="grid-2" style={{ gap: '0.75rem' }}>
              <Field label="Admission Date" error={fe.admissionDate}>
                <input
                  type="date"
                  value={admissionDate}
                  onChange={(e) => setAdmissionDate(e.target.value)}
                  required
                />
              </Field>
              <Field label="Initial Labor Stage" error={fe.laborStage}>
                <select value={laborStage} onChange={(e) => setLaborStage(e.target.value)}>
                  {Object.entries(LABOR_STAGE_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Primary Admission Indication" error={fe.admissionIndication}>
                <select value={admissionIndication} onChange={(e) => setAdmissionIndication(e.target.value)}>
                  {Object.entries(INDICATION_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Contraction Onset Date & Time" hint="e.g. 2026-11-06 06:30">
                <input
                  type="text"
                  placeholder="YYYY-MM-DD HH:MM"
                  value={contractionOnsetAt}
                  onChange={(e) => setContractionOnsetAt(e.target.value)}
                />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <Field label="GA Weeks" error={fe.gestationalAgeWeeks}>
                  <input
                    type="number"
                    value={gestationalAgeWeeks}
                    onChange={(e) => setGestationalAgeWeeks(e.target.value)}
                  />
                </Field>
                <Field label="GA Days" error={fe.gestationalAgeDays}>
                  <input
                    type="number"
                    value={gestationalAgeDays}
                    onChange={(e) => setGestationalAgeDays(e.target.value)}
                  />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <Field label="Gravida (G)">
                  <input type="number" value={gravida} onChange={(e) => setGravida(e.target.value)} />
                </Field>
                <Field label="Para (P)">
                  <input type="number" value={para} onChange={(e) => setPara(e.target.value)} />
                </Field>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <Field label="High-Risk Obstetric Alerts & Comorbidities" hint="e.g. Previous 1 LSCS, Gestational Diabetes on Insulin, Rh Negative">
                  <input
                    type="text"
                    placeholder="Enter any critical alerts for labor ward handover"
                    value={highRiskAlerts}
                    onChange={(e) => setHighRiskAlerts(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </fieldset>

          {/* Section 2: Modified Bishop Score Calculator at Admission */}
          <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <legend style={{ fontWeight: 600, color: '#1e293b', padding: '0 0.5rem', margin: 0 }}>
                2. Cervical Assessment & Modified Bishop Score
              </legend>
              <div
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  backgroundColor:
                    bishopResult.interpretation === 'favorable'
                      ? '#dcfce7'
                      : bishopResult.interpretation === 'intermediate'
                      ? '#fef3c7'
                      : '#fee2e2',
                  color:
                    bishopResult.interpretation === 'favorable'
                      ? '#166534'
                      : bishopResult.interpretation === 'intermediate'
                      ? '#92400e'
                      : '#991b1b',
                }}
              >
                Bishop Score: {bishopResult.totalScore} / 13 — {bishopResult.label}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <Field label="Dilation">
                <select value={bishopDilation} onChange={(e) => setBishopDilation(Number(e.target.value))}>
                  {BISHOP_DILATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Effacement">
                <select value={bishopEffacement} onChange={(e) => setBishopEffacement(Number(e.target.value))}>
                  {BISHOP_EFFACEMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Station">
                <select value={bishopStation} onChange={(e) => setBishopStation(Number(e.target.value))}>
                  {BISHOP_STATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Consistency">
                <select value={bishopConsistency} onChange={(e) => setBishopConsistency(Number(e.target.value))}>
                  {BISHOP_CONSISTENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Position">
                <select value={bishopPosition} onChange={(e) => setBishopPosition(Number(e.target.value))}>
                  {BISHOP_POSITION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="small muted" style={{ margin: '0.5rem 0 0 0' }}>
              💡 <em>Clinical Advice: {bishopResult.inductionAdvice}</em>
            </p>
          </fieldset>

          {/* Section 3: Membrane Status & Rupture Tracker (PROM) */}
          <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem', background: '#fff' }}>
            <legend style={{ fontWeight: 600, color: '#1e293b', padding: '0 0.5rem' }}>
              3. Membrane Status & Rupture Tracker (PROM)
            </legend>
            <div className="grid-2" style={{ gap: '0.75rem' }}>
              <Field label="Membrane Status" error={fe.membraneStatus}>
                <select value={membraneStatus} onChange={(e) => setMembraneStatus(e.target.value)}>
                  {Object.entries(MEMBRANE_STATUS_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Rupture Date & Time" hint="e.g. 2026-11-06 04:00 (Leave empty if intact)">
                <input
                  type="text"
                  placeholder="YYYY-MM-DD HH:MM"
                  value={membraneRupturedAt}
                  onChange={(e) => setMembraneRupturedAt(e.target.value)}
                />
              </Field>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={promAntibioticsGiven}
                    onChange={(e) => setPromAntibioticsGiven(e.target.checked)}
                  />
                  PROM Antibiotic Prophylaxis Administered (e.g. IV Ampicillin / Cefazolin)
                </label>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <Field label="Liquor Description / Notes">
                  <input
                    type="text"
                    placeholder="e.g. Clear amniotic fluid draining freely / slight blood show"
                    value={liquorNotes}
                    onChange={(e) => setLiquorNotes(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </fieldset>

          {/* Section 4: Fetal Wellbeing & Maternal Baseline Vitals */}
          <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem', background: '#fff' }}>
            <legend style={{ fontWeight: 600, color: '#1e293b', padding: '0 0.5rem' }}>
              4. Fetal Wellbeing & Baseline Vitals
            </legend>
            <div className="grid-3" style={{ gap: '0.75rem' }}>
              <Field label="Fetal Heart Rate (bpm)">
                <input
                  type="number"
                  placeholder="140"
                  value={fetalHeartRate}
                  onChange={(e) => setFetalHeartRate(e.target.value)}
                />
              </Field>
              <Field label="Presentation">
                <select value={fetalPresentation} onChange={(e) => setFetalPresentation(e.target.value)}>
                  <option value="cephalic_vertex">Cephalic Vertex</option>
                  <option value="breech_frank">Breech (Frank)</option>
                  <option value="breech_complete">Breech (Complete)</option>
                  <option value="transverse_lie">Transverse Lie</option>
                  <option value="compound">Compound Presentation</option>
                </select>
              </Field>
              <Field label="CTG Category">
                <select value={ctgCategory} onChange={(e) => setCtgCategory(e.target.value)}>
                  <option value="category_1">Category I (Normal / Reassuring)</option>
                  <option value="category_2">Category II (Indeterminate)</option>
                  <option value="category_3">Category III (Abnormal / Action Required)</option>
                  <option value="not_performed">Not Performed</option>
                </select>
              </Field>
              <Field label="BP Systolic (mmHg)">
                <input
                  type="number"
                  placeholder="120"
                  value={bpSystolic}
                  onChange={(e) => setBpSystolic(e.target.value)}
                />
              </Field>
              <Field label="BP Diastolic (mmHg)">
                <input
                  type="number"
                  placeholder="80"
                  value={bpDiastolic}
                  onChange={(e) => setBpDiastolic(e.target.value)}
                />
              </Field>
              <Field label="Pulse (bpm)">
                <input
                  type="number"
                  placeholder="82"
                  value={pulse}
                  onChange={(e) => setPulse(e.target.value)}
                />
              </Field>
            </div>
          </fieldset>

          {/* Section 5: Ward Location & Attending Team */}
          <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem', background: '#fff' }}>
            <legend style={{ fontWeight: 600, color: '#1e293b', padding: '0 0.5rem' }}>
              5. Delivery Ward Location & Attending Team
            </legend>
            <div className="grid-3" style={{ gap: '0.75rem' }}>
              <Field label="Current Location">
                <select value={currentLocation} onChange={(e) => setCurrentLocation(e.target.value)}>
                  {Object.entries(LOCATION_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Attending Midwife / Nurse">
                <input
                  type="text"
                  placeholder="e.g. Nurse Priya, RN"
                  value={attendingMidwifeNurse}
                  onChange={(e) => setAttendingMidwifeNurse(e.target.value)}
                />
              </Field>
              <Field label="Primary Obstetrician">
                <input
                  type="text"
                  placeholder="e.g. Dr. Rao, MD (OBGYN)"
                  value={primaryObstetrician}
                  onChange={(e) => setPrimaryObstetrician(e.target.value)}
                />
              </Field>
            </div>
          </fieldset>

          <div className="row wrap" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn" onClick={() => setCreating(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Admitting…' : 'Save & Admit to Delivery Ward'}
            </button>
          </div>
        </form>
      ) : activeAdmission ? (
        /* Active Admission Overview Card */
        <div className="stack" style={{ gap: '1rem' }}>
          <div
            className="card stack"
            style={{
              borderLeft: `5px solid ${
                activeAdmission.lscsPrepActive
                  ? '#dc2626'
                  : activeAdmission.laborStage === 'active_phase' || activeAdmission.laborStage === 'second_stage'
                  ? '#16a34a'
                  : '#2563eb'
              }`,
              background: '#fff',
            }}
          >
            {/* Top Bar with Live Status Badges */}
            <div className="page-head" style={{ marginBottom: 0 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      background: '#dbeafe',
                      color: '#1e40af',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    📍 {LOCATION_LABELS[activeAdmission.currentLocation] || activeAdmission.currentLocation}
                  </span>
                  <span
                    style={{
                      background:
                        activeAdmission.laborStage === 'active_phase'
                          ? '#dcfce7'
                          : activeAdmission.laborStage === 'second_stage'
                          ? '#fef08a'
                          : '#f1f5f9',
                      color:
                        activeAdmission.laborStage === 'active_phase'
                          ? '#15803d'
                          : activeAdmission.laborStage === 'second_stage'
                          ? '#854d0e'
                          : '#334155',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    {LABOR_STAGE_LABELS[activeAdmission.laborStage] || activeAdmission.laborStage}
                  </span>
                  {activeAdmission.latestCervicalDilationCm != null && (
                    <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                      Cervix: {activeAdmission.latestCervicalDilationCm} cm ({activeAdmission.latestFetalStation || '0'} station)
                    </strong>
                  )}
                  {activeAdmission.lscsPrepActive && (
                    <span
                      style={{
                        background: '#fee2e2',
                        color: '#991b1b',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid #ef4444',
                      }}
                    >
                      🚨 EMERGENCY LSCS PREP ACTIVE
                    </span>
                  )}
                </div>
                <div className="muted small" style={{ marginTop: '0.3rem' }}>
                  <span>Admitted: {activeAdmission.admissionDate} · </span>
                  {activeAdmission.admissionIndication && (
                    <span>Reason: {INDICATION_LABELS[activeAdmission.admissionIndication] || activeAdmission.admissionIndication} · </span>
                  )}
                  {activeAdmission.primaryObstetrician && <span>Attending: {activeAdmission.primaryObstetrician} · </span>}
                  <span>GA: {activeAdmission.gestationalAgeWeeks ? `${activeAdmission.gestationalAgeWeeks}w` : 'Term'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="row wrap no-print" style={{ gap: '0.4rem' }}>
                {canWrite && (
                  <>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => {
                        setQuickDilation(activeAdmission.latestCervicalDilationCm != null ? String(activeAdmission.latestCervicalDilationCm) : '5');
                        setQuickStation(activeAdmission.latestFetalStation || '-1');
                        setQuickStage(activeAdmission.laborStage);
                        setQuickMembrane(activeAdmission.membraneStatus);
                        setQuickLocation(activeAdmission.currentLocation);
                        setShowProgressModal(true);
                      }}
                    >
                      📏 Update Progress
                    </button>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => {
                        setHandoverSituation(`Patient in ${LOCATION_LABELS[activeAdmission.currentLocation]}. Active labor at ${activeAdmission.latestCervicalDilationCm ?? '—'} cm.`);
                        setHandoverBackground(`G${activeAdmission.gravida || 1} P${activeAdmission.para || 0}, ${activeAdmission.gestationalAgeWeeks || 39}w. ${activeAdmission.highRiskAlerts || 'No prior complications'}.`);
                        setHandoverAssessment(`Contractions regular, FHR baseline ${activeAdmission.fetalHeartRate || 140} bpm (${activeAdmission.ctgCategory}). Membranes: ${activeAdmission.membraneStatus}.`);
                        setHandoverRecommendation('Continue 1-to-1 midwifery care. Next VE due in 2 hours. Review CTG trace.');
                        setShowHandoverModal(true);
                      }}
                    >
                      ✍️ SBAR Handover
                    </button>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => setShowOxytocinModal(true)}
                    >
                      💉 Titrate Oxytocin
                    </button>
                    <button
                      type="button"
                      className={`btn small ${activeAdmission.lscsPrepActive ? 'danger' : ''}`}
                      onClick={() => setShowLscsModal(true)}
                    >
                      🚨 Emergency LSCS Prep
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* High-Risk Alerts Banner */}
            {activeAdmission.highRiskAlerts && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}>
                <strong style={{ color: '#991b1b' }}>⚠️ High-Risk Labor Alert: </strong>
                <span style={{ color: '#7f1d1d' }}>{activeAdmission.highRiskAlerts}</span>
              </div>
            )}

            {/* Grid of Key Labor Parameters */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '0.75rem',
                borderTop: '1px solid #f1f5f9',
                paddingTop: '0.75rem',
              }}
            >
              {/* Bishop Score Box */}
              <div style={{ background: '#f8fafc', padding: '0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <strong style={{ fontSize: '0.85rem' }}>Cervical Bishop Score</strong>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor:
                        activeAdmission.bishopInterpretation === 'favorable'
                          ? '#dcfce7'
                          : activeAdmission.bishopInterpretation === 'intermediate'
                          ? '#fef3c7'
                          : '#fee2e2',
                      color:
                        activeAdmission.bishopInterpretation === 'favorable'
                          ? '#166534'
                          : activeAdmission.bishopInterpretation === 'intermediate'
                          ? '#92400e'
                          : '#991b1b',
                    }}
                  >
                    {activeAdmission.bishopTotalScore} / 13 ({activeAdmission.bishopInterpretation.toUpperCase()})
                  </span>
                </div>
                <div className="small muted" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.2rem' }}>
                  <span>Dil: {activeAdmission.bishopDilation}</span>
                  <span>Eff: {activeAdmission.bishopEffacement}</span>
                  <span>Stat: {activeAdmission.bishopStation}</span>
                  <span>Cons: {activeAdmission.bishopConsistency}</span>
                  <span>Pos: {activeAdmission.bishopPosition}</span>
                </div>
              </div>

              {/* Membrane Status & PROM Tracker Box */}
              <div
                style={{
                  background: prolongedProm ? '#fff1f2' : '#f8fafc',
                  border: `1px solid ${prolongedProm ? '#fecdd3' : '#e2e8f0'}`,
                  padding: '0.6rem',
                  borderRadius: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <strong style={{ fontSize: '0.85rem' }}>Membranes & PROM Tracker</strong>
                  {prolongedProm && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#e11d48', background: '#ffe4e6', padding: '2px 6px', borderRadius: '4px' }}>
                      ⚠️ &gt;18h Prolonged PROM
                    </span>
                  )}
                </div>
                <div className="small">
                  <div>
                    <strong>Status:</strong> {MEMBRANE_STATUS_LABELS[activeAdmission.membraneStatus] || activeAdmission.membraneStatus}
                  </div>
                  {activeAdmission.membraneRupturedAt && (
                    <div style={{ color: prolongedProm ? '#be123c' : '#334155' }}>
                      Ruptured: {activeAdmission.membraneRupturedAt} ({ruptureHours != null ? `${ruptureHours} hrs` : '—'})
                    </div>
                  )}
                  <div style={{ marginTop: '0.2rem' }}>
                    Antibiotics:{' '}
                    <strong>{activeAdmission.promAntibioticsGiven ? '✓ Administered' : '✗ Not Recorded'}</strong>
                  </div>
                </div>
              </div>

              {/* Fetal & Maternal Vitals Box */}
              <div style={{ background: '#f8fafc', padding: '0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '0.85rem' }}>Fetal & Maternal Monitoring</strong>
                <div className="small" style={{ marginTop: '0.3rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
                  <div>FHR: <strong>{activeAdmission.fetalHeartRate ? `${activeAdmission.fetalHeartRate} bpm` : '—'}</strong></div>
                  <div>CTG: <strong>{activeAdmission.ctgCategory.toUpperCase()}</strong></div>
                  <div>BP: <strong>{activeAdmission.bpSystolic || '—'}/{activeAdmission.bpDiastolic || '—'} mmHg</strong></div>
                  <div>Pulse: <strong>{activeAdmission.pulse ? `${activeAdmission.pulse} bpm` : '—'}</strong></div>
                  <div>Temp: <strong>{activeAdmission.temperatureF ? `${activeAdmission.temperatureF}°F` : '98.4°F'}</strong></div>
                  <div>Oxytocin: <strong style={{ color: '#2563eb' }}>{activeAdmission.activeOxytocinRate || 'None'}</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* SBAR Shift Handover History */}
          <div className="card stack">
            <div className="page-head" style={{ marginBottom: 0 }}>
              <h4 style={{ margin: 0 }}>SBAR Shift Handover Records</h4>
              {canWrite && (
                <button
                  type="button"
                  className="btn small primary"
                  onClick={() => {
                    setHandoverSituation(`Patient in ${LOCATION_LABELS[activeAdmission.currentLocation]}. Active labor at ${activeAdmission.latestCervicalDilationCm ?? '—'} cm.`);
                    setHandoverBackground(`G${activeAdmission.gravida || 1} P${activeAdmission.para || 0}, ${activeAdmission.gestationalAgeWeeks || 39}w. ${activeAdmission.highRiskAlerts || 'No prior complications'}.`);
                    setHandoverAssessment(`Contractions regular, FHR baseline ${activeAdmission.fetalHeartRate || 140} bpm (${activeAdmission.ctgCategory}). Membranes: ${activeAdmission.membraneStatus}.`);
                    setHandoverRecommendation('Continue 1-to-1 midwifery care. Next VE due in 2 hours. Review CTG trace.');
                    setShowHandoverModal(true);
                  }}
                >
                  + Add SBAR Shift Note
                </button>
              )}
            </div>

            {(!activeAdmission.handovers || activeAdmission.handovers.length === 0) ? (
              <p className="muted small">No SBAR shift handover notes recorded yet for this admission.</p>
            ) : (
              <div className="stack" style={{ gap: '0.75rem' }}>
                {activeAdmission.handovers.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      background: h.urgencyLevel === 'immediate_attention' ? '#fff1f2' : h.urgencyLevel === 'watch_closely' ? '#fffbeb' : '#f8fafc',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <div>
                        <strong>{h.shiftName.toUpperCase()} SHIFT HANDOVER</strong>
                        <span className="muted small"> · {h.handoverAt} · Handed from {h.outgoingStaff} to {h.incomingStaff}</span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor:
                            h.urgencyLevel === 'immediate_attention'
                              ? '#fee2e2'
                              : h.urgencyLevel === 'watch_closely'
                              ? '#fef3c7'
                              : '#dbeafe',
                          color:
                            h.urgencyLevel === 'immediate_attention'
                              ? '#991b1b'
                              : h.urgencyLevel === 'watch_closely'
                              ? '#92400e'
                              : '#1e40af',
                        }}
                      >
                        {h.urgencyLevel.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <div style={{ background: '#fff', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <strong style={{ color: '#0369a1' }}>S (Situation):</strong>
                        <p style={{ margin: '0.2rem 0 0 0' }}>{h.situation}</p>
                      </div>
                      <div style={{ background: '#fff', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <strong style={{ color: '#475569' }}>B (Background):</strong>
                        <p style={{ margin: '0.2rem 0 0 0' }}>{h.background}</p>
                      </div>
                      <div style={{ background: '#fff', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <strong style={{ color: '#047857' }}>A (Assessment):</strong>
                        <p style={{ margin: '0.2rem 0 0 0' }}>{h.assessment}</p>
                      </div>
                      <div style={{ background: '#fff', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <strong style={{ color: '#b45309' }}>R (Recommendation):</strong>
                        <p style={{ margin: '0.2rem 0 0 0' }}>{h.recommendation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Oxytocin Infusion Titration Log */}
          <div className="card stack">
            <div className="page-head" style={{ marginBottom: 0 }}>
              <h4 style={{ margin: 0 }}>Oxytocin Infusion Titration Flow</h4>
              {canWrite && (
                <button
                  type="button"
                  className="btn small"
                  onClick={() => setShowOxytocinModal(true)}
                >
                  + Add Titration Step
                </button>
              )}
            </div>

            {(!activeAdmission.oxytocinLogs || activeAdmission.oxytocinLogs.length === 0) ? (
              <p className="muted small">No oxytocin titration entries logged yet for this admission.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '6px' }}>Time</th>
                    <th style={{ padding: '6px' }}>Rate (mU/min)</th>
                    <th style={{ padding: '6px' }}>Drops/min</th>
                    <th style={{ padding: '6px' }}>Contractions / 10m</th>
                    <th style={{ padding: '6px' }}>Duration (s)</th>
                    <th style={{ padding: '6px' }}>FHR (bpm)</th>
                    <th style={{ padding: '6px' }}>Action Taken</th>
                    <th style={{ padding: '6px' }}>Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAdmission.oxytocinLogs.map((o) => (
                    <tr
                      key={o.id}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: o.hyperstimulationNoted ? '#fee2e2' : undefined,
                      }}
                    >
                      <td style={{ padding: '6px' }}>{o.loggedAt.slice(11, 16) || o.loggedAt}</td>
                      <td style={{ padding: '6px' }}>
                        <strong>{o.infusionRateMUPerMin}</strong>
                      </td>
                      <td style={{ padding: '6px' }}>{o.dropsPerMin ?? '—'}</td>
                      <td style={{ padding: '6px' }}>
                        {o.contractionsPer10min} / 10m
                        {o.hyperstimulationNoted && <span style={{ color: '#dc2626', fontWeight: 700 }}> (Tachysystole!)</span>}
                      </td>
                      <td style={{ padding: '6px' }}>{o.contractionDurationSec}s ({o.contractionIntensity})</td>
                      <td style={{ padding: '6px' }}>{o.fetalHeartRate}</td>
                      <td style={{ padding: '6px' }}>{o.actionTaken || '—'}</td>
                      <td style={{ padding: '6px' }}>{o.loggedByName || 'Staff'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Emergency LSCS Surgical Readiness Card */}
          {activeAdmission.emergencyLscsChecklist && (
            <div
              className="card stack"
              style={{
                border: '2px solid #ef4444',
                background: '#fff5f5',
              }}
            >
              <div className="page-head" style={{ marginBottom: 0 }}>
                <div>
                  <h4 style={{ margin: 0, color: '#991b1b' }}>🚨 Emergency LSCS Surgical Readiness Checklist</h4>
                  <div className="small muted" style={{ color: '#7f1d1d' }}>
                    Indication: <strong>{activeAdmission.emergencyLscsChecklist.surgicalIndication}</strong> · Decision: {activeAdmission.emergencyLscsChecklist.decisionAt} · Target: {activeAdmission.emergencyLscsChecklist.decisionToDeliveryTargetMins} mins
                  </div>
                </div>
                {canWrite && (
                  <button type="button" className="btn small danger" onClick={() => setShowLscsModal(true)}>
                    ✏️ Update Checklist
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div>Anesthetist Notified: <strong>{activeAdmission.emergencyLscsChecklist.anesthetistNotified ? '✓ Yes' : '✗ Pending'}</strong></div>
                <div>Pediatrician Notified: <strong>{activeAdmission.emergencyLscsChecklist.pediatricianNotified ? '✓ Yes' : '✗ Pending'}</strong></div>
                <div>Consent Signed: <strong>{activeAdmission.emergencyLscsChecklist.consentSigned ? '✓ Yes' : '✗ Pending'}</strong></div>
                <div>16G/18G IV Access: <strong>{activeAdmission.emergencyLscsChecklist.wideBoreIvAccess ? '✓ Patent' : '✗ Pending'}</strong></div>
                <div>Blood Arranged: <strong>{activeAdmission.emergencyLscsChecklist.bloodArranged ? `✓ Yes (${activeAdmission.emergencyLscsChecklist.bloodUnitsArranged || 2} units)` : '✗ Pending'}</strong></div>
                <div>Pre-op Antacid: <strong>{activeAdmission.emergencyLscsChecklist.preopAntacidGiven ? '✓ Given' : '✗ Pending'}</strong></div>
                <div>Antibiotic Prophylaxis: <strong>{activeAdmission.emergencyLscsChecklist.antibioticProphylaxisGiven ? '✓ Given' : '✗ Pending'}</strong></div>
                <div>Foley Catheter: <strong>{activeAdmission.emergencyLscsChecklist.foleyCatheterInserted ? '✓ Inserted' : '✗ Pending'}</strong></div>
                <div>Abdominal Prep: <strong>{activeAdmission.emergencyLscsChecklist.abdominalPrepDone ? '✓ Completed' : '✗ Pending'}</strong></div>
                <div>OT Ready: <strong style={{ color: activeAdmission.emergencyLscsChecklist.otReady ? '#16a34a' : '#dc2626' }}>{activeAdmission.emergencyLscsChecklist.otReady ? '✓ READY' : '✗ PENDING'}</strong></div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p className="muted" style={{ margin: 0 }}>
            No active maternity admission record found for this patient.
          </p>
          {canWrite && (
            <button
              type="button"
              className="btn primary small"
              style={{ marginTop: '0.75rem' }}
              onClick={() => setCreating(true)}
            >
              + Create Labor Admission Assessment
            </button>
          )}
        </div>
      )}

      {/* MODAL 1: SBAR Shift Handover Note */}
      {showHandoverModal && (
        <div className="modal-backdrop">
          <div className="modal-card stack" style={{ maxWidth: '640px' }}>
            <div className="page-head">
              <h4 style={{ margin: 0 }}>Record SBAR Shift Handover</h4>
              <button type="button" className="btn small" onClick={() => setShowHandoverModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveHandover} className="stack" style={{ gap: '0.75rem' }}>
              <div className="grid-3" style={{ gap: '0.5rem' }}>
                <Field label="Shift">
                  <select value={handoverShift} onChange={(e) => setHandoverShift(e.target.value as any)}>
                    <option value="morning">Morning Shift</option>
                    <option value="evening">Evening Shift</option>
                    <option value="night">Night Shift</option>
                  </select>
                </Field>
                <Field label="Outgoing Staff">
                  <input
                    type="text"
                    required
                    placeholder="Staff handing over"
                    value={handoverOutgoing}
                    onChange={(e) => setHandoverOutgoing(e.target.value)}
                  />
                </Field>
                <Field label="Incoming Staff">
                  <input
                    type="text"
                    required
                    placeholder="Staff taking over"
                    value={handoverIncoming}
                    onChange={(e) => setHandoverIncoming(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="S — Situation (Current location, active problem, cervical status)">
                <textarea
                  rows={2}
                  required
                  value={handoverSituation}
                  onChange={(e) => setHandoverSituation(e.target.value)}
                />
              </Field>
              <Field label="B — Background (Parity, GA, high risk flags, blood group, allergies)">
                <textarea
                  rows={2}
                  required
                  value={handoverBackground}
                  onChange={(e) => setHandoverBackground(e.target.value)}
                />
              </Field>
              <Field label="A — Assessment (Contractions, FHR, CTG trace, membranes, vitals)">
                <textarea
                  rows={2}
                  required
                  value={handoverAssessment}
                  onChange={(e) => setHandoverAssessment(e.target.value)}
                />
              </Field>
              <Field label="R — Recommendation (Next VE time, Oxytocin plan, pending labs, CTG review)">
                <textarea
                  rows={2}
                  required
                  value={handoverRecommendation}
                  onChange={(e) => setHandoverRecommendation(e.target.value)}
                />
              </Field>

              <Field label="Clinical Urgency Level">
                <select value={handoverUrgency} onChange={(e) => setHandoverUrgency(e.target.value as any)}>
                  <option value="routine">Routine (Stable Labor Progression)</option>
                  <option value="watch_closely">Watch Closely (Borderline CTG / High Risk)</option>
                  <option value="immediate_attention">Immediate Attention (Abnormal CTG / Sepsis / Impending LSCS)</option>
                </select>
              </Field>

              <div className="row wrap" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowHandoverModal(false)} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Record Handover'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Oxytocin Titration Step */}
      {showOxytocinModal && (
        <div className="modal-backdrop">
          <div className="modal-card stack" style={{ maxWidth: '540px' }}>
            <div className="page-head">
              <h4 style={{ margin: 0 }}>Oxytocin Titration Step</h4>
              <button type="button" className="btn small" onClick={() => setShowOxytocinModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveOxytocin} className="stack" style={{ gap: '0.75rem' }}>
              <div className="grid-2" style={{ gap: '0.5rem' }}>
                <Field label="Infusion Rate (mU/min)">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="40"
                    required
                    value={oxyRate}
                    onChange={(e) => setOxyRate(e.target.value)}
                  />
                </Field>
                <Field label="Drops / min (estimated)">
                  <input
                    type="number"
                    value={oxyDrops}
                    onChange={(e) => setOxyDrops(e.target.value)}
                  />
                </Field>
                <Field label="Contractions in 10 mins">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    required
                    value={oxyContractions}
                    onChange={(e) => setOxyContractions(e.target.value)}
                  />
                </Field>
                <Field label="Contraction Duration (seconds)">
                  <input
                    type="number"
                    min="10"
                    max="180"
                    required
                    value={oxyDuration}
                    onChange={(e) => setOxyDuration(e.target.value)}
                  />
                </Field>
                <Field label="Contraction Intensity">
                  <select value={oxyIntensity} onChange={(e) => setOxyIntensity(e.target.value as any)}>
                    <option value="mild">Mild (Indents easily)</option>
                    <option value="moderate">Moderate (Slight indent)</option>
                    <option value="strong">Strong (Firm as forehead)</option>
                  </select>
                </Field>
                <Field label="Fetal Heart Rate Baseline (bpm)">
                  <input
                    type="number"
                    required
                    value={oxyFhr}
                    onChange={(e) => setOxyFhr(e.target.value)}
                  />
                </Field>
              </div>

              {isTachysystole(Number(oxyContractions), Number(oxyDuration)) && (
                <div style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '4px', padding: '0.5rem', color: '#991b1b', fontSize: '0.85rem' }}>
                  <strong>⚠️ UTERINE TACHYSYSTOLE DETECTED!</strong>
                  <div>More than 5 contractions in 10 mins or duration &gt; 90 seconds. Immediately consider pausing or reducing oxytocin infusion and verify fetal heart rate.</div>
                </div>
              )}

              <Field label="Clinical Action Taken">
                <input
                  type="text"
                  value={oxyAction}
                  onChange={(e) => setOxyAction(e.target.value)}
                />
              </Field>

              <div className="row wrap" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowOxytocinModal(false)} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Record Titration Step'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Emergency LSCS Prep Checklist */}
      {showLscsModal && (
        <div className="modal-backdrop">
          <div className="modal-card stack" style={{ maxWidth: '640px' }}>
            <div className="page-head">
              <h4 style={{ margin: 0, color: '#dc2626' }}>Emergency LSCS Preparation Checklist</h4>
              <button type="button" className="btn small" onClick={() => setShowLscsModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveLscsChecklist} className="stack" style={{ gap: '0.75rem' }}>
              <div className="grid-2" style={{ gap: '0.5rem' }}>
                <Field label="LSCS Urgency Category">
                  <select value={lscsCategory} onChange={(e) => {
                    setLscsCategory(e.target.value);
                    setLscsTargetMins(e.target.value === 'category_1_immediate_threat' ? 30 : 75);
                  }}>
                    <option value="category_1_immediate_threat">Category 1 — Immediate Threat to Life (Target: ≤ 30 mins)</option>
                    <option value="category_2_maternal_fetal_compromise">Category 2 — Maternal/Fetal Compromise (Target: ≤ 75 mins)</option>
                    <option value="category_3_early_delivery">Category 3 — Early Delivery Required</option>
                    <option value="category_4_elective">Category 4 — Elective Cesarean</option>
                  </select>
                </Field>
                <Field label="Target Delivery Time (mins)">
                  <input
                    type="number"
                    value={lscsTargetMins}
                    onChange={(e) => setLscsTargetMins(Number(e.target.value))}
                  />
                </Field>
                <div style={{ gridColumn: 'span 2' }}>
                  <Field label="Surgical Indication">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Fetal bradycardia / Cord prolapse / Failed progress in active phase"
                      value={lscsIndication}
                      onChange={(e) => setLscsIndication(e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Operating Surgeon">
                  <input
                    type="text"
                    value={lscsSurgeon}
                    onChange={(e) => setLscsSurgeon(e.target.value)}
                  />
                </Field>
                <Field label="Anesthetist Name">
                  <input
                    type="text"
                    value={lscsAnesthetistName}
                    onChange={(e) => setLscsAnesthetistName(e.target.value)}
                  />
                </Field>
              </div>

              {/* Checklist Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', background: '#f8fafc', padding: '0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={lscsAnesthetistNotified}
                    onChange={(e) => setLscsAnesthetistNotified(e.target.checked)}
                  />
                  Anesthetist Notified
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={lscsPediatricianNotified}
                    onChange={(e) => setLscsPediatricianNotified(e.target.checked)}
                  />
                  Pediatrician / NICU Standby Notified
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={lscsConsentSigned}
                    onChange={(e) => setLscsConsentSigned(e.target.checked)}
                  />
                  Emergency Surgical Consent Signed
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={lscsIvAccess}
                    onChange={(e) => setLscsIvAccess(e.target.checked)}
                  />
                  16G / 18G Wide-Bore IV Cannula Patent
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={lscsBloodArranged}
                    onChange={(e) => setLscsBloodArranged(e.target.checked)}
                  />
                  PRBC Blood Units Arranged / Crossmatched
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={lscsAntacidGiven}
                    onChange={(e) => setLscsAntacidGiven(e.target.checked)}
                  />
                  Pre-op Antacid Prophylaxis Given
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={lscsAntibioticsGiven}
                    onChange={(e) => setLscsAntibioticsGiven(e.target.checked)}
                  />
                  Surgical Antibiotic Prophylaxis (Cefazolin)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={lscsFoley}
                    onChange={(e) => setLscsFoley(e.target.checked)}
                  />
                  Foley Catheterization Done
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={lscsAbdominalPrep}
                    onChange={(e) => setLscsAbdominalPrep(e.target.checked)}
                  />
                  Abdominal Preparation Completed
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: '#16a34a' }}>
                  <input
                    type="checkbox"
                    checked={lscsOtReady}
                    onChange={(e) => setLscsOtReady(e.target.checked)}
                  />
                  Operating Theatre READY & Transfer Safe
                </label>
              </div>

              <Field label="Special Clinical Instructions / Allergies / Notes">
                <input
                  type="text"
                  value={lscsNotes}
                  onChange={(e) => setLscsNotes(e.target.value)}
                />
              </Field>

              <div className="row wrap" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowLscsModal(false)} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className="btn danger" disabled={busy}>
                  {busy ? 'Saving…' : 'Save Emergency LSCS Readiness'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Quick Progress & Dilation Update */}
      {showProgressModal && (
        <div className="modal-backdrop">
          <div className="modal-card stack" style={{ maxWidth: '480px' }}>
            <div className="page-head">
              <h4 style={{ margin: 0 }}>Update Labor Progression</h4>
              <button type="button" className="btn small" onClick={() => setShowProgressModal(false)}>✕</button>
            </div>
            <form onSubmit={handleQuickProgressUpdate} className="stack" style={{ gap: '0.75rem' }}>
              <div className="grid-2" style={{ gap: '0.5rem' }}>
                <Field label="Cervical Dilation (cm)">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    required
                    value={quickDilation}
                    onChange={(e) => setQuickDilation(e.target.value)}
                  />
                </Field>
                <Field label="Fetal Station">
                  <input
                    type="text"
                    placeholder="e.g. -2, -1, 0, +1"
                    value={quickStation}
                    onChange={(e) => setQuickStation(e.target.value)}
                  />
                </Field>
                <Field label="Labor Stage">
                  <select value={quickStage} onChange={(e) => setQuickStage(e.target.value)}>
                    {Object.entries(LABOR_STAGE_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Membrane Status">
                  <select value={quickMembrane} onChange={(e) => setQuickMembrane(e.target.value)}>
                    {Object.entries(MEMBRANE_STATUS_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </Field>
                <div style={{ gridColumn: 'span 2' }}>
                  <Field label="Current Location">
                    <select value={quickLocation} onChange={(e) => setQuickLocation(e.target.value)}>
                      {Object.entries(LOCATION_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <div className="row wrap" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowProgressModal(false)} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Save Progress'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
