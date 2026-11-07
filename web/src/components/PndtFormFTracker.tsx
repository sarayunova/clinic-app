import React, { useState, useEffect } from 'react';
import { api, type Patient, type PndtFormFRecord, type MonthlyPndtReturnSummary } from '../api';
import { useAuth, useMe } from '../auth';
import {
  PNDT_STATUTORY_INDICATIONS,
  formatLivingChildrenSummary,
  validatePndtFormCompleteness,
} from '../pndtEngine';

interface PndtTrackerProps {
  patient: Patient;
}

export function PndtFormFTracker({ patient }: PndtTrackerProps) {
  const { can } = useAuth();
  const me = useMe();
  const [forms, setForms] = useState<PndtFormFRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Monthly Return view
  const [showMonthlyReturn, setShowMonthlyReturn] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [monthlySummary, setMonthlySummary] = useState<MonthlyPndtReturnSummary | null>(null);
  const [monthlyRecords, setMonthlyRecords] = useState<PndtFormFRecord[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  // Form Editor State
  const [formState, setFormState] = useState<Partial<PndtFormFRecord>>({
    patientId: patient.id,
    scanDate: new Date().toISOString().substring(0, 10),
    scanTime: new Date().toTimeString().substring(0, 5),
    clinicPndtRegNo: 'MH/PNDT/2021/045',
    doctorName: me.fullName || 'Dr. K. Sarayu Rao',
    doctorRegNo: 'MCI-54892',
    machineModelSerial: 'GE Voluson E8 Expert, S/N: US-GE-89241',
    patientName: String(patient.fullName || ''),
    patientAge: 27,
    husbandOrFatherName: String(patient.emergencyContactName || 'Husband'),
    fullAddress: String(patient.address || 'Pune, Maharashtra'),
    contactPhone: String(patient.phone || ''),
    numLivingMaleChildren: 0,
    maleChildrenAges: '',
    numLivingFemaleChildren: 0,
    femaleChildrenAges: '',
    totalLivingChildren: 0,
    lmp: String(patient.lastMenstrualPeriod || ''),
    gestationalAgeWeeks: 18,
    gestationalAgeDays: 0,
    referralType: 'self_referred',
    referringDoctorName: '',
    referringDoctorRegNo: '',
    referringClinicAddress: '',
    referralSlipDate: '',
    selfReferralReason: 'Routine antenatal obstetric ultrasound examination',
    indicationCodes: ['GA_ESTIMATION', 'ANOMALY_DETECTION'],
    otherIndicationDetail: '',
    invasiveProcedureDone: false,
    invasiveProcedureDetails: '',
    pregnantWomanDeclarationSigned: true,
    pregnantWomanDeclarationTime: `${new Date().toISOString().substring(0, 10)} ${new Date().toTimeString().substring(0, 5)}`,
    pregnantWomanSignatureName: String(patient.fullName || ''),
    doctorDeclarationSigned: true,
    doctorDeclarationTime: `${new Date().toISOString().substring(0, 10)} ${new Date().toTimeString().substring(0, 5)}`,
    doctorDeclarationName: me.fullName || 'Dr. K. Sarayu Rao',
    fetalNumber: 'single',
    cardiacActivity: 'present',
    congenitalAnomalyDetected: false,
    congenitalAnomalyDetails: '',
    scanResultSummary: 'Single live intrauterine gestation. No structural congenital malformations noted.',
  });

  const loadForms = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ total: number; forms: PndtFormFRecord[] }>(
        'GET',
        `/api/pndt/forms?patientId=${patient.id}`,
      );
      setForms(res.forms || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PC-PNDT records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForms();
  }, [patient.id]);

  const loadMonthlyReturn = async (month: string) => {
    setLoadingMonthly(true);
    try {
      const res = await api<{ month: string; summary: MonthlyPndtReturnSummary; records: PndtFormFRecord[] }>(
        'GET',
        `/api/pndt/monthly-return?month=${month}`,
      );
      setMonthlySummary(res.summary);
      setMonthlyRecords(res.records || []);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to fetch monthly return');
    } finally {
      setLoadingMonthly(false);
    }
  };

  const handleOpenAutoGenerate = async () => {
    setError(null);
    setSaving(true);
    try {
      const draft = await api<Partial<PndtFormFRecord>>('POST', '/api/pndt/auto-generate', {
        patientId: patient.id,
      });
      setFormState({
        ...draft,
        patientId: patient.id,
      });
      setEditingId(null);
      setShowEditor(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not auto-generate Form F draft');
    } finally {
      setSaving(false);
    }
  };

  const handleEditForm = (form: PndtFormFRecord) => {
    setFormState({ ...form });
    setEditingId(form.id);
    setShowEditor(true);
  };

  const handleDeleteForm = async (id: number, formNumber: string) => {
    if (!window.confirm(`Are you sure you want to delete statutory PC-PNDT Form F record "${formNumber}"? This action will be audited.`)) {
      return;
    }
    try {
      await api('DELETE', `/api/pndt/forms/${id}`);
      await loadForms();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete Form F');
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePndtFormCompleteness(formState);
    if (!validation.isValid) {
      alert(`Statutory Form F Incomplete:\n• ${validation.errors.join('\n• ')}`);
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await api('PUT', `/api/pndt/forms/${editingId}`, formState);
      } else {
        await api('POST', '/api/pndt/forms', formState);
      }
      setShowEditor(false);
      setEditingId(null);
      await loadForms();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save Form F');
    } finally {
      setSaving(false);
    }
  };

  const toggleIndication = (code: string) => {
    const current = new Set(formState.indicationCodes || []);
    if (current.has(code)) {
      current.delete(code);
    } else {
      current.add(code);
    }
    setFormState({ ...formState, indicationCodes: Array.from(current) });
  };

  const canEdit = can('patient:write_clinical') || can('care:write_nursing');
  const canDelete = can('patient:write_clinical');

  return (
    <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Statutory Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#f8fafc',
          padding: '1.25rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          borderLeft: '5px solid #38bdf8',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.25rem' }}>⚖️</span>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                Statutory PC-PNDT Act Form &lsquo;F&rsquo; Register
              </h3>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  background: '#0369a1',
                  color: '#e0f2fe',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Rule 9(5) Mandatory
              </span>
            </div>
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8', maxWidth: '750px', lineHeight: 1.4 }}>
              Maintenance of Form F is mandatory under the Pre-Conception &amp; Pre-Natal Diagnostic Techniques (Prohibition of Sex Selection) Act, 1994 for every prenatal diagnostic ultrasound scan. Records must be preserved for inspection by the District Appropriate Authority.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {canEdit && (
              <button
                type="button"
                onClick={handleOpenAutoGenerate}
                disabled={saving}
                style={{
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 0.9rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>➕</span> Generate New Form &lsquo;F&rsquo;
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setShowMonthlyReturn(true);
                loadMonthlyReturn(selectedMonth);
              }}
              style={{
                background: '#334155',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '0.5rem 0.9rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>📊</span> Monthly Return &amp; CMO Register
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.88rem' }}>
          {error}
        </div>
      )}

      {/* List of Form F Records */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
          Loading statutory PC-PNDT records…
        </div>
      ) : forms.length === 0 ? (
        <div
          style={{
            border: '2px dashed #cbd5e1',
            borderRadius: '8px',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            background: '#f8fafc',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
          <h4 style={{ margin: '0 0 0.3rem 0', color: '#334155', fontSize: '1rem' }}>No Form &lsquo;F&rsquo; Records Found for this Patient</h4>
          <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.85rem' }}>
            Click &ldquo;Generate New Form &lsquo;F&rsquo;&rdquo; to automatically pre-populate statutory particulars from patient details and latest ultrasound scan.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={handleOpenAutoGenerate}
              style={{
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 1.1rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Auto-Generate Form &lsquo;F&rsquo;
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {forms.map((form) => {
            const livingSummary = formatLivingChildrenSummary(
              form.numLivingMaleChildren,
              form.numLivingFemaleChildren,
              form.maleChildrenAges,
              form.femaleChildrenAges,
            );

            return (
              <div
                key={form.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1.25rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.8rem',
                }}
              >
                {/* Top Row: Number, Date, Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{
                        background: '#0f766e',
                        color: '#ffffff',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '0.92rem',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {form.formFNumber}
                    </span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1e293b' }}>
                      Scan Date: {form.scanDate} {form.scanTime ? `at ${form.scanTime}` : ''}
                    </span>
                    <span style={{ fontSize: '0.82rem', background: '#f1f5f9', color: '#475569', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                      GA: {form.gestationalAgeWeeks}w {form.gestationalAgeDays}d
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <a
                      href={`/patients/${patient.id}/pndt/${form.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: '#f8fafc',
                        color: '#0f4c81',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <span>🖨️</span> Statutory Print
                    </a>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleEditForm(form)}
                        style={{
                          background: '#f8fafc',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          padding: '0.35rem 0.7rem',
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                    )}

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteForm(form.id, form.formFNumber)}
                        style={{
                          background: '#fff',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: '4px',
                          padding: '0.35rem 0.6rem',
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Grid Details */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '0.75rem',
                    background: '#f8fafc',
                    padding: '0.85rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.84rem',
                  }}
                >
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block' }}>Husband / Father:</span>
                    <strong style={{ color: '#1e293b' }}>{form.husbandOrFatherName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block' }}>Living Children:</span>
                    <strong style={{ color: form.totalLivingChildren > 0 ? '#0f766e' : '#64748b' }}>{livingSummary}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block' }}>Referral Status:</span>
                    <strong style={{ color: '#1e293b' }}>
                      {form.referralType === 'doctor_referred'
                        ? `Dr. ${form.referringDoctorName || 'Referring Doctor'}`
                        : 'Self-Referred'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block' }}>Doctor / Sonologist:</span>
                    <strong style={{ color: '#1e293b' }}>{form.doctorName} ({form.doctorRegNo})</strong>
                  </div>
                </div>

                {/* Indications & Declarations */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Statutory Indications:</span>
                    {form.indicationCodes.map((c) => {
                      const def = PNDT_STATUTORY_INDICATIONS.find((i) => i.code === c);
                      return (
                        <span
                          key={c}
                          style={{
                            background: '#e0f2fe',
                            color: '#0369a1',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '0.76rem',
                          }}
                        >
                          {def?.label || c}
                        </span>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.2rem', color: '#15803d', fontSize: '0.78rem' }}>
                    <span>✅ Pregnant Woman Declaration Signed ({form.pregnantWomanDeclarationTime})</span>
                    <span>✅ Doctor Non-Disclosure Certified ({form.doctorDeclarationTime})</span>
                    {form.congenitalAnomalyDetected && (
                      <span style={{ color: '#b91c1c', fontWeight: 700 }}>
                        ⚠️ Congenital Anomaly Detected: {form.congenitalAnomalyDetails}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              maxWidth: '850px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#0f172a',
                color: '#fff',
                borderRadius: '8px 8px 0 0',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                  {editingId ? `Edit Statutory Form 'F'` : `Generate Statutory PC-PNDT Form 'F'`}
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Patient: {String(patient.fullName || '')} (ID: {patient.patientNumber})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveForm} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* SECTION A */}
              <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem', background: '#f8fafc' }}>
                <legend style={{ fontWeight: 700, color: '#0f4c81', padding: '0 0.5rem', fontSize: '0.9rem' }}>
                  Section A: Patient Particulars &amp; Living Children (Rule 9)
                </legend>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.9rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                      Patient Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formState.patientName || ''}
                      onChange={(e) => setFormState({ ...formState, patientName: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                      Patient Age (Years) *
                    </label>
                    <input
                      type="number"
                      required
                      min={12}
                      max={65}
                      value={formState.patientAge ?? 26}
                      onChange={(e) => setFormState({ ...formState, patientAge: Number(e.target.value) })}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                      Husband / Father Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formState.husbandOrFatherName || ''}
                      onChange={(e) => setFormState({ ...formState, husbandOrFatherName: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={formState.contactPhone || ''}
                      onChange={(e) => setFormState({ ...formState, contactPhone: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '0.8rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                    Full Residential Address (Mandatory under PC-PNDT Act) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.fullAddress || ''}
                    onChange={(e) => setFormState({ ...formState, fullAddress: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>

                {/* Parity & Living Children */}
                <div
                  style={{
                    marginTop: '0.9rem',
                    padding: '0.75rem',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '0.8rem',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0369a1', marginBottom: '0.2rem' }}>
                      Living Male Children
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={15}
                      value={formState.numLivingMaleChildren ?? 0}
                      onChange={(e) => {
                        const m = Number(e.target.value);
                        setFormState({
                          ...formState,
                          numLivingMaleChildren: m,
                          totalLivingChildren: m + (formState.numLivingFemaleChildren || 0),
                        });
                      }}
                      style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0369a1', marginBottom: '0.2rem' }}>
                      Male Children Ages (e.g. 4, 7 yrs)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 5 yrs"
                      value={formState.maleChildrenAges || ''}
                      onChange={(e) => setFormState({ ...formState, maleChildrenAges: e.target.value })}
                      style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#be185d', marginBottom: '0.2rem' }}>
                      Living Female Children
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={15}
                      value={formState.numLivingFemaleChildren ?? 0}
                      onChange={(e) => {
                        const f = Number(e.target.value);
                        setFormState({
                          ...formState,
                          numLivingFemaleChildren: f,
                          totalLivingChildren: (formState.numLivingMaleChildren || 0) + f,
                        });
                      }}
                      style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#be185d', marginBottom: '0.2rem' }}>
                      Female Children Ages (e.g. 2, 5 yrs)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2, 4 yrs"
                      value={formState.femaleChildrenAges || ''}
                      onChange={(e) => setFormState({ ...formState, femaleChildrenAges: e.target.value })}
                      style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                {/* Scan Date, GA, LMP */}
                <div style={{ marginTop: '0.9rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                      Scan Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formState.scanDate || ''}
                      onChange={(e) => setFormState({ ...formState, scanDate: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                      Scan Time (HH:MM)
                    </label>
                    <input
                      type="time"
                      value={formState.scanTime || ''}
                      onChange={(e) => setFormState({ ...formState, scanTime: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                      LMP (Last Menstrual Period)
                    </label>
                    <input
                      type="date"
                      value={formState.lmp || ''}
                      onChange={(e) => setFormState({ ...formState, lmp: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                      Gestational Age (Weeks &amp; Days) *
                    </label>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <input
                        type="number"
                        min={1}
                        max={44}
                        required
                        value={formState.gestationalAgeWeeks ?? 18}
                        onChange={(e) => setFormState({ ...formState, gestationalAgeWeeks: Number(e.target.value) })}
                        style={{ width: '65%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                      <span style={{ fontSize: '0.8rem' }}>w</span>
                      <input
                        type="number"
                        min={0}
                        max={6}
                        value={formState.gestationalAgeDays ?? 0}
                        onChange={(e) => setFormState({ ...formState, gestationalAgeDays: Number(e.target.value) })}
                        style={{ width: '35%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                      <span style={{ fontSize: '0.8rem' }}>d</span>
                    </div>
                  </div>
                </div>

                {/* Equipment & Center Details */}
                <div style={{ marginTop: '0.9rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                      Center PC-PNDT Reg No *
                    </label>
                    <input
                      type="text"
                      required
                      value={formState.clinicPndtRegNo || ''}
                      onChange={(e) => setFormState({ ...formState, clinicPndtRegNo: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                      Sonologist / Doctor Name &amp; Reg No *
                    </label>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <input
                        type="text"
                        required
                        placeholder="Dr. Name"
                        value={formState.doctorName || ''}
                        onChange={(e) => setFormState({ ...formState, doctorName: e.target.value })}
                        style={{ width: '65%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                      <input
                        type="text"
                        required
                        placeholder="Reg No"
                        value={formState.doctorRegNo || ''}
                        onChange={(e) => setFormState({ ...formState, doctorRegNo: e.target.value })}
                        style={{ width: '35%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                      Ultrasound Machine Details (Make &amp; S/N) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formState.machineModelSerial || ''}
                      onChange={(e) => setFormState({ ...formState, machineModelSerial: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              </fieldset>

              {/* SECTION B: REFERRAL */}
              <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem', background: '#f8fafc' }}>
                <legend style={{ fontWeight: 700, color: '#0f4c81', padding: '0 0.5rem', fontSize: '0.9rem' }}>
                  Section B: Referral Particulars (Doctor Referral vs Self-Referral)
                </legend>

                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="referralType"
                      checked={formState.referralType === 'self_referred'}
                      onChange={() => setFormState({ ...formState, referralType: 'self_referred' })}
                    />
                    <strong>Self-Referred Patient</strong>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="referralType"
                      checked={formState.referralType === 'doctor_referred'}
                      onChange={() => setFormState({ ...formState, referralType: 'doctor_referred' })}
                    />
                    <strong>Doctor / Hospital Referred Case</strong>
                  </label>
                </div>

                {formState.referralType === 'self_referred' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                      Clinical Reason for Self-Referral *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Routine obstetric ultrasound checkup / confirmation of pregnancy"
                      value={formState.selfReferralReason || ''}
                      onChange={(e) => setFormState({ ...formState, selfReferralReason: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                        Referring Doctor Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formState.referringDoctorName || ''}
                        onChange={(e) => setFormState({ ...formState, referringDoctorName: e.target.value })}
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                        Doctor Reg. Number
                      </label>
                      <input
                        type="text"
                        value={formState.referringDoctorRegNo || ''}
                        onChange={(e) => setFormState({ ...formState, referringDoctorRegNo: e.target.value })}
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                        Clinic / Hospital Address
                      </label>
                      <input
                        type="text"
                        value={formState.referringClinicAddress || ''}
                        onChange={(e) => setFormState({ ...formState, referringClinicAddress: e.target.value })}
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                        Referral Slip Date
                      </label>
                      <input
                        type="date"
                        value={formState.referralSlipDate || ''}
                        onChange={(e) => setFormState({ ...formState, referralSlipDate: e.target.value })}
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                )}
              </fieldset>

              {/* SECTION C: STATUTORY INDICATIONS */}
              <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem', background: '#f8fafc' }}>
                <legend style={{ fontWeight: 700, color: '#0f4c81', padding: '0 0.5rem', fontSize: '0.9rem' }}>
                  Section C: Statutory Indications for Prenatal Diagnostic Ultrasound (Rule 9(5))
                </legend>
                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Select all applicable statutory clinical indications justifying the ultrasound examination:
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '0.5rem',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    padding: '0.5rem',
                    background: '#fff',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  {PNDT_STATUTORY_INDICATIONS.map((ind) => {
                    const checked = (formState.indicationCodes || []).includes(ind.code);
                    return (
                      <label
                        key={ind.code}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.45rem',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          padding: '0.3rem',
                          borderRadius: '4px',
                          background: checked ? '#e0f2fe' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleIndication(ind.code)}
                          style={{ marginTop: '0.15rem' }}
                        />
                        <div>
                          <strong style={{ color: checked ? '#0369a1' : '#334155' }}>{ind.label}</strong>
                          <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>{ind.ruleCitation}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formState.invasiveProcedureDone || false}
                      onChange={(e) => setFormState({ ...formState, invasiveProcedureDone: e.target.checked })}
                    />
                    <strong>Invasive Diagnostic Procedure Done (e.g. CVS / Amniocentesis / Cordocentesis)</strong>
                  </label>
                  {formState.invasiveProcedureDone && (
                    <input
                      type="text"
                      placeholder="Specify procedure, indications, and date"
                      value={formState.invasiveProcedureDetails || ''}
                      onChange={(e) => setFormState({ ...formState, invasiveProcedureDetails: e.target.value })}
                      style={{ flex: 1, padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    />
                  )}
                </div>
              </fieldset>

              {/* SECTION D & E: MANDATORY STATUTORY DECLARATIONS */}
              <fieldset style={{ border: '1.5px solid #0369a1', borderRadius: '6px', padding: '1rem', background: '#f0f9ff' }}>
                <legend style={{ fontWeight: 700, color: '#0369a1', padding: '0 0.5rem', fontSize: '0.9rem' }}>
                  Section D &amp; E: Mandatory Statutory Declarations under PC-PNDT Act
                </legend>

                {/* Pregnant Woman Declaration */}
                <div style={{ padding: '0.75rem', background: '#fff', borderRadius: '6px', border: '1px solid #bae6fd', marginBottom: '0.8rem' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      required
                      checked={formState.pregnantWomanDeclarationSigned || false}
                      onChange={(e) => setFormState({ ...formState, pregnantWomanDeclarationSigned: e.target.checked })}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: '#0c4a6e' }}>
                        Declaration of the Pregnant Woman (Part I):
                      </strong>
                      <p style={{ margin: '0.25rem 0', fontSize: '0.8rem', color: '#334155', fontStyle: 'italic', lineHeight: 1.4 }}>
                        &ldquo;I, Mrs. <strong>{formState.patientName || 'Pregnant Woman'}</strong>, declare that by undergoing ultrasound examination / image scanning, I do not want to know the sex of my fetus.&rdquo;
                      </p>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: '#64748b' }}>
                        <span>Signature / Thumb Verified: <strong>{formState.pregnantWomanSignatureName}</strong></span>
                        <span>Timestamp: <strong>{formState.pregnantWomanDeclarationTime}</strong></span>
                      </div>
                    </div>
                  </label>
                </div>

                {/* Doctor Declaration */}
                <div style={{ padding: '0.75rem', background: '#fff', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      required
                      checked={formState.doctorDeclarationSigned || false}
                      onChange={(e) => setFormState({ ...formState, doctorDeclarationSigned: e.target.checked })}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: '#0c4a6e' }}>
                        Declaration of Doctor / Person conducting Ultrasonography (Part II):
                      </strong>
                      <p style={{ margin: '0.25rem 0', fontSize: '0.8rem', color: '#334155', fontStyle: 'italic', lineHeight: 1.4 }}>
                        &ldquo;I, <strong>{formState.doctorName || 'Doctor'}</strong> ({formState.doctorRegNo}), declare that while conducting ultrasonography / image scanning of Mrs. <strong>{formState.patientName}</strong>, I have neither determined the sex of her fetus nor disclosed or communicated the sex of the fetus to anyone in any manner.&rdquo;
                      </p>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: '#64748b' }}>
                        <span>Medical Council Reg: <strong>{formState.doctorRegNo}</strong></span>
                        <span>Certified Date &amp; Time: <strong>{formState.doctorDeclarationTime}</strong></span>
                      </div>
                    </div>
                  </label>
                </div>
              </fieldset>

              {/* SECTION F: DIAGNOSTIC RESULT SUMMARY */}
              <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '1rem', background: '#f8fafc' }}>
                <legend style={{ fontWeight: 700, color: '#0f4c81', padding: '0 0.5rem', fontSize: '0.9rem' }}>
                  Ultrasound Diagnostic Findings Summary
                </legend>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                      Fetal Number
                    </label>
                    <select
                      value={formState.fetalNumber || 'single'}
                      onChange={(e) => setFormState({ ...formState, fetalNumber: e.target.value as any })}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    >
                      <option value="single">Single Fetus</option>
                      <option value="twins">Twin Gestation</option>
                      <option value="triplets">Triplets</option>
                      <option value="multiple">Higher-order Multiple</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                      Cardiac Activity
                    </label>
                    <select
                      value={formState.cardiacActivity || 'present'}
                      onChange={(e) => setFormState({ ...formState, cardiacActivity: e.target.value as any })}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    >
                      <option value="present">Present (Normal)</option>
                      <option value="absent">Absent (Suspected Demise)</option>
                      <option value="not_applicable">Not Applicable</option>
                    </select>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '0.3rem' }}>
                      <input
                        type="checkbox"
                        checked={formState.congenitalAnomalyDetected || false}
                        onChange={(e) => setFormState({ ...formState, congenitalAnomalyDetected: e.target.checked })}
                      />
                      <strong style={{ color: formState.congenitalAnomalyDetected ? '#b91c1c' : '#334155' }}>
                        Congenital Malformation / Structural Anomaly Detected
                      </strong>
                    </label>

                    {formState.congenitalAnomalyDetected && (
                      <input
                        type="text"
                        placeholder="Describe structural anomaly detected (e.g. Ventricular Septal Defect, Clubfoot, Anencephaly)"
                        value={formState.congenitalAnomalyDetails || ''}
                        onChange={(e) => setFormState({ ...formState, congenitalAnomalyDetails: e.target.value })}
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1.5px solid #f87171', fontSize: '0.85rem' }}
                      />
                    )}
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }}>
                      Scan Result Impression
                    </label>
                    <textarea
                      rows={2}
                      value={formState.scanResultSummary || ''}
                      onChange={(e) => setFormState({ ...formState, scanResultSummary: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              </fieldset>

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '0.5rem 1.25rem',
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {saving ? 'Saving...' : editingId ? 'Update Form F' : 'Save & Certify Form F'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Monthly Return Modal */}
      {showMonthlyReturn && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              maxWidth: '920px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#0f172a',
                color: '#fff',
                borderRadius: '8px 8px 0 0',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                  Statutory PC-PNDT Monthly Return &amp; District CMO Register
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Mandatory submission to District Appropriate Authority by the 5th of every succeeding month
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowMonthlyReturn(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Select Return Month:</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(e.target.value);
                      loadMonthlyReturn(e.target.value);
                    }}
                    style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>

                <a
                  href={`/api/pndt/monthly-return/export?month=${selectedMonth}`}
                  download={`PNDT_Monthly_Return_${selectedMonth}.csv`}
                  style={{
                    background: '#047857',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer',
                  }}
                >
                  <span>📥</span> Download Statutory CSV (CMO Return)
                </a>
              </div>

              {loadingMonthly ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  Aggregating statutory records for {selectedMonth}…
                </div>
              ) : monthlySummary ? (
                <>
                  {/* Summary Metric Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                    <div style={{ padding: '0.9rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Total Scans</span>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f4c81' }}>{monthlySummary.totalScans}</div>
                    </div>

                    <div style={{ padding: '0.9rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Referred Cases</span>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f766e' }}>
                        {monthlySummary.referralBreakdown.doctorReferred}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Self: {monthlySummary.referralBreakdown.selfReferred}
                      </span>
                    </div>

                    <div style={{ padding: '0.9rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Nulliparous (0 Ch.)</span>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#334155' }}>
                        {monthlySummary.parityDistribution.zeroChildren}
                      </div>
                    </div>

                    <div style={{ padding: '0.9rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>1 Living Female</span>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#be185d' }}>
                        {monthlySummary.parityDistribution.oneChildFemale}
                      </div>
                    </div>

                    <div style={{ padding: '0.9rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>2+ Living Females</span>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#be185d' }}>
                        {monthlySummary.parityDistribution.twoChildrenTwoFemales}
                      </div>
                    </div>

                    <div style={{ padding: '0.9rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Anomalies Detected</span>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: monthlySummary.anomalyCount > 0 ? '#b91c1c' : '#15803d' }}>
                        {monthlySummary.anomalyCount}
                      </div>
                    </div>
                  </div>

                  {/* Scans Register Table */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ padding: '0.75rem 1rem', background: '#f1f5f9', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
                      Statutory Scan Records for {selectedMonth} ({monthlyRecords.length} scans)
                    </div>
                    {monthlyRecords.length === 0 ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                        No scans recorded for the selected month.
                      </div>
                    ) : (
                      <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                          <thead style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                            <tr>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Form F No</th>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Date</th>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Patient Name</th>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Living Children</th>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Referral</th>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Indications</th>
                              <th style={{ padding: '0.5rem 0.75rem' }}>Sonologist</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlyRecords.map((r) => (
                              <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontWeight: 600 }}>{r.formFNumber}</td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>{r.scanDate}</td>
                                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{r.patientName}</td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                  {r.totalLivingChildren === 0 ? '0' : `${r.numLivingMaleChildren}M, ${r.numLivingFemaleChildren}F`}
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                  {r.referralType === 'doctor_referred' ? `Dr. ${r.referringDoctorName || ''}` : 'Self'}
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                  {r.indicationCodes.slice(0, 2).join(', ')}
                                  {r.indicationCodes.length > 2 ? ` (+${r.indicationCodes.length - 2})` : ''}
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>{r.doctorName}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
