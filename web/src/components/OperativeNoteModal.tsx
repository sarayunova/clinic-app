import React, { useState, type FormEvent } from 'react';
import { api, type OperativeNote } from '../api';
import { useMe } from '../auth';
import { ErrorBanner, Field, fieldErrorsOf, todayLocal } from './ui';

export interface OperativeNoteModalProps {
  patientId: number;
  patientName: string;
  admissionId?: number | null;
  existingNote?: OperativeNote | null;
  onClose: () => void;
  onSaved: (saved: OperativeNote) => void;
}

const TEMPLATES: Record<string, Partial<OperativeNote>> = {
  emergency_lscs_distress: {
    procedureName: 'Emergency Lower Segment Cesarean Section (LSCS)',
    procedureCategory: 'lscs',
    urgency: 'emergency',
    indication: 'Fetal distress with persistent bradycardia and thick meconium stained liquor in active labor',
    anesthesiaType: 'spinal',
    incisionType: 'pfannenstiel',
    presentation: 'cephalic',
    liquorCharacteristics: 'meconium_thick',
    extractionDetails: 'Vertex extracted smoothly with gentle fundal pressure. Immediate oropharyngeal suction performed on delivery of head.',
    placentaDelivery: 'spontaneous_cct',
    placentaCompleteness: 'complete_intact',
    uterineClosure: 'Lower uterine segment incision closed in 2 continuous interlocking layers using Vicryl 1-0. Hemostasis secured.',
    tubalLigationPerformed: false,
    estimatedBloodLossMl: 450,
    findingsNotes: 'Uterine lower segment thinned out and well-formed. Bilateral ovaries and fallopian tubes appear normal. No peritoneal adhesions.',
    preopIdentityConsentVerified: true,
    preopSiteMarked: true,
    preopAnesthesiaSafetyChecked: true,
    preopPulseOximeterFunctioning: true,
    preopAllergiesReviewed: true,
    preopDifficultAirwayAssessed: false,
    preopBloodAvailabilityUnits: '2 units PRBC cross-matched & reserved in blood bank',
    preopAntibioticProphylaxis: 'Inj. Cefazolin 2g IV given 30 mins prior to skin incision',
    spongeCountVerified: true,
    instrumentCountVerified: true,
    needleCountVerified: true,
    drainPlaced: false,
    closureDetails: 'Visceral peritoneum left open. Rectus sheath approximated with continuous Loop PDS No. 1. Subcutaneous layer with plain catgut 2-0. Skin closed subcuticularly with Monocryl 3-0.',
    postopVitalsMonitoring: 'Monitor vitals (BP, PR, SpO2) q15m x 2h, then q1h x 4h. Regularly assess per-vaginal lochia bleeding and fundal uterine tone.',
    postopIvFluids: 'RL 500ml + 20 IU Oxytocin infusion at 125 ml/hr x 4 hours',
    postopAnalgesia: 'Inj. Paracetamol 1g IV TDS; Inj. Tramadol 50mg IV SOS for breakthrough pain',
    postopAntibiotics: 'Inj. Cefuroxime 750mg IV BD x 24 hours',
    postopThromboprophylaxis: 'Early ambulation at 6-8 hrs; graduated compression stockings; encourage calf exercises',
    postopDiet: 'NPO for 4-6 hours until fully conscious and active bowel sounds return, then sips of water followed by clear liquids',
    postopCatheterInstructions: 'Foley urinary catheter to continuous drainage bag; remove after 12-24 hours when ambulatory',
  },
  elective_lscs_repeat: {
    procedureName: 'Elective Lower Segment Cesarean Section (LSCS)',
    procedureCategory: 'lscs',
    urgency: 'elective',
    indication: 'Elective repeat LSCS: Previous 2 Lower Segment Cesarean Sections at 39 weeks gestation',
    anesthesiaType: 'spinal',
    incisionType: 'pfannenstiel',
    presentation: 'cephalic',
    liquorCharacteristics: 'clear',
    extractionDetails: 'Previous Pfannenstiel scar excised. Lower uterine segment exposed; infant delivered as cephalic vertex easily with fundal assist.',
    placentaDelivery: 'spontaneous_cct',
    placentaCompleteness: 'complete_intact',
    uterineClosure: 'Lower segment closed in 2 layers continuous interlocking absorbable suture (Vicryl 1-0). Perfect hemostasis achieved.',
    tubalLigationPerformed: false,
    estimatedBloodLossMl: 400,
    findingsNotes: 'Mild omental adhesions to anterior abdominal wall from previous surgeries, carefully mobilized. Lower segment intact without fenestration.',
    preopIdentityConsentVerified: true,
    preopSiteMarked: true,
    preopAnesthesiaSafetyChecked: true,
    preopPulseOximeterFunctioning: true,
    preopAllergiesReviewed: true,
    preopDifficultAirwayAssessed: false,
    preopBloodAvailabilityUnits: '1 unit PRBC grouped & typed on standby',
    preopAntibioticProphylaxis: 'Inj. Cefazolin 2g IV given 30 mins pre-incision',
    spongeCountVerified: true,
    instrumentCountVerified: true,
    needleCountVerified: true,
    drainPlaced: false,
    closureDetails: 'Rectus sheath closed with Loop PDS No. 1. Skin closed with subcuticular Monocryl 3-0 suture.',
    postopVitalsMonitoring: 'Monitor vitals q30m x 2h, then q2h. Check lochia and uterine contraction.',
    postopIvFluids: 'RL 500ml + 20 IU Oxytocin at 125 ml/hr',
    postopAnalgesia: 'Inj. Paracetamol 1g IV TDS + oral NSAID from Day 1',
    postopAntibiotics: 'Inj. Cefazolin 1g IV BD x 24 hrs',
    postopThromboprophylaxis: 'Early mobilization, compression stockings',
    postopDiet: 'Sips of water after 4 hours, light diet on Day 1',
    postopCatheterInstructions: 'Remove Foley catheter tomorrow morning (after 12 hours)',
  },
  assisted_vacuum: {
    procedureName: 'Assisted Operative Vaginal Delivery (Vacuum Extraction)',
    procedureCategory: 'operative_vaginal',
    urgency: 'emergency',
    indication: 'Prolonged second stage of labor with maternal exhaustion at +2 station',
    anesthesiaType: 'local',
    incisionType: 'other',
    presentation: 'cephalic',
    liquorCharacteristics: 'clear',
    extractionDetails: 'Silc cup placed over flexion point, 3cm anterior to posterior fontanelle. Negative pressure created to 0.8 kg/cm2. Steady traction applied in axis of birth canal with maternal contraction. Smooth delivery of occiput and shoulders.',
    placentaDelivery: 'spontaneous_cct',
    placentaCompleteness: 'complete_intact',
    uterineClosure: 'N/A (vaginal delivery)',
    tubalLigationPerformed: false,
    estimatedBloodLossMl: 250,
    findingsNotes: 'Right mediolateral episiotomy performed under 1% Lignocaine infiltration. Cervical and vaginal canal inspected: no lacerations.',
    preopIdentityConsentVerified: true,
    preopSiteMarked: true,
    preopAnesthesiaSafetyChecked: true,
    preopPulseOximeterFunctioning: true,
    preopAllergiesReviewed: true,
    preopDifficultAirwayAssessed: false,
    spongeCountVerified: true,
    instrumentCountVerified: true,
    needleCountVerified: true,
    drainPlaced: false,
    closureDetails: 'Right mediolateral episiotomy repaired in 3 layers: vaginal mucosa with continuous Vicryl 2-0, perineal muscles with interrupted sutures, skin with subcuticular Vicryl 2-0.',
    postopVitalsMonitoring: 'Monitor vitals and per-vaginal bleeding every 30 minutes for 2 hours, then 2-hourly.',
    postopIvFluids: 'Inj. Oxytocin 10 IU IM immediately on delivery of anterior shoulder',
    postopAnalgesia: 'Tab. Paracetamol 650mg TDS + Tab. Ibuprofen 400mg BD after food',
    postopAntibiotics: 'Tab. Amoxicillin-Clavulanate 625mg BD x 5 days',
    postopThromboprophylaxis: 'Normal ambulation encouraged',
    postopDiet: 'Normal regular diet and plenty of fluids',
    postopCatheterInstructions: 'Encourage spontaneous voiding within 4 hours. Ice pack to perineum.',
  },
  emergency_laparotomy_ectopic: {
    procedureName: 'Emergency Exploratory Laparotomy & Salpingectomy',
    procedureCategory: 'laparotomy',
    urgency: 'emergency',
    indication: 'Ruptured right tubal ectopic pregnancy with hemoperitoneum and hemodynamic instability',
    anesthesiaType: 'general',
    incisionType: 'subumbilical_midline',
    presentation: 'other',
    liquorCharacteristics: 'blood_stained',
    extractionDetails: 'N/A. Peritoneal cavity entered; approx. 800ml hemoperitoneum and blood clots evacuated. Right ampullary rupture identified.',
    placentaDelivery: 'spontaneous_cct',
    placentaCompleteness: 'complete_intact',
    uterineClosure: 'Right total salpingectomy performed with bipolar diathermy and Vicryl 1-0 transfixion of mesosalpinx. Hemostasis achieved.',
    tubalLigationPerformed: false,
    estimatedBloodLossMl: 900,
    findingsNotes: 'Ruptured right fallopian tube with active bleeding. Uterus of normal size, left ovary and fallopian tube appear healthy.',
    preopIdentityConsentVerified: true,
    preopSiteMarked: true,
    preopAnesthesiaSafetyChecked: true,
    preopPulseOximeterFunctioning: true,
    preopAllergiesReviewed: true,
    preopDifficultAirwayAssessed: true,
    preopBloodAvailabilityUnits: '2 units PRBC transfused intra-operatively',
    preopAntibioticProphylaxis: 'Inj. Cefoxitin 2g IV at induction',
    spongeCountVerified: true,
    instrumentCountVerified: true,
    needleCountVerified: true,
    drainPlaced: true,
    drainType: 'Abdominal pelvic corrugated drainage tube in pouch of Douglas',
    closureDetails: 'Warm saline peritoneal lavage. Linea alba closed with continuous Loop PDS No. 1. Skin closed with surgical staples.',
    postopVitalsMonitoring: 'Strict ICU monitoring: Vitals and drain output q15m until stable, check Hb/Hct at 6 hours.',
    postopIvFluids: 'IV crystalloids and blood component therapy as per hematocrit and hemodynamic status',
    postopAnalgesia: 'Inj. Paracetamol 1g IV TDS + Inj. Fentanyl / Tramadol IV',
    postopAntibiotics: 'Inj. Ceftriaxone 1g IV BD + Inj. Metronidazole 500mg IV TDS',
    postopThromboprophylaxis: 'LMWH 40mg SC after 12 hours once hemostasis verified; pneumatic compression devices',
    postopDiet: 'NPO with NG tube until flatus passes',
    postopCatheterInstructions: 'Hourly urine output monitoring via Foley catheter; maintain > 30 ml/hr',
  },
  cervical_encirclage: {
    procedureName: 'Cervical Encirclage (McDonald Technique)',
    procedureCategory: 'cervical_encirclage',
    urgency: 'elective',
    indication: 'Cervical insufficiency with recurrent mid-trimester pregnancy loss at 14 weeks gestation',
    anesthesiaType: 'spinal',
    incisionType: 'other',
    presentation: 'other',
    liquorCharacteristics: 'clear',
    extractionDetails: 'N/A. Anterior and posterior lips of cervix grasped gently with sponge-holding forceps.',
    placentaDelivery: 'spontaneous_cct',
    placentaCompleteness: 'complete_intact',
    uterineClosure: 'Purse-string suture placed high on cervix using Mersilene tape (No. 5 polyester suture), tied anteriorly with knot buried.',
    tubalLigationPerformed: false,
    estimatedBloodLossMl: 50,
    findingsNotes: 'External cervical os patulous prior to procedure. Suture secured tight, admitting fingertip only. Membranes intact and uninjured.',
    preopIdentityConsentVerified: true,
    preopSiteMarked: true,
    preopAnesthesiaSafetyChecked: true,
    preopPulseOximeterFunctioning: true,
    preopAllergiesReviewed: true,
    preopDifficultAirwayAssessed: false,
    spongeCountVerified: true,
    instrumentCountVerified: true,
    needleCountVerified: true,
    drainPlaced: false,
    closureDetails: 'Vaginal pack placed with Betadine ribbon gauge, to be removed after 4 hours.',
    postopVitalsMonitoring: 'Monitor vitals and monitor for uterine cramping or vaginal spotting every hour for 6 hours.',
    postopIvFluids: 'Oral fluids once spinal sensation recedes',
    postopAnalgesia: 'Tab. Paracetamol 650mg TDS SOS',
    postopAntibiotics: 'Tab. Cefuroxime 500mg BD x 5 days',
    postopThromboprophylaxis: 'Bed rest for 24 hours, then restricted activity',
    postopDiet: 'Normal diet',
    postopCatheterInstructions: 'Remove vaginal pack in 4 hours; encourage spontaneous urination',
  },
};

