import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  type Patient,
  type EmergencyPassportBundle,
  getEmergencyPassportData,
  auditEmergencyQrCardPrint,
} from '../api';
import { generateQrSvg } from '../qrSvg';

interface Props {
  patient: Patient;
}

export function EmergencyQrCard({ patient }: Props) {
  const [bundle, setBundle] = useState<EmergencyPassportBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadPassport() {
      try {
        setLoading(true);
        setError(null);
        const data = await getEmergencyPassportData(patient.id);
        setBundle(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load emergency passport data');
      } finally {
        setLoading(false);
      }
    }
    loadPassport();
  }, [patient.id]);

  const handleCopyPayload = () => {
    if (!bundle) return;
    navigator.clipboard.writeText(bundle.qrPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleAuditPrint = async () => {
    try {
      await auditEmergencyQrCardPrint(patient.id);
    } catch (err) {
      console.error('Audit print failed:', err);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Generating digital emergency passport...</div>;
  }

  if (error || !bundle) {
    return (
      <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
        {error || 'Unable to generate emergency card'}
      </div>
    );
  }

  const p = bundle.passportData;
  const qrSvgXml = generateQrSvg(bundle.qrPayload, 160);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-700 via-rose-700 to-pink-800 text-white p-6 rounded-xl shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚨</span>
              <h2 className="text-2xl font-bold tracking-tight">
                Digital Emergency Medical Passport &amp; QR Card
              </h2>
            </div>
            <p className="text-red-100 mt-1 max-w-2xl text-sm leading-relaxed">
              Standardized wallet-sized physical &amp; digital emergency card. Encodes patient
              identification, critical blood group, drug allergies, high-risk obstetric status,
              and 24/7 hospital helpline in an offline-scannable QR matrix.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyPayload}
              className="px-3.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors"
            >
              {copied ? 'Copied QR Payload!' : 'Copy Raw JSON'}
            </button>

            <Link
              to={`/patients/${patient.id}/emergency-card/print`}
              onClick={handleAuditPrint}
              target="_blank"
              className="px-4 py-2 text-xs font-bold bg-white text-red-900 rounded-lg shadow hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <span>🖨️</span>
              <span>Print Wallet Card (CR80)</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Wallet Card Visual Preview */}
      <div className="flex justify-center py-4">
        <div className="w-full max-w-xl bg-white border-2 border-red-500 rounded-2xl shadow-xl overflow-hidden text-gray-900 relative">
          {/* Card Top Strip */}
          <div className="bg-gradient-to-r from-red-600 to-rose-700 px-6 py-3 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-lg">🚑</span>
              <div>
                <div className="text-xs font-black tracking-widest uppercase">
                  EMERGENCY MEDICAL PASSPORT
                </div>
                <div className="text-[10px] text-red-100 font-medium">{p.hospitalName}</div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] bg-white text-red-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                ID: #{patient.patientNumber}
              </span>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
            {/* Left 2 Cols: Clinical Details */}
            <div className="sm:col-span-2 space-y-3">
              <div>
                <h3 className="text-xl font-black text-gray-950 tracking-tight leading-none">
                  {p.fullName}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Age: <strong>{p.ageYears ? `${p.ageYears} Years` : 'Recorded'}</strong> • Patient ID: #{p.patientId}
                </p>
              </div>

              {/* Critical Alert Badges */}
              <div className="flex flex-wrap gap-2">
                <div className="bg-red-100 border border-red-300 text-red-900 font-black px-2.5 py-1 rounded text-xs flex items-center gap-1">
                  <span>🩸</span>
                  <span>Blood Group: {p.bloodGroup || 'UNKNOWN'}</span>
                </div>

                <div
                  className={`border font-semibold px-2.5 py-1 rounded text-xs flex items-center gap-1 ${
                    p.allergies && p.allergies !== 'None' && p.allergies !== 'Unknown'
                      ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                      : 'bg-gray-100 border-gray-200 text-gray-700'
                  }`}
                >
                  <span>⚠️</span>
                  <span>Allergies: {p.allergies || 'None known'}</span>
                </div>
              </div>

              {/* Obstetric or High-Risk Notes */}
              {p.obstetricSummary && (
                <div className="bg-purple-50 border border-purple-200 rounded p-2 text-xs text-purple-900 font-medium">
                  🤰 <strong>Pregnancy:</strong> {p.obstetricSummary}
                  {p.edd ? ` (EDD: ${p.edd})` : ''}
                </div>
              )}

              {p.highRiskConditions && p.highRiskConditions.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-900 font-medium">
                  🚨 <strong>High-Risk Alert:</strong> {p.highRiskConditions.join(', ')}
                </div>
              )}

              {/* Emergency Contact */}
              <div className="text-xs text-gray-700 pt-1 border-t border-gray-100 space-y-0.5">
                <div>
                  <strong>Emergency Contact:</strong> {p.emergencyContact || 'Not recorded'}
                </div>
                <div>
                  <strong>Hospital 24/7 Helpline:</strong> {p.hospitalHelpline}
                </div>
              </div>
            </div>

            {/* Right Col: Pure SVG Scannable QR */}
            <div className="flex flex-col items-center justify-center p-2 bg-gray-50 rounded-xl border border-gray-200">
              <div
                className="w-36 h-36 flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: qrSvgXml }}
              />
              <span className="text-[10px] text-gray-500 font-mono mt-1 uppercase tracking-wider font-semibold text-center">
                Scan for Medical Records
              </span>
            </div>
          </div>

          {/* Bottom Card Footer */}
          <div className="bg-gray-100 px-6 py-2 border-t border-gray-200 flex justify-between items-center text-[10px] text-gray-500 font-medium">
            <span>LiVi Health Emergency Network</span>
            <span>Carry this card in your wallet or keep saved on phone</span>
          </div>
        </div>
      </div>
    </div>
  );
}
