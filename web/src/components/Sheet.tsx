import React, { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, type ClinicSettings } from '../api';

export function useClinic() {
  const [clinic, setClinic] = useState<ClinicSettings | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api<ClinicSettings>('GET', '/api/settings').then(setClinic, setError);
  }, []);
  return { clinic, error };
}

const stamp = () =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());

/**
 * A printable page: customizable clinic letterhead, pre-printed stationery spacer, title, body, and signature.
 * Controls marked no-print are hidden on paper.
 */
export function Sheet({
  clinic,
  title,
  back,
  onPrint,
  controls,
  children,
}: {
  clinic: ClinicSettings;
  title: string;
  back: string;
  onPrint?: () => void;
  controls?: ReactNode;
  children: ReactNode;
}) {
  const [usePreprinted, setUsePreprinted] = useState(clinic.preprintedStationery === '1');
  const [hideLogo, setHideLogo] = useState(clinic.showLogoOnPrint === '0');

  const marginMm = Math.max(10, Math.min(150, Number(clinic.topMarginMm) || 40));
  const layout = clinic.headerLayout || 'centered';

  const doctorMeta = [
    clinic.doctorName,
    clinic.doctorQualifications,
    clinic.registrationNo && `Reg. No: ${clinic.registrationNo}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const contactMeta = [
    clinic.address,
    clinic.phone && `Phone: ${clinic.phone}`,
    clinic.email && `Email: ${clinic.email}`,
    clinic.website && `Web: ${clinic.website}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="page narrow">
      {/* Top action toolbar (Screen only) */}
      <div className="row no-print" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <Link to={back}>← Back</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.84rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={usePreprinted}
              onChange={(e) => setUsePreprinted(e.target.checked)}
            />
            <span>Pre-printed stationery ({marginMm}mm offset)</span>
          </label>
          <button
            className="btn primary"
            onClick={() => {
              onPrint?.();
              window.print();
            }}
          >
            🖨️ Print
          </button>
        </div>
      </div>

      {controls && <div className="no-print" style={{ marginBottom: '0.75rem' }}>{controls}</div>}

      <article className="sheet">
        {/* Pre-printed stationery mode */}
        {usePreprinted ? (
          <>
            <div
              className="sheet-preprinted-spacer"
              style={{ height: `${marginMm}mm` }}
            />
            <div
              className="banner info no-print"
              style={{
                marginBottom: '1rem',
                borderStyle: 'dashed',
                fontSize: '0.82rem',
                textAlign: 'center',
                padding: '0.5rem',
              }}
            >
              📄 Pre-printed stationery paper active: {marginMm}mm blank header space reserved for physical letterhead.
            </div>
          </>
        ) : (
          /* Computerized letterhead */
          <header className="sheet-head">
            {layout === 'split' ? (
              /* Split Layout: Clinic on Left, Doctor & Contact on Right */
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  textAlign: 'left',
                }}
              >
                <div style={{ flex: 1 }}>
                  {!hideLogo && clinic.logoDataUrl && (
                    <img
                      src={clinic.logoDataUrl}
                      alt="Clinic Logo"
                      style={{ maxHeight: '55px', maxWidth: '200px', objectFit: 'contain', display: 'block', marginBottom: '0.3rem' }}
                    />
                  )}
                  <h1 style={{ fontSize: '1.45rem', margin: 0, lineHeight: 1.2 }}>{clinic.clinicName || 'Clinic name not set'}</h1>
                  {clinic.clinicTagline && (
                    <div style={{ fontStyle: 'italic', fontSize: '0.86rem', color: '#475569', marginTop: '0.15rem' }}>
                      {clinic.clinicTagline}
                    </div>
                  )}
                  {clinic.address && (
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem', whiteSpace: 'pre-line' }}>
                      {clinic.address}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', minWidth: '220px' }}>
                  {clinic.doctorName && <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{clinic.doctorName}</div>}
                  {clinic.doctorQualifications && (
                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.1rem' }}>{clinic.doctorQualifications}</div>
                  )}
                  {clinic.registrationNo && (
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.1rem' }}>Reg. No: {clinic.registrationNo}</div>
                  )}
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem', lineHeight: 1.35 }}>
                    {clinic.phone && <div>Tel: {clinic.phone}</div>}
                    {clinic.email && <div>{clinic.email}</div>}
                    {clinic.website && <div>{clinic.website}</div>}
                  </div>
                </div>
              </div>
            ) : layout === 'modern' ? (
              /* Modern Contemporary Layout with Accent Divider */
              <div>
                <div
                  style={{
                    height: '4px',
                    backgroundColor: '#0f172a',
                    borderRadius: '2px',
                    marginBottom: '0.75rem',
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    {!hideLogo && clinic.logoDataUrl && (
                      <img
                        src={clinic.logoDataUrl}
                        alt="Clinic Logo"
                        style={{ maxHeight: '60px', maxWidth: '160px', objectFit: 'contain' }}
                      />
                    )}
                    <div>
                      <h1 style={{ fontSize: '1.45rem', margin: 0, lineHeight: 1.2 }}>{clinic.clinicName || 'Clinic name not set'}</h1>
                      {clinic.clinicTagline && (
                        <div style={{ fontStyle: 'italic', fontSize: '0.85rem', color: '#475569', marginTop: '0.15rem' }}>
                          {clinic.clinicTagline}
                        </div>
                      )}
                      {clinic.address && (
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>{clinic.address}</div>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: 'right',
                      borderLeft: '2px solid #e2e8f0',
                      paddingLeft: '0.85rem',
                      minWidth: '200px',
                    }}
                  >
                    {clinic.doctorName && <div style={{ fontWeight: 700, fontSize: '0.96rem' }}>{clinic.doctorName}</div>}
                    {clinic.doctorQualifications && (
                      <div style={{ fontSize: '0.78rem', color: '#475569' }}>{clinic.doctorQualifications}</div>
                    )}
                    {clinic.registrationNo && (
                      <div style={{ fontSize: '0.76rem', color: '#64748b' }}>Reg: {clinic.registrationNo}</div>
                    )}
                    {clinic.phone && <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.2rem' }}>📞 {clinic.phone}</div>}
                  </div>
                </div>
              </div>
            ) : (
              /* Classic Centered Layout (Default) */
              <div style={{ textAlign: 'center' }}>
                {!hideLogo && clinic.logoDataUrl && (
                  <div style={{ textAlign: 'center', marginBottom: '0.4rem' }}>
                    <img
                      src={clinic.logoDataUrl}
                      alt="Clinic Logo"
                      style={{ maxHeight: '65px', maxWidth: '240px', objectFit: 'contain', display: 'inline-block' }}
                    />
                  </div>
                )}
                <h1 style={{ margin: 0, fontSize: '1.5rem', lineHeight: 1.25 }}>{clinic.clinicName || 'Clinic name not set'}</h1>
                {clinic.clinicTagline && (
                  <div style={{ fontStyle: 'italic', fontSize: '0.88rem', color: '#475569', marginTop: '0.15rem' }}>
                    {clinic.clinicTagline}
                  </div>
                )}
                {doctorMeta && (
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b', marginTop: '0.25rem' }}>
                    {doctorMeta}
                  </div>
                )}
                {contactMeta && (
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                    {contactMeta}
                  </div>
                )}
              </div>
            )}

            {!clinic.clinicName && (
              <div className="banner warn no-print" style={{ marginTop: '0.75rem' }}>
                The doctor can customize clinic branding, logo, letterhead header and digital signature under “Clinic” in the menu.
              </div>
            )}
          </header>
        )}

        {/* Sheet Title */}
        <h2 className="sheet-title">{title}</h2>

        {/* Document Body */}
        {children}

        {/* Document Footer */}
        <footer className="sheet-foot small">
          {clinic.footerText && (
            <div
              className="sheet-footer-custom"
              style={{
                marginBottom: '0.45rem',
                fontStyle: 'italic',
                color: '#475569',
                fontSize: '0.78rem',
                lineHeight: 1.35,
              }}
            >
              {clinic.footerText}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Printed {stamp()}</span>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Electronic Health Record · Confidential Medical Document
            </span>
          </div>
        </footer>
      </article>
    </div>
  );
}
