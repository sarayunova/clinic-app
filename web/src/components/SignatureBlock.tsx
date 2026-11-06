import React from 'react';
import type { ClinicSettings } from '../api';

export interface SignatureBlockProps {
  clinic: ClinicSettings;
  signatoryName?: string | null;
  qualifications?: string | null;
  regNo?: string | null;
  designation?: string | null;
  subtext?: string | null;
  date?: string | null;
  showStamp?: boolean;
  hideSignatureImage?: boolean;
  style?: React.CSSProperties;
  alignment?: 'right' | 'left' | 'center';
}

/**
 * Reusable official digital signature and certification stamp block.
 * Renders digital signature image (if uploaded and enabled), signature line,
 * doctor name, qualifications, council registration, and verification stamp.
 */
export function SignatureBlock({
  clinic,
  signatoryName,
  qualifications,
  regNo,
  designation,
  subtext,
  date,
  showStamp = true,
  hideSignatureImage = false,
  style,
  alignment = 'right',
}: SignatureBlockProps) {
  const name = signatoryName || clinic.doctorName || 'Attending Physician';
  const qual = qualifications || clinic.doctorQualifications;
  const reg = regNo || clinic.registrationNo;
  const showSignature = !hideSignatureImage && clinic.showSignatureOnPrint !== '0' && Boolean(clinic.signatureDataUrl);
  const stampText = clinic.stampText?.trim();

  const alignStyles: React.CSSProperties =
    alignment === 'right'
      ? { marginLeft: 'auto', textAlign: 'center', width: '16.5rem' }
      : alignment === 'left'
      ? { marginRight: 'auto', textAlign: 'center', width: '16.5rem' }
      : { margin: '0 auto', textAlign: 'center', width: '16.5rem' };

  return (
    <div
      className="signature-block"
      style={{
        marginTop: '2.5rem',
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
        ...alignStyles,
        ...style,
      }}
    >
      {/* Digital Signature Image */}
      {showSignature && clinic.signatureDataUrl ? (
        <div style={{ minHeight: '44px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '-0.35rem' }}>
          <img
            src={clinic.signatureDataUrl}
            alt="Doctor Digital Signature"
            style={{
              maxHeight: '52px',
              maxWidth: '175px',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
      ) : (
        <div style={{ height: '32px' }} />
      )}

      {/* Signature Underline */}
      <div
        style={{
          borderTop: '1px solid #0f172a',
          margin: '0.2rem 0 0.35rem 0',
        }}
      />

      {/* Doctor Name & Designation */}
      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', lineHeight: 1.25 }}>
        {name}
      </div>

      {qual && (
        <div className="muted small" style={{ fontSize: '0.76rem', marginTop: '0.1rem', lineHeight: 1.25 }}>
          {qual}
        </div>
      )}

      {designation && (
        <div className="muted small" style={{ fontSize: '0.74rem', marginTop: '0.1rem' }}>
          {designation}
        </div>
      )}

      {reg && (
        <div className="muted small" style={{ fontSize: '0.74rem', marginTop: '0.1rem' }}>
          Reg. No: {reg}
        </div>
      )}

      {date && (
        <div className="muted small" style={{ fontSize: '0.72rem', marginTop: '0.1rem' }}>
          Date: {date}
        </div>
      )}

      {subtext && (
        <div className="muted small" style={{ fontSize: '0.72rem', fontStyle: 'italic', marginTop: '0.15rem' }}>
          {subtext}
        </div>
      )}

      {/* Official Clinic Verification Seal / Digital Stamp */}
      {showStamp && (stampText || (showSignature && clinic.signatureDataUrl)) && (
        <div
          style={{
            marginTop: '0.4rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            border: '1.5px solid #2563eb',
            borderRadius: '4px',
            padding: '0.15rem 0.5rem',
            fontSize: '0.68rem',
            fontWeight: 700,
            color: '#1d4ed8',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            backgroundColor: '#eff6ff',
          }}
        >
          <span>🛡️</span>
          <span>{stampText || 'Verified & Digitally Signed'}</span>
        </div>
      )}
    </div>
  );
}
