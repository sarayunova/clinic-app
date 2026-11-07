import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, api, type Admission, type Invoice, type Patient, type VisitSummary, type PatientRiskSummary } from '../api';
import { useAuth } from '../auth';
import { BookAppointment } from '../components/BookAppointment';
import { Documents } from '../components/Documents';
import { ExportRecord } from '../components/ExportRecord';
import { PAYMENT_STATE_LABEL, formatMoney, startInvoice } from '../money';
import { AllergyBadge, ErrorBanner, Field, fieldErrorsOf, formatAge } from '../components/ui';
import { calculateEdd, calculateGestationalAge, formatGpal, PregnancyChip, ObstetricChip } from '../pregnancy';
import { AntenatalFlowsheet } from '../components/AntenatalFlowsheet';
import { AntenatalChecklist } from '../components/AntenatalChecklist';
import { PediatricTracker } from '../components/PediatricTracker';
import { UltrasoundTracker } from '../components/UltrasoundTracker';
import { LabTracker } from '../components/LabTracker';
import { PartographTracker } from '../components/PartographTracker';
import { OperativeNotesList } from '../components/OperativeNotesList';
import { CommunicationModal } from '../components/CommunicationModal';
import { AntenatalRiskEngine } from '../components/AntenatalRiskEngine';
import { ObstetricDischargeManager } from '../components/ObstetricDischargeManager';
import { MaternityAdmissionManager } from '../components/MaternityAdmissionManager';
import { AntenatalLabTracker } from '../components/AntenatalLabTracker';
import { MedicationSafetyChecker } from '../components/MedicationSafetyChecker';
import { PphQblManager } from '../components/PphQblManager';
import { NeonatalResuscitationManager } from '../components/NeonatalResuscitationManager';
import { MaternalMeowsManager } from '../components/MaternalMeowsManager';
import { NeonatalJaundiceTracker } from '../components/NeonatalJaundiceTracker';
import { FolliculometryTracker } from '../components/FolliculometryTracker';
import { ErasReedaManager } from '../components/ErasReedaManager';
import { GestationalDiabetesTracker } from '../components/GestationalDiabetesTracker';
import { CardiotocographyTracker } from '../components/CardiotocographyTracker';
import { PediatricGrowthTracker } from '../components/PediatricGrowthTracker';
import { CervicalScreeningTracker } from '../components/CervicalScreeningTracker';
import { ContraceptionTracker } from '../components/ContraceptionTracker';
import { PndtFormFTracker } from '../components/PndtFormFTracker';
import { GeneticScreeningTracker } from '../components/GeneticScreeningTracker';
import { FetalDopplerTracker } from '../components/FetalDopplerTracker';
import { PreeclampsiaScreeningTracker } from '../components/PreeclampsiaScreeningTracker';
import { MultipleGestationTracker } from '../components/MultipleGestationTracker';
import { InductionTracker } from '../components/InductionTracker';
import { PerinatalLossTracker } from '../components/PerinatalLossTracker';
import { ArtCycleTracker } from '../components/ArtCycleTracker';
import { EndometriosisTracker } from '../components/EndometriosisTracker';
import { UrogynecologyTracker } from '../components/UrogynecologyTracker';
import { GynOncologyTracker } from '../components/GynOncologyTracker';

type Kind = 'text' | 'textarea' | 'date' | 'tel' | 'int' | 'select';
interface FieldDef {
  key: string;
  label: string;
  kind: Kind;
  options?: [string, string][];
  hint?: string;
  wide?: boolean;
}
interface Section {
  title: string;
  writePerm: string;
  readPerm: string;
  fields: FieldDef[];
}

