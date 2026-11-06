import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type LabOrder,
  type LabOrderListResponse,
  type LabOrderStatus,
  type LabPriority,
  type LabResultItem,
  type LabResultFlag,
} from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, Field, todayLocal } from './ui';
import {
  LAB_PANELS,
  evaluateLabResultFlag,
  type LabCategory,
  type LabTestDef,
} from '../labCatalog';

interface Props {
  patientId: number;
  onChanged?: () => void;
}

const STATUS_LABELS: Record<LabOrderStatus, { label: string; badgeClass: string }> = {
  ordered: { label: '⏳ Ordered', badgeClass: 'badge' },
  sample_collected: { label: '🩸 Sample Collected', badgeClass: 'badge info' },
  sent_to_lab: { label: '🚚 Sent to Lab', badgeClass: 'badge info' },
  completed: { label: '✓ Completed', badgeClass: 'badge ok' },
  cancelled: { label: '✕ Cancelled', badgeClass: 'badge muted' },
};

const FLAG_LABELS: Record<LabResultFlag, { label: string; style: React.CSSProperties }> = {
  normal: { label: 'Normal', style: { color: '#16a34a', fontWeight: 600 } },
  low: { label: '🔻 Low', style: { color: '#2563eb', fontWeight: 700 } },
  high: { label: '🔺 High', style: { color: '#d97706', fontWeight: 700 } },
  critical: { label: '🚨 Critical Alert', style: { color: '#dc2626', fontWeight: 800, background: '#fee2e2', padding: '0.1rem 0.35rem', borderRadius: '3px' } },
  abnormal: { label: '⚠️ Abnormal / Reactive', style: { color: '#b91c1c', fontWeight: 700 } },
  pending: { label: 'Pending', style: { color: '#94a3b8' } },
};

