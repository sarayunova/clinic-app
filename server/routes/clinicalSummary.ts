import type { FastifyInstance } from 'fastify';
import { requirePerm, type Ctx } from '../app.js';
import { badRequest, notFound } from '../errors.js';
import { ANTENATAL_TEST_CATALOG, type AntenatalTestDef } from '../antenatalCatalog.js';
import { localDate } from '../time.js';

interface DbPatientRow {
  id: number;
  patient_number: string;
  full_name: string;
  date_of_birth: string | null;
  estimated_age_years: number | null;
  phone: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  allergy_status: 'unknown' | 'none' | 'known';
  allergy_details: string | null;
  medical_history: string | null;
  surgical_history: string | null;
  family_history: string | null;
  menstrual_history: string | null;
  last_menstrual_period: string | null;
  menopause_status: string | null;
  obstetric_history: string | null;
  gravida: number | null;
  para: number | null;
  abortions: number | null;
  living: number | null;
  ongoing_medicines: string | null;
  clinical_notes: string | null;
}

interface DbVitalsRow {
  recorded_at: string;
  systolic_mmhg: number | null;
  diastolic_mmhg: number | null;
  pulse_bpm: number | null;
  temperature_c: number | null;
  resp_rate: number | null;
  spo2_pct: number | null;
  weight_kg: number | null;
  note: string | null;
  source: string;
}

function calculateEdd(lmp: string | null | undefined): string | null {
  if (!lmp || !/^\d{4}-\d{2}-\d{2}$/.test(lmp)) return null;
  const [y, m, d] = lmp.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(dt.getTime())) return null;
  dt.setUTCDate(dt.getUTCDate() + 280);
  return dt.toISOString().slice(0, 10);
}

function calculateGestationalAge(lmp: string | null | undefined, asOf: string) {
  if (!lmp || !/^\d{4}-\d{2}-\d{2}$/.test(lmp)) return null;
  const [ly, lm, ld] = lmp.split('-').map(Number);
  const [ty, tm, td] = asOf.split('-').map(Number);
  if (!ly || !lm || !ld || !ty || !tm || !td) return null;
  const lmpUtc = Date.UTC(ly, lm - 1, ld);
  const asOfUtc = Date.UTC(ty, tm - 1, td);
  const diffDays = Math.floor((asOfUtc - lmpUtc) / (24 * 3600 * 1000));
  if (diffDays < 0 || diffDays > 310) return null;
  const weeks = Math.floor(diffDays / 7);
  const days = diffDays % 7;
  return {
    weeks,
    days,
    totalDays: diffDays,
    formatted: `${weeks}w ${days}d`,
    fullFormatted: `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ${days} ${days === 1 ? 'day' : 'days'}`,
  };
}

function formatGpal(p: { gravida?: number | null; para?: number | null; abortions?: number | null; living?: number | null }): string | null {
  const parts: string[] = [];
  if (p.gravida != null) parts.push(`G${p.gravida}`);
  if (p.para != null) parts.push(`P${p.para}`);
  if (p.abortions != null) parts.push(`A${p.abortions}`);
  if (p.living != null) parts.push(`L${p.living}`);
  return parts.length > 0 ? parts.join(' ') : null;
}

