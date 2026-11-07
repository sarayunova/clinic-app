import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Patient, type GeneticScreeningRecord } from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';

export function GeneticScreeningPrint() {
  const { patientId, id } = useParams();
  const episodeId = Number(id);
  const pId = Number(patientId);

  const { clinic, error: clinicError } = useClinic();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [episode, setEpisode] = useState<GeneticScreeningRecord | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    if (!episodeId || !pId) return;

    Promise.all([
      api<{ patient: Patient }>('GET', `/api/patients/${pId}`),
      api<GeneticScreeningRecord>('GET', `/api/patients/${pId}/genetic-screening/${episodeId}`),
    ])
      .then(([pRes, epRes]) => {
        setPatient(pRes.patient);
        setEpisode(epRes);
      })
      .catch(setError);
  }, [pId, episodeId]);

  const handlePrint = async () => {
    try {
      await api('POST', `/api/patients/${pId}/genetic-screening/${episodeId}/audit-print`);
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
          <Link to={`/patients/${pId}`} className="btn small">
            ← Back to Patient
          </Link>
        </p>
      </div>
    );
  }

  if (!clinic || !patient || !episode) {
    return (
      <div className="page narrow stack">
        <p className="muted">Loading genetic screening report…</p>
      </div>
    );
  }

  const isFts = episode.screeningType === 'first_trimester_combined';
  const isQuad = episode.screeningType === 'quadruple_marker';
  const isNipt = episode.screeningType === 'nipt_cfdna';
  const isInvasive = episode.screeningType === 'invasive_diagnostic';

  const riskTierDisplay = {
    low_risk: { label: 'LOW RISK', bg: '#dcfce7', text: '#166534', border: '#86efac' },
    intermediate_risk: { label: 'INTERMEDIATE RISK', bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
    high_risk: { label: 'HIGH RISK', bg: '#fee2e2', text: '#991b1b', border: '#f87171' },
    inconclusive: { label: 'INCONCLUSIVE / NO-CALL', bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  }[episode.overallRiskTier] || { label: episode.overallRiskTier.toUpperCase(), bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };

  return (
    <Sheet
      clinic={clinic}
      title="ANTENATAL GENETIC SCREENING & ANEUPLOIDY REPORT"
      back={`/patients/${pId}`}
      onPrint={() => void handlePrint()}
    >
      {/* Subhead with scan classification */}
      <div
        style={{
          textAlign: 'center',
          borderBottom: '2px solid #0f172a',
          paddingBottom: '0.4rem',
          marginBottom: '0.8rem',
        }}
      >
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase' }}>
          {isFts && 'First-Trimester Combined Screening (NT + PAPP-A + Free β-hCG)'}
          {isQuad && 'Second-Trimester Quadruple Test (AFP + Total hCG + uE3 + Inhibin-A)'}
          {isNipt && 'Cell-Free Fetal DNA (cfDNA / NIPT) Screening Report'}
          {isInvasive && 'Diagnostic Invasive Genetic Testing Report (CVS / Amniocentesis)'}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
          Standardized under Fetal Medicine Foundation (FMF) &amp; ACOG Practice Bulletin Guidelines
        </div>
      </div>

      {/* Patient & Pregnancy Demographics */}
      <section className="sheet-block" style={{ marginBottom: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <tbody>
            <tr>
              <td style={{ padding: '3px 6px', width: '25%', color: '#64748b' }}>Patient Name:</td>
              <td style={{ padding: '3px 6px', width: '25%', fontWeight: 700 }}>{patient.fullName}</td>
              <td style={{ padding: '3px 6px', width: '25%', color: '#64748b' }}>Patient MRN:</td>
              <td style={{ padding: '3px 6px', width: '25%', fontWeight: 700 }}>{patient.patientNumber}</td>
            </tr>
            <tr>
              <td style={{ padding: '3px 6px', color: '#64748b' }}>Maternal Age at EDD:</td>
              <td style={{ padding: '3px 6px', fontWeight: 600 }}>{episode.maternalAgeAtDelivery} years</td>
              <td style={{ padding: '3px 6px', color: '#64748b' }}>Date of Examination:</td>
              <td style={{ padding: '3px 6px', fontWeight: 600 }}>{episode.screeningDate}</td>
            </tr>
            <tr>
              <td style={{ padding: '3px 6px', color: '#64748b' }}>Gestational Age:</td>
              <td style={{ padding: '3px 6px', fontWeight: 600 }}>
                {episode.gestationalAgeWeeks} weeks {episode.gestationalAgeDays || 0} days
              </td>
              <td style={{ padding: '3px 6px', color: '#64748b' }}>Pregnancy Type:</td>
              <td style={{ padding: '3px 6px', fontWeight: 600, textTransform: 'capitalize' }}>
                {episode.pregnancyType.replace(/_/g, ' ')}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '3px 6px', color: '#64748b' }}>Maternal Weight / Risk:</td>
              <td style={{ padding: '3px 6px' }}>
                {episode.maternalWeightKg ? `${episode.maternalWeightKg} kg` : '—'}
                {episode.ivfPregnancy ? ' · IVF Conception' : ''}
                {episode.diabetesStatus ? ' · Diabetic' : ''}
              </td>
              <td style={{ padding: '3px 6px', color: '#64748b' }}>Counseled By:</td>
              <td style={{ padding: '3px 6px' }}>{episode.counseledByName || clinic.doctorName || 'Doctor'}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Primary Ultrasound & Serum Biomarkers */}
      <section className="sheet-block" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem 0', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
          Clinical Biometry &amp; Laboratory Markers
        </h3>

        {isFts && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ textAlign: 'left', padding: '6px' }}>Marker / Biometry</th>
                <th style={{ textAlign: 'left', padding: '6px' }}>Measured Value</th>
                <th style={{ textAlign: 'left', padding: '6px' }}>Expected Normal / Benchmark</th>
                <th style={{ textAlign: 'left', padding: '6px' }}>Clinical Interpretation</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>Crown-Rump Length (CRL)</td>
                <td style={{ padding: '6px' }}>{episode.crlMm ?? '—'} mm</td>
                <td style={{ padding: '6px' }}>45.0 – 84.0 mm</td>
                <td style={{ padding: '6px' }}>Valid window for first-trimester screening</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>Nuchal Translucency (NT)</td>
                <td style={{ padding: '6px', fontWeight: 700, color: (episode.ntMeasuredMm || 0) >= 3.5 ? '#dc2626' : 'inherit' }}>
                  {episode.ntMeasuredMm ?? '—'} mm
                </td>
                <td style={{ padding: '6px' }}>&lt; 2.5 mm (&lt; 95th percentile)</td>
                <td style={{ padding: '6px' }}>
                  {(episode.ntMeasuredMm || 0) >= 3.5
                    ? 'Markedly thickened (≥ 3.5 mm cut-off) - High Risk'
                    : (episode.ntMeasuredMm || 0) >= 2.5
                    ? 'Borderline increased NT'
                    : 'Within normal limits'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>Fetal Nasal Bone</td>
                <td style={{ padding: '6px', fontWeight: 700, color: episode.nasalBone === 'absent' ? '#dc2626' : 'inherit' }}>
                  {episode.nasalBone?.toUpperCase() ?? '—'}
                </td>
                <td style={{ padding: '6px' }}>Present</td>
                <td style={{ padding: '6px' }}>
                  {episode.nasalBone === 'absent'
                    ? 'Absent nasal bone (strong T21 association)'
                    : episode.nasalBone === 'present'
                    ? 'Reassuring nasal bone present'
                    : 'Hypoplastic / suboptimal'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>Ductus Venosus / Tricuspid</td>
                <td style={{ padding: '6px' }}>
                  DV: {episode.ductusVenosus || 'Normal'} · TR: {episode.tricuspidRegurgitation || 'Normal'}
                </td>
                <td style={{ padding: '6px' }}>Positive A-wave / No regurgitation</td>
                <td style={{ padding: '6px' }}>
                  {episode.ductusVenosus === 'reversed' || episode.tricuspidRegurgitation === 'regurgitant'
                    ? 'Abnormal Doppler pattern'
                    : 'Normal Doppler hemodynamics'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>Free β-hCG (Serum)</td>
                <td style={{ padding: '6px' }}>{episode.freeBetaHcgMom ?? '—'} MoM</td>
                <td style={{ padding: '6px' }}>Median: 1.0 MoM (0.5 – 2.0)</td>
                <td style={{ padding: '6px' }}>
                  {(episode.freeBetaHcgMom || 1) >= 2.0
                    ? 'Elevated (>2.0 MoM) in T21'
                    : (episode.freeBetaHcgMom || 1) <= 0.4
                    ? 'Depressed (<0.4 MoM) in T18/T13'
                    : 'Normal median range'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>PAPP-A (Serum)</td>
                <td style={{ padding: '6px' }}>{episode.pappAMom ?? '—'} MoM</td>
                <td style={{ padding: '6px' }}>Median: 1.0 MoM (0.5 – 2.0)</td>
                <td style={{ padding: '6px' }}>
                  {(episode.pappAMom || 1) <= 0.4
                    ? 'Significantly decreased (<0.4 MoM) in aneuploidies & placental insufficiency'
                    : 'Normal median range'}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {isQuad && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ textAlign: 'left', padding: '6px' }}>Quadruple Marker</th>
                <th style={{ textAlign: 'left', padding: '6px' }}>Measured MoM</th>
                <th style={{ textAlign: 'left', padding: '6px' }}>Cut-off / Benchmark</th>
                <th style={{ textAlign: 'left', padding: '6px' }}>Clinical Interpretation</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>Alpha-Fetoprotein (AFP)</td>
                <td style={{ padding: '6px', fontWeight: 700, color: (episode.afpMom || 0) >= 2.5 ? '#dc2626' : 'inherit' }}>
                  {episode.afpMom ?? '—'} MoM
                </td>
                <td style={{ padding: '6px' }}>&lt; 2.50 MoM</td>
                <td style={{ padding: '6px' }}>
                  {(episode.afpMom || 0) >= 2.5
                    ? 'ELEVATED (≥ 2.5 MoM): High risk for Open Neural Tube Defect (Spina Bifida)'
                    : 'Normal AFP range'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>Total hCG</td>
                <td style={{ padding: '6px' }}>{episode.totalHcgMom ?? '—'} MoM</td>
                <td style={{ padding: '6px' }}>0.5 – 2.0 MoM</td>
                <td style={{ padding: '6px' }}>{(episode.totalHcgMom || 1) >= 2.0 ? 'Elevated in Down syndrome' : 'Normal range'}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>Unconjugated Estriol (uE3)</td>
                <td style={{ padding: '6px' }}>{episode.ue3Mom ?? '—'} MoM</td>
                <td style={{ padding: '6px' }}>&gt; 0.50 MoM</td>
                <td style={{ padding: '6px' }}>{(episode.ue3Mom || 1) <= 0.5 ? 'Decreased in T21 and T18' : 'Normal range'}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>Dimeric Inhibin-A</td>
                <td style={{ padding: '6px' }}>{episode.inhibinAMom ?? '—'} MoM</td>
                <td style={{ padding: '6px' }}>&lt; 2.00 MoM</td>
                <td style={{ padding: '6px' }}>{(episode.inhibinAMom || 1) >= 2.0 ? 'Elevated in Down syndrome' : 'Normal range'}</td>
              </tr>
            </tbody>
          </table>
        )}

        {isNipt && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ textAlign: 'left', padding: '6px' }}>Targeted Chromosome / Assay</th>
                <th style={{ textAlign: 'left', padding: '6px' }}>Result Status</th>
                <th style={{ textAlign: 'left', padding: '6px' }}>Quality / Specification</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>Fetal Fraction (%)</td>
                <td style={{ padding: '6px', fontWeight: 700, color: (episode.niptFetalFractionPercent || 0) < 4.0 ? '#dc2626' : '#166534' }}>
                  {episode.niptFetalFractionPercent ?? '—'}%
                </td>
                <td style={{ padding: '6px' }}>
                  {(episode.niptFetalFractionPercent || 0) < 4.0
                    ? 'Suboptimal (<4.0% threshold) - High risk of false negative/assay failure'
                    : 'Adequate fetal fraction (≥4.0%) for reliable aneuploidy detection'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>Trisomy 21 (Down syndrome)</td>
                <td style={{ padding: '6px', fontWeight: 700, color: episode.niptT21Result === 'high_risk' ? '#dc2626' : '#166534' }}>
                  {episode.niptT21Result?.toUpperCase() ?? '—'}
                </td>
                <td style={{ padding: '6px' }}>Detection Rate &gt;99%, False Positive Rate &lt;0.1%</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>Trisomy 18 (Edwards syndrome)</td>
                <td style={{ padding: '6px', fontWeight: 700, color: episode.niptT18Result === 'high_risk' ? '#dc2626' : '#166534' }}>
                  {episode.niptT18Result?.toUpperCase() ?? '—'}
                </td>
                <td style={{ padding: '6px' }}>Detection Rate &gt;98%</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>Trisomy 13 (Patau syndrome)</td>
                <td style={{ padding: '6px', fontWeight: 700, color: episode.niptT13Result === 'high_risk' ? '#dc2626' : '#166534' }}>
                  {episode.niptT13Result?.toUpperCase() ?? '—'}
                </td>
                <td style={{ padding: '6px' }}>Detection Rate &gt;90%</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>Sex Chromosomes / Microdeletions</td>
                <td style={{ padding: '6px' }}>
                  {episode.niptSexChromosomes || 'Normal'} {episode.niptMicrodeletions ? `· ${episode.niptMicrodeletions}` : ''}
                </td>
                <td style={{ padding: '6px' }}>Testing Lab: {episode.niptLabName || 'Reference Genomics Laboratory'}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      {/* Calculated Aneuploidy & ONTD Risk Assessment Table */}
      <section className="sheet-block" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem 0', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
          Calculated Aneuploidy Risk Assessment
        </h3>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
              <th style={{ textAlign: 'left', padding: '6px' }}>Condition / Chromosome</th>
              <th style={{ textAlign: 'center', padding: '6px' }}>Maternal Age Baseline</th>
              <th style={{ textAlign: 'center', padding: '6px' }}>Calculated Adjusted Risk</th>
              <th style={{ textAlign: 'center', padding: '6px' }}>Screening Cut-off</th>
              <th style={{ textAlign: 'center', padding: '6px' }}>Screening Status</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px', fontWeight: 700 }}>Trisomy 21 (Down Syndrome)</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>{episode.backgroundT21RiskRatio}</td>
              <td
                style={{
                  padding: '6px',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: episode.overallRiskTier === 'high_risk' ? '#dc2626' : '#166534',
                }}
              >
                {episode.adjustedT21RiskRatio}
              </td>
              <td style={{ padding: '6px', textAlign: 'center' }}>1:250</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>
                <span
                  style={{
                    backgroundColor: riskTierDisplay.bg,
                    color: riskTierDisplay.text,
                    border: `1px solid ${riskTierDisplay.border}`,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                  }}
                >
                  {riskTierDisplay.label}
                </span>
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px', fontWeight: 600 }}>Trisomy 18 (Edwards Syndrome)</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>—</td>
              <td style={{ padding: '6px', textAlign: 'center', fontWeight: 600 }}>{episode.adjustedT18RiskRatio}</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>1:100</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>
                {episode.adjustedT18RiskNumeric >= 0.01 ? (
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>HIGH RISK</span>
                ) : (
                  <span style={{ color: '#166534', fontWeight: 600 }}>LOW RISK</span>
                )}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px', fontWeight: 600 }}>Trisomy 13 (Patau Syndrome)</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>—</td>
              <td style={{ padding: '6px', textAlign: 'center', fontWeight: 600 }}>{episode.adjustedT13RiskRatio}</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>1:100</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>
                {episode.adjustedT13RiskNumeric >= 0.01 ? (
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>HIGH RISK</span>
                ) : (
                  <span style={{ color: '#166534', fontWeight: 600 }}>LOW RISK</span>
                )}
              </td>
            </tr>
            {isQuad && (
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>Open Neural Tube Defect (ONTD)</td>
                <td style={{ padding: '6px', textAlign: 'center' }}>Population</td>
                <td style={{ padding: '6px', textAlign: 'center', fontWeight: 600 }}>
                  AFP {episode.afpMom ? `${episode.afpMom} MoM` : '—'}
                </td>
                <td style={{ padding: '6px', textAlign: 'center' }}>2.50 MoM</td>
                <td style={{ padding: '6px', textAlign: 'center' }}>
                  {episode.ontdRiskStatus === 'high_risk' ? (
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>HIGH RISK (≥2.5 MoM)</span>
                  ) : (
                    <span style={{ color: '#166534', fontWeight: 600 }}>LOW RISK</span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Invasive Diagnostic Procedure Results (if performed) */}
      {(episode.invasiveProcedureType && episode.invasiveProcedureType !== 'none') && (
        <section
          className="sheet-block"
          style={{
            marginBottom: '1rem',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '0.8rem',
            backgroundColor: '#f8fafc',
          }}
        >
          <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem 0', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px' }}>
            Diagnostic Invasive Testing &amp; Definitive Cytogenetics
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <tbody>
              <tr>
                <td style={{ padding: '3px 6px', width: '25%', color: '#64748b' }}>Procedure:</td>
                <td style={{ padding: '3px 6px', width: '25%', fontWeight: 700, textTransform: 'uppercase' }}>
                  {episode.invasiveProcedureType}
                </td>
                <td style={{ padding: '3px 6px', width: '25%', color: '#64748b' }}>Procedure Date:</td>
                <td style={{ padding: '3px 6px', width: '25%', fontWeight: 600 }}>{episode.invasiveProcedureDate || '—'}</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 6px', color: '#64748b' }}>Operator / Performed By:</td>
                <td style={{ padding: '3px 6px' }}>{episode.invasivePerformedBy || '—'}</td>
                <td style={{ padding: '3px 6px', color: '#64748b' }}>Rh Anti-D Administered:</td>
                <td style={{ padding: '3px 6px' }}>{episode.antiDGiven ? 'Yes (300 mcg RhIG)' : 'Not indicated / Rh Positive'}</td>
              </tr>
              {episode.rapidQfpcrResult && (
                <tr>
                  <td style={{ padding: '3px 6px', color: '#64748b' }}>Rapid QF-PCR (24–48h):</td>
                  <td colSpan={3} style={{ padding: '3px 6px', fontWeight: 600 }}>
                    {episode.rapidQfpcrResult}
                  </td>
                </tr>
              )}
              {episode.microarrayCmaResult && (
                <tr>
                  <td style={{ padding: '3px 6px', color: '#64748b' }}>Chromosomal Microarray (CMA):</td>
                  <td colSpan={3} style={{ padding: '3px 6px', fontWeight: 600 }}>
                    {episode.microarrayCmaResult}
                  </td>
                </tr>
              )}
              {episode.karyotypeResult && (
                <tr>
                  <td style={{ padding: '3px 6px', color: '#64748b' }}>Karyotype (G-banding):</td>
                  <td colSpan={3} style={{ padding: '3px 6px', fontWeight: 700, color: '#0f172a' }}>
                    {episode.karyotypeResult}
                  </td>
                </tr>
              )}
              {episode.finalGeneticDiagnosis && (
                <tr>
                  <td style={{ padding: '3px 6px', color: '#64748b' }}>Final Genetic Verdict:</td>
                  <td colSpan={3} style={{ padding: '3px 6px', fontWeight: 700, color: '#1e40af' }}>
                    {episode.finalGeneticDiagnosis}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* Clinical Recommendation & Counseling Notes */}
      <section className="sheet-block" style={{ marginBottom: '1.2rem' }}>
        <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem 0', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
          Clinical Recommendation &amp; Genetic Counseling
        </h3>

        <div
          style={{
            backgroundColor: episode.overallRiskTier === 'high_risk' ? '#fff1f2' : '#f0fdf4',
            borderLeft: `4px solid ${episode.overallRiskTier === 'high_risk' ? '#e11d48' : '#22c55e'}`,
            padding: '0.6rem 0.8rem',
            borderRadius: '4px',
            fontSize: '0.85rem',
            lineHeight: 1.45,
            marginBottom: '0.6rem',
          }}
        >
          <strong>Clinical Directive:</strong> {episode.clinicalRecommendation}
        </div>

        {episode.counselingNotes && (
          <div style={{ fontSize: '0.85rem', lineHeight: 1.4, color: '#334155', marginBottom: '0.4rem' }}>
            <strong>Counseling Discussion:</strong> {episode.counselingNotes}
          </div>
        )}

        <div style={{ fontSize: '0.85rem', color: '#475569' }}>
          <strong>Patient / Couple Decision:</strong>{' '}
          <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>
            {episode.patientDecision ? episode.patientDecision.replace(/_/g, ' ') : 'UNDECIDED'}
          </span>
        </div>
      </section>

      {/* Statutory / Clinical Disclaimer */}
      <section
        style={{
          borderTop: '1px dashed #cbd5e1',
          paddingTop: '0.5rem',
          fontSize: '0.72rem',
          color: '#64748b',
          lineHeight: 1.35,
          marginBottom: '1rem',
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>CLINICAL SCREENING DISCLAIMER:</strong> Antenatal biochemical and ultrasound screening tests provide a statistical calculation of aneuploidy risk and are NOT definitive diagnostic tests. A low-risk result significantly reduces the probability but does not completely eliminate the risk of chromosomal abnormalities or genetic microdeletions. A high-risk result indicates increased probability and warrants genetic counseling and diagnostic testing via Chorionic Villus Sampling (CVS) or Amniocentesis with Chromosomal Microarray (CMA) and QF-PCR. Under the statutory provisions of the PC-PNDT Act, sex determination is strictly prohibited and neither evaluated nor disclosed.
        </p>
      </section>

      {/* Official Signature Block */}
      <SignatureBlock
        clinic={clinic}
        signatoryName={episode.counseledByName || clinic.doctorName}
        designation="Consultant Obstetrician &amp; Fetal Medicine Specialist"
        subtext="Certified Fetal Medicine Foundation (FMF) Risk Assessment"
        date={episode.screeningDate}
      />
    </Sheet>
  );
}
