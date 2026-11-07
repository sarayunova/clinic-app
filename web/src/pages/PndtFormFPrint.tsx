import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type ClinicSettings, type PndtFormFRecord } from '../api';
import { PNDT_STATUTORY_INDICATIONS, formatLivingChildrenSummary } from '../pndtEngine';

export function PndtFormFPrint() {
  const { patientId, id } = useParams<{ patientId: string; id: string }>();
  const [form, setForm] = useState<PndtFormFRecord | null>(null);
  const [clinic, setClinic] = useState<ClinicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [formRes, clinicRes] = await Promise.all([
          api<PndtFormFRecord>('GET', `/api/pndt/forms/${id}`),
          api<ClinicSettings>('GET', '/api/settings'),
        ]);
        setForm(formRes);
        setClinic(clinicRes);

        // Audit print event
        await api('POST', `/api/pndt/forms/${id}/audit-print`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Form F data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading statutory PC-PNDT Form &lsquo;F&rsquo;…</div>;
  }

  if (error || !form) {
    return (
      <div style={{ padding: '2rem', maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
        <h3 style={{ color: '#dc2626' }}>Error Loading Document</h3>
        <p>{error || 'Form F record not found.'}</p>
        <Link to={`/patients/${patientId}`} style={{ color: '#0284c7' }}>Return to Patient Record</Link>
      </div>
    );
  }

  const livingChildrenText = formatLivingChildrenSummary(
    form.numLivingMaleChildren,
    form.numLivingFemaleChildren,
    form.maleChildrenAges,
    form.femaleChildrenAges,
  );

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '1.5rem 0' }}>
      {/* Print Control Bar (Hidden on print) */}
      <div
        className="no-print"
        style={{
          maxWidth: '820px',
          margin: '0 auto 1.25rem auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1.25rem',
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #cbd5e1',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            to={`/patients/${patientId}`}
            style={{
              color: '#475569',
              textDecoration: 'none',
              fontSize: '0.88rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            ← Back to Patient Record
          </Link>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <span style={{ fontSize: '0.85rem', color: '#0f766e', fontWeight: 700 }}>
            {form.formFNumber}
          </span>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          style={{
            background: '#0f4c81',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '0.5rem 1.2rem',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span>🖨️</span> Print Statutory Form &lsquo;F&rsquo;
        </button>
      </div>

      {/* Statutory Printable Document Sheet */}
      <div
        style={{
          maxWidth: '820px',
          margin: '0 auto',
          background: '#ffffff',
          padding: '2.5rem 3rem',
          border: '1px solid #94a3b8',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          fontFamily: 'serif',
          color: '#000000',
          lineHeight: 1.35,
          fontSize: '11pt',
        }}
      >
        {/* Statutory Legal Header */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '15pt', fontWeight: 'bold', letterSpacing: '1px' }}>FORM F</div>
          <div style={{ fontSize: '9pt', fontStyle: 'italic', margin: '0.2rem 0' }}>
            [See Proviso to Section 4(3), Rule 9(5) and Rule 10(1A)]
          </div>
          <div style={{ fontSize: '10.5pt', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '0.3rem' }}>
            Form for Maintenance of Record in Case of Prenatal Diagnostic Test / Procedure by Genetic Clinic / Ultrasound Clinic / Imaging Centre
          </div>
        </div>

        {/* Center & Identification Box */}
        <div style={{ border: '1px solid #000', padding: '0.6rem 0.8rem', marginBottom: '1rem', fontSize: '10pt' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            <div>
              <strong>Name of Center / Clinic:</strong> {clinic?.clinicName || 'Clinic'}
            </div>
            <div>
              <strong>PC-PNDT Reg. No:</strong> {form.clinicPndtRegNo || clinic?.pndtRegistrationNo || 'MH/PNDT/2021/045'}
            </div>
            <div>
              <strong>Clinic Address:</strong> {clinic?.address || 'Local Clinic Address'}
            </div>
            <div>
              <strong>Form F Serial No:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{form.formFNumber}</span>
            </div>
            <div>
              <strong>Ultrasound Machine Make &amp; S/N:</strong> {form.machineModelSerial}
            </div>
            <div>
              <strong>Date of Scan / Examination:</strong> {form.scanDate} {form.scanTime ? `(${form.scanTime})` : ''}
            </div>
          </div>
        </div>

        {/* SECTION A */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '0.4rem', fontSize: '10.5pt' }}>
            Section A: To be filled in for all Diagnostic Procedures / Tests
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
            <tbody>
              <tr>
                <td style={{ width: '40%', padding: '0.25rem 0', verticalAlign: 'top' }}>1. Name of the Pregnant Woman:</td>
                <td style={{ width: '60%', padding: '0.25rem 0', fontWeight: 'bold' }}>{form.patientName}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.25rem 0', verticalAlign: 'top' }}>2. Age of the Pregnant Woman:</td>
                <td style={{ padding: '0.25rem 0' }}>{form.patientAge} Years</td>
              </tr>
              <tr>
                <td style={{ padding: '0.25rem 0', verticalAlign: 'top' }}>3. Husband&rsquo;s / Father&rsquo;s Name:</td>
                <td style={{ padding: '0.25rem 0' }}>{form.husbandOrFatherName}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.25rem 0', verticalAlign: 'top' }}>4. Full Residential Address:</td>
                <td style={{ padding: '0.25rem 0' }}>{form.fullAddress} {form.contactPhone ? `(Ph: ${form.contactPhone})` : ''}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.25rem 0', verticalAlign: 'top' }}>5. Total Number of Living Children:</td>
                <td style={{ padding: '0.25rem 0' }}>
                  <strong>{form.totalLivingChildren}</strong> &mdash; {livingChildrenText}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.25rem 0', verticalAlign: 'top' }}>6. Last Menstrual Period (LMP) &amp; Gestational Age:</td>
                <td style={{ padding: '0.25rem 0' }}>
                  LMP: <strong>{form.lmp || 'Not specified'}</strong> | Gestational Age: <strong>{form.gestationalAgeWeeks} Weeks {form.gestationalAgeDays} Days</strong>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.25rem 0', verticalAlign: 'top' }}>7. Doctor / Sonologist Performing Scan:</td>
                <td style={{ padding: '0.25rem 0' }}>
                  <strong>{form.doctorName}</strong> (Medical Reg. No: <strong>{form.doctorRegNo}</strong>)
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SECTION B */}
        <div style={{ marginBottom: '1rem', borderTop: '1px solid #ccc', paddingTop: '0.6rem' }}>
          <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '0.4rem', fontSize: '10.5pt' }}>
            Section B: Referral Particulars (Doctor Referral vs Self-Referral)
          </div>
          {form.referralType === 'doctor_referred' ? (
            <div style={{ paddingLeft: '1rem', fontSize: '10pt' }}>
              <div><strong>Referred By Doctor:</strong> Yes</div>
              <div><strong>Name of Referring Doctor:</strong> {form.referringDoctorName} (Reg. No: {form.referringDoctorRegNo || 'N/A'})</div>
              <div><strong>Clinic / Hospital Address:</strong> {form.referringClinicAddress || 'N/A'}</div>
              <div><strong>Referral Slip Date:</strong> {form.referralSlipDate || 'N/A'}</div>
            </div>
          ) : (
            <div style={{ paddingLeft: '1rem', fontSize: '10pt' }}>
              <div><strong>Referral Status:</strong> Self-Referred Patient</div>
              <div><strong>Specific Grounds / Symptoms for Self-Referral:</strong> {form.selfReferralReason || 'Routine antenatal obstetric checkup'}</div>
            </div>
          )}
        </div>

        {/* SECTION C */}
        <div style={{ marginBottom: '1rem', borderTop: '1px solid #ccc', paddingTop: '0.6rem' }}>
          <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '0.4rem', fontSize: '10.5pt' }}>
            Section C: Statutory Indications for Prenatal Diagnostic Ultrasound (Rule 9(5))
          </div>
          <div style={{ paddingLeft: '1rem', fontSize: '9.5pt' }}>
            <ul style={{ margin: '0.3rem 0', paddingLeft: '1.2rem' }}>
              {form.indicationCodes.map((c) => {
                const def = PNDT_STATUTORY_INDICATIONS.find((i) => i.code === c);
                return (
                  <li key={c} style={{ marginBottom: '0.2rem' }}>
                    <strong>{def?.label || c}</strong> {def?.ruleCitation ? `(${def.ruleCitation})` : ''}
                    {def?.description ? ` — ${def.description}` : ''}
                  </li>
                );
              })}
            </ul>
            {form.otherIndicationDetail && (
              <div style={{ marginTop: '0.3rem' }}><strong>Additional Indication Notes:</strong> {form.otherIndicationDetail}</div>
            )}
            <div style={{ marginTop: '0.4rem' }}>
              <strong>Invasive Diagnostic Procedure Done:</strong> {form.invasiveProcedureDone ? `Yes (${form.invasiveProcedureDetails || 'CVS / Amniocentesis'})` : 'No'}
            </div>
          </div>
        </div>

        {/* SECTION D: PREGNANT WOMAN DECLARATION */}
        <div style={{ border: '1.5px solid #000', padding: '0.75rem', marginBottom: '1rem', fontSize: '10pt' }}>
          <div style={{ fontWeight: 'bold', textAlign: 'center', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
            Section D: Declaration of the Pregnant Woman (Part I)
          </div>
          <p style={{ margin: '0 0 0.5rem 0', textAlign: 'justify', fontStyle: 'italic' }}>
            &ldquo;I, Mrs. <strong>{form.patientName}</strong>, declare that by undergoing ultrasound examination / image scanning, I do not want to know the sex of my fetus.&rdquo;
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1.25rem' }}>
            <div>
              <div>Date &amp; Time: <strong>{form.pregnantWomanDeclarationTime}</strong></div>
              <div>Place: <strong>{clinic?.address ? clinic.address.split(',')[0] : 'Clinic'}</strong></div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid #000', width: '220px', minHeight: '35px' }}></div>
              <div style={{ fontSize: '9pt', marginTop: '0.2rem' }}>
                Signature / Thumb Impression of Pregnant Woman<br />
                ({form.pregnantWomanSignatureName})
              </div>
            </div>
          </div>
        </div>

        {/* SECTION E: DOCTOR DECLARATION */}
        <div style={{ border: '1.5px solid #000', padding: '0.75rem', marginBottom: '1rem', fontSize: '10pt' }}>
          <div style={{ fontWeight: 'bold', textAlign: 'center', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
            Section E: Declaration of Doctor / Person Conducting Ultrasonography (Part II)
          </div>
          <p style={{ margin: '0 0 0.5rem 0', textAlign: 'justify', fontStyle: 'italic' }}>
            &ldquo;I, <strong>{form.doctorName}</strong> ({form.doctorRegNo}), declare that while conducting ultrasonography / image scanning of Mrs. <strong>{form.patientName}</strong>, I have neither determined the sex of her fetus nor disclosed or communicated the sex of the fetus to anyone in any manner.&rdquo;
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1.25rem' }}>
            <div>
              <div>Certified On: <strong>{form.doctorDeclarationTime}</strong></div>
              <div>Medical Council Reg. No: <strong>{form.doctorRegNo}</strong></div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid #000', width: '240px', minHeight: '35px' }}></div>
              <div style={{ fontSize: '9pt', marginTop: '0.2rem' }}>
                Signature &amp; Official Seal of Sonologist / Doctor<br />
                ({form.doctorDeclarationName})
              </div>
            </div>
          </div>
        </div>

        {/* SECTION F: DIAGNOSTIC RESULT SUMMARY */}
        <div style={{ borderTop: '1px solid #000', paddingTop: '0.5rem', fontSize: '9.5pt' }}>
          <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '0.3rem' }}>
            Section F: Result of the Prenatal Diagnostic Ultrasound Procedure
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
            <div>Fetal Number: <strong>{form.fetalNumber.toUpperCase()}</strong></div>
            <div>Cardiac Activity: <strong>{form.cardiacActivity.toUpperCase()}</strong></div>
            <div style={{ gridColumn: '1 / -1' }}>
              Congenital Malformation / Structural Anomaly: <strong>{form.congenitalAnomalyDetected ? `OBSERVED (${form.congenitalAnomalyDetails})` : 'NO ANOMALY DETECTED'}</strong>
            </div>
            {form.scanResultSummary && (
              <div style={{ gridColumn: '1 / -1' }}>
                Summary / Impression: <em>{form.scanResultSummary}</em>
              </div>
            )}
          </div>
        </div>

        {/* Footer Notice */}
        <div style={{ marginTop: '1.25rem', paddingTop: '0.5rem', borderTop: '1px dashed #94a3b8', textAlign: 'center', fontSize: '8pt', color: '#64748b' }}>
          Statutory Document maintained under Section 4(3) of PC-PNDT Act, 1994. To be preserved for inspection by the Appropriate Authority. Sex determination is prohibited by law and is a cognizable offence.
        </div>
      </div>
    </div>
  );
}
