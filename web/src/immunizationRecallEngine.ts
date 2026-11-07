/**
 * Immunization Recall, Smart Patient Reminders & Emergency Medical Passport Engine
 *
 * References:
 * - Indian Academy of Pediatrics (IAP) Advisory Committee on Vaccines and Immunization Practices (ACVIP).
 * - National Immunization Schedule (NIS), Ministry of Health & Family Welfare, Government of India.
 * - WHO Guidelines on Immunization Systems and Electronic Recall.
 */

export interface VaccineMilestone {
  code: string;
  name: string;
  minAgeWeeks: number;
  maxAgeWeeks: number; // overdue after this
  labelAge: string;
  isNationalEssential: boolean;
}

export const IAP_VACCINE_CATALOG: VaccineMilestone[] = [
  { code: 'bcg', name: 'BCG', minAgeWeeks: 0, maxAgeWeeks: 4, labelAge: 'Birth', isNationalEssential: true },
  { code: 'opv_0', name: 'OPV 0', minAgeWeeks: 0, maxAgeWeeks: 2, labelAge: 'Birth', isNationalEssential: true },
  { code: 'hepb_0', name: 'Hepatitis B (Birth dose)', minAgeWeeks: 0, maxAgeWeeks: 1, labelAge: 'Birth (<24h)', isNationalEssential: true },

  { code: 'penta_1', name: 'Pentavalent 1 (DTP-HepB-Hib)', minAgeWeeks: 6, maxAgeWeeks: 9, labelAge: '6 Weeks', isNationalEssential: true },
  { code: 'ipv_1', name: 'IPV 1', minAgeWeeks: 6, maxAgeWeeks: 9, labelAge: '6 Weeks', isNationalEssential: true },
  { code: 'rota_1', name: 'Rotavirus 1', minAgeWeeks: 6, maxAgeWeeks: 9, labelAge: '6 Weeks', isNationalEssential: true },
  { code: 'pcv_1', name: 'PCV 1 (Pneumococcal)', minAgeWeeks: 6, maxAgeWeeks: 9, labelAge: '6 Weeks', isNationalEssential: true },

  { code: 'penta_2', name: 'Pentavalent 2 (DTP-HepB-Hib)', minAgeWeeks: 10, maxAgeWeeks: 13, labelAge: '10 Weeks', isNationalEssential: true },
  { code: 'rota_2', name: 'Rotavirus 2', minAgeWeeks: 10, maxAgeWeeks: 13, labelAge: '10 Weeks', isNationalEssential: true },
  { code: 'pcv_2', name: 'PCV 2', minAgeWeeks: 10, maxAgeWeeks: 13, labelAge: '10 Weeks', isNationalEssential: true },

  { code: 'penta_3', name: 'Pentavalent 3 (DTP-HepB-Hib)', minAgeWeeks: 14, maxAgeWeeks: 18, labelAge: '14 Weeks', isNationalEssential: true },
  { code: 'ipv_2', name: 'IPV 2', minAgeWeeks: 14, maxAgeWeeks: 18, labelAge: '14 Weeks', isNationalEssential: true },
  { code: 'rota_3', name: 'Rotavirus 3', minAgeWeeks: 14, maxAgeWeeks: 18, labelAge: '14 Weeks', isNationalEssential: true },
  { code: 'pcv_booster', name: 'PCV Booster', minAgeWeeks: 36, maxAgeWeeks: 44, labelAge: '9 Months', isNationalEssential: true },

  { code: 'mr_1', name: 'MR 1 / MMR 1 (Measles-Rubella)', minAgeWeeks: 38, maxAgeWeeks: 48, labelAge: '9 Months', isNationalEssential: true },
  { code: 'je_1', name: 'Japanese Encephalitis 1', minAgeWeeks: 38, maxAgeWeeks: 48, labelAge: '9 Months', isNationalEssential: false },
  { code: 'vita_1', name: 'Vitamin A (1st Dose)', minAgeWeeks: 38, maxAgeWeeks: 48, labelAge: '9 Months', isNationalEssential: true },

  { code: 'hepa_1', name: 'Hepatitis A 1', minAgeWeeks: 52, maxAgeWeeks: 65, labelAge: '12 Months', isNationalEssential: false },
  { code: 'mmr_2', name: 'MMR 2', minAgeWeeks: 65, maxAgeWeeks: 78, labelAge: '15 Months', isNationalEssential: true },
  { code: 'varicella_1', name: 'Varicella (Chickenpox) 1', minAgeWeeks: 65, maxAgeWeeks: 78, labelAge: '15 Months', isNationalEssential: false },

  { code: 'dtp_b1', name: 'DTP Booster 1', minAgeWeeks: 72, maxAgeWeeks: 96, labelAge: '16–18 Months', isNationalEssential: true },
  { code: 'ipv_b1', name: 'IPV Booster', minAgeWeeks: 72, maxAgeWeeks: 96, labelAge: '16–18 Months', isNationalEssential: true },
  { code: 'tcv_1', name: 'Typhoid Conjugate (TCV)', minAgeWeeks: 104, maxAgeWeeks: 130, labelAge: '2 Years', isNationalEssential: true },
  { code: 'dtp_b2', name: 'DTP Booster 2', minAgeWeeks: 208, maxAgeWeeks: 260, labelAge: '5 Years', isNationalEssential: true },
];