export function OperativeNoteModal({
  patientId,
  patientName,
  admissionId,
  existingNote,
  onClose,
  onSaved,
}: OperativeNoteModalProps) {
  const me = useMe();
  const today = todayLocal();

  // Active section tab
  const [activeTab, setActiveTab] = useState<'team' | 'preop' | 'surgical' | 'baby' | 'safety' | 'postop'>('team');

  // Form State
  const [surgeonName, setSurgeonName] = useState(existingNote?.surgeonName ?? me.fullName ?? '');
  const [assistantName, setAssistantName] = useState(existingNote?.assistantName ?? '');
  const [anesthetistName, setAnesthetistName] = useState(existingNote?.anesthetistName ?? '');
  const [pediatricianName, setPediatricianName] = useState(existingNote?.pediatricianName ?? '');
  const [scrubNurseName, setScrubNurseName] = useState(existingNote?.scrubNurseName ?? '');

  const [surgeryDate, setSurgeryDate] = useState(existingNote?.surgeryDate ?? today);
  const [startTime, setStartTime] = useState(existingNote?.startTime ?? '10:00');
  const [endTime, setEndTime] = useState(existingNote?.endTime ?? '10:50');
  const [procedureName, setProcedureName] = useState(existingNote?.procedureName ?? 'Emergency Lower Segment Cesarean Section (LSCS)');
  const [procedureCategory, setProcedureCategory] = useState(existingNote?.procedureCategory ?? 'lscs');
  const [indication, setIndication] = useState(existingNote?.indication ?? 'Fetal distress with persistent bradycardia and thick meconium');
  const [urgency, setUrgency] = useState(existingNote?.urgency ?? 'emergency');
  const [anesthesiaType, setAnesthesiaType] = useState(existingNote?.anesthesiaType ?? 'spinal');

  // WHO Pre-op Checklist
  const [preopIdentity, setPreopIdentity] = useState(existingNote?.preopIdentityConsentVerified ?? true);
  const [preopSite, setPreopSite] = useState(existingNote?.preopSiteMarked ?? true);
  const [preopAnesthesia, setPreopAnesthesia] = useState(existingNote?.preopAnesthesiaSafetyChecked ?? true);
  const [preopPulseOx, setPreopPulseOx] = useState(existingNote?.preopPulseOximeterFunctioning ?? true);
  const [preopAllergies, setPreopAllergies] = useState(existingNote?.preopAllergiesReviewed ?? true);
  const [preopAirway, setPreopAirway] = useState(existingNote?.preopDifficultAirwayAssessed ?? false);
  const [preopBlood, setPreopBlood] = useState(existingNote?.preopBloodAvailabilityUnits ?? '2 units PRBC cross-matched & reserved');
  const [preopAntibiotic, setPreopAntibiotic] = useState(existingNote?.preopAntibioticProphylaxis ?? 'Inj. Cefazolin 2g IV given 30 mins prior to skin incision');

  // Operative technique & findings
  const [incisionType, setIncisionType] = useState(existingNote?.incisionType ?? 'pfannenstiel');
  const [presentation, setPresentation] = useState(existingNote?.presentation ?? 'cephalic');
  const [liquor, setLiquor] = useState(existingNote?.liquorCharacteristics ?? 'meconium_thick');
  const [extractionDetails, setExtractionDetails] = useState(
    existingNote?.extractionDetails ??
      'Vertex extracted smoothly with gentle fundal pressure. Immediate oropharyngeal suction performed on delivery of head.'
  );
  const [babyDeliveryTime, setBabyDeliveryTime] = useState(existingNote?.babyDeliveryTime ?? '10:15');
  const [placentaDelivery, setPlacentaDelivery] = useState(existingNote?.placentaDelivery ?? 'spontaneous_cct');
  const [placentaCompleteness, setPlacentaCompleteness] = useState(existingNote?.placentaCompleteness ?? 'complete_intact');
  const [uterineClosure, setUterineClosure] = useState(
    existingNote?.uterineClosure ??
      'Lower uterine segment incision closed in 2 continuous interlocking layers using Vicryl 1-0. Hemostasis secured.'
  );
  const [tubalLigation, setTubalLigation] = useState(existingNote?.tubalLigationPerformed ?? false);
  const [tubalLigationNotes, setTubalLigationNotes] = useState(existingNote?.tubalLigationNotes ?? '');
  const [estimatedBloodLoss, setEstimatedBloodLoss] = useState(existingNote?.estimatedBloodLossMl ?? 450);
  const [findingsNotes, setFindingsNotes] = useState(
    existingNote?.findingsNotes ??
      'Uterine lower segment thinned out and well-formed. Bilateral ovaries and fallopian tubes appear normal. No peritoneal adhesions.'
  );

  // Newborn Summary
  const [babyGender, setBabyGender] = useState(existingNote?.babyGender ?? 'female');
  const [babyWeightGrams, setBabyWeightGrams] = useState(existingNote?.babyWeightGrams ?? 3150);
  const [apgar1min, setApgar1min] = useState(existingNote?.apgar1min ?? 8);
  const [apgar5min, setApgar5min] = useState(existingNote?.apgar5min ?? 10);
  const [babyResuscitation, setBabyResuscitation] = useState(
    existingNote?.babyResuscitationDetails ?? 'Routine drying and suction, cried immediately at birth. Handed over to pediatrician.'
  );

  // Counts & Safety
  const [spongeCount, setSpongeCount] = useState(existingNote?.spongeCountVerified ?? true);
  const [instrumentCount, setInstrumentCount] = useState(existingNote?.instrumentCountVerified ?? true);
  const [needleCount, setNeedleCount] = useState(existingNote?.needleCountVerified ?? true);
  const [drainPlaced, setDrainPlaced] = useState(existingNote?.drainPlaced ?? false);
  const [drainType, setDrainType] = useState(existingNote?.drainType ?? '');
  const [closureDetails, setClosureDetails] = useState(
    existingNote?.closureDetails ??
      'Visceral peritoneum left open. Rectus sheath approximated with continuous Loop PDS No. 1. Subcutaneous layer with plain catgut 2-0. Skin closed subcuticularly with Monocryl 3-0.'
  );

  // Post-op orders
  const [postopVitals, setPostopVitals] = useState(
    existingNote?.postopVitalsMonitoring ??
      'Monitor vitals (BP, PR, SpO2) q15m x 2h, then q1h x 4h. Regularly assess per-vaginal lochia bleeding and fundal uterine tone.'
  );
  const [postopIvFluids, setPostopIvFluids] = useState(existingNote?.postopIvFluids ?? 'RL 500ml + 20 IU Oxytocin infusion at 125 ml/hr x 4 hours');
  const [postopAnalgesia, setPostopAnalgesia] = useState(
    existingNote?.postopAnalgesia ?? 'Inj. Paracetamol 1g IV TDS; Inj. Tramadol 50mg IV SOS for breakthrough pain'
  );
  const [postopAntibiotics, setPostopAntibiotics] = useState(existingNote?.postopAntibiotics ?? 'Inj. Cefuroxime 750mg IV BD x 24 hours');
  const [postopThromboprophylaxis, setPostopThromboprophylaxis] = useState(
    existingNote?.postopThromboprophylaxis ?? 'Early ambulation at 6-8 hrs; graduated compression stockings; encourage calf exercises'
  );
  const [postopDiet, setPostopDiet] = useState(
    existingNote?.postopDiet ?? 'NPO for 4-6 hours until fully conscious and active bowel sounds return, then sips of water followed by clear liquids'
  );
  const [postopCatheter, setPostopCatheter] = useState(
    existingNote?.postopCatheterInstructions ?? 'Foley urinary catheter to continuous drainage bag; remove after 12-24 hours when ambulatory'
  );
  const [specialInstructions, setSpecialInstructions] = useState(existingNote?.specialInstructions ?? '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const fe = fieldErrorsOf(error);

  function applyTemplate(key: string) {
    const t = TEMPLATES[key];
    if (!t) return;
    if (t.procedureName) setProcedureName(t.procedureName);
    if (t.procedureCategory) setProcedureCategory(t.procedureCategory);
    if (t.urgency) setUrgency(t.urgency);
    if (t.indication) setIndication(t.indication);
    if (t.anesthesiaType) setAnesthesiaType(t.anesthesiaType);
    if (t.incisionType) setIncisionType(t.incisionType);
    if (t.presentation) setPresentation(t.presentation);
    if (t.liquorCharacteristics) setLiquor(t.liquorCharacteristics);
    if (t.extractionDetails) setExtractionDetails(t.extractionDetails);
    if (t.placentaDelivery) setPlacentaDelivery(t.placentaDelivery);
    if (t.placentaCompleteness) setPlacentaCompleteness(t.placentaCompleteness);
    if (t.uterineClosure) setUterineClosure(t.uterineClosure);
    if (t.tubalLigationPerformed !== undefined) setTubalLigation(t.tubalLigationPerformed);
    if (t.estimatedBloodLossMl !== undefined) setEstimatedBloodLoss(t.estimatedBloodLossMl);
    if (t.findingsNotes) setFindingsNotes(t.findingsNotes);
    if (t.preopBloodAvailabilityUnits) setPreopBlood(t.preopBloodAvailabilityUnits);
    if (t.preopAntibioticProphylaxis) setPreopAntibiotic(t.preopAntibioticProphylaxis);
    if (t.closureDetails) setClosureDetails(t.closureDetails);
    if (t.drainPlaced !== undefined) setDrainPlaced(t.drainPlaced);
    if (t.drainType) setDrainType(t.drainType);
    if (t.postopVitalsMonitoring) setPostopVitals(t.postopVitalsMonitoring);
    if (t.postopIvFluids) setPostopIvFluids(t.postopIvFluids);
    if (t.postopAnalgesia) setPostopAnalgesia(t.postopAnalgesia);
    if (t.postopAntibiotics) setPostopAntibiotics(t.postopAntibiotics);
    if (t.postopThromboprophylaxis) setPostopThromboprophylaxis(t.postopThromboprophylaxis);
    if (t.postopDiet) setPostopDiet(t.postopDiet);
    if (t.postopCatheterInstructions) setPostopCatheter(t.postopCatheterInstructions);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      admissionId: admissionId ?? undefined,
      surgeonName: surgeonName.trim(),
      assistantName: assistantName.trim() || null,
      anesthetistName: anesthetistName.trim() || null,
      pediatricianName: pediatricianName.trim() || null,
      scrubNurseName: scrubNurseName.trim() || null,

      surgeryDate,
      startTime,
      endTime: endTime || null,
      procedureName: procedureName.trim(),
      procedureCategory,
      indication: indication.trim(),
      urgency,
      anesthesiaType,

      preopIdentityConsentVerified: preopIdentity,
      preopSiteMarked: preopSite,
      preopAnesthesiaSafetyChecked: preopAnesthesia,
      preopPulseOximeterFunctioning: preopPulseOx,
      preopAllergiesReviewed: preopAllergies,
      preopDifficultAirwayAssessed: preopAirway,
      preopBloodAvailabilityUnits: preopBlood.trim() || null,
      preopAntibioticProphylaxis: preopAntibiotic.trim() || null,

      incisionType,
      presentation,
      liquorCharacteristics: liquor,
      extractionDetails: extractionDetails.trim() || null,
      babyDeliveryTime: babyDeliveryTime || null,
      placentaDelivery,
      placentaCompleteness,
      uterineClosure: uterineClosure.trim() || null,
      tubalLigationPerformed: tubalLigation,
      tubalLigationNotes: tubalLigationNotes.trim() || null,
      estimatedBloodLossMl: Number(estimatedBloodLoss) || 400,
      findingsNotes: findingsNotes.trim() || null,

      babyGender: babyGender || null,
      babyWeightGrams: babyWeightGrams ? Number(babyWeightGrams) : null,
      apgar1min: apgar1min != null ? Number(apgar1min) : null,
      apgar5min: apgar5min != null ? Number(apgar5min) : null,
      babyResuscitationDetails: babyResuscitation.trim() || null,

      spongeCountVerified: spongeCount,
      instrumentCountVerified: instrumentCount,
      needleCountVerified: needleCount,
      drainPlaced,
      drainType: drainType.trim() || null,
      closureDetails: closureDetails.trim() || null,

      postopVitalsMonitoring: postopVitals.trim() || null,
      postopIvFluids: postopIvFluids.trim() || null,
      postopAnalgesia: postopAnalgesia.trim() || null,
      postopAntibiotics: postopAntibiotics.trim() || null,
      postopThromboprophylaxis: postopThromboprophylaxis.trim() || null,
      postopDiet: postopDiet.trim() || null,
      postopCatheterInstructions: postopCatheter.trim() || null,
      specialInstructions: specialInstructions.trim() || null,

      status: 'completed',
    };

    try {
      let saved: OperativeNote;
      if (existingNote) {
        saved = await api<OperativeNote>('PATCH', `/api/operative-notes/${existingNote.id}`, payload);
      } else {
        saved = await api<OperativeNote>('POST', `/api/patients/${patientId}/operative-notes`, payload);
      }
      onSaved(saved);
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card stack"
        style={{
          background: 'var(--surface)',
          maxWidth: '850px',
          width: '100%',
          maxHeight: '94vh',
          overflowY: 'auto',
          padding: '1.5rem',
          boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div className="row wrap between" style={{ alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem' }}>
              {existingNote ? '✏️ Edit Operative Delivery Note' : '🩺 New Obstetric Operative Record (LSCS / Surgery)'}
            </h2>
            <div className="muted small" style={{ marginTop: '0.2rem' }}>
              Patient: <b>{patientName}</b> {admissionId ? `· Inpatient Admission #${admissionId}` : ''}
            </div>
          </div>
          <button type="button" className="btn small" onClick={onClose} disabled={submitting}>
            ✕
          </button>
        </div>

        {/* Clinical Template Quick Buttons */}
        {!existingNote && (
          <div style={{ background: 'var(--bg)', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
            <span className="muted small" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              ⚡ Quick Surgical Templates:
            </span>
            <div className="row wrap" style={{ gap: '0.35rem' }}>
              <button
                type="button"
                className="btn small"
                onClick={() => applyTemplate('emergency_lscs_distress')}
                title="Emergency LSCS for fetal distress or thick meconium"
              >
                🔴 Emergency LSCS (Fetal Distress)
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => applyTemplate('elective_lscs_repeat')}
                title="Elective repeat LSCS"
              >
                🔵 Elective Repeat LSCS
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => applyTemplate('assisted_vacuum')}
                title="Assisted operative vaginal delivery with vacuum extraction"
              >
                🟢 Vacuum Delivery
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => applyTemplate('emergency_laparotomy_ectopic')}
                title="Exploratory laparotomy for ruptured ectopic pregnancy"
              >
                🟣 Laparotomy (Ectopic)
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => applyTemplate('cervical_encirclage')}
                title="Cervical encirclage (McDonald stitch)"
              >
                McDonald Encirclage
              </button>
            </div>
          </div>
        )}

        <ErrorBanner error={error} />

        {/* Section Navigation Tabs */}
        <div className="row wrap" style={{ borderBottom: '1px solid var(--border)', gap: '0.25rem', paddingBottom: '0.2rem' }}>
          <button
            type="button"
            className={`btn small ${activeTab === 'team' ? 'primary' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            1. Team & Details
          </button>
          <button
            type="button"
            className={`btn small ${activeTab === 'preop' ? 'primary' : ''}`}
            onClick={() => setActiveTab('preop')}
          >
            2. WHO Safety Checklist
          </button>
          <button
            type="button"
            className={`btn small ${activeTab === 'surgical' ? 'primary' : ''}`}
            onClick={() => setActiveTab('surgical')}
          >
            3. Surgical Technique & Findings
          </button>
          <button
            type="button"
            className={`btn small ${activeTab === 'baby' ? 'primary' : ''}`}
            onClick={() => setActiveTab('baby')}
          >
            4. Newborn Outcome & APGAR
          </button>
          <button
            type="button"
            className={`btn small ${activeTab === 'safety' ? 'primary' : ''}`}
            onClick={() => setActiveTab('safety')}
          >
            5. Counts & Closure
          </button>
          <button
            type="button"
            className={`btn small ${activeTab === 'postop' ? 'primary' : ''}`}
            onClick={() => setActiveTab('postop')}
          >
            6. Post-Op Orders
          </button>
        </div>

        <form onSubmit={submit} className="stack" style={{ gap: '1rem', marginTop: '0.5rem' }}>
          {/* TAB 1: SURGICAL TEAM & TIMING */}
          {activeTab === 'team' && (
            <div className="stack" style={{ gap: '0.9rem' }}>
              <div className="grid2">
                <Field label="Lead Surgeon / Obstetrician" error={fe.surgeonName} hint="Operating doctor">
                  <input value={surgeonName} onChange={(e) => setSurgeonName(e.target.value)} required />
                </Field>
                <Field label="Assistant Surgeon" error={fe.assistantName}>
                  <input value={assistantName} onChange={(e) => setAssistantName(e.target.value)} placeholder="e.g. Dr. Priya" />
                </Field>
              </div>

              <div className="grid3">
                <Field label="Anesthetist" error={fe.anesthetistName}>
                  <input value={anesthetistName} onChange={(e) => setAnesthetistName(e.target.value)} placeholder="e.g. Dr. K. Mehta" />
                </Field>
                <Field label="Attending Pediatrician" error={fe.pediatricianName}>
                  <input value={pediatricianName} onChange={(e) => setPediatricianName(e.target.value)} placeholder="e.g. Dr. V. Sen" />
                </Field>
                <Field label="Scrub Nurse" error={fe.scrubNurseName}>
                  <input value={scrubNurseName} onChange={(e) => setScrubNurseName(e.target.value)} placeholder="e.g. Nurse Sunita" />
                </Field>
              </div>

              <div className="grid3">
                <Field label="Surgery Date" error={fe.surgeryDate}>
                  <input type="date" value={surgeryDate} onChange={(e) => setSurgeryDate(e.target.value)} required />
                </Field>
                <Field label="Incision Start Time" error={fe.startTime} hint="24h HH:MM">
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                </Field>
                <Field label="Surgery End Time" error={fe.endTime} hint="24h HH:MM">
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </Field>
              </div>

              <div className="grid2">
                <Field label="Procedure Name" error={fe.procedureName}>
                  <input value={procedureName} onChange={(e) => setProcedureName(e.target.value)} required />
                </Field>
                <Field label="Procedure Category" error={fe.procedureCategory}>
                  <select value={procedureCategory} onChange={(e) => setProcedureCategory(e.target.value as any)}>
                    <option value="lscs">Lower Segment Cesarean Section (LSCS)</option>
                    <option value="operative_vaginal">Operative Vaginal (Vacuum / Forceps)</option>
                    <option value="laparotomy">Exploratory Laparotomy (Ectopic / Gyn)</option>
                    <option value="cervical_encirclage">Cervical Encirclage (McDonald / Shirodkar)</option>
                    <option value="other">Other Obstetric / Gynecologic Surgery</option>
                  </select>
                </Field>
              </div>

              <div className="grid2">
                <Field label="Surgical Urgency" error={fe.urgency}>
                  <select value={urgency} onChange={(e) => setUrgency(e.target.value as any)}>
                    <option value="emergency">Emergency</option>
                    <option value="elective">Elective / Scheduled</option>
                  </select>
                </Field>
                <Field label="Anesthesia Type" error={fe.anesthesiaType}>
                  <select value={anesthesiaType} onChange={(e) => setAnesthesiaType(e.target.value as any)}>
                    <option value="spinal">Spinal (Subarachnoid block)</option>
                    <option value="general">General Anesthesia (GA)</option>
                    <option value="epidural">Epidural</option>
                    <option value="cse">Combined Spinal-Epidural (CSE)</option>
                    <option value="local">Local Infiltration / Pudendal block</option>
                  </select>
                </Field>
              </div>

              <Field label="Clinical Indication for Surgery" error={fe.indication} hint="Primary obstetric reason for operative delivery">
                <textarea
                  value={indication}
                  onChange={(e) => setIndication(e.target.value)}
                  required
                  rows={2}
                  placeholder="e.g. Fetal distress with severe variable decelerations; Non-progress of labor at 7cm..."
                />
              </Field>
            </div>
          )}

          {/* TAB 2: WHO SURGICAL SAFETY CHECKLIST */}
          {activeTab === 'preop' && (
            <div className="stack" style={{ gap: '0.9rem' }}>
              <div style={{ background: 'var(--info-bg)', padding: '0.75rem', borderRadius: '6px', color: 'var(--info-text)' }}>
                <b>🛡️ WHO Surgical Safety Verification Protocol</b>
                <div className="small">Pre-incision sign-in and safety verification completed in operating theatre.</div>
              </div>

              <div className="grid2" style={{ gap: '0.75rem' }}>
                <label className="row" style={{ alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={preopIdentity} onChange={(e) => setPreopIdentity(e.target.checked)} />
                  <span>Patient identity, consent & procedure confirmed</span>
                </label>
                <label className="row" style={{ alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={preopSite} onChange={(e) => setPreopSite(e.target.checked)} />
                  <span>Surgical site marked & prepped</span>
                </label>
                <label className="row" style={{ alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={preopAnesthesia} onChange={(e) => setPreopAnesthesia(e.target.checked)} />
                  <span>Anesthesia machine & medication check complete</span>
                </label>
                <label className="row" style={{ alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={preopPulseOx} onChange={(e) => setPreopPulseOx(e.target.checked)} />
                  <span>Pulse oximeter placed and functioning</span>
                </label>
                <label className="row" style={{ alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={preopAllergies} onChange={(e) => setPreopAllergies(e.target.checked)} />
                  <span>Known drug allergies confirmed & reviewed</span>
                </label>
                <label className="row" style={{ alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={preopAirway} onChange={(e) => setPreopAirway(e.target.checked)} />
                  <span>Difficult airway / aspiration risk evaluated</span>
                </label>
              </div>

              <Field label="Cross-Matched Blood Availability" error={fe.preopBloodAvailabilityUnits}>
                <input
                  value={preopBlood}
                  onChange={(e) => setPreopBlood(e.target.value)}
                  placeholder="e.g. 2 units PRBC cross-matched in blood bank / On standby"
                />
              </Field>

              <Field label="Pre-Operative Antibiotic Prophylaxis" error={fe.preopAntibioticProphylaxis} hint="Antibiotic given 30-60 min prior to skin incision">
                <input
                  value={preopAntibiotic}
                  onChange={(e) => setPreopAntibiotic(e.target.value)}
                  placeholder="e.g. Inj. Cefazolin 2g IV at 09:45 AM"
                />
              </Field>
            </div>
          )}

          {/* TAB 3: SURGICAL TECHNIQUE & FINDINGS */}
          {activeTab === 'surgical' && (
            <div className="stack" style={{ gap: '0.9rem' }}>
              <div className="grid3">
                <Field label="Skin Incision Type" error={fe.incisionType}>
                  <select value={incisionType} onChange={(e) => setIncisionType(e.target.value as any)}>
                    <option value="pfannenstiel">Pfannenstiel (Transverse)</option>
                    <option value="joel_cohen">Joel-Cohen</option>
                    <option value="subumbilical_midline">Subumbilical Midline (Vertical)</option>
                    <option value="other">Other / Vaginal</option>
                  </select>
                </Field>
                <Field label="Fetal Presentation" error={fe.presentation}>
                  <select value={presentation} onChange={(e) => setPresentation(e.target.value as any)}>
                    <option value="cephalic">Cephalic (Vertex)</option>
                    <option value="breech">Breech</option>
                    <option value="transverse">Transverse / Shoulder</option>
                    <option value="compound">Compound</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Liquor Characteristics" error={fe.liquorCharacteristics}>
                  <select value={liquor} onChange={(e) => setLiquor(e.target.value as any)}>
                    <option value="clear">Clear</option>
                    <option value="meconium_thin">Meconium (Thin)</option>
                    <option value="meconium_thick">Meconium (Thick / Viscous)</option>
                    <option value="blood_stained">Blood-stained</option>
                    <option value="oligohydramnios">Reduced / Absent (Oligohydramnios)</option>
                  </select>
                </Field>
              </div>

              <div className="grid2">
                <Field label="Placenta Delivery Method" error={fe.placentaDelivery}>
                  <select value={placentaDelivery} onChange={(e) => setPlacentaDelivery(e.target.value as any)}>
                    <option value="spontaneous_cct">Controlled Cord Traction (CCT)</option>
                    <option value="manual_removal">Manual Removal of Placenta</option>
                  </select>
                </Field>
                <Field label="Placenta Completeness" error={fe.placentaCompleteness}>
                  <select value={placentaCompleteness} onChange={(e) => setPlacentaCompleteness(e.target.value as any)}>
                    <option value="complete_intact">Complete & Intact with Membranes</option>
                    <option value="incomplete_explored">Incomplete / Uterine Cavity Explored</option>
                    <option value="morbidly_adherent">Morbidly Adherent (Accreta / Increta)</option>
                  </select>
                </Field>
              </div>

              <Field label="Delivery & Extraction Technique" error={fe.extractionDetails}>
                <textarea
                  value={extractionDetails}
                  onChange={(e) => setExtractionDetails(e.target.value)}
                  rows={2}
                  placeholder="Describe infant delivery maneuvers, extraction, suctioning..."
                />
              </Field>

              <Field label="Uterine Incision Closure" error={fe.uterineClosure} hint="Suture material, layer technique, and hemostasis">
                <textarea
                  value={uterineClosure}
                  onChange={(e) => setUterineClosure(e.target.value)}
                  rows={2}
                  placeholder="e.g. Lower uterine segment closed in 2 continuous interlocking layers using Vicryl 1-0..."
                />
              </Field>

              <div className="grid2" style={{ alignItems: 'center' }}>
                <Field label="Estimated Blood Loss (ml)" error={fe.estimatedBloodLossMl} hint="Standard LSCS is ~400-500ml. >1000ml = PPH">
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={estimatedBloodLoss}
                    onChange={(e) => setEstimatedBloodLoss(Number(e.target.value))}
                    required
                  />
                </Field>
                <div>
                  <label className="row" style={{ alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.8rem' }}>
                    <input
                      type="checkbox"
                      checked={tubalLigation}
                      onChange={(e) => setTubalLigation(e.target.checked)}
                    />
                    <b>Bilateral Tubal Ligation / Sterilization Performed</b>
                  </label>
                  {tubalLigation && (
                    <input
                      style={{ marginTop: '0.4rem', width: '100%' }}
                      placeholder="e.g. Modified Pomeroy technique with Vicryl 1-0 bilaterally"
                      value={tubalLigationNotes}
                      onChange={(e) => setTubalLigationNotes(e.target.value)}
                    />
                  )}
                </div>
              </div>

              <Field label="Operative Findings & Pelvic Anatomy Notes" error={fe.findingsNotes}>
                <textarea
                  value={findingsNotes}
                  onChange={(e) => setFindingsNotes(e.target.value)}
                  rows={3}
                  placeholder="Condition of uterine lower segment, peritoneal cavity, ovaries, fallopian tubes, adhesions..."
                />
              </Field>
            </div>
          )}

          {/* TAB 4: NEWBORN SUMMARY & APGAR */}
          {activeTab === 'baby' && (
            <div className="stack" style={{ gap: '0.9rem' }}>
              <div className="grid3">
                <Field label="Baby Delivery Time" error={fe.babyDeliveryTime} hint="HH:MM">
                  <input type="time" value={babyDeliveryTime} onChange={(e) => setBabyDeliveryTime(e.target.value)} />
                </Field>
                <Field label="Baby Gender" error={fe.babyGender}>
                  <select value={babyGender} onChange={(e) => setBabyGender(e.target.value as any)}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="ambiguous">Ambiguous</option>
                  </select>
                </Field>
                <Field label="Birth Weight (Grams)" error={fe.babyWeightGrams}>
                  <input
                    type="number"
                    min={300}
                    max={7000}
                    value={babyWeightGrams}
                    onChange={(e) => setBabyWeightGrams(Number(e.target.value))}
                    placeholder="e.g. 3150"
                  />
                </Field>
              </div>

              <div className="grid2">
                <Field label="APGAR Score at 1 Minute" error={fe.apgar1min} hint="Scale 0 to 10 (Normal >= 7)">
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={apgar1min}
                    onChange={(e) => setApgar1min(Number(e.target.value))}
                    required
                  />
                </Field>
                <Field label="APGAR Score at 5 Minutes" error={fe.apgar5min} hint="Scale 0 to 10 (Normal >= 8)">
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={apgar5min}
                    onChange={(e) => setApgar5min(Number(e.target.value))}
                    required
                  />
                </Field>
              </div>

              <Field label="Resuscitation & Immediate Neonatal Care" error={fe.babyResuscitationDetails}>
                <textarea
                  value={babyResuscitation}
                  onChange={(e) => setBabyResuscitation(e.target.value)}
                  rows={3}
                  placeholder="Routine drying, stimulation and suction; cry status; CPAP or bag-mask if required; handed over to neonatologist..."
                />
              </Field>
            </div>
          )}

          {/* TAB 5: SURGICAL COUNT & CLOSURE */}
          {activeTab === 'safety' && (
            <div className="stack" style={{ gap: '0.9rem' }}>
              <div style={{ background: 'var(--ok-bg)', padding: '0.75rem', borderRadius: '6px', color: 'var(--ok-text)' }}>
                <b>✅ Surgical Sponge, Needle & Instrument Verification</b>
                <div className="small">Mandatory safety check prior to peritoneal and abdominal wall closure.</div>
              </div>

              <div className="grid3">
                <label className="row" style={{ alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={spongeCount} onChange={(e) => setSpongeCount(e.target.checked)} />
                  <span>Sponges / Swabs Count Correct</span>
                </label>
                <label className="row" style={{ alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={needleCount} onChange={(e) => setNeedleCount(e.target.checked)} />
                  <span>Needle Count Correct</span>
                </label>
                <label className="row" style={{ alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={instrumentCount} onChange={(e) => setInstrumentCount(e.target.checked)} />
                  <span>Instruments Count Correct</span>
                </label>
              </div>

              <div className="grid2">
                <label className="row" style={{ alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.6rem' }}>
                  <input type="checkbox" checked={drainPlaced} onChange={(e) => setDrainPlaced(e.target.checked)} />
                  <span>Abdominal Drain Placed</span>
                </label>
                {drainPlaced && (
                  <Field label="Drain Type & Location" error={fe.drainType}>
                    <input
                      value={drainType}
                      onChange={(e) => setDrainType(e.target.value)}
                      placeholder="e.g. Corrugated rubber drain in pouch of Douglas"
                    />
                  </Field>
                )}
              </div>

              <Field label="Abdominal Wall & Skin Closure Details" error={fe.closureDetails}>
                <textarea
                  value={closureDetails}
                  onChange={(e) => setClosureDetails(e.target.value)}
                  rows={3}
                  placeholder="Suture materials for peritoneum, rectus sheath (e.g. Loop PDS No. 1), subcutaneous, and skin closure (Monocryl 3-0 / staples)..."
                />
              </Field>
            </div>
          )}

          {/* TAB 6: POST-OPERATIVE ORDERS */}
          {activeTab === 'postop' && (
            <div className="stack" style={{ gap: '0.9rem' }}>
              <Field label="Post-Operative Vitals & Lochia Monitoring" error={fe.postopVitalsMonitoring}>
                <textarea
                  value={postopVitals}
                  onChange={(e) => setPostopVitals(e.target.value)}
                  rows={2}
                  placeholder="Vitals frequency, lochia check, fundal contraction monitoring..."
                />
              </Field>

              <div className="grid2">
                <Field label="IV Fluids & Uterotonics" error={fe.postopIvFluids}>
                  <textarea
                    value={postopIvFluids}
                    onChange={(e) => setPostopIvFluids(e.target.value)}
                    rows={2}
                    placeholder="e.g. RL 500ml + 20 IU Oxytocin at 125 ml/hr x 4 hrs"
                  />
                </Field>
                <Field label="Post-Operative Analgesia" error={fe.postopAnalgesia}>
                  <textarea
                    value={postopAnalgesia}
                    onChange={(e) => setPostopAnalgesia(e.target.value)}
                    rows={2}
                    placeholder="e.g. Inj. Paracetamol 1g IV TDS; Inj. Tramadol 50mg IV SOS"
                  />
                </Field>
              </div>

              <div className="grid2">
                <Field label="Antibiotic Coverage" error={fe.postopAntibiotics}>
                  <textarea
                    value={postopAntibiotics}
                    onChange={(e) => setPostopAntibiotics(e.target.value)}
                    rows={2}
                    placeholder="e.g. Inj. Cefuroxime 750mg IV BD x 24 hrs"
                  />
                </Field>
                <Field label="Thromboprophylaxis (VTE)" error={fe.postopThromboprophylaxis}>
                  <textarea
                    value={postopThromboprophylaxis}
                    onChange={(e) => setPostopThromboprophylaxis(e.target.value)}
                    rows={2}
                    placeholder="Early ambulation, compression stockings, LMWH if indicated..."
                  />
                </Field>
              </div>

              <div className="grid2">
                <Field label="Dietary Instructions" error={fe.postopDiet}>
                  <input
                    value={postopDiet}
                    onChange={(e) => setPostopDiet(e.target.value)}
                    placeholder="e.g. NPO for 4-6 hours, then sips of water"
                  />
                </Field>
                <Field label="Urinary Catheter Care" error={fe.postopCatheterInstructions}>
                  <input
                    value={postopCatheter}
                    onChange={(e) => setPostopCatheter(e.target.value)}
                    placeholder="e.g. Remove Foley catheter after 12-24 hours"
                  />
                </Field>
              </div>

              <Field label="Special Instructions / Precautions" error={fe.specialInstructions}>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  rows={2}
                  placeholder="Blood transfusion triggers, wound care, lactation initiation, pediatrician review..."
                />
              </Field>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="row wrap between" style={{ alignItems: 'center', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <div className="row wrap" style={{ gap: '0.35rem' }}>
              <button
                type="button"
                className="btn small"
                disabled={activeTab === 'team'}
                onClick={() => {
                  if (activeTab === 'preop') setActiveTab('team');
                  else if (activeTab === 'surgical') setActiveTab('preop');
                  else if (activeTab === 'baby') setActiveTab('surgical');
                  else if (activeTab === 'safety') setActiveTab('baby');
                  else if (activeTab === 'postop') setActiveTab('safety');
                }}
              >
                ← Previous Tab
              </button>
              <button
                type="button"
                className="btn small"
                disabled={activeTab === 'postop'}
                onClick={() => {
                  if (activeTab === 'team') setActiveTab('preop');
                  else if (activeTab === 'preop') setActiveTab('surgical');
                  else if (activeTab === 'surgical') setActiveTab('baby');
                  else if (activeTab === 'baby') setActiveTab('safety');
                  else if (activeTab === 'safety') setActiveTab('postop');
                }}
              >
                Next Tab →
              </button>
            </div>

            <div className="row" style={{ gap: '0.5rem' }}>
              <button type="button" className="btn" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={submitting}>
                {submitting ? 'Saving Record…' : existingNote ? 'Update Operative Note' : 'Finalize & Save Operative Note'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
