/**
 * Utilities for patient communication via WhatsApp and SMS deep links.
 * Generates formatted, friendly clinical message templates and encodes
 * direct wa.me and sms: URLs with zero external vendor dependencies.
 */

export type CommunicationChannel = 'whatsapp' | 'sms' | 'clipboard';

export type CommunicationMessageType =
  | 'appointment_reminder'
  | 'antenatal_recall'
  | 'prescription'
  | 'vaccination'
  | 'custom';

/**
 * Normalises a raw phone number into an international digit-only string.
 * - Strips all non-digit characters (+, -, spaces, parentheses).
 * - Strips leading trunk prefixes (e.g. leading 0).
 * - Prepends default country code (91 for India) if 10 digits are provided.
 */
export function cleanPhoneNumber(raw: string, defaultCountryCode: string = '91'): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  // Remove trunk 0 prefix if present (e.g. 09876543210 -> 9876543210)
  if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }
  // Standard 10-digit mobile number -> attach country code
  if (digits.length === 10) {
    return `${defaultCountryCode}${digits}`;
  }
  return digits;
}

/**
 * Builds a universal WhatsApp deep link compatible with both WhatsApp Web and mobile apps.
 */
export function buildWhatsAppUrl(phone: string, text: string): string {
  const cleaned = cleanPhoneNumber(phone);
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}

/**
 * Builds a standard SMS URI compatible with mobile OS dialers / messaging apps.
 */
export function buildSmsUrl(phone: string, text: string): string {
  const cleaned = cleanPhoneNumber(phone);
  return `sms:${cleaned}?body=${encodeURIComponent(text)}`;
}

export interface AppointmentReminderParams {
  clinicName?: string;
  doctorName?: string;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  tokenNumber?: number | string | null;
  clinicPhone?: string;
}

export function formatAppointmentReminderMessage(p: AppointmentReminderParams): string {
  const clinic = p.clinicName ? `🏥 *${p.clinicName}*` : '🏥 *Clinic Appointment Reminder*';
  const doc = p.doctorName ? ` with *${p.doctorName}*` : '';
  const token = p.tokenNumber ? `\n🔢 Token Number: #${p.tokenNumber}` : '';
  const contact = p.clinicPhone ? `\n📞 Clinic Contact: ${p.clinicPhone}` : '';

  return `${clinic}
Namaste *${p.patientName}*,

This is a reminder for your upcoming consultation${doc}:
📅 Date: ${p.appointmentDate}
⏰ Time: ${p.appointmentTime}${token}

📍 Please arrive 10 minutes prior to your scheduled time.
If you need to reschedule or cancel, kindly let us know.${contact}`;
}

export interface AntenatalRecallParams {
  clinicName?: string;
  doctorName?: string;
  patientName: string;
  nextVisitDate?: string;
  gestationalAge?: string;
  edd?: string;
  customNote?: string;
  clinicPhone?: string;
}

export function formatAntenatalRecallMessage(p: AntenatalRecallParams): string {
  const clinic = p.clinicName ? `🏥 *${p.clinicName}*` : '🏥 *Maternity & Antenatal Care*';
  const doc = p.doctorName ? ` with *${p.doctorName}*` : '';
  const ga = p.gestationalAge ? `\n🤰 Gestational Age: ${p.gestationalAge}` : '';
  const edd = p.edd ? `\n🎯 Estimated Due Date: ${p.edd}` : '';
  const date = p.nextVisitDate ? `\n📅 Recommended Follow-up: *${p.nextVisitDate}*` : '';
  const note = p.customNote ? `\n\n📌 Doctor's Note: ${p.customNote}` : '';
  const contact = p.clinicPhone ? `\n📞 Clinic Contact: ${p.clinicPhone}` : '';

  return `${clinic} - Antenatal Checkup Reminder
Dear *${p.patientName}*,

Regular antenatal checkups ensure the best health for both mother and baby. You are due for your routine ANC checkup${doc}.${ga}${edd}${date}

⚠️ *What to bring:*
• ANC / Mother-Child card
• Latest ultrasound scans and blood/urine lab reports
• List of current medications${note}

Wishing you a healthy, safe pregnancy!${contact}`;
}

export interface PrescriptionItemSummary {
  name: string;
  dose?: string | null;
  route?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
}

export interface PrescriptionMessageParams {
  clinicName?: string;
  doctorName?: string;
  patientName: string;
  visitDate: string;
  items: PrescriptionItemSummary[];
  generalAdvice?: string | null;
  followUpDate?: string | null;
  clinicPhone?: string;
}

export function formatPrescriptionMessage(p: PrescriptionMessageParams): string {
  const clinic = p.clinicName ? `🏥 *${p.clinicName}*` : '🏥 *Prescription Summary*';
  const doc = p.doctorName ? `\n👨‍⚕️ Consultant: *${p.doctorName}*` : '';

  let medList = '';
  if (p.items.length === 0) {
    medList = '\n_No active medicines prescribed._';
  } else {
    medList = '\n\n💊 *Prescribed Medications:*';
    p.items.forEach((item, idx) => {
      const parts: string[] = [item.name];
      if (item.dose) parts.push(item.dose);
      if (item.frequency) parts.push(`(${item.frequency})`);
      if (item.duration) parts.push(`for ${item.duration}`);
      if (item.instructions) parts.push(`- ${item.instructions}`);
      medList += `\n${idx + 1}. ${parts.join(' ')}`;
    });
  }

  const advice = p.generalAdvice ? `\n\n📝 *Doctor's Advice:*\n${p.generalAdvice}` : '';
  const followUp = p.followUpDate ? `\n\n📅 *Next Follow-up:* ${p.followUpDate}` : '';
  const contact = p.clinicPhone ? `\n📞 Clinic Contact: ${p.clinicPhone}` : '';

  return `${clinic}
Prescription Advice for *${p.patientName}*
Consultation Date: ${p.visitDate}${doc}${medList}${advice}${followUp}

⚠️ _Take medicines as advised. In case of emergency or severe discomfort, please contact the clinic or visit nearest hospital immediately._${contact}`;
}

export interface VaccineReminderParams {
  clinicName?: string;
  doctorName?: string;
  childName: string;
  parentName?: string;
  vaccineName: string;
  dueAge?: string;
  dueDate?: string;
  clinicPhone?: string;
}

export function formatVaccineReminderMessage(p: VaccineReminderParams): string {
  const clinic = p.clinicName ? `🏥 *${p.clinicName}*` : '🏥 *Pediatric Immunization Reminder*';
  const salutation = p.parentName ? `Dear *${p.parentName}*,\n\n` : '';
  const age = p.dueAge ? `\n🎯 Milestone Age: ${p.dueAge}` : '';
  const date = p.dueDate ? `\n📅 Due Date: *${p.dueDate}*` : '';
  const contact = p.clinicPhone ? `\n📞 Clinic Contact: ${p.clinicPhone}` : '';

  return `${clinic}
${salutation}Vaccination is due for baby *${p.childName}*:
💉 Vaccine: *${p.vaccineName}*${age}${date}

📍 Timely immunization protects your child against preventable infections. Please bring your Child Immunization Card when you visit.${contact}`;
}

export interface CustomMessageParams {
  clinicName?: string;
  patientName: string;
  text: string;
  clinicPhone?: string;
}

export function formatCustomMessage(p: CustomMessageParams): string {
  const clinic = p.clinicName ? `🏥 *${p.clinicName}*\n` : '';
  const contact = p.clinicPhone ? `\n\n📞 Contact: ${p.clinicPhone}` : '';
  return `${clinic}Dear *${p.patientName}*,

${p.text}${contact}`;
}