export function registerClinicalSummaryRoutes(app: FastifyInstance, { db, cfg }: Ctx): void {
  app.get('/api/patients/:id/clinical-summary', async (req) => {
    requirePerm(req, 'patient:read_clinical');
    const patientId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(patientId) || patientId <= 0) {
      throw badRequest('Invalid patient ID');
    }

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId) as DbPatientRow | undefined;
    if (!patient) throw notFound('Patient');

    const today = localDate(new Date(), cfg.timezone);

    // Compute age
    let ageYears: number | null = patient.estimated_age_years;
    let ageIsEstimated = true;
    if (patient.date_of_birth && /^\d{4}-\d{2}-\d{2}$/.test(patient.date_of_birth)) {
      const bYear = parseInt(patient.date_of_birth.slice(0, 4), 10);
      const tYear = parseInt(today.slice(0, 4), 10);
      ageYears = Math.max(0, tYear - bYear);
      ageIsEstimated = false;
    }

    // Latest Vitals (check OPD visit_vitals and IPD care_entries)
    const opdVitals = db
      .prepare(
        `SELECT vv.recorded_at, vv.systolic_mmhg, vv.diastolic_mmhg, vv.pulse_bpm,
                vv.temperature_c, NULL AS resp_rate, NULL AS spo2_pct, vv.weight_kg,
                vv.note, 'opd' AS source
         FROM visit_vitals vv
         JOIN visits v ON v.id = vv.visit_id
         WHERE v.patient_id = ?
         ORDER BY vv.recorded_at DESC, vv.id DESC
         LIMIT 1`
      )
      .get(patientId) as DbVitalsRow | undefined;

    const ipdVitals = db
      .prepare(
        `SELECT ce.clinical_at AS recorded_at, ce.systolic_mmhg, ce.diastolic_mmhg, ce.pulse_bpm,
                ce.temperature_c, ce.resp_rate, ce.spo2_pct, NULL AS weight_kg,
                ce.content AS note, 'ipd' AS source
         FROM care_entries ce
         JOIN admissions a ON a.id = ce.admission_id
         WHERE a.patient_id = ? AND ce.entry_type = 'observation'
         ORDER BY ce.clinical_at DESC, ce.id DESC
         LIMIT 1`
      )
      .get(patientId) as DbVitalsRow | undefined;

    let latestVitalsRow: DbVitalsRow | null = null;
    if (opdVitals && ipdVitals) {
      latestVitalsRow = opdVitals.recorded_at >= ipdVitals.recorded_at ? opdVitals : ipdVitals;
    } else {
      latestVitalsRow = opdVitals ?? ipdVitals ?? null;
    }

    // Check urine tests for protein/sugar
    let detectedProtein: string | null = null;
    let detectedGlucose: string | null = null;
    const urineRow = db
      .prepare(
        `SELECT result_value, notes
         FROM patient_antenatal_tests
         WHERE patient_id = ? AND test_key IN ('urine_rm_1', 'urine_rm_2', 'urine_rm_3') AND status = 'completed'
         ORDER BY performed_date DESC, id DESC
         LIMIT 1`
      )
      .get(patientId) as { result_value: string | null; notes: string | null } | undefined;

    if (urineRow) {
      const combined = `${urineRow.result_value ?? ''} ${urineRow.notes ?? ''}`;
      const protMatch = combined.match(/protein[:\s]+([0-9\+\w]+)/i) || combined.match(/albumin[:\s]+([0-9\+\w]+)/i) || (combined.includes('2+') ? ['2+', '2+'] : combined.includes('1+') ? ['1+', '1+'] : null);
      if (protMatch) detectedProtein = protMatch[1] ?? protMatch[0];
      const glucMatch = combined.match(/sugar[:\s]+([0-9\+\w]+)/i) || combined.match(/glucose[:\s]+([0-9\+\w]+)/i);
      if (glucMatch) detectedGlucose = glucMatch[1] ?? glucMatch[0];
    }
    if (!detectedProtein && latestVitalsRow?.note) {
      const m = latestVitalsRow.note.match(/protein[:\s]+([0-9\+\w]+)/i) || latestVitalsRow.note.match(/([1-4]\+)\s*protein/i) || (latestVitalsRow.note.includes('2+') ? ['2+', '2+'] : latestVitalsRow.note.includes('1+') ? ['1+', '1+'] : null);
      if (m) detectedProtein = m[1] ?? m[0];
    }

    // Evaluate vitals & MEOWS
    let meowsScore = 0;
    let meowsLevel: 'normal' | 'yellow' | 'red' = 'normal';
    const meowsTriggers: string[] = [];
    let redCount = 0;
    let yellowCount = 0;

    if (latestVitalsRow) {
      const sys = latestVitalsRow.systolic_mmhg;
      const dia = latestVitalsRow.diastolic_mmhg;
      const pulse = latestVitalsRow.pulse_bpm;
      const temp = latestVitalsRow.temperature_c;
      const resp = latestVitalsRow.resp_rate;
      const spo2 = latestVitalsRow.spo2_pct;

      // BP
      if (sys != null || dia != null) {
        if ((sys != null && sys >= 160) || (dia != null && dia >= 110)) {
          redCount++;
          meowsTriggers.push(`Severe Hypertension (${sys ?? '—'}/${dia ?? '—'} mmHg)`);
        } else if ((sys != null && sys < 80) || (dia != null && dia < 50)) {
          redCount++;
          meowsTriggers.push(`Severe Hypotension (${sys ?? '—'}/${dia ?? '—'} mmHg)`);
        } else if ((sys != null && sys >= 140) || (dia != null && dia >= 90)) {
          yellowCount++;
          meowsTriggers.push(`Elevated BP (${sys ?? '—'}/${dia ?? '—'} mmHg)`);
        } else if ((sys != null && sys < 90) || (dia != null && dia < 60)) {
          yellowCount++;
          meowsTriggers.push(`Low BP (${sys ?? '—'}/${dia ?? '—'} mmHg)`);
        }
      }

      // Heart Rate
      if (pulse != null) {
        if (pulse >= 120) {
          redCount++;
          meowsTriggers.push(`Severe Tachycardia (${pulse} bpm)`);
        } else if (pulse < 40) {
          redCount++;
          meowsTriggers.push(`Severe Bradycardia (${pulse} bpm)`);
        } else if (pulse >= 100) {
          yellowCount++;
          meowsTriggers.push(`Tachycardia (${pulse} bpm)`);
        } else if (pulse < 50) {
          yellowCount++;
          meowsTriggers.push(`Bradycardia (${pulse} bpm)`);
        }
      }

      // Temperature
      if (temp != null) {
        if (temp >= 38.5) {
          redCount++;
          meowsTriggers.push(`High Fever (${temp}°C)`);
        } else if (temp < 35.0) {
          redCount++;
          meowsTriggers.push(`Severe Hypothermia (${temp}°C)`);
        } else if (temp >= 38.0) {
          yellowCount++;
          meowsTriggers.push(`Pyrexia (${temp}°C)`);
        } else if (temp < 36.0) {
          yellowCount++;
          meowsTriggers.push(`Hypothermia (${temp}°C)`);
        }
      }

      // Respiratory Rate
      if (resp != null) {
        if (resp >= 30) {
          redCount++;
          meowsTriggers.push(`Critical Tachypnea (${resp}/min)`);
        } else if (resp <= 8) {
          redCount++;
          meowsTriggers.push(`Critical Bradypnea (${resp}/min)`);
        } else if (resp >= 24) {
          yellowCount++;
          meowsTriggers.push(`Tachypnea (${resp}/min)`);
        } else if (resp <= 10) {
          yellowCount++;
          meowsTriggers.push(`Bradypnea (${resp}/min)`);
        }
      }

      // SpO2
      if (spo2 != null) {
        if (spo2 < 92) {
          redCount++;
          meowsTriggers.push(`Critical Hypoxia (${spo2}%)`);
        } else if (spo2 < 95) {
          yellowCount++;
          meowsTriggers.push(`Low SpO2 (${spo2}%)`);
        }
      }

      // Proteinuria
      if (detectedProtein && (detectedProtein.includes('+') || /pos/i.test(detectedProtein))) {
        yellowCount++;
        meowsTriggers.push(`Proteinuria (${detectedProtein})`);
      }

      meowsScore = redCount * 2 + yellowCount;
      if (redCount > 0 || yellowCount >= 2) {
        meowsLevel = 'red';
      } else if (yellowCount === 1) {
        meowsLevel = 'yellow';
      } else {
        meowsLevel = 'normal';
      }
    }

    // Obstetric & Pregnancy Information
    const lmp = patient.last_menstrual_period;
    const edd = calculateEdd(lmp);
    const ga = calculateGestationalAge(lmp, today);
    const isMaternity = Boolean(
      lmp ||
      patient.gravida != null ||
      patient.para != null ||
      db.prepare("SELECT 1 FROM visits WHERE patient_id = ? AND antenatal_notes IS NOT NULL LIMIT 1").get(patientId)
    );

    let trimester: 'First (1–12w)' | 'Second (13–27w)' | 'Third (28–40w+)' | null = null;
    if (ga) {
      if (ga.weeks < 14) trimester = 'First (1–12w)';
      else if (ga.weeks < 28) trimester = 'Second (13–27w)';
      else trimester = 'Third (28–40w+)';
    }

    // Antenatal Tests
    const savedTestRows = db
      .prepare(
        `SELECT t.test_key, t.category, t.test_name, t.status, t.result_value, t.notes,
                t.performed_date, t.attachment_id,
                a.title AS attachment_title
         FROM patient_antenatal_tests t
         LEFT JOIN attachments a ON a.id = t.attachment_id AND a.voided_at IS NULL
         WHERE t.patient_id = ?`
      )
      .all(patientId) as Array<{
        test_key: string;
        category: string;
        test_name: string;
        status: string;
        result_value: string | null;
        notes: string | null;
        performed_date: string | null;
        attachment_id: number | null;
        attachment_title: string | null;
      }>;

    const savedMap = new Map(savedTestRows.map((r) => [r.test_key, r]));

    const antenatalItems = ANTENATAL_TEST_CATALOG.map((def: AntenatalTestDef) => {
      const saved = savedMap.get(def.key);
      return {
        testKey: def.key,
        testName: def.name,
        category: def.category,
        recommendedWeeks: def.recommendedWeeks,
        isMandatory: Boolean(def.isMandatory),
        status: saved?.status ?? 'pending',
        completedDate: saved?.performed_date ?? null,
        resultValue: saved?.result_value ?? null,
        notes: saved?.notes ?? null,
        attachmentTitle: saved?.attachment_title ?? null,
      };
    });

    const doneCount = antenatalItems.filter((t) => t.status === 'completed').length;
    const pendingCount = antenatalItems.filter((t) => t.status === 'pending' || t.status === 'ordered').length;

    // Detect Blood Group & Rh Status
    let detectedBloodGroup = db
      .prepare('SELECT blood_group FROM patient_pediatric_profiles WHERE patient_id = ?')
      .get(patientId) as { blood_group: string | null } | undefined;
    let bloodGroupStr = detectedBloodGroup?.blood_group ?? null;
    const bgTest = antenatalItems.find((t) => t.testKey === 'blood_group');
    if (bgTest?.resultValue) {
      bloodGroupStr = bgTest.resultValue;
    }

    // High Risk Flags
    const highRiskFlags: string[] = [];
    if (bloodGroupStr && (bloodGroupStr.includes('-') || /neg/i.test(bloodGroupStr))) {
      highRiskFlags.push('Rh-Negative Mother: Monitor Anti-D requirement & indirect Coombs');
    }
    if (ageYears != null && ageYears >= 35) {
      highRiskFlags.push('Advanced Maternal Age (≥ 35 years)');
    }
    if (ageYears != null && ageYears < 18) {
      highRiskFlags.push('Adolescent / Teenage Pregnancy (< 18 years)');
    }
    if (patient.para != null && patient.para >= 4) {
      highRiskFlags.push(`Grand Multipara (Para ${patient.para})`);
    }
    if (patient.abortions != null && patient.abortions >= 2) {
      highRiskFlags.push(`Bad Obstetric History (${patient.abortions} previous miscarriages/abortions)`);
    }

    // Check Previous Scar / LSCS in history
    const allHistory = `${patient.obstetric_history ?? ''} ${patient.surgical_history ?? ''} ${patient.clinical_notes ?? ''}`;
    if (/lscs|cesarean|c-section|hysterotomy/i.test(allHistory)) {
      highRiskFlags.push('Previous Cesarean Section / Uterine Scar');
    }

    // Check Vitals for flags
    if (latestVitalsRow) {
      const s = latestVitalsRow.systolic_mmhg;
      const d = latestVitalsRow.diastolic_mmhg;
      if ((s != null && s >= 160) || (d != null && d >= 110)) {
        highRiskFlags.push(`Severe Hypertension (${s ?? '—'}/${d ?? '—'} mmHg)`);
      } else if ((s != null && s >= 140) || (d != null && d >= 90)) {
        highRiskFlags.push(`Elevated BP / Gestational Hypertension (${s ?? '—'}/${d ?? '—'} mmHg)`);
      }
      if (detectedProtein && (detectedProtein.includes('+') || /pos/i.test(detectedProtein))) {
        highRiskFlags.push(`Proteinuria (${detectedProtein}) - Pre-eclampsia Risk`);
      }
    }
    if (meowsLevel === 'red') {
      highRiskFlags.push('Red MEOWS Alert: Physiological instability detected');
    }

    // Recent Consultations
    const recentVisits = db
      .prepare(
        `SELECT v.id, substr(v.visit_at, 1, 10) AS visit_date, v.status, v.assessment, v.complaints, v.examination, v.advice,
                v.follow_up_date, v.antenatal_notes, u.full_name AS doctor_name
         FROM visits v
         LEFT JOIN users u ON u.id = COALESCE(v.finalised_by, v.created_by)
         WHERE v.patient_id = ?
         ORDER BY v.visit_at DESC, v.id DESC
         LIMIT 5`
      )
      .all(patientId) as Array<{
        id: number;
        visit_date: string;
        status: string;
        assessment: string | null;
        complaints: string | null;
        examination: string | null;
        advice: string | null;
        follow_up_date: string | null;
        antenatal_notes: string | null;
        doctor_name: string | null;
      }>;

    // Active Prescriptions (from last finalised consultation or recent visits)
    const activePrescriptions = db
      .prepare(
        `SELECT pi.medicine, pi.strength, pi.dose, pi.route, pi.frequency, pi.duration, pi.instructions,
                substr(v.visit_at, 1, 10) AS visit_date
         FROM prescription_items pi
         JOIN visits v ON v.id = pi.visit_id
         WHERE v.patient_id = ? AND v.status = 'final'
         ORDER BY v.visit_at DESC, pi.id ASC
         LIMIT 12`
      )
      .all(patientId) as Array<{
        medicine: string;
        strength: string | null;
        dose: string | null;
        route: string | null;
        frequency: string | null;
        duration: string | null;
        instructions: string | null;
        visit_date: string;
      }>;

    // Latest Admission
    const latestAdmission = db
      .prepare(
        `SELECT a.id, a.admission_number, substr(a.admitted_at, 1, 10) AS admitted_date,
                substr(a.discharged_at, 1, 10) AS discharged_date, a.status, a.reason,
                ds.final_diagnosis, ds.condition_at_discharge, ds.discharge_medicines
         FROM admissions a
         LEFT JOIN discharge_summaries ds ON ds.admission_id = a.id
         WHERE a.patient_id = ?
         ORDER BY a.admitted_at DESC, a.id DESC
         LIMIT 1`
      )
      .get(patientId) as
      | {
          id: number;
          admission_number: string;
          admitted_date: string;
          discharged_date: string | null;
          status: string;
          reason: string | null;
          final_diagnosis: string | null;
          condition_at_discharge: string | null;
          discharge_medicines: string | null;
        }
      | undefined;

    const latestUsgRow = db
      .prepare(
        `SELECT u.*, cu.full_name AS created_by_name
         FROM patient_ultrasound_reports u
         LEFT JOIN users cu ON cu.id = u.created_by
         WHERE u.patient_id = ?
         ORDER BY u.scan_date DESC, u.id DESC
         LIMIT 1`
      )
      .get(patientId) as any | undefined;

    return {
      patient: {
        id: patient.id,
        patientNumber: patient.patient_number,
        fullName: patient.full_name,
        dateOfBirth: patient.date_of_birth,
        ageYears,
        ageIsEstimated,
        phone: patient.phone,
        address: patient.address,
        emergencyContactName: patient.emergency_contact_name,
        emergencyContactPhone: patient.emergency_contact_phone,
        allergyStatus: patient.allergy_status,
        allergyDetails: patient.allergy_details,
        bloodGroup: bloodGroupStr,
        medicalHistory: patient.medical_history,
        surgicalHistory: patient.surgical_history,
        familyHistory: patient.family_history,
        menstrualHistory: patient.menstrual_history,
        lastMenstrualPeriod: patient.last_menstrual_period,
        menopauseStatus: patient.menopause_status,
        obstetricHistory: patient.obstetric_history,
        gravida: patient.gravida,
        para: patient.para,
        abortions: patient.abortions,
        living: patient.living,
        ongoingMedicines: patient.ongoing_medicines,
        clinicalNotes: patient.clinical_notes,
      },
      pregnancy: {
        isMaternity,
        lmp,
        edd,
        gestationalAgeFormatted: ga ? ga.formatted : null,
        gestationalWeeks: ga ? ga.weeks : null,
        gestationalDays: ga ? ga.days : null,
        trimester,
        gpalFormatted: formatGpal(patient),
        highRiskFlags,
      },
      latestVitals: latestVitalsRow
        ? {
            recordedAt: latestVitalsRow.recorded_at,
            systolic: latestVitalsRow.systolic_mmhg,
            diastolic: latestVitalsRow.diastolic_mmhg,
            heartRate: latestVitalsRow.pulse_bpm,
            temperatureC: latestVitalsRow.temperature_c,
            respiratoryRate: latestVitalsRow.resp_rate,
            spo2: latestVitalsRow.spo2_pct,
            weightKg: latestVitalsRow.weight_kg,
            urineProtein: detectedProtein,
            urineGlucose: detectedGlucose,
            source: latestVitalsRow.source,
            meowsScore,
            meowsLevel,
            meowsTriggers,
          }
        : null,
      antenatalTests: isMaternity
        ? {
            total: antenatalItems.length,
            done: doneCount,
            pending: pendingCount,
            items: antenatalItems,
          }
        : null,
      recentVisits: recentVisits.map((v) => ({
        id: v.id,
        visitDate: v.visit_date,
        status: v.status,
        assessment: v.assessment,
        complaints: v.complaints,
        examination: v.examination,
        advice: v.advice,
        followUpDate: v.follow_up_date,
        antenatalNotes: v.antenatal_notes,
        doctorName: v.doctor_name,
      })),
      activeMedicines: activePrescriptions.map((m) => ({
        medicine: m.medicine,
        strength: m.strength,
        dose: m.dose,
        route: m.route,
        frequency: m.frequency,
        duration: m.duration,
        instructions: m.instructions,
        prescribedDate: m.visit_date,
      })),
      latestAdmission: latestAdmission
        ? {
            id: latestAdmission.id,
            admissionNumber: latestAdmission.admission_number,
            admittedDate: latestAdmission.admitted_date,
            dischargedDate: latestAdmission.discharged_date,
            status: latestAdmission.status,
            reason: latestAdmission.reason,
            finalDiagnosis: latestAdmission.final_diagnosis,
            conditionAtDischarge: latestAdmission.condition_at_discharge,
            dischargeMedicines: latestAdmission.discharge_medicines,
          }
        : null,
      latestUltrasound: latestUsgRow
        ? {
            id: latestUsgRow.id,
            patientId: latestUsgRow.patient_id,
            scanDate: latestUsgRow.scan_date,
            scanType: latestUsgRow.scan_type,
            indication: latestUsgRow.indication,
            gestationalAgeWeeks: latestUsgRow.gestational_age_weeks,
            gestationalAgeDays: latestUsgRow.gestational_age_days,
            fetalNumber: latestUsgRow.fetal_number,
            cardiacActivity: latestUsgRow.cardiac_activity,
            fhrBpm: latestUsgRow.fhr_bpm,
            presentation: latestUsgRow.presentation,
            placentaLocation: latestUsgRow.placenta_location,
            placentaGrade: latestUsgRow.placenta_grade,
            amnioticFluidCm: latestUsgRow.amniotic_fluid_cm,
            amnioticFluidAssessment: latestUsgRow.amniotic_fluid_assessment,
            bpdMm: latestUsgRow.bpd_mm,
            flMm: latestUsgRow.fl_mm,
            acMm: latestUsgRow.ac_mm,
            efwGrams: latestUsgRow.efw_grams,
            efwPercentile: latestUsgRow.efw_percentile,
            impression: latestUsgRow.impression,
            recommendations: latestUsgRow.recommendations,
            sonographerName: latestUsgRow.sonographer_name,
            createdByName: latestUsgRow.created_by_name ?? null,
          }
        : null,
    };
  });
}