const SECTIONS: Section[] = [
  {
    title: 'Identity and contact',
    writePerm: 'patient:write_demographics',
    readPerm: 'patient:read_basic',
    fields: [
      { key: 'fullName', label: 'Full name', kind: 'text', wide: true },
      { key: 'dateOfBirth', label: 'Date of birth', kind: 'date' },
      { key: 'estimatedAgeYears', label: 'Estimated age (years)', kind: 'int', hint: 'Use only if date of birth is unknown' },
      { key: 'phone', label: 'Phone', kind: 'tel' },
      { key: 'address', label: 'Address', kind: 'textarea', wide: true },
      { key: 'emergencyContactName', label: 'Emergency contact name', kind: 'text' },
      { key: 'emergencyContactPhone', label: 'Emergency contact phone', kind: 'tel' },
    ],
  },
  {
    title: 'Allergies',
    writePerm: 'patient:write_allergies',
    readPerm: 'patient:read_basic',
    fields: [
      {
        key: 'allergyStatus',
        label: 'Allergy status',
        kind: 'select',
        options: [
          ['unknown', 'Not yet recorded'],
          ['none', 'No known allergies'],
          ['known', 'Has allergies'],
        ],
      },
      { key: 'allergyDetails', label: 'Allergy and reaction', kind: 'textarea', wide: true },
    ],
  },
  {
    title: 'Clinical history',
    writePerm: 'patient:write_clinical',
    readPerm: 'patient:read_clinical',
    fields: [
      { key: 'medicalHistory', label: 'Medical history', kind: 'textarea', wide: true },
      { key: 'surgicalHistory', label: 'Surgical history', kind: 'textarea', wide: true },
      { key: 'familyHistory', label: 'Family history', kind: 'textarea', wide: true },
      { key: 'menstrualHistory', label: 'Menstrual history', kind: 'textarea', wide: true },
      { key: 'lastMenstrualPeriod', label: 'Last menstrual period', kind: 'date', hint: "Calculates EDD & Gestational Age via Naegele's rule" },
      {
        key: 'menopauseStatus',
        label: 'Menopause status',
        kind: 'select',
        options: [
          ['unknown', 'Unknown'],
          ['not_applicable', 'Not applicable'],
          ['pre', 'Pre-menopausal'],
          ['peri', 'Peri-menopausal'],
          ['post', 'Post-menopausal'],
        ],
      },
      { key: 'obstetricHistory', label: 'Obstetric history', kind: 'textarea', wide: true },
      { key: 'gravida', label: 'Gravida (G)', kind: 'int', hint: 'Total pregnancies' },
      { key: 'para', label: 'Para (P)', kind: 'int', hint: 'Deliveries' },
      { key: 'abortions', label: 'Abortions (A)', kind: 'int', hint: 'Miscarriages / terminations' },
      { key: 'living', label: 'Living (L)', kind: 'int', hint: 'Living children' },
      { key: 'ongoingMedicines', label: 'Ongoing medicines', kind: 'textarea', wide: true },
      { key: 'clinicalNotes', label: 'Clinical notes', kind: 'textarea', wide: true },
    ],
  },
];

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);
const DEFAULT_FORM: Record<string, string> = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, f.key === 'allergyStatus' || f.key === 'menopauseStatus' ? 'unknown' : '']));

const toForm = (p: Patient): Record<string, string> =>
  Object.fromEntries(ALL_FIELDS.map((f) => [f.key, p[f.key] == null ? DEFAULT_FORM[f.key]! : String(p[f.key])]));

function toValue(def: FieldDef, s: string): string | number | null {
  const t = s.trim();
  if (def.kind === 'int') return t === '' ? null : Number(t);
  if (def.kind === 'select') return t;
  return t === '' ? null : t;
}

