import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, type ObstetricDischargeSummary, type Patient } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, Field, fieldErrorsOf, todayLocal } from './ui';

export const DELIVERY_MODE_LABELS: Record<string, string> = {
  normal_vaginal: 'Normal Vaginal Delivery',
  assisted_vacuum: 'Vacuum Assisted Vaginal Delivery',
  assisted_forceps: 'Forceps Assisted Vaginal Delivery',
  elective_lscs: 'Elective LSCS (Cesarean)',
  emergency_lscs: 'Emergency LSCS (Cesarean)',
  vbac: 'VBAC (Vaginal Birth After Cesarean)',
};

export const PERINEUM_WOUND_LABELS: Record<string, string> = {
  intact: 'Intact Perineum',
  episiotomy_healed: 'Episiotomy Clean / Healing',
  perineal_tear_repaired: 'Perineal Tear Repaired Cleanly',
  lscs_wound_clean: 'LSCS Abdominal Wound Clean & Dry',
  superficial_dehiscence: 'Superficial Dehiscence',
  infected: 'Infected / Indurated Wound',
  other: 'Other Perineal / Wound Status',
};

export const FUNDAL_INVOLUTION_LABELS: Record<string, string> = {
  contracted_normal: 'Normal Involution (Firm)',
  well_contracted: 'Well Contracted / Hard',
  subinvoluted: 'Subinvoluted (Delayed Involution)',
  tender: 'Tender Uterus',
  boggy: 'Boggy / Soft Uterus',
};

export const LOCHIA_LABELS: Record<string, string> = {
  rubra: 'Lochia Rubra (Normal Red)',
  serosa: 'Lochia Serosa (Pinkish-Brown)',
  alba: 'Lochia Alba (Yellowish-White)',
  excessive: 'Excessive Lochia (Warning)',
  foul_smelling: 'Foul-Smelling Lochia (Warning/Infection)',
};

export const LACTATION_LABELS: Record<string, string> = {
  established: 'Lactation Established & Copious',
  initiating: 'Colostrum / Milk Initiating',
  suppressed: 'Lactation Suppressed (Elective/Medical)',
  cracked_nipples: 'Cracked / Painful Nipples',
  engorgement: 'Breast Engorgement',
  mastitis: 'Suspected Mastitis',
};

export const CONTRACEPTION_LABELS: Record<string, string> = {
  ppiucd_inserted: 'PPIUCD Inserted (Postpartum IUD)',
  progestin_only_pill: 'Progestin-Only Pill (POP / Minipill)',
  lactational_amenorrhea: 'Lactational Amenorrhea Method (LAM)',
  barrier_condom: 'Barrier Method (Condoms)',
  tubal_sterilization: 'Puerperal Sterilization (Tubectomy)',
  inj_depo: 'Injectable DMPA (Depo-Provera)',
  undecided: 'Undecided / Counselled',
  none: 'Declined / None',
};

export const FEEDING_LABELS: Record<string, string> = {
  exclusive_breastfeeding: 'Exclusive Breastfeeding (EBF)',
  expressed_breast_milk: 'Expressed Breast Milk (EBM)',
  mixed_feeding: 'Mixed Feeding (Breast + Formula)',
  formula_feeding: 'Formula Feeding Only',
};

export const JAUNDICE_LABELS: Record<string, string> = {
  none: 'No Jaundice Observed',
  mild_physiological: 'Mild Physiological Jaundice',
  phototherapy_required: 'Phototherapy Required',
  pathological: 'Pathological / High Risk Jaundice',
};

export const CRY_LABELS: Record<string, string> = {
  immediate_vigorous: 'Immediate & Vigorous Cry',
  delayed: 'Delayed Cry',
  required_stimulation: 'Required Tactile Stimulation',
  none: 'No Cry / Active Resuscitation Required',
};

interface ObstetricDischargeManagerProps {
  patient: Patient;
}

