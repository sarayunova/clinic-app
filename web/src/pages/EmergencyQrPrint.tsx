import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  type Patient,
  type EmergencyPassportBundle,
  getEmergencyPassportData,
  auditEmergencyQrCardPrint,
} from '../api';
import { useClinic } from '../components/Sheet';
import { generateQrSvg } from '../qrSvg';
import { ErrorBanner } from '../components/ui';

export function EmergencyQrPrint() {
  const { patientId } = useParams();
  const pId = Number(patientId);

  const { clinic, error: clinicError } = useClinic();
  const [bundle, setBundle] = useState<EmergencyPassportBundle | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!pId) return;

    getEmergencyPassportData(pId)
      .then((data) => setBundle(data))
      .catch(setError);
  }, [pId]);

  const handlePrint = async () => {
    try {
      await auditEmergencyQrCardPrint(pId);
    } catch {
      // non-blocking
    }
    window.print();
  };

  if (clinicError || error) {
    return (
      <div className="page narrow stack">
        <ErrorBanner error={clinicError || error} />
        <p>
          <Link to={`/patients/${pId}`} className="btn small">
            ← Back to Patient
          </Link>
        </p>
      </div>
    );
  }

  if (!clinic || !bundle) {
    return (
      <div className="page narrow stack">
        <p className="muted">Generating Wallet Emergency Card…</p>
      </div>
    );
  }

  const p = bundle.passportData;
  const qrSvgXml = generateQrSvg(bundle.qrPayload, 140);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      {/* Screen action bar */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '10px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Link
          to={`/patients/${pId}`}
          style={{ textDecoration: 'none', color: '#2563eb', fontWeight: 600, fontSize: '14px' }}
        >
          ← Back to Patient Profile
        </Link>
        <button
          onClick={handlePrint}
          style={{
            background: '#dc2626',
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          🖨️ Print Wallet Card
        </button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>
          PATIENT EMERGENCY MEDICAL PASSPORT (WALLET CARD)
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
          Cut along the solid border and fold along the dotted line for a standard wallet / ID card size.
        </p>
      </div>

      {/* Printable 2-Side Wallet Card */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '30px',
        }}
      >
        {/* FRONT SIDE (CR80: ~85.6mm x 54mm) */}
        <div
          style={{
            width: '320px',
            minHeight: '200px',
            border: '2px solid #b91c1c',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Header */}
          <div
            style={{
              background: '#b91c1c',
              color: '#ffffff',
              padding: '8px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '1px' }}>
                EMERGENCY MEDICAL CARD
              </div>
              <div style={{ fontSize: '8px', opacity: 0.9 }}>{clinic.clinicName}</div>
            </div>
            <div
              style={{
                fontSize: '9px',
                background: '#ffffff',
                color: '#b91c1c',
                padding: '2px 6px',
                borderRadius: '10px',
                fontWeight: 800,
              }}
            >
              ID #{p.patientId}
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '10px 12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>
                {p.fullName}
              </div>
              <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                Age: {p.ageYears ? `${p.ageYears} Y` : 'N/A'}
              </div>

              {/* Critical Blood Group */}
              <div style={{ marginTop: '8px' }}>
                <span
                  style={{
                    background: '#fee2e2',
                    color: '#991b1b',
                    border: '1px solid #f87171',
                    fontSize: '10px',
                    fontWeight: 900,
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  Blood Group: {p.bloodGroup || 'UNKNOWN'}
                </span>
              </div>

              {/* Allergies */}
              <div style={{ marginTop: '6px', fontSize: '9px', color: '#b91c1c', fontWeight: 700 }}>
                Allergies: {p.allergies || 'None known'}
              </div>
            </div>

            {/* QR Code */}
            <div
              style={{
                width: '90px',
                height: '90px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              dangerouslySetInnerHTML={{ __html: qrSvgXml }}
            />
          </div>

          {/* Footer */}
          <div
            style={{
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              padding: '4px 12px',
              fontSize: '8px',
              color: '#475569',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Scan QR for records</span>
            <span>Helpline: {clinic.phone}</span>
          </div>
        </div>

        {/* BACK SIDE (CR80: ~85.6mm x 54mm) */}
        <div
          style={{
            width: '320px',
            minHeight: '200px',
            border: '2px solid #b91c1c',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Header */}
          <div
            style={{
              background: '#1e293b',
              color: '#ffffff',
              padding: '8px 12px',
              fontSize: '9px',
              fontWeight: 800,
              letterSpacing: '0.5px',
            }}
          >
            CLINICAL ALERTS &amp; EMERGENCY CONTACTS
          </div>

          {/* Details */}
          <div style={{ padding: '10px 12px', fontSize: '9px', color: '#1e293b', lineHeight: 1.4 }}>
            {p.obstetricSummary && (
              <div style={{ marginBottom: '6px' }}>
                <strong style={{ color: '#7e22ce' }}>Obstetric Summary:</strong> {p.obstetricSummary}
              </div>
            )}

            {p.highRiskConditions && p.highRiskConditions.length > 0 && (
              <div style={{ marginBottom: '6px', color: '#b91c1c', fontWeight: 700 }}>
                🚨 High-Risk: {p.highRiskConditions.join(', ')}
              </div>
            )}

            <div style={{ marginTop: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
              <strong>Emergency Contact:</strong> {p.emergencyContact || 'Not recorded'}
            </div>

            <div style={{ marginTop: '4px' }}>
              <strong>Hospital 24/7 Helpline:</strong> {clinic.phone}
            </div>

            <div style={{ marginTop: '4px', color: '#64748b' }}>
              <strong>Hospital Address:</strong> {clinic.address}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              padding: '4px 12px',
              fontSize: '8px',
              color: '#94a3b8',
              textAlign: 'center',
            }}
          >
            In case of emergency, present this card or scan QR on any smartphone camera
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: #fff; }
        }
      `}</style>
    </div>
  );
}
