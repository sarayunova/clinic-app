import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ApiError, api, type PrescriptionItem, type Visit, type VitalsEntry } from '../api';
import { useAuth } from '../auth';
import { VisitInvoice } from '../components/VisitInvoice';
import { BookAppointment } from '../components/BookAppointment';
import { AllergyBadge, ErrorBanner, Field, fieldErrorsOf, formatAge } from '../components/ui';
import { ObstetricChip, PregnancyChip } from '../pregnancy';
import { TemplatePicker } from '../components/TemplatePicker';
import { Documents } from '../components/Documents';
import { VitalsAlertBadges, LiveVitalsAlertBanner, BmiBadge } from '../components/VitalsBadges';
import { evaluateVitalsAlerts, calculateBmi } from '../vitalsAlerts';
import { QuickMedPicker } from '../components/QuickMedPicker';
import {
  applyQuickMedication,
  findStandardDirections,
  ROUTE_CHIPS,
  MEDICINE_SUGGESTIONS,
} from '../medicationCatalog';
import { DictationToolbar, VoiceFieldMic, useSpeechRecognition } from '../components/VoiceDictation';
import { appendDictatedText } from '../voiceDictationUtils';
import { CommunicationModal } from '../components/CommunicationModal';
import { evaluatePrescriptionSafety, getRiskBadgeStyle } from '../pregnancyMedicationSafety';
import { calculateGestationalAge } from '../pregnancyCalc';

const TEXT_FIELDS = [
  { key: 'complaints', label: 'Presenting complaints' },
  { key: 'history', label: 'Relevant history' },
  { key: 'examination', label: 'Examination findings' },
  { key: 'assessment', label: 'Assessment / diagnosis' },
  { key: 'antenatalNotes', label: 'Pregnancy / antenatal observations (if relevant)' },
  { key: 'investigations', label: 'Investigations requested / report notes' },
  { key: 'advice', label: 'Advice' },
] as const;
type TextKey = (typeof TEXT_FIELDS)[number]['key'];
type FormKey = TextKey | 'followUpDate';
const FORM_KEYS: FormKey[] = [...TEXT_FIELDS.map((f) => f.key), 'followUpDate'];
const LABEL: Record<string, string> = {
  ...Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, f.label])),
  followUpDate: 'Follow-up date',
  prescriptionItems: 'Prescription',
};

type ItemForm = Record<keyof PrescriptionItem, string>;
const ITEM_FIELDS: { key: keyof PrescriptionItem; label: string; wide?: boolean; placeholder?: string }[] = [
  { key: 'medicine', label: 'Medicine', wide: true },
  { key: 'strength', label: 'Strength', placeholder: 'e.g. 500 mg' },
  { key: 'dose', label: 'Dose', placeholder: 'e.g. 1 tablet' },
  { key: 'route', label: 'Route', placeholder: 'e.g. oral' },
  { key: 'frequency', label: 'Frequency', placeholder: 'e.g. twice daily' },
  { key: 'duration', label: 'Duration', placeholder: 'e.g. 5 days' },
  { key: 'instructions', label: 'Instructions', wide: true },
];
const emptyItem = (): ItemForm => ({ medicine: '', strength: '', dose: '', route: '', frequency: '', duration: '', instructions: '' });

const FREQ_OPTIONS = [
  { label: '1-0-0', val: '1-0-0 (once daily)' },
  { label: '1-0-1', val: '1-0-1 (twice daily)' },
  { label: '1-1-1', val: '1-1-1 (thrice daily)' },
  { label: '0-0-1', val: '0-0-1 (bedtime)' },
  { label: 'SOS', val: 'SOS (when needed)' },
  { label: 'QID', val: '1-1-1-1 (four times daily)' },
  { label: 'Weekly', val: 'Once weekly' },
];

const DUR_OPTIONS = [
  { label: '3 d', val: '3 days' },
  { label: '5 d', val: '5 days' },
  { label: '7 d', val: '7 days' },
  { label: '14 d', val: '14 days' },
  { label: '30 d', val: '30 days' },
  { label: 'Till delivery', val: 'Till delivery' },
];

const ROUTE_OPTIONS = ['oral', 'IV', 'IM', 'per vaginal', 'topical', 'sublingual'];

const INSTR_OPTIONS = ['After food', 'Before food', 'Empty stomach', 'At bedtime', 'With milk'];

const toForm = (v: Pick<Visit, FormKey>): Record<FormKey, string> =>
  Object.fromEntries(FORM_KEYS.map((k) => [k, v[k] ?? ''])) as Record<FormKey, string>;