export interface ImmunizationStatus {
  vaccine: VaccineMilestone;
  status: 'completed' | 'due_now' | 'overdue' | 'upcoming';
  daysOverdueOrDue: number;
}

export function evaluatePatientVaccines(
  dateOfBirthStr: string,
  administeredVaccineCodes: string[],
): {
  ageWeeks: number;
  ageDays: number;
  completedCount: number;
  dueNow: ImmunizationStatus[];
  overdue: ImmunizationStatus[];
  upcomingNext30d: ImmunizationStatus[];
} {
  const dob = new Date(dateOfBirthStr);
  const now = new Date();
  const diffMs = now.getTime() - dob.getTime();
  const ageDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const ageWeeks = Math.floor(ageDays / 7);

  const givenSet = new Set(administeredVaccineCodes.map((c) => c.toLowerCase().trim()));

  const dueNow: ImmunizationStatus[] = [];
  const overdue: ImmunizationStatus[] = [];
  const upcomingNext30d: ImmunizationStatus[] = [];
  let completedCount = 0;

  for (const v of IAP_VACCINE_CATALOG) {
    if (givenSet.has(v.code.toLowerCase())) {
      completedCount++;
      continue;
    }

    if (ageWeeks > v.maxAgeWeeks) {
      overdue.push({
        vaccine: v,
        status: 'overdue',
        daysOverdueOrDue: (ageWeeks - v.maxAgeWeeks) * 7,
      });
    } else if (ageWeeks >= v.minAgeWeeks && ageWeeks <= v.maxAgeWeeks) {
      dueNow.push({
        vaccine: v,
        status: 'due_now',
        daysOverdueOrDue: (ageWeeks - v.minAgeWeeks) * 7,
      });
    } else if (v.minAgeWeeks - ageWeeks <= 4) {
      upcomingNext30d.push({
        vaccine: v,
        status: 'upcoming',
        daysOverdueOrDue: (v.minAgeWeeks - ageWeeks) * 7,
      });
    }
  }

  return {
    ageWeeks,
    ageDays,
    completedCount,
    dueNow,
    overdue,
    upcomingNext30d,
  };
}

export interface ReminderMessageParams {
  patientName: string;
  parentName?: string;
  clinicName: string;
  phone: string;
  doctorName: string;
  itemsDue: string[];
  dueDateFormatted: string;
  language: 'english' | 'hindi';
  reminderType: 'immunization' | 'antenatal' | 'ultrasound' | 'general';
}

