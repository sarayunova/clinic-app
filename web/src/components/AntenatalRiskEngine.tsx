import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type AntenatalRiskAssessment,
  type RiskAssessmentListResponse,
  type PatientRiskSummary,
} from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, Field, todayLocal } from './ui';
import {
  PE_FACTORS,
  VTE_FACTORS,
  GDM_FACTORS,
  PTB_FACTORS,
  evaluatePreEclampsiaRisk,
  evaluateVteRisk,
  evaluateGdmRisk,
  evaluatePtbRisk,
  evaluateOverallRisk,
} from '../antenatalRiskScoring';

interface Props {
  patientId: number;
  patientName: string;
  lastMenstrualPeriod?: string | null;
  dateOfBirth?: string | null;
  gravida?: number | null;
  para?: number | null;
  onChanged?: () => void;
}

export function AntenatalRiskEngine({
  patientId,
  patientName,
  lastMenstrualPeriod,
  dateOfBirth,
  gravida,
  para,
  onChanged,
}: Props) {
  const { can } = useAuth();
  const canEdit = can('patient:write_clinical') || can('care:write_nursing');

  const [assessments, setAssessments] = useState<AntenatalRiskAssessment[] | null>(null);
  const [summary, setSummary] = useState<PatientRiskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [assessmentDate, setAssessmentDate] = useState(todayLocal());
  const [gaWeeks, setGaWeeks] = useState<string>('');
  const [gaDays, setGaDays] = useState<string>('0');

  // PE State
  const [selectedPeFactors, setSelectedPeFactors] = useState<string[]>([]);
  const [peAspirinPrescribed, setPeAspirinPrescribed] = useState(false);
  const [peAspirinDosage, setPeAspirinDosage] = useState('Aspirin 150 mg PO bedtime (12 to 36 weeks)');
  const [peCalciumPrescribed, setPeCalciumPrescribed] = useState(false);

  // VTE State
  const [selectedVteFactors, setSelectedVteFactors] = useState<string[]>([]);
  const [vteLmwhPrescribed, setVteLmwhPrescribed] = useState(false);
  const [vteLmwhDosage, setVteLmwhDosage] = useState('Enoxaparin 40 mg SC once daily');

  // GDM State
  const [selectedGdmFactors, setSelectedGdmFactors] = useState<string[]>([]);
  const [gdmFasting, setGdmFasting] = useState('');
  const [gdm1hr, setGdm1hr] = useState('');
  const [gdm2hr, setGdm2hr] = useState('');
  const [gdmManagementPlan, setGdmManagementPlan] = useState('');

  // PTB State
  const [selectedPtbFactors, setSelectedPtbFactors] = useState<string[]>([]);
  const [ptbProgesteronePrescribed, setPtbProgesteronePrescribed] = useState(false);
  const [ptbCerclageAdvised, setPtbCerclageAdvised] = useState(false);

  // Aggregated Plan State
  const [clinicalActionPlan, setClinicalActionPlan] = useState('');
  const [consultantNotes, setConsultantNotes] = useState('');
  const [nextReviewDate, setNextReviewDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [listRes, sumRes] = await Promise.all([
        api<RiskAssessmentListResponse>('GET', `/api/patients/${patientId}/risk-assessments`),
        api<PatientRiskSummary>('GET', `/api/patients/${patientId}/risk-summary`),
      ]);
      setAssessments(listRes.assessments);
      setSummary(sumRes);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Estimate GA from LMP if available
  useEffect(() => {
    if (lastMenstrualPeriod && !gaWeeks) {
      try {
        const lmp = new Date(`${lastMenstrualPeriod}T00:00:00Z`).getTime();
        const now = new Date(`${assessmentDate}T00:00:00Z`).getTime();
        const diffDays = Math.floor((now - lmp) / 86_400_000);
        if (diffDays >= 0 && diffDays <= 300) {
          setGaWeeks(String(Math.floor(diffDays / 7)));
          setGaDays(String(diffDays % 7));
        }
      } catch {
        // ignore
      }
    }
  }, [lastMenstrualPeriod, assessmentDate, gaWeeks]);

  // Auto-detect patient age and parity factors on init
  const initializeFactors = () => {
    const autoPe: string[] = [];
    const autoVte: string[] = [];
    const autoGdm: string[] = [];

    if (dateOfBirth) {
      const age = new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
      if (age >= 35) {
        autoPe.push('age_ge_35');
        autoVte.push('age_gt_35');
      }
      if (age >= 25) {
        autoGdm.push('maternal_age_ge_25');
      }
    }

    if (para === 0) {
      autoPe.push('nulliparity');
    } else if (para != null && para >= 3) {
      autoVte.push('parity_ge_3');
    }

    setSelectedPeFactors(autoPe);
    setSelectedVteFactors(autoVte);
    setSelectedGdmFactors(autoGdm);
  };

  // Live Evaluations
  const peEval = evaluatePreEclampsiaRisk(selectedPeFactors);
  const vteEval = evaluateVteRisk(selectedVteFactors);
  const gdmEval = evaluateGdmRisk(selectedGdmFactors, {
    fasting: gdmFasting ? Number(gdmFasting) : null,
    oneHour: gdm1hr ? Number(gdm1hr) : null,
    twoHour: gdm2hr ? Number(gdm2hr) : null,
  });
  const ptbEval = evaluatePtbRisk(selectedPtbFactors);
  const overallEval = evaluateOverallRisk(peEval, vteEval, gdmEval, ptbEval);

  // Auto-draft comprehensive action plan
  const handleAutoDraftPlan = () => {
    const lines: string[] = [];
    lines.push(`Overall Stratification: ${overallEval.overallLevel.toUpperCase().replace(/_/g, ' ')}`);

    if (overallEval.reasons.length > 0) {
      lines.push(`Identified Risks:\n- ${overallEval.reasons.join('\n- ')}`);
    }

    if (overallEval.prophylaxisSummary.length > 0) {
      lines.push(`Recommended Prophylaxis Protocols:\n- ${overallEval.prophylaxisSummary.join('\n- ')}`);
    }

    lines.push(
      'Surveillance Plan:\n- Serial BP and spot urine protein check at every visit.\n- Routine fetal anatomy and growth monitoring with Doppler.\n- Counselled on alarm symptoms of severe pre-eclampsia and reduced fetal movements.'
    );

    setClinicalActionPlan(lines.join('\n\n'));
  };

  const resetForm = () => {
    setEditingId(null);
    setAssessmentDate(todayLocal());
    setGaWeeks('');
    setGaDays('0');
    setSelectedPeFactors([]);
    setPeAspirinPrescribed(false);
    setPeCalciumPrescribed(false);
    setSelectedVteFactors([]);
    setVteLmwhPrescribed(false);
    setSelectedGdmFactors([]);
    setGdmFasting('');
    setGdm1hr('');
    setGdm2hr('');
    setGdmManagementPlan('');
    setSelectedPtbFactors([]);
    setPtbProgesteronePrescribed(false);
    setPtbCerclageAdvised(false);
    setClinicalActionPlan('');
    setConsultantNotes('');
    setNextReviewDate('');
    setFormError(null);
  };

  const startEdit = (a: AntenatalRiskAssessment) => {
    setEditingId(a.id);
    setAssessmentDate(a.assessmentDate);
    setGaWeeks(a.gestationalAgeWeeks != null ? String(a.gestationalAgeWeeks) : '');
    setGaDays(a.gestationalAgeDays != null ? String(a.gestationalAgeDays) : '0');
    setSelectedPeFactors(a.peFactors);
    setPeAspirinPrescribed(a.peAspirinPrescribed);
    setPeAspirinDosage(a.peAspirinDosage || 'Aspirin 150 mg PO bedtime (12 to 36 weeks)');
    setPeCalciumPrescribed(a.peCalciumPrescribed);
    setSelectedVteFactors(a.vteFactors);
    setVteLmwhPrescribed(a.vteLmwhPrescribed);
    setVteLmwhDosage(a.vteLmwhDosage || 'Enoxaparin 40 mg SC once daily');
    setSelectedGdmFactors(a.gdmFactors);
    setGdmFasting(a.gdmFastingMgdl != null ? String(a.gdmFastingMgdl) : '');
    setGdm1hr(a.gdm1hrMgdl != null ? String(a.gdm1hrMgdl) : '');
    setGdm2hr(a.gdm2hrMgdl != null ? String(a.gdm2hrMgdl) : '');
    setGdmManagementPlan(a.gdmManagementPlan || '');
    setSelectedPtbFactors(a.ptbFactors);
    setPtbProgesteronePrescribed(a.ptbProgesteronePrescribed);
    setPtbCerclageAdvised(a.ptbCerclageAdvised);
    setClinicalActionPlan(a.clinicalActionPlan || '');
    setConsultantNotes(a.consultantNotes || '');
    setNextReviewDate(a.nextReviewDate || '');
    setShowForm(true);
    setFormError(null);
  };

  const handleSaveAssessment = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setFormError(null);

      const payload = {
        assessmentDate,
        gestationalAgeWeeks: gaWeeks ? Number(gaWeeks) : null,
        gestationalAgeDays: gaDays ? Number(gaDays) : null,

        // PE
        peFactors: selectedPeFactors,
        peRiskLevel: peEval.level,
        peAspirinIndicated: peEval.aspirinIndicated,
        peAspirinPrescribed,
        peAspirinDosage: peEval.aspirinIndicated ? peAspirinDosage : null,
        peCalciumIndicated: peEval.calciumIndicated,
        peCalciumPrescribed,

        // VTE
        vteFactors: selectedVteFactors,
        vteScore: vteEval.score,
        vteRiskLevel: vteEval.level,
        vteProphylaxisRecommended: vteEval.recommendation,
        vteLmwhPrescribed,
        vteLmwhDosage: vteLmwhPrescribed ? vteLmwhDosage : null,

        // GDM
        gdmFactors: selectedGdmFactors,
        gdmRiskLevel: gdmEval.riskLevel,
        gdmScreeningTiming: gdmEval.screeningAdvice,
        gdmDiagnosisStatus: gdmEval.diagnosisStatus,
        gdmFastingMgdl: gdmFasting ? Number(gdmFasting) : null,
        gdm1hrMgdl: gdm1hr ? Number(gdm1hr) : null,
        gdm2hrMgdl: gdm2hr ? Number(gdm2hr) : null,
        gdmManagementPlan: gdmManagementPlan.trim() || null,

        // PTB
        ptbFactors: selectedPtbFactors,
        ptbRiskLevel: ptbEval.riskLevel,
        ptbProgesteroneIndicated: ptbEval.progesteroneIndicated,
        ptbProgesteronePrescribed,
        ptbCerclageAdvised,

        // Overall
        overallRiskLevel: overallEval.overallLevel,
        highRiskReasons: overallEval.reasons.length > 0 ? overallEval.reasons.join('; ') : 'Low Risk / Standard Antenatal Pathway',
        clinicalActionPlan: clinicalActionPlan.trim() || null,
        consultantNotes: consultantNotes.trim() || null,
        nextReviewDate: nextReviewDate || null,
      };

      if (editingId) {
        await api('PATCH', `/api/risk-assessments/${editingId}`, payload);
      } else {
        await api('POST', `/api/patients/${patientId}/risk-assessments`, payload);
      }

      setShowForm(false);
      resetForm();
      await loadData();
      onChanged?.();
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api('DELETE', `/api/risk-assessments/${id}`);
      setConfirmDeleteId(null);
      await loadData();
      onChanged?.();
    } catch (err) {
      alert('Could not delete risk assessment: ' + String(err));
    }
  };

  const toggleFactor = (key: string, list: string[], setter: (v: string[]) => void) => {
    if (list.includes(key)) {
      setter(list.filter((k) => k !== key));
    } else {
      setter([...list, key]);
    }
  };

  return (
    <section className="stack" style={{ gap: '1rem' }}>
      {/* Active High-Risk Stratification Summary Banner */}
      {summary?.hasAssessment && (
        <div
          className="card"
          style={{
            borderLeft: `5px solid ${
              summary.overallRiskLevel === 'high_risk'
                ? '#dc2626'
                : summary.overallRiskLevel === 'moderate_risk'
                ? '#d97706'
                : '#16a34a'
            }`,
            background:
              summary.overallRiskLevel === 'high_risk'
                ? '#fef2f2'
                : summary.overallRiskLevel === 'moderate_risk'
                ? '#fffbeb'
                : '#f0fdf4',
            padding: '0.9rem 1.1rem',
            borderRadius: '6px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="row wrap" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '1.2rem' }}>
                  {summary.overallRiskLevel === 'high_risk' ? '⚠️' : summary.overallRiskLevel === 'moderate_risk' ? '⚡' : '✅'}
                </span>
                <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                  {summary.overallRiskLevel === 'high_risk'
                    ? 'HIGH-RISK PREGNANCY'
                    : summary.overallRiskLevel === 'moderate_risk'
                    ? 'MODERATE-RISK PREGNANCY'
                    : 'LOW-RISK PREGNANCY (Standard Antenatal Pathway)'}
                </strong>
                {summary.latestAssessment?.gestationalAgeWeeks != null && (
                  <span className="badge small">
                    GA: {summary.latestAssessment.gestationalAgeWeeks}w {summary.latestAssessment.gestationalAgeDays ?? 0}d
                  </span>
                )}
                <span className="muted small">
                  Assessed on {summary.latestAssessment?.assessmentDate}
                </span>
              </div>

              {summary.activeAlerts.length > 0 && (
                <div className="row wrap" style={{ gap: '0.4rem', marginTop: '0.4rem' }}>
                  {summary.activeAlerts.map((alert, i) => (
                    <span
                      key={i}
                      style={{
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        border: '1px solid #f87171',
                      }}
                    >
                      {alert}
                    </span>
                  ))}
                </div>
              )}

              {summary.prophylaxisPrescribed.length > 0 && (
                <div style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: '#166534' }}>
                  <strong>Active Prophylaxis Prescribed: </strong>
                  {summary.prophylaxisPrescribed.join(' · ')}
                </div>
              )}
            </div>

            <div className="row" style={{ gap: '0.5rem' }}>
              {summary.latestAssessment && (
                <Link
                  to={`/risk-assessments/${summary.latestAssessment.id}/print`}
                  className="btn small"
                  title="Print formal high-risk protocol"
                >
                  🖨️ Print Protocol
                </Link>
              )}
              {canEdit && !showForm && (
                <button
                  type="button"
                  className="btn small primary"
                  onClick={() => {
                    resetForm();
                    initializeFactors();
                    setShowForm(true);
                  }}
                >
                  + New Risk Re-assessment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header bar when no assessment exists */}
      {!summary?.hasAssessment && !showForm && (
        <div
          className="row wrap"
          style={{
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg)',
            padding: '0.8rem 1rem',
            borderRadius: '6px',
            border: '1px solid var(--border)',
          }}
        >
          <div>
            <strong style={{ fontSize: '1rem' }}>Antenatal Clinical Risk Stratification</strong>
            <div className="muted small">
              ACOG / NICE Pre-eclampsia &amp; Aspirin Prophylaxis · RCOG VTE Thromboprophylaxis · DIPSI GDM Screening
            </div>
          </div>
          {canEdit && (
            <button
              type="button"
              className="btn small primary"
              onClick={() => {
                resetForm();
                initializeFactors();
                setShowForm(true);
              }}
            >
              + Record Baseline Risk Assessment
            </button>
          )}
        </div>
      )}

      {/* Interactive Risk Assessment Form */}
      {showForm && canEdit && (
        <form
          onSubmit={handleSaveAssessment}
          className="card stack"
          style={{
            border: '2px solid #0284c7',
            padding: '1.2rem',
            borderRadius: '8px',
            background: '#ffffff',
            gap: '1.2rem',
          }}
        >
          <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0369a1' }}>
              {editingId ? '✏️ Edit Antenatal Risk Assessment' : '📋 Antenatal High-Risk Assessment & Scoring Engine'}
            </h3>
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '4px',
                backgroundColor:
                  overallEval.overallLevel === 'high_risk'
                    ? '#fee2e2'
                    : overallEval.overallLevel === 'moderate_risk'
                    ? '#fef3c7'
                    : '#dcfce7',
                color:
                  overallEval.overallLevel === 'high_risk'
                    ? '#991b1b'
                    : overallEval.overallLevel === 'moderate_risk'
                    ? '#92400e'
                    : '#166534',
              }}
            >
              Live Stratification: {overallEval.overallLevel.toUpperCase().replace(/_/g, ' ')}
            </span>
          </div>

          {formError ? <ErrorBanner error={formError} /> : null}

          {/* Assessment Date and GA */}
          <div className="row wrap" style={{ gap: '1rem', background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
            <Field label="Assessment Date *">
              <input
                type="date"
                required
                value={assessmentDate}
                onChange={(e) => setAssessmentDate(e.target.value)}
              />
            </Field>

            <Field label="Gestation Weeks">
              <input
                type="number"
                min={0}
                max={44}
                value={gaWeeks}
                placeholder="e.g. 12"
                onChange={(e) => setGaWeeks(e.target.value)}
                style={{ width: '90px' }}
              />
            </Field>

            <Field label="+ Days">
              <input
                type="number"
                min={0}
                max={6}
                value={gaDays}
                placeholder="e.g. 3"
                onChange={(e) => setGaDays(e.target.value)}
                style={{ width: '70px' }}
              />
            </Field>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
              <button
                type="button"
                className="btn small"
                onClick={handleAutoDraftPlan}
                title="Synthesize risk findings into clinical plan"
              >
                ✨ Auto-Draft Action Plan
              </button>
            </div>
          </div>

          {/* Section 1: Pre-eclampsia (PE) Risk Stratification */}
          <fieldset
            style={{
              border: '1.5px solid #cbd5e1',
              borderRadius: '6px',
              padding: '0.8rem 1rem',
              background: peEval.level === 'high' ? '#fffbfb' : '#ffffff',
            }}
          >
            <legend style={{ fontWeight: 700, padding: '0 0.5rem', color: '#0f172a' }}>
              1. Pre-eclampsia Risk Stratification &amp; Aspirin Prophylaxis (NICE / ACOG)
            </legend>

            <div className="stack" style={{ gap: '0.6rem' }}>
              {/* High Risk Factors (1 factor = High Risk) */}
              <div>
                <strong style={{ fontSize: '0.85rem', color: '#991b1b' }}>
                  High-Risk Criteria (Any 1 factor indicates Aspirin):
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.4rem', marginTop: '0.3rem' }}>
                  {PE_FACTORS.filter((f) => f.category === 'high').map((f) => (
                    <label key={f.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedPeFactors.includes(f.key)}
                        onChange={() => toggleFactor(f.key, selectedPeFactors, setSelectedPeFactors)}
                        style={{ marginTop: '2px' }}
                      />
                      <span>
                        <strong>{f.label}</strong>
                        <div className="muted small" style={{ fontSize: '0.74rem' }}>{f.description}</div>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Moderate Risk Factors (2 factors = High Risk) */}
              <div style={{ marginTop: '0.4rem', borderTop: '1px dashed #e2e8f0', paddingTop: '0.4rem' }}>
                <strong style={{ fontSize: '0.85rem', color: '#92400e' }}>
                  Moderate-Risk Criteria (≥2 factors indicate Aspirin):
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.4rem', marginTop: '0.3rem' }}>
                  {PE_FACTORS.filter((f) => f.category === 'moderate').map((f) => (
                    <label key={f.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedPeFactors.includes(f.key)}
                        onChange={() => toggleFactor(f.key, selectedPeFactors, setSelectedPeFactors)}
                        style={{ marginTop: '2px' }}
                      />
                      <span>
                        <strong>{f.label}</strong>
                        <div className="muted small" style={{ fontSize: '0.74rem' }}>{f.description}</div>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Live PE Guidance Box */}
              <div
                style={{
                  background: peEval.level === 'high' ? '#fee2e2' : peEval.level === 'moderate' ? '#fef3c7' : '#f0fdf4',
                  border: `1px solid ${peEval.level === 'high' ? '#f87171' : peEval.level === 'moderate' ? '#fbbf24' : '#86efac'}`,
                  borderRadius: '4px',
                  padding: '0.5rem 0.8rem',
                  fontSize: '0.84rem',
                  lineHeight: 1.4,
                  marginTop: '0.4rem',
                }}
              >
                <strong>Evaluation: </strong>
                {peEval.rationale}
                {peEval.aspirinIndicated && (
                  <div style={{ color: '#0369a1', fontWeight: 600, marginTop: '2px' }}>
                    💊 Guideline Recommendation: {peEval.dosageAdvice}
                  </div>
                )}
              </div>

              {/* Prescription Checkboxes */}
              {peEval.aspirinIndicated && (
                <div className="row wrap" style={{ gap: '1rem', alignItems: 'center', background: '#f8fafc', padding: '0.5rem 0.8rem', borderRadius: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={peAspirinPrescribed}
                      onChange={(e) => setPeAspirinPrescribed(e.target.checked)}
                    />
                    <strong>Aspirin Prescribed</strong>
                  </label>

                  <input
                    value={peAspirinDosage}
                    onChange={(e) => setPeAspirinDosage(e.target.value)}
                    placeholder="Dosage & Instructions"
                    style={{ flex: 1, minWidth: '220px', fontSize: '0.82rem' }}
                  />

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={peCalciumPrescribed}
                      onChange={(e) => setPeCalciumPrescribed(e.target.checked)}
                    />
                    <span>Calcium 1–1.5g/day</span>
                  </label>
                </div>
              )}
            </div>
          </fieldset>

          {/* Section 2: VTE Thromboprophylaxis (RCOG Green-top 37a) */}
          <fieldset
            style={{
              border: '1.5px solid #cbd5e1',
              borderRadius: '6px',
              padding: '0.8rem 1rem',
              background: vteEval.score >= 3 ? '#fffbfb' : '#ffffff',
            }}
          >
            <legend style={{ fontWeight: 700, padding: '0 0.5rem', color: '#0f172a' }}>
              2. Obstetric VTE Risk Scoring &amp; Thromboprophylaxis (RCOG 37a)
            </legend>

            <div className="stack" style={{ gap: '0.6rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.4rem' }}>
                {VTE_FACTORS.map((f) => (
                  <label key={f.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedVteFactors.includes(f.key)}
                      onChange={() => toggleFactor(f.key, selectedVteFactors, setSelectedVteFactors)}
                      style={{ marginTop: '2px' }}
                    />
                    <span>
                      <strong>{f.label}</strong>
                      <span
                        style={{
                          marginLeft: '4px',
                          fontWeight: 700,
                          fontSize: '0.74rem',
                          color: f.points >= 3 ? '#b91c1c' : '#0369a1',
                        }}
                      >
                        (+{f.points})
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              {/* Live VTE Guidance */}
              <div
                style={{
                  background: vteEval.score >= 3 ? '#fee2e2' : vteEval.score === 2 ? '#fef3c7' : '#f0fdf4',
                  border: `1px solid ${vteEval.score >= 3 ? '#f87171' : vteEval.score === 2 ? '#fbbf24' : '#86efac'}`,
                  borderRadius: '4px',
                  padding: '0.5rem 0.8rem',
                  fontSize: '0.84rem',
                  lineHeight: 1.4,
                  marginTop: '0.4rem',
                }}
              >
                <strong>VTE Total Score: {vteEval.score}</strong> — {vteEval.recommendation}
              </div>

              {vteEval.score >= 3 && (
                <div className="row wrap" style={{ gap: '1rem', alignItems: 'center', background: '#f8fafc', padding: '0.5rem 0.8rem', borderRadius: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={vteLmwhPrescribed}
                      onChange={(e) => setVteLmwhPrescribed(e.target.checked)}
                    />
                    <strong>LMWH Thromboprophylaxis Prescribed</strong>
                  </label>

                  <input
                    value={vteLmwhDosage}
                    onChange={(e) => setVteLmwhDosage(e.target.value)}
                    placeholder="e.g. Enoxaparin 40 mg SC once daily"
                    style={{ flex: 1, minWidth: '220px', fontSize: '0.82rem' }}
                  />
                </div>
              )}
            </div>
          </fieldset>

          {/* Section 3: Gestational Diabetes Mellitus (DIPSI / FIGO) */}
          <fieldset
            style={{
              border: '1.5px solid #cbd5e1',
              borderRadius: '6px',
              padding: '0.8rem 1rem',
              background: '#ffffff',
            }}
          >
            <legend style={{ fontWeight: 700, padding: '0 0.5rem', color: '#0f172a' }}>
              3. Gestational Diabetes Mellitus (GDM) Stratification &amp; OGTT
            </legend>

            <div className="stack" style={{ gap: '0.6rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.4rem' }}>
                {GDM_FACTORS.map((f) => (
                  <label key={f.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedGdmFactors.includes(f.key)}
                      onChange={() => toggleFactor(f.key, selectedGdmFactors, setSelectedGdmFactors)}
                      style={{ marginTop: '2px' }}
                    />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>

              {/* Plasma Glucose Entry */}
              <div className="row wrap" style={{ gap: '0.8rem', background: '#f8fafc', padding: '0.5rem 0.8rem', borderRadius: '4px', alignItems: 'flex-end' }}>
                <Field label="Fasting (mg/dL) [≥92]">
                  <input
                    type="number"
                    step="0.1"
                    value={gdmFasting}
                    placeholder="e.g. 88"
                    onChange={(e) => setGdmFasting(e.target.value)}
                    style={{ width: '100px' }}
                  />
                </Field>

                <Field label="1-Hour (mg/dL) [≥180]">
                  <input
                    type="number"
                    step="0.1"
                    value={gdm1hr}
                    placeholder="e.g. 154"
                    onChange={(e) => setGdm1hr(e.target.value)}
                    style={{ width: '100px' }}
                  />
                </Field>

                <Field label="2-Hour / DIPSI (mg/dL) [≥140]">
                  <input
                    type="number"
                    step="0.1"
                    value={gdm2hr}
                    placeholder="e.g. 128"
                    onChange={(e) => setGdm2hr(e.target.value)}
                    style={{ width: '100px' }}
                  />
                </Field>

                <Field label="Management / Nutrition Plan">
                  <input
                    value={gdmManagementPlan}
                    placeholder="e.g. Medical Nutrition Therapy (MNT)"
                    onChange={(e) => setGdmManagementPlan(e.target.value)}
                    style={{ minWidth: '220px' }}
                  />
                </Field>
              </div>

              {/* Live GDM Guidance */}
              <div
                style={{
                  background: gdmEval.diagnosisStatus === 'gdm_confirmed' ? '#fee2e2' : gdmEval.riskLevel === 'high' ? '#fef3c7' : '#f0fdf4',
                  border: `1px solid ${gdmEval.diagnosisStatus === 'gdm_confirmed' ? '#f87171' : gdmEval.riskLevel === 'high' ? '#fbbf24' : '#86efac'}`,
                  borderRadius: '4px',
                  padding: '0.5rem 0.8rem',
                  fontSize: '0.84rem',
                  lineHeight: 1.4,
                }}
              >
                <div><strong>Screening Protocol: </strong>{gdmEval.screeningAdvice}</div>
                {gdmEval.diagnosisDetail && (
                  <div style={{ marginTop: '2px', fontWeight: 600 }}>{gdmEval.diagnosisDetail}</div>
                )}
              </div>
            </div>
          </fieldset>

          {/* Section 4: Preterm Birth & Cervical Surveillance */}
          <fieldset
            style={{
              border: '1.5px solid #cbd5e1',
              borderRadius: '6px',
              padding: '0.8rem 1rem',
              background: '#ffffff',
            }}
          >
            <legend style={{ fontWeight: 700, padding: '0 0.5rem', color: '#0f172a' }}>
              4. Preterm Birth (PTB) &amp; Cervical Insufficiency Risk
            </legend>

            <div className="stack" style={{ gap: '0.6rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.4rem' }}>
                {PTB_FACTORS.map((f) => (
                  <label key={f.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedPtbFactors.includes(f.key)}
                      onChange={() => toggleFactor(f.key, selectedPtbFactors, setSelectedPtbFactors)}
                      style={{ marginTop: '2px' }}
                    />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>

              {/* Live PTB Guidance */}
              <div
                style={{
                  background: ptbEval.riskLevel === 'high' ? '#fee2e2' : '#f0fdf4',
                  border: `1px solid ${ptbEval.riskLevel === 'high' ? '#f87171' : '#86efac'}`,
                  borderRadius: '4px',
                  padding: '0.5rem 0.8rem',
                  fontSize: '0.84rem',
                  lineHeight: 1.4,
                }}
              >
                {ptbEval.surveillancePlan}
              </div>

              {ptbEval.riskLevel === 'high' && (
                <div className="row wrap" style={{ gap: '1rem', alignItems: 'center', background: '#f8fafc', padding: '0.5rem 0.8rem', borderRadius: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={ptbProgesteronePrescribed}
                      onChange={(e) => setPtbProgesteronePrescribed(e.target.checked)}
                    />
                    <strong>Vaginal Progesterone Prescribed (200mg nightly)</strong>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={ptbCerclageAdvised}
                      onChange={(e) => setPtbCerclageAdvised(e.target.checked)}
                    />
                    <span>Cervical Cerclage Consultation Planned</span>
                  </label>
                </div>
              )}
            </div>
          </fieldset>

          {/* Section 5: Clinical Action Plan & Orders */}
          <div className="stack" style={{ gap: '0.6rem' }}>
            <label htmlFor="risk-action-plan" style={{ fontWeight: 600 }}>
              Clinical Action Plan &amp; Surveillance Orders: *
            </label>
            <textarea
              id="risk-action-plan"
              rows={4}
              required
              value={clinicalActionPlan}
              placeholder="e.g. Initiated Aspirin 150mg nightly. Scheduled serial growth scan and Doppler at 20w. Early OGTT ordered."
              onChange={(e) => setClinicalActionPlan(e.target.value)}
            />

            <div className="grid-2" style={{ gap: '0.8rem' }}>
              <Field label="Consultant / Specialist Notes">
                <input
                  value={consultantNotes}
                  placeholder="Additional instructions or referral details"
                  onChange={(e) => setConsultantNotes(e.target.value)}
                />
              </Field>

              <Field label="Next High-Risk Review Date">
                <input
                  type="date"
                  value={nextReviewDate}
                  onChange={(e) => setNextReviewDate(e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* Action buttons */}
          <div className="row wrap" style={{ gap: '0.6rem', marginTop: '0.5rem' }}>
            <button className="btn primary" disabled={saving}>
              {saving ? 'Saving Assessment…' : editingId ? 'Update Risk Assessment' : 'Save Risk Assessment'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Prior Assessments Listing */}
      {loading && !assessments && <p className="muted">Loading antenatal risk assessments…</p>}

      {assessments && assessments.length > 0 && !showForm && (
        <div className="stack" style={{ gap: '0.6rem' }}>
          <h4 style={{ margin: '0.4rem 0 0.2rem 0', fontSize: '0.95rem', color: '#334155' }}>
            Antenatal Risk Assessment History ({assessments.length})
          </h4>

          <ul className="cards" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {assessments.map((a) => (
              <li
                key={a.id}
                className="card stack"
                style={{
                  borderLeft: `4px solid ${
                    a.overallRiskLevel === 'high_risk'
                      ? '#dc2626'
                      : a.overallRiskLevel === 'moderate_risk'
                      ? '#d97706'
                      : '#16a34a'
                  }`,
                  padding: '0.8rem 1rem',
                  gap: '0.5rem',
                }}
              >
                <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="row wrap" style={{ gap: '0.5rem', alignItems: 'center' }}>
                      <strong style={{ fontSize: '1.05rem' }}>{a.assessmentDate}</strong>
                      <span
                        className={`badge ${
                          a.overallRiskLevel === 'high_risk'
                            ? 'danger'
                            : a.overallRiskLevel === 'moderate_risk'
                            ? 'info'
                            : 'ok'
                        }`}
                      >
                        {a.overallRiskLevel.toUpperCase().replace(/_/g, ' ')}
                      </span>
                      {a.gestationalAgeWeeks != null && (
                        <span className="badge small">
                          GA: {a.gestationalAgeWeeks}w {a.gestationalAgeDays ?? 0}d
                        </span>
                      )}
                    </div>

                    <div className="muted small" style={{ marginTop: '0.2rem' }}>
                      Assessed by {a.assessedByName || 'Staff'} · Record #{a.id}
                    </div>
                  </div>

                  <div className="row" style={{ gap: '0.4rem', alignItems: 'center' }}>
                    <Link
                      to={`/risk-assessments/${a.id}/print`}
                      className="btn small"
                      title="Open printable formal risk protocol"
                    >
                      🖨️ Print Protocol
                    </Link>

                    {canEdit && (
                      <>
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => startEdit(a)}
                        >
                          ✏️ Edit
                        </button>

                        {confirmDeleteId === a.id ? (
                          <button
                            type="button"
                            className="btn small danger"
                            onClick={() => void handleDelete(a.id)}
                          >
                            Confirm Delete
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn small muted"
                            onClick={() => setConfirmDeleteId(a.id)}
                            title="Delete assessment"
                          >
                            🗑️
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Risk Reasons & Prophylaxis summary */}
                {a.highRiskReasons && (
                  <div style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                    <strong>Risk Rationale: </strong>{a.highRiskReasons}
                  </div>
                )}

                <div className="row wrap" style={{ gap: '0.8rem', fontSize: '0.8rem' }}>
                  <span>
                    PE: <strong>{a.peRiskLevel.toUpperCase()}</strong>{' '}
                    {a.peAspirinPrescribed ? '💊 Aspirin Rx' : a.peAspirinIndicated ? '⚠️ Aspirin Indicated' : ''}
                  </span>
                  <span>
                    VTE Score: <strong>{a.vteScore}</strong>{' '}
                    {a.vteLmwhPrescribed ? '💉 LMWH Rx' : a.vteScore >= 3 ? '⚠️ LMWH Indicated' : ''}
                  </span>
                  <span>
                    GDM: <strong>{a.gdmDiagnosisStatus === 'gdm_confirmed' ? '⚠️ GDM Confirmed' : a.gdmRiskLevel.toUpperCase()}</strong>
                  </span>
                  {a.ptbRiskLevel === 'high' && <span>PTB: <strong>⚠️ High Risk</strong></span>}
                </div>

                {/* Action Plan */}
                {a.clinicalActionPlan && (
                  <div
                    style={{
                      background: 'var(--bg)',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '4px',
                      fontSize: '0.84rem',
                      lineHeight: 1.4,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    <strong>Action Plan: </strong>{a.clinicalActionPlan}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
