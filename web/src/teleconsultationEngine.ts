/**
 * Teleconsultation & Video Follow-up Helper Engine
 * NMC Telemedicine Practice Guidelines Compliance & Communication Links
 */

export const TELEMEDICINE_STATUTORY_DISCLAIMER_EN =
  'This teleconsultation is conducted in accordance with the Telemedicine Practice Guidelines issued by the National Medical Commission (NMC). Teleconsultation has inherent clinical limitations compared to in-person physical examination. In case of acute obstetric/gyn emergency (e.g. heavy bleeding, severe abdominal pain, loss of fetal movements, high fever, sudden shortness of breath) or neonatal emergency (grunting, lethargy, poor feeding, convulsion), please report immediately to our hospital emergency room or nearest emergency facility.';

export const TELEMEDICINE_STATUTORY_DISCLAIMER_HI =
  'यह वीडियो/टेली परामर्श राष्ट्रीय चिकित्सा आयोग (NMC) के टेलीमेडिसिन प्रैक्टिस दिशानिर्देशों के अनुसार आयोजित किया गया है। टेली-परामर्श व्यक्तिगत शारीरिक जांच का पूर्ण विकल्प नहीं हो सकता। आपात स्थिति (अत्यधिक रक्तस्राव, गंभीर पेट दर्द, शिशु की हलचल में कमी, या शिशु को सांस लेने में कठिनाई) होने पर तुरंत निकटतम अस्पताल की इमरजेंसी में जाएं।';

export function buildWhatsAppVideoInvite(
  patientName: string,
  doctorName: string,
  clinicName: string,
  scheduledIsoDate: string,
  meetingLink: string
): { english: string; hindi: string; combined: string } {
  const d = new Date(scheduledIsoDate);
  const formatted = d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const english = `Namaste ${patientName},\nYour video consultation with ${doctorName} at ${clinicName} is scheduled for ${formatted}.\n\nPlease join the video call at your scheduled time:\n${meetingLink}\n\nEmergency Note: If experiencing severe bleeding, severe abdominal pain, or decreased fetal movements, please report immediately to our emergency department.`;

  const hindi = `नमस्ते ${patientName},\n${clinicName} में ${doctorName} के साथ आपका वीडियो परामर्श ${formatted} को निर्धारित है।\n\nकृपया नियत समय पर वीडियो लिंक से जुड़ें:\n${meetingLink}\n\nआपातकालीन नोट: यदि अत्यधिक रक्तस्राव या गंभीर पेट दर्द हो तो तुरंत अस्पताल इमरजेंसी पहुंचे।`;

  const combined = `${english}\n\n----\n\n${hindi}`;

  return { english, hindi, combined };
}

export function buildWhatsAppDeepLink(phone: string, text: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const prefix = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  return `https://wa.me/${prefix}?text=${encodeURIComponent(text)}`;
}

export function buildJitsiRoomUrl(roomId: string): string {
  return `https://meet.jit.si/${encodeURIComponent(roomId)}`;
}