export function LabTracker({ patientId, onChanged }: Props) {
  const { can } = useAuth();
  const canEdit = can('patient:write_clinical') || can('care:write_nursing');

  const [orders, setOrders] = useState<LabOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  // New Order Dialog State
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [selectedPanelId, setSelectedPanelId] = useState<string>('antenatal_first_trimester');
  const [orderPriority, setOrderPriority] = useState<LabPriority>('routine');
  const [orderDate, setOrderDate] = useState(todayLocal());
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [selectedTests, setSelectedTests] = useState<LabTestDef[]>([]);

  // Custom Test addition
  const [customTestName, setCustomTestName] = useState('');
  const [customCategory, setCustomCategory] = useState<LabCategory>('general');
  const [customUnit, setCustomUnit] = useState('');
  const [customRange, setCustomRange] = useState('');

  // Result entry state: resultId -> { val, flag, notes }
  const [editingResultId, setEditingResultId] = useState<number | null>(null);
  const [resultVal, setResultVal] = useState('');
  const [resultFlag, setResultFlag] = useState<LabResultFlag>('normal');
  const [resultNotes, setResultNotes] = useState('');
  const [savingResult, setSavingResult] = useState(false);
  const [resultError, setResultError] = useState<unknown>(null);

  const [orderSaving, setOrderSaving] = useState(false);
  const [orderFormError, setOrderFormError] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api<LabOrderListResponse>('GET', `/api/patients/${patientId}/lab-orders`);
      setOrders(res.orders);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  // When panel changes in dialog, pre-select its tests
  useEffect(() => {
    const panel = LAB_PANELS.find((p) => p.id === selectedPanelId);
    if (panel) {
      setSelectedTests([...panel.tests]);
    } else {
      setSelectedTests([]);
    }
  }, [selectedPanelId]);

  const handleToggleTest = (test: LabTestDef) => {
    const exists = selectedTests.some((t) => t.testName === test.testName);
    if (exists) {
      setSelectedTests(selectedTests.filter((t) => t.testName !== test.testName));
    } else {
      setSelectedTests([...selectedTests, test]);
    }
  };

  const handleAddCustomTest = () => {
    if (!customTestName.trim()) return;
    const newTest: LabTestDef = {
      testName: customTestName.trim(),
      category: customCategory,
      unit: customUnit.trim(),
      referenceRange: customRange.trim(),
      defaultSpecimen: 'Routine sample',
    };
    setSelectedTests([...selectedTests, newTest]);
    setCustomTestName('');
    setCustomUnit('');
    setCustomRange('');
  };

  const submitOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedTests.length === 0) {
      setOrderFormError(new Error('Please select at least one test to order.'));
      return;
    }

    try {
      setOrderSaving(true);
      setOrderFormError(null);

      const panel = LAB_PANELS.find((p) => p.id === selectedPanelId);

      await api('POST', `/api/patients/${patientId}/lab-orders`, {
        orderDate,
        priority: orderPriority,
        panelName: panel?.title ?? 'Custom Test Order',
        clinicalNotes: clinicalNotes.trim() || null,
        items: selectedTests.map((t) => ({
          testName: t.testName,
          category: t.category,
          unit: t.unit || null,
          referenceRange: t.referenceRange || null,
        })),
      });

      setShowOrderForm(false);
      setClinicalNotes('');
      await load();
      onChanged?.();
    } catch (err) {
      setOrderFormError(err);
    } finally {
      setOrderSaving(false);
    }
  };

  const updateOrderStatus = async (orderId: number, status: LabOrderStatus) => {
    try {
      await api('PATCH', `/api/lab-orders/${orderId}/status`, { status });
      await load();
      onChanged?.();
    } catch (err) {
      setError(err);
    }
  };

  const startEditResult = (item: LabResultItem) => {
    setEditingResultId(item.id);
    setResultVal(item.resultValue ?? '');
    setResultFlag(item.flag ?? 'normal');
    setResultNotes(item.notes ?? '');
    setResultError(null);
  };

  const handleResultChange = (val: string, testName: string) => {
    setResultVal(val);
    const flag = evaluateLabResultFlag(testName, val);
    setResultFlag(flag);
  };

  const saveResult = async (item: LabResultItem) => {
    try {
      setSavingResult(true);
      setResultError(null);

      await api('PATCH', `/api/lab-results/${item.id}`, {
        resultValue: resultVal.trim() || null,
        flag: resultFlag,
        notes: resultNotes.trim() || null,
        reportedDate: todayLocal(),
        status: resultVal.trim() ? 'completed' : 'pending',
      });

      setEditingResultId(null);
      await load();
      onChanged?.();
    } catch (err) {
      setResultError(err);
    } finally {
      setSavingResult(false);
    }
  };

  const totalOrders = orders?.length ?? 0;
  const pendingOrders = orders?.filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length ?? 0;
  const criticalCount = orders?.flatMap((o) => o.items).filter((i) => i.flag === 'critical' || i.flag === 'abnormal').length ?? 0;

  return (
    <section className="card stack" style={{ marginTop: '1.25rem' }}>
      {/* Header Bar */}
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🧪</span> Diagnostic Lab Investigations &amp; Panels
          </h2>
          <div className="muted small">
            Order pathology &amp; biochemistry tests, track sample turnaround, and monitor abnormal value alerts
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            className="btn primary small"
            onClick={() => setShowOrderForm((s) => !s)}
          >
            {showOrderForm ? 'Close Requisition Form' : '+ Order Lab Tests'}
          </button>
        )}
      </div>

      <ErrorBanner error={error} />

      {/* Summary Stats */}
      {orders && orders.length > 0 && (
        <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
          <div className="stat">
            <b>{totalOrders}</b>
            <span>Total Orders</span>
          </div>
          <div className="stat">
            <b style={{ color: pendingOrders > 0 ? '#d97706' : undefined }}>{pendingOrders}</b>
            <span>Active / In Progress</span>
          </div>
          <div className="stat">
            <b style={{ color: criticalCount > 0 ? '#dc2626' : undefined }}>{criticalCount}</b>
            <span>Abnormal Alerts</span>
          </div>
        </div>
      )}

      {/* Order Requisition Modal / Form */}
      {showOrderForm && (
        <form onSubmit={(e) => void submitOrder(e)} className="card stack" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0 }}>Create Laboratory Requisition</h3>
          <ErrorBanner error={orderFormError} />

          <div className="grid-2" style={{ gap: '0.8rem' }}>
            <Field label="Order Date">
              <input
                type="date"
                required
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </Field>

            <Field label="Priority Level">
              <select
                value={orderPriority}
                onChange={(e) => setOrderPriority(e.target.value as LabPriority)}
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">🚨 STAT / Emergency</option>
              </select>
            </Field>
          </div>

          <Field label="Clinical Indication / Diagnosis Notes">
            <input
              value={clinicalNotes}
              placeholder="e.g. Antenatal booking, rule out gestational diabetes, persistent fever"
              onChange={(e) => setClinicalNotes(e.target.value)}
            />
          </Field>

          {/* Preset Panel Selection */}
          <div className="stack" style={{ gap: '0.4rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Select Standard Investigation Panel:</label>
            <div className="row wrap" style={{ gap: '0.4rem' }}>
              {LAB_PANELS.map((panel) => (
                <button
                  key={panel.id}
                  type="button"
                  className={`btn small ${selectedPanelId === panel.id ? 'primary' : ''}`}
                  onClick={() => setSelectedPanelId(panel.id)}
                >
                  {panel.title}
                </button>
              ))}
              <button
                type="button"
                className={`btn small ${selectedPanelId === 'custom' ? 'primary' : ''}`}
                onClick={() => {
                  setSelectedPanelId('custom');
                  setSelectedTests([]);
                }}
              >
                ✍️ Custom Individual Tests
              </button>
            </div>
          </div>

          {/* Tests in Panel with Checkbox selection */}
          <div style={{ background: 'var(--surface)', padding: '0.6rem 0.8rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
            <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <strong style={{ fontSize: '0.85rem' }}>Selected Tests ({selectedTests.length}):</strong>
              <span className="muted small">Toggle individual tests as needed</span>
            </div>

            <div className="grid-2" style={{ gap: '0.4rem 1rem' }}>
              {selectedTests.map((t) => (
                <label key={t.testName} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={() => handleToggleTest(t)}
                  />
                  <span>
                    <strong>{t.testName}</strong>
                    {t.referenceRange && <span className="muted"> ({t.referenceRange})</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Add custom extra test */}
          <div className="row wrap" style={{ gap: '0.5rem', alignItems: 'flex-end', paddingTop: '0.3rem' }}>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: '0.78rem' }}>Add Individual Test:</label>
              <input
                value={customTestName}
                placeholder="e.g. Serum Ferritin, D-Dimer, Urine Culture"
                onChange={(e) => setCustomTestName(e.target.value)}
              />
            </div>
            <div style={{ width: '130px' }}>
              <label style={{ fontSize: '0.78rem' }}>Category:</label>
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as LabCategory)}
              >
                <option value="general">General</option>
                <option value="hematology">Hematology</option>
                <option value="biochemistry">Biochemistry</option>
                <option value="serology">Serology</option>
                <option value="urine">Urine</option>
                <option value="hormones">Hormones</option>
                <option value="microbiology">Microbiology</option>
              </select>
            </div>
            <div style={{ width: '90px' }}>
              <label style={{ fontSize: '0.78rem' }}>Units:</label>
              <input
                value={customUnit}
                placeholder="e.g. ng/mL"
                onChange={(e) => setCustomUnit(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn small"
              onClick={handleAddCustomTest}
              disabled={!customTestName.trim()}
            >
              + Add Test
            </button>
          </div>

          {/* Form Actions */}
          <div className="row wrap" style={{ gap: '0.6rem', marginTop: '0.5rem' }}>
            <button className="btn primary" disabled={orderSaving || selectedTests.length === 0}>
              {orderSaving ? 'Submitting Order…' : `Submit Order (${selectedTests.length} tests)`}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setShowOrderForm(false)}
              disabled={orderSaving}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Orders List */}
      {loading && !orders && <p className="muted">Loading laboratory investigations…</p>}

      {orders && orders.length === 0 && !showOrderForm && (
        <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--bg)', borderRadius: '4px' }}>
          <p className="muted">No laboratory investigations ordered for this patient yet.</p>
          {canEdit && (
            <button
              type="button"
              className="btn small primary"
              onClick={() => setShowOrderForm(true)}
            >
              + Create First Lab Requisition
            </button>
          )}
        </div>
      )}

      {orders && orders.length > 0 && (
        <ul className="cards" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {orders.map((o) => {
            const isStat = o.priority === 'stat' || o.priority === 'urgent';
            const statusConfig = STATUS_LABELS[o.status] ?? { label: o.status, badgeClass: 'badge' };

            return (
              <li
                key={o.id}
                className="card stack"
                style={{
                  borderLeft: isStat ? '4px solid #ef4444' : '4px solid #3b82f6',
                  padding: '0.8rem 1rem',
                  gap: '0.5rem',
                }}
              >
                {/* Order Top Line */}
                <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="row wrap" style={{ gap: '0.5rem', alignItems: 'center' }}>
                      <strong style={{ fontSize: '1rem' }}>{o.orderNumber}</strong>
                      <span className="muted small">({o.orderDate})</span>
                      <span className={statusConfig.badgeClass}>{statusConfig.label}</span>
                      {isStat && (
                        <span className="badge danger small">🚨 {o.priority.toUpperCase()}</span>
                      )}
                      {o.panelName && (
                        <span className="muted small">· {o.panelName}</span>
                      )}
                    </div>

                    {o.clinicalNotes && (
                      <div className="muted small" style={{ marginTop: '0.15rem' }}>
                        <strong>Indication:</strong> {o.clinicalNotes}
                      </div>
                    )}
                  </div>

                  <div className="row wrap" style={{ gap: '0.4rem', alignItems: 'center' }}>
                    <Link
                      to={`/lab-orders/${o.id}/print`}
                      className="btn small"
                      title="Print formal requisition slip"
                    >
                      🖨️ Requisition Slip
                    </Link>

                    {canEdit && o.status === 'ordered' && (
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => void updateOrderStatus(o.id, 'sample_collected')}
                      >
                        🩸 Sample Collected
                      </button>
                    )}

                    {canEdit && o.status === 'sample_collected' && (
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => void updateOrderStatus(o.id, 'sent_to_lab')}
                      >
                        🚚 Sent to Lab
                      </button>
                    )}

                    {canEdit && o.status !== 'completed' && o.status !== 'cancelled' && (
                      <button
                        type="button"
                        className="btn small muted"
                        onClick={() => void updateOrderStatus(o.id, 'cancelled')}
                        title="Cancel this order"
                      >
                        ✕ Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Ordered Items Table */}
                <div style={{ overflowX: 'auto', marginTop: '0.2rem' }}>
                  <table style={{ width: '100%', fontSize: '0.84rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '0.35rem 0.5rem' }}>Investigation Test</th>
                        <th style={{ padding: '0.35rem 0.5rem' }}>Result Value</th>
                        <th style={{ padding: '0.35rem 0.5rem' }}>Unit</th>
                        <th style={{ padding: '0.35rem 0.5rem' }}>Reference Range</th>
                        <th style={{ padding: '0.35rem 0.5rem' }}>Flag</th>
                        <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.items.map((it) => {
                        const isEditingThis = editingResultId === it.id;
                        const flagInfo = FLAG_LABELS[it.flag] ?? FLAG_LABELS.pending;

                        return (
                          <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.4rem 0.5rem' }}>
                              <strong>{it.testName}</strong>
                              <span className="muted small" style={{ display: 'block', textTransform: 'capitalize' }}>
                                {it.category}
                              </span>
                            </td>

                            <td style={{ padding: '0.4rem 0.5rem' }}>
                              {isEditingThis ? (
                                <input
                                  value={resultVal}
                                  placeholder="Enter result"
                                  onChange={(e) => handleResultChange(e.target.value, it.testName)}
                                  style={{ padding: '0.25rem 0.4rem', fontSize: '0.85rem', width: '130px' }}
                                />
                              ) : it.resultValue ? (
                                <span style={{ fontWeight: 600 }}>{it.resultValue}</span>
                              ) : (
                                <span className="muted">Awaiting result</span>
                              )}
                            </td>

                            <td style={{ padding: '0.4rem 0.5rem' }}>{it.unit || '—'}</td>

                            <td style={{ padding: '0.4rem 0.5rem' }} className="muted small">
                              {it.referenceRange || 'Standard'}
                            </td>

                            <td style={{ padding: '0.4rem 0.5rem' }}>
                              {isEditingThis ? (
                                <select
                                  value={resultFlag}
                                  onChange={(e) => setResultFlag(e.target.value as LabResultFlag)}
                                  style={{ padding: '0.2rem', fontSize: '0.8rem' }}
                                >
                                  <option value="normal">Normal</option>
                                  <option value="low">🔻 Low</option>
                                  <option value="high">🔺 High</option>
                                  <option value="critical">🚨 Critical</option>
                                  <option value="abnormal">⚠️ Abnormal</option>
                                </select>
                              ) : (
                                <span style={flagInfo.style}>{flagInfo.label}</span>
                              )}
                            </td>

                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                              {canEdit && (
                                <>
                                  {isEditingThis ? (
                                    <div className="row" style={{ gap: '0.3rem', justifyContent: 'flex-end' }}>
                                      <button
                                        type="button"
                                        className="btn small primary"
                                        onClick={() => void saveResult(it)}
                                        disabled={savingResult}
                                      >
                                        {savingResult ? 'Saving…' : 'Save'}
                                      </button>
                                      <button
                                        type="button"
                                        className="btn small"
                                        onClick={() => setEditingResultId(null)}
                                        disabled={savingResult}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn small"
                                      onClick={() => startEditResult(it)}
                                    >
                                      {it.resultValue ? 'Edit Result' : 'Enter Result'}
                                    </button>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="muted small" style={{ fontSize: '0.72rem' }}>
                  Ordered by {o.orderedByName || 'Clinical staff'} · {o.items.length} investigation items
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
