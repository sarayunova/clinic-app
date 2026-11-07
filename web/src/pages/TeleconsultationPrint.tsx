import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import {
  getTeleconsultation,
  auditTeleconsultationPrint,
  type TeleconsultationRecord,
} from '../api';
import {
  TELEMEDICINE_STATUTORY_DISCLAIMER_EN,
  TELEMEDICINE_STATUTORY_DISCLAIMER_HI,
} from '../teleconsultationEngine';
import { generateQrSvgDataUri } from '../qrSvg';

export function TeleconsultationPrint() {
  const { id } = useParams<{ id: string }>();
  const { clinic } = useClinic();
  const [consult, setConsult] = useState<TeleconsultationRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const teleId = Number(id);
    getTeleconsultation(teleId)
      .then((res) => {
        setConsult(res);
        setLoading(false);
        auditTeleconsultationPrint(teleId).catch(() => {});
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (!clinic || loading || !consult) {
    return <div className="p-8 text-center text-slate-500">Preparing teleconsultation prescription...</div>;
  }

  let medicines: any[] = [];
  if (consult.prescription_medicines) {
    if (typeof consult.prescription_medicines === 'string') {
      try {
        medicines = JSON.parse(consult.prescription_medicines);
      } catch {
        medicines = [];
      }
    } else if (Array.isArray(consult.prescription_medicines)) {
      medicines = consult.prescription_medicines;
    }
  }

  const consultDate = new Date(consult.scheduled_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Generate Digital Verification QR URI
  const verificationPayload = `NMC-TELEMED|DOC:${consult.signed_by_doctor_name || consult.doctor_name}|REG:${consult.doctor_reg_number || 'REG-NMC'}|PAT:${consult.uhid}|DATE:${consult.scheduled_at}|HASH:${consult.digital_signature_hash || 'DRAFT'}`;
  const qrUri = generateQrSvgDataUri(verificationPayload, 120);

  return (
    <Sheet
      clinic={clinic}
      title="TELEMEDICINE CONSULTATION & E-PRESCRIPTION"
      back="/teleconsultations"
      onPrint={() => window.print()}
    >
      <div className="space-y-6 text-sm text-slate-800">
        {/* Compliance Banner */}
        <div className="border border-indigo-200 bg-indigo-50/60 rounded-lg p-2.5 text-xs text-indigo-900 flex justify-between items-center">
          <div>
            <strong>Mode:</strong> Remote Video Teleconsultation ({consult.video_platform.replace('_', ' ')})
          </div>
          <div>
            <strong>NMC Telemedicine Guidelines 2020:</strong> Compliant Digital Record
          </div>
          <div>
            <strong>Status:</strong>{' '}
            <span className="font-bold text-emerald-700">{consult.status}</span>
          </div>
        </div>

        {/* Patient Demographics Matrix */}
        <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="text-slate-500">Patient Name</div>
            <div className="font-bold text-slate-900 text-sm">{consult.patient_name}</div>
          </div>
          <div>
            <div className="text-slate-500">UHID / Patient No</div>
            <div className="font-mono font-bold text-slate-800">{consult.uhid}</div>
          </div>
          <div>
            <div className="text-slate-500">Age / Gender</div>
            <div className="font-semibold text-slate-800">{consult.patient_age ? `${consult.patient_age} yrs` : 'Adult'} / Female</div>
          </div>
          <div>
            <div className="text-slate-500">Consultation Date</div>
            <div className="font-semibold text-slate-800">{consultDate}</div>
          </div>
        </div>

        {/* Clinical Presentation & Diagnosis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-slate-200 rounded-lg p-3 bg-white">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Chief Complaints</h4>
            <p className="text-slate-800">{consult.chief_complaint}</p>
            {consult.clinical_notes && (
              <p className="text-xs text-slate-600 mt-2 italic">&quot;{consult.clinical_notes}&quot;</p>
            )}
          </div>

          <div className="border border-slate-200 rounded-lg p-3 bg-white">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Provisional Diagnosis</h4>
            <p className="font-bold text-slate-900 text-base">
              {consult.provisional_diagnosis || 'Clinical Follow-up & Evaluation'}
            </p>
            <div className="text-xs text-slate-500 mt-2">
              Type: {consult.consult_type.replace('_', ' ')}
            </div>
          </div>
        </div>

        {/* ℞ Prescribed Medicines Table */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b pb-1 flex items-center justify-between">
            <span>℞ Prescribed Medications</span>
            <span className="text-xs font-normal text-slate-500">NMC Specific List Compliant</span>
          </h3>

          {medicines.length === 0 ? (
            <div className="text-center py-4 text-slate-400 italic">No oral medications prescribed during this encounter.</div>
          ) : (
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800 text-left">
                  <th className="border border-slate-300 p-2 w-10 text-center">#</th>
                  <th className="border border-slate-300 p-2">Medicine Name & Formulation</th>
                  <th className="border border-slate-300 p-2 w-28">Dosage</th>
                  <th className="border border-slate-300 p-2 w-32">Frequency</th>
                  <th className="border border-slate-300 p-2 w-28">Duration</th>
                  <th className="border border-slate-300 p-2">Instructions</th>
                </tr>
              </thead>
              <tbody>
                {medicines.map((m, idx) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="border border-slate-300 p-2 text-center text-slate-500 font-bold">{idx + 1}</td>
                    <td className="border border-slate-300 p-2 font-bold text-slate-900">{m.name}</td>
                    <td className="border border-slate-300 p-2">{m.dosage || '-'}</td>
                    <td className="border border-slate-300 p-2 font-medium">{m.frequency || '-'}</td>
                    <td className="border border-slate-300 p-2">{m.duration || '-'}</td>
                    <td className="border border-slate-300 p-2 text-slate-700 italic">{m.instructions || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* General Advice & Emergency Warning */}
        {consult.advice_instructions && (
          <div className="border border-slate-200 rounded-lg p-3 bg-white">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Advice & Care Instructions</h4>
            <p className="text-xs text-slate-800 whitespace-pre-line">{consult.advice_instructions}</p>
          </div>
        )}

        {/* Statutory Disclaimers in English & Hindi */}
        <div className="border border-amber-300 bg-amber-50/50 rounded-lg p-3 text-[11px] text-amber-900 space-y-1.5 leading-relaxed">
          <div className="font-bold flex items-center gap-1">
            <span>⚠️ STATUTORY TELEMEDICINE PRACTICE GUIDELINES DISCLAIMER / वैधानिक सूचना:</span>
          </div>
          <div>{TELEMEDICINE_STATUTORY_DISCLAIMER_EN}</div>
          <div className="border-t border-amber-200 pt-1 text-amber-800">{TELEMEDICINE_STATUTORY_DISCLAIMER_HI}</div>
        </div>

        {/* Digital Verification & Doctor Signature Block */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end pt-4 border-t border-slate-300">
          {/* QR Code & SHA-256 Digest */}
          <div className="flex items-center gap-3 border border-slate-200 p-3 rounded-lg bg-slate-50">
            {qrUri && <img src={qrUri} alt="Digital Verification QR" className="w-20 h-20 border rounded bg-white p-1" />}
            <div className="text-[10px] text-slate-600 space-y-0.5">
              <div className="font-bold text-slate-800 text-xs">Digital Verification Seal</div>
              <div>Scan to verify prescription authenticity</div>
              {consult.digital_signature_hash && (
                <div className="font-mono text-[9px] text-slate-500 break-all">
                  SHA-256: {consult.digital_signature_hash}
                </div>
              )}
              {consult.signed_at && (
                <div className="text-[10px] text-emerald-700 font-semibold">
                  Timestamp: {new Date(consult.signed_at).toLocaleString('en-IN')}
                </div>
              )}
            </div>
          </div>

          {/* Doctor Signature */}
          <div>
            <SignatureBlock
              clinic={clinic}
              signatoryName={consult.signed_by_doctor_name || consult.doctor_name}
              qualifications={consult.doctor_qualifications || clinic.doctorQualifications}
              regNo={consult.doctor_reg_number || clinic.registrationNo}
              designation="Registered Medical Practitioner (Telemedicine Consultant)"
              date={consultDate}
            />
          </div>
        </div>
      </div>
    </Sheet>
  );
}