export function ObstetricDischargeManager({ patient }: ObstetricDischargeManagerProps) {
  const { can } = useAuth();
  const canWrite = can('patient:write_clinical') || can('care:write_nursing') || can('discharge:write');

  const [discharges, setDischarges] = useState<ObstetricDischargeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [babyRegisteringId, setBabyRegisteringId] = useState<number | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Form State
  const [dischargeDate, setDischargeDate] = useState(todayLocal());
  const [deliveryAt, setDeliveryAt] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<string>('normal_vaginal');
  const [deliveryIndication, setDeliveryIndication] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [primaryObstetrician, setPrimaryObstetrician] = useState('');

  // Maternal Puerperium & Vitals
  const [perineumWoundStatus, setPerineumWoundStatus] = useState<string>('intact');
  const [perineumNotes, setPerineumNotes] = useState('');
  const [fundalInvolution, setFundalInvolution] = useState<string>('contracted_normal');
  const [fundalHeightCm, setFundalHeightCm] = useState('Firm at 20w size (umbilicus)');
  const [lochiaCharacter, setLochiaCharacter] = useState<string>('rubra');
  const [lochiaNotes, setLochiaNotes] = useState('');
  const [lactationStatus, setLactationStatus] = useState<string>('established');
  const [breastExamination, setBreastExamination] = useState('Soft, non-tender, nipples healthy');
  const [bladderBowelStatus, setBladderBowelStatus] = useState('Voiding freely, bowels moved normal');

  const [dischargeBpSystolic, setDischargeBpSystolic] = useState<string>('120');
  const [dischargeBpDiastolic, setDischargeBpDiastolic] = useState<string>('80');
  const [dischargePulse, setDischargePulse] = useState<string>('78');
  const [dischargeTempF, setDischargeTempF] = useState<string>('98.4');
  const [dischargeSpo2, setDischargeSpo2] = useState<string>('99');

  // Contraception & Advice
  const [contraceptionCounselled, setContraceptionCounselled] = useState(true);
  const [contraceptionChosen, setContraceptionChosen] = useState<string>('undecided');
  const [contraceptionNotes, setContraceptionNotes] = useState('');
  const [dischargeMedicinesText, setDischargeMedicinesText] = useState(
    '1. Tab. Ferrous Ascorbate 100mg OD x 3 months\n2. Tab. Calcium Carbonate 500mg BD x 3 months\n3. Tab. Paracetamol 650mg SOS for pain'
  );
  const [alarmSignsCounselled, setAlarmSignsCounselled] = useState(true);

  // Newborn Details
  const [babyName, setBabyName] = useState(`Baby of ${patient.fullName}`);
  const [babyGender, setBabyGender] = useState<'female' | 'male' | 'ambiguous'>('female');
  const [babyBirthWeightGrams, setBabyBirthWeightGrams] = useState<string>('3000');
  const [babyDischargeWeightGrams, setBabyDischargeWeightGrams] = useState<string>('2920');
  const [babyLengthCm, setBabyLengthCm] = useState<string>('49.5');
  const [babyHcCm, setBabyHcCm] = useState<string>('34.0');
  const [babyGestationalAgeWeeks, setBabyGestationalAgeWeeks] = useState<string>('39');
  const [babyGestationalAgeDays, setBabyGestationalAgeDays] = useState<string>('2');
  const [babyApgar1min, setBabyApgar1min] = useState<string>('8');
  const [babyApgar5min, setBabyApgar5min] = useState<string>('9');
  const [babyCryAtBirth, setBabyCryAtBirth] = useState<string>('immediate_vigorous');
  const [babyResuscitationDetails, setBabyResuscitationDetails] = useState('Routine suction and drying, skin-to-skin given');
  const [babyBloodGroup, setBabyBloodGroup] = useState('');

  // Neonatal Exam
  const [neonatalFeedingMethod, setNeonatalFeedingMethod] = useState<string>('exclusive_breastfeeding');
  const [meconiumPassed, setMeconiumPassed] = useState(true);
  const [urinePassed, setUrinePassed] = useState(true);
  const [jaundiceAssessment, setJaundiceAssessment] = useState<string>('none');
  const [neonatalExam, setNeonatalExam] = useState<Record<string, string>>({
    tone: 'Active, good tone and suck reflex',
    fontanelle: 'Soft and flat, sutures normal',
    palate: 'Intact, no cleft or defect',
    eyes: 'Clear, red reflex present bilaterally',
    cardiopulmonary: 'Heart sounds normal (S1 S2), chest clear, no murmurs',
    abdomen: 'Soft, no hepatosplenomegaly',
    cord: 'Clean and dry, 2 arteries and 1 vein visible, no discharge',
    genitalia: 'Normal female/male anatomy, bilateral testes descended if male',
    anus: 'Patent anus verified, meconium passed',
    hips_spine: 'Barlow/Ortolani negative, spine straight and intact',
  });

  // Immunization & Screening
  const [bcgGiven, setBcgGiven] = useState(true);
  const [bcgDate, setBcgDate] = useState(todayLocal());
  const [opvZeroGiven, setOpvZeroGiven] = useState(true);
  const [opvZeroDate, setOpvZeroDate] = useState(todayLocal());
  const [hepbBirthGiven, setHepbBirthGiven] = useState(true);
  const [hepbBirthDate, setHepbBirthDate] = useState(todayLocal());
  const [hearingScreenResult, setHearingScreenResult] = useState<'pass' | 'refer' | 'not_screened'>('pass');
  const [metabolicScreenResult, setMetabolicScreenResult] = useState<'normal' | 'pending' | 'abnormal' | 'not_screened'>('normal');

  // Follow-up
  const [maternalFollowupDate, setMaternalFollowupDate] = useState('');
  const [newbornFollowupDate, setNewbornFollowupDate] = useState('');
  const [consultantSpecialInstructions, setConsultantSpecialInstructions] = useState('Return immediately if heavy vaginal bleeding, high fever, severe abdominal pain, or calf swelling.');
  const [status, setStatus] = useState<'draft' | 'finalized'>('finalized');
  const [autoCreateBabyPatient, setAutoCreateBabyPatient] = useState(true);

  const loadDischarges = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api<{ discharges: ObstetricDischargeSummary[] }>('GET', `/api/patients/${patient.id}/obstetric-discharges`);
      setDischarges(res.discharges);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [patient.id]);

  useEffect(() => {
    void loadDischarges();
  }, [loadDischarges]);

  const resetForm = () => {
    setDischargeDate(todayLocal());
    setDeliveryAt('');
    setDeliveryMode('normal_vaginal');
    setDeliveryIndication('');
    setDeliveryNotes('');
    setPrimaryObstetrician('');
    setPerineumWoundStatus('intact');
    setPerineumNotes('');
    setFundalInvolution('contracted_normal');
    setFundalHeightCm('Firm at 20w size (umbilicus)');
    setLochiaCharacter('rubra');
    setLochiaNotes('');
    setLactationStatus('established');
    setBreastExamination('Soft, non-tender, nipples healthy');
    setBladderBowelStatus('Voiding freely, bowels moved normal');
    setDischargeBpSystolic('120');
    setDischargeBpDiastolic('80');
    setDischargePulse('78');
    setDischargeTempF('98.4');
    setDischargeSpo2('99');
    setContraceptionCounselled(true);
    setContraceptionChosen('undecided');
    setContraceptionNotes('');
    setDischargeMedicinesText('1. Tab. Ferrous Ascorbate 100mg OD x 3 months\n2. Tab. Calcium Carbonate 500mg BD x 3 months\n3. Tab. Paracetamol 650mg SOS for pain');
    setAlarmSignsCounselled(true);
    setBabyName(`Baby of ${patient.fullName}`);
    setBabyGender('female');
    setBabyBirthWeightGrams('3000');
    setBabyDischargeWeightGrams('2920');
    setBabyLengthCm('49.5');
    setBabyHcCm('34.0');
    setBabyGestationalAgeWeeks('39');
    setBabyGestationalAgeDays('2');
    setBabyApgar1min('8');
    setBabyApgar5min('9');
    setBabyCryAtBirth('immediate_vigorous');
    setBabyResuscitationDetails('Routine suction and drying, skin-to-skin given');
    setBabyBloodGroup('');
    setNeonatalFeedingMethod('exclusive_breastfeeding');
    setMeconiumPassed(true);
    setUrinePassed(true);
    setJaundiceAssessment('none');
    setNeonatalExam({
      tone: 'Active, good tone and suck reflex',
      fontanelle: 'Soft and flat, sutures normal',
      palate: 'Intact, no cleft or defect',
      eyes: 'Clear, red reflex present bilaterally',
      cardiopulmonary: 'Heart sounds normal (S1 S2), chest clear, no murmurs',
      abdomen: 'Soft, no hepatosplenomegaly',
      cord: 'Clean and dry, 2 arteries and 1 vein visible, no discharge',
      genitalia: 'Normal female/male anatomy, bilateral testes descended if male',
      anus: 'Patent anus verified, meconium passed',
      hips_spine: 'Barlow/Ortolani negative, spine straight and intact',
    });
    setBcgGiven(true);
    setBcgDate(todayLocal());
    setOpvZeroGiven(true);
    setOpvZeroDate(todayLocal());
    setHepbBirthGiven(true);
    setHepbBirthDate(todayLocal());
    setHearingScreenResult('pass');
    setMetabolicScreenResult('normal');
    setMaternalFollowupDate('');
    setNewbornFollowupDate('');
    setConsultantSpecialInstructions('Return immediately if heavy vaginal bleeding, high fever, severe abdominal pain, or calf swelling.');
    setStatus('finalized');
    setAutoCreateBabyPatient(true);
    setCreating(false);
    setEditingId(null);
  };

  const startEdit = (d: ObstetricDischargeSummary) => {
    setEditingId(d.id);
    setCreating(true);
    setDischargeDate(d.dischargeDate);
    setDeliveryAt(d.deliveryAt ?? '');
    setDeliveryMode(d.deliveryMode);
    setDeliveryIndication(d.deliveryIndication ?? '');
    setDeliveryNotes(d.deliveryNotes ?? '');
    setPrimaryObstetrician(d.primaryObstetrician ?? '');
    setPerineumWoundStatus(d.perineumWoundStatus);
    setPerineumNotes(d.perineumNotes ?? '');
    setFundalInvolution(d.fundalInvolution);
    setFundalHeightCm(d.fundalHeightCm ?? '');
    setLochiaCharacter(d.lochiaCharacter);
    setLochiaNotes(d.lochiaNotes ?? '');
    setLactationStatus(d.lactationStatus);
    setBreastExamination(d.breastExamination ?? '');
    setBladderBowelStatus(d.bladderBowelStatus ?? '');
    setDischargeBpSystolic(d.dischargeBpSystolic != null ? String(d.dischargeBpSystolic) : '');
    setDischargeBpDiastolic(d.dischargeBpDiastolic != null ? String(d.dischargeBpDiastolic) : '');
    setDischargePulse(d.dischargePulse != null ? String(d.dischargePulse) : '');
    setDischargeTempF(d.dischargeTempF != null ? String(d.dischargeTempF) : '');
    setDischargeSpo2(d.dischargeSpo2 != null ? String(d.dischargeSpo2) : '');
    setContraceptionCounselled(d.contraceptionCounselled);
    setContraceptionChosen(d.contraceptionChosen);
    setContraceptionNotes(d.contraceptionNotes ?? '');
    setDischargeMedicinesText(d.dischargeMedicinesText ?? '');
    setAlarmSignsCounselled(d.alarmSignsCounselled);
    setBabyName(d.babyPatientName ?? `Baby of ${patient.fullName}`);
    setBabyGender(d.babyGender);
    setBabyBirthWeightGrams(d.babyBirthWeightGrams != null ? String(d.babyBirthWeightGrams) : '');
    setBabyDischargeWeightGrams(d.babyDischargeWeightGrams != null ? String(d.babyDischargeWeightGrams) : '');
    setBabyLengthCm(d.babyLengthCm != null ? String(d.babyLengthCm) : '');
    setBabyHcCm(d.babyHcCm != null ? String(d.babyHcCm) : '');
    setBabyGestationalAgeWeeks(d.babyGestationalAgeWeeks != null ? String(d.babyGestationalAgeWeeks) : '');
    setBabyGestationalAgeDays(d.babyGestationalAgeDays != null ? String(d.babyGestationalAgeDays) : '');
    setBabyApgar1min(d.babyApgar1min != null ? String(d.babyApgar1min) : '');
    setBabyApgar5min(d.babyApgar5min != null ? String(d.babyApgar5min) : '');
    setBabyCryAtBirth(d.babyCryAtBirth);
    setBabyResuscitationDetails(d.babyResuscitationDetails ?? '');
    setBabyBloodGroup(d.babyBloodGroup ?? '');
    setNeonatalFeedingMethod(d.neonatalFeedingMethod);
    setMeconiumPassed(d.meconiumPassed);
    setUrinePassed(d.urinePassed);
    setJaundiceAssessment(d.jaundiceAssessment);
    setNeonatalExam(d.neonatalExam || {});
    setBcgGiven(d.bcgGiven);
    setBcgDate(d.bcgDate ?? '');
    setOpvZeroGiven(d.opvZeroGiven);
    setOpvZeroDate(d.opvZeroDate ?? '');
    setHepbBirthGiven(d.hepbBirthGiven);
    setHepbBirthDate(d.hepbBirthDate ?? '');
    setHearingScreenResult(d.hearingScreenResult);
    setMetabolicScreenResult(d.metabolicScreenResult);
    setMaternalFollowupDate(d.maternalFollowupDate ?? '');
    setNewbornFollowupDate(d.newbornFollowupDate ?? '');
    setConsultantSpecialInstructions(d.consultantSpecialInstructions ?? '');
    setStatus(d.status);
    setAutoCreateBabyPatient(false);
  };

  const handleExamChange = (field: string, val: string) => {
    setNeonatalExam((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccessBanner(null);

    const payload: Record<string, any> = {
      dischargeDate,
      deliveryAt: deliveryAt.trim() || null,
      deliveryMode,
      deliveryIndication: deliveryIndication.trim() || null,
      deliveryNotes: deliveryNotes.trim() || null,
      primaryObstetrician: primaryObstetrician.trim() || null,
      perineumWoundStatus,
      perineumNotes: perineumNotes.trim() || null,
      fundalInvolution,
      fundalHeightCm: fundalHeightCm.trim() || null,
      lochiaCharacter,
      lochiaNotes: lochiaNotes.trim() || null,
      lactationStatus,
      breastExamination: breastExamination.trim() || null,
      bladderBowelStatus: bladderBowelStatus.trim() || null,
      dischargeBpSystolic: dischargeBpSystolic ? Number(dischargeBpSystolic) : null,
      dischargeBpDiastolic: dischargeBpDiastolic ? Number(dischargeBpDiastolic) : null,
      dischargePulse: dischargePulse ? Number(dischargePulse) : null,
      dischargeTempF: dischargeTempF ? Number(dischargeTempF) : null,
      dischargeSpo2: dischargeSpo2 ? Number(dischargeSpo2) : null,
      contraceptionCounselled,
      contraceptionChosen,
      contraceptionNotes: contraceptionNotes.trim() || null,
      dischargeMedicinesText: dischargeMedicinesText.trim() || null,
      alarmSignsCounselled,
      babyGender,
      babyBirthWeightGrams: babyBirthWeightGrams ? Number(babyBirthWeightGrams) : null,
      babyDischargeWeightGrams: babyDischargeWeightGrams ? Number(babyDischargeWeightGrams) : null,
      babyLengthCm: babyLengthCm ? Number(babyLengthCm) : null,
      babyHcCm: babyHcCm ? Number(babyHcCm) : null,
      babyGestationalAgeWeeks: babyGestationalAgeWeeks ? Number(babyGestationalAgeWeeks) : null,
      babyGestationalAgeDays: babyGestationalAgeDays ? Number(babyGestationalAgeDays) : null,
      babyApgar1min: babyApgar1min ? Number(babyApgar1min) : null,
      babyApgar5min: babyApgar5min ? Number(babyApgar5min) : null,
      babyCryAtBirth,
      babyResuscitationDetails: babyResuscitationDetails.trim() || null,
      babyBloodGroup: babyBloodGroup.trim() || null,
      neonatalExam,
      neonatalFeedingMethod,
      meconiumPassed,
      urinePassed,
      jaundiceAssessment,
      bcgGiven,
      bcgDate: bcgGiven ? (bcgDate.trim() || null) : null,
      opvZeroGiven,
      opvZeroDate: opvZeroGiven ? (opvZeroDate.trim() || null) : null,
      hepbBirthGiven,
      hepbBirthDate: hepbBirthGiven ? (hepbBirthDate.trim() || null) : null,
      hearingScreenResult,
      metabolicScreenResult,
      maternalFollowupDate: maternalFollowupDate.trim() || null,
      newbornFollowupDate: newbornFollowupDate.trim() || null,
      consultantSpecialInstructions: consultantSpecialInstructions.trim() || null,
      status,
    };

    try {
      if (editingId) {
        await api('PATCH', `/api/obstetric-discharges/${editingId}`, payload);
        setSuccessBanner('Obstetric discharge summary updated successfully.');
      } else {
        payload.babyName = babyName.trim() || `Baby of ${patient.fullName}`;
        payload.autoCreateBabyPatient = autoCreateBabyPatient;
        await api('POST', `/api/patients/${patient.id}/obstetric-discharges`, payload);
        setSuccessBanner(
          autoCreateBabyPatient
            ? 'Obstetric discharge summary finalized and Baby patient record registered with birth immunizations.'
            : 'Obstetric discharge summary created successfully.'
        );
      }
      resetForm();
      await loadDischarges();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this obstetric discharge summary?')) return;
    setBusy(true);
    setError(null);
    try {
      await api('DELETE', `/api/obstetric-discharges/${id}`);
      setSuccessBanner('Discharge summary deleted.');
      await loadDischarges();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateBabyPatient = async (d: ObstetricDischargeSummary) => {
    if (!window.confirm(`Create pediatric patient profile and record birth vaccines for Baby of ${patient.fullName}?`)) return;
    setBabyRegisteringId(d.id);
    setError(null);
    try {
      const res = await api<{ ok: boolean; babyPatientId: number }>('POST', `/api/obstetric-discharges/${d.id}/create-baby-record`);
      setSuccessBanner(`Baby registered as Patient ID #${res.babyPatientId} with BCG, OPV-0, and HepB-0 vaccines.`);
      await loadDischarges();
    } catch (err) {
      setError(err);
    } finally {
      setBabyRegisteringId(null);
    }
  };

  const fe = fieldErrorsOf(error);

  return (
    <div className="stack" style={{ gap: '1.25rem' }}>
      {/* Header and Controls */}
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🤱</span> Obstetric Postnatal Discharge & Puerperium Care Pack
          </h3>
          <p className="muted small" style={{ margin: '0.2rem 0 0 0' }}>
            Comprehensive maternal involution progress, delivery details, neonatal examination, contraception, and birth immunization card.
          </p>
        </div>
        {!creating && canWrite && (
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              resetForm();
              setCreating(true);
            }}
          >
            + New Obstetric Discharge Summary
          </button>
        )}
      </div>

      <ErrorBanner error={error} />

      {successBanner && (
        <div className="banner ok" role="status">
          ✓ {successBanner}
        </div>
      )}

      {/* Discharge Summary Form */}
      {creating && (
        <form onSubmit={handleSubmit} className="card stack" style={{ border: '2px solid #3b82f6', background: '#f8fafc' }}>
          <div className="page-head" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
            <h4 style={{ margin: 0 }}>
              {editingId ? 'Edit Obstetric Discharge Summary' : 'Prepare Obstetric Postnatal Discharge Summary'}
            </h4>
            <div className="row" style={{ gap: '0.5rem' }}>
              <button type="button" className="btn small" onClick={resetForm} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn primary small" disabled={busy}>
                {busy ? 'Saving…' : editingId ? 'Update Summary' : 'Save & Finalize Discharge'}
              </button>
            </div>
          </div>

          {/* Section 1: Delivery & Obstetric Details */}
          <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem', background: '#fff' }}>
            <legend style={{ fontWeight: 600, color: '#1e293b', padding: '0 0.5rem' }}>
              1. Delivery & Operator Details
            </legend>
            <div className="grid-2" style={{ gap: '0.75rem' }}>
              <Field label="Discharge Date" error={fe.dischargeDate} hint="Official discharge date (YYYY-MM-DD)">
                <input
                  type="date"
                  value={dischargeDate}
                  onChange={(e) => setDischargeDate(e.target.value)}
                  required
                />
              </Field>
              <Field label="Delivery Date & Time" hint="Date and time baby delivered (e.g. 2026-11-05 14:30)">
                <input
                  type="text"
                  placeholder="YYYY-MM-DD HH:MM"
                  value={deliveryAt}
                  onChange={(e) => setDeliveryAt(e.target.value)}
                />
              </Field>
              <Field label="Mode of Delivery" error={fe.deliveryMode}>
                <select value={deliveryMode} onChange={(e) => setDeliveryMode(e.target.value)}>
                  {Object.entries(DELIVERY_MODE_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Primary Obstetrician / Surgeon" hint="Consultant attending delivery">
                <input
                  type="text"
                  placeholder="e.g. Dr. Sarah Jenkins, MD, DGO"
                  value={primaryObstetrician}
                  onChange={(e) => setPrimaryObstetrician(e.target.value)}
                />
              </Field>
              <div style={{ gridColumn: 'span 2' }}>
                <Field label="Delivery Indication" hint="Primary obstetric indication for operative or assisted birth">
                  <input
                    type="text"
                    placeholder="e.g. Previous LSCS in early labor / Non-reassuring fetal heart pattern / Elective repeat"
                    value={deliveryIndication}
                    onChange={(e) => setDeliveryIndication(e.target.value)}
                  />
                </Field>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <Field label="Delivery & Intraoperative Notes" hint="Third stage management, estimated blood loss, placenta, etc.">
                  <textarea
                    rows={2}
                    placeholder="e.g. Spontaneous placental delivery, intact membranes, no postpartum hemorrhage, estimated blood loss 350ml."
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </fieldset>

          {/* Section 2: Maternal Puerperium & Involution Progress */}
          <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem', background: '#fff' }}>
            <legend style={{ fontWeight: 600, color: '#1e293b', padding: '0 0.5rem' }}>
              2. Maternal Puerperium & Involution Progress
            </legend>
            <div className="grid-2" style={{ gap: '0.75rem' }}>
              <Field label="Perineum / Abdominal Wound Status" error={fe.perineumWoundStatus}>
                <select value={perineumWoundStatus} onChange={(e) => setPerineumWoundStatus(e.target.value)}>
                  {Object.entries(PERINEUM_WOUND_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Perineum / Wound Notes">
                <input
                  type="text"
                  placeholder="e.g. Sutures intact, no induration or hematoma"
                  value={perineumNotes}
                  onChange={(e) => setPerineumNotes(e.target.value)}
                />
              </Field>
              <Field label="Uterine Fundal Involution" error={fe.fundalInvolution}>
                <select value={fundalInvolution} onChange={(e) => setFundalInvolution(e.target.value)}>
                  {Object.entries(FUNDAL_INVOLUTION_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fundal Height & Tone" hint="Clinical uterine height at discharge">
                <input
                  type="text"
                  placeholder="e.g. Firm at 20w size / 2 fingers below umbilicus"
                  value={fundalHeightCm}
                  onChange={(e) => setFundalHeightCm(e.target.value)}
                />
              </Field>
              <Field label="Lochia Character" error={fe.lochiaCharacter}>
                <select value={lochiaCharacter} onChange={(e) => setLochiaCharacter(e.target.value)}>
                  {Object.entries(LOCHIA_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lochia Notes">
                <input
                  type="text"
                  placeholder="e.g. Moderate flow, no clots, odorless"
                  value={lochiaNotes}
                  onChange={(e) => setLochiaNotes(e.target.value)}
                />
              </Field>
              <Field label="Lactation Status" error={fe.lactationStatus}>
                <select value={lactationStatus} onChange={(e) => setLactationStatus(e.target.value)}>
                  {Object.entries(LACTATION_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Breast Examination">
                <input
                  type="text"
                  placeholder="e.g. Soft, no engorgement, nipples intact"
                  value={breastExamination}
                  onChange={(e) => setBreastExamination(e.target.value)}
                />
              </Field>
              <div style={{ gridColumn: 'span 2' }}>
                <Field label="Bladder & Bowel Status">
                  <input
                    type="text"
                    placeholder="e.g. Voiding spontaneously without dysuria, bowels regular"
                    value={bladderBowelStatus}
                    onChange={(e) => setBladderBowelStatus(e.target.value)}
                  />
                </Field>
              </div>
            </div>

            {/* Maternal Discharge Vitals Sub-grid */}
            <h5 style={{ margin: '1rem 0 0.5rem 0', color: '#334155' }}>Maternal Vitals at Discharge</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
              <Field label="Systolic BP (mmHg)" error={fe.dischargeBpSystolic}>
                <input
                  type="number"
                  placeholder="120"
                  value={dischargeBpSystolic}
                  onChange={(e) => setDischargeBpSystolic(e.target.value)}
                />
              </Field>
              <Field label="Diastolic BP (mmHg)" error={fe.dischargeBpDiastolic}>
                <input
                  type="number"
                  placeholder="80"
                  value={dischargeBpDiastolic}
                  onChange={(e) => setDischargeBpDiastolic(e.target.value)}
                />
              </Field>
              <Field label="Pulse (bpm)" error={fe.dischargePulse}>
                <input
                  type="number"
                  placeholder="78"
                  value={dischargePulse}
                  onChange={(e) => setDischargePulse(e.target.value)}
                />
              </Field>
              <Field label="Temp (°F)" error={fe.dischargeTempF}>
                <input
                  type="number"
                  step="0.1"
                  placeholder="98.4"
                  value={dischargeTempF}
                  onChange={(e) => setDischargeTempF(e.target.value)}
                />
              </Field>
              <Field label="SpO2 (%)" error={fe.dischargeSpo2}>
                <input
                  type="number"
                  placeholder="99"
                  value={dischargeSpo2}
                  onChange={(e) => setDischargeSpo2(e.target.value)}
                />
              </Field>
            </div>
          </fieldset>

          {/* Section 3: Contraception, Discharge Medications & Alarm Signs */}
          <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem', background: '#fff' }}>
            <legend style={{ fontWeight: 600, color: '#1e293b', padding: '0 0.5rem' }}>
              3. Postnatal Contraception & Maternal Discharge Advice
            </legend>
            <div className="grid-2" style={{ gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={contraceptionCounselled}
                    onChange={(e) => setContraceptionCounselled(e.target.checked)}
                  />
                  Postnatal Family Planning & Contraception Counselled
                </label>
              </div>
              <Field label="Contraceptive Method Chosen" error={fe.contraceptionChosen}>
                <select value={contraceptionChosen} onChange={(e) => setContraceptionChosen(e.target.value)}>
                  {Object.entries(CONTRACEPTION_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Contraception Notes">
                <input
                  type="text"
                  placeholder="e.g. Copper-T 380A placed immediately postpartum / POP prescribed"
                  value={contraceptionNotes}
                  onChange={(e) => setContraceptionNotes(e.target.value)}
                />
              </Field>
              <div style={{ gridColumn: 'span 2' }}>
                <Field label="Discharge Medications & Supplements">
                  <textarea
                    rows={3}
                    placeholder="Enter prescribed take-home medications with dosage and duration"
                    value={dischargeMedicinesText}
                    onChange={(e) => setDischargeMedicinesText(e.target.value)}
                  />
                </Field>
              </div>
              <div style={{ gridColumn: 'span 2', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#991b1b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={alarmSignsCounselled}
                    onChange={(e) => setAlarmSignsCounselled(e.target.checked)}
                  />
                  ⚠️ Puerperal Alarm Signs Explicitly Counselled & Understood
                </label>
                <p className="small muted" style={{ margin: '0.3rem 0 0 1.5rem', color: '#7f1d1d' }}>
                  Patient advised to seek emergency medical care immediately if experiencing: sudden heavy vaginal bleeding (soaking &gt;2 pads/hr),
                  foul-smelling discharge, high fever with chills (&gt;100.4°F), severe unilateral calf pain or swelling (DVT),
                  or persistent severe headache with blurred vision / epigastric pain (postpartum pre-eclampsia).
                </p>
              </div>
            </div>
          </fieldset>

          {/* Section 4: Newborn Details & Resuscitation */}
          <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem', background: '#fff' }}>
            <legend style={{ fontWeight: 600, color: '#1e293b', padding: '0 0.5rem' }}>
              4. Newborn Delivery & Resuscitation Summary
            </legend>
            <div className="grid-2" style={{ gap: '0.75rem' }}>
              {!editingId && (
                <Field label="Baby Name (for Patient Profile)" hint="Defaults to 'Baby of [Mother Full Name]'">
                  <input
                    type="text"
                    value={babyName}
                    onChange={(e) => setBabyName(e.target.value)}
                  />
                </Field>
              )}
              <Field label="Baby Gender" error={fe.babyGender}>
                <select value={babyGender} onChange={(e) => setBabyGender(e.target.value as any)}>
                  <option value="female">Female (Girl)</option>
                  <option value="male">Male (Boy)</option>
                  <option value="ambiguous">Ambiguous</option>
                </select>
              </Field>
              <Field label="Birth Weight (grams)" error={fe.babyBirthWeightGrams}>
                <input
                  type="number"
                  placeholder="3000"
                  value={babyBirthWeightGrams}
                  onChange={(e) => setBabyBirthWeightGrams(e.target.value)}
                />
              </Field>
              <Field label="Discharge Weight (grams)" error={fe.babyDischargeWeightGrams}>
                <input
                  type="number"
                  placeholder="2920"
                  value={babyDischargeWeightGrams}
                  onChange={(e) => setBabyDischargeWeightGrams(e.target.value)}
                />
              </Field>
              <Field label="Crown-Heel Length (cm)" error={fe.babyLengthCm}>
                <input
                  type="number"
                  step="0.1"
                  placeholder="49.5"
                  value={babyLengthCm}
                  onChange={(e) => setBabyLengthCm(e.target.value)}
                />
              </Field>
              <Field label="Head Circumference (cm)" error={fe.babyHcCm}>
                <input
                  type="number"
                  step="0.1"
                  placeholder="34.0"
                  value={babyHcCm}
                  onChange={(e) => setBabyHcCm(e.target.value)}
                />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <Field label="GA Weeks" error={fe.babyGestationalAgeWeeks}>
                  <input
                    type="number"
                    placeholder="39"
                    value={babyGestationalAgeWeeks}
                    onChange={(e) => setBabyGestationalAgeWeeks(e.target.value)}
                  />
                </Field>
                <Field label="GA Days" error={fe.babyGestationalAgeDays}>
                  <input
                    type="number"
                    placeholder="2"
                    value={babyGestationalAgeDays}
                    onChange={(e) => setBabyGestationalAgeDays(e.target.value)}
                  />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <Field label="APGAR 1 min (0-10)" error={fe.babyApgar1min}>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    placeholder="8"
                    value={babyApgar1min}
                    onChange={(e) => setBabyApgar1min(e.target.value)}
                  />
                </Field>
                <Field label="APGAR 5 min (0-10)" error={fe.babyApgar5min}>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    placeholder="9"
                    value={babyApgar5min}
                    onChange={(e) => setBabyApgar5min(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Cry at Birth" error={fe.babyCryAtBirth}>
                <select value={babyCryAtBirth} onChange={(e) => setBabyCryAtBirth(e.target.value)}>
                  {Object.entries(CRY_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Baby Blood Group">
                <input
                  type="text"
                  placeholder="e.g. O+ or A-"
                  value={babyBloodGroup}
                  onChange={(e) => setBabyBloodGroup(e.target.value)}
                />
              </Field>
              <div style={{ gridColumn: 'span 2' }}>
                <Field label="Resuscitation / Neonatal Transition Notes">
                  <input
                    type="text"
                    placeholder="e.g. Routine care, suctioned, dried, early skin-to-skin contact initiated"
                    value={babyResuscitationDetails}
                    onChange={(e) => setBabyResuscitationDetails(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </fieldset>

          {/* Section 5: Neonatal Discharge Examination & Wellbeing */}
          <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem', background: '#fff' }}>
            <legend style={{ fontWeight: 600, color: '#1e293b', padding: '0 0.5rem' }}>
              5. Neonatal Discharge Head-to-Toe Examination
            </legend>
            <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
              <Field label="Feeding Method at Discharge" error={fe.neonatalFeedingMethod}>
                <select value={neonatalFeedingMethod} onChange={(e) => setNeonatalFeedingMethod(e.target.value)}>
                  {Object.entries(FEEDING_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Neonatal Jaundice Assessment" error={fe.jaundiceAssessment}>
                <select value={jaundiceAssessment} onChange={(e) => setJaundiceAssessment(e.target.value)}>
                  {Object.entries(JAUNDICE_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </Field>
              <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', gridColumn: 'span 2', padding: '0.4rem 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={meconiumPassed}
                    onChange={(e) => setMeconiumPassed(e.target.checked)}
                  />
                  Meconium Passed within 24 Hours
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={urinePassed}
                    onChange={(e) => setUrinePassed(e.target.checked)}
                  />
                  Urine Passed within 24 Hours
                </label>
              </div>
            </div>

            <h5 style={{ margin: '0.5rem 0', color: '#334155' }}>Head-to-Toe Clinical Checklist</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.5rem' }}>
              <Field label="Tone & Reflexes">
                <input
                  type="text"
                  value={neonatalExam.tone || ''}
                  onChange={(e) => handleExamChange('tone', e.target.value)}
                />
              </Field>
              <Field label="Anterior Fontanelle & Sutures">
                <input
                  type="text"
                  value={neonatalExam.fontanelle || ''}
                  onChange={(e) => handleExamChange('fontanelle', e.target.value)}
                />
              </Field>
              <Field label="Palate & Oral Cavity">
                <input
                  type="text"
                  value={neonatalExam.palate || ''}
                  onChange={(e) => handleExamChange('palate', e.target.value)}
                />
              </Field>
              <Field label="Eyes & Red Reflex">
                <input
                  type="text"
                  value={neonatalExam.eyes || ''}
                  onChange={(e) => handleExamChange('eyes', e.target.value)}
                />
              </Field>
              <Field label="Heart & Lungs">
                <input
                  type="text"
                  value={neonatalExam.cardiopulmonary || ''}
                  onChange={(e) => handleExamChange('cardiopulmonary', e.target.value)}
                />
              </Field>
              <Field label="Abdomen & Organomegaly">
                <input
                  type="text"
                  value={neonatalExam.abdomen || ''}
                  onChange={(e) => handleExamChange('abdomen', e.target.value)}
                />
              </Field>
              <Field label="Umbilical Cord Stump">
                <input
                  type="text"
                  value={neonatalExam.cord || ''}
                  onChange={(e) => handleExamChange('cord', e.target.value)}
                />
              </Field>
              <Field label="External Genitalia">
                <input
                  type="text"
                  value={neonatalExam.genitalia || ''}
                  onChange={(e) => handleExamChange('genitalia', e.target.value)}
                />
              </Field>
              <Field label="Anus (Patency)">
                <input
                  type="text"
                  value={neonatalExam.anus || ''}
                  onChange={(e) => handleExamChange('anus', e.target.value)}
                />
              </Field>
              <Field label="Hips & Spine">
                <input
                  type="text"
                  value={neonatalExam.hips_spine || ''}
                  onChange={(e) => handleExamChange('hips_spine', e.target.value)}
                />
              </Field>
            </div>
          </fieldset>

          {/* Section 6: Birth Immunizations, Screening & Follow-up */}
          <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem', background: '#fff' }}>
            <legend style={{ fontWeight: 600, color: '#1e293b', padding: '0 0.5rem' }}>
              6. Newborn Birth Immunizations & Discharge Follow-up Pack
            </legend>
            <div className="grid-3" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
              {/* BCG */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={bcgGiven}
                    onChange={(e) => setBcgGiven(e.target.checked)}
                  />
                  BCG Birth Dose
                </label>
                {bcgGiven && (
                  <input
                    type="date"
                    style={{ marginTop: '0.3rem', fontSize: '0.85rem' }}
                    value={bcgDate}
                    onChange={(e) => setBcgDate(e.target.value)}
                  />
                )}
              </div>

              {/* OPV-0 */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={opvZeroGiven}
                    onChange={(e) => setOpvZeroGiven(e.target.checked)}
                  />
                  bOPV-0 Birth Dose
                </label>
                {opvZeroGiven && (
                  <input
                    type="date"
                    style={{ marginTop: '0.3rem', fontSize: '0.85rem' }}
                    value={opvZeroDate}
                    onChange={(e) => setOpvZeroDate(e.target.value)}
                  />
                )}
              </div>

              {/* HepB-Birth */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={hepbBirthGiven}
                    onChange={(e) => setHepbBirthGiven(e.target.checked)}
                  />
                  Hepatitis B Birth Dose
                </label>
                {hepbBirthGiven && (
                  <input
                    type="date"
                    style={{ marginTop: '0.3rem', fontSize: '0.85rem' }}
                    value={hepbBirthDate}
                    onChange={(e) => setHepbBirthDate(e.target.value)}
                  />
                )}
              </div>
            </div>

            <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
              <Field label="Newborn Hearing Screen (OAE/AABR)">
                <select value={hearingScreenResult} onChange={(e) => setHearingScreenResult(e.target.value as any)}>
                  <option value="pass">Pass (Normal)</option>
                  <option value="refer">Refer (Requires Diagnostic Follow-up)</option>
                  <option value="not_screened">Not Screened</option>
                </select>
              </Field>
              <Field label="Metabolic / TSH Screen Result">
                <select value={metabolicScreenResult} onChange={(e) => setMetabolicScreenResult(e.target.value as any)}>
                  <option value="normal">Normal (Negative)</option>
                  <option value="pending">Sample Sent / Results Pending</option>
                  <option value="abnormal">Abnormal (Action Required)</option>
                  <option value="not_screened">Not Screened</option>
                </select>
              </Field>
              <Field label="Maternal Follow-up Date" hint="e.g. Day 7 for episiotomy/suture review">
                <input
                  type="date"
                  value={maternalFollowupDate}
                  onChange={(e) => setMaternalFollowupDate(e.target.value)}
                />
              </Field>
              <Field label="Newborn Follow-up Date" hint="e.g. 6-week infant immunization visit">
                <input
                  type="date"
                  value={newbornFollowupDate}
                  onChange={(e) => setNewbornFollowupDate(e.target.value)}
                />
              </Field>
              <div style={{ gridColumn: 'span 2' }}>
                <Field label="Consultant Special Instructions & Home Care">
                  <textarea
                    rows={2}
                    value={consultantSpecialInstructions}
                    onChange={(e) => setConsultantSpecialInstructions(e.target.value)}
                  />
                </Field>
              </div>
            </div>

            {!editingId && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#1e40af', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoCreateBabyPatient}
                    onChange={(e) => setAutoCreateBabyPatient(e.target.checked)}
                  />
                  👶 Automatically Register Baby as a New Pediatric Patient Record
                </label>
                <p className="small muted" style={{ margin: '0.2rem 0 0 1.5rem', color: '#1e3a8a' }}>
                  Creates linked child patient, sets up pediatric profile (birth weight, length, HC, gestational age, APGAR scores), and logs birth vaccine doses (BCG, OPV-0, HepB).
                </p>
              </div>
            )}
          </fieldset>

          {/* Form Actions */}
          <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
            <div className="row" style={{ gap: '0.75rem' }}>
              <label style={{ fontWeight: 600 }}>Summary Status:</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="status"
                  value="finalized"
                  checked={status === 'finalized'}
                  onChange={() => setStatus('finalized')}
                />
                Finalized
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="status"
                  value="draft"
                  checked={status === 'draft'}
                  onChange={() => setStatus('draft')}
                />
                Draft
              </label>
            </div>
            <div className="row" style={{ gap: '0.5rem' }}>
              <button type="button" className="btn" onClick={resetForm} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? 'Saving…' : editingId ? 'Update Summary' : 'Save & Finalize Discharge'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Discharges List */}
      {loading ? (
        <p className="muted">Loading postnatal discharge summaries…</p>
      ) : discharges.length === 0 && !creating ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p className="muted" style={{ margin: 0 }}>
            No obstetric postnatal discharge summaries recorded for this patient.
          </p>
          {canWrite && (
            <button
              type="button"
              className="btn primary small"
              style={{ marginTop: '0.75rem' }}
              onClick={() => {
                resetForm();
                setCreating(true);
              }}
            >
              + Create Postnatal Discharge Summary
            </button>
          )}
        </div>
      ) : (
        <div className="stack" style={{ gap: '1rem' }}>
          {discharges.map((d) => (
            <div
              key={d.id}
              className="card stack"
              style={{
                borderLeft: `5px solid ${d.deliveryMode.includes('lscs') ? '#0284c7' : '#16a34a'}`,
                background: '#fff',
              }}
            >
              <div className="page-head" style={{ marginBottom: 0 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        background: d.deliveryMode.includes('lscs') ? '#e0f2fe' : '#dcfce7',
                        color: d.deliveryMode.includes('lscs') ? '#0369a1' : '#15803d',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      {DELIVERY_MODE_LABELS[d.deliveryMode] || d.deliveryMode}
                    </span>
                    <strong style={{ fontSize: '1.05rem' }}>Discharged: {d.dischargeDate}</strong>
                    {d.status === 'draft' ? (
                      <span className="badge warn">Draft</span>
                    ) : (
                      <span className="badge ok">Finalized</span>
                    )}
                  </div>
                  <div className="muted small" style={{ marginTop: '0.2rem' }}>
                    {d.deliveryAt && <span>Delivered: {d.deliveryAt} · </span>}
                    {d.primaryObstetrician && <span>Obstetrician: {d.primaryObstetrician} · </span>}
                    {d.admissionNumber && <span>IPD Adm: {d.admissionNumber} · </span>}
                    <span>Created by: {d.createdByName || 'Staff'}</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="row wrap no-print" style={{ gap: '0.4rem' }}>
                  <Link to={`/obstetric-discharges/${d.id}/print`} className="btn small primary">
                    🖨️ Print Discharge Pack
                  </Link>
                  {canWrite && (
                    <button type="button" className="btn small" onClick={() => startEdit(d)}>
                      ✏️ Edit
                    </button>
                  )}
                  {canWrite && (
                    <button
                      type="button"
                      className="btn small danger"
                      onClick={() => void handleDelete(d.id)}
                      disabled={busy}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              {/* Maternal & Baby Two-Column Overview */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '1rem',
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: '0.75rem',
                }}
              >
                {/* Column 1: Maternal Puerperium Summary */}
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px' }}>
                  <h5 style={{ margin: '0 0 0.4rem 0', color: '#0f172a' }}>🤱 Maternal Involution & Care</h5>
                  <div className="small" style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.25rem 0.5rem' }}>
                    <span className="muted">Involution:</span>
                    <strong>{FUNDAL_INVOLUTION_LABELS[d.fundalInvolution] || d.fundalInvolution} ({d.fundalHeightCm || 'Normal'})</strong>

                    <span className="muted">Lochia:</span>
                    <span>{LOCHIA_LABELS[d.lochiaCharacter] || d.lochiaCharacter} {d.lochiaNotes ? `(${d.lochiaNotes})` : ''}</span>

                    <span className="muted">Perineum/Wound:</span>
                    <span>{PERINEUM_WOUND_LABELS[d.perineumWoundStatus] || d.perineumWoundStatus}</span>

                    <span className="muted">Lactation:</span>
                    <span>{LACTATION_LABELS[d.lactationStatus] || d.lactationStatus}</span>

                    <span className="muted">Contraception:</span>
                    <span>{CONTRACEPTION_LABELS[d.contraceptionChosen] || d.contraceptionChosen}</span>

                    {(d.dischargeBpSystolic || d.dischargePulse) && (
                      <>
                        <span className="muted">Discharge Vitals:</span>
                        <span>
                          BP: {d.dischargeBpSystolic || '—'}/{d.dischargeBpDiastolic || '—'} mmHg, HR: {d.dischargePulse || '—'} bpm, Temp: {d.dischargeTempF ? `${d.dischargeTempF}°F` : '—'}
                        </span>
                      </>
                    )}

                    {d.maternalFollowupDate && (
                      <>
                        <span className="muted">Follow-up:</span>
                        <strong style={{ color: '#2563eb' }}>{d.maternalFollowupDate} (Suture/Wound check)</strong>
                      </>
                    )}
                  </div>
                </div>

                {/* Column 2: Newborn Summary */}
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <h5 style={{ margin: 0, color: '#0f172a' }}>👶 Newborn Summary & Vaccines</h5>
                    {d.babyPediatricPatientId ? (
                      <Link
                        to={`/patients/${d.babyPediatricPatientId}`}
                        style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2563eb' }}
                      >
                        Open Child Record ({d.babyPatientNumber || `#${d.babyPediatricPatientId}`}) →
                      </Link>
                    ) : (
                      canWrite && (
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() => void handleCreateBabyPatient(d)}
                          disabled={babyRegisteringId === d.id}
                        >
                          {babyRegisteringId === d.id ? 'Registering…' : '➕ Register Baby Patient'}
                        </button>
                      )
                    )}
                  </div>
                  <div className="small" style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.25rem 0.5rem' }}>
                    <span className="muted">Gender & Weight:</span>
                    <strong>
                      {d.babyGender.toUpperCase()}, Birth: {d.babyBirthWeightGrams ? `${d.babyBirthWeightGrams}g` : '—'}, Discharge: {d.babyDischargeWeightGrams ? `${d.babyDischargeWeightGrams}g` : '—'}
                    </strong>

                    <span className="muted">Gestation & APGAR:</span>
                    <span>
                      {d.babyGestationalAgeWeeks ? `${d.babyGestationalAgeWeeks}w ${d.babyGestationalAgeDays || 0}d` : 'Term'}, APGAR 1m: {d.babyApgar1min ?? '—'}, 5m: {d.babyApgar5min ?? '—'}
                    </span>

                    <span className="muted">Feeding:</span>
                    <span>{FEEDING_LABELS[d.neonatalFeedingMethod] || d.neonatalFeedingMethod}</span>

                    <span className="muted">Birth Vaccines:</span>
                    <span>
                      {d.bcgGiven ? '✓ BCG' : '✗ BCG'} · {d.opvZeroGiven ? '✓ bOPV-0' : '✗ bOPV-0'} · {d.hepbBirthGiven ? '✓ HepB-0' : '✗ HepB-0'}
                    </span>

                    <span className="muted">Screening:</span>
                    <span>Hearing: {d.hearingScreenResult.toUpperCase()}, Metabolic: {d.metabolicScreenResult.toUpperCase()}</span>

                    {d.newbornFollowupDate && (
                      <>
                        <span className="muted">Baby Review:</span>
                        <strong style={{ color: '#2563eb' }}>{d.newbornFollowupDate} (Vaccination/Well-baby)</strong>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
