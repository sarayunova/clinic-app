import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type UltrasoundReport,
  type UltrasoundListResponse,
  type UltrasoundScanType,
} from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, Field, todayLocal } from './ui';
import {
  calculateEfwHadlock,
  evaluateEfwPercentile,
  calculateGestationalAgeByCrl,
  calculateEddByScan,
  interpretAfi,
  interpretSdp,
  ANATOMICAL_SURVEY_ITEMS,
} from '../ultrasoundBiometry';

interface Props {
  patientId: number;
  clinicalLmp?: string | null;
  onChanged?: () => void;
}

const SCAN_TYPE_LABELS: Record<UltrasoundScanType, string> = {
  early_pregnancy: 'Early Pregnancy / Dating Scan (6–11w)',
  nt_first_trimester: 'First Trimester NT Scan (11–13w6d)',
  anomaly_scan: 'Targeted Anomaly Scan / TIFFA (18–22w)',
  growth_wellbeing: 'Growth & Doppler Wellbeing (24–40w)',
  pelvic_gyn: 'Pelvic / Gynecological Ultrasound',
  other: 'Other / Diagnostic Ultrasound',
};

export function UltrasoundTracker({ patientId, clinicalLmp, onChanged }: Props) {
  const { can } = useAuth();
  const canEdit = can('patient:write_clinical');

  const [reports, setReports] = useState<UltrasoundReport[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Form fields
  const [scanDate, setScanDate] = useState(todayLocal());
  const [scanType, setScanType] = useState<UltrasoundScanType>('growth_wellbeing');
  const [indication, setIndication] = useState('');
  const [gaWeeks, setGaWeeks] = useState<string>('');
  const [gaDays, setGaDays] = useState<string>('0');
  const [eddByScan, setEddByScan] = useState<string>('');
  const [fetalNumber, setFetalNumber] = useState<'single' | 'twins' | 'triplets' | 'none'>('single');
  const [cardiacActivity, setCardiacActivity] = useState<'present' | 'absent' | 'not_applicable'>('present');
  const [fhrBpm, setFhrBpm] = useState<string>('140');
  const [presentation, setPresentation] = useState<string>('cephalic');
  const [placentaLocation, setPlacentaLocation] = useState<string>('anterior');
  const [placentaGrade, setPlacentaGrade] = useState<string>('1');
  const [fluidType, setFluidType] = useState<'afi' | 'sdp'>('afi');
  const [fluidCm, setFluidCm] = useState<string>('14');
  const [fluidAssessment, setFluidAssessment] = useState<string>('normal');

  // Biometrics
  const [gsdMm, setGsdMm] = useState<string>('');
  const [crlMm, setCrlMm] = useState<string>('');
  const [ntMm, setNtMm] = useState<string>('');
  const [nasalBone, setNasalBone] = useState<string>('present');
  const [bpdMm, setBpdMm] = useState<string>('');
  const [hcMm, setHcMm] = useState<string>('');
  const [acMm, setAcMm] = useState<string>('');
  const [flMm, setFlMm] = useState<string>('');
  const [efwGrams, setEfwGrams] = useState<string>('');
  const [efwPercentile, setEfwPercentile] = useState<string>('');

  // Anatomy survey checklist
  const [anatomySurvey, setAnatomySurvey] = useState<Record<string, string>>({});

  // Pelvic GYN fields
  const [uterusFindings, setUterusFindings] = useState('');
  const [endometrialMm, setEndometrialMm] = useState('');
  const [rightOvary, setRightOvary] = useState('');
  const [leftOvary, setLeftOvary] = useState('');
  const [freeFluid, setFreeFluid] = useState<string>('none');

  // Summary
  const [impression, setImpression] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [sonographerName, setSonographerName] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api<UltrasoundListResponse>('GET', `/api/patients/${patientId}/ultrasounds`);
      setReports(res.reports);
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

  // Live calculation of GA from CRL
  useEffect(() => {
    const crl = parseFloat(crlMm);
    if (!isNaN(crl) && crl > 0) {
      const calc = calculateGestationalAgeByCrl(crl);
      if (calc) {
        setGaWeeks(String(calc.weeks));
        setGaDays(String(calc.days));
      }
    }
  }, [crlMm]);

  // Live calculation of EDD from scanDate + GA
  useEffect(() => {
    const w = parseInt(gaWeeks, 10);
    const d = parseInt(gaDays, 10) || 0;
    if (!isNaN(w) && w > 0 && scanDate) {
      const edd = calculateEddByScan(scanDate, w, d);
      if (edd) setEddByScan(edd);
    }
  }, [scanDate, gaWeeks, gaDays]);

  // Live calculation of EFW via Hadlock formulas
  useEffect(() => {
    const bpd = parseFloat(bpdMm) || null;
    const hc = parseFloat(hcMm) || null;
    const ac = parseFloat(acMm) || null;
    const fl = parseFloat(flMm) || null;

    if (ac && fl) {
      const efw = calculateEfwHadlock({ bpdMm: bpd, hcMm: hc, acMm: ac, flMm: fl });
      if (efw) {
        setEfwGrams(String(efw));
        const w = parseInt(gaWeeks, 10);
        if (!isNaN(w)) {
          const evalRes = evaluateEfwPercentile(efw, w);
          if (evalRes) {
            setEfwPercentile(evalRes.label);
          }
        }
      }
    }
  }, [bpdMm, hcMm, acMm, flMm, gaWeeks]);

  // Live interpretation of Amniotic Fluid
  useEffect(() => {
    const val = parseFloat(fluidCm);
    if (!isNaN(val) && val >= 0) {
      if (fluidType === 'afi') {
        const res = interpretAfi(val);
        setFluidAssessment(res.assessment);
      } else {
        const res = interpretSdp(val);
        setFluidAssessment(res.assessment);
      }
    }
  }, [fluidCm, fluidType]);

  const resetForm = () => {
    setEditingId(null);
    setScanDate(todayLocal());
    setScanType('growth_wellbeing');
    setIndication('');
    setGaWeeks('');
    setGaDays('0');
    setEddByScan('');
    setFetalNumber('single');
    setCardiacActivity('present');
    setFhrBpm('140');
    setPresentation('cephalic');
    setPlacentaLocation('anterior');
    setPlacentaGrade('1');
    setFluidType('afi');
    setFluidCm('14');
    setFluidAssessment('normal');
    setGsdMm('');
    setCrlMm('');
    setNtMm('');
    setNasalBone('present');
    setBpdMm('');
    setHcMm('');
    setAcMm('');
    setFlMm('');
    setEfwGrams('');
    setEfwPercentile('');
    setAnatomySurvey({});
    setUterusFindings('');
    setEndometrialMm('');
    setRightOvary('');
    setLeftOvary('');
    setFreeFluid('none');
    setImpression('');
    setRecommendations('');
    setSonographerName('');
    setFormError(null);
  };

  const startEdit = (r: UltrasoundReport) => {
    setEditingId(r.id);
    setScanDate(r.scanDate);
    setScanType(r.scanType);
    setIndication(r.indication ?? '');
    setGaWeeks(r.gestationalAgeWeeks != null ? String(r.gestationalAgeWeeks) : '');
    setGaDays(r.gestationalAgeDays != null ? String(r.gestationalAgeDays) : '0');
    setEddByScan(r.eddByScan ?? '');
    setFetalNumber(r.fetalNumber);
    setCardiacActivity(r.cardiacActivity);
    setFhrBpm(r.fhrBpm != null ? String(r.fhrBpm) : '');
    setPresentation(r.presentation ?? 'cephalic');
    setPlacentaLocation(r.placentaLocation ?? 'anterior');
    setPlacentaGrade(r.placentaGrade ?? '1');
    setFluidType((r.amnioticFluidType === 'sdp' ? 'sdp' : 'afi'));
    setFluidCm(r.amnioticFluidCm != null ? String(r.amnioticFluidCm) : '');
    setFluidAssessment(r.amnioticFluidAssessment ?? 'normal');
    setGsdMm(r.gsdMm != null ? String(r.gsdMm) : '');
    setCrlMm(r.crlMm != null ? String(r.crlMm) : '');
    setNtMm(r.ntMm != null ? String(r.ntMm) : '');
    setNasalBone(r.nasalBone ?? 'present');
    setBpdMm(r.bpdMm != null ? String(r.bpdMm) : '');
    setHcMm(r.hcMm != null ? String(r.hcMm) : '');
    setAcMm(r.acMm != null ? String(r.acMm) : '');
    setFlMm(r.flMm != null ? String(r.flMm) : '');
    setEfwGrams(r.efwGrams != null ? String(r.efwGrams) : '');
    setEfwPercentile(r.efwPercentile ?? '');

    let anat: Record<string, string> = {};
    if (r.anatomySurvey) {
      try {
        anat = JSON.parse(r.anatomySurvey);
      } catch {
        // ignore
      }
    }
    setAnatomySurvey(anat);

    setUterusFindings(r.uterusFindings ?? '');
    setEndometrialMm(r.endometrialThicknessMm != null ? String(r.endometrialThicknessMm) : '');
    setRightOvary(r.rightOvaryFindings ?? '');
    setLeftOvary(r.leftOvaryFindings ?? '');
    setFreeFluid(r.freeFluid ?? 'none');
    setImpression(r.impression);
    setRecommendations(r.recommendations ?? '');
    setSonographerName(r.sonographerName ?? '');
    setShowForm(true);
  };

  const handleAllNormalAnatomy = () => {
    const allNorm: Record<string, string> = {};
    ANATOMICAL_SURVEY_ITEMS.forEach((it) => {
      allNorm[it.key] = 'Normal';
    });
    setAnatomySurvey(allNorm);
  };

  const handleGenerateImpression = () => {
    if (scanType === 'pelvic_gyn') {
      const parts = ['Pelvic ultrasound examination:'];
      if (uterusFindings) parts.push(`Uterus: ${uterusFindings}.`);
      if (endometrialMm) parts.push(`Endometrial thickness: ${endometrialMm} mm.`);
      if (rightOvary) parts.push(`Right ovary: ${rightOvary}.`);
      if (leftOvary) parts.push(`Left ovary: ${leftOvary}.`);
      if (freeFluid && freeFluid !== 'none') parts.push(`Free fluid: ${freeFluid} in Pouch of Douglas.`);
      else parts.push('No free pelvic fluid seen.');
      setImpression(parts.join(' '));
      return;
    }

    const parts: string[] = [];
    const countStr = fetalNumber === 'twins' ? 'Twin' : fetalNumber === 'triplets' ? 'Triplet' : 'Single';
    const cardiacStr = cardiacActivity === 'present' ? 'live intrauterine fetus' : 'intrauterine gestation';
    parts.push(`${countStr} ${cardiacStr}`);

    if (gaWeeks) {
      parts.push(`corresponding to ${gaWeeks} weeks ${gaDays || 0} days`);
    }
    if (presentation && presentation !== 'not_applicable') {
      parts.push(`in ${presentation} presentation`);
    }
    if (efwGrams) {
      parts.push(`with estimated fetal weight of ${efwGrams}g (${efwPercentile || 'AGA'})`);
    }
    if (placentaLocation && placentaLocation !== 'not_applicable') {
      parts.push(`· Placenta ${placentaLocation} (Grade ${placentaGrade || '1'})`);
    }
    if (fluidCm) {
      parts.push(`· Liquor ${fluidAssessment} (${fluidType.toUpperCase()} ${fluidCm} cm)`);
    }
    if (scanType === 'anomaly_scan') {
      parts.push('· Targeted anatomical survey gross morphological anomalies not detected at this gestation.');
    }

    setImpression(parts.join(' ') + '.');
  };

  const saveReport = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setFormSaving(true);
      setFormError(null);

      const payload = {
        scanDate,
        scanType,
        indication: indication.trim() || null,
        clinicalLmp: clinicalLmp || null,
        eddByScan: eddByScan.trim() || null,
        gestationalAgeWeeks: gaWeeks ? parseInt(gaWeeks, 10) : null,
        gestationalAgeDays: gaDays ? parseInt(gaDays, 10) : null,
        fetalNumber,
        cardiacActivity,
        fhrBpm: fhrBpm ? parseInt(fhrBpm, 10) : null,
        presentation: scanType === 'pelvic_gyn' ? null : (presentation || null),
        placentaLocation: scanType === 'pelvic_gyn' ? null : (placentaLocation || null),
        placentaGrade: scanType === 'pelvic_gyn' ? null : (placentaGrade || null),
        amnioticFluidType: scanType === 'pelvic_gyn' ? null : fluidType,
        amnioticFluidCm: scanType === 'pelvic_gyn' || !fluidCm ? null : parseFloat(fluidCm),
        amnioticFluidAssessment: scanType === 'pelvic_gyn' ? null : fluidAssessment,
        gsdMm: gsdMm ? parseFloat(gsdMm) : null,
        crlMm: crlMm ? parseFloat(crlMm) : null,
        ntMm: ntMm ? parseFloat(ntMm) : null,
        nasalBone: scanType === 'nt_first_trimester' ? nasalBone : null,
        bpdMm: bpdMm ? parseFloat(bpdMm) : null,
        hcMm: hcMm ? parseFloat(hcMm) : null,
        acMm: acMm ? parseFloat(acMm) : null,
        flMm: flMm ? parseFloat(flMm) : null,
        efwGrams: efwGrams ? parseInt(efwGrams, 10) : null,
        efwPercentile: efwPercentile.trim() || null,
        anatomySurvey: Object.keys(anatomySurvey).length > 0 ? JSON.stringify(anatomySurvey) : null,
        uterusFindings: uterusFindings.trim() || null,
        endometrialThicknessMm: endometrialMm ? parseFloat(endometrialMm) : null,
        rightOvaryFindings: rightOvary.trim() || null,
        leftOvaryFindings: leftOvary.trim() || null,
        freeFluid: scanType === 'pelvic_gyn' ? freeFluid : null,
        impression: impression.trim() || 'Ultrasound scan performed.',
        recommendations: recommendations.trim() || null,
        sonographerName: sonographerName.trim() || null,
      };

      if (editingId) {
        await api('PATCH', `/api/ultrasounds/${editingId}`, payload);
      } else {
        await api('POST', `/api/patients/${patientId}/ultrasounds`, payload);
      }

      setShowForm(false);
      resetForm();
      await load();
      onChanged?.();
    } catch (err) {
      setFormError(err);
    } finally {
      setFormSaving(false);
    }
  };

  const deleteReport = async (id: number) => {
    try {
      await api('DELETE', `/api/ultrasounds/${id}`);
      setConfirmDeleteId(null);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err);
    }
  };

  const latestScan = reports && reports.length > 0 ? reports[0] : null;

  return (
    <section className="card stack" style={{ marginTop: '1.25rem' }}>
      {/* Header bar */}
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📡</span> Ultrasound &amp; Sonography Reports
          </h2>
          <div className="muted small">
            Structured biometry (BPD, HC, AC, FL, CRL), Hadlock EFW curves, AFI fluid index &amp; TIFFA anomaly surveys
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            className="btn primary small"
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                resetForm();
              } else {
                resetForm();
                setShowForm(true);
              }
            }}
          >
            {showForm ? 'Cancel Entry' : '+ New Ultrasound Scan'}
          </button>
        )}
      </div>

      <ErrorBanner error={error} />

      {/* Summary statistics */}
      {reports && reports.length > 0 && (
        <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <div className="stat">
            <b>{reports.length}</b>
            <span>Total Scans</span>
          </div>
          {latestScan && (
            <>
              <div className="stat">
                <b>{latestScan.scanDate}</b>
                <span>Latest Scan ({latestScan.scanType.replace('_', ' ')})</span>
              </div>
              {latestScan.gestationalAgeWeeks != null && (
                <div className="stat">
                  <b>{latestScan.gestationalAgeWeeks}w {latestScan.gestationalAgeDays ?? 0}d</b>
                  <span>Scan GA</span>
                </div>
              )}
              {latestScan.efwGrams != null && (
                <div className="stat">
                  <b>{latestScan.efwGrams} g</b>
                  <span>Latest EFW ({latestScan.efwPercentile ? latestScan.efwPercentile.split(' ')[0] : 'Hadlock'})</span>
                </div>
              )}
              {latestScan.amnioticFluidCm != null && (
                <div className="stat">
                  <b>{latestScan.amnioticFluidCm} cm</b>
                  <span>Liquor ({latestScan.amnioticFluidAssessment || 'AFI'})</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <form onSubmit={(e) => void saveReport(e)} className="card stack" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0 }}>
            {editingId ? `Edit Ultrasound Report #${editingId}` : 'Record New Ultrasound Scan'}
          </h3>

          <ErrorBanner error={formError} />

          {/* Primary Scan Classification */}
          <div className="grid-2" style={{ gap: '0.8rem' }}>
            <Field label="Scan Date">
              <input
                type="date"
                required
                value={scanDate}
                onChange={(e) => setScanDate(e.target.value)}
              />
            </Field>

            <Field label="Examination Type">
              <select
                value={scanType}
                onChange={(e) => setScanType(e.target.value as UltrasoundScanType)}
              >
                {Object.entries(SCAN_TYPE_LABELS).map(([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Clinical Indication / Reason">
            <input
              value={indication}
              placeholder="e.g. Routine 2nd trimester anomaly check, bleeding in early pregnancy, growth monitoring"
              onChange={(e) => setIndication(e.target.value)}
            />
          </Field>

          {/* Obstetric Biometrics & Dating */}
          {scanType !== 'pelvic_gyn' && (
            <fieldset className="stack" style={{ border: '1px solid var(--border)', padding: '0.8rem', borderRadius: '4px' }}>
              <legend style={{ fontWeight: 600, padding: '0 0.4rem' }}>
                🤰 Fetal Biometry &amp; Gestational Parameters
              </legend>

              <div className="row wrap" style={{ gap: '0.8rem', alignItems: 'center' }}>
                <Field label="Gestational Age (Weeks)">
                  <input
                    type="number"
                    min={0}
                    max={44}
                    value={gaWeeks}
                    placeholder="e.g. 28"
                    onChange={(e) => setGaWeeks(e.target.value)}
                    style={{ width: '100px' }}
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
                    style={{ width: '80px' }}
                  />
                </Field>

                <Field label="EDD by Scan">
                  <input
                    type="date"
                    value={eddByScan}
                    onChange={(e) => setEddByScan(e.target.value)}
                  />
                </Field>

                <Field label="Fetus Count">
                  <select
                    value={fetalNumber}
                    onChange={(e) => setFetalNumber(e.target.value as any)}
                  >
                    <option value="single">Single</option>
                    <option value="twins">Twins</option>
                    <option value="triplets">Triplets</option>
                  </select>
                </Field>

                <Field label="Cardiac Activity">
                  <select
                    value={cardiacActivity}
                    onChange={(e) => setCardiacActivity(e.target.value as any)}
                  >
                    <option value="present">Present (Live)</option>
                    <option value="absent">Absent</option>
                    <option value="not_applicable">N/A</option>
                  </select>
                </Field>

                {cardiacActivity === 'present' && (
                  <Field label="FHR (bpm)">
                    <input
                      type="number"
                      min={40}
                      max={240}
                      value={fhrBpm}
                      placeholder="e.g. 142"
                      onChange={(e) => setFhrBpm(e.target.value)}
                      style={{ width: '90px' }}
                    />
                  </Field>
                )}
              </div>

              {/* Early pregnancy measurements */}
              {(scanType === 'early_pregnancy' || scanType === 'nt_first_trimester') && (
                <div className="row wrap" style={{ gap: '0.8rem', marginTop: '0.4rem', background: '#f8fafc', padding: '0.6rem', borderRadius: '4px' }}>
                  <Field label="GSD (mm)">
                    <input
                      type="number"
                      step="0.1"
                      value={gsdMm}
                      placeholder="e.g. 25.0"
                      onChange={(e) => setGsdMm(e.target.value)}
                      style={{ width: '100px' }}
                    />
                  </Field>

                  <Field label="CRL (mm) [auto-dates]">
                    <input
                      type="number"
                      step="0.1"
                      value={crlMm}
                      placeholder="e.g. 45.2"
                      onChange={(e) => setCrlMm(e.target.value)}
                      style={{ width: '120px' }}
                    />
                  </Field>

                  {scanType === 'nt_first_trimester' && (
                    <>
                      <Field label="NT (mm)">
                        <input
                          type="number"
                          step="0.1"
                          value={ntMm}
                          placeholder="e.g. 1.4"
                          onChange={(e) => setNtMm(e.target.value)}
                          style={{ width: '100px' }}
                        />
                      </Field>

                      <Field label="Nasal Bone">
                        <select
                          value={nasalBone}
                          onChange={(e) => setNasalBone(e.target.value)}
                        >
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="hypoplastic">Hypoplastic</option>
                          <option value="not_visualized">Not Visualized</option>
                        </select>
                      </Field>
                    </>
                  )}
                </div>
              )}

              {/* Second & Third Trimester Biometrics */}
              {scanType !== 'early_pregnancy' && (
                <div className="stack" style={{ gap: '0.5rem', marginTop: '0.4rem' }}>
                  <div className="row wrap" style={{ gap: '0.8rem', alignItems: 'center' }}>
                    <Field label="BPD (mm)">
                      <input
                        type="number"
                        step="0.1"
                        value={bpdMm}
                        placeholder="e.g. 72.4"
                        onChange={(e) => setBpdMm(e.target.value)}
                        style={{ width: '100px' }}
                      />
                    </Field>

                    <Field label="HC (mm)">
                      <input
                        type="number"
                        step="0.1"
                        value={hcMm}
                        placeholder="e.g. 265.0"
                        onChange={(e) => setHcMm(e.target.value)}
                        style={{ width: '100px' }}
                      />
                    </Field>

                    <Field label="AC (mm)">
                      <input
                        type="number"
                        step="0.1"
                        value={acMm}
                        placeholder="e.g. 240.5"
                        onChange={(e) => setAcMm(e.target.value)}
                        style={{ width: '100px' }}
                      />
                    </Field>

                    <Field label="FL (mm)">
                      <input
                        type="number"
                        step="0.1"
                        value={flMm}
                        placeholder="e.g. 54.0"
                        onChange={(e) => setFlMm(e.target.value)}
                        style={{ width: '100px' }}
                      />
                    </Field>
                  </div>

                  {/* Calculated Hadlock EFW Card */}
                  <div
                    style={{
                      background: efwGrams ? '#f0fdf4' : '#f8fafc',
                      border: efwGrams ? '1px solid #86efac' : '1px solid var(--border)',
                      padding: '0.5rem 0.8rem',
                      borderRadius: '4px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.9rem' }}>Estimated Fetal Weight (Hadlock):</strong>{' '}
                      {efwGrams ? (
                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#15803d' }}>
                          {efwGrams} grams
                        </span>
                      ) : (
                        <span className="muted">Enter AC and FL to auto-calculate</span>
                      )}
                    </div>
                    {efwPercentile && (
                      <div className="badge ok" style={{ fontSize: '0.85rem' }}>
                        {efwPercentile}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fetal Environment: Presentation, Placenta, Amniotic Fluid */}
              <div className="row wrap" style={{ gap: '0.8rem', marginTop: '0.6rem' }}>
                <Field label="Presentation / Lie">
                  <select
                    value={presentation}
                    onChange={(e) => setPresentation(e.target.value)}
                  >
                    <option value="cephalic">Cephalic (Vertex)</option>
                    <option value="breech">Breech</option>
                    <option value="transverse">Transverse</option>
                    <option value="oblique">Oblique</option>
                    <option value="variable">Variable / Unstable</option>
                  </select>
                </Field>

                <Field label="Placenta Location">
                  <select
                    value={placentaLocation}
                    onChange={(e) => setPlacentaLocation(e.target.value)}
                  >
                    <option value="anterior">Anterior</option>
                    <option value="posterior">Posterior</option>
                    <option value="fundal">Fundal</option>
                    <option value="low_lying">Low Lying</option>
                    <option value="previa">Placenta Previa</option>
                  </select>
                </Field>

                <Field label="Placenta Maturity Grade">
                  <select
                    value={placentaGrade}
                    onChange={(e) => setPlacentaGrade(e.target.value)}
                  >
                    <option value="0">Grade 0</option>
                    <option value="1">Grade I</option>
                    <option value="2">Grade II</option>
                    <option value="3">Grade III</option>
                  </select>
                </Field>

                <Field label="Amniotic Fluid Method">
                  <select
                    value={fluidType}
                    onChange={(e) => setFluidType(e.target.value as any)}
                  >
                    <option value="afi">AFI (4-quadrant index)</option>
                    <option value="sdp">Single Deepest Pocket (SDP)</option>
                  </select>
                </Field>

                <Field label={`${fluidType.toUpperCase()} (cm)`}>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={50}
                    value={fluidCm}
                    onChange={(e) => setFluidCm(e.target.value)}
                    style={{ width: '90px' }}
                  />
                </Field>

                <Field label="Fluid Assessment">
                  <select
                    value={fluidAssessment}
                    onChange={(e) => setFluidAssessment(e.target.value)}
                  >
                    <option value="normal">Normal / Adequate</option>
                    <option value="borderline">Borderline Low</option>
                    <option value="oligohydramnios">Oligohydramnios</option>
                    <option value="polyhydramnios">Polyhydramnios</option>
                  </select>
                </Field>
              </div>

              {/* TIFFA Anomaly Checklist */}
              {scanType === 'anomaly_scan' && (
                <div style={{ marginTop: '0.8rem', background: '#fafaf9', padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong>🔍 Targeted Anatomical Survey (TIFFA Checklist):</strong>
                    <button
                      type="button"
                      className="btn small"
                      onClick={handleAllNormalAnatomy}
                    >
                      ✓ Mark All Visualized &amp; Normal
                    </button>
                  </div>
                  <div className="grid-2" style={{ gap: '0.5rem' }}>
                    {ANATOMICAL_SURVEY_ITEMS.map((item) => (
                      <div key={item.key} className="row" style={{ alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ flex: 1, fontSize: '0.8rem' }}>{item.label}:</label>
                        <select
                          value={anatomySurvey[item.key] || 'Normal'}
                          onChange={(e) =>
                            setAnatomySurvey({ ...anatomySurvey, [item.key]: e.target.value })
                          }
                          style={{ width: '130px', fontSize: '0.8rem' }}
                        >
                          <option value="Normal">Normal</option>
                          <option value="Abnormal">⚠️ Abnormal</option>
                          <option value="Suboptimally seen">Suboptimal</option>
                          <option value="Not visualized">Not seen</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </fieldset>
          )}

          {/* Pelvic GYN Fields */}
          {scanType === 'pelvic_gyn' && (
            <fieldset className="stack" style={{ border: '1px solid var(--border)', padding: '0.8rem', borderRadius: '4px' }}>
              <legend style={{ fontWeight: 600, padding: '0 0.4rem' }}>
                🩺 Pelvic &amp; Gynecological Assessment
              </legend>

              <div className="grid-2" style={{ gap: '0.8rem' }}>
                <Field label="Uterus Morphology &amp; Myometrium">
                  <input
                    value={uterusFindings}
                    placeholder="e.g. Anteverted, normal size (7.5 x 4.2 x 3.8 cm), homogeneous myometrium"
                    onChange={(e) => setUterusFindings(e.target.value)}
                  />
                </Field>

                <Field label="Endometrial Thickness (mm)">
                  <input
                    type="number"
                    step="0.1"
                    min={0.1}
                    max={40}
                    value={endometrialMm}
                    placeholder="e.g. 8.5"
                    onChange={(e) => setEndometrialMm(e.target.value)}
                    style={{ width: '100px' }}
                  />
                </Field>

                <Field label="Right Ovary">
                  <input
                    value={rightOvary}
                    placeholder="e.g. Normal size (2.8 x 1.8 cm), multiple small peripheral follicles"
                    onChange={(e) => setRightOvary(e.target.value)}
                  />
                </Field>

                <Field label="Left Ovary">
                  <input
                    value={leftOvary}
                    placeholder="e.g. Normal size (3.0 x 2.0 cm), no dominant cyst"
                    onChange={(e) => setLeftOvary(e.target.value)}
                  />
                </Field>

                <Field label="Pouch of Douglas (POD) Free Fluid">
                  <select
                    value={freeFluid}
                    onChange={(e) => setFreeFluid(e.target.value)}
                  >
                    <option value="none">None</option>
                    <option value="minimal">Minimal physiological fluid</option>
                    <option value="moderate">Moderate free fluid</option>
                    <option value="gross">Gross free fluid / Hemoperitoneum</option>
                  </select>
                </Field>
              </div>
            </fieldset>
          )}

          {/* Impressions & Clinical Recommendations */}
          <div className="stack" style={{ gap: '0.5rem' }}>
            <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="usg-imp" style={{ fontWeight: 600 }}>
                Diagnostic Impression / Conclusion: *
              </label>
              <button
                type="button"
                className="btn small"
                onClick={handleGenerateImpression}
                title="Assemble findings into standardized impression"
              >
                ✨ Auto-Draft Impression
              </button>
            </div>
            <textarea
              id="usg-imp"
              rows={4}
              required
              value={impression}
              placeholder="e.g. Single live intrauterine gestation corresponding to 28 weeks 3 days. Adequate liquor. Normal fetal biometry and growth velocity."
              onChange={(e) => setImpression(e.target.value)}
            />
          </div>

          <div className="grid-2" style={{ gap: '0.8rem' }}>
            <Field label="Recommendations / Advised Follow-up">
              <input
                value={recommendations}
                placeholder="e.g. Repeat growth scan and Doppler at 32 weeks; anomaly survey satisfactory"
                onChange={(e) => setRecommendations(e.target.value)}
              />
            </Field>

            <Field label="Sonographer / Consultant Name">
              <input
                value={sonographerName}
                placeholder="Doctor / Sonologist name"
                onChange={(e) => setSonographerName(e.target.value)}
              />
            </Field>
          </div>

          {/* Action buttons */}
          <div className="row wrap" style={{ gap: '0.6rem', marginTop: '0.5rem' }}>
            <button className="btn primary" disabled={formSaving}>
              {formSaving ? 'Saving…' : editingId ? 'Update Ultrasound Report' : 'Save Ultrasound Report'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              disabled={formSaving}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Reports Listing */}
      {loading && !reports && <p className="muted">Loading ultrasound records…</p>}

      {reports && reports.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--bg)', borderRadius: '4px' }}>
          <p className="muted">No ultrasound or sonography reports recorded for this patient.</p>
          {canEdit && (
            <button
              type="button"
              className="btn small primary"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              + Record First Ultrasound Scan
            </button>
          )}
        </div>
      )}

      {reports && reports.length > 0 && (
        <ul className="cards" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {reports.map((r) => (
            <li
              key={r.id}
              className="card stack"
              style={{
                borderLeft: '4px solid #0284c7',
                padding: '0.8rem 1rem',
                gap: '0.45rem',
              }}
            >
              <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="row wrap" style={{ gap: '0.5rem', alignItems: 'center' }}>
                    <strong style={{ fontSize: '1.05rem' }}>{r.scanDate}</strong>
                    <span className="badge info small">
                      {SCAN_TYPE_LABELS[r.scanType] ?? r.scanType}
                    </span>
                    {r.gestationalAgeWeeks != null && (
                      <span className="badge small">
                        GA: {r.gestationalAgeWeeks}w {r.gestationalAgeDays ?? 0}d
                      </span>
                    )}
                    {r.efwGrams != null && (
                      <span className="badge ok small">
                        EFW: {r.efwGrams}g ({r.efwPercentile ? r.efwPercentile.split(' ')[0] : 'Hadlock'})
                      </span>
                    )}
                  </div>

                  {r.indication && (
                    <div className="muted small" style={{ marginTop: '0.2rem' }}>
                      <strong>Indication:</strong> {r.indication}
                    </div>
                  )}
                </div>

                <div className="row" style={{ gap: '0.4rem', alignItems: 'center' }}>
                  <Link
                    to={`/ultrasounds/${r.id}/print`}
                    className="btn small"
                    title="Open printable formal sonography report"
                  >
                    🖨️ Print
                  </Link>

                  {canEdit && (
                    <>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => startEdit(r)}
                      >
                        ✏️ Edit
                      </button>

                      {confirmDeleteId === r.id ? (
                        <button
                          type="button"
                          className="btn small danger"
                          onClick={() => void deleteReport(r.id)}
                        >
                          Confirm Delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn small muted"
                          onClick={() => setConfirmDeleteId(r.id)}
                          title="Delete ultrasound report"
                        >
                          🗑️
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Biometrics details summary */}
              <div className="row wrap" style={{ gap: '0.8rem', fontSize: '0.85rem' }}>
                {r.fhrBpm && <span>❤️ FHR: <strong>{r.fhrBpm} bpm</strong></span>}
                {r.presentation && <span>🎯 Lie: <strong>{r.presentation}</strong></span>}
                {r.placentaLocation && (
                  <span>
                    🧱 Placenta: <strong>{r.placentaLocation}</strong> {r.placentaGrade ? `(Gr ${r.placentaGrade})` : ''}
                  </span>
                )}
                {r.amnioticFluidCm != null && (
                  <span>
                    💧 Fluid: <strong>{r.amnioticFluidCm} cm</strong> ({r.amnioticFluidAssessment || 'Normal'})
                  </span>
                )}
                {r.crlMm != null && <span>📏 CRL: <strong>{r.crlMm} mm</strong></span>}
                {r.bpdMm != null && <span>BPD: <strong>{r.bpdMm} mm</strong></span>}
                {r.acMm != null && <span>AC: <strong>{r.acMm} mm</strong></span>}
                {r.flMm != null && <span>FL: <strong>{r.flMm} mm</strong></span>}
                {r.endometrialThicknessMm != null && (
                  <span>Endometrium: <strong>{r.endometrialThicknessMm} mm</strong></span>
                )}
              </div>

              {/* Impression */}
              <div
                style={{
                  background: 'var(--bg)',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '4px',
                  fontSize: '0.88rem',
                  lineHeight: 1.4,
                  marginTop: '0.2rem',
                }}
              >
                <strong>Impression:</strong> {r.impression}
                {r.recommendations && (
                  <div className="muted small" style={{ marginTop: '0.2rem' }}>
                    <strong>Advised:</strong> {r.recommendations}
                  </div>
                )}
              </div>

              <div className="muted small" style={{ fontSize: '0.75rem', marginTop: '0.1rem' }}>
                Recorded by {r.sonographerName || r.createdByName || 'Staff'} · Report #{r.id}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
