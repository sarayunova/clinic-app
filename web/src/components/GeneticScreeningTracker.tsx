import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, type Patient, type GeneticScreeningRecord } from '../api';
import { useAuth, useMe } from '../auth';
import {
  calculateMaternalBackgroundRisk,
  calculateExpectedMedianNt,
  calculateFirstTrimesterCombinedRisk,
  calculateQuadrupleRisk,
  evaluateNiptResult,
} from '../geneticEngine';

interface Props {
  patient: Patient;
}

export function GeneticScreeningTracker({ patient }: Props) {
  const { can } = useAuth();
  const me = useMe();

  const [episodes, setEpisodes] = useState<GeneticScreeningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Compute default maternal age from DOB
  const computeDefaultAge = (): number => {
    if (!patient.dateOfBirth || typeof patient.dateOfBirth !== 'string') return 28;
    const dob = new Date(patient.dateOfBirth);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return Math.max(16, Math.min(50, age));
  };

  // Compute default GA from LMP
  const computeDefaultGa = (): { weeks: number; days: number } => {
    if (!patient.lastMenstrualPeriod || typeof patient.lastMenstrualPeriod !== 'string') return { weeks: 12, days: 2 };
    const lmp = new Date(patient.lastMenstrualPeriod);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lmp.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 300) {
      return { weeks: Math.floor(diffDays / 7), days: diffDays % 7 };
    }
    return { weeks: 12, days: 2 };
  };

  const initialForm = (): Partial<GeneticScreeningRecord> => {
    const ga = computeDefaultGa();
    return {
      patientId: patient.id,
      screeningDate: new Date().toISOString().substring(0, 10),
      screeningType: 'first_trimester_combined',
      gestationalAgeWeeks: ga.weeks,
      gestationalAgeDays: ga.days,
      maternalAgeAtDelivery: computeDefaultAge(),
      maternalWeightKg: 60.0,
      pregnancyType: 'singleton',
      ivfPregnancy: false,
      diabetesStatus: false,
      smoker: false,

      // First trimester
      crlMm: 62.0,
      ntMeasuredMm: 1.5,
      nasalBone: 'present',
      tricuspidRegurgitation: 'normal',
      ductusVenosus: 'positive',
      freeBetaHcgMom: 1.0,
      pappAMom: 1.0,

      // Quadruple test
      bpdMm: 38.0,
      afpMom: 1.0,
      totalHcgMom: 1.0,
      ue3Mom: 1.0,
      inhibinAMom: 1.0,

      // NIPT
      niptSampleDate: '',
      niptFetalFractionPercent: 8.5,
      niptT21Result: 'low_risk',
      niptT18Result: 'low_risk',
      niptT13Result: 'low_risk',
      niptSexChromosomes: 'XX (Consistent with Female)',
      niptMicrodeletions: 'Not detected',
      niptLabName: 'Lilac / MedGenome Genomics Laboratory',

      // Counseling & Decisions
      counselingNotes: 'Pre-test counseling provided regarding aneuploidy screening limitations, detection rates, and diagnostic alternatives.',
      patientDecision: 'routine_care',

      // Diagnostic
      invasiveProcedureType: 'none',
      invasiveProcedureDate: '',
      invasivePerformedBy: me.fullName || 'Attending Obstetrician',
      invasiveSampleDetails: '',
      antiDGiven: false,
      rapidQfpcrResult: '',
      karyotypeResult: '',
      microarrayCmaResult: '',
      finalGeneticDiagnosis: '',
    };
  };

  const [form, setForm] = useState<Partial<GeneticScreeningRecord>>(initialForm());

  const loadEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ total: number; episodes: GeneticScreeningRecord[] }>(
        'GET',
        `/api/patients/${patient.id}/genetic-screening`,
      );
      setEpisodes(res.episodes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load genetic screening records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [patient.id]);

  // Real-time calculation previews
  const maternalAge = Number(form.maternalAgeAtDelivery) || computeDefaultAge();
  const backgroundRisk = calculateMaternalBackgroundRisk(maternalAge);

  let liveCalcResult = null;
  if (form.screeningType === 'first_trimester_combined' && form.crlMm && form.ntMeasuredMm) {
    liveCalcResult = calculateFirstTrimesterCombinedRisk({
      maternalAge,
      gestationalAgeWeeks: Number(form.gestationalAgeWeeks) || 12,
      gestationalAgeDays: Number(form.gestationalAgeDays) || 0,
      crlMm: Number(form.crlMm),
      ntMeasuredMm: Number(form.ntMeasuredMm),
      nasalBone: form.nasalBone || 'present',
      tricuspidRegurgitation: form.tricuspidRegurgitation || 'normal',
      ductusVenosus: form.ductusVenosus || 'positive',
      freeBetaHcgMom: form.freeBetaHcgMom != null ? Number(form.freeBetaHcgMom) : 1.0,
      pappAMom: form.pappAMom != null ? Number(form.pappAMom) : 1.0,
      maternalWeightKg: form.maternalWeightKg != null ? Number(form.maternalWeightKg) : undefined,
      diabetesStatus: Boolean(form.diabetesStatus),
      smoker: Boolean(form.smoker),
      ivfPregnancy: Boolean(form.ivfPregnancy),
    });
  } else if (form.screeningType === 'quadruple_marker') {
    liveCalcResult = calculateQuadrupleRisk({
      maternalAge,
      gestationalAgeWeeks: Number(form.gestationalAgeWeeks) || 16,
      gestationalAgeDays: Number(form.gestationalAgeDays) || 0,
      afpMom: Number(form.afpMom) || 1.0,
      totalHcgMom: Number(form.totalHcgMom) || 1.0,
      ue3Mom: Number(form.ue3Mom) || 1.0,
      inhibinAMom: Number(form.inhibinAMom) || 1.0,
    });
  }

  const liveNiptResult =
    form.screeningType === 'nipt_cfdna' && form.niptFetalFractionPercent != null
      ? evaluateNiptResult({
          fetalFractionPercent: Number(form.niptFetalFractionPercent),
          t21Result: form.niptT21Result || undefined,
          t18Result: form.niptT18Result || undefined,
          t13Result: form.niptT13Result || undefined,
        })
      : null;

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(initialForm());
    setShowModal(true);
  };

  const handleOpenEdit = (rec: GeneticScreeningRecord) => {
    setEditingId(rec.id);
    setForm({ ...rec });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this genetic screening episode? This action is audited.')) {
      return;
    }
    try {
      await api('DELETE', `/api/patients/${patient.id}/genetic-screening/${id}`);
      await loadEpisodes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete record');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        patientId: patient.id,
        // include calculated risks if live calculation was performed
        ...(liveCalcResult
          ? {
              backgroundT21RiskRatio: liveCalcResult.backgroundT21Ratio,
              adjustedT21RiskRatio: liveCalcResult.adjustedT21Ratio,
              adjustedT21RiskNumeric: liveCalcResult.adjustedT21Numeric,
              adjustedT18RiskRatio: liveCalcResult.adjustedT18Ratio,
              adjustedT18RiskNumeric: liveCalcResult.adjustedT18Numeric,
              adjustedT13RiskRatio: liveCalcResult.adjustedT13Ratio,
              adjustedT13RiskNumeric: liveCalcResult.adjustedT13Numeric,
              ontdRiskStatus: liveCalcResult.ontdRiskStatus,
              overallRiskTier: liveCalcResult.overallRiskTier,
              clinicalRecommendation: form.clinicalRecommendation || liveCalcResult.clinicalRecommendation,
            }
          : {}),
      };

      if (editingId) {
        await api('PUT', `/api/patients/${patient.id}/genetic-screening/${editingId}`, payload);
      } else {
        await api('POST', `/api/patients/${patient.id}/genetic-screening`, payload);
      }
      setShowModal(false);
      await loadEpisodes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save screening record');
    } finally {
      setSaving(false);
    }
  };

  const getTierBadge = (tier: string) => {
    if (tier === 'high_risk') {
      return (
        <span
          style={{
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #f87171',
            padding: '3px 8px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.8rem',
          }}
        >
          🚨 HIGH RISK (≥ 1:250)
        </span>
      );
    }
    if (tier === 'intermediate_risk') {
      return (
        <span
          style={{
            backgroundColor: '#fef3c7',
            color: '#92400e',
            border: '1px solid #fcd34d',
            padding: '3px 8px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.8rem',
          }}
        >
          ⚠️ INTERMEDIATE RISK (1:251–1:1000)
        </span>
      );
    }
    if (tier === 'inconclusive') {
      return (
        <span
          style={{
            backgroundColor: '#f1f5f9',
            color: '#475569',
            border: '1px solid #cbd5e1',
            padding: '3px 8px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.8rem',
          }}
        >
          ❓ INCONCLUSIVE / NO-CALL
        </span>
      );
    }
    return (
      <span
        style={{
          backgroundColor: '#dcfce7',
          color: '#166534',
          border: '1px solid #86efac',
          padding: '3px 8px',
          borderRadius: '12px',
          fontWeight: 700,
          fontSize: '0.8rem',
        }}
      >
        ✅ LOW RISK (&lt; 1:1000)
      </span>
    );
  };

  return (
    <div className="stack" style={{ gap: '1.2rem' }}>
      {/* Top Banner / Actions */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)',
          borderColor: '#bbf7d0',
        }}
      >
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🧬</span> Antenatal Genetic Screening &amp; Aneuploidy Risk Engine
          </h3>
          <p className="muted small" style={{ margin: '0.3rem 0 0 0' }}>
            Evidence-based FMF &amp; ACOG combined first-trimester screening, quadruple testing, cell-free fetal DNA (NIPT), and invasive diagnostic tracker.
          </p>
        </div>
        {can('patient:write_clinical') && (
          <button type="button" className="btn primary" onClick={handleOpenCreate}>
            + New Genetic Screening Episode
          </button>
        )}
      </div>

      {error && (
        <div className="banner warn" role="alert">
          {error}
        </div>
      )}

      {/* Episode History List */}
      <section className="card stack">
        <h4 style={{ margin: '0 0 0.5rem 0' }}>Screening Episodes &amp; Genetic History ({episodes.length})</h4>

        {loading ? (
          <p className="muted">Loading screening episodes…</p>
        ) : episodes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🧬</div>
            <p style={{ margin: 0 }}>No antenatal genetic screening recorded for {patient.fullName}.</p>
            {can('patient:write_clinical') && (
              <button
                type="button"
                className="btn small primary"
                style={{ marginTop: '0.8rem' }}
                onClick={handleOpenCreate}
              >
                Start First-Trimester Screening (NT + Bio)
              </button>
            )}
          </div>
        ) : (
          <div className="stack" style={{ gap: '1rem' }}>
            {episodes.map((ep) => (
              <div
                key={ep.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1rem',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '0.6rem',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                      {ep.screeningType === 'first_trimester_combined'
                        ? 'First-Trimester Combined Screening (NT + PAPP-A + β-hCG)'
                        : ep.screeningType === 'quadruple_marker'
                        ? 'Second-Trimester Quadruple Marker (AFP + hCG + uE3 + Inhibin-A)'
                        : ep.screeningType === 'nipt_cfdna'
                        ? 'Non-Invasive Prenatal Testing (cfDNA / NIPT)'
                        : 'Invasive Diagnostic Procedure (CVS / Amniocentesis)'}
                    </strong>
                    <div className="muted small" style={{ marginTop: '2px' }}>
                      Date: <strong>{ep.screeningDate}</strong> · Gestational Age: <strong>{ep.gestationalAgeWeeks}w {ep.gestationalAgeDays || 0}d</strong> · Maternal Age: <strong>{ep.maternalAgeAtDelivery} yrs</strong>
                    </div>
                  </div>
                  <div>{getTierBadge(ep.overallRiskTier)}</div>
                </div>

                {/* Key Metrics Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.6rem',
                    backgroundColor: '#f8fafc',
                    padding: '0.8rem',
                    borderRadius: '6px',
                    margin: '0.6rem 0',
                    fontSize: '0.85rem',
                  }}
                >
                  {ep.screeningType === 'first_trimester_combined' && (
                    <>
                      <div>
                        <span className="muted">Fetal CRL:</span> <strong>{ep.crlMm ?? '—'} mm</strong>
                      </div>
                      <div>
                        <span className="muted">Nuchal Translucency:</span> <strong>{ep.ntMeasuredMm ?? '—'} mm</strong>
                        {ep.ntMeasuredMm && ep.ntMeasuredMm >= 3.5 && (
                          <span style={{ color: '#dc2626', fontWeight: 'bold' }}> (Thickened ≥ 3.5mm)</span>
                        )}
                      </div>
                      <div>
                        <span className="muted">Nasal Bone:</span>{' '}
                        <strong style={{ color: ep.nasalBone === 'absent' ? '#dc2626' : 'inherit' }}>
                          {ep.nasalBone?.toUpperCase() ?? '—'}
                        </strong>
                      </div>
                      <div>
                        <span className="muted">Free β-hCG:</span> <strong>{ep.freeBetaHcgMom ?? '—'} MoM</strong>
                      </div>
                      <div>
                        <span className="muted">PAPP-A:</span> <strong>{ep.pappAMom ?? '—'} MoM</strong>
                      </div>
                      <div>
                        <span className="muted">Adjusted T21 Risk:</span>{' '}
                        <strong style={{ color: ep.overallRiskTier === 'high_risk' ? '#dc2626' : '#15803d' }}>
                          {ep.adjustedT21RiskRatio}
                        </strong>{' '}
                        <span className="muted">(Bg: {ep.backgroundT21RiskRatio})</span>
                      </div>
                    </>
                  )}

                  {ep.screeningType === 'quadruple_marker' && (
                    <>
                      <div>
                        <span className="muted">Maternal AFP:</span>{' '}
                        <strong style={{ color: (ep.afpMom || 0) >= 2.5 ? '#dc2626' : 'inherit' }}>
                          {ep.afpMom ?? '—'} MoM {(ep.afpMom || 0) >= 2.5 ? '(High ONTD)' : ''}
                        </strong>
                      </div>
                      <div>
                        <span className="muted">Total hCG:</span> <strong>{ep.totalHcgMom ?? '—'} MoM</strong>
                      </div>
                      <div>
                        <span className="muted">Unconjugated Estriol:</span> <strong>{ep.ue3Mom ?? '—'} MoM</strong>
                      </div>
                      <div>
                        <span className="muted">Inhibin-A:</span> <strong>{ep.inhibinAMom ?? '—'} MoM</strong>
                      </div>
                      <div>
                        <span className="muted">Adjusted T21 Risk:</span>{' '}
                        <strong style={{ color: ep.overallRiskTier === 'high_risk' ? '#dc2626' : '#15803d' }}>
                          {ep.adjustedT21RiskRatio}
                        </strong>
                      </div>
                      <div>
                        <span className="muted">ONTD Status:</span>{' '}
                        <strong style={{ color: ep.ontdRiskStatus === 'high_risk' ? '#dc2626' : '#15803d' }}>
                          {ep.ontdRiskStatus === 'high_risk' ? 'HIGH RISK' : 'LOW RISK'}
                        </strong>
                      </div>
                    </>
                  )}

                  {ep.screeningType === 'nipt_cfdna' && (
                    <>
                      <div>
                        <span className="muted">Fetal Fraction:</span>{' '}
                        <strong style={{ color: (ep.niptFetalFractionPercent || 0) < 4.0 ? '#dc2626' : '#15803d' }}>
                          {ep.niptFetalFractionPercent ?? '—'}%
                          {(ep.niptFetalFractionPercent || 0) < 4.0 ? ' (Low FF < 4%)' : ' (Adequate)'}
                        </strong>
                      </div>
                      <div>
                        <span className="muted">T21 cfDNA Call:</span>{' '}
                        <strong>{ep.niptT21Result?.toUpperCase() ?? '—'}</strong>
                      </div>
                      <div>
                        <span className="muted">T18 cfDNA Call:</span>{' '}
                        <strong>{ep.niptT18Result?.toUpperCase() ?? '—'}</strong>
                      </div>
                      <div>
                        <span className="muted">T13 cfDNA Call:</span>{' '}
                        <strong>{ep.niptT13Result?.toUpperCase() ?? '—'}</strong>
                      </div>
                      <div>
                        <span className="muted">Sex Chromosomes:</span> <strong>{ep.niptSexChromosomes ?? '—'}</strong>
                      </div>
                      <div>
                        <span className="muted">Vendor Lab:</span> <strong>{ep.niptLabName ?? '—'}</strong>
                      </div>
                    </>
                  )}

                  {ep.screeningType === 'invasive_diagnostic' && (
                    <>
                      <div>
                        <span className="muted">Procedure:</span>{' '}
                        <strong>{ep.invasiveProcedureType?.toUpperCase() ?? '—'}</strong>
                      </div>
                      <div>
                        <span className="muted">Procedure Date:</span>{' '}
                        <strong>{ep.invasiveProcedureDate ?? '—'}</strong>
                      </div>
                      <div>
                        <span className="muted">Rapid QF-PCR:</span> <strong>{ep.rapidQfpcrResult ?? '—'}</strong>
                      </div>
                      <div>
                        <span className="muted">Karyotype:</span> <strong>{ep.karyotypeResult ?? '—'}</strong>
                      </div>
                      <div>
                        <span className="muted">Microarray (CMA):</span> <strong>{ep.microarrayCmaResult ?? '—'}</strong>
                      </div>
                      <div>
                        <span className="muted">Final Diagnosis:</span>{' '}
                        <strong style={{ color: '#0f172a' }}>{ep.finalGeneticDiagnosis ?? '—'}</strong>
                      </div>
                    </>
                  )}
                </div>

                {/* Recommendation Box */}
                {ep.clinicalRecommendation && (
                  <div
                    style={{
                      backgroundColor: ep.overallRiskTier === 'high_risk' ? '#fff1f2' : '#f0fdf4',
                      borderLeft: `4px solid ${ep.overallRiskTier === 'high_risk' ? '#e11d48' : '#22c55e'}`,
                      padding: '0.6rem 0.8rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      margin: '0.5rem 0',
                    }}
                  >
                    <strong>Clinical Recommendation:</strong> {ep.clinicalRecommendation}
                  </div>
                )}

                {/* Invasive Diagnostic Follow-up (if performed alongside screening) */}
                {ep.invasiveProcedureType && ep.invasiveProcedureType !== 'none' && ep.screeningType !== 'invasive_diagnostic' && (
                  <div
                    style={{
                      backgroundColor: '#f1f5f9',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      margin: '0.5rem 0',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    <strong>Diagnostic Follow-up ({ep.invasiveProcedureType.toUpperCase()}):</strong>
                    {ep.karyotypeResult ? ` Karyotype: ${ep.karyotypeResult}` : ''}
                    {ep.rapidQfpcrResult ? ` · QF-PCR: ${ep.rapidQfpcrResult}` : ''}
                    {ep.microarrayCmaResult ? ` · CMA: ${ep.microarrayCmaResult}` : ''}
                  </div>
                )}

                {/* Footer Actions */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '0.6rem',
                    paddingTop: '0.4rem',
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <span className="muted small">
                    Counseled by: {ep.counseledByName || 'Doctor'} · Patient Decision:{' '}
                    <strong>{ep.patientDecision ? ep.patientDecision.replace(/_/g, ' ').toUpperCase() : 'UNDECIDED'}</strong>
                  </span>
                  <div className="row wrap" style={{ gap: '0.4rem' }}>
                    <Link
                      to={`/patients/${patient.id}/genetic-screening/${ep.id}/print`}
                      className="btn small"
                      title="Print Clinical Genetic Counseling Report"
                    >
                      🖨️ Print Report
                    </Link>
                    {can('patient:write_clinical') && (
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => handleOpenEdit(ep)}
                        title="Edit episode or add procedure results"
                      >
                        ✏️ Edit / Diagnostic Results
                      </button>
                    )}
                    {can('patient:write_clinical') && (
                      <button
                        type="button"
                        className="btn small danger"
                        onClick={() => handleDelete(ep.id)}
                        title="Delete screening episode"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Editor Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              padding: '1.5rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '0.8rem',
                marginBottom: '1rem',
              }}
            >
              <h3 style={{ margin: 0, color: '#0f172a' }}>
                {editingId ? 'Edit Genetic Screening & Invasive Results' : 'New Antenatal Genetic Screening Episode'}
              </h3>
              <button
                type="button"
                className="btn small"
                onClick={() => setShowModal(false)}
                style={{ fontSize: '1.1rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="stack" style={{ gap: '1.2rem' }}>
              {/* Screening Type Selector Tabs */}
              <div>
                <label className="label">
                  <strong>Screening Modality:</strong>
                </label>
                <div className="row wrap" style={{ gap: '0.5rem', marginTop: '0.3rem' }}>
                  <button
                    type="button"
                    className={`btn small ${form.screeningType === 'first_trimester_combined' ? 'primary' : ''}`}
                    onClick={() => setForm({ ...form, screeningType: 'first_trimester_combined' })}
                  >
                    1️⃣ First-Trimester Combined (11–13⁺⁶w)
                  </button>
                  <button
                    type="button"
                    className={`btn small ${form.screeningType === 'quadruple_marker' ? 'primary' : ''}`}
                    onClick={() => setForm({ ...form, screeningType: 'quadruple_marker' })}
                  >
                    2️⃣ Second-Trimester Quadruple (15–22w)
                  </button>
                  <button
                    type="button"
                    className={`btn small ${form.screeningType === 'nipt_cfdna' ? 'primary' : ''}`}
                    onClick={() => setForm({ ...form, screeningType: 'nipt_cfdna' })}
                  >
                    3️⃣ Cell-Free DNA / NIPT (10w+)
                  </button>
                  <button
                    type="button"
                    className={`btn small ${form.screeningType === 'invasive_diagnostic' ? 'primary' : ''}`}
                    onClick={() => setForm({ ...form, screeningType: 'invasive_diagnostic' })}
                  >
                    4️⃣ Diagnostic Invasive Tracker (CVS/Amnio)
                  </button>
                </div>
              </div>

              {/* Maternal Demographics & Gestation */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.8rem',
                  backgroundColor: '#f8fafc',
                  padding: '0.8rem',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <label className="label small">Date of Test/Scan</label>
                  <input
                    type="date"
                    required
                    className="input"
                    value={form.screeningDate || ''}
                    onChange={(e) => setForm({ ...form, screeningDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label small">Maternal Age at EDD (yrs)</label>
                  <input
                    type="number"
                    min="15"
                    max="55"
                    required
                    className="input"
                    value={form.maternalAgeAtDelivery || ''}
                    onChange={(e) => setForm({ ...form, maternalAgeAtDelivery: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label small">GA Weeks</label>
                  <input
                    type="number"
                    min="9"
                    max="42"
                    required
                    className="input"
                    value={form.gestationalAgeWeeks ?? ''}
                    onChange={(e) => setForm({ ...form, gestationalAgeWeeks: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label small">GA Days</label>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    className="input"
                    value={form.gestationalAgeDays ?? 0}
                    onChange={(e) => setForm({ ...form, gestationalAgeDays: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label small">Maternal Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="30"
                    max="180"
                    className="input"
                    value={form.maternalWeightKg ?? ''}
                    onChange={(e) => setForm({ ...form, maternalWeightKg: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div>
                  <label className="label small">Pregnancy Type</label>
                  <select
                    className="input"
                    value={form.pregnancyType || 'singleton'}
                    onChange={(e) => setForm({ ...form, pregnancyType: e.target.value })}
                  >
                    <option value="singleton">Singleton</option>
                    <option value="twin_dichorionic">Twin - Dichorionic</option>
                    <option value="twin_monochorionic">Twin - Monochorionic</option>
                  </select>
                </div>
              </div>

              {/* Special Risk Factors */}
              <div className="row wrap" style={{ gap: '1.5rem', fontSize: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.ivfPregnancy)}
                    onChange={(e) => setForm({ ...form, ivfPregnancy: e.target.checked })}
                  />
                  <span>IVF / ART Conception</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.diabetesStatus)}
                    onChange={(e) => setForm({ ...form, diabetesStatus: e.target.checked })}
                  />
                  <span>Pre-existing / Gestational Diabetes</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.smoker)}
                    onChange={(e) => setForm({ ...form, smoker: e.target.checked })}
                  />
                  <span>Maternal Smoking</span>
                </label>
              </div>

              {/* FIRST TRIMESTER COMBINED SCREENING INPUTS */}
              {form.screeningType === 'first_trimester_combined' && (
                <div className="stack" style={{ gap: '0.8rem', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '1rem', backgroundColor: '#f0f9ff' }}>
                  <h4 style={{ margin: 0, color: '#1e40af' }}>Ultrasound Biometry &amp; First Trimester Serum Markers</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
                    <div>
                      <label className="label small">Crown-Rump Length (CRL mm: 45–84)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="45"
                        max="84"
                        required
                        className="input"
                        value={form.crlMm ?? ''}
                        onChange={(e) => setForm({ ...form, crlMm: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="label small">Measured NT (mm)</label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.5"
                        max="12.0"
                        required
                        className="input"
                        value={form.ntMeasuredMm ?? ''}
                        onChange={(e) => setForm({ ...form, ntMeasuredMm: Number(e.target.value) })}
                      />
                      {form.crlMm && form.ntMeasuredMm && (
                        <div className="small muted" style={{ marginTop: '2px' }}>
                          Median: {calculateExpectedMedianNt(form.crlMm)} mm (Δ {Number((form.ntMeasuredMm - calculateExpectedMedianNt(form.crlMm)).toFixed(2))} mm)
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="label small">Fetal Nasal Bone</label>
                      <select
                        className="input"
                        value={form.nasalBone || 'present'}
                        onChange={(e) => setForm({ ...form, nasalBone: e.target.value as any })}
                      >
                        <option value="present">Present (Normal)</option>
                        <option value="absent">Absent (High risk T21)</option>
                        <option value="hypoplastic">Hypoplastic</option>
                        <option value="not_visualized">Not visualized / Obscured</option>
                      </select>
                    </div>
                    <div>
                      <label className="label small">Tricuspid Flow</label>
                      <select
                        className="input"
                        value={form.tricuspidRegurgitation || 'normal'}
                        onChange={(e) => setForm({ ...form, tricuspidRegurgitation: e.target.value as any })}
                      >
                        <option value="normal">Normal (No Regurgitation)</option>
                        <option value="regurgitant">Tricuspid Regurgitation (&gt;60 cm/s)</option>
                        <option value="not_performed">Not performed</option>
                      </select>
                    </div>
                    <div>
                      <label className="label small">Ductus Venosus PIV</label>
                      <select
                        className="input"
                        value={form.ductusVenosus || 'positive'}
                        onChange={(e) => setForm({ ...form, ductusVenosus: e.target.value as any })}
                      >
                        <option value="positive">Positive A-wave (Normal)</option>
                        <option value="reversed">Reversed A-wave (Abnormal)</option>
                        <option value="not_performed">Not performed</option>
                      </select>
                    </div>
                    <div>
                      <label className="label small">Free β-hCG (MoM)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.05"
                        max="20.0"
                        className="input"
                        value={form.freeBetaHcgMom ?? ''}
                        onChange={(e) => setForm({ ...form, freeBetaHcgMom: e.target.value ? Number(e.target.value) : null })}
                      />
                    </div>
                    <div>
                      <label className="label small">PAPP-A (MoM)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.05"
                        max="20.0"
                        className="input"
                        value={form.pappAMom ?? ''}
                        onChange={(e) => setForm({ ...form, pappAMom: e.target.value ? Number(e.target.value) : null })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* QUADRUPLE MARKER INPUTS */}
              {form.screeningType === 'quadruple_marker' && (
                <div className="stack" style={{ gap: '0.8rem', border: '1px solid #fed7aa', borderRadius: '6px', padding: '1rem', backgroundColor: '#fff7ed' }}>
                  <h4 style={{ margin: 0, color: '#c2410c' }}>Second Trimester Quadruple Serum Biochemistry (15–22w)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
                    <div>
                      <label className="label small">BPD (mm)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="25"
                        max="70"
                        className="input"
                        value={form.bpdMm ?? ''}
                        onChange={(e) => setForm({ ...form, bpdMm: e.target.value ? Number(e.target.value) : null })}
                      />
                    </div>
                    <div>
                      <label className="label small">AFP (MoM, cut-off ≥ 2.5)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        max="10.0"
                        required
                        className="input"
                        value={form.afpMom ?? ''}
                        onChange={(e) => setForm({ ...form, afpMom: Number(e.target.value) })}
                      />
                      {form.afpMom && form.afpMom >= 2.5 && (
                        <div style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          ⚠️ Elevated (≥ 2.5 MoM): High risk for Open Spina Bifida / ONTD
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="label small">Total hCG (MoM)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        max="10.0"
                        required
                        className="input"
                        value={form.totalHcgMom ?? ''}
                        onChange={(e) => setForm({ ...form, totalHcgMom: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="label small">Unconjugated Estriol uE3 (MoM)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        max="5.0"
                        required
                        className="input"
                        value={form.ue3Mom ?? ''}
                        onChange={(e) => setForm({ ...form, ue3Mom: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="label small">Inhibin-A (MoM)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        max="10.0"
                        required
                        className="input"
                        value={form.inhibinAMom ?? ''}
                        onChange={(e) => setForm({ ...form, inhibinAMom: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* NIPT / CELL-FREE DNA INPUTS */}
              {form.screeningType === 'nipt_cfdna' && (
                <div className="stack" style={{ gap: '0.8rem', border: '1px solid #e9d5ff', borderRadius: '6px', padding: '1rem', backgroundColor: '#faf5ff' }}>
                  <h4 style={{ margin: 0, color: '#7e22ce' }}>Cell-Free Fetal DNA (cfDNA / NIPT) Assay Details</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
                    <div>
                      <label className="label small">Sample Collection Date</label>
                      <input
                        type="date"
                        className="input"
                        value={form.niptSampleDate || ''}
                        onChange={(e) => setForm({ ...form, niptSampleDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label small">Fetal Fraction (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="35.0"
                        required
                        className="input"
                        value={form.niptFetalFractionPercent ?? ''}
                        onChange={(e) => setForm({ ...form, niptFetalFractionPercent: Number(e.target.value) })}
                      />
                      {form.niptFetalFractionPercent != null && form.niptFetalFractionPercent < 4.0 && (
                        <div style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          ⚠️ Low Fetal Fraction (&lt; 4.0%): Inconclusive / increased test failure
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="label small">Trisomy 21 Result</label>
                      <select
                        className="input"
                        value={form.niptT21Result || 'low_risk'}
                        onChange={(e) => setForm({ ...form, niptT21Result: e.target.value as any })}
                      >
                        <option value="low_risk">Low Risk (&gt; 99% Negative Predictive Value)</option>
                        <option value="high_risk">High Risk (Requires Amnio confirmation)</option>
                        <option value="inconclusive">Inconclusive / No-Call</option>
                      </select>
                    </div>
                    <div>
                      <label className="label small">Trisomy 18 Result</label>
                      <select
                        className="input"
                        value={form.niptT18Result || 'low_risk'}
                        onChange={(e) => setForm({ ...form, niptT18Result: e.target.value as any })}
                      >
                        <option value="low_risk">Low Risk</option>
                        <option value="high_risk">High Risk</option>
                        <option value="inconclusive">Inconclusive / No-Call</option>
                      </select>
                    </div>
                    <div>
                      <label className="label small">Trisomy 13 Result</label>
                      <select
                        className="input"
                        value={form.niptT13Result || 'low_risk'}
                        onChange={(e) => setForm({ ...form, niptT13Result: e.target.value as any })}
                      >
                        <option value="low_risk">Low Risk</option>
                        <option value="high_risk">High Risk</option>
                        <option value="inconclusive">Inconclusive / No-Call</option>
                      </select>
                    </div>
                    <div>
                      <label className="label small">Sex Chromosome Anomaly</label>
                      <input
                        type="text"
                        placeholder="e.g. Consistent with Female (XX) / Monosomy X"
                        className="input"
                        value={form.niptSexChromosomes || ''}
                        onChange={(e) => setForm({ ...form, niptSexChromosomes: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label small">Vendor Laboratory Name</label>
                      <input
                        type="text"
                        placeholder="e.g. MedGenome, Lilac, Natera"
                        className="input"
                        value={form.niptLabName || ''}
                        onChange={(e) => setForm({ ...form, niptLabName: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* LIVE RISK CALCULATION CARD */}
              {(liveCalcResult || liveNiptResult) && (
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '2px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <h4 style={{ margin: 0, color: '#0f172a' }}>Live Aneuploidy Risk Assessment &amp; Meter</h4>
                    {liveCalcResult && getTierBadge(liveCalcResult.overallRiskTier)}
                    {liveNiptResult && getTierBadge(liveNiptResult.overallTier)}
                  </div>

                  {liveCalcResult && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem', fontSize: '0.88rem' }}>
                      <div style={{ backgroundColor: '#ffffff', padding: '0.6rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <span className="muted small">Baseline Maternal Age Odds:</span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#475569' }}>
                          {backgroundRisk.t21Ratio}
                        </div>
                      </div>
                      <div style={{ backgroundColor: '#ffffff', padding: '0.6rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <span className="muted small">Adjusted Down Syndrome (T21):</span>
                        <div
                          style={{
                            fontSize: '1.1rem',
                            fontWeight: 700,
                            color: liveCalcResult.overallRiskTier === 'high_risk' ? '#dc2626' : '#166534',
                          }}
                        >
                          {liveCalcResult.adjustedT21Ratio}
                        </div>
                      </div>
                      <div style={{ backgroundColor: '#ffffff', padding: '0.6rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <span className="muted small">Adjusted Edwards (T18):</span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#475569' }}>
                          {liveCalcResult.adjustedT18Ratio}
                        </div>
                      </div>
                      <div style={{ backgroundColor: '#ffffff', padding: '0.6rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <span className="muted small">Adjusted Patau (T13):</span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#475569' }}>
                          {liveCalcResult.adjustedT13Ratio}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recommendation Preview */}
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      borderLeft: '4px solid #3b82f6',
                      padding: '0.7rem 0.9rem',
                      borderRadius: '4px',
                      marginTop: '0.8rem',
                      fontSize: '0.85rem',
                      lineHeight: 1.4,
                    }}
                  >
                    <strong>ACOG / SMFM Guideline Directive:</strong>{' '}
                    {liveCalcResult?.clinicalRecommendation || liveNiptResult?.recommendation}
                  </div>
                </div>
              )}

              {/* INVASIVE DIAGNOSTIC PROCEDURE & KARYOTYPE SECTION */}
              <div
                className="stack"
                style={{
                  gap: '0.8rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, color: '#0f172a' }}>Diagnostic Invasive Testing &amp; Definitive Results</h4>
                  <span className="muted small">CVS / Amniocentesis / Microarray</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
                  <div>
                    <label className="label small">Invasive Procedure Type</label>
                    <select
                      className="input"
                      value={form.invasiveProcedureType || 'none'}
                      onChange={(e) => setForm({ ...form, invasiveProcedureType: e.target.value as any })}
                    >
                      <option value="none">None (Not Performed)</option>
                      <option value="cvs">Chorionic Villus Sampling (CVS, 11–14w)</option>
                      <option value="amniocentesis">Amniocentesis (15–20w)</option>
                      <option value="cordocentesis">Cordocentesis (PUBS, &gt;20w)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label small">Procedure Date</label>
                    <input
                      type="date"
                      className="input"
                      value={form.invasiveProcedureDate || ''}
                      onChange={(e) => setForm({ ...form, invasiveProcedureDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label small">Operator / Clinician</label>
                    <input
                      type="text"
                      className="input"
                      value={form.invasivePerformedBy || ''}
                      onChange={(e) => setForm({ ...form, invasivePerformedBy: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', paddingTop: '1.2rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(form.antiDGiven)}
                        onChange={(e) => setForm({ ...form, antiDGiven: e.target.checked })}
                      />
                      <span className="small">Anti-D Ig Given (Rh-negative Mother)</span>
                    </label>
                  </div>
                </div>

                {form.invasiveProcedureType && form.invasiveProcedureType !== 'none' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.8rem', marginTop: '0.5rem' }}>
                    <div>
                      <label className="label small">Rapid QF-PCR Result (24–48h)</label>
                      <input
                        type="text"
                        placeholder="e.g. Normal 2 copies Chromosomes 13, 18, 21, X, Y"
                        className="input"
                        value={form.rapidQfpcrResult || ''}
                        onChange={(e) => setForm({ ...form, rapidQfpcrResult: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label small">Chromosomal Microarray (CMA / aCGH)</label>
                      <input
                        type="text"
                        placeholder="e.g. arr(1-22,X,Y)x2 (Normal female array profile)"
                        className="input"
                        value={form.microarrayCmaResult || ''}
                        onChange={(e) => setForm({ ...form, microarrayCmaResult: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label small">Conventional Karyotype (G-banding)</label>
                      <input
                        type="text"
                        placeholder="e.g. 46,XX (Normal female karyotype)"
                        className="input"
                        value={form.karyotypeResult || ''}
                        onChange={(e) => setForm({ ...form, karyotypeResult: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label small">Final Genetic Verdict</label>
                      <input
                        type="text"
                        placeholder="e.g. Euploid Fetus, No Aneuploidy Detected"
                        className="input"
                        value={form.finalGeneticDiagnosis || ''}
                        onChange={(e) => setForm({ ...form, finalGeneticDiagnosis: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* COUNSELING NOTES & PATIENT DECISION */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.8rem' }}>
                <div>
                  <label className="label small">Patient Clinical Decision</label>
                  <select
                    className="input"
                    value={form.patientDecision || 'routine_care'}
                    onChange={(e) => setForm({ ...form, patientDecision: e.target.value as any })}
                  >
                    <option value="routine_care">Routine antenatal care &amp; 18–20w Anomaly Scan</option>
                    <option value="opt_for_nipt">Opt for secondary Cell-Free DNA (NIPT)</option>
                    <option value="opt_for_invasive_diagnostic">Opt for diagnostic testing (CVS / Amniocentesis)</option>
                    <option value="declined_further_testing">Declined further screening or invasive testing</option>
                    <option value="undecided">Couple undecided (Review after counseling)</option>
                  </select>
                </div>
                <div>
                  <label className="label small">Genetic Counseling Discussion &amp; Notes</label>
                  <textarea
                    rows={2}
                    className="input"
                    value={form.counselingNotes || ''}
                    onChange={(e) => setForm({ ...form, counselingNotes: e.target.value })}
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div className="row" style={{ justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button type="button" className="btn" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? 'Saving Genetic Record…' : editingId ? 'Update Record' : 'Save Screening Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