const toItemsForm = (items?: PrescriptionItem[] | null): ItemForm[] =>
  (items ?? []).map((i) =>
    Object.fromEntries(
      ITEM_FIELDS.map((f) => [f.key, i && i[f.key] != null ? String(i[f.key]) : ''])
    ) as ItemForm
  );
/** Drops untouched blank rows and converts empty strings to null, matching what the server stores. */
const normItems = (items: ItemForm[]): PrescriptionItem[] =>
  (items ?? [])
    .filter((i) => i && Object.values(i).some((x) => typeof x === 'string' && x.trim() !== ''))
    .map((i) =>
      Object.fromEntries(
        ITEM_FIELDS.map((f) => [
          f.key,
          typeof i[f.key] === 'string' && i[f.key].trim() !== '' ? i[f.key].trim() : null,
        ])
      ) as unknown as PrescriptionItem
    );

function fmtVitals(v: VitalsEntry): string {
  const parts: string[] = [];
  if (v.systolicMmhg != null) parts.push(`BP ${v.systolicMmhg}/${v.diastolicMmhg} mmHg`);
  if (v.pulseBpm != null) parts.push(`Pulse ${v.pulseBpm} bpm`);
  if (v.temperatureC != null) parts.push(`Temp ${v.temperatureC} °C`);
  if (v.weightKg != null) parts.push(`Weight ${v.weightKg} kg`);
  if (v.heightCm != null) parts.push(`Height ${v.heightCm} cm`);
  return parts.join(' · ');
}

