import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type UltrasoundReport } from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';
import { BIOMETRIC_TAG_CONFIG } from '../components/UltrasoundGallery';
import { ANATOMICAL_SURVEY_ITEMS } from '../ultrasoundBiometry';

export function UltrasoundPrint() {
  const { id } = useParams();
  const reportId = Number(id);
  const { clinic, error: clinicError } = useClinic();

  const [report, setReport] = useState<UltrasoundReport | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    if (!reportId) return;
    api<UltrasoundReport>('GET', `/api/ultrasounds/${reportId}`)
      .then(setReport)
      .catch(setError);
  }, [reportId]);

  const handlePrint = async () => {
    try {
      await api('POST', `/api/ultrasounds/${reportId}/print`);
      setPrinted(true);
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
          <Link to="/patients" className="btn small">
            ← Back to Patients
          </Link>
        </p>
      </div>
    );
  }

  if (!clinic || !report) {
    return (
      <div className="page narrow stack">
        <p className="muted">Loading ultrasound report…</p>
      </div>
    );
  }

  const scanTypeLabel: Record<string, string> = {
    early_pregnancy: 'Early Pregnancy / Dating Scan',
    nt_first_trimester: 'First Trimester NT Scan',
    anomaly_scan: 'Targeted Anomaly Scan (TIFFA)',
    growth_wellbeing: 'Fetal Growth & Doppler Wellbeing Scan',
    pelvic_gyn: 'Pelvic / Gynecological Ultrasound',
    other: 'Diagnostic Ultrasound Scan',
  };

  let parsedAnatomy: Record<string, string> = {};
  if (report.anatomySurvey) {
    try {
      parsedAnatomy = JSON.parse(report.anatomySurvey);
    } catch {
      // Not JSON, treat as string notes
    }
  }

  const isObstetric = report.scanType !== 'pelvic_gyn';

  return (
    <Sheet
      clinic={clinic}
      title="Ultrasound Examination Report"
      back={`/patients/${report.patientId}`}
      onPrint={() => void handlePrint()}
    >
      {/* Subhead with scan classification */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '0.4rem', marginBottom: '0.8rem' }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#334155' }}>
          {scanTypeLabel[report.scanType] ?? report.scanType}
        </div>
      </div>

      {/* Patient & Examination Metadata Grid */}
      <section className="sheet-block">
        <dl
          className="grid-meta"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '0.4rem 1rem',
            margin: 0,
            fontSize: '0.85rem',
            lineHeight: 1.35,
          }}
        >
          <div>
            <dt className="muted small">Patient Name</dt>
            <dd><strong>{report.patientName}</strong></dd>
          </div>
          <div>
            <dt className="muted small">Patient MRN / ID</dt>
            <dd>{report.patientNumber}</dd>
          </div>
          <div>
            <dt className="muted small">Date of Examination</dt>
            <dd><strong>{report.scanDate}</strong></dd>
          </div>
          <div>
            <dt className="muted small">DOB</dt>
            <dd>{report.dateOfBirth || '—'}</dd>
          </div>
          <div>
            <dt className="muted small">Referring / Performed By</dt>
            <dd>{report.sonographerName || report.createdByName || clinic.doctorName}</dd>
          </div>
          <div>
            <dt className="muted small">Clinical Indication</dt>
            <dd>{report.indication || 'Routine obstetrical evaluation'}</dd>
          </div>
        </dl>
      </section>

      {/* Obstetric Dating & GA Details */}
      {isObstetric && (
        <section className="sheet-block" style={{ marginTop: '0.7rem' }}>
          <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem' }}>
            Obstetric Dating &amp; Gestational Summary
          </h3>
          <dl
            className="grid-meta"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '0.4rem 1rem',
              margin: 0,
              fontSize: '0.85rem',
            }}
          >
            <div>
              <dt className="muted small">Clinical LMP</dt>
              <dd>{report.clinicalLmp || '—'}</dd>
            </div>
            <div>
              <dt className="muted small">EDD by LMP</dt>
              <dd>{report.eddByLmp || '—'}</dd>
            </div>
            <div>
              <dt className="muted small">Gestational Age at Scan</dt>
              <dd>
                <strong>
                  {report.gestationalAgeWeeks != null
                    ? `${report.gestationalAgeWeeks}w ${report.gestationalAgeDays ?? 0}d`
                    : '—'}
                </strong>
              </dd>
            </div>
            <div>
              <dt className="muted small">EDD by Scan</dt>
              <dd><strong>{report.eddByScan || '—'}</strong></dd>
            </div>
            <div>
              <dt className="muted small">Number of Fetuses</dt>
              <dd style={{ textTransform: 'capitalize' }}>{report.fetalNumber || 'Single'}</dd>
            </div>
            <div>
              <dt className="muted small">Cardiac Activity &amp; FHR</dt>
              <dd>
                {report.cardiacActivity === 'present' ? (
                  <span>
                    ✓ Present {report.fhrBpm ? `(${report.fhrBpm} bpm, regular)` : ''}
                  </span>
                ) : (
                  <span>{report.cardiacActivity}</span>
                )}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {/* Fetal Biometry Section */}
      {isObstetric && (report.bpdMm || report.hcMm || report.acMm || report.flMm || report.crlMm || report.gsdMm) && (
        <section className="sheet-block" style={{ marginTop: '0.7rem' }}>
          <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem' }}>
            Fetal Biometry Measurements
          </h3>
          <table className="sheet-table" style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', marginTop: '0.25rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                <th style={{ padding: '0.35rem' }}>Biometric Parameter</th>
                <th style={{ padding: '0.35rem' }}>Observed Value</th>
                <th style={{ padding: '0.35rem' }}>Reference Formula / Standard</th>
              </tr>
            </thead>
            <tbody>
              {report.gsdMm != null && (
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem' }}>Gestational Sac (GSD)</td>
                  <td style={{ padding: '0.35rem' }}><strong>{report.gsdMm} mm</strong></td>
                  <td style={{ padding: '0.35rem' }} className="muted small">Early pregnancy sac mean diameter</td>
                </tr>
              )}
              {report.crlMm != null && (
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem' }}>Crown-Rump Length (CRL)</td>
                  <td style={{ padding: '0.35rem' }}><strong>{report.crlMm} mm</strong></td>
                  <td style={{ padding: '0.35rem' }} className="muted small">Robinson &amp; Fleming dating standard</td>
                </tr>
              )}
              {report.ntMm != null && (
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem' }}>Nuchal Translucency (NT)</td>
                  <td style={{ padding: '0.35rem' }}><strong>{report.ntMm} mm</strong></td>
                  <td style={{ padding: '0.35rem' }} className="muted small">Normal &lt; 2.5–3.0 mm (FMF standard)</td>
                </tr>
              )}
              {report.nasalBone && (
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem' }}>Nasal Bone</td>
                  <td style={{ padding: '0.35rem', textTransform: 'capitalize' }}><strong>{report.nasalBone}</strong></td>
                  <td style={{ padding: '0.35rem' }} className="muted small">First trimester aneuploidy marker</td>
                </tr>
              )}
              {report.bpdMm != null && (
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem' }}>Biparietal Diameter (BPD)</td>
                  <td style={{ padding: '0.35rem' }}><strong>{report.bpdMm} mm</strong></td>
                  <td style={{ padding: '0.35rem' }} className="muted small">Outer-to-inner parietal bone (Hadlock)</td>
                </tr>
              )}
              {report.hcMm != null && (
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem' }}>Head Circumference (HC)</td>
                  <td style={{ padding: '0.35rem' }}><strong>{report.hcMm} mm</strong></td>
                  <td style={{ padding: '0.35rem' }} className="muted small">Elliptical head contour (Hadlock)</td>
                </tr>
              )}
              {report.acMm != null && (
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem' }}>Abdominal Circumference (AC)</td>
                  <td style={{ padding: '0.35rem' }}><strong>{report.acMm} mm</strong></td>
                  <td style={{ padding: '0.35rem' }} className="muted small">Transverse abdominal section at portal sinus (Hadlock)</td>
                </tr>
              )}
              {report.flMm != null && (
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem' }}>Femur Length (FL)</td>
                  <td style={{ padding: '0.35rem' }}><strong>{report.flMm} mm</strong></td>
                  <td style={{ padding: '0.35rem' }} className="muted small">Diaphysis length excluding epiphyses (Hadlock)</td>
                </tr>
              )}
              {report.efwGrams != null && (
                <tr style={{ background: '#f0fdf4', borderTop: '2px solid #86efac' }}>
                  <td style={{ padding: '0.45rem', fontWeight: 600 }}>Estimated Fetal Weight (EFW)</td>
                  <td style={{ padding: '0.45rem' }}>
                    <strong style={{ fontSize: '1rem', color: '#15803d' }}>{report.efwGrams} grams</strong>
                  </td>
                  <td style={{ padding: '0.45rem' }}>
                    <strong>{report.efwPercentile || 'Hadlock Formula'}</strong>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* Fetal Environment & Placenta */}
      {isObstetric && (
        <section className="sheet-block" style={{ marginTop: '0.7rem' }}>
          <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem' }}>
            Fetal Lie, Presentation, Placenta &amp; Amniotic Fluid
          </h3>
          <dl
            className="grid-meta"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.4rem 1rem',
              margin: 0,
              fontSize: '0.85rem',
            }}
          >
            <div>
              <dt className="muted small">Presentation / Lie</dt>
              <dd style={{ textTransform: 'capitalize' }}><strong>{report.presentation || '—'}</strong></dd>
            </div>
            <div>
              <dt className="muted small">Placental Location &amp; Grade</dt>
              <dd>
                {report.placentaLocation ? (
                  <span style={{ textTransform: 'capitalize' }}>
                    <strong>{report.placentaLocation.replace('_', ' ')}</strong>
                    {report.placentaGrade ? ` (Maturity Grade ${report.placentaGrade})` : ''}
                  </span>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="muted small">Amniotic Fluid Evaluation</dt>
              <dd>
                {report.amnioticFluidCm != null ? (
                  <span>
                    <strong>{report.amnioticFluidCm} cm</strong> ({report.amnioticFluidType?.toUpperCase() || 'AFI'}) ·{' '}
                    <span style={{ textTransform: 'capitalize' }}>{report.amnioticFluidAssessment || 'Normal'}</span>
                  </span>
                ) : (
                  <span style={{ textTransform: 'capitalize' }}>{report.amnioticFluidAssessment || 'Adequate'}</span>
                )}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {/* Anatomical Survey Checklist (For anomaly scan) */}
      {isObstetric && Object.keys(parsedAnatomy).length > 0 && (
        <section className="sheet-block" style={{ marginTop: '0.7rem' }}>
          <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem' }}>
            Targeted Anatomical Survey (TIFFA Checklist)
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.3rem 0.8rem',
              fontSize: '0.8rem',
            }}
          >
            {ANATOMICAL_SURVEY_ITEMS.map((item) => {
              const val = parsedAnatomy[item.key] || 'Visualized & Normal';
              const isAbnormal = val.toLowerCase().includes('abnormal');
              return (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ color: isAbnormal ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>
                    {isAbnormal ? '⚠️' : '✓'}
                  </span>
                  <span>
                    <strong>{item.label}:</strong> {val}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Pelvic GYN Ultrasound Section */}
      {!isObstetric && (
        <section className="sheet-block" style={{ marginTop: '0.7rem' }}>
          <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem' }}>
            Pelvic &amp; Gynecological Findings
          </h3>
          <dl
            className="grid-meta"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.4rem 1rem',
              margin: 0,
              fontSize: '0.85rem',
            }}
          >
            <div>
              <dt className="muted small">Uterus Morphology &amp; Myometrium</dt>
              <dd>{report.uterusFindings || 'Normal size, contour, and echotexture'}</dd>
            </div>
            <div>
              <dt className="muted small">Endometrial Thickness</dt>
              <dd>
                {report.endometrialThicknessMm != null ? <strong>{report.endometrialThicknessMm} mm</strong> : '—'}
              </dd>
            </div>
            <div>
              <dt className="muted small">Right Ovary</dt>
              <dd>{report.rightOvaryFindings || 'Normal size and follicular pattern'}</dd>
            </div>
            <div>
              <dt className="muted small">Left Ovary</dt>
              <dd>{report.leftOvaryFindings || 'Normal size and follicular pattern'}</dd>
            </div>
            <div>
              <dt className="muted small">Pouch of Douglas (POD) Free Fluid</dt>
              <dd style={{ textTransform: 'capitalize' }}>{report.freeFluid || 'No free fluid seen'}</dd>
            </div>
          </dl>
        </section>
      )}

      {/* Impression & Recommendations Box */}
      <section
        className="sheet-block"
        style={{
          marginTop: '0.9rem',
          padding: '0.65rem 0.85rem',
          background: '#f8fafc',
          border: '1.5px solid #0f172a',
          borderRadius: '4px',
        }}
      >
        <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1rem', color: '#0f172a' }}>
          IMPRESSION / DIAGNOSIS
        </h3>
        <div style={{ fontSize: '0.92rem', lineHeight: 1.45, fontWeight: 500, whiteSpace: 'pre-wrap' }}>
          {report.impression}
        </div>

        {report.recommendations && (
          <div style={{ marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px dashed #cbd5e1' }}>
            <strong style={{ fontSize: '0.85rem', color: '#334155' }}>Recommendations / Follow-up:</strong>
            <div style={{ fontSize: '0.85rem', marginTop: '0.15rem' }}>{report.recommendations}</div>
          </div>
        )}
      </section>

      {/* Attached Sonographic Image Documentation Plate */}
      {(() => {
        const printImages = (report.images ?? []).filter(
          (img) => img.includeInPrint && img.mime !== 'application/pdf'
        );
        if (printImages.length === 0) return null;

        return (
          <section
            className="sheet-block"
            style={{
              marginTop: '1.2rem',
              pageBreakInside: 'avoid',
            }}
          >
            <div
              style={{
                fontSize: '0.88rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                borderBottom: '1px solid #0f172a',
                paddingBottom: '0.2rem',
                marginBottom: '0.6rem',
                color: '#0f172a',
              }}
            >
              Sonographic Image Documentation ({printImages.length} {printImages.length === 1 ? 'Plate' : 'Plates'})
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: printImages.length === 1 ? 'minmax(280px, 420px)' : 'repeat(2, 1fr)',
                gap: '0.8rem',
                justifyContent: 'center',
              }}
            >
              {printImages.map((img) => {
                const conf = BIOMETRIC_TAG_CONFIG[img.biometricTag] || BIOMETRIC_TAG_CONFIG.general;
                return (
                  <div
                    key={img.id}
                    style={{
                      border: '1px solid #94a3b8',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      background: '#000000',
                      display: 'flex',
                      flexDirection: 'column',
                      pageBreakInside: 'avoid',
                    }}
                  >
                    <div
                      style={{
                        height: '180px',
                        background: '#050811',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={`/api/attachments/${img.attachmentId}/file`}
                        alt={img.imageLabel || 'Ultrasound plate'}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        padding: '0.35rem 0.5rem',
                        background: '#f8fafc',
                        borderTop: '1px solid #cbd5e1',
                        fontSize: '0.78rem',
                        lineHeight: 1.3,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        color: '#0f172a',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '0.8rem' }}>
                          {img.imageLabel || 'Sonogram'}
                        </strong>
                        {img.measurementValue && (
                          <div style={{ color: '#0369a1', fontWeight: 600, fontSize: '0.75rem' }}>
                            {img.measurementValue}
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '3px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: conf.color,
                        }}
                      >
                        {conf.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* Signature & Disclaimer Block */}
      <div
        style={{
          marginTop: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          paddingTop: '0.5rem',
        }}
      >
        <div className="muted small" style={{ maxWidth: '350px', fontSize: '0.72rem', lineHeight: 1.3 }}>
          * Ultrasound biometry calculations reflect Hadlock standards. Clinical correlation is recommended.
        </div>

        <SignatureBlock
          clinic={clinic}
          signatoryName={report.sonographerName || clinic.doctorName}
          designation="Consultant Sonologist / Obstetrician"
          style={{ marginTop: 0 }}
        />
      </div>
    </Sheet>
  );
}
