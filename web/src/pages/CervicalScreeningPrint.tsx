import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { CervicalScreeningRecord, Patient } from '../api';
import {
  calculateSwedeScore,
  determineBethesdaRisk,
  SWEDE_ACETOWHITENING_OPTIONS,
  SWEDE_MARGIN_OPTIONS,
  SWEDE_VESSEL_OPTIONS,
  SWEDE_SIZE_OPTIONS,
  SWEDE_IODINE_OPTIONS,
  CERVICAL_CLOCK_POSITIONS,
} from '../cervicalEngine';

export function CervicalScreeningPrint() {
  const { patientId, id } = useParams<{ patientId: string; id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [record, setRecord] = useState<CervicalScreeningRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch patient
        const ptRes = await fetch(`/api/patients/${patientId}`);
        if (!ptRes.ok) throw new Error('Failed to load patient');
        const ptData = await ptRes.json();
        setPatient(ptData.patient);

        // Fetch cervical screening record
        const scRes = await fetch(`/api/patients/${patientId}/cervical-screenings/${id}`);
        if (!scRes.ok) throw new Error('Failed to load cervical screening record');
        const scData = await scRes.json();
        setRecord(scData.record);

        // Register print audit event
        void fetch(`/api/patients/${patientId}/cervical-screenings/${id}/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error loading cervical screening report for printing');
      } finally {
        setLoading(false);
      }
    }
    if (patientId && id) void fetchData();
  }, [patientId, id]);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        Loading Colposcopy &amp; Cervical Screening report for printing...
      </div>
    );
  }

  if (error || !record || !patient) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626', fontFamily: 'sans-serif' }}>
        {error || 'Screening record not found'}
      </div>
    );
  }

  const bethesdaMeta = determineBethesdaRisk(record.pap_result);
  const swedeResult =
    record.swede_score_total != null
      ? calculateSwedeScore({
          acetowhitening: record.swede_acetowhitening ?? 0,
          margins: record.swede_margins ?? 0,
          vessels: record.swede_vessels ?? 0,
          lesionSize: record.swede_lesion_size ?? 0,
          iodineStaining: record.swede_iodine_staining ?? 0,
        })
      : null;

  return (
    <div
      style={{
        maxWidth: '850px',
        margin: '0 auto',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#1e293b',
        background: '#fff',
      }}
    >
      {/* Top Action Bar */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '12px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <button
          onClick={() => window.history.back()}
          style={{
            padding: '8px 16px',
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          ← Back
        </button>
        <button
          onClick={() => window.print()}
          style={{
            padding: '8px 20px',
            background: '#9d174d',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          🖨️ Print Colposcopy Report
        </button>
      </div>

      {/* Clinic Header / Letterhead */}
      <div
        style={{
          textAlign: 'center',
          borderBottom: '2px solid #9d174d',
          paddingBottom: '12px',
          marginBottom: '16px',
        }}
      >
        <h1 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#9d174d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Obstetrics &amp; Gynaecology Specialty Clinic
        </h1>
        <div style={{ fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
          Colposcopy, Cervical Pathology &amp; Well-Woman Cancer Screening Unit
        </div>
        <h2
          style={{
            margin: '8px 0 0 0',
            fontSize: '16px',
            color: '#0f172a',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Colposcopy &amp; Cervical Screening Consultation Report
        </h2>
      </div>

      {/* Patient Demographic Information Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '4px',
          padding: '10px 14px',
          fontSize: '12px',
          marginBottom: '16px',
        }}
      >
        <div>
          <span style={{ color: '#64748b' }}>Patient Name:</span>
          <div style={{ fontWeight: 700, fontSize: '13px' }}>{String(patient.fullName || '')}</div>
        </div>
        <div>
          <span style={{ color: '#64748b' }}>Patient ID:</span>
          <div style={{ fontWeight: 700 }}>{String(patient.patientNumber || '')}</div>
        </div>
        <div>
          <span style={{ color: '#64748b' }}>Age / DOB:</span>
          <div style={{ fontWeight: 600 }}>
            {String(patient.dateOfBirth || (patient.estimatedAgeYears ? `${patient.estimatedAgeYears} yrs` : '—'))}
          </div>
        </div>
        <div>
          <span style={{ color: '#64748b' }}>Phone:</span>
          <div style={{ fontWeight: 600 }}>{patient.phone ? String(patient.phone) : '—'}</div>
        </div>
        <div>
          <span style={{ color: '#64748b' }}>Examination Date:</span>
          <div style={{ fontWeight: 700, color: '#9d174d' }}>{record.screening_date}</div>
        </div>
        <div>
          <span style={{ color: '#64748b' }}>Screening Type:</span>
          <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>
            {record.screening_type.replace(/_/g, ' ')}
          </div>
        </div>
        <div>
          <span style={{ color: '#64748b' }}>Indication:</span>
          <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>
            {record.indication.replace(/_/g, ' ')}
          </div>
        </div>
        <div>
          <span style={{ color: '#64748b' }}>LMP / Parity:</span>
          <div style={{ fontWeight: 600 }}>
            {patient.lastMenstrualPeriod ? `LMP: ${String(patient.lastMenstrualPeriod)}` : '—'} | G{String(patient.gravida ?? 0)}P{String(patient.para ?? 0)}
          </div>
        </div>
      </div>

      {/* Bethesda Cytology & HPV Molecular Results Table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        {/* Cytology Panel */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '10px 12px', fontSize: '12px' }}>
          <div style={{ fontWeight: 700, color: '#9d174d', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '6px' }}>
            Bethesda 2014 Cervical Cytology
          </div>
          {record.pap_performed ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>
                <span style={{ color: '#64748b' }}>Cytologic Diagnosis:</span>
                <div style={{ fontWeight: 700, fontSize: '13px', color: bethesdaMeta.grade === 'normal' ? '#15803d' : '#b91c1c' }}>
                  {bethesdaMeta.title}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Specimen Adequacy:</span>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                  {record.pap_adequacy?.replace(/_/g, ' ') || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Smear Technique:</span>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                  {record.pap_sample_type?.replace(/_/g, ' ') || '—'}
                </span>
              </div>
              {record.pap_lab_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Laboratory:</span>
                  <span>{record.pap_lab_name} {record.pap_report_number ? `(${record.pap_report_number})` : ''}</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#64748b', fontStyle: 'italic' }}>Cytology smear not performed in this visit.</div>
          )}
        </div>

        {/* HPV Molecular Panel */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '10px 12px', fontSize: '12px' }}>
          <div style={{ fontWeight: 700, color: '#9d174d', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '6px' }}>
            High-Risk HPV DNA Molecular Assay
          </div>
          {record.hpv_performed ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Overall High-Risk HPV:</span>
                <span style={{ fontWeight: 700, color: record.hpv_overall_result === 'positive' ? '#b91c1c' : '#15803d' }}>
                  {record.hpv_overall_result?.toUpperCase() || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>HPV 16 Genotype:</span>
                <span style={{ fontWeight: record.hpv_16_positive ? 700 : 400, color: record.hpv_16_positive ? '#b91c1c' : 'inherit' }}>
                  {record.hpv_16_positive ? 'POSITIVE ⚠️' : 'Negative'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>HPV 18 Genotype:</span>
                <span style={{ fontWeight: record.hpv_18_positive ? 700 : 400, color: record.hpv_18_positive ? '#b91c1c' : 'inherit' }}>
                  {record.hpv_18_positive ? 'POSITIVE ⚠️' : 'Negative'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Other High-Risk Pool:</span>
                <span>{record.hpv_other_high_risk_positive ? 'POSITIVE' : 'Negative'}</span>
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontStyle: 'italic' }}>HPV molecular testing not conducted.</div>
          )}
        </div>
      </div>

      {/* Colposcopic Examination & Cervical Clock Mapping Section */}
      {record.colposcopy_performed ? (
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '10px' }}>
            <span style={{ fontWeight: 700, fontSize: '13px', color: '#9d174d' }}>
              Colposcopic Assessment &amp; Transformation Zone
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>
              Swede Score: {record.swede_score_total ?? 0}/10 • {swedeResult?.title}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '16px', alignItems: 'center' }}>
            {/* SVG Cervical Clock Diagram for Print */}
            <div style={{ textAlign: 'center' }}>
              <svg width="220" height="220" viewBox="0 0 280 280">
                <circle cx="140" cy="140" r="115" fill="#f8fafc" stroke="#64748b" strokeWidth="2" />
                <circle cx="140" cy="140" r="70" fill="none" stroke="#9d174d" strokeWidth="2" strokeDasharray="4 3" />
                <ellipse cx="140" cy="140" rx="14" ry="7" fill="#475569" stroke="#1e293b" strokeWidth="2" />

                {CERVICAL_CLOCK_POSITIONS.map((cp) => {
                  const rad = (cp.angleDeg * Math.PI) / 180;
                  const x1 = 140 + 105 * Math.cos(rad);
                  const y1 = 140 + 105 * Math.sin(rad);
                  const x2 = 140 + 115 * Math.cos(rad);
                  const y2 = 140 + 115 * Math.sin(rad);
                  const lx = 140 + 128 * Math.cos(rad);
                  const ly = 140 + 128 * Math.sin(rad) + 4;

                  const isLesion = record.lesion_quadrants?.includes(`${cp.clock}_oclock`);
                  const hasBiopsy = record.biopsies?.some((b) => b.clock_position === cp.clock);

                  return (
                    <g key={cp.clock}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth="1.5" />
                      <text x={lx} y={ly} fontSize="11" textAnchor="middle" fontWeight="bold" fill="#334155">
                        {cp.clock}
                      </text>
                      {isLesion && (
                        <circle
                          cx={140 + 72 * Math.cos(rad)}
                          cy={140 + 72 * Math.sin(rad)}
                          r="16"
                          fill="#ef4444"
                          fillOpacity="0.4"
                          stroke="#b91c1c"
                          strokeWidth="1.5"
                        />
                      )}
                      {hasBiopsy && (
                        <g>
                          <circle cx={140 + 72 * Math.cos(rad)} cy={140 + 72 * Math.sin(rad)} r="8" fill="#1e40af" stroke="#fff" strokeWidth="1.5" />
                          <text x={140 + 72 * Math.cos(rad)} y={140 + 72 * Math.sin(rad) + 3} fontSize="9" fill="#fff" textAnchor="middle" fontWeight="bold">
                            B
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                Cervical Map: Anterior (12h) • Posterior (6h)
              </div>
            </div>

            {/* Swede Score Parameters Table */}
            <div style={{ fontSize: '11px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Transformation Zone:</span>
                  <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                    {record.transformation_zone_type?.replace(/_/g, ' ') || '—'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>SCJ Visibility:</span>
                  <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                    {record.squamocolumnar_junction_visible?.replace(/_/g, ' ') || '—'}
                  </div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', border: '1px solid #e2e8f0' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '4px 8px' }}>Parameter</th>
                    <th style={{ padding: '4px 8px', textAlign: 'center' }}>Score</th>
                    <th style={{ padding: '4px 8px' }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '4px 8px' }}>Acetowhitening</td>
                    <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 'bold' }}>{record.swede_acetowhitening ?? 0}</td>
                    <td style={{ padding: '4px 8px' }}>{SWEDE_ACETOWHITENING_OPTIONS.find((o) => o.value === record.swede_acetowhitening)?.label || '—'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '4px 8px' }}>Margins &amp; Surface</td>
                    <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 'bold' }}>{record.swede_margins ?? 0}</td>
                    <td style={{ padding: '4px 8px' }}>{SWEDE_MARGIN_OPTIONS.find((o) => o.value === record.swede_margins)?.label || '—'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '4px 8px' }}>Vessels</td>
                    <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 'bold' }}>{record.swede_vessels ?? 0}</td>
                    <td style={{ padding: '4px 8px' }}>{SWEDE_VESSEL_OPTIONS.find((o) => o.value === record.swede_vessels)?.label || '—'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '4px 8px' }}>Lesion Size</td>
                    <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 'bold' }}>{record.swede_lesion_size ?? 0}</td>
                    <td style={{ padding: '4px 8px' }}>{SWEDE_SIZE_OPTIONS.find((o) => o.value === record.swede_lesion_size)?.label || '—'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '4px 8px' }}>Iodine Uptake (Lugol)</td>
                    <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 'bold' }}>{record.swede_iodine_staining ?? 0}</td>
                    <td style={{ padding: '4px 8px' }}>{SWEDE_IODINE_OPTIONS.find((o) => o.value === record.swede_iodine_staining)?.label || '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* Cervical Biopsies & Histopathology Table */}
      {record.biopsies && record.biopsies.length > 0 && (
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '10px 12px', fontSize: '11px', marginBottom: '16px' }}>
          <div style={{ fontWeight: 700, color: '#9d174d', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '6px' }}>
            Cervical Biopsy Specimens &amp; Histopathology Results
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '4px 6px' }}>Specimen</th>
                <th style={{ padding: '4px 6px' }}>Site Location</th>
                <th style={{ padding: '4px 6px' }}>Clock</th>
                <th style={{ padding: '4px 6px' }}>Histopathologic Diagnosis</th>
                <th style={{ padding: '4px 6px' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {record.biopsies.map((bx) => (
                <tr key={bx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '4px 6px', fontWeight: 'bold' }}>{bx.specimen_label || `BX-${bx.id}`}</td>
                  <td style={{ padding: '4px 6px' }}>{bx.site_location}</td>
                  <td style={{ padding: '4px 6px' }}>{bx.clock_position ? `${bx.clock_position} o'clock` : 'Endocervix'}</td>
                  <td style={{ padding: '4px 6px', fontWeight: 'bold', color: bx.histopathology_result.includes('cin_3') || bx.histopathology_result.includes('cin_2') ? '#b91c1c' : '#15803d' }}>
                    {bx.histopathology_result.replace(/_/g, ' ').toUpperCase()}
                  </td>
                  <td style={{ padding: '4px 6px', color: '#475569' }}>{bx.pathologist_notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ASCCP / Clinical Management Plan & Recommended Follow-up */}
      <div
        style={{
          border: '1.5px solid #9d174d',
          background: '#fff5f7',
          borderRadius: '4px',
          padding: '12px 14px',
          fontSize: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={{ fontWeight: 700, color: '#9d174d', fontSize: '13px', marginBottom: '4px' }}>
          Management Recommendation &amp; Follow-Up Schedule
        </div>
        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '6px' }}>
          {record.management_recommendation}
        </div>
        <div style={{ display: 'flex', gap: '24px', color: '#475569', fontSize: '12px' }}>
          <span><strong>Next Recall / Surveillance:</strong> {record.next_recall_months ?? 60} Months</span>
          {record.clinical_notes && <span><strong>Clinical Notes:</strong> {record.clinical_notes}</span>}
        </div>
      </div>

      {/* Signature and Verification Footer */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          marginTop: '40px',
          fontSize: '11px',
          color: '#475569',
        }}
      >
        <div>
          <div>Report Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</div>
          <div>Clinic Electronic Medical Record System • Tamper-evident Audit Verified</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ height: '40px' }} />
          <div style={{ borderTop: '1px solid #475569', display: 'inline-block', minWidth: '220px', paddingTop: '4px' }}>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>
              {record.examiner_name || record.created_by_name || 'Consultant Gynaecologist & Colposcopist'}
            </div>
            <div>Consultant Obstetrician &amp; Gynaecologist</div>
          </div>
        </div>
      </div>
    </div>
  );
}
