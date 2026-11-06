import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type AntenatalChecklistResponse,
  type AntenatalTestItem,
  type AntenatalCategory,
  type AntenatalTestStatus,
} from '../api';
import { useAuth } from '../auth';
import { calculateEdd, calculateGestationalAge, getTrimester } from '../pregnancy';
import { ErrorBanner, Field, todayLocal } from './ui';
import type { Attachment } from './Documents';

interface Props {
  patientId: number;
  lastMenstrualPeriod?: string | null;
  onChanged?: () => void;
}

const CATEGORY_LABELS: Record<AntenatalCategory, { title: string; subtitle: string }> = {
  first_trimester: {
    title: '1st Trimester (Booking - 13 Weeks)',
    subtitle: 'Baseline labs, viral serology, NT/NB aneuploidy scan',
  },
  second_trimester: {
    title: '2nd Trimester (14 - 27 Weeks)',
    subtitle: 'Anomaly scan (TIFFA), 75g OGTT GDM screening, repeat Hb',
  },
  third_trimester: {
    title: '3rd Trimester (28 Weeks - Delivery)',
    subtitle: 'Anti-D prophylaxis for Rh-negatives, growth Doppler, pre-delivery Hb',
  },
};

const STATUS_CONFIG: Record<
  AntenatalTestStatus,
  { label: string; badgeClass: string; icon: string }
> = {
  completed: { label: 'Completed', badgeClass: 'badge ok', icon: '✓' },
  ordered: { label: 'Ordered / Sent', badgeClass: 'badge info', icon: '⏳' },
  pending: { label: 'Pending', badgeClass: 'badge warn', icon: '○' },
  not_required: { label: 'Not Required', badgeClass: 'badge', icon: '✕' },
};

// Preset quick result choices for standard tests
const QUICK_RESULTS: Record<string, string[]> = {
  blood_group: ['O Rh-positive (O+)', 'O Rh-negative (O-)', 'A Rh-positive (A+)', 'A Rh-negative (A-)', 'B Rh-positive (B+)', 'B Rh-negative (B-)', 'AB Rh-positive (AB+)', 'AB Rh-negative (AB-)'],
  viral_hiv: ['Non-reactive (Negative)', 'Reactive (Positive)'],
  viral_hbsag: ['Non-reactive (Negative)', 'Reactive (Positive)'],
  viral_vdrl: ['Non-reactive (Negative)', 'Reactive (Positive)'],
  rubella_igg: ['Immune (IgG Positive > 10 IU/mL)', 'Non-immune (IgG Negative)'],
  rh_ict: ['Negative (Unsensitized)', 'Positive (Sensitized, Titer needed)'],
  anti_d: ['Given 300 mcg IM at 28w', 'Not indicated (Rh-positive)'],
  urine_rm_1: ['Normal (Nil protein, Nil sugar, No pus cells)', 'Pus cells 8-10 / Asymptomatic bacteriuria', 'Trace protein', 'Glycosuria +'],
  urine_rm_2: ['Nil protein, Nil sugar', 'Trace protein', 'Proteinuria 1+ (Monitor BP)'],
  urine_rm_3: ['Nil protein, Nil sugar', 'Trace protein', 'Proteinuria 1+ / 2+ (Preeclampsia evaluation)'],
  ogtt: ['Normal (Fasting < 92, 1h < 180, 2h < 153 mg/dL)', 'Normal DIPSI (< 140 mg/dL)', 'Elevated / GDM diagnosed', 'Borderline / Diet counseling'],
  scan_nt: ['Normal CRL & NT (1.4 mm), Nasal bone visible', 'Low risk for Down syndrome (T21/T18/T13)'],
  scan_anomaly: ['No gross fetal structural anomalies seen; AFI normal; Placenta anterior high', 'Low-lying placenta / Follow-up scan needed', 'Mild fetal pyelectasis / Follow-up required'],
  scan_growth: ['Normal interval growth, EFW concordant with GA, AFI adequate, Normal umbilical Doppler', 'Fetal growth restriction (FGR / IUGR) suspected', 'Oligohydramnios (AFI < 5 cm)', 'Polyhydramnios (AFI > 24 cm)'],
};