export function generateReminderText(p: ReminderMessageParams): string {
  const itemStr = p.itemsDue.join(', ');
  const parent = p.parentName ? `Parent of ${p.patientName}` : p.patientName;

  if (p.language === 'hindi') {
    if (p.reminderType === 'immunization') {
      return `नमस्ते ${parent},\n\nयह ${p.clinicName} से आवश्यक टीकाकरण अनुस्मारक है। आपके बच्चे (${p.patientName}) के निम्नलिखित टीके देय हैं:\n📌 ${itemStr}\n\nसमय पर टीकाकरण बच्चे की पूर्ण सुरक्षा सुनिश्चित करता है। कृपया क्लिनिक पधारें या संपर्क करें: ${p.phone}.\n\nसादर,\n${p.doctorName}\n${p.clinicName}`;
    }
    if (p.reminderType === 'antenatal') {
      return `नमस्ते ${p.patientName},\n\nयह ${p.clinicName} से आपकी आगामी गर्भावस्था जांच का अनुस्मारक है। आपकी जांच तिथि: ${p.dueDateFormatted} निर्धारित है।\nकृपया अपनी सोनोग्राफी और रक्त जांच रिपोर्ट साथ लाएं।\nसंपर्क: ${p.phone}.\n\nसादर,\n${p.doctorName}`;
    }
    return `नमस्ते ${p.patientName},\n\nयह ${p.clinicName} से आवश्यक स्वास्थ्य जांच का अनुस्मारक है। कृपया परामर्श हेतु क्लिनिक पधारें: ${p.phone}.\n\nसादर,\n${p.doctorName}`;
  }

  // English default
  if (p.reminderType === 'immunization') {
    return `Hello ${parent},\n\nThis is a priority health reminder from ${p.clinicName}. Your child (${p.patientName}) is due for the following essential vaccination(s):\n💉 ${itemStr}\n\nTimely immunization protects against severe pediatric infections. Please visit the clinic or call ${p.phone} to schedule your visit.\n\nWarm regards,\n${p.doctorName}\n${p.clinicName}`;
  }

  if (p.reminderType === 'antenatal') {
    return `Dear ${p.patientName},\n\nThis is a gentle reminder from ${p.clinicName} for your scheduled Antenatal Care (ANC) appointment on ${p.dueDateFormatted}.\nPlease remember to bring your ultrasound scans and latest laboratory reports.\nContact: ${p.phone}.\n\nBest regards,\n${p.doctorName}`;
  }

  return `Dear ${p.patientName},\n\nThis is a clinical reminder from ${p.clinicName} regarding your upcoming review/follow-up. Please contact us at ${p.phone} to confirm your appointment.\n\nBest regards,\n${p.doctorName}`;
}

export function buildWhatsAppLink(rawPhone: string, messageText: string): string {
  const cleaned = rawPhone.replace(/\D/g, '');
  // Default to India country code 91 if 10 digits
  const formatted = cleaned.length === 10 ? `91${cleaned}` : cleaned;
  const encoded = encodeURIComponent(messageText);
  return `https://wa.me/${formatted}?text=${encoded}`;
}

export interface EmergencyPassportData {
  patientId: number;
  fullName: string;
  ageYears?: number | null;
  bloodGroup?: string | null;
  allergies?: string | null;
  obstetricSummary?: string | null;
  highRiskConditions?: string[];
  edd?: string | null;
  emergencyContact?: string | null;
  hospitalName: string;
  hospitalHelpline: string;
}

export function generateEmergencyPassportPayload(data: EmergencyPassportData): string {
  return JSON.stringify({
    app: 'LiVi-Clinic-Emergency-Passport',
    id: data.patientId,
    name: data.fullName,
    age: data.ageYears ?? 'N/A',
    bg: data.bloodGroup ?? 'Unknown',
    al: data.allergies ?? 'None known',
    ob: data.obstetricSummary ?? null,
    risk: data.highRiskConditions ?? [],
    edd: data.edd ?? null,
    em: data.emergencyContact ?? null,
    hosp: `${data.hospitalName} (${data.hospitalHelpline})`,
  });
}