export function VisitPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [form, setForm] = useState<Record<FormKey, string>>(() => toForm({ complaints: null, history: null, examination: null, assessment: null, antenatalNotes: null, investigations: null, advice: null, followUpDate: null }));
  const [items, setItems] = useState<ItemForm[]>([]);
  const [amending, setAmending] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmFinalise, setConfirmFinalise] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [bookingFollowUp, setBookingFollowUp] = useState(false);
  const [showCommModal, setShowCommModal] = useState(false);
  const [activeDictationField, setActiveDictationField] = useState<TextKey>('complaints');
  const [viewing, setViewing] = useState<{ no: number; snapshot: Record<string, unknown> & { prescriptionItems: PrescriptionItem[] } } | null>(null);

  const activeDictationFieldRef = useRef<TextKey>('complaints');
  activeDictationFieldRef.current = activeDictationField;

  const handleAppendDictation = (fieldKey: string, text: string) => {
    setForm((prev) => ({
      ...prev,
      [fieldKey]: appendDictatedText(prev[fieldKey as FormKey] || '', text),
    }));
  };

  const dictation = useSpeechRecognition({
    onFinalText: (formatted) => {
      handleAppendDictation(activeDictationFieldRef.current, formatted);
    },
  });

  const toggleFieldDictation = (fieldKey: TextKey) => {
    if (dictation.isListening && activeDictationField === fieldKey) {
      dictation.stopListening();
    } else {
      setActiveDictationField(fieldKey);
      activeDictationFieldRef.current = fieldKey;
      if (!dictation.isListening) {
        dictation.startListening();
      }
    }
  };

  const adopt = useCallback((v: Visit) => {
    setVisit(v);
    setForm(toForm(v));
    setItems(toItemsForm(v.prescriptionItems));
  }, []);

  const load = useCallback(async () => {
    try {
      adopt(await api<Visit>('GET', `/api/visits/${id}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e);
    }
  }, [id, adopt]);

  useEffect(() => {
    setVisit(null);
    setAmending(false);
    setViewing(null);
    setError(null);
    setNotice(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (error) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [error]);

  const base = useMemo(() => (visit ? toForm(visit) : null), [visit]);
  const changes = useMemo(() => {
    const out: Record<string, string | null | PrescriptionItem[]> = {};
    if (!visit || !base) return out;
    for (const k of FORM_KEYS) {
      const formVal = (form[k] ?? '').trim();
      const baseVal = (base[k] ?? '').trim();
      if (formVal !== baseVal) out[k] = formVal === '' ? null : formVal;
    }
    const now = normItems(items);
    if (JSON.stringify(now) !== JSON.stringify(visit.prescriptionItems ?? [])) out.prescriptionItems = now;
    return out;
  }, [visit, base, form, items]);
  const dirty = Object.keys(changes).length > 0;

  const isMaternity = Boolean(visit?.lastMenstrualPeriod || visit?.gravida != null || visit?.antenatalNotes);
  const currentGa = calculateGestationalAge(visit?.lastMenstrualPeriod);

  const prescriptionSafetyAlerts = useMemo(() => {
    if (!isMaternity) return [];
    return (items ?? [])
      .map((it, idx) => {
        const med = typeof it?.medicine === 'string' ? it.medicine.trim() : '';
        return {
          index: idx,
          medicine: med,
          evaluation: med ? evaluatePrescriptionSafety(med, currentGa?.weeks ?? null) : null,
        };
      })
      .filter((r) => r.evaluation && (r.evaluation.evaluatedRiskLevel === 'contraindicated' || r.evaluation.evaluatedRiskLevel === 'high_risk'));
  }, [isMaternity, items, currentGa?.weeks]);

  if (loadError) return <div className="page narrow"><ErrorBanner error={loadError} /><Link to="/">Back to Today</Link></div>;
  if (!visit) return <p className="muted">Loading…</p>;

  function handleInsertTemplate(newItems: PrescriptionItem[], mode: 'append' | 'replace') {
    setShowTemplates(false);
    const shaped: ItemForm[] = newItems.map((i) => ({
      medicine: i.medicine ?? '',
      strength: i.strength ?? '',
      dose: i.dose ?? '',
      route: i.route ?? '',
      frequency: i.frequency ?? '',
      duration: i.duration ?? '',
      instructions: i.instructions ?? '',
    }));
    if (mode === 'replace') {
      setItems(shaped);
    } else {
      const existing = items.filter((it) => Object.values(it).some((v) => v.trim() !== ''));
      setItems([...existing, ...shaped]);
    }
    setNotice(`Added ${shaped.length} medicines from template.`);
  }

  const isDraft = visit.status === 'draft';
  const editable = (isDraft && can('visit:write')) || amending;
  const fe = fieldErrorsOf(error);
  const conflict = error instanceof ApiError && error.status === 409;


  async function run(fn: () => Promise<Visit | void>, okMsg?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const v = await fn();
      if (v) adopt(v);
      if (okMsg) setNotice(okMsg);
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const saveDraft = () => run(() => api<Visit>('PATCH', `/api/visits/${visit.id}`, { version: visit.version, ...changes }), 'Draft saved.');

  async function finalise() {
    setConfirmFinalise(false);
    await run(async () => {
      let v = visit!;
      if (dirty) v = await api<Visit>('PATCH', `/api/visits/${v.id}`, { version: v.version, ...changes });
      return api<Visit>('POST', `/api/visits/${v.id}/finalise`, { version: v.version });
    }, 'Consultation finalised. The notes are now locked; later corrections need a reason and are recorded.');
  }

  const navigate = useNavigate();

  async function handleSaveAndPrint(finaliseFirst: boolean) {
    setBusy(true);
    setError(null);
    try {
      let v = visit!;
      if (dirty) {
        if (amending) {
          if (reason.trim().length >= 5) {
            v = await api<Visit>('POST', `/api/visits/${v.id}/amend`, { version: v.version, reason, ...changes });
            setAmending(false);
            setReason('');
            adopt(v);
          }
        } else {
          v = await api<Visit>('PATCH', `/api/visits/${v.id}`, { version: v.version, ...changes });
          adopt(v);
        }
      }
      if (finaliseFirst && v.status === 'draft') {
        v = await api<Visit>('POST', `/api/visits/${v.id}/finalise`, { version: v.version });
        adopt(v);
      }
      navigate(`/visits/${v.id}/print?autoPrint=1`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function submitAmendment(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() => api<Visit>('POST', `/api/visits/${visit!.id}/amend`, { version: visit!.version, reason, ...changes }), 'Amendment recorded.');
    if (ok) {
      setAmending(false);
      setReason('');
    }
  }

  async function viewRevision(no: number) {
    if (viewing?.no === no) return setViewing(null);
    try {
      setViewing(await api('GET', `/api/visits/${visit!.id}/revisions/${no}`).then((r) => ({ no, snapshot: (r as { snapshot: never }).snapshot })));
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div className="page narrow">
      <p>
        <Link to="/">← Today</Link> · <Link to={`/patients/${visit.patientId}`}>Patient record</Link>
      </p>
      <header className="patient-head">
        <div>
          <h1>{visit.patientName}</h1>
          <div className="muted">
            {visit.patientNumber} · {formatAge(visit.ageYears, visit.ageIsEstimated)} · Visit {visit.visitDate} {visit.visitTime}
          </div>
          <div className="chips" style={{ marginTop: '0.35rem' }}>
            <ObstetricChip gravida={visit.gravida} para={visit.para} abortions={visit.abortions} living={visit.living} />
            <PregnancyChip lmp={visit.lastMenstrualPeriod as string | null} asOfDate={visit.visitDate} showLmp />
          </div>
        </div>
        <span className={`badge ${isDraft ? 'warn' : 'ok'}`}>{isDraft ? 'Draft' : `Finalised${visit.finalisedByName ? ` by ${visit.finalisedByName}` : ''}`}</span>
      </header>
      <p className="row wrap" style={{ gap: '0.5rem' }}>
        {isDraft ? (
          <>
            <button
              type="button"
              className="btn small"
              disabled={busy || normItems(items).length === 0}
              onClick={() => void handleSaveAndPrint(false)}
              title="Save current prescription medicines and open print sheet in draft preview mode"
            >
              📄 Print / Save Rx PDF (Draft)
            </button>
            {can('visit:finalise') && (
              <button
                type="button"
                className="btn small primary"
                disabled={busy || normItems(items).length === 0}
                onClick={() => void handleSaveAndPrint(true)}
                title="Save changes, lock consultation with doctor's digital signature, and open printable PDF immediately"
              >
                ⚡ Finalise &amp; Print Official Rx
              </button>
            )}
          </>
        ) : (
          <>
            <Link className="btn small primary" to={`/visits/${visit.id}/print`}>
              🖨️ Print / Save Rx PDF
            </Link>
            <button
              type="button"
              className="btn small"
              onClick={() => setShowCommModal(true)}
              title="Share prescription advice via WhatsApp or SMS"
            >
              💬 Share Rx via WhatsApp
            </button>
          </>
        )}
      </p>
      <div className={`allergy-banner ${visit.allergyStatus}`}>
        <AllergyBadge status={visit.allergyStatus} details={visit.allergyDetails} />
      </div>

      <ErrorBanner error={error} />
      {conflict && (
        <button className="btn" onClick={() => { setError(null); void load(); }}>
          Reload the latest version (your unsaved changes will be lost)
        </button>
      )}
      {notice && <div className="banner ok" role="status">{notice}</div>}

      {!isDraft && visit.followUpDate && (
        <section className="card stack">
          <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Follow-up advised: {visit.followUpDate}</strong>
              {visit.followUpAppointment ? (
                <div style={{ marginTop: '0.25rem' }}>
                  <span className="badge ok">✓ Booked for {visit.followUpAppointment.scheduledDate} {visit.followUpAppointment.scheduledTime}</span>
                </div>
              ) : (
                <div className="muted small" style={{ marginTop: '0.25rem' }}>
                  No appointment booked yet for this follow-up.
                </div>
              )}
            </div>
            {can('appointment:create') && !visit.followUpAppointment && (
              <button
                type="button"
                className="btn primary small"
                onClick={() => setBookingFollowUp((b) => !b)}
              >
                + Book follow-up appointment
              </button>
            )}
          </div>
          {bookingFollowUp && (
            <BookAppointment
              patient={{ id: visit.patientId, name: visit.patientName }}
              defaultDate={visit.followUpDate}
              defaultReason="Follow-up consultation"
              onCancel={() => setBookingFollowUp(false)}
              onBooked={() => {
                setBookingFollowUp(false);
                void load();
              }}
            />
          )}
        </section>
      )}

      {!isDraft && <VisitInvoice patientId={visit.patientId} visitId={visit.id} />}
      <VitalsCard visit={visit} canAdd={isDraft && can('vitals:write')} onAdded={adopt} />

      {can('attachment:read') && (
        <Documents patientId={visit.patientId} currentVisitId={visit.id} />
      )}

      <form onSubmit={(e) => { e.preventDefault(); if (isDraft) void saveDraft(); }} className="stack">
        <fieldset className="card" disabled={!editable}>
          <legend>Consultation{!editable && <span className="muted small"> (read only)</span>}</legend>

          {editable && (
            <DictationToolbar
              activeField={activeDictationField}
              fieldLabels={Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, f.label]))}
              onSelectField={(k) => {
                const tk = k as TextKey;
                setActiveDictationField(tk);
                activeDictationFieldRef.current = tk;
              }}
              onAppendText={handleAppendDictation}
              speechRecognition={dictation}
            />
          )}

          <div className="stack">
            {TEXT_FIELDS.map((f) => (
              <div key={f.key} style={{ position: 'relative' }}>
                {editable && (
                  <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 1 }}>
                    <VoiceFieldMic
                      isListening={dictation.isListening && activeDictationField === f.key}
                      onToggle={() => toggleFieldDictation(f.key)}
                      title={
                        dictation.isListening && activeDictationField === f.key
                          ? `Click to stop listening to ${f.label}`
                          : `Click to dictate into ${f.label} by voice`
                      }
                    />
                  </div>
                )}
                <Field label={f.label} error={fe[f.key]}>
                  <textarea
                    rows={3}
                    value={form[f.key]}
                    onFocus={() => {
                      setActiveDictationField(f.key);
                      activeDictationFieldRef.current = f.key;
                    }}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                </Field>
              </div>
            ))}
            <Field label="Follow-up date" error={fe.followUpDate}>
              <input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="card" disabled={!editable}>
          <legend>Prescription{!editable && <span className="muted small"> (read only)</span>}</legend>

          {editable && (
            <QuickMedPicker
              onSelect={(qm) => setItems((curr) => applyQuickMedication(curr, qm))}
              disabled={!editable}
            />
          )}

          {/* Antenatal Prescription Teratogen / Fetotoxic Alerts Banner */}
          {prescriptionSafetyAlerts.length > 0 && (
            <div
              style={{
                background: '#fef2f2',
                border: '1.5px solid #ef4444',
                borderRadius: '8px',
                padding: '0.8rem 1rem',
                margin: '0.6rem 0',
                boxShadow: '0 2px 4px rgba(239, 68, 68, 0.1)',
              }}
            >
              <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <strong style={{ color: '#991b1b', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>⛔</span> TERATOGENIC / FETOTOXIC ALERT (Pregnancy Safety Warning)
                </strong>
                {currentGa && (
                  <span className="badge" style={{ background: '#b91c1c', color: '#ffffff', fontWeight: 'bold' }}>
                    GA: {currentGa.formatted}
                  </span>
                )}
              </div>
              {prescriptionSafetyAlerts.map((alert) => (
                <div key={alert.index} style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: '#7f1d1d' }}>
                  <div>
                    <strong>#{alert.index + 1} {alert.medicine}:</strong>{' '}
                    <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{alert.evaluation!.severityTitle}</span> (FDA Cat: {alert.evaluation!.fdaCategory})
                  </div>
                  <div style={{ marginTop: '0.15rem' }}>{alert.evaluation!.warningSummary}</div>
                  {alert.evaluation!.suggestedAlternatives.length > 0 && (
                    <div className="row wrap" style={{ alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem' }}>
                      <span style={{ fontWeight: 'bold', color: '#166534', fontSize: '0.78rem' }}>Safe Alternatives:</span>
                      {alert.evaluation!.suggestedAlternatives.map((alt) => {
                        const cleanAlt = alt.split('(')[0]?.trim() || alt;
                        return (
                          <button
                            key={alt}
                            type="button"
                            className="chip-btn pill-add"
                            style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}
                            onClick={() => {
                              setItems((curr) =>
                                curr.map((x, j) =>
                                  j === alert.index
                                    ? {
                                        ...x,
                                        medicine: cleanAlt || '',
                                        strength: '',
                                        instructions: 'Pregnancy-safe substitute',
                                      }
                                    : x
                                )
                              );
                            }}
                          >
                            🔄 Switch to {cleanAlt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {items.length === 0 && <p className="muted">{editable ? 'No medicines added.' : 'No medicines prescribed.'}</p>}
          <div className="stack">
            {items.map((it, i) => (
              <div key={i} className="rx-item">
                <div className="rx-head">
                  <strong>#{i + 1}</strong>
                  {editable && (
                    <button type="button" className="btn small" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid2">
                  {ITEM_FIELDS.map((f) => (
                    <div key={f.key} className={f.wide ? 'span2' : ''}>
                      <Field label={f.label} error={fe[`prescriptionItems.${i}.${f.key}`]}>
                        <input
                          list={f.key === 'medicine' ? 'rx-medicine-suggestions' : f.key === 'route' ? 'rx-route-suggestions' : undefined}
                          value={it[f.key]}
                          placeholder={editable ? f.placeholder : undefined}
                          onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))}
                        />
                        {editable && f.key === 'medicine' && it.medicine && (() => {
                          const std = findStandardDirections(it.medicine);
                          if (!std) return null;
                          return (
                            <div style={{ marginTop: '0.25rem' }}>
                              <button
                                type="button"
                                className="chip-btn pill-add"
                                onClick={() =>
                                  setItems(
                                    items.map((x, j) =>
                                      j === i
                                        ? {
                                            ...x,
                                            medicine: std.medicine,
                                            strength: std.strength,
                                            dose: std.dose,
                                            route: std.route,
                                            frequency: std.frequency,
                                            duration: std.duration,
                                            instructions: std.instructions,
                                          }
                                        : x
                                    )
                                  )
                                }
                              >
                                ⚡ Fill standard directions ({std.strength}, {std.frequency})
                              </button>
                            </div>
                          );
                        })()}
                        {isMaternity && f.key === 'medicine' && it.medicine && (() => {
                          const safety = evaluatePrescriptionSafety(it.medicine, currentGa?.weeks ?? null);
                          const badgeStyle = getRiskBadgeStyle(safety.evaluatedRiskLevel);
                          return (
                            <div
                              style={{
                                marginTop: '0.3rem',
                                padding: '0.35rem 0.55rem',
                                borderRadius: '5px',
                                fontSize: '0.76rem',
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '0.3rem',
                                ...badgeStyle,
                              }}
                            >
                              <div>
                                <strong>FDA Cat {safety.fdaCategory}:</strong> {safety.severityTitle}
                                <span style={{ display: 'block', fontSize: '0.72rem', marginTop: '0.1rem' }}>
                                  {safety.warningSummary}
                                </span>
                              </div>
                              {editable && safety.suggestedAlternatives.length > 0 && (safety.evaluatedRiskLevel === 'contraindicated' || safety.evaluatedRiskLevel === 'high_risk') && (
                                <button
                                  type="button"
                                  className="btn small"
                                  style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', background: '#ffffff', color: '#166534', border: '1px solid #166534' }}
                                  onClick={() => {
                                    const clean = safety.suggestedAlternatives[0]?.split('(')[0]?.trim() || safety.suggestedAlternatives[0] || '';
                                    setItems((curr) => curr.map((x, j) => (j === i ? { ...x, medicine: clean } : x)));
                                  }}
                                >
                                  🔄 Switch to {safety.suggestedAlternatives[0]?.split('(')[0]?.trim()}
                                </button>
                              )}
                            </div>
                          );
                        })()}
                        {editable && f.key === 'frequency' && (
                          <div className="chips rx-chips">
                            {FREQ_OPTIONS.map((c) => (
                              <button
                                key={c.label}
                                type="button"
                                className={`chip-btn ${it.frequency === c.val ? 'active' : ''}`}
                                onClick={() => setItems(items.map((x, j) => (j === i ? { ...x, frequency: c.val } : x)))}
                              >
                                {c.label}
                              </button>
                            ))}
                          </div>
                        )}
                        {editable && f.key === 'duration' && (
                          <div className="chips rx-chips">
                            {DUR_OPTIONS.map((d) => (
                              <button
                                key={d.label}
                                type="button"
                                className={`chip-btn ${it.duration === d.val ? 'active' : ''}`}
                                onClick={() => setItems(items.map((x, j) => (j === i ? { ...x, duration: d.val } : x)))}
                              >
                                {d.label}
                              </button>
                            ))}
                          </div>
                        )}
                        {editable && f.key === 'route' && (
                          <div className="chips rx-chips">
                            {ROUTE_OPTIONS.map((r) => (
                              <button
                                key={r}
                                type="button"
                                className={`chip-btn ${it.route === r ? 'active' : ''}`}
                                onClick={() => setItems(items.map((x, j) => (j === i ? { ...x, route: r } : x)))}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        )}
                        {editable && f.key === 'instructions' && (
                          <div className="chips rx-chips">
                            {INSTR_OPTIONS.map((ins) => (
                              <button
                                key={ins}
                                type="button"
                                className="chip-btn"
                                onClick={() =>
                                  setItems(
                                    items.map((x, j) =>
                                      j === i
                                        ? {
                                            ...x,
                                            instructions: x.instructions ? `${x.instructions}; ${ins}` : ins,
                                          }
                                        : x
                                    )
                                  )
                                }
                              >
                                + {ins}
                              </button>
                            ))}
                          </div>
                        )}
                      </Field>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {editable && items.length < 30 && (
            <div className="row wrap" style={{ gap: '0.6rem', marginTop: '0.8rem' }}>
              <button type="button" className="btn" onClick={() => setItems([...items, emptyItem()])}>
                + Add medicine
              </button>
              <button type="button" className="btn" onClick={() => setShowTemplates(true)}>
                + Insert template…
              </button>
            </div>
          )}

          {/* Immediate Action Bar right after entering prescription */}
          <div
            className="rx-immediate-actions-bar"
            style={{
              marginTop: '1.25rem',
              padding: '0.85rem 1rem',
              background: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>🖨️</span> Immediate Prescription Print &amp; PDF
              </div>
              <div className="muted small">
                {normItems(items).length === 0
                  ? 'Add at least one medicine above to print or generate prescription PDF.'
                  : `${normItems(items).length} medicine${normItems(items).length === 1 ? '' : 's'} prescribed. Click below to take print or save PDF immediately.`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {isDraft ? (
                <>
                  <button
                    type="button"
                    className="btn small"
                    disabled={busy || normItems(items).length === 0}
                    onClick={() => void handleSaveAndPrint(false)}
                    title="Save current prescription medicines and open print sheet in draft mode"
                  >
                    📄 Print / Save PDF (Draft)
                  </button>
                  {can('visit:finalise') && (
                    <button
                      type="button"
                      className="btn small primary"
                      disabled={busy || normItems(items).length === 0}
                      onClick={() => void handleSaveAndPrint(true)}
                      title="Save all changes, finalise consultation with doctor signature, and open printable PDF immediately"
                    >
                      ⚡ Finalise &amp; Print Official Rx
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  className="btn small primary"
                  disabled={busy}
                  onClick={() => void handleSaveAndPrint(false)}
                  title="Open official signed prescription for printing or saving as PDF"
                >
                  🖨️ Print / Save Rx PDF
                </button>
              )}
            </div>
          </div>
          {editable && <p className="muted small">Doses and medicines are entered by the doctor; the system never suggests them.</p>}
          <datalist id="rx-medicine-suggestions">
            {MEDICINE_SUGGESTIONS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <datalist id="rx-route-suggestions">
            {ROUTE_CHIPS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </fieldset>

        {amending && (
          <div className="card stack">
            <h2>Amendment</h2>
            <p className="muted">The original finalised version stays on record. Say why you are changing it.</p>
            <Field label="Reason for amendment" error={fe.reason}>
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            </Field>
          </div>
        )}

        <div className="sticky-actions">
          {isDraft && can('visit:write') && (
            <>
              <button className="btn" disabled={busy || !dirty}>
                {busy ? 'Saving…' : 'Save draft'}
              </button>
              {can('visit:finalise') &&
                (confirmFinalise ? (
                  <>
                    <button type="button" className="btn primary" disabled={busy} onClick={() => void finalise()}>
                      Confirm: finalise and lock
                    </button>
                    <button type="button" className="btn" onClick={() => setConfirmFinalise(false)}>
                      Not yet
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn primary" disabled={busy} onClick={() => setConfirmFinalise(true)}>
                      Finalise consultation
                    </button>
                    {normItems(items).length > 0 && (
                      <button
                        type="button"
                        className="btn primary"
                        disabled={busy}
                        onClick={() => void handleSaveAndPrint(true)}
                        title="Finalise consultation and take print / save PDF immediately"
                      >
                        ⚡ Finalise &amp; Print Rx
                      </button>
                    )}
                  </>
                ))}
              {dirty && <span className="muted small">Unsaved changes</span>}
            </>
          )}
          {!isDraft && can('visit:finalise') && !amending && (
            <button type="button" className="btn" onClick={() => setAmending(true)}>
              Amend (with reason)
            </button>
          )}
          {amending && (
            <>
              <button type="button" className="btn primary" disabled={busy || !dirty || reason.trim().length < 5} onClick={(e) => void submitAmendment(e as unknown as FormEvent)}>
                {busy ? 'Saving…' : 'Save amendment'}
              </button>
              <button type="button" className="btn" onClick={() => { setAmending(false); setReason(''); adopt(visit); }}>
                Cancel
              </button>
            </>
          )}
        </div>
      </form>

      {(visit.revisions ?? []).length > 0 && (
        <section className="card stack">
          <h2>History of this record</h2>
          <ul className="cards">
            {(visit.revisions ?? []).map((r) => (
              <li key={r.revisionNo}>
                <div className="row wrap">
                  <strong>{r.kind === 'final' ? 'Finalised' : `Amendment ${r.revisionNo - 1}`}</strong>
                  <span className="muted">
                    {r.authorName} · {r.atDate} {r.atTime}
                  </span>
                  <button type="button" className="link" onClick={() => void viewRevision(r.revisionNo)}>
                    {viewing?.no === r.revisionNo ? 'hide this version' : 'view this version'}
                  </button>
                </div>
                {r.reason && <div>Reason: {r.reason}</div>}
                {r.changes && <div className="muted small">Changed: {Object.keys(r.changes).map((k) => LABEL[k] ?? k).join(', ')}</div>}
                {viewing?.no === r.revisionNo && <Snapshot snapshot={viewing.snapshot} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {showTemplates && (
        <TemplatePicker onInsert={handleInsertTemplate} onClose={() => setShowTemplates(false)} />
      )}

      {showCommModal && (
        <CommunicationModal
          open={true}
          onClose={() => setShowCommModal(false)}
          patientId={visit.patientId}
          patientName={visit.patientName}
          patientPhone={visit.patientPhone}
          defaultType="prescription"
          prescriptionData={{
            doctorName: visit.finalisedByName ?? undefined,
            visitDate: visit.visitDate,
            items: (visit.prescriptionItems ?? []).map((it) => ({
              name: (it.medicine ?? '') + (it.strength ? ` ${it.strength}` : ''),
              dose: it.dose,
              route: it.route,
              frequency: it.frequency,
              duration: it.duration,
              instructions: it.instructions,
            })),
            generalAdvice: visit.advice,
            followUpDate: visit.followUpDate,
          }}
        />
      )}
    </div>
  );
}

function Snapshot({ snapshot }: { snapshot: Record<string, unknown> & { prescriptionItems?: PrescriptionItem[] | null } }) {
  const rx = snapshot.prescriptionItems ?? [];
  return (
    <div className="snapshot">
      {TEXT_FIELDS.map((f) => (
        <p key={f.key}><strong>{f.label}:</strong> {(snapshot[f.key] as string | null) ?? '—'}</p>
      ))}
      <p><strong>Follow-up date:</strong> {(snapshot.followUpDate as string | null) ?? '—'}</p>
      <p><strong>Prescription:</strong></p>
      {rx.length === 0 ? <p>—</p> : (
        <ol>
          {rx.map((i, n) => (
            <li key={n}>{[i.medicine, i.strength, i.dose, i.route, i.frequency, i.duration, i.instructions].filter(Boolean).join(' · ')}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

function VitalsCard({ visit, canAdd, onAdded }: { visit: Visit; canAdd: boolean; onAdded: (v: Visit) => void }) {
  const empty = { systolicMmhg: '', diastolicMmhg: '', pulseBpm: '', temperatureC: '', weightKg: '', heightCm: '', note: '' };
  const [f, setF] = useState(empty);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fe = fieldErrorsOf(error);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: Record<string, number | string | null> = {};
    for (const [k, val] of Object.entries(f)) {
      if (val.trim() === '') continue;
      body[k] = k === 'note' ? val.trim() : Number(val);
    }
    try {
      onAdded(await api<Visit>('POST', `/api/visits/${visit.id}/vitals`, body));
      setF(empty);
      setOpen(false);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const num = (key: keyof typeof empty, label: string, step = '1') => (
    <Field label={label} error={fe[key]}>
      <input type="number" inputMode="decimal" step={step} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
    </Field>
  );

  return (
    <section className="card stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h2 style={{ margin: 0 }}>Vitals</h2>
        {canAdd && !open && (
          <button className="btn primary" onClick={() => setOpen(true)}>
            + Record vitals
          </button>
        )}
      </div>
      {(visit.vitals ?? []).length === 0 && !open && <p className="muted">No vitals recorded yet.</p>}
      <ul className="cards">
        {(visit.vitals ?? []).map((v) => {
          const alerts = evaluateVitalsAlerts(v);
          return (
            <li key={v.id}>
              <div className="row wrap" style={{ alignItems: 'center', gap: '0.4rem' }}>
                <span>{fmtVitals(v)}</span>
                <BmiBadge weightKg={v.weightKg} heightCm={v.heightCm} />
                <VitalsAlertBadges alerts={alerts} />
              </div>
              <div className="muted small">
                {v.recordedTime} · {v.recordedByName}
                {v.note ? ` · ${v.note}` : ''}
              </div>
            </li>
          );
        })}
      </ul>
      {open && (
        <form onSubmit={submit} className="stack">
          <ErrorBanner error={error} />
          <div className="grid2">
            {num('systolicMmhg', 'Systolic BP (mmHg)')}
            {num('diastolicMmhg', 'Diastolic BP (mmHg)')}
            {num('pulseBpm', 'Pulse (beats/min)')}
            {num('temperatureC', 'Temperature (°C)', '0.1')}
            {num('weightKg', 'Weight (kg)', '0.1')}
            {num('heightCm', 'Height (cm)', '0.1')}
          </div>
          <LiveVitalsAlertBanner vitals={f} />
          {calculateBmi(f.weightKg, f.heightCm) && (
            <div>
              <BmiBadge weightKg={f.weightKg} heightCm={f.heightCm} />
            </div>
          )}
          <Field label="Note (optional)" error={fe.note}>
            <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={500} />
          </Field>
          <div className="row">
            <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save reading'}</button>
            <button type="button" className="btn" onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
          </div>
          <p className="muted small">Each reading is saved as its own entry with your name and time. To correct a value, add a new reading.</p>
        </form>
      )}
    </section>
  );
}