export function AntenatalChecklist({ patientId, lastMenstrualPeriod, onChanged }: Props) {
  const { can } = useAuth();
  const [data, setData] = useState<AntenatalChecklistResponse | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | AntenatalCategory>('all');
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Edit form state
  const [editStatus, setEditStatus] = useState<AntenatalTestStatus>('completed');
  const [editResult, setEditResult] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editAttachmentId, setEditAttachmentId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);

  const canEdit = can('patient:write_clinical');

  const lmp = typeof lastMenstrualPeriod === 'string' ? lastMenstrualPeriod : null;
  const currentGa = calculateGestationalAge(lmp);
  const edd = calculateEdd(lmp);
  const currentTrimester = currentGa ? getTrimester(currentGa.weeks).trimester : null;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [checklistRes, attRes] = await Promise.all([
        api<AntenatalChecklistResponse>('GET', `/api/patients/${patientId}/antenatal-checklist`),
        can('attachment:read')
          ? api<Attachment[]>('GET', `/api/patients/${patientId}/attachments`).catch(() => [])
          : Promise.resolve([]),
      ]);
      setData(checklistRes);
      setAttachments(attRes);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [patientId, can]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const startEdit = (item: AntenatalTestItem) => {
    setEditingKey(item.testKey);
    setEditStatus(item.status);
    setEditResult(item.resultValue ?? '');
    setEditNotes(item.notes ?? '');
    setEditDate(item.performedDate ?? (item.status === 'completed' ? todayLocal() : ''));
    setEditAttachmentId(item.attachmentId ?? null);
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setSaveError(null);
  };

  const saveEdit = async (testKey: string) => {
    try {
      setSaving(true);
      setSaveError(null);
      await api('PATCH', `/api/patients/${patientId}/antenatal-checklist/${testKey}`, {
        status: editStatus,
        resultValue: editResult.trim() || null,
        notes: editNotes.trim() || null,
        performedDate: editDate || null,
        attachmentId: editAttachmentId,
      });
      setEditingKey(null);
      await loadData();
      onChanged?.();
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  };

  const quickSetStatus = async (item: AntenatalTestItem, targetStatus: AntenatalTestStatus) => {
    if (!canEdit) return;
    try {
      await api('PATCH', `/api/patients/${patientId}/antenatal-checklist/${item.testKey}`, {
        status: targetStatus,
        performedDate: targetStatus === 'completed' && !item.performedDate ? todayLocal() : undefined,
      });
      await loadData();
      onChanged?.();
    } catch (err) {
      setError(err);
    }
  };

  if (loading && !data) {
    return <p className="muted">Loading antenatal investigation checklist…</p>;
  }

  if (error) {
    return <ErrorBanner error={error} />;
  }

  if (!data) return null;

  // Determine if patient has Rh-negative blood group
  const bloodGroupTest = data.tests.find((t) => t.testKey === 'blood_group');
  const isRhNegative =
    Boolean(bloodGroupTest?.resultValue?.toLowerCase().includes('negative')) ||
    Boolean(bloodGroupTest?.resultValue?.toLowerCase().includes('rh-')) ||
    Boolean(bloodGroupTest?.resultValue?.toLowerCase().includes('-ve'));

  const filteredTests =
    activeTab === 'all' ? data.tests : data.tests.filter((t) => t.category === activeTab);

  const categories: AntenatalCategory[] = [
    'first_trimester',
    'second_trimester',
    'third_trimester',
  ];

  const pct = data.summary.completionPercentage;

  return (
    <div className="antenatal-checklist stack" style={{ marginTop: '0.5rem' }}>
      {/* Overview & Progress Summary Header */}
      <div
        className="card"
        style={{
          background: 'var(--surface)',
          borderLeft: '4px solid #0284c7',
          padding: '1rem 1.25rem',
        }}
      >
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🧪 Routine Antenatal Investigation & Screening Checklist</span>
              <span className="badge ok">{pct}% Completed</span>
            </h3>
            <div className="muted small" style={{ marginTop: '0.35rem' }}>
              {lmp && (
                <span>
                  <strong>LMP:</strong> {lmp} · <strong>EDD:</strong> {edd ?? '—'}
                  {currentGa && (
                    <span>
                      {' '}
                      · <strong>Current GA:</strong> {currentGa.formatted} ({getTrimester(currentGa.weeks).label})
                    </span>
                  )}
                  {' · '}
                </span>
              )}
              <span>
                {data.summary.completed} completed, {data.summary.ordered} ordered, {data.summary.pending} pending (of {data.summary.total - data.summary.notRequired} required)
              </span>
            </div>
          </div>

          <div style={{ minWidth: '220px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                marginBottom: '0.3rem',
              }}
            >
              <span>Maternity Panel Progress</span>
              <strong>{pct}%</strong>
            </div>
            <div
              style={{
                height: '10px',
                width: '100%',
                background: 'var(--border)',
                borderRadius: '999px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: pct === 100 ? '#16a34a' : '#0284c7',
                  borderRadius: '999px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* Rh-Negative Alert Banner */}
        {isRhNegative && (
          <div
            className="banner warn"
            style={{ marginTop: '0.9rem', display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}
          >
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <div>
              <strong>Rh-Negative Mother Detected ({bloodGroupTest?.resultValue})</strong>
              <div style={{ fontSize: '0.88rem', marginTop: '0.15rem' }}>
                Ensure Indirect Coombs Test (ICT) antibody screening and 300 mcg Anti-D Immunoglobulin
                prophylaxis are scheduled at 28 weeks gestation, and after any sensitizing event.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trimester Filter Tabs */}
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="quick-meds-tabs" role="tablist">
          <button
            type="button"
            className={activeTab === 'all' ? 'active' : ''}
            onClick={() => setActiveTab('all')}
          >
            All Milestones ({data.tests.length})
          </button>
          {categories.map((cat, idx) => {
            const count = data.tests.filter((t) => t.category === cat).length;
            const completedCount = data.tests.filter(
              (t) => t.category === cat && t.status === 'completed'
            ).length;
            const isCurrent = currentTrimester === idx + 1;
            return (
              <button
                key={cat}
                type="button"
                className={activeTab === cat ? 'active' : ''}
                onClick={() => setActiveTab(cat)}
              >
                {idx + 1}st Trimester {isCurrent ? '⚡' : ''} ({completedCount}/{count})
              </button>
            );
          })}
        </div>

        <div className="muted small">
          Showing {filteredTests.length} investigations
        </div>
      </div>

      {/* Categorized Test Cards */}
      {categories
        .filter((cat) => activeTab === 'all' || activeTab === cat)
        .map((cat, idx) => {
          const items = data.tests.filter((t) => t.category === cat);
          if (items.length === 0) return null;
          const isCurrentTrimester = currentTrimester === idx + 1;

          return (
            <div key={cat} className="card stack" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{CATEGORY_LABELS[cat].title}</span>
                    {isCurrentTrimester && (
                      <span className="badge info small">Current Gestation Milestone</span>
                    )}
                  </h4>
                  <span className="muted small">
                    {items.filter((i) => i.status === 'completed').length} / {items.length} completed
                  </span>
                </div>
                <p className="muted small" style={{ margin: '0.2rem 0 0' }}>
                  {CATEGORY_LABELS[cat].subtitle}
                </p>
              </div>

              <div className="stack" style={{ gap: '0.75rem' }}>
                {items.map((item) => {
                  const cfg = STATUS_CONFIG[item.status];
                  const isEditing = editingKey === item.testKey;

                  return (
                    <div
                      key={item.testKey}
                      className="rx-item"
                      style={{
                        background: isEditing ? 'var(--bg)' : 'var(--surface)',
                        borderLeft:
                          item.status === 'completed'
                            ? '4px solid #16a34a'
                            : item.status === 'ordered'
                            ? '4px solid #0284c7'
                            : item.flagForRhNegative && isRhNegative
                            ? '4px solid #d97706'
                            : '1px solid var(--border)',
                      }}
                    >
                      <div className="rx-head">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <strong>{item.testName}</strong>
                          <span className="badge small" style={{ background: 'transparent' }}>
                            📅 {item.recommendedWeeks}
                          </span>
                          <span className={cfg.badgeClass}>
                            {cfg.icon} {cfg.label}
                          </span>
                          {item.flagForRhNegative && isRhNegative && (
                            <span className="badge warn small">Rh-Neg Essential</span>
                          )}
                        </div>

                        {canEdit && !isEditing && (
                          <div className="row" style={{ gap: '0.4rem' }}>
                            {item.status !== 'completed' && (
                              <button
                                type="button"
                                className="chip-btn pill-add"
                                onClick={() => quickSetStatus(item, 'completed')}
                                title="Mark completed today"
                              >
                                ✓ Complete
                              </button>
                            )}
                            {item.status === 'pending' && (
                              <button
                                type="button"
                                className="chip-btn"
                                onClick={() => quickSetStatus(item, 'ordered')}
                                title="Mark ordered / lab slip sent"
                              >
                                ⏳ Order
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn small"
                              onClick={() => startEdit(item)}
                            >
                              Edit details
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Display View */}
                      {!isEditing ? (
                        <div className="stack" style={{ gap: '0.35rem', fontSize: '0.9rem' }}>
                          <div className="muted small">{item.description}</div>

                          {item.resultValue && (
                            <div
                              style={{
                                background: 'var(--bg)',
                                padding: '0.45rem 0.75rem',
                                borderRadius: 'var(--radius)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              <strong style={{ color: 'var(--text)' }}>Result / Findings: </strong>
                              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                {item.resultValue}
                              </span>
                              {item.performedDate && (
                                <span className="muted small" style={{ marginLeft: '0.75rem' }}>
                                  (Date: {item.performedDate})
                                </span>
                              )}
                            </div>
                          )}

                          {item.attachmentId && (
                            <div className="row" style={{ alignItems: 'center', gap: '0.4rem' }}>
                              <span>📎 Linked Document:</span>
                              <a
                                href={`/api/attachments/${item.attachmentId}/file`}
                                target="_blank"
                                rel="noreferrer"
                                className="badge info small"
                                style={{ textDecoration: 'none' }}
                              >
                                📄 {item.attachmentTitle ?? 'View Attached Report'}
                              </a>
                            </div>
                          )}

                          {item.notes && (
                            <div className="muted small" style={{ fontStyle: 'italic' }}>
                              Notes: {item.notes}
                            </div>
                          )}

                          {item.updatedByName && (
                            <div className="muted small" style={{ fontSize: '0.75rem' }}>
                              Recorded by {item.updatedByName} {item.updatedAt ? `on ${item.updatedAt.slice(0, 10)}` : ''}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Edit View */
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void saveEdit(item.testKey);
                          }}
                          className="stack"
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.75rem',
                            border: '1px dashed var(--border)',
                            borderRadius: 'var(--radius)',
                          }}
                        >
                          <ErrorBanner error={saveError} />
                          <div className="grid2">
                            <Field label="Status">
                              <select
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value as AntenatalTestStatus)}
                              >
                                <option value="pending">Pending</option>
                                <option value="ordered">Ordered / Sent</option>
                                <option value="completed">Completed</option>
                                <option value="not_required">Not required</option>
                              </select>
                            </Field>

                            <Field label="Date Performed">
                              <input
                                type="date"
                                max={todayLocal()}
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                              />
                            </Field>
                          </div>

                          <Field label="Result Value / Findings">
                            <input
                              value={editResult}
                              placeholder="e.g. O Positive, 11.4 g/dL, Normal anatomy..."
                              onChange={(e) => setEditResult(e.target.value)}
                              maxLength={500}
                            />
                            {QUICK_RESULTS[item.testKey] && (
                              <div className="chips rx-chips" style={{ marginTop: '0.3rem' }}>
                                {QUICK_RESULTS[item.testKey]!.map((qr) => (
                                  <button
                                    key={qr}
                                    type="button"
                                    className={`chip-btn ${editResult === qr ? 'active' : ''}`}
                                    onClick={() => setEditResult(qr)}
                                  >
                                    {qr}
                                  </button>
                                ))}
                              </div>
                            )}
                          </Field>

                          <div className="grid2">
                            <Field label="Link Uploaded Report / Scan (Optional)">
                              <select
                                value={editAttachmentId ?? ''}
                                onChange={(e) =>
                                  setEditAttachmentId(e.target.value ? Number(e.target.value) : null)
                                }
                              >
                                <option value="">— None linked —</option>
                                {attachments.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.documentDate} · {a.title} ({a.originalName})
                                  </option>
                                ))}
                              </select>
                            </Field>

                            <Field label="Clinical Notes (Optional)">
                              <input
                                value={editNotes}
                                placeholder="e.g. Advised iron titration, repeat at 28w..."
                                onChange={(e) => setEditNotes(e.target.value)}
                                maxLength={1000}
                              />
                            </Field>
                          </div>

                          <div className="row wrap" style={{ gap: '0.6rem', marginTop: '0.4rem' }}>
                            <button className="btn primary small" disabled={saving}>
                              {saving ? 'Saving…' : 'Save Test Details'}
                            </button>
                            <button
                              type="button"
                              className="btn small"
                              onClick={cancelEdit}
                              disabled={saving}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}
