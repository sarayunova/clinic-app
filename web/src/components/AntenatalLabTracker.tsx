import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type Patient,
  type AntenatalLabTrend,
  type AntenatalLabTrendsResponse,
  type AntenatalSerologyMatrix,
  type AntenatalSerologyResponse,
} from '../api';
import {
  ANTENATAL_LAB_PARAMS,
  evaluateLabFlag,
  classifyAnemia,
  classifyThrombocytopenia,
  evaluateAntenatalReminders,
  getTrimesterFromWeeks,
  type TrimesterKey,
} from '../antenatalLabScoring';
import { calculateGestationalAge, calculateEdd } from '../pregnancyCalc';
import { ErrorBanner } from './ui';

interface Props {
  patient: Patient;
}

export function AntenatalLabTracker({ patient }: Props) {
  const patientId = Number(patient.id);
  const lmp = typeof patient.lastMenstrualPeriod === 'string' ? patient.lastMenstrualPeriod : null;
  const currentGa = calculateGestationalAge(lmp);
  const edd = calculateEdd(lmp);

  const [trends, setTrends] = useState<AntenatalLabTrend[]>([]);
  const [serology, setSerology] = useState<AntenatalSerologyMatrix | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  // Active filter category
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showSerologyModal, setShowSerologyModal] = useState<boolean>(false);

  // Form State for New Lab Trend
  const [newParamKey, setNewParamKey] = useState<string>('hb');
  const [newTestDate, setNewTestDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [newGaWeeks, setNewGaWeeks] = useState<number>(currentGa ? currentGa.weeks : 12);
  const [newGaDays, setNewGaDays] = useState<number>(currentGa ? currentGa.days : 0);
  const [newTrimester, setNewTrimester] = useState<TrimesterKey>(() => getTrimesterFromWeeks(currentGa?.weeks ?? 12));
  const [newValue, setNewValue] = useState<string>('');
  const [newClinicalAction, setNewClinicalAction] = useState<string>('');
  const [savingTrend, setSavingTrend] = useState<boolean>(false);
  const [trendError, setTrendError] = useState<unknown>(null);

  // Form State for Serology Matrix
  const [seroForm, setSeroForm] = useState<Partial<AntenatalSerologyMatrix>>({});
  const [savingSero, setSavingSero] = useState<boolean>(false);
  const [seroError, setSeroError] = useState<unknown>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [trendRes, seroRes] = await Promise.all([
        api<AntenatalLabTrendsResponse>('GET', `/api/patients/${patientId}/antenatal-lab-trends`),
        api<AntenatalSerologyResponse>('GET', `/api/patients/${patientId}/antenatal-serology`),
      ]);
      setTrends(trendRes.allTrends || []);
      setSerology(seroRes.serology);
      if (seroRes.serology) {
        setSeroForm(seroRes.serology);
      } else {
        setSeroForm({
          patientId,
          bloodGroupAbo: (patient.bloodGroup as string) || '',
          indirectCoombsTestBooking: 'not_done',
          indirectCoombsTest28w: 'not_done',
          antiDGiven: false,
          hivStatus: 'not_tested',
          hbsagStatus: 'not_tested',
          hcvStatus: 'not_tested',
          vdrlRprStatus: 'not_tested',
          rubellaIggStatus: 'not_tested',
          gbsCultureStatus: 'not_tested',
          urineCultureStatus: 'not_tested',
          hemoglobinopathyHplc: 'not_tested',
        });
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  // Update trimester whenever gestational age weeks change in add modal
  useEffect(() => {
    setNewTrimester(getTrimesterFromWeeks(newGaWeeks));
  }, [newGaWeeks]);

  const reminders = useMemo(() => {
    return evaluateAntenatalReminders(currentGa?.weeks ?? null);
  }, [currentGa?.weeks]);

  // Handle saving new lab trend
  const handleSaveTrend = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newValue);
    if (isNaN(val)) {
      alert('Please enter a valid numeric value');
      return;
    }

    const paramMeta = ANTENATAL_LAB_PARAMS[newParamKey];
    const flag = evaluateLabFlag(newParamKey, val, newTrimester);
    const range = paramMeta ? paramMeta.trimesterRanges[newTrimester]?.label : null;

    try {
      setSavingTrend(true);
      setTrendError(null);
      await api('POST', `/api/patients/${patientId}/antenatal-lab-trends`, {
        testDate: newTestDate,
        gestationalAgeWeeks: newGaWeeks,
        gestationalAgeDays: newGaDays,
        trimester: newTrimester,
        parameterKey: newParamKey,
        parameterName: paramMeta?.name || newParamKey,
        numericValue: val,
        unit: paramMeta?.unit || '',
        referenceRange: range,
        abnormalFlag: flag,
        clinicalAction: newClinicalAction.trim() || null,
      });

      setShowAddModal(false);
      setNewValue('');
      setNewClinicalAction('');
      await loadData();
    } catch (err) {
      setTrendError(err);
    } finally {
      setSavingTrend(false);
    }
  };

  // Handle deleting trend
  const handleDeleteTrend = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this lab observation?')) return;
    try {
      await api('DELETE', `/api/antenatal-lab-trends/${id}`);
      await loadData();
    } catch (err) {
      alert('Failed to delete lab observation: ' + ((err as Error).message || String(err)));
    }
  };

  // Handle saving serology matrix
  const handleSaveSerology = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSero(true);
      setSeroError(null);
      await api('PUT', `/api/patients/${patientId}/antenatal-serology`, seroForm);
      setShowSerologyModal(false);
      await loadData();
    } catch (err) {
      setSeroError(err);
    } finally {
      setSavingSero(false);
    }
  };

  // Filtered trends
  const filteredTrends = useMemo(() => {
    if (selectedCategory === 'all') return trends;
    if (selectedCategory === 'hb') return trends.filter((t) => t.parameterKey === 'hb');
    if (selectedCategory === 'platelets') return trends.filter((t) => t.parameterKey === 'platelets');
    if (selectedCategory === 'tsh') return trends.filter((t) => t.parameterKey === 'tsh' || t.parameterKey === 'ft4');
    if (selectedCategory === 'glucose')
      return trends.filter(
        (t) =>
          t.parameterKey.startsWith('ogtt_') ||
          t.parameterKey === 'fbs' ||
          t.parameterKey === 'ppbs' ||
          t.parameterKey === 'hba1c'
      );
    if (selectedCategory === 'ferritin')
      return trends.filter((t) => t.parameterKey === 'ferritin' || t.parameterKey === 'serum_iron' || t.parameterKey === 'tibc');
    if (selectedCategory === 'renal')
      return trends.filter(
        (t) =>
          t.parameterKey === 'uric_acid' ||
          t.parameterKey === 'upcr' ||
          t.parameterKey === 'serum_creatinine' ||
          t.parameterKey === 'urine_albumin'
      );
    return trends;
  }, [trends, selectedCategory]);

  // Compute latest status insights
  const latestHb = trends.filter((t) => t.parameterKey === 'hb').slice(-1)[0];
  const latestPlatelets = trends.filter((t) => t.parameterKey === 'platelets').slice(-1)[0];
  const latestTsh = trends.filter((t) => t.parameterKey === 'tsh').slice(-1)[0];
  const latestFerritin = trends.filter((t) => t.parameterKey === 'ferritin').slice(-1)[0];
  const ogttFasting = trends.filter((t) => t.parameterKey === 'ogtt_fasting').slice(-1)[0];
  const ogtt2hr = trends.filter((t) => t.parameterKey === 'ogtt_2hr').slice(-1)[0];

  const anemiaAlert = latestHb ? classifyAnemia(latestHb.numericValue, latestHb.trimester) : null;
  const thrombocytopeniaAlert = latestPlatelets ? classifyThrombocytopenia(latestPlatelets.numericValue) : null;

  // Render SVG Trend Chart
  const renderTrendChart = (paramKey: string, chartTitle: string, unit: string) => {
    const paramTrends = trends
      .filter((t) => t.parameterKey === paramKey)
      .sort((a, b) => (a.gestationalAgeWeeks ?? 0) - (b.gestationalAgeWeeks ?? 0) || a.testDate.localeCompare(b.testDate));

    if (paramTrends.length === 0) {
      return (
        <div className="muted small" style={{ padding: '1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '6px' }}>
          No longitudinal data recorded yet for {chartTitle}. Click "Log Lab Observation" above to add.
        </div>
      );
    }

    // Chart dimensions
    const width = 680;
    const height = 190;
    const padding = { top: 25, right: 30, bottom: 35, left: 55 };

    const minWeeks = 6;
    const maxWeeks = 40;

    // Y values
    const values = paramTrends.map((t) => t.numericValue);
    let minY = Math.min(...values);
    let maxY = Math.max(...values);

    // Provide default scale buffer
    if (paramKey === 'hb') {
      minY = Math.min(minY, 6.5);
      maxY = Math.max(maxY, 14.5);
    } else if (paramKey === 'platelets') {
      minY = Math.min(minY, 40);
      maxY = Math.max(maxY, 350);
    } else if (paramKey === 'tsh') {
      minY = Math.min(minY, 0);
      maxY = Math.max(maxY, 5.0);
    } else {
      minY = Math.min(minY, 0);
      maxY = maxY * 1.25;
    }

    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }

    const scaleX = (w: number) => padding.left + ((w - minWeeks) / (maxWeeks - minWeeks)) * (width - padding.left - padding.right);
    const scaleY = (v: number) => height - padding.bottom - ((v - minY) / (maxY - minY)) * (height - padding.top - padding.bottom);

    // Reference bands / threshold lines
    let thresholdLines: { yVal: number; label: string; color: string }[] = [];
    if (paramKey === 'hb') {
      thresholdLines = [
        { yVal: 11.0, label: 'T1/T3 Normal (11.0)', color: '#16a34a' },
        { yVal: 10.5, label: 'T2 Normal (10.5)', color: '#0284c7' },
        { yVal: 7.0, label: 'Severe Anemia (<7.0)', color: '#dc2626' },
      ];
    } else if (paramKey === 'platelets') {
      thresholdLines = [
        { yVal: 150, label: 'Normal (150k)', color: '#16a34a' },
        { yVal: 100, label: 'Mild Gestational (100k)', color: '#d97706' },
        { yVal: 50, label: 'Severe (<50k)', color: '#dc2626' },
      ];
    } else if (paramKey === 'tsh') {
      thresholdLines = [
        { yVal: 2.5, label: 'T1 Upper Limit (2.5)', color: '#0284c7' },
        { yVal: 3.0, label: 'T2/T3 Limit (3.0)', color: '#d97706' },
      ];
    }

    const points = paramTrends.map((t) => {
      const w = t.gestationalAgeWeeks != null ? Math.min(Math.max(t.gestationalAgeWeeks, minWeeks), maxWeeks) : minWeeks;
      return {
        x: scaleX(w),
        y: scaleY(t.numericValue),
        trend: t,
      };
    });

    const pathData = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');

    return (
      <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0.75rem', marginBottom: '1rem' }}>
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
            {chartTitle} Trajectory (Gestational Age vs {unit})
          </strong>
          <span className="muted small">{paramTrends.length} point{paramTrends.length === 1 ? '' : 's'} recorded</span>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxHeight: '230px', overflow: 'visible' }}>
          {/* Trimester shaded background sectors */}
          <rect
            x={scaleX(6)}
            y={padding.top}
            width={scaleX(13) - scaleX(6)}
            height={height - padding.top - padding.bottom}
            fill="#f0f9ff"
            opacity={0.4}
          />
          <text x={scaleX(9.5)} y={padding.top + 12} fontSize="10" fill="#0369a1" textAnchor="middle" fontWeight="bold">
            1st Trimester
          </text>

          <rect
            x={scaleX(13)}
            y={padding.top}
            width={scaleX(28) - scaleX(13)}
            height={height - padding.top - padding.bottom}
            fill="#f8fafc"
            opacity={0.4}
          />
          <text x={scaleX(20.5)} y={padding.top + 12} fontSize="10" fill="#475569" textAnchor="middle" fontWeight="bold">
            2nd Trimester
          </text>

          <rect
            x={scaleX(28)}
            y={padding.top}
            width={scaleX(40) - scaleX(28)}
            height={height - padding.top - padding.bottom}
            fill="#fdf4ff"
            opacity={0.4}
          />
          <text x={scaleX(34)} y={padding.top + 12} fontSize="10" fill="#86198f" textAnchor="middle" fontWeight="bold">
            3rd Trimester
          </text>

          {/* Grid lines on X (weeks) */}
          {[10, 16, 20, 24, 28, 32, 36, 40].map((w) => (
            <g key={w}>
              <line
                x1={scaleX(w)}
                y1={padding.top}
                x2={scaleX(w)}
                y2={height - padding.bottom}
                stroke="#e2e8f0"
                strokeDasharray="3 3"
              />
              <text x={scaleX(w)} y={height - padding.bottom + 14} fontSize="9" fill="#64748b" textAnchor="middle">
                {w}w
              </text>
            </g>
          ))}

          {/* Reference threshold lines */}
          {thresholdLines.map((t, idx) => {
            const y = scaleY(t.yVal);
            if (y < padding.top || y > height - padding.bottom) return null;
            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={t.color}
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                />
                <text x={width - padding.right + 2} y={y + 3} fontSize="9" fill={t.color} textAnchor="start" fontWeight="500">
                  {t.label}
                </text>
              </g>
            );
          })}

          {/* Trend Polyline */}
          <path d={pathData} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Points */}
          {points.map((p, idx) => {
            const flag = p.trend.abnormalFlag;
            const ptColor = flag === 'critical' ? '#dc2626' : flag === 'low' || flag === 'high' ? '#d97706' : '#16a34a';
            return (
              <g key={idx}>
                <circle cx={p.x} cy={p.y} r="5" fill={ptColor} stroke="#ffffff" strokeWidth="2">
                  <title>
                    {`${p.trend.testDate} (${p.trend.gestationalAgeWeeks ?? '?'}w): ${p.trend.numericValue} ${p.trend.unit} [${p.trend.abnormalFlag.toUpperCase()}]${p.trend.clinicalAction ? ' - ' + p.trend.clinicalAction : ''}`}
                  </title>
                </circle>
                <text x={p.x} y={p.y - 8} fontSize="9" fontWeight="bold" fill="#0f172a" textAnchor="middle">
                  {p.trend.numericValue}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="antenatal-lab-tracker stack" style={{ marginTop: '0.75rem', gap: '1rem' }}>
      {/* Top Banner / Actions Header */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)',
          border: '1.5px solid #0284c7',
          padding: '1rem 1.25rem',
          borderRadius: '8px',
        }}
      >
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem' }}>
          <div>
            <div className="row wrap" style={{ gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '1.4rem' }}>🔬</span>
              <h3 style={{ margin: 0, color: '#0f172a' }}>Antenatal Longitudinal Lab Trends &amp; Serology Matrix</h3>
              {currentGa && (
                <span className="badge info" style={{ fontWeight: 'bold' }}>
                  GA: {currentGa.formatted} ({getTrimesterFromWeeks(currentGa.weeks).toUpperCase()})
                </span>
              )}
              {edd && (
                <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>
                  EDD: {edd}
                </span>
              )}
            </div>
            <div className="muted small" style={{ marginTop: '0.3rem' }}>
              Comprehensive gestational tracking for maternal anemia, thrombocytopenia, GDM 75g OGTT curve, thyroid, ferritin stores, and serology matrix.
            </div>
          </div>

          <div className="row wrap" style={{ gap: '0.5rem' }}>
            <Link
              to={`/antenatal-labs/${patientId}/print`}
              target="_blank"
              className="btn small"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' }}
            >
              🖨️ Printable Lab Summary
            </Link>
            <button
              type="button"
              className="btn small"
              onClick={() => setShowSerologyModal(true)}
              style={{ background: '#0284c7', color: '#ffffff' }}
            >
              🛡️ Serology Matrix
            </button>
            <button
              type="button"
              className="btn small primary"
              onClick={() => setShowAddModal(true)}
              style={{ fontWeight: 'bold' }}
            >
              ➕ Log Lab Observation
            </button>
          </div>
        </div>

        {/* Clinical Alerts Strip */}
        {(anemiaAlert || thrombocytopeniaAlert) && (
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {anemiaAlert && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #f87171',
                  color: '#991b1b',
                  borderRadius: '6px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>⚠️</span>
                <span><strong>Anemia Alert:</strong> {anemiaAlert}</span>
              </div>
            )}
            {thrombocytopeniaAlert && (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #f59e0b',
                  color: '#92400e',
                  borderRadius: '6px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>🩸</span>
                <span><strong>Platelet Alert:</strong> {thrombocytopeniaAlert}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {Boolean(error) && <ErrorBanner error={error} />}

      {/* Trimester Milestone Reminders Accordion/Bar */}
      <div className="card" style={{ padding: '0.9rem 1.1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <strong style={{ fontSize: '0.92rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>⏰</span> Antenatal Milestone Screening Reminders (by Gestational Age)
          </strong>
          <span className="muted small">Universal protocols for high-yield maternal screenings</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
          {reminders.map((r) => {
            const badgeClass = r.isDue ? 'badge ok' : r.isOverdue ? 'badge warn' : 'badge';
            const badgeText = r.isDue ? 'DUE NOW' : r.isOverdue ? 'OVERDUE' : 'Upcoming';
            const cardBg = r.isDue ? '#f0fdf4' : r.isOverdue ? '#fffbeb' : '#ffffff';
            const borderCol = r.isDue ? '#86efac' : r.isOverdue ? '#fcd34d' : '#e2e8f0';

            return (
              <div
                key={r.key}
                style={{
                  background: cardBg,
                  border: `1px solid ${borderCol}`,
                  borderRadius: '6px',
                  padding: '0.6rem 0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                }}
              >
                <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>{r.dueWeeks}</span>
                  <span className={badgeClass} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                    {badgeText}
                  </span>
                </div>
                <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{r.title}</strong>
                <span className="muted small" style={{ fontSize: '0.75rem', lineHeight: '1.2' }}>
                  {r.rationale}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Summary Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
        {/* Hemoglobin */}
        <div className="card" style={{ padding: '0.75rem', textAlign: 'center', borderTop: '3px solid #ef4444' }}>
          <div className="muted small">Hemoglobin (Hb)</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: latestHb ? (latestHb.abnormalFlag === 'critical' ? '#dc2626' : latestHb.abnormalFlag === 'low' ? '#d97706' : '#16a34a') : '#64748b' }}>
            {latestHb ? `${latestHb.numericValue} g/dL` : '—'}
          </div>
          <div className="muted small" style={{ fontSize: '0.72rem' }}>
            {latestHb ? `${latestHb.gestationalAgeWeeks ?? '?'}w · ${latestHb.trimester.toUpperCase()}` : 'Not tested'}
          </div>
        </div>

        {/* Platelets */}
        <div className="card" style={{ padding: '0.75rem', textAlign: 'center', borderTop: '3px solid #f59e0b' }}>
          <div className="muted small">Platelet Count</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: latestPlatelets ? (latestPlatelets.abnormalFlag !== 'normal' ? '#d97706' : '#16a34a') : '#64748b' }}>
            {latestPlatelets ? `${latestPlatelets.numericValue}k` : '—'}
          </div>
          <div className="muted small" style={{ fontSize: '0.72rem' }}>
            {latestPlatelets ? `${latestPlatelets.gestationalAgeWeeks ?? '?'}w · Ref: ≥150k` : 'Not tested'}
          </div>
        </div>

        {/* TSH */}
        <div className="card" style={{ padding: '0.75rem', textAlign: 'center', borderTop: '3px solid #0284c7' }}>
          <div className="muted small">TSH (mIU/L)</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: latestTsh ? (latestTsh.abnormalFlag !== 'normal' ? '#d97706' : '#16a34a') : '#64748b' }}>
            {latestTsh ? `${latestTsh.numericValue}` : '—'}
          </div>
          <div className="muted small" style={{ fontSize: '0.72rem' }}>
            {latestTsh ? `${latestTsh.gestationalAgeWeeks ?? '?'}w · Trimester Ref` : 'Not tested'}
          </div>
        </div>

        {/* 75g OGTT 2-hr */}
        <div className="card" style={{ padding: '0.75rem', textAlign: 'center', borderTop: '3px solid #8b5cf6' }}>
          <div className="muted small">75g OGTT 2-hr</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: ogtt2hr ? (ogtt2hr.numericValue >= 140 ? '#dc2626' : '#16a34a') : '#64748b' }}>
            {ogtt2hr ? `${ogtt2hr.numericValue} mg/dL` : '—'}
          </div>
          <div className="muted small" style={{ fontSize: '0.72rem' }}>
            {ogtt2hr ? (ogtt2hr.numericValue >= 140 ? 'GDM Diagnostic' : 'Normal (<140)') : 'Pending 24-28w'}
          </div>
        </div>

        {/* Ferritin */}
        <div className="card" style={{ padding: '0.75rem', textAlign: 'center', borderTop: '3px solid #10b981' }}>
          <div className="muted small">Serum Ferritin</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: latestFerritin ? (latestFerritin.numericValue < 30 ? '#d97706' : '#16a34a') : '#64748b' }}>
            {latestFerritin ? `${latestFerritin.numericValue} ng/mL` : '—'}
          </div>
          <div className="muted small" style={{ fontSize: '0.72rem' }}>
            {latestFerritin ? (latestFerritin.numericValue < 15 ? 'Depleted Stores' : latestFerritin.numericValue < 30 ? 'Iron Deficient' : 'Replete') : 'Not tested'}
          </div>
        </div>

        {/* Serology Quick Status */}
        <div className="card" style={{ padding: '0.75rem', textAlign: 'center', borderTop: '3px solid #6366f1' }}>
          <div className="muted small">Blood Group / Rh</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#0f172a' }}>
            {serology?.bloodGroupAbo ? `${serology.bloodGroupAbo} ${serology.rhFactor === 'positive' ? 'Rh+' : serology.rhFactor === 'negative' ? 'Rh- (Alert)' : ''}` : 'Pending'}
          </div>
          <div className="muted small" style={{ fontSize: '0.72rem' }}>
            {serology?.rhFactor === 'negative' ? (serology.antiDGiven ? 'Anti-D Given ✅' : 'Anti-D Needed at 28w') : 'Routine'}
          </div>
        </div>
      </div>

      {/* Infectious Disease Serology Matrix Overview Card */}
      <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <div className="row wrap" style={{ gap: '0.4rem', alignItems: 'center' }}>
            <span style={{ fontSize: '1.2rem' }}>🛡️</span>
            <div>
              <strong style={{ fontSize: '1rem', color: '#0f172a' }}>Maternal Infectious Disease &amp; Serology Matrix</strong>
              <div className="muted small">Core antenatal infectious screen, alloimmunization prophylaxis, and hemoglobinopathy profile</div>
            </div>
          </div>
          <button
            type="button"
            className="btn small"
            onClick={() => setShowSerologyModal(true)}
            style={{ border: '1px solid #0284c7', color: '#0284c7' }}
          >
            ✏️ Edit Serology Status
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem' }}>
          {/* Blood Group & ICT */}
          <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div className="muted small" style={{ fontWeight: 'bold', marginBottom: '0.3rem', color: '#475569' }}>
              🩸 ABO &amp; Rh / Alloimmunization
            </div>
            <div style={{ fontSize: '0.88rem' }}>
              Group: <strong>{serology?.bloodGroupAbo || 'Not tested'}</strong> ({serology?.rhFactor ? (serology.rhFactor === 'positive' ? 'Rh Positive' : 'Rh Negative (Anti-D protocol)') : 'Rh not set'})
            </div>
            <div className="small" style={{ marginTop: '0.2rem' }}>
              ICT Booking: <span className={`badge ${serology?.indirectCoombsTestBooking === 'positive' ? 'err' : serology?.indirectCoombsTestBooking === 'negative' ? 'ok' : ''}`}>{serology?.indirectCoombsTestBooking || 'not_done'}</span>
            </div>
            <div className="small" style={{ marginTop: '0.2rem' }}>
              ICT 28 Weeks: <span className={`badge ${serology?.indirectCoombsTest28w === 'positive' ? 'err' : serology?.indirectCoombsTest28w === 'negative' ? 'ok' : ''}`}>{serology?.indirectCoombsTest28w || 'not_done'}</span>
            </div>
            {serology?.rhFactor === 'negative' && (
              <div className="small" style={{ marginTop: '0.3rem', background: '#eff6ff', padding: '0.3rem', borderRadius: '4px' }}>
                Anti-D: <strong>{serology.antiDGiven ? `Administered on ${serology.antiDGivenDate || ''} (${serology.antiDBatchDose || ''})` : 'Pending at 28w'}</strong>
              </div>
            )}
          </div>

          {/* Viral Screen */}
          <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div className="muted small" style={{ fontWeight: 'bold', marginBottom: '0.3rem', color: '#475569' }}>
              🦠 Viral &amp; STI Screen
            </div>
            <div className="small" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span>HIV 1 &amp; 2:</span>
              <span className={`badge ${serology?.hivStatus === 'reactive' ? 'err' : serology?.hivStatus === 'non_reactive' ? 'ok' : ''}`}>
                {serology?.hivStatus || 'not_tested'}
              </span>
            </div>
            <div className="small" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span>HBsAg (Hep B):</span>
              <span className={`badge ${serology?.hbsagStatus === 'reactive' ? 'err' : serology?.hbsagStatus === 'non_reactive' ? 'ok' : ''}`}>
                {serology?.hbsagStatus || 'not_tested'}
              </span>
            </div>
            <div className="small" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span>HCV (Hep C):</span>
              <span className={`badge ${serology?.hcvStatus === 'reactive' ? 'err' : serology?.hcvStatus === 'non_reactive' ? 'ok' : ''}`}>
                {serology?.hcvStatus || 'not_tested'}
              </span>
            </div>
            <div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>VDRL / RPR:</span>
              <span className={`badge ${serology?.vdrlRprStatus === 'reactive' ? 'err' : serology?.vdrlRprStatus === 'non_reactive' ? 'ok' : ''}`}>
                {serology?.vdrlRprStatus || 'not_tested'} {serology?.vdrlRprTiter ? `(${serology.vdrlRprTiter})` : ''}
              </span>
            </div>
          </div>

          {/* Rubella & Cultures */}
          <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div className="muted small" style={{ fontWeight: 'bold', marginBottom: '0.3rem', color: '#475569' }}>
              🧫 Immunity &amp; Cultures
            </div>
            <div className="small" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span>Rubella IgG:</span>
              <span className={`badge ${serology?.rubellaIggStatus === 'immune' ? 'ok' : serology?.rubellaIggStatus === 'non_immune' ? 'warn' : ''}`}>
                {serology?.rubellaIggStatus || 'not_tested'} {serology?.rubellaIggValue != null ? `(${serology.rubellaIggValue} IU/mL)` : ''}
              </span>
            </div>
            <div className="small" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span>GBS Swab (35-37w):</span>
              <span className={`badge ${serology?.gbsCultureStatus === 'positive' ? 'err' : serology?.gbsCultureStatus === 'negative' ? 'ok' : ''}`}>
                {serology?.gbsCultureStatus || 'not_tested'}
              </span>
            </div>
            <div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Urine Culture:</span>
              <span className={`badge ${serology?.urineCultureStatus === 'significant_growth' ? 'warn' : serology?.urineCultureStatus === 'no_growth' ? 'ok' : ''}`}>
                {serology?.urineCultureStatus || 'not_tested'}
              </span>
            </div>
            {serology?.urineCultureOrganism && (
              <div className="muted small" style={{ fontSize: '0.72rem', marginTop: '0.2rem' }}>
                Org: {serology.urineCultureOrganism}
              </div>
            )}
          </div>

          {/* Hemoglobinopathy HPLC */}
          <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div className="muted small" style={{ fontWeight: 'bold', marginBottom: '0.3rem', color: '#475569' }}>
              🧬 Hemoglobinopathy HPLC
            </div>
            <div style={{ fontSize: '0.88rem' }}>
              Result: <strong>{serology?.hemoglobinopathyHplc || 'not_tested'}</strong>
            </div>
            <div className="small" style={{ marginTop: '0.2rem' }}>
              HbA2: <strong>{serology?.hplcHba2Pct != null ? `${serology.hplcHba2Pct}%` : '—'}</strong>{' '}
              {serology?.hplcHba2Pct != null && serology.hplcHba2Pct > 3.5 ? (
                <span className="badge err" style={{ fontSize: '0.7rem' }}>&gt;3.5% Beta Thal Trait</span>
              ) : null}
            </div>
            {serology?.consultantReviewNotes && (
              <div className="muted small" style={{ marginTop: '0.3rem', fontStyle: 'italic', fontSize: '0.75rem' }}>
                "{serology.consultantReviewNotes}"
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Tabs & Visual Trends Section */}
      <div className="card stack" style={{ padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: '1rem', color: '#0f172a' }}>📈 Longitudinal Gestational Trends</strong>
          <div className="row wrap" style={{ gap: '0.3rem' }}>
            {[
              { id: 'all', label: 'All Observations' },
              { id: 'hb', label: '🩸 Hemoglobin' },
              { id: 'platelets', label: 'Platelets' },
              { id: 'tsh', label: '🦋 Thyroid (TSH/FT4)' },
              { id: 'glucose', label: '🍭 75g OGTT' },
              { id: 'ferritin', label: '🧲 Ferritin & Iron' },
              { id: 'renal', label: '🧪 Renal & UPCR' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`btn small ${selectedCategory === cat.id ? 'primary' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.55rem' }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Trend Visualizations */}
        {(selectedCategory === 'all' || selectedCategory === 'hb') && (
          renderTrendChart('hb', 'Hemoglobin (Hb)', 'g/dL')
        )}
        {(selectedCategory === 'all' || selectedCategory === 'platelets') && (
          renderTrendChart('platelets', 'Platelet Count', '×10³/µL')
        )}
        {selectedCategory === 'tsh' && (
          renderTrendChart('tsh', 'TSH (Thyroid Stimulating Hormone)', 'mIU/L')
        )}
        {selectedCategory === 'ferritin' && (
          renderTrendChart('ferritin', 'Serum Ferritin Stores', 'ng/mL')
        )}

        {/* 75g OGTT Curve Presentation */}
        {selectedCategory === 'glucose' && (
          <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.8rem' }}>
            <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                🍭 75g Oral Glucose Tolerance Test (DIPSI / IADPSG Criteria)
              </strong>
              <span className="muted small">Universal GDM screening at 24–28 weeks</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <div className="muted small">Fasting Plasma Glucose</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: ogttFasting && ogttFasting.numericValue >= 92 ? '#dc2626' : '#16a34a' }}>
                  {ogttFasting ? `${ogttFasting.numericValue} mg/dL` : 'Not recorded'}
                </div>
                <div className="muted small" style={{ fontSize: '0.72rem' }}>Normal: &lt; 92 mg/dL</div>
              </div>

              <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <div className="muted small">1-Hour Post 75g Load</div>
                {(() => {
                  const t1h = trends.filter((t) => t.parameterKey === 'ogtt_1hr').slice(-1)[0];
                  return (
                    <>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: t1h && t1h.numericValue >= 180 ? '#dc2626' : '#16a34a' }}>
                        {t1h ? `${t1h.numericValue} mg/dL` : 'Not recorded'}
                      </div>
                      <div className="muted small" style={{ fontSize: '0.72rem' }}>Normal: &lt; 180 mg/dL</div>
                    </>
                  );
                })()}
              </div>

              <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <div className="muted small">2-Hour Post 75g Load</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: ogtt2hr && ogtt2hr.numericValue >= 140 ? '#dc2626' : '#16a34a' }}>
                  {ogtt2hr ? `${ogtt2hr.numericValue} mg/dL` : 'Not recorded'}
                </div>
                <div className="muted small" style={{ fontSize: '0.72rem' }}>Diagnostic Cutoff: &lt; 140 mg/dL</div>
              </div>
            </div>
          </div>
        )}

        {/* Tabular Listing of Observations */}
        <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
          <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: '0.5rem' }}>Test Date</th>
                <th style={{ padding: '0.5rem' }}>GA / Trimester</th>
                <th style={{ padding: '0.5rem' }}>Parameter</th>
                <th style={{ padding: '0.5rem' }}>Observed Value</th>
                <th style={{ padding: '0.5rem' }}>Reference Range</th>
                <th style={{ padding: '0.5rem' }}>Status</th>
                <th style={{ padding: '0.5rem' }}>Clinical Action &amp; Plan</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrends.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                    No antenatal lab observations found for this filter.
                  </td>
                </tr>
              ) : (
                filteredTrends.map((t) => {
                  const flagBadgeClass =
                    t.abnormalFlag === 'critical'
                      ? 'badge err'
                      : t.abnormalFlag === 'low' || t.abnormalFlag === 'high'
                      ? 'badge warn'
                      : 'badge ok';

                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                        <strong>{t.testDate}</strong>
                      </td>
                      <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                        {t.gestationalAgeWeeks != null ? `${t.gestationalAgeWeeks}w ${t.gestationalAgeDays || 0}d` : '—'}{' '}
                        <span className="badge small" style={{ fontSize: '0.68rem' }}>{t.trimester.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <strong>{t.parameterName}</strong>
                      </td>
                      <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                        <strong style={{ fontSize: '0.95rem' }}>{t.numericValue}</strong>{' '}
                        <span className="muted small">{t.unit}</span>
                      </td>
                      <td style={{ padding: '0.5rem', fontSize: '0.78rem', color: '#475569' }}>
                        {t.referenceRange || '—'}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <span className={flagBadgeClass}>{t.abnormalFlag.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '0.5rem', fontSize: '0.8rem', color: t.clinicalAction ? '#0f172a' : '#94a3b8' }}>
                        {t.clinicalAction || 'None'}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn small danger"
                          onClick={() => handleDeleteTrend(t.id)}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Lab Observation */}
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
              maxWidth: '560px',
              width: '100%',
              padding: '1.25rem',
              borderRadius: '8px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#0f172a' }}>➕ Log Antenatal Lab Observation</h3>
              <button type="button" className="btn small" onClick={() => setShowAddModal(false)}>
                ✕
              </button>
            </div>

            {Boolean(trendError) && <ErrorBanner error={trendError} />}

            <form onSubmit={handleSaveTrend} className="stack" style={{ gap: '0.8rem' }}>
              <div>
                <label className="label">Parameter</label>
                <select
                  className="input"
                  value={newParamKey}
                  onChange={(e) => setNewParamKey(e.target.value)}
                  required
                >
                  {Object.entries(ANTENATAL_LAB_PARAMS).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.name} ({meta.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="row wrap" style={{ gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Test Date</label>
                  <input
                    type="date"
                    className="input"
                    value={newTestDate}
                    onChange={(e) => setNewTestDate(e.target.value)}
                    required
                  />
                </div>
                <div style={{ width: '120px' }}>
                  <label className="label">GA (Weeks)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    max="44"
                    value={newGaWeeks}
                    onChange={(e) => setNewGaWeeks(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div style={{ width: '100px' }}>
                  <label className="label">GA (Days)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    max="6"
                    value={newGaDays}
                    onChange={(e) => setNewGaDays(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="row wrap" style={{ gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Trimester Stage</label>
                  <select
                    className="input"
                    value={newTrimester}
                    onChange={(e) => setNewTrimester(e.target.value as TrimesterKey)}
                  >
                    <option value="t1">1st Trimester (&lt; 13 weeks)</option>
                    <option value="t2">2nd Trimester (13 – 27 weeks)</option>
                    <option value="t3">3rd Trimester (≥ 28 weeks)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">
                    Observed Numeric Value ({ANTENATAL_LAB_PARAMS[newParamKey]?.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={newValue}
                    placeholder="e.g. 10.4"
                    onChange={(e) => setNewValue(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Live Reference Range & Flag Preview */}
              {newValue !== '' && !isNaN(parseFloat(newValue)) && (
                <div style={{ background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  {(() => {
                    const num = parseFloat(newValue);
                    const flag = evaluateLabFlag(newParamKey, num, newTrimester);
                    const meta = ANTENATAL_LAB_PARAMS[newParamKey];
                    const range = meta ? meta.trimesterRanges[newTrimester]?.label : '';
                    return (
                      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="small">Trimester Reference: <strong>{range}</strong></span>
                        <span className={`badge ${flag === 'critical' ? 'err' : flag === 'normal' ? 'ok' : 'warn'}`}>
                          Evaluated: {flag.toUpperCase()}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <label className="label">Clinical Action / Plan (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Oral Iron stepped up, FCM 1g IV scheduled, Endocrine titration"
                  value={newClinicalAction}
                  onChange={(e) => setNewClinicalAction(e.target.value)}
                />
              </div>

              <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={savingTrend}>
                  {savingTrend ? 'Saving...' : 'Save Observation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Infectious Serology Matrix */}
      {showSerologyModal && (
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
              maxWidth: '680px',
              width: '100%',
              padding: '1.25rem',
              borderRadius: '8px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#0f172a' }}>🛡️ Maternal Serology Matrix &amp; Infectious Screen</h3>
              <button type="button" className="btn small" onClick={() => setShowSerologyModal(false)}>
                ✕
              </button>
            </div>

            {Boolean(seroError) && <ErrorBanner error={seroError} />}

            <form onSubmit={handleSaveSerology} className="stack" style={{ gap: '1rem' }}>
              {/* ABO, Rh & Anti-D Section */}
              <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.8rem' }}>
                <legend style={{ fontWeight: 'bold', color: '#1e293b', padding: '0 0.4rem' }}>
                  🩸 ABO Blood Group &amp; Rh / Anti-D Prophylaxis
                </legend>
                <div className="row wrap" style={{ gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label className="label">ABO Blood Group</label>
                    <select
                      className="input"
                      value={seroForm.bloodGroupAbo || ''}
                      onChange={(e) => setSeroForm({ ...seroForm, bloodGroupAbo: e.target.value })}
                    >
                      <option value="">Not Selected</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="AB">AB</option>
                      <option value="O">O</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label">Rh Factor</label>
                    <select
                      className="input"
                      value={seroForm.rhFactor || ''}
                      onChange={(e) => setSeroForm({ ...seroForm, rhFactor: (e.target.value as 'positive' | 'negative') || null })}
                    >
                      <option value="">Not Selected</option>
                      <option value="positive">Rh Positive (+)</option>
                      <option value="negative">Rh Negative (-) (Anti-D Indicated)</option>
                    </select>
                  </div>
                </div>

                <div className="row wrap" style={{ gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label className="label">ICT (Indirect Coombs) Booking</label>
                    <select
                      className="input"
                      value={seroForm.indirectCoombsTestBooking || 'not_done'}
                      onChange={(e) => setSeroForm({ ...seroForm, indirectCoombsTestBooking: e.target.value as any })}
                    >
                      <option value="not_done">Not Done</option>
                      <option value="negative">Negative (Unsensitized)</option>
                      <option value="positive">Positive (Alloimmunized)</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label">ICT 28-Week Repeat</label>
                    <select
                      className="input"
                      value={seroForm.indirectCoombsTest28w || 'not_done'}
                      onChange={(e) => setSeroForm({ ...seroForm, indirectCoombsTest28w: e.target.value as any })}
                    >
                      <option value="not_done">Not Done</option>
                      <option value="negative">Negative</option>
                      <option value="positive">Positive</option>
                    </select>
                  </div>
                </div>

                {seroForm.rhFactor === 'negative' && (
                  <div style={{ background: '#f0fdf4', padding: '0.6rem', borderRadius: '6px', border: '1px solid #86efac', marginTop: '0.4rem' }}>
                    <label className="row" style={{ gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(seroForm.antiDGiven)}
                        onChange={(e) => setSeroForm({ ...seroForm, antiDGiven: e.target.checked })}
                      />
                      <strong>Anti-D Immunoglobulin Administered (300 mcg / 1500 IU)</strong>
                    </label>
                    {seroForm.antiDGiven && (
                      <div className="row wrap" style={{ gap: '0.75rem', marginTop: '0.4rem' }}>
                        <div style={{ flex: 1 }}>
                          <label className="label">Administration Date</label>
                          <input
                            type="date"
                            className="input"
                            value={seroForm.antiDGivenDate || ''}
                            onChange={(e) => setSeroForm({ ...seroForm, antiDGivenDate: e.target.value })}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="label">Dose / Batch Info</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="e.g. 300mcg IM, Batch #AD-9812"
                            value={seroForm.antiDBatchDose || ''}
                            onChange={(e) => setSeroForm({ ...seroForm, antiDBatchDose: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </fieldset>

              {/* Core Viral & STI Screening */}
              <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.8rem' }}>
                <legend style={{ fontWeight: 'bold', color: '#1e293b', padding: '0 0.4rem' }}>
                  🦠 Core Infectious Screening (HIV, Hepatitis, Syphilis)
                </legend>
                <div className="row wrap" style={{ gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label className="label">HIV 1 &amp; 2 Status</label>
                    <select
                      className="input"
                      value={seroForm.hivStatus || 'not_tested'}
                      onChange={(e) => setSeroForm({ ...seroForm, hivStatus: e.target.value as any })}
                    >
                      <option value="not_tested">Not Tested</option>
                      <option value="non_reactive">Non-Reactive</option>
                      <option value="reactive">Reactive (Action Required)</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label">HBsAg Status</label>
                    <select
                      className="input"
                      value={seroForm.hbsagStatus || 'not_tested'}
                      onChange={(e) => setSeroForm({ ...seroForm, hbsagStatus: e.target.value as any })}
                    >
                      <option value="not_tested">Not Tested</option>
                      <option value="non_reactive">Non-Reactive</option>
                      <option value="reactive">Reactive</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>

                <div className="row wrap" style={{ gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <label className="label">HCV Status</label>
                    <select
                      className="input"
                      value={seroForm.hcvStatus || 'not_tested'}
                      onChange={(e) => setSeroForm({ ...seroForm, hcvStatus: e.target.value as any })}
                    >
                      <option value="not_tested">Not Tested</option>
                      <option value="non_reactive">Non-Reactive</option>
                      <option value="reactive">Reactive</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label">VDRL / RPR Status &amp; Titer</label>
                    <div className="row" style={{ gap: '0.3rem' }}>
                      <select
                        className="input"
                        value={seroForm.vdrlRprStatus || 'not_tested'}
                        onChange={(e) => setSeroForm({ ...seroForm, vdrlRprStatus: e.target.value as any })}
                      >
                        <option value="not_tested">Not Tested</option>
                        <option value="non_reactive">Non-Reactive</option>
                        <option value="reactive">Reactive</option>
                        <option value="pending">Pending</option>
                      </select>
                      <input
                        type="text"
                        className="input"
                        placeholder="Titer (1:8)"
                        style={{ width: '90px' }}
                        value={seroForm.vdrlRprTiter || ''}
                        onChange={(e) => setSeroForm({ ...seroForm, vdrlRprTiter: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Rubella, GBS & Urine Culture */}
              <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.8rem' }}>
                <legend style={{ fontWeight: 'bold', color: '#1e293b', padding: '0 0.4rem' }}>
                  🧫 Rubella, GBS &amp; Urine Culture
                </legend>
                <div className="row wrap" style={{ gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label className="label">Rubella IgG Immunity</label>
                    <div className="row" style={{ gap: '0.3rem' }}>
                      <select
                        className="input"
                        value={seroForm.rubellaIggStatus || 'not_tested'}
                        onChange={(e) => setSeroForm({ ...seroForm, rubellaIggStatus: e.target.value as any })}
                      >
                        <option value="not_tested">Not Tested</option>
                        <option value="immune">Immune (&gt;10 IU/mL)</option>
                        <option value="non_immune">Non-Immune (Susceptible)</option>
                        <option value="equivocal">Equivocal</option>
                      </select>
                      <input
                        type="number"
                        step="any"
                        className="input"
                        placeholder="Titer"
                        style={{ width: '80px' }}
                        value={seroForm.rubellaIggValue != null ? seroForm.rubellaIggValue : ''}
                        onChange={(e) => setSeroForm({ ...seroForm, rubellaIggValue: e.target.value ? parseFloat(e.target.value) : null })}
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label">GBS Swab (35–37w)</label>
                    <select
                      className="input"
                      value={seroForm.gbsCultureStatus || 'not_tested'}
                      onChange={(e) => setSeroForm({ ...seroForm, gbsCultureStatus: e.target.value as any })}
                    >
                      <option value="not_tested">Not Tested</option>
                      <option value="negative">Negative</option>
                      <option value="positive">Positive (Intrapartum Penicillin/Amp)</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>

                <div className="row wrap" style={{ gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <label className="label">Urine Culture (Bacteriuria)</label>
                    <select
                      className="input"
                      value={seroForm.urineCultureStatus || 'not_tested'}
                      onChange={(e) => setSeroForm({ ...seroForm, urineCultureStatus: e.target.value as any })}
                    >
                      <option value="not_tested">Not Tested</option>
                      <option value="no_growth">No Growth</option>
                      <option value="significant_growth">Significant Growth (&gt;10⁵ CFU/mL)</option>
                      <option value="mixed_growth">Mixed Growth / Contaminated</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label">Organism &amp; Colony Count</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. E. coli >10^5 CFU/mL, Nitrofurantoin sensitive"
                      value={seroForm.urineCultureOrganism || ''}
                      onChange={(e) => setSeroForm({ ...seroForm, urineCultureOrganism: e.target.value })}
                    />
                  </div>
                </div>
              </fieldset>

              {/* Hemoglobinopathy HPLC */}
              <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.8rem' }}>
                <legend style={{ fontWeight: 'bold', color: '#1e293b', padding: '0 0.4rem' }}>
                  🧬 Hemoglobinopathy HPLC
                </legend>
                <div className="row wrap" style={{ gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <label className="label">HPLC Interpretation</label>
                    <select
                      className="input"
                      value={seroForm.hemoglobinopathyHplc || 'not_tested'}
                      onChange={(e) => setSeroForm({ ...seroForm, hemoglobinopathyHplc: e.target.value as any })}
                    >
                      <option value="not_tested">Not Tested</option>
                      <option value="normal_a1_a2">Normal Hb Pattern (HbA + HbA2 &lt; 3.5%)</option>
                      <option value="beta_thalassemia_trait">Beta Thalassemia Trait (HbA2 &gt; 3.5%)</option>
                      <option value="sickle_cell_trait">Sickle Cell Trait (HbAS)</option>
                      <option value="hb_e_trait">Hb E Trait</option>
                      <option value="other_variant">Other Variant</option>
                    </select>
                  </div>
                  <div style={{ width: '130px' }}>
                    <label className="label">HbA2 %</label>
                    <input
                      type="number"
                      step="0.1"
                      className="input"
                      placeholder="e.g. 5.2"
                      value={seroForm.hplcHba2Pct != null ? seroForm.hplcHba2Pct : ''}
                      onChange={(e) => setSeroForm({ ...seroForm, hplcHba2Pct: e.target.value ? parseFloat(e.target.value) : null })}
                    />
                  </div>
                </div>
              </fieldset>

              <div>
                <label className="label">Consultant Review &amp; Counseling Notes</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="e.g. Partner HPLC counseled, Rubella vaccine scheduled postpartum"
                  value={seroForm.consultantReviewNotes || ''}
                  onChange={(e) => setSeroForm({ ...seroForm, consultantReviewNotes: e.target.value })}
                />
              </div>

              <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowSerologyModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={savingSero}>
                  {savingSero ? 'Saving...' : 'Update Serology Matrix'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