export function PatientPage() {
  const { id } = useParams();
  const isNew = id === undefined;
  const nav = useNavigate();
  const { can } = useAuth();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [form, setForm] = useState<Record<string, string>>(DEFAULT_FORM);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState(false);
  const [viewMode, setViewMode] = useState<
    'flowsheet' | 'checklist' | 'antenatal_labs' | 'med_safety' | 'pph_qbl' | 'meows' | 'neonatal_resus' | 'jaundice' | 'folliculometry' | 'eras_reeda' | 'gdm' | 'ctg' | 'cervical_screening' | 'contraception' | 'pndt' | 'genetic_screening' | 'doppler' | 'preeclampsia' | 'multiple_gestation' | 'induction' | 'perinatal_loss' | 'art_cycles' | 'endometriosis' | 'urogynecology' | 'gyn_oncology' | 'pediatric' | 'pediatric_growth' | 'ultrasound' | 'lab' | 'partograph' | 'operative' | 'risk' | 'postnatal' | 'maternity_admission' | 'list'
  >('flowsheet');
  const [visits, setVisits] = useState<VisitSummary[] | null>(null);
  const [admissions, setAdmissions] = useState<Admission[] | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [riskSummary, setRiskSummary] = useState<PatientRiskSummary | null>(null);
  const [dupes, setDupes] = useState<{ id: number; patientNumber: string; fullName: string; phone: string | null }[] | null>(null);
  const [showCommModal, setShowCommModal] = useState(false);

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const p = await api<Patient>('GET', `/api/patients/${id}`);
      setPatient(p);
      setForm(toForm(p));
      setLoadError(null);
    } catch (e) {
      setLoadError(e);
    }
  }, [id, isNew]);

  useEffect(() => {
    setVisits(null);
    if (isNew || !can('visit:read')) return;
    api<VisitSummary[]>('GET', `/api/patients/${id}/visits`).then(setVisits, () => setVisits([]));
  }, [id, isNew, can]);

  useEffect(() => {
    setAdmissions(null);
    if (isNew || !can('ipd:read_basic')) return;
    api<Admission[]>('GET', `/api/patients/${id}/admissions`).then(setAdmissions, () => setAdmissions([]));
  }, [id, isNew, can]);

  useEffect(() => {
    setInvoices(null);
    if (isNew || !can('billing:read')) return;
    api<Invoice[]>('GET', `/api/patients/${id}/invoices`).then(setInvoices, () => setInvoices([]));
  }, [id, isNew, can]);

  useEffect(() => {
    setRiskSummary(null);
    if (isNew || !can('patient:read_clinical')) return;
    api<PatientRiskSummary>('GET', `/api/patients/${id}/risk-summary`).then(setRiskSummary, () => setRiskSummary(null));
  }, [id, isNew, can]);

  useEffect(() => {
    setPatient(null);
    setSaved(false);
    setError(null);
    setDupes(null);
    setForm(DEFAULT_FORM);
    void load();
  }, [load]);

  const isMaternity = Boolean(patient?.lastMenstrualPeriod || patient?.gravida != null || visits?.some((v) => v.antenatalNotes));
  const isPediatric = Boolean(
    patient && (
      (patient.ageYears != null && patient.ageYears <= 18) ||
      (patient.dateOfBirth && (new Date().getFullYear() - parseInt(String(patient.dateOfBirth).slice(0, 4), 10)) <= 18)
    )
  );

  useEffect(() => {
    if (!patient) return;
    const isMat = Boolean(patient.lastMenstrualPeriod || patient.gravida != null);
    const isPed =
      (patient.ageYears != null && patient.ageYears <= 18) ||
      (patient.dateOfBirth ? new Date().getFullYear() - parseInt(String(patient.dateOfBirth).slice(0, 4), 10) <= 18 : false);
    if (isPed && !isMat) {
      setViewMode('pediatric');
    } else if (isMat) {
      setViewMode('flowsheet');
    } else {
      setViewMode('list');
    }
  }, [patient?.id]);

  const baseline = useMemo(() => (patient ? toForm(patient) : DEFAULT_FORM), [patient]);
  const changedKeys = ALL_FIELDS.filter((f) => form[f.key] !== baseline[f.key]).map((f) => f.key);
  const fe = fieldErrorsOf(error);
  // Long form: bring the error banner into view so a save failure is never missed.
  useEffect(() => {
    if (error) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [error]);
  const canWrite = (perm: string) => can(perm);

  const payload = () => {
    const out: Record<string, string | number | null> = {};
    for (const f of ALL_FIELDS) if (changedKeys.includes(f.key) || (isNew && f.key === 'fullName')) out[f.key] = toValue(f, form[f.key]!);
    return out;
  };

  async function create(confirmedDuplicates: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (!confirmedDuplicates) {
        const body = payload();
        const check = await api<{ possibleDuplicates: NonNullable<typeof dupes> }>('POST', '/api/patients/check-duplicates', {
          fullName: body.fullName,
          dateOfBirth: body.dateOfBirth ?? null,
          phone: body.phone ?? null,
        });
        if (check.possibleDuplicates.length) {
          setDupes(check.possibleDuplicates);
          return;
        }
      }
      const r = await api<{ patient: Patient }>('POST', '/api/patients', payload());
      nav(`/patients/${r.patient.id}`, { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    if (isNew) return create(dupes !== null);
    if (!patient || changedKeys.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const p = await api<Patient>('PATCH', `/api/patients/${patient.id}`, { ...payload(), version: patient.version });
      setPatient(p);
      setForm(toForm(p));
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (!isNew && loadError) return <div className="page narrow"><ErrorBanner error={loadError} /><Link to="/patients">Back to search</Link></div>;
  if (!isNew && !patient) return <p className="muted">Loading…</p>;

  const conflict = error instanceof ApiError && error.status === 409;

  return (
    <div className="page narrow">
      <p><Link to="/patients">← Patients</Link></p>
      {isNew ? (
        <h1>Register patient</h1>
      ) : (
        <header className="patient-head">
          <div>
            <h1>{patient!.fullName}</h1>
            <div className="muted">
              {patient!.patientNumber} · {formatAge(patient!.ageYears, patient!.ageIsEstimated)}
              {typeof patient!.phone === 'string' && patient!.phone ? (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="link"
                    onClick={() => setShowCommModal(true)}
                    title="Send WhatsApp or SMS to patient"
                    style={{ fontSize: 'inherit' }}
                  >
                    💬 {patient!.phone}
                  </button>
                </>
              ) : ''}
            </div>
            <div className="chips" style={{ marginTop: '0.35rem' }}>
              <ObstetricChip gravida={patient!.gravida} para={patient!.para} abortions={patient!.abortions} living={patient!.living} />
              <PregnancyChip lmp={patient!.lastMenstrualPeriod as string | null} showLmp />
              {riskSummary?.isHighRisk && (
                <button
                  type="button"
                  onClick={() => setViewMode('risk')}
                  style={{
                    background: '#fee2e2',
                    color: '#991b1b',
                    border: '1px solid #f87171',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="High-Risk Pregnancy: Click to view assessment & prophylaxis protocols"
                >
                  ⚠️ HIGH RISK
                </button>
              )}
            </div>
          </div>
          {can('patient:read_basic') && (
            <button
              type="button"
              className="btn small"
              onClick={() => setShowCommModal(true)}
              title="Send patient communication via WhatsApp or SMS"
            >
              💬 WhatsApp / SMS
            </button>
          )}
          {can('patient:read_clinical') && (
            <Link className="btn small" to={`/patients/${patient!.id}/summary/print`}>
              🖨️ Summary & Referral Card
            </Link>
          )}
          {can('audit:read') && (
            <Link className="btn small" to={`/audit?patientId=${patient!.id}&patient=${encodeURIComponent(`${patient!.fullName} (${patient!.patientNumber})`)}`}>
              Who has accessed this record
            </Link>
          )}
          {can('appointment:create') && (
            <button className="btn primary" onClick={() => setBooking((b) => !b)}>
              + Book appointment
            </button>
          )}
        </header>
      )}

      {!isNew && (
        <div className={`allergy-banner ${patient!.allergyStatus}`}>
          <AllergyBadge status={patient!.allergyStatus} details={patient!.allergyDetails} />
        </div>
      )}

      {booking && patient && (
        <BookAppointment patient={{ id: patient.id, name: patient.fullName }} onCancel={() => setBooking(false)} onBooked={() => setBooking(false)} />
      )}

      {dupes && (
        <div className="banner warn" role="alert">
          <strong>This may be a patient who is already registered:</strong>
          <ul>
            {dupes.map((d) => (
              <li key={d.id}>
                <Link to={`/patients/${d.id}`}>{d.fullName}</Link> · {d.patientNumber}
                {d.phone ? ` · ${d.phone}` : ''}
              </li>
            ))}
          </ul>
          <p className="small">Families often share a phone number, so this is only a warning.</p>
          <div className="row">
            <button type="button" className="btn primary" disabled={busy} onClick={() => void create(true)}>
              Register as a new patient anyway
            </button>
            <button type="button" className="btn" onClick={() => setDupes(null)}>
              Go back and edit
            </button>
          </div>
        </div>
      )}

      {admissions && (admissions.length > 0 || can('admission:create')) && (
        <section className="card stack">
          <div className="page-head" style={{ marginBottom: 0 }}>
            <h2 style={{ margin: 0 }}>Admissions</h2>
            {can('admission:create') && !admissions.some((a) => a.status === 'admitted') && (
              <Link className="btn" to={`/admissions/new?patientId=${patient!.id}`}>
                Admit patient
              </Link>
            )}
          </div>
          {admissions.length === 0 && <p className="muted">Not admitted before.</p>}
          <ul className="list">
            {admissions.map((a) => (
              <li key={a.id}>
                <Link className="list-item" to={`/admissions/${a.id}`}>
                  <strong>
                    {a.admissionNumber} · {a.admittedDate} · {a.status === 'admitted' ? `Admitted, ${a.bedRoom} / Bed ${a.bedLabel}` : 'Discharged'}
                  </strong>
                  {a.reason && <span className="muted">{a.reason}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {invoices && (
        <section className="card stack">
          <div className="page-head" style={{ marginBottom: 0 }}>
            <h2 style={{ margin: 0 }}>Bills</h2>
            {can('invoice:write') && (
              <button type="button" className="btn" onClick={() => startInvoice(nav, { patientId: patient!.id }).catch(setError)}>
                New invoice
              </button>
            )}
          </div>
          {invoices.length === 0 && <p className="muted">No invoices yet.</p>}
          <ul className="list">
            {invoices.map((i) => (
              <li key={i.id}>
                <Link className="list-item" to={`/invoices/${i.id}`}>
                  <strong>{i.invoiceNumber ?? 'Draft'} · {i.issuedDate ?? 'not issued'} · {formatMoney(i.totalPaise)}</strong>
                  <span className="muted">{PAYMENT_STATE_LABEL[i.paymentState]}{i.status === 'issued' && i.balancePaise > 0 ? ` · due ${formatMoney(i.balancePaise)}` : ''}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {visits && (
        <section className="card stack">
          <div className="page-head" style={{ marginBottom: 0 }}>
            <h2 style={{ margin: 0 }}>Consultations ({visits.length})</h2>
            {(isMaternity || isPediatric) && (
              <div className="row wrap no-print" style={{ gap: '0.4rem' }}>
                {isMaternity && (
                  <>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'flowsheet' ? 'primary' : ''}`}
                      onClick={() => setViewMode('flowsheet')}
                    >
                      🤰 Maternity Flowsheet
                    </button>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'checklist' ? 'primary' : ''}`}
                      onClick={() => setViewMode('checklist')}
                    >
                      🧪 Lab & Scan Checklist
                    </button>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'antenatal_labs' ? 'primary' : ''}`}
                      onClick={() => setViewMode('antenatal_labs')}
                    >
                      🔬 Antenatal Lab Trends
                    </button>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'med_safety' ? 'primary' : ''}`}
                      onClick={() => setViewMode('med_safety')}
                    >
                      💊 Med Safety &amp; Teratogens
                    </button>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'pph_qbl' ? 'primary' : ''}`}
                      onClick={() => setViewMode('pph_qbl')}
                    >
                      🩸 PPH &amp; QBL Protocol
                    </button>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'meows' ? 'primary' : ''}`}
                      onClick={() => setViewMode('meows')}
                    >
                      🌡️ MEOWS &amp; Sepsis
                    </button>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'risk' ? 'primary' : ''}`}
                      onClick={() => setViewMode('risk')}
                    >
                      ⚠️ High-Risk Scoring
                    </button>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'maternity_admission' ? 'primary' : ''}`}
                      onClick={() => setViewMode('maternity_admission')}
                    >
                      🏥 Labor & Admission
                    </button>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'postnatal' ? 'primary' : ''}`}
                      onClick={() => setViewMode('postnatal')}
                    >
                      🤱 Postnatal Discharge
                    </button>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'neonatal_resus' ? 'primary' : ''}`}
                      onClick={() => setViewMode('neonatal_resus')}
                    >
                      👶 Neonatal Resuscitation &amp; NEW-S
                    </button>
                  </>
                )}
                {isPediatric && (
                  <>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'pediatric' ? 'primary' : ''}`}
                      onClick={() => setViewMode('pediatric')}
                    >
                      👶 Child Health &amp; Vaccines
                    </button>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'pediatric_growth' ? 'primary' : ''}`}
                      onClick={() => setViewMode('pediatric_growth')}
                    >
                      🧒 WHO Growth &amp; Milestones
                    </button>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'neonatal_resus' ? 'primary' : ''}`}
                      onClick={() => setViewMode('neonatal_resus')}
                    >
                      🩺 Birth Resuscitation &amp; NEW-S
                    </button>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'jaundice' ? 'primary' : ''}`}
                      onClick={() => setViewMode('jaundice')}
                    >
                      💡 Jaundice Nomogram
                    </button>
                  </>
                )}
                {!isPediatric && (
                  <>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'gdm' ? 'primary' : ''}`}
                      onClick={() => setViewMode('gdm')}
                    >
                      🩸 GDM &amp; Glycemic
                    </button>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'ctg' ? 'primary' : ''}`}
                      onClick={() => setViewMode('ctg')}
                    >
                      📈 CTG / NST Trace
                    </button>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'folliculometry' ? 'primary' : ''}`}
                      onClick={() => setViewMode('folliculometry')}
                    >
                      🔬 Infertility &amp; Folliculometry
                    </button>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'cervical_screening' ? 'primary' : ''}`}
                      onClick={() => setViewMode('cervical_screening')}
                    >
                      🔬 Cervical &amp; Colposcopy
                    </button>
                    <button
                      type="button"
                      className={`btn small ${viewMode === 'contraception' ? 'primary' : ''}`}
                      onClick={() => setViewMode('contraception')}
                    >
                      🪢 Contraception &amp; IUCD
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className={`btn small ${viewMode === 'ultrasound' ? 'primary' : ''}`}
                  onClick={() => setViewMode('ultrasound')}
                >
                  📡 Ultrasound Scans
                </button>
                <button
                  type="button"
                  className={`btn small ${viewMode === 'pndt' ? 'primary' : ''}`}
                  onClick={() => setViewMode('pndt')}
                >
                  ⚖️ PC-PNDT Form &lsquo;F&rsquo;
                </button>
                <button
                  type="button"
                  className={`btn small ${viewMode === 'genetic_screening' ? 'primary' : ''}`}
                  onClick={() => setViewMode('genetic_screening')}
                >
                  🧬 Genetic Screening
                </button>
                <button
                  type="button"
                  className={`btn small ${viewMode === 'doppler' ? 'primary' : ''}`}
                  onClick={() => setViewMode('doppler')}
                >
                  🌊 Fetal Doppler &amp; CPR
                </button>
                <button
                  type="button"
                  className={`btn small ${viewMode === 'preeclampsia' ? 'primary' : ''}`}
                  onClick={() => setViewMode('preeclampsia')}
                >
                  🩺 PE Screen &amp; Aspirin
                </button>
                <button
                  type="button"
                  className={`btn small ${viewMode === 'multiple_gestation' ? 'primary' : ''}`}
                  onClick={() => setViewMode('multiple_gestation')}
                >
                  👥 Twin / Multiple Gestation
                </button>
                <button
                  type="button"
                  className={`btn small ${viewMode === 'induction' ? 'primary' : ''}`}
                  onClick={() => setViewMode('induction')}
                >
                  👶 Labor Induction
                </button>
                <button
                  type="button"
                  className={`btn small ${viewMode === 'perinatal_loss' ? 'primary' : ''}`}
                  onClick={() => setViewMode('perinatal_loss')}
                >
                  🕊️ Perinatal Loss Audit
                </button>
                <button
                  type="button"
                  className={`btn small ${viewMode === 'art_cycles' ? 'primary' : ''}`}
                  onClick={() => setViewMode('art_cycles')}
                >
                  🧬 ART &amp; IVF-ICSI
                </button>
                <button
                  type="button"
                  className={`btn small ${viewMode === 'endometriosis' ? 'primary' : ''}`}
                  onClick={() => setViewMode('endometriosis')}
                >
                  🎗️ Endometriosis (#Enzian)
                </button>
                <button
                  type="button"
                  className={`btn small ${viewMode === 'urogynecology' ? 'primary' : ''}`}
                  onClick={() => setViewMode('urogynecology')}
                >
                  🌸 Urogynecology &amp; POP-Q
                </button>
                <button
                  type="button"
                  className={`btn small ${viewMode === 'gyn_oncology' ? 'primary' : ''}`}
                  onClick={() => setViewMode('gyn_oncology')}
                >
                  🔬 Gyn-Oncology &amp; RMI
                </button>
                <button
                  type="button"
                  className={`btn small ${viewMode === 'lab' ? 'primary' : ''}`}
                  onClick={() => setViewMode('lab')}
                >
                  🧪 Lab Tests
                </button>
                {isMaternity && (
                  <button
                    type="button"
                    className={`btn small ${viewMode === 'partograph' ? 'primary' : ''}`}
                    onClick={() => setViewMode('partograph')}
                  >
                    📈 Labor Partograph
                  </button>
                )}
                <button
                  type="button"
                  className={`btn small ${viewMode === 'operative' ? 'primary' : ''}`}
                  onClick={() => setViewMode('operative')}
                >
                  🩺 Operative Notes (LSCS)
                </button>
                <button
                  type="button"
                  className={`btn small ${viewMode === 'eras_reeda' ? 'primary' : ''}`}
                  onClick={() => setViewMode('eras_reeda')}
                >
                  🩹 ERAS &amp; REEDA Wound
                </button>
                <button
                  type="button"
                  className={`btn small ${viewMode === 'list' ? 'primary' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  📋 Visit List
                </button>
              </div>
            )}
          </div>

          {isMaternity && viewMode === 'flowsheet' ? (
            <AntenatalFlowsheet
              patient={patient!}
              visits={visits}
              onOpenChecklist={() => setViewMode('checklist')}
            />
          ) : isMaternity && viewMode === 'checklist' ? (
            <AntenatalChecklist
              patientId={patient!.id}
              lastMenstrualPeriod={patient!.lastMenstrualPeriod}
            />
          ) : isMaternity && viewMode === 'antenatal_labs' ? (
            <AntenatalLabTracker patient={patient!} />
          ) : isMaternity && viewMode === 'med_safety' ? (
            <MedicationSafetyChecker patient={patient!} visits={visits} />
          ) : isMaternity && viewMode === 'pph_qbl' ? (
            <PphQblManager patient={patient!} />
          ) : isMaternity && viewMode === 'meows' ? (
            <MaternalMeowsManager patient={patient!} />
          ) : isMaternity && viewMode === 'risk' ? (
            <AntenatalRiskEngine
              patientId={patient!.id}
              patientName={patient!.fullName}
              lastMenstrualPeriod={patient!.lastMenstrualPeriod}
              dateOfBirth={patient!.dateOfBirth as string | null | undefined}
              gravida={patient!.gravida}
              para={patient!.para}
              onChanged={load}
            />
          ) : isMaternity && viewMode === 'maternity_admission' ? (
            <MaternityAdmissionManager patient={patient!} onChanged={load} />
          ) : isMaternity && viewMode === 'postnatal' ? (
            <ObstetricDischargeManager patient={patient!} />
          ) : viewMode === 'neonatal_resus' ? (
            <NeonatalResuscitationManager patientId={patient!.id} />
          ) : viewMode === 'jaundice' ? (
            <NeonatalJaundiceTracker
              patientId={patient!.id}
              patientDob={patient!.dateOfBirth as string | null | undefined}
              onChanged={load}
            />
          ) : viewMode === 'folliculometry' ? (
            <FolliculometryTracker patientId={patient!.id} />
          ) : viewMode === 'gdm' ? (
            <GestationalDiabetesTracker patientId={patient!.id} />
          ) : viewMode === 'ctg' ? (
            <CardiotocographyTracker patientId={patient!.id} />
          ) : viewMode === 'cervical_screening' ? (
            <CervicalScreeningTracker patientId={patient!.id} />
          ) : viewMode === 'contraception' ? (
            <ContraceptionTracker patientId={patient!.id} />
          ) : viewMode === 'pndt' ? (
            <PndtFormFTracker patient={patient!} />
          ) : viewMode === 'genetic_screening' ? (
            <GeneticScreeningTracker patient={patient!} />
          ) : viewMode === 'doppler' ? (
            <FetalDopplerTracker patient={patient!} />
          ) : viewMode === 'preeclampsia' ? (
            <PreeclampsiaScreeningTracker patient={patient!} />
          ) : viewMode === 'multiple_gestation' ? (
            <MultipleGestationTracker patient={patient!} />
          ) : viewMode === 'induction' ? (
            <InductionTracker patient={patient!} />
          ) : viewMode === 'perinatal_loss' ? (
            <PerinatalLossTracker patient={patient!} />
          ) : viewMode === 'art_cycles' ? (
            <ArtCycleTracker patient={patient!} />
          ) : viewMode === 'endometriosis' ? (
            <EndometriosisTracker patient={patient!} />
          ) : viewMode === 'urogynecology' ? (
            <UrogynecologyTracker patient={patient!} />
          ) : viewMode === 'gyn_oncology' ? (
            <GynOncologyTracker patient={patient!} />
          ) : viewMode === 'eras_reeda' ? (
            <ErasReedaManager patientId={patient!.id} />
          ) : isPediatric && viewMode === 'pediatric' ? (
            <PediatricTracker
              patientId={patient!.id}
              dateOfBirth={patient!.dateOfBirth as string | null | undefined}
            />
          ) : isPediatric && viewMode === 'pediatric_growth' ? (
            <PediatricGrowthTracker
              patientId={patient!.id}
              patientDob={patient!.dateOfBirth as string | null | undefined}
            />
          ) : viewMode === 'ultrasound' ? (
            <UltrasoundTracker
              patientId={patient!.id}
              clinicalLmp={patient!.lastMenstrualPeriod as string | null}
              onChanged={load}
            />
          ) : viewMode === 'lab' ? (
            <LabTracker
              patientId={patient!.id}
              onChanged={load}
            />
          ) : viewMode === 'partograph' ? (
            <PartographTracker
              patientId={patient!.id}
              onChanged={load}
            />
          ) : viewMode === 'operative' ? (
            <OperativeNotesList
              patientId={patient!.id}
              patientName={patient!.fullName}
            />
          ) : (
            <>
              {visits.length === 0 && <p className="muted">No consultations recorded yet.</p>}
              <ul className="list">
                {visits.map((v) => (
                  <li key={v.id}>
                    <Link className="list-item" to={`/visits/${v.id}`}>
                      <strong>
                        {v.visitDate} · {v.status === 'draft' ? 'Draft' : 'Finalised'}
                        {v.amendments > 0 ? ` · amended ${v.amendments}×` : ''}
                      </strong>
                      <span className="muted">{v.assessment ?? v.complaints ?? 'No notes yet'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <form onSubmit={submit} className="stack">
        <ErrorBanner error={error} />
        {conflict && (
          <button type="button" className="btn" onClick={() => { setError(null); void load(); }}>
            Reload the latest version (your unsaved changes will be lost)
          </button>
        )}
        {saved && <div className="banner ok" role="status">Saved.</div>}

        {SECTIONS.filter((s) => can(s.readPerm)).map((s) => {
          const editable = canWrite(s.writePerm);
          if (isNew && !editable) return null; // e.g. nobody registering needs a section they cannot fill
          return (
            <fieldset key={s.title} className="card" disabled={!editable}>
              <legend>{s.title}{!editable && <span className="muted small"> (read only)</span>}</legend>
              <div className="grid2">
                {s.fields.map((f) => {
                  if (f.key === 'allergyDetails' && form.allergyStatus !== 'known') return null;
                  return (
                    <div key={f.key} className={f.wide ? 'span2' : ''}>
                      <Field
                        label={f.label}
                        error={fe[f.key]}
                        hint={
                          f.key === 'lastMenstrualPeriod' && form.lastMenstrualPeriod
                            ? (() => {
                                const ga = calculateGestationalAge(form.lastMenstrualPeriod);
                                const edd = calculateEdd(form.lastMenstrualPeriod);
                                return ga && edd && ga.isPlausiblePregnancy
                                  ? `EDD: ${edd} · Current: ${ga.formatted} (${ga.fullFormatted})`
                                  : f.hint;
                              })()
                            : f.hint
                        }
                      >
                        {f.kind === 'textarea' ? (
                          <textarea rows={3} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                        ) : f.kind === 'select' ? (
                          <select value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                            {f.options!.map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={f.kind === 'int' ? 'number' : f.kind}
                            inputMode={f.kind === 'int' ? 'numeric' : undefined}
                            min={f.kind === 'int' ? 0 : undefined}
                            value={form[f.key]}
                            onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                            required={f.key === 'fullName'}
                          />
                        )}
                      </Field>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        <div className="sticky-actions">
          <button className="btn primary" disabled={busy || (!isNew && changedKeys.length === 0)}>
            {busy ? 'Saving…' : isNew ? 'Register patient' : 'Save changes'}
          </button>
          {!isNew && changedKeys.length > 0 && <span className="muted small">Unsaved changes</span>}
        </div>
      </form>

      {!isNew && can('attachment:read') && <Documents patientId={patient!.id} visits={visits} admissions={admissions} />}

      {!isNew && can('record:export') && <ExportRecord patientId={patient!.id} patientNumber={patient!.patientNumber} />}

      {showCommModal && patient && (
        <CommunicationModal
          open={true}
          onClose={() => setShowCommModal(false)}
          patientId={patient.id}
          patientName={patient.fullName}
          patientPhone={patient.phone as string | null}
          defaultType={patient.lastMenstrualPeriod ? 'antenatal_recall' : 'custom'}
          antenatalData={
            patient.lastMenstrualPeriod
              ? {
                  gestationalAge: calculateGestationalAge(patient.lastMenstrualPeriod as string)?.formatted,
                  edd: calculateEdd(patient.lastMenstrualPeriod as string) ?? undefined,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
