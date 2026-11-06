import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type Patient,
  type AntenatalMedicationExposure,
  type MedicationExposuresResponse,
  type VisitSummary,
} from '../api';
import {
  PREGNANCY_MEDICATION_DATABASE,
  findMedicationSafetyRule,
  evaluatePrescriptionSafety,
  getRiskBadgeStyle,
  type FdaPregnancyCategory,
  type MedicationRiskLevel,
} from '../pregnancyMedicationSafety';
import { calculateGestationalAge, calculateEdd } from '../pregnancyCalc';
import { ErrorBanner } from './ui';

interface Props {
  patient: Patient;
  visits?: VisitSummary[] | null;
}

export function MedicationSafetyChecker({ patient, visits }: Props) {
  const patientId = Number(patient.id);
  const lmp = typeof patient.lastMenstrualPeriod === 'string' ? patient.lastMenstrualPeriod : null;
  const currentGa = calculateGestationalAge(lmp);
  const edd = calculateEdd(lmp);

  const [exposures, setExposures] = useState<AntenatalMedicationExposure[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  // Search query for interactive drug safety lookup
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResult, setSearchResult] = useState<ReturnType<typeof evaluatePrescriptionSafety> | null>(null);

  // Modal: Log Teratogenic Exposure
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [modalMedName, setModalMedName] = useState<string>('');
  const [modalGenericName, setModalGenericName] = useState<string>('');
  const [modalFdaCategory, setModalFdaCategory] = useState<FdaPregnancyCategory>('D');
  const [modalRiskLevel, setModalRiskLevel] = useState<MedicationRiskLevel>('contraindicated');
  const [modalTrimester, setModalTrimester] = useState<'preconception' | 't1_organogenesis' | 't2' | 't3' | 'multiple_unknown'>('t1_organogenesis');
  const [modalGaWeeks, setModalGaWeeks] = useState<number>(currentGa ? currentGa.weeks : 8);
  const [modalGaDays, setModalGaDays] = useState<number>(currentGa ? currentGa.days : 0);
  const [modalStartDate, setModalStartDate] = useState<string>('');
  const [modalEndDate, setModalEndDate] = useState<string>('');
  const [modalDose, setModalDose] = useState<string>('');
  const [modalRiskSummary, setModalRiskSummary] = useState<string>('');
  const [modalMechanism, setModalMechanism] = useState<string>('');
  const [modalAnomalyScan, setModalAnomalyScan] = useState<boolean>(true);
  const [modalFetalEcho, setModalFetalEcho] = useState<boolean>(false);
  const [modalCounselingNotes, setModalCounselingNotes] = useState<string>('');
  const [modalActionPlan, setModalActionPlan] = useState<string>('');
  const [savingExposure, setSavingExposure] = useState<boolean>(false);
  const [exposureError, setExposureError] = useState<unknown>(null);

  const loadExposures = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api<MedicationExposuresResponse>('GET', `/api/patients/${patientId}/medication-exposures`);
      setExposures(res.exposures || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExposures();
  }, [patientId]);

  // Handle drug lookup query
  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (!q || q.trim().length < 2) {
      setSearchResult(null);
      return;
    }
    const evalRes = evaluatePrescriptionSafety(q, currentGa?.weeks ?? null);
    setSearchResult(evalRes);
  };

  // When medicine name changes in add modal, auto-populate known risk data
  const handleModalMedNameChange = (name: string) => {
    setModalMedName(name);
    const matched = findMedicationSafetyRule(name);
    if (matched) {
      setModalGenericName(matched.genericName);
      setModalFdaCategory(matched.fdaCategory);
      setModalRiskLevel(matched.defaultRiskLevel);
      setModalRiskSummary(matched.fetalRisks);
      setModalMechanism(matched.mechanism);
      if (matched.defaultRiskLevel === 'contraindicated' || matched.defaultRiskLevel === 'high_risk') {
        setModalAnomalyScan(true);
        if (matched.id === 'valproate' || matched.id === 'ace-inhibitors-arbs' || matched.id === 'carbamazepine-phenytoin') {
          setModalFetalEcho(true);
        }
      }
    }
  };

  const handleSaveExposure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalMedName.trim() || !modalRiskSummary.trim()) {
      alert('Please fill in the required medication name and fetal risk summary.');
      return;
    }

    try {
      setSavingExposure(true);
      setExposureError(null);
      await api('POST', `/api/patients/${patientId}/medication-exposures`, {
        medicineName: modalMedName.trim(),
        genericName: modalGenericName.trim() || null,
        fdaCategory: modalFdaCategory,
        riskLevel: modalRiskLevel,
        trimesterExposure: modalTrimester,
        gestationalAgeWeeks: modalGaWeeks,
        gestationalAgeDays: modalGaDays,
        exposureStartDate: modalStartDate || null,
        exposureEndDate: modalEndDate || null,
        exposureDose: modalDose.trim() || null,
        fetalRiskSummary: modalRiskSummary.trim(),
        teratogenicMechanism: modalMechanism.trim() || null,
        anomalyScanIndicated: modalAnomalyScan,
        fetalEchoIndicated: modalFetalEcho,
        counselingNotes: modalCounselingNotes.trim() || null,
        actionPlan: modalActionPlan.trim() || null,
      });

      setShowAddModal(false);
      resetModalForm();
      await loadExposures();
    } catch (err) {
      setExposureError(err);
    } finally {
      setSavingExposure(false);
    }
  };

  const resetModalForm = () => {
    setModalMedName('');
    setModalGenericName('');
    setModalFdaCategory('D');
    setModalRiskLevel('contraindicated');
    setModalTrimester('t1_organogenesis');
    setModalRiskSummary('');
    setModalMechanism('');
    setModalAnomalyScan(true);
    setModalFetalEcho(false);
    setModalCounselingNotes('');
    setModalActionPlan('');
  };

  const handleDeleteExposure = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this medication exposure entry?')) return;
    try {
      await api('DELETE', `/api/medication-exposures/${id}`);
      await loadExposures();
    } catch (err) {
      alert('Failed to delete exposure record: ' + ((err as Error).message || String(err)));
    }
  };

  // Extract all distinct medications from previous visits
  const visitPrescriptions = useMemo(() => {
    if (!visits || visits.length === 0) return [];
    const list: { medicine: string; visitDate: string; evaluation: ReturnType<typeof evaluatePrescriptionSafety> }[] = [];
    for (const v of visits) {
      const rxItems = (v as any).prescriptionItems || [];
      for (const item of rxItems) {
        if (item.medicine && !list.some((existing) => existing.medicine.toLowerCase() === item.medicine.toLowerCase())) {
          list.push({
            medicine: item.medicine,
            visitDate: v.visitDate || '',
            evaluation: evaluatePrescriptionSafety(item.medicine, currentGa?.weeks ?? null),
          });
        }
      }
    }
    return list;
  }, [visits, currentGa?.weeks]);

  return (
    <div className="medication-safety-checker stack" style={{ marginTop: '0.75rem', gap: '1rem' }}>
      {/* Top Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)',
          border: '1.5px solid #f97316',
          padding: '1rem 1.25rem',
          borderRadius: '8px',
        }}
      >
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem' }}>
          <div>
            <div className="row wrap" style={{ gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '1.4rem' }}>💊</span>
              <h3 style={{ margin: 0, color: '#0f172a' }}>Antenatal Medication Safety &amp; Teratogenic Exposure Suite</h3>
              {currentGa && (
                <span className="badge info" style={{ fontWeight: 'bold' }}>
                  GA: {currentGa.formatted}
                </span>
              )}
              {edd && (
                <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>
                  EDD: {edd}
                </span>
              )}
            </div>
            <div className="muted small" style={{ marginTop: '0.3rem' }}>
              Trimester-specific teratogenicity evaluation (FDA Categories A, B, C, D, X), lactation safety, safe alternatives, and fetal surveillance registry.
            </div>
          </div>

          <div className="row wrap" style={{ gap: '0.5rem' }}>
            <Link
              to={`/medication-exposures/${patientId}/print`}
              target="_blank"
              className="btn small"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' }}
            >
              🖨️ Printable Exposure Summary
            </Link>
            <button
              type="button"
              className="btn small primary"
              onClick={() => {
                resetModalForm();
                setShowAddModal(true);
              }}
              style={{ fontWeight: 'bold' }}
            >
              ➕ Log Teratogenic Exposure
            </button>
          </div>
        </div>
      </div>

      {Boolean(error) && <ErrorBanner error={error} />}

      {/* Interactive Drug Safety Lookup Bar */}
      <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff' }}>
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <strong style={{ fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>🔍</span> Rapid Pregnancy &amp; Lactation Drug Safety Lookup
          </strong>
          <span className="muted small">Type any generic or brand name to inspect trimester-specific hazards and alternatives</span>
        </div>

        <div className="row" style={{ gap: '0.5rem', marginBottom: '0.8rem' }}>
          <input
            type="text"
            className="input"
            placeholder="Search drug (e.g. Ibuprofen, Telmisartan, Brufen, Atorvastatin, Valproate, Doxycycline, Augmentin)..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ fontSize: '0.95rem' }}
          />
          {searchQuery && (
            <button type="button" className="btn small" onClick={() => handleSearch('')}>
              Clear
            </button>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="row wrap" style={{ gap: '0.35rem', marginBottom: searchResult ? '0.8rem' : 0 }}>
          <span className="muted small" style={{ alignSelf: 'center', marginRight: '0.2rem' }}>Quick test:</span>
          {['Telmisartan', 'Ibuprofen (NSAID)', 'Atorvastatin', 'Valproate', 'Doxycycline', 'Paracetamol', 'Augmentin', 'Labetalol'].map((name) => (
            <button
              key={name}
              type="button"
              className="btn small"
              onClick={() => handleSearch(name)}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#f8fafc', border: '1px solid #cbd5e1' }}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Evaluated Search Result Card */}
        {searchResult && (
          <div
            style={{
              marginTop: '0.8rem',
              borderRadius: '8px',
              padding: '0.9rem',
              ...getRiskBadgeStyle(searchResult.evaluatedRiskLevel),
            }}
          >
            <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <div className="row wrap" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <strong style={{ fontSize: '1.05rem' }}>{searchResult.medicineName}</strong>
                {searchResult.matchedRule && (
                  <span className="muted small">({searchResult.matchedRule.drugClass})</span>
                )}
              </div>
              <div className="row" style={{ gap: '0.4rem' }}>
                <span className="badge" style={{ fontWeight: 'bold' }}>
                  FDA Cat: {searchResult.fdaCategory}
                </span>
                <span className="badge" style={{ fontWeight: 'bold', background: '#0f172a', color: '#ffffff' }}>
                  {searchResult.severityTitle}
                </span>
              </div>
            </div>

            <p style={{ margin: '0.3rem 0', fontSize: '0.88rem', fontWeight: '500' }}>
              {searchResult.warningSummary}
            </p>

            {searchResult.ruleFound && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.6rem', marginTop: '0.6rem', fontSize: '0.82rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.7)', padding: '0.5rem', borderRadius: '4px' }}>
                  <strong>Teratogenic Mechanism:</strong>
                  <div style={{ marginTop: '0.2rem' }}>{searchResult.mechanism}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.7)', padding: '0.5rem', borderRadius: '4px' }}>
                  <strong>Documented Fetal Risks:</strong>
                  <div style={{ marginTop: '0.2rem' }}>{searchResult.fetalRisks}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.7)', padding: '0.5rem', borderRadius: '4px' }}>
                  <strong>Lactation / Breastfeeding Safety:</strong>
                  <div style={{ marginTop: '0.2rem' }}>
                    <span className={`badge ${searchResult.lactationSafety === 'compatible' ? 'ok' : searchResult.lactationSafety === 'caution' ? 'warn' : 'err'}`} style={{ fontSize: '0.7rem' }}>
                      {searchResult.lactationSafety.toUpperCase()}
                    </span>{' '}
                    {searchResult.lactationAdvice}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.7)', padding: '0.5rem', borderRadius: '4px' }}>
                  <strong>Safe Obstetric Alternatives:</strong>
                  <div style={{ marginTop: '0.2rem', color: '#166534', fontWeight: '500' }}>
                    {searchResult.suggestedAlternatives.length > 0 ? searchResult.suggestedAlternatives.join(', ') : 'None listed'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Teratogenic Exposure & Fetal Surveillance Registry */}
      <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff' }}>
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <div>
            <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
              🛡️ Maternal Teratogenic Exposure Registry &amp; Fetal Surveillance Plan
            </strong>
            <div className="muted small">
              Documentation of accidental or therapeutic maternal drug exposures, parental counseling, and targeted ultrasound protocols
            </div>
          </div>
          <button
            type="button"
            className="btn small primary"
            onClick={() => {
              resetModalForm();
              setShowAddModal(true);
            }}
          >
            ➕ Log Exposure Event
          </button>
        </div>

        {loading ? (
          <p className="muted small">Loading exposure records...</p>
        ) : exposures.length === 0 ? (
          <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '6px', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
            <span style={{ fontSize: '1.5rem' }}>🛡️</span>
            <div style={{ fontWeight: 'bold', color: '#334155', marginTop: '0.3rem' }}>No Teratogenic Drug Exposures Documented</div>
            <div className="muted small">
              If the patient took medications prior to pregnancy confirmation or requires high-risk pharmacotherapy, log it above to generate a surveillance protocol.
            </div>
          </div>
        ) : (
          <div className="stack" style={{ gap: '0.75rem' }}>
            {exposures.map((exp) => (
              <div
                key={exp.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.85rem',
                  background: '#ffffff',
                  borderLeft: exp.riskLevel === 'contraindicated' ? '4px solid #ef4444' : exp.riskLevel === 'high_risk' ? '4px solid #f97316' : '4px solid #eab308',
                }}
              >
                <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <div className="row wrap" style={{ gap: '0.5rem', alignItems: 'center' }}>
                    <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{exp.medicineName}</strong>
                    {exp.genericName && <span className="muted small">({exp.genericName})</span>}
                    <span className="badge" style={{ fontWeight: 'bold' }}>FDA Cat: {exp.fdaCategory}</span>
                    <span
                      className={`badge ${exp.riskLevel === 'contraindicated' ? 'err' : exp.riskLevel === 'high_risk' ? 'warn' : 'ok'}`}
                      style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}
                    >
                      {exp.riskLevel}
                    </span>
                  </div>

                  <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                    <span className="muted small">
                      Logged by {exp.counseledByName || 'Clinical Staff'} · {exp.createdAt.slice(0, 10)}
                    </span>
                    <button
                      type="button"
                      className="btn small danger"
                      onClick={() => handleDeleteExposure(exp.id)}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                    >
                      ✕ Delete
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                  <div>
                    <span className="muted small">Exposure Timing:</span>
                    <div>
                      <strong>
                        {exp.trimesterExposure === 't1_organogenesis' ? '1st Trimester (Organogenesis)' : exp.trimesterExposure === 'preconception' ? 'Preconception' : exp.trimesterExposure.toUpperCase()}
                      </strong>{' '}
                      {exp.gestationalAgeWeeks != null ? `(${exp.gestationalAgeWeeks}w ${exp.gestationalAgeDays || 0}d)` : ''}
                    </div>
                  </div>
                  <div>
                    <span className="muted small">Dose &amp; Duration:</span>
                    <div>{exp.exposureDose || 'Not specified'}</div>
                  </div>
                  <div>
                    <span className="muted small">Fetal Surveillance Protocol:</span>
                    <div className="row wrap" style={{ gap: '0.3rem', marginTop: '0.2rem' }}>
                      {exp.anomalyScanIndicated && (
                        <span className="badge warn" style={{ fontSize: '0.7rem' }}>
                          🎯 Level II Anomaly Scan (18–20w)
                        </span>
                      )}
                      {exp.fetalEchoIndicated && (
                        <span className="badge err" style={{ fontSize: '0.7rem' }}>
                          ❤️ Fetal Echocardiography (20–22w)
                        </span>
                      )}
                      {!exp.anomalyScanIndicated && !exp.fetalEchoIndicated && (
                        <span className="badge small">Routine Sonography</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '4px', fontSize: '0.82rem' }}>
                  <div style={{ marginBottom: '0.3rem' }}>
                    <strong>Fetal Risk Summary:</strong> {exp.fetalRiskSummary}
                  </div>
                  {exp.counselingNotes && (
                    <div style={{ marginBottom: '0.3rem', color: '#334155' }}>
                      <strong>Parental Counseling Notes:</strong> {exp.counselingNotes}
                    </div>
                  )}
                  {exp.actionPlan && (
                    <div style={{ color: '#0369a1', fontWeight: '500' }}>
                      <strong>Action / Management Plan:</strong> {exp.actionPlan}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Patient's Prescribed Medications Safety Check */}
      {visitPrescriptions.length > 0 && (
        <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff' }}>
          <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
            <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
              📋 Prescription Safety Audit (From Visit Records)
            </strong>
            <span className="muted small">{visitPrescriptions.length} distinct medicine{visitPrescriptions.length === 1 ? '' : 's'} checked</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.6rem' }}>
            {visitPrescriptions.map((rx, idx) => {
              const ev = rx.evaluation;
              return (
                <div
                  key={idx}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '0.65rem 0.8rem',
                    background: ev.evaluatedRiskLevel === 'safe' ? '#f0fdf4' : ev.evaluatedRiskLevel === 'caution' ? '#fffbeb' : '#fef2f2',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem',
                  }}
                >
                  <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{rx.medicine}</strong>
                    <span
                      className={`badge ${ev.evaluatedRiskLevel === 'safe' ? 'ok' : ev.evaluatedRiskLevel === 'caution' ? 'warn' : 'err'}`}
                      style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}
                    >
                      {ev.evaluatedRiskLevel}
                    </span>
                  </div>
                  <div className="muted small" style={{ fontSize: '0.72rem' }}>
                    Prescribed on {rx.visitDate} · FDA Cat: {ev.fdaCategory}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#334155' }}>
                    {ev.warningSummary}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Log Teratogenic Exposure */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              background: '#ffffff',
              maxWidth: '640px',
              width: '100%',
              padding: '1.25rem',
              borderRadius: '8px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#0f172a' }}>➕ Log Maternal Teratogenic Exposure</h3>
              <button type="button" className="btn small" onClick={() => setShowAddModal(false)}>
                ✕
              </button>
            </div>

            {Boolean(exposureError) && <ErrorBanner error={exposureError} />}

            <form onSubmit={handleSaveExposure} className="stack" style={{ gap: '0.8rem' }}>
              <div>
                <label className="label">Medication Name (Brand or Generic)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Telmisartan 40mg, Brufen, Valproate, Doxycycline, Isotretinoin"
                  value={modalMedName}
                  onChange={(e) => handleModalMedNameChange(e.target.value)}
                  required
                />
              </div>

              <div className="row wrap" style={{ gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Generic Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Telmisartan"
                    value={modalGenericName}
                    onChange={(e) => setModalGenericName(e.target.value)}
                  />
                </div>
                <div style={{ width: '130px' }}>
                  <label className="label">FDA Category</label>
                  <select
                    className="input"
                    value={modalFdaCategory}
                    onChange={(e) => setModalFdaCategory(e.target.value as FdaPregnancyCategory)}
                  >
                    <option value="A">A (Safe)</option>
                    <option value="B">B (Compatible)</option>
                    <option value="C">C (Caution)</option>
                    <option value="D">D (High Risk)</option>
                    <option value="X">X (Contraindicated)</option>
                    <option value="N/A">N/A (Unclassified)</option>
                  </select>
                </div>
                <div style={{ width: '150px' }}>
                  <label className="label">Overall Risk Level</label>
                  <select
                    className="input"
                    value={modalRiskLevel}
                    onChange={(e) => setModalRiskLevel(e.target.value as MedicationRiskLevel)}
                  >
                    <option value="contraindicated">Contraindicated</option>
                    <option value="high_risk">High Risk</option>
                    <option value="caution">Caution</option>
                    <option value="safe">Safe</option>
                  </select>
                </div>
              </div>

              <div className="row wrap" style={{ gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Trimester of Exposure</label>
                  <select
                    className="input"
                    value={modalTrimester}
                    onChange={(e) => setModalTrimester(e.target.value as any)}
                  >
                    <option value="t1_organogenesis">1st Trimester (Organogenesis &lt;13w)</option>
                    <option value="preconception">Preconception</option>
                    <option value="t2">2nd Trimester (13–27w)</option>
                    <option value="t3">3rd Trimester (≥28w)</option>
                    <option value="multiple_unknown">Multiple Trimesters / Unknown</option>
                  </select>
                </div>
                <div style={{ width: '120px' }}>
                  <label className="label">GA (Weeks)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    max="44"
                    value={modalGaWeeks}
                    onChange={(e) => setModalGaWeeks(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div style={{ width: '100px' }}>
                  <label className="label">GA (Days)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    max="6"
                    value={modalGaDays}
                    onChange={(e) => setModalGaDays(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="row wrap" style={{ gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Dose &amp; Duration Details</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. 40mg once daily for 14 days"
                    value={modalDose}
                    onChange={(e) => setModalDose(e.target.value)}
                  />
                </div>
                <div style={{ width: '150px' }}>
                  <label className="label">Start Date</label>
                  <input
                    type="date"
                    className="input"
                    value={modalStartDate}
                    onChange={(e) => setModalStartDate(e.target.value)}
                  />
                </div>
                <div style={{ width: '150px' }}>
                  <label className="label">End Date</label>
                  <input
                    type="date"
                    className="input"
                    value={modalEndDate}
                    onChange={(e) => setModalEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label">Fetal Risk Summary (Required)</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="e.g. Potential risk of renal dysgenesis, oligohydramnios sequence, skull hypocalvaria"
                  value={modalRiskSummary}
                  onChange={(e) => setModalRiskSummary(e.target.value)}
                  required
                />
              </div>

              {/* Surveillance Protocol Checkboxes */}
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '0.85rem', color: '#1e293b', display: 'block', marginBottom: '0.4rem' }}>
                  🎯 Targeted Obstetric Surveillance Protocol
                </strong>
                <div className="row wrap" style={{ gap: '1.25rem' }}>
                  <label className="row" style={{ gap: '0.4rem', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={modalAnomalyScan}
                      onChange={(e) => setModalAnomalyScan(e.target.checked)}
                    />
                    <span style={{ fontSize: '0.85rem' }}>Level II Targeted Anatomy Scan Indicated (18–20w)</span>
                  </label>
                  <label className="row" style={{ gap: '0.4rem', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={modalFetalEcho}
                      onChange={(e) => setModalFetalEcho(e.target.checked)}
                    />
                    <span style={{ fontSize: '0.85rem' }}>Fetal Echocardiography Indicated (20–22w)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="label">Parental Risk Counseling Notes</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="e.g. Risk-benefit discussed with couple; baseline malformation risk (2-3%) vs drug-specific risk explained; Level II anomaly scan scheduled."
                  value={modalCounselingNotes}
                  onChange={(e) => setModalCounselingNotes(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Action Plan / Medication Switch</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Telmisartan stopped immediately; started Tab Labetalol 100mg bid; High-dose Folic acid 5mg prescribed"
                  value={modalActionPlan}
                  onChange={(e) => setModalActionPlan(e.target.value)}
                />
              </div>

              <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={savingExposure}>
                  {savingExposure ? 'Saving...' : 'Save Exposure Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
