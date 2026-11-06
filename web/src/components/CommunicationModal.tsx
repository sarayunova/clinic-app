import { useEffect, useState } from 'react';
import { api, type ClinicSettings } from '../api';
import {
  cleanPhoneNumber,
  buildWhatsAppUrl,
  buildSmsUrl,
  formatAppointmentReminderMessage,
  formatAntenatalRecallMessage,
  formatPrescriptionMessage,
  formatVaccineReminderMessage,
  formatCustomMessage,
  type CommunicationChannel,
  type CommunicationMessageType,
  type AppointmentReminderParams,
  type AntenatalRecallParams,
  type PrescriptionMessageParams,
  type VaccineReminderParams,
} from '../communicationUtils';

export interface CommunicationModalProps {
  open: boolean;
  onClose: () => void;
  patientId: number;
  patientName: string;
  patientPhone?: string | null;
  defaultType?: CommunicationMessageType;
  appointmentData?: Partial<AppointmentReminderParams>;
  antenatalData?: Partial<AntenatalRecallParams>;
  prescriptionData?: Partial<PrescriptionMessageParams>;
  vaccineData?: Partial<VaccineReminderParams>;
  clinicSettings?: ClinicSettings | null;
}

export function CommunicationModal({
  open,
  onClose,
  patientId,
  patientName,
  patientPhone,
  defaultType = 'appointment_reminder',
  appointmentData,
  antenatalData,
  prescriptionData,
  vaccineData,
  clinicSettings: propClinicSettings,
}: CommunicationModalProps) {
  const [clinic, setClinic] = useState<ClinicSettings | null>(propClinicSettings ?? null);
  const [phone, setPhone] = useState(patientPhone ?? '');
  const [messageType, setMessageType] = useState<CommunicationMessageType>(defaultType);
  const [messageText, setMessageText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && !propClinicSettings) {
      api<ClinicSettings>('GET', '/api/settings')
        .then(setClinic)
        .catch(() => {});
    }
  }, [open, propClinicSettings]);

  useEffect(() => {
    if (open) {
      setPhone(patientPhone ?? '');
      setMessageType(defaultType);
    }
  }, [open, patientPhone, defaultType]);

  // Generate template text whenever type, clinic, or related data changes
  useEffect(() => {
    if (!open) return;
    const cName = clinic?.clinicName;
    const cPhone = clinic?.phone;
    const dName = clinic?.doctorName;

    let text = '';
    switch (messageType) {
      case 'appointment_reminder':
        text = formatAppointmentReminderMessage({
          clinicName: cName,
          doctorName: appointmentData?.doctorName ?? dName,
          patientName,
          appointmentDate: appointmentData?.appointmentDate ?? new Date().toISOString().slice(0, 10),
          appointmentTime: appointmentData?.appointmentTime ?? '10:00 AM',
          tokenNumber: appointmentData?.tokenNumber,
          clinicPhone: cPhone,
        });
        break;

      case 'antenatal_recall':
        text = formatAntenatalRecallMessage({
          clinicName: cName,
          doctorName: antenatalData?.doctorName ?? dName,
          patientName,
          nextVisitDate: antenatalData?.nextVisitDate,
          gestationalAge: antenatalData?.gestationalAge,
          edd: antenatalData?.edd,
          customNote: antenatalData?.customNote,
          clinicPhone: cPhone,
        });
        break;

      case 'prescription':
        text = formatPrescriptionMessage({
          clinicName: cName,
          doctorName: prescriptionData?.doctorName ?? dName,
          patientName,
          visitDate: prescriptionData?.visitDate ?? new Date().toISOString().slice(0, 10),
          items: prescriptionData?.items ?? [],
          generalAdvice: prescriptionData?.generalAdvice,
          followUpDate: prescriptionData?.followUpDate,
          clinicPhone: cPhone,
        });
        break;

      case 'vaccination':
        text = formatVaccineReminderMessage({
          clinicName: cName,
          doctorName: vaccineData?.doctorName ?? dName,
          childName: vaccineData?.childName ?? patientName,
          parentName: vaccineData?.parentName,
          vaccineName: vaccineData?.vaccineName ?? 'Scheduled Vaccine',
          dueAge: vaccineData?.dueAge,
          dueDate: vaccineData?.dueDate,
          clinicPhone: cPhone,
        });
        break;

      case 'custom':
      default:
        text = formatCustomMessage({
          clinicName: cName,
          patientName,
          text: 'Please visit the clinic for your regular consultation.',
          clinicPhone: cPhone,
        });
        break;
    }
    setMessageText(text);
  }, [open, messageType, clinic, patientName, appointmentData, antenatalData, prescriptionData, vaccineData]);

  if (!open) return null;

  const cleanedPhone = cleanPhoneNumber(phone);
  const isValidPhone = cleanedPhone.length >= 10;

  const logAction = async (channel: CommunicationChannel) => {
    try {
      setIsSubmitting(true);
      await api('POST', '/api/communication/log', {
        patientId,
        channel,
        messageType,
        recipientPhone: cleanedPhone || phone,
        summary: `${messageType.replace('_', ' ')} via ${channel}`,
      });
    } catch {
      // Continue even if logging fails so communication is never blocked
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhatsApp = async () => {
    if (!isValidPhone) return;
    await logAction('whatsapp');
    const url = buildWhatsAppUrl(cleanedPhone, messageText);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSms = async () => {
    if (!isValidPhone) return;
    await logAction('sms');
    const url = buildSmsUrl(cleanedPhone, messageText);
    window.location.href = url;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      await logAction('clipboard');
    } catch {
      // Fallback or ignore
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Patient Communication Helper"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
    >
      <div
        className="card stack"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          overflowY: 'auto',
          backgroundColor: 'var(--surface)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          borderRadius: '8px',
        }}
      >
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>💬</span> Send Patient Message
            </h2>
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              Patient: <strong>{patientName}</strong> · Quick WhatsApp &amp; SMS Dispatch
            </div>
          </div>
          <button type="button" className="btn small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Message type picker */}
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
            Message Type:
          </label>
          <div className="row wrap" style={{ gap: '0.4rem' }}>
            <button
              type="button"
              className={`btn small ${messageType === 'appointment_reminder' ? 'primary' : ''}`}
              onClick={() => setMessageType('appointment_reminder')}
            >
              📅 Appointment
            </button>
            <button
              type="button"
              className={`btn small ${messageType === 'antenatal_recall' ? 'primary' : ''}`}
              onClick={() => setMessageType('antenatal_recall')}
            >
              🤰 Antenatal ANC
            </button>
            <button
              type="button"
              className={`btn small ${messageType === 'prescription' ? 'primary' : ''}`}
              onClick={() => setMessageType('prescription')}
            >
              💊 Prescription
            </button>
            <button
              type="button"
              className={`btn small ${messageType === 'vaccination' ? 'primary' : ''}`}
              onClick={() => setMessageType('vaccination')}
            >
              💉 Vaccination
            </button>
            <button
              type="button"
              className={`btn small ${messageType === 'custom' ? 'primary' : ''}`}
              onClick={() => setMessageType('custom')}
            >
              ✍️ Custom
            </button>
          </div>
        </div>

        {/* Recipient phone */}
        <div>
          <label htmlFor="comm-phone" style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
            Recipient Phone Number:
          </label>
          <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
            <input
              id="comm-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210 or +91 98765 43210"
              style={{ flex: 1, padding: '0.5rem', fontFamily: 'monospace' }}
            />
            {isValidPhone && (
              <span className="muted" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                Cleaned: <code>+{cleanedPhone}</code>
              </span>
            )}
          </div>
          {!isValidPhone && (
            <div style={{ color: 'var(--danger, #dc2626)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              ⚠️ Please enter a valid phone number (at least 10 digits).
            </div>
          )}
        </div>

        {/* Message preview / editable text */}
        <div>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <label htmlFor="comm-text" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Message Content (review &amp; edit before sending):
            </label>
            <span className="muted" style={{ fontSize: '0.75rem' }}>
              {messageText.length} characters · Supports WhatsApp <code>*bold*</code> &amp; <code>_italic_</code>
            </span>
          </div>
          <textarea
            id="comm-text"
            rows={10}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem',
              fontFamily: 'inherit',
              fontSize: '0.9rem',
              lineHeight: 1.45,
              borderRadius: '4px',
              border: '1px solid var(--border)',
            }}
          />
        </div>

        {/* Action dispatch buttons */}
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
          <div className="row wrap" style={{ gap: '0.5rem' }}>
            <button
              type="button"
              className="btn"
              onClick={() => void handleWhatsApp()}
              disabled={!isValidPhone || isSubmitting}
              style={{
                backgroundColor: isValidPhone ? '#25D366' : undefined,
                color: isValidPhone ? '#fff' : undefined,
                borderColor: isValidPhone ? '#25D366' : undefined,
                fontWeight: 600,
              }}
              title={isValidPhone ? 'Open WhatsApp with prefilled message' : 'Enter a valid phone number first'}
            >
              🟢 Open in WhatsApp
            </button>

            <button
              type="button"
              className="btn"
              onClick={() => void handleSms()}
              disabled={!isValidPhone || isSubmitting}
              title={isValidPhone ? 'Open SMS app with prefilled message' : 'Enter a valid phone number first'}
            >
              💬 Send via SMS
            </button>

            <button
              type="button"
              className="btn"
              onClick={() => void handleCopy()}
              disabled={isSubmitting}
              title="Copy formatted message to clipboard"
            >
              {copied ? '✅ Copied to clipboard!' : '📋 Copy Text'}
            </button>
          </div>

          <button type="button" className="btn muted" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
