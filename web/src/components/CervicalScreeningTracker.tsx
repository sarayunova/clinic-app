import React, { useState, useEffect, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { api, type CervicalScreeningRecord, type CervicalBiopsy } from '../api';
import {
  calculateSwedeScore,
  calculateReidIndex,
  determineBethesdaRisk,
  generateManagementGuideline,
  BETHESDA_CYTOLOGY_MAP,
  SWEDE_ACETOWHITENING_OPTIONS,
  SWEDE_MARGIN_OPTIONS,
  SWEDE_VESSEL_OPTIONS,
  SWEDE_SIZE_OPTIONS,
  SWEDE_IODINE_OPTIONS,
  TRANSFORMATION_ZONE_TYPES,
  CERVICAL_CLOCK_POSITIONS,
  type CytologyCategory,
} from '../cervicalEngine';

interface Props {
  patientId: number;
}

export function CervicalScreeningTracker({ patientId }: Props) {
  const [records, setRecords] = useState<CervicalScreeningRecord[]>([]);
  const [activeRecordId, setActiveRecordId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showScreeningModal, setShowScreeningModal] = useState(false);
  const [showBiopsyModal, setShowBiopsyModal] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);

  // Screening Form State
  const [form, setForm] = useState({
    screeningDate: new Date().toISOString().slice(0, 10),
    screeningType: 'co_test',
    indication: 'routine_screening',
    papPerformed: true,
    papSampleType: 'liquid_based',
    papAdequacy: 'satisfactory_with_ec_tz',
    papResult: 'nilm',
    papLabName: '',
    papReportNumber: '',
    hpvPerformed: true,
    hpvTestType: 'pcr',
    hpvOverallResult: 'negative',
    hpv16Positive: false,
    hpv18Positive: false,
    hpv45Positive: false,
    hpvOtherHighRiskPositive: false,
    hpvViralLoad: '',
    colposcopyPerformed: false,
    colposcopyDate: new Date().toISOString().slice(0, 10),
    examinerName: '',
    cervixVisibility: 'fully_visible',
    transformationZoneType: 'type_1',
    squamocolumnarJunctionVisible: 'completely_visible',
    swedeAcetowhitening: 0,
    swedeMargins: 0,
    swedeVessels: 0,
    swedeLesionSize: 0,
    swedeIodineStaining: 0,
    reidMargin: 0,
    reidColor: 0,
    reidVessels: 0,
    reidIodine: 0,
    selectedClockPositions: [] as number[],
    endocervicalCurettageDone: false,
    biopsyTaken: false,
    biopsyType: 'punch_biopsy',
    biopsySites: '',
    biopsyResult: 'pending',
    histopathologyNumber: '',
    managementRecommendation: '',
    nextRecallMonths: 60,
    clinicalNotes: '',
  });

  // Biopsy Form State
  const [biopsyForm, setBiopsyForm] = useState({
    siteLocation: "12 o'clock anterior lip",
    clockPosition: 12,
    specimenLabel: 'BX-1',
    histopathologyResult: 'pending',
    pathologistNotes: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api<{ records: CervicalScreeningRecord[] }>(
        'GET',
        `/api/patients/${patientId}/cervical-screenings`,
      );
      setRecords(res.records || []);
      if (res.records && res.records.length > 0) {
        if (!activeRecordId || !res.records.some((r) => r.id === activeRecordId)) {
          setActiveRecordId(res.records[0]!.id);
        }
      } else {
        setActiveRecordId(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load cervical screening records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const activeRecord = useMemo(
    () => records.find((r) => r.id === activeRecordId) || records[0] || null,
    [records, activeRecordId],
  );

  // Live Swede score preview in form
  const liveSwede = useMemo(() => {
    if (!form.colposcopyPerformed) return null;
    return calculateSwedeScore({
      acetowhitening: form.swedeAcetowhitening,
      margins: form.swedeMargins,
      vessels: form.swedeVessels,
      lesionSize: form.swedeLesionSize,
      iodineStaining: form.swedeIodineStaining,
    });
  }, [
    form.colposcopyPerformed,
    form.swedeAcetowhitening,
    form.swedeMargins,
    form.swedeVessels,
    form.swedeLesionSize,
    form.swedeIodineStaining,
  ]);

  // Live auto-management recommendation in form
  const liveRecommendation = useMemo(() => {
    return generateManagementGuideline({
      papResult: form.papPerformed ? form.papResult : null,
      papAdequacy: form.papPerformed ? form.papAdequacy : null,
      hpvOverall: form.hpvPerformed ? form.hpvOverallResult : null,
      hpv16: form.hpvPerformed && form.hpv16Positive,
      hpv18: form.hpvPerformed && form.hpv18Positive,
      hpv45: form.hpvPerformed && form.hpv45Positive,
      hpvOtherHighRisk: form.hpvPerformed && form.hpvOtherHighRiskPositive,
      swedeScore: liveSwede ? liveSwede.total : null,
      biopsyResult: form.biopsyTaken ? form.biopsyResult : null,
    });
  }, [form, liveSwede]);

  const openNewScreeningModal = () => {
    setEditingRecordId(null);
    setForm({
      screeningDate: new Date().toISOString().slice(0, 10),
      screeningType: 'co_test',
      indication: 'routine_screening',
      papPerformed: true,
      papSampleType: 'liquid_based',
      papAdequacy: 'satisfactory_with_ec_tz',
      papResult: 'nilm',
      papLabName: '',
      papReportNumber: '',
      hpvPerformed: true,
      hpvTestType: 'pcr',
      hpvOverallResult: 'negative',
      hpv16Positive: false,
      hpv18Positive: false,
      hpv45Positive: false,
      hpvOtherHighRiskPositive: false,
      hpvViralLoad: '',
      colposcopyPerformed: false,
      colposcopyDate: new Date().toISOString().slice(0, 10),
      examinerName: '',
      cervixVisibility: 'fully_visible',
      transformationZoneType: 'type_1',
      squamocolumnarJunctionVisible: 'completely_visible',
      swedeAcetowhitening: 0,
      swedeMargins: 0,
      swedeVessels: 0,
      swedeLesionSize: 0,
      swedeIodineStaining: 0,
      reidMargin: 0,
      reidColor: 0,
      reidVessels: 0,
      reidIodine: 0,
      selectedClockPositions: [],
      endocervicalCurettageDone: false,
      biopsyTaken: false,
      biopsyType: 'punch_biopsy',
      biopsySites: '',
      biopsyResult: 'pending',
      histopathologyNumber: '',
      managementRecommendation: '',
      nextRecallMonths: 60,
      clinicalNotes: '',
    });
    setShowScreeningModal(true);
  };

  const openEditModal = (rec: CervicalScreeningRecord) => {
    setEditingRecordId(rec.id);
    const clockPositions: number[] = [];
    if (rec.lesion_quadrants) {
      for (const item of rec.lesion_quadrants) {
        const m = item.match(/(\d+)_oclock/);
        if (m && m[1]) clockPositions.push(Number(m[1]));
      }
    }

    setForm({
      screeningDate: rec.screening_date,
      screeningType: rec.screening_type,
      indication: rec.indication,
      papPerformed: Boolean(rec.pap_performed),
      papSampleType: rec.pap_sample_type || 'liquid_based',
      papAdequacy: rec.pap_adequacy || 'satisfactory_with_ec_tz',
      papResult: rec.pap_result || 'nilm',
      papLabName: rec.pap_lab_name || '',
      papReportNumber: rec.pap_report_number || '',
      hpvPerformed: Boolean(rec.hpv_performed),
      hpvTestType: rec.hpv_test_type || 'pcr',
      hpvOverallResult: rec.hpv_overall_result || 'negative',
      hpv16Positive: Boolean(rec.hpv_16_positive),
      hpv18Positive: Boolean(rec.hpv_18_positive),
      hpv45Positive: Boolean(rec.hpv_45_positive),
      hpvOtherHighRiskPositive: Boolean(rec.hpv_other_high_risk_positive),
      hpvViralLoad: rec.hpv_viral_load || '',
      colposcopyPerformed: Boolean(rec.colposcopy_performed),
      colposcopyDate: rec.colposcopy_date || rec.screening_date,
      examinerName: rec.examiner_name || '',
      cervixVisibility: rec.cervix_visibility || 'fully_visible',
      transformationZoneType: rec.transformation_zone_type || 'type_1',
      squamocolumnarJunctionVisible: rec.squamocolumnar_junction_visible || 'completely_visible',
      swedeAcetowhitening: rec.swede_acetowhitening ?? 0,
      swedeMargins: rec.swede_margins ?? 0,
      swedeVessels: rec.swede_vessels ?? 0,
      swedeLesionSize: rec.swede_lesion_size ?? 0,
      swedeIodineStaining: rec.swede_iodine_staining ?? 0,
      reidMargin: rec.reid_margin ?? 0,
      reidColor: rec.reid_color ?? 0,
      reidVessels: rec.reid_vessels ?? 0,
      reidIodine: rec.reid_iodine ?? 0,
      selectedClockPositions: clockPositions,
      endocervicalCurettageDone: Boolean(rec.endocervical_curettage_done),
      biopsyTaken: Boolean(rec.biopsy_taken),
      biopsyType: rec.biopsy_type || 'punch_biopsy',
      biopsySites: rec.biopsy_sites || '',
      biopsyResult: rec.biopsy_result || 'pending',
      histopathologyNumber: rec.histopathology_number || '',
      managementRecommendation: rec.management_recommendation || '',
      nextRecallMonths: rec.next_recall_months ?? 60,
      clinicalNotes: rec.clinical_notes || '',
    });
    setShowScreeningModal(true);
  };

  const handleSaveScreening = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const lesionQuadrants = form.selectedClockPositions.map((c) => `${c}_oclock`);
      const payload = {
        screeningDate: form.screeningDate,
        screeningType: form.screeningType,
        indication: form.indication,
        papPerformed: form.papPerformed,
        papSampleType: form.papPerformed ? form.papSampleType : null,
        papAdequacy: form.papPerformed ? form.papAdequacy : null,
        papResult: form.papPerformed ? form.papResult : null,
        papLabName: form.papPerformed ? form.papLabName : null,
        papReportNumber: form.papPerformed ? form.papReportNumber : null,
        hpvPerformed: form.hpvPerformed,
        hpvTestType: form.hpvPerformed ? form.hpvTestType : null,
        hpvOverallResult: form.hpvPerformed ? form.hpvOverallResult : null,
        hpv16Positive: form.hpvPerformed ? form.hpv16Positive : false,
        hpv18Positive: form.hpvPerformed ? form.hpv18Positive : false,
        hpv45Positive: form.hpvPerformed ? form.hpv45Positive : false,
        hpvOtherHighRiskPositive: form.hpvPerformed ? form.hpvOtherHighRiskPositive : false,
        hpvViralLoad: form.hpvPerformed ? form.hpvViralLoad : null,
        colposcopyPerformed: form.colposcopyPerformed,
        colposcopyDate: form.colposcopyPerformed ? form.colposcopyDate : null,
        examinerName: form.colposcopyPerformed ? form.examinerName : null,
        cervixVisibility: form.colposcopyPerformed ? form.cervixVisibility : null,
        transformationZoneType: form.colposcopyPerformed ? form.transformationZoneType : null,
        squamocolumnarJunctionVisible: form.colposcopyPerformed ? form.squamocolumnarJunctionVisible : null,
        swedeAcetowhitening: form.colposcopyPerformed ? form.swedeAcetowhitening : null,
        swedeMargins: form.colposcopyPerformed ? form.swedeMargins : null,
        swedeVessels: form.colposcopyPerformed ? form.swedeVessels : null,
        swedeLesionSize: form.colposcopyPerformed ? form.swedeLesionSize : null,
        swedeIodineStaining: form.colposcopyPerformed ? form.swedeIodineStaining : null,
        reidMargin: form.colposcopyPerformed ? form.reidMargin : null,
        reidColor: form.colposcopyPerformed ? form.reidColor : null,
        reidVessels: form.colposcopyPerformed ? form.reidVessels : null,
        reidIodine: form.colposcopyPerformed ? form.reidIodine : null,
        lesionQuadrants,
        endocervicalCurettageDone: form.colposcopyPerformed ? form.endocervicalCurettageDone : false,
        biopsyTaken: form.biopsyTaken,
        biopsyType: form.biopsyTaken ? form.biopsyType : 'none',
        biopsySites: form.biopsyTaken ? form.biopsySites : null,
        biopsyResult: form.biopsyTaken ? form.biopsyResult : null,
        histopathologyNumber: form.biopsyTaken ? form.histopathologyNumber : null,
        managementRecommendation: form.managementRecommendation || liveRecommendation.recommendation,
        nextRecallMonths: Number(form.nextRecallMonths) || liveRecommendation.recallMonths,
        clinicalNotes: form.clinicalNotes,
        status: 'completed',
      };

      if (editingRecordId) {
        await api('PUT', `/api/patients/${patientId}/cervical-screenings/${editingRecordId}`, payload);
        setSuccessMsg('Cervical screening record updated successfully.');
      } else {
        const res = await api<{ id: number }>('POST', `/api/patients/${patientId}/cervical-screenings`, payload);
        setSuccessMsg('New cervical screening and colposcopy record saved.');
        setActiveRecordId(res.id);
      }

      setShowScreeningModal(false);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving record');
    }
  };

  const handleDeleteScreening = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this cervical screening and colposcopy record?')) return;
    try {
      await api('DELETE', `/api/patients/${patientId}/cervical-screenings/${id}`);
      setSuccessMsg('Record deleted successfully.');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete record');
    }
  };

  const handleAddBiopsy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRecord) return;
    try {
      setError(null);
      await api('POST', `/api/patients/${patientId}/cervical-screenings/${activeRecord.id}/biopsies`, {
        siteLocation: biopsyForm.siteLocation,
        clockPosition: biopsyForm.clockPosition ? Number(biopsyForm.clockPosition) : null,
        specimenLabel: biopsyForm.specimenLabel,
        histopathologyResult: biopsyForm.histopathologyResult,
        pathologistNotes: biopsyForm.pathologistNotes,
      });
      setSuccessMsg('Biopsy specimen logged.');
      setShowBiopsyModal(false);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save biopsy specimen');
    }
  };

  const toggleClockPosition = (clock: number) => {
    setForm((prev) => {
      const exists = prev.selectedClockPositions.includes(clock);
      return {
        ...prev,
        selectedClockPositions: exists
          ? prev.selectedClockPositions.filter((c) => c !== clock)
          : [...prev.selectedClockPositions, clock],
      };
    });
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p className="muted">Loading cervical screening and colposcopy records…</p>
      </div>
    );
  }

  const activeBethesda = activeRecord ? determineBethesdaRisk(activeRecord.pap_result) : null;
  const activeSwede =
    activeRecord && activeRecord.swede_score_total != null
      ? calculateSwedeScore({
          acetowhitening: activeRecord.swede_acetowhitening ?? 0,
          margins: activeRecord.swede_margins ?? 0,
          vessels: activeRecord.swede_vessels ?? 0,
          lesionSize: activeRecord.swede_lesion_size ?? 0,
          iodineStaining: activeRecord.swede_iodine_staining ?? 0,
        })
      : null;

  return (
    <div className="stack" style={{ gap: '1.25rem' }}>
      {/* Alert Notices */}
      {error && (
        <div className="banner error" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}
      {successMsg && (
        <div className="banner info" role="status">
          {successMsg}
        </div>
      )}

      {/* Top Banner and Action Bar */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
          border: '1px solid #fbcfe8',
          padding: '1.25rem',
        }}
      >
        <div className="row wrap between middle" style={{ gap: '0.8rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.3rem 0', color: '#9d174d', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔬</span> Cervical Cancer Screening &amp; Colposcopy Registry
            </h2>
            <p className="muted small" style={{ margin: 0 }}>
              Bethesda 2014 Cytology, High-Risk HPV DNA Genotyping, Swede Colposcopy Scoring (0–10), and ASCCP / WHO Evidence-Based Algorithms
            </p>
          </div>
          <div className="row wrap" style={{ gap: '0.5rem' }}>
            <button type="button" className="btn primary" onClick={openNewScreeningModal}>
              + Log Cervical Screening / Colposcopy
            </button>
            <button type="button" className="btn small" onClick={() => void loadData()}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Screening Episodes Selector Bar */}
        {records.length > 0 && (
          <div style={{ marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid #fbcfe8' }}>
            <span className="small muted" style={{ marginRight: '0.5rem' }}>
              Screening Episodes ({records.length}):
            </span>
            <div className="row wrap" style={{ gap: '0.4rem', display: 'inline-flex' }}>
              {records.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`btn small ${activeRecord?.id === r.id ? 'primary' : ''}`}
                  onClick={() => setActiveRecordId(r.id)}
                  style={{ fontSize: '0.82rem' }}
                >
                  📅 {r.screening_date} ({r.screening_type.replace('_', ' ')})
                  {r.pap_result && ` • ${r.pap_result.toUpperCase()}`}
                  {r.hpv_overall_result === 'positive' && ' • HPV+'}
                  {r.swede_score_total != null && ` • Swede ${r.swede_score_total}/10`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {records.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', background: '#fafafa' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>🔬</div>
          <h3>No Cervical Screening Records Yet</h3>
          <p className="muted" style={{ maxWidth: '500px', margin: '0 auto 1.2rem auto' }}>
            Record cervical cytology (Pap smear), high-risk HPV DNA molecular test, or colposcopy examination with automated Swede scoring and cervical clock mapping.
          </p>
          <button type="button" className="btn primary" onClick={openNewScreeningModal}>
            Log First Cervical Screening
          </button>
        </div>
      ) : activeRecord ? (
        <div className="stack" style={{ gap: '1rem' }}>
          {/* Action Row for Active Record */}
          <div className="row wrap between middle" style={{ background: '#fff', padding: '0.6rem 1rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
            <div>
              <span className="bold" style={{ fontSize: '1.05rem', marginRight: '0.5rem' }}>
                Episode Date: {activeRecord.screening_date}
              </span>
              <span className="tag small" style={{ textTransform: 'capitalize' }}>
                {activeRecord.screening_type.replace(/_/g, ' ')}
              </span>
              <span className="tag small muted" style={{ marginLeft: '0.4rem', textTransform: 'capitalize' }}>
                Indication: {activeRecord.indication.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="row" style={{ gap: '0.4rem' }}>
              <NavLink to={`/patients/${patientId}/cervical-screenings/${activeRecord.id}/print`} className="btn small">
                🖨️ Printable Colposcopy Report
              </NavLink>
              <button type="button" className="btn small" onClick={() => openEditModal(activeRecord)}>
                ✏️ Edit Episode
              </button>
              <button type="button" className="btn small error" onClick={() => void handleDeleteScreening(activeRecord.id)}>
                🗑️ Delete
              </button>
            </div>
          </div>

          {/* ASCCP / WHO Clinical Management Guidance Banner */}
          <div
            className="card"
            style={{
              borderLeft: `6px solid ${
                activeRecord.pap_result === 'scc' || activeRecord.pap_result === 'adenocarcinoma'
                  ? '#ef4444'
                  : activeRecord.pap_result === 'hsil' || activeRecord.hpv_16_positive || (activeRecord.swede_score_total ?? 0) >= 8
                  ? '#f59e0b'
                  : '#10b981'
              }`,
              background: '#f8fafc',
            }}
          >
            <div className="row wrap between middle" style={{ marginBottom: '0.4rem' }}>
              <div className="row middle" style={{ gap: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem' }}>🎯</span>
                <h3 style={{ margin: 0 }}>Evidence-Based Clinical Management Plan</h3>
              </div>
              <span
                className="tag"
                style={{
                  fontWeight: 600,
                  background: (activeRecord.next_recall_months ?? 60) <= 3 ? '#fee2e2' : '#e0f2fe',
                  color: (activeRecord.next_recall_months ?? 60) <= 3 ? '#991b1b' : '#0369a1',
                }}
              >
                Recommended Recall: {activeRecord.next_recall_months ?? 60} Months
              </span>
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.4rem' }}>
              {activeRecord.management_recommendation}
            </div>
            {activeRecord.clinical_notes && (
              <p className="muted small" style={{ margin: '0.2rem 0 0 0' }}>
                <strong>Clinician Notes:</strong> {activeRecord.clinical_notes}
              </p>
            )}
          </div>

          {/* 3-Column Clinical Dashboard Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1rem',
            }}
          >
            {/* 1. Cytology Card */}
            <div className="card stack" style={{ gap: '0.6rem' }}>
              <div className="row between middle" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>🧫</span> Bethesda 2014 Cytology
                </h4>
                <span className={`tag small ${activeRecord.pap_performed ? 'success' : 'muted'}`}>
                  {activeRecord.pap_performed ? 'Performed' : 'Not Done'}
                </span>
              </div>

              {activeRecord.pap_performed ? (
                <>
                  <div className="row middle between">
                    <span className="muted small">Diagnosis:</span>
                    <span
                      className="tag bold"
                      style={{
                        background:
                          activeBethesda?.grade === 'malignant'
                            ? '#fee2e2'
                            : activeBethesda?.grade === 'high_grade'
                            ? '#ffedd5'
                            : activeBethesda?.grade === 'low_grade'
                            ? '#e0e7ff'
                            : '#ecfdf5',
                        color:
                          activeBethesda?.grade === 'malignant'
                            ? '#991b1b'
                            : activeBethesda?.grade === 'high_grade'
                            ? '#c2410c'
                            : activeBethesda?.grade === 'low_grade'
                            ? '#3730a3'
                            : '#065f46',
                      }}
                    >
                      {activeBethesda?.title || activeRecord.pap_result?.toUpperCase()}
                    </span>
                  </div>
                  <div className="row middle between">
                    <span className="muted small">Sample Type:</span>
                    <span className="small bold" style={{ textTransform: 'capitalize' }}>
                      {activeRecord.pap_sample_type?.replace(/_/g, ' ') || '—'}
                    </span>
                  </div>
                  <div className="row middle between">
                    <span className="muted small">Adequacy:</span>
                    <span className="small bold" style={{ textTransform: 'capitalize' }}>
                      {activeRecord.pap_adequacy?.replace(/_/g, ' ') || '—'}
                    </span>
                  </div>
                  {(activeRecord.pap_lab_name || activeRecord.pap_report_number) && (
                    <div className="row middle between">
                      <span className="muted small">Lab / Report #:</span>
                      <span className="small">
                        {activeRecord.pap_lab_name || '—'} ({activeRecord.pap_report_number || '—'})
                      </span>
                    </div>
                  )}
                  {activeBethesda?.description && (
                    <p className="muted small" style={{ margin: '0.3rem 0 0 0', fontStyle: 'italic' }}>
                      {activeBethesda.description}
                    </p>
                  )}
                </>
              ) : (
                <p className="muted small">Cytology smear was not taken in this episode.</p>
              )}
            </div>

            {/* 2. HPV DNA Molecular Card */}
            <div className="card stack" style={{ gap: '0.6rem' }}>
              <div className="row between middle" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>🧬</span> High-Risk HPV DNA Testing
                </h4>
                <span className={`tag small ${activeRecord.hpv_performed ? 'success' : 'muted'}`}>
                  {activeRecord.hpv_performed ? 'Performed' : 'Not Done'}
                </span>
              </div>

              {activeRecord.hpv_performed ? (
                <>
                  <div className="row middle between">
                    <span className="muted small">Overall HR-HPV Status:</span>
                    <span
                      className={`tag bold ${
                        activeRecord.hpv_overall_result === 'positive'
                          ? 'error'
                          : activeRecord.hpv_overall_result === 'negative'
                          ? 'success'
                          : 'muted'
                      }`}
                    >
                      {activeRecord.hpv_overall_result?.toUpperCase() || '—'}
                    </span>
                  </div>
                  <div className="row middle between">
                    <span className="muted small">Test Method:</span>
                    <span className="small bold" style={{ textTransform: 'uppercase' }}>
                      {activeRecord.hpv_test_type || '—'}
                    </span>
                  </div>
                  <div style={{ marginTop: '0.3rem' }}>
                    <div className="muted small" style={{ marginBottom: '0.3rem' }}>
                      Oncogenic Genotype Breakdown:
                    </div>
                    <div className="row wrap" style={{ gap: '0.4rem' }}>
                      <span
                        className="tag small"
                        style={{
                          background: activeRecord.hpv_16_positive ? '#fee2e2' : '#f1f5f9',
                          color: activeRecord.hpv_16_positive ? '#991b1b' : '#64748b',
                          fontWeight: activeRecord.hpv_16_positive ? 700 : 400,
                        }}
                      >
                        HPV 16: {activeRecord.hpv_16_positive ? 'POSITIVE ⚠️' : 'Negative'}
                      </span>
                      <span
                        className="tag small"
                        style={{
                          background: activeRecord.hpv_18_positive ? '#fee2e2' : '#f1f5f9',
                          color: activeRecord.hpv_18_positive ? '#991b1b' : '#64748b',
                          fontWeight: activeRecord.hpv_18_positive ? 700 : 400,
                        }}
                      >
                        HPV 18: {activeRecord.hpv_18_positive ? 'POSITIVE ⚠️' : 'Negative'}
                      </span>
                      <span
                        className="tag small"
                        style={{
                          background: activeRecord.hpv_45_positive ? '#fef3c7' : '#f1f5f9',
                          color: activeRecord.hpv_45_positive ? '#92400e' : '#64748b',
                        }}
                      >
                        HPV 45: {activeRecord.hpv_45_positive ? 'POS' : 'Neg'}
                      </span>
                      <span
                        className="tag small"
                        style={{
                          background: activeRecord.hpv_other_high_risk_positive ? '#fef3c7' : '#f1f5f9',
                          color: activeRecord.hpv_other_high_risk_positive ? '#92400e' : '#64748b',
                        }}
                      >
                        Other HR Pool: {activeRecord.hpv_other_high_risk_positive ? 'POS' : 'Neg'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="muted small">HPV DNA testing was not conducted in this episode.</p>
              )}
            </div>

            {/* 3. Colposcopy & Swede Score Summary Card */}
            <div className="card stack" style={{ gap: '0.6rem' }}>
              <div className="row between middle" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>🔦</span> Colposcopy &amp; Swede Score
                </h4>
                <span className={`tag small ${activeRecord.colposcopy_performed ? 'success' : 'muted'}`}>
                  {activeRecord.colposcopy_performed ? 'Examined' : 'Not Performed'}
                </span>
              </div>

              {activeRecord.colposcopy_performed ? (
                <>
                  <div className="row middle between">
                    <span className="muted small">Swede Score:</span>
                    <span
                      className="tag bold"
                      style={{
                        background: activeSwede?.color || '#3b82f6',
                        color: '#fff',
                        fontSize: '0.95rem',
                      }}
                    >
                      {activeRecord.swede_score_total != null ? `${activeRecord.swede_score_total} / 10` : '—'}
                    </span>
                  </div>
                  <div className="row middle between">
                    <span className="muted small">Swede Interpretation:</span>
                    <span className="small bold" style={{ textAlign: 'right' }}>
                      {activeSwede?.title || activeRecord.swede_interpretation?.replace(/_/g, ' ') || '—'}
                    </span>
                  </div>
                  <div className="row middle between">
                    <span className="muted small">Transformation Zone:</span>
                    <span className="small bold" style={{ textTransform: 'capitalize' }}>
                      {activeRecord.transformation_zone_type?.replace(/_/g, ' ') || '—'}
                    </span>
                  </div>
                  <div className="row middle between">
                    <span className="muted small">SCJ Visibility:</span>
                    <span className="small bold" style={{ textTransform: 'capitalize' }}>
                      {activeRecord.squamocolumnar_junction_visible?.replace(/_/g, ' ') || '—'}
                    </span>
                  </div>
                  {activeRecord.reid_score_total != null && (
                    <div className="row middle between">
                      <span className="muted small">Reid Colposcopic Index:</span>
                      <span className="small bold">{activeRecord.reid_score_total} / 8</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="muted small">Colposcopy examination was not performed.</p>
              )}
            </div>
          </div>

          {/* Cervical Clock Face Diagram and Swede Breakdown */}
          {activeRecord.colposcopy_performed ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: '1rem',
              }}
            >
              {/* Cervix SVG Diagram */}
              <div className="card stack" style={{ alignItems: 'center' }}>
                <h4 style={{ margin: 0, alignSelf: 'flex-start' }}>Cervical Clock Lesion &amp; Biopsy Map</h4>
                <div style={{ position: 'relative', width: '280px', height: '280px', margin: '0.5rem auto' }}>
                  <svg width="280" height="280" viewBox="0 0 280 280">
                    <defs>
                      <radialGradient id="cervixGrad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.4" />
                        <stop offset="65%" stopColor="#f87171" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.1" />
                      </radialGradient>
                    </defs>

                    {/* Outer Cervix Border */}
                    <circle cx="140" cy="140" r="115" fill="url(#cervixGrad)" stroke="#cbd5e1" strokeWidth="3" />

                    {/* Transformation Zone Band */}
                    <circle cx="140" cy="140" r="70" fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="4 3" />

                    {/* External Os Center */}
                    <ellipse cx="140" cy="140" rx="14" ry="7" fill="#475569" stroke="#1e293b" strokeWidth="2" />

                    {/* Clock Hour Ticks and Radial Sectors */}
                    {CERVICAL_CLOCK_POSITIONS.map((cp) => {
                      const rad = (cp.angleDeg * Math.PI) / 180;
                      const x1 = 140 + 105 * Math.cos(rad);
                      const y1 = 140 + 105 * Math.sin(rad);
                      const x2 = 140 + 115 * Math.cos(rad);
                      const y2 = 140 + 115 * Math.sin(rad);

                      const lx = 140 + 128 * Math.cos(rad);
                      const ly = 140 + 128 * Math.sin(rad) + 4;

                      const isLesion = activeRecord.lesion_quadrants?.includes(`${cp.clock}_oclock`);
                      const hasBiopsy = activeRecord.biopsies?.some((b) => b.clock_position === cp.clock);

                      return (
                        <g key={cp.clock}>
                          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth="2" />
                          <text
                            x={lx}
                            y={ly}
                            fontSize="11"
                            textAnchor="middle"
                            fontWeight={isLesion || hasBiopsy ? 'bold' : 'normal'}
                            fill={isLesion ? '#dc2626' : hasBiopsy ? '#2563eb' : '#475569'}
                          >
                            {cp.clock}
                          </text>

                          {/* Lesion Highlight Overlay at Clock Position */}
                          {isLesion && (
                            <circle
                              cx={140 + 72 * Math.cos(rad)}
                              cy={140 + 72 * Math.sin(rad)}
                              r="16"
                              fill="#ef4444"
                              fillOpacity="0.45"
                              stroke="#b91c1c"
                              strokeWidth="1.5"
                            />
                          )}

                          {/* Biopsy Pin Marker */}
                          {hasBiopsy && (
                            <g>
                              <circle
                                cx={140 + 72 * Math.cos(rad)}
                                cy={140 + 72 * Math.sin(rad)}
                                r="7"
                                fill="#2563eb"
                                stroke="#fff"
                                strokeWidth="2"
                              />
                              <text
                                x={140 + 72 * Math.cos(rad)}
                                y={140 + 72 * Math.sin(rad) + 3}
                                fontSize="8"
                                fill="#fff"
                                textAnchor="middle"
                                fontWeight="bold"
                              >
                                B
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                    {/* Legend In-Diagram */}
                    <text x="140" y="275" fontSize="10" textAnchor="middle" fill="#64748b">
                      Anterior (12h) • Posterior (6h)
                    </text>
                  </svg>
                </div>
                <div className="row wrap center" style={{ gap: '0.8rem', fontSize: '0.8rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', opacity: 0.5, border: '1px solid #b91c1c' }} />
                    Acetowhite Lesion
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2563eb' }} />
                    Biopsy Site (B)
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ width: '12px', height: '2px', background: '#f43f5e', borderStyle: 'dashed' }} />
                    Transformation Zone
                  </span>
                </div>
              </div>

              {/* Swede Score Parameters Detail Breakdown */}
              <div className="card stack" style={{ gap: '0.6rem' }}>
                <h4 style={{ margin: 0 }}>Swede Score Parameter Breakdown (0–10)</h4>
                <table className="table small" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Colposcopic Feature</th>
                      <th style={{ textAlign: 'center' }}>Score</th>
                      <th>Finding</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>1. Acetowhitening</strong></td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{activeRecord.swede_acetowhitening ?? 0}</td>
                      <td>{SWEDE_ACETOWHITENING_OPTIONS.find((o) => o.value === activeRecord.swede_acetowhitening)?.label || '—'}</td>
                    </tr>
                    <tr>
                      <td><strong>2. Margins &amp; Surface</strong></td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{activeRecord.swede_margins ?? 0}</td>
                      <td>{SWEDE_MARGIN_OPTIONS.find((o) => o.value === activeRecord.swede_margins)?.label || '—'}</td>
                    </tr>
                    <tr>
                      <td><strong>3. Vascular Pattern</strong></td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{activeRecord.swede_vessels ?? 0}</td>
                      <td>{SWEDE_VESSEL_OPTIONS.find((o) => o.value === activeRecord.swede_vessels)?.label || '—'}</td>
                    </tr>
                    <tr>
                      <td><strong>4. Lesion Size</strong></td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{activeRecord.swede_lesion_size ?? 0}</td>
                      <td>{SWEDE_SIZE_OPTIONS.find((o) => o.value === activeRecord.swede_lesion_size)?.label || '—'}</td>
                    </tr>
                    <tr>
                      <td><strong>5. Iodine Staining (Lugol)</strong></td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{activeRecord.swede_iodine_staining ?? 0}</td>
                      <td>{SWEDE_IODINE_OPTIONS.find((o) => o.value === activeRecord.swede_iodine_staining)?.label || '—'}</td>
                    </tr>
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>
                      <td><strong>Total Swede Score</strong></td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: activeSwede?.color || '#000' }}>
                        {activeRecord.swede_score_total ?? 0} / 10
                      </td>
                      <td><strong>{activeSwede?.title}</strong></td>
                    </tr>
                  </tbody>
                </table>
                <div className="banner info small" style={{ margin: 0 }}>
                  <strong>Diagnostic Accuracy:</strong> Swede Score &ge; 8 has ~100% sensitivity and 90% specificity for high-grade CIN 2/3 lesions.
                </div>
              </div>
            </div>
          ) : null}

          {/* Cervical Biopsies & Histopathology Registry */}
          <div className="card stack" style={{ gap: '0.8rem' }}>
            <div className="row wrap between middle" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
              <div>
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>✂️</span> Cervical Biopsies &amp; Histopathology Registry ({activeRecord.biopsies?.length || 0})
                </h4>
                <p className="muted small" style={{ margin: '0.2rem 0 0 0' }}>
                  Punch biopsies, Endocervical Curettage (ECC), and LEEP/LLETZ specimen histopathology tracking
                </p>
              </div>
              <button
                type="button"
                className="btn small primary"
                onClick={() => {
                  setBiopsyForm({
                    siteLocation: "12 o'clock anterior lip",
                    clockPosition: 12,
                    specimenLabel: `BX-${(activeRecord.biopsies?.length || 0) + 1}`,
                    histopathologyResult: 'pending',
                    pathologistNotes: '',
                  });
                  setShowBiopsyModal(true);
                }}
              >
                + Add Biopsy Specimen
              </button>
            </div>

            {(!activeRecord.biopsies || activeRecord.biopsies.length === 0) ? (
              <p className="muted small" style={{ margin: '0.5rem 0' }}>
                No biopsy specimens logged for this screening episode. Click &quot;+ Add Biopsy Specimen&quot; to log punch biopsy or ECC pathology.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Specimen Label</th>
                      <th>Anatomical Site</th>
                      <th>Clock Position</th>
                      <th>Histopathology Diagnosis</th>
                      <th>Pathologist Notes</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRecord.biopsies.map((bx) => (
                      <tr key={bx.id}>
                        <td><strong>{bx.specimen_label || `BX-${bx.id}`}</strong></td>
                        <td>{bx.site_location}</td>
                        <td>{bx.clock_position ? `${bx.clock_position} o'clock` : 'Endocervix / ECC'}</td>
                        <td>
                          <span
                            className="tag small bold"
                            style={{
                              background:
                                bx.histopathology_result.includes('cin_3') || bx.histopathology_result.includes('scc')
                                  ? '#fee2e2'
                                  : bx.histopathology_result.includes('cin_2')
                                  ? '#ffedd5'
                                  : bx.histopathology_result.includes('cin_1')
                                  ? '#e0e7ff'
                                  : '#ecfdf5',
                              color:
                                bx.histopathology_result.includes('cin_3') || bx.histopathology_result.includes('scc')
                                  ? '#991b1b'
                                  : bx.histopathology_result.includes('cin_2')
                                  ? '#c2410c'
                                  : bx.histopathology_result.includes('cin_1')
                                  ? '#3730a3'
                                  : '#065f46',
                            }}
                          >
                            {bx.histopathology_result.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="small">{bx.pathologist_notes || '—'}</td>
                        <td className="small muted">{bx.created_at.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Modal: Log/Edit Cervical Screening Episode */}
      {showScreeningModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="row between middle" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '0.6rem' }}>
              <h3 style={{ margin: 0 }}>
                {editingRecordId ? 'Edit Cervical Screening Episode' : 'Log Cervical Screening & Colposcopy Episode'}
              </h3>
              <button type="button" className="btn small" onClick={() => setShowScreeningModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveScreening} className="stack" style={{ gap: '1rem', marginTop: '1rem' }}>
              {/* Screening Metadata */}
              <div className="row wrap" style={{ gap: '1rem' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="screeningDate">Screening Date *</label>
                  <input
                    id="screeningDate"
                    type="date"
                    required
                    value={form.screeningDate}
                    onChange={(e) => setForm({ ...form, screeningDate: e.target.value })}
                  />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="screeningType">Screening Type</label>
                  <select
                    id="screeningType"
                    value={form.screeningType}
                    onChange={(e) => setForm({ ...form, screeningType: e.target.value })}
                  >
                    <option value="co_test">Co-Test (Cytology + HPV DNA)</option>
                    <option value="pap_cytology">Pap Cytology Alone</option>
                    <option value="hpv_dna">HPV DNA Primary Alone</option>
                    <option value="colposcopy_only">Colposcopy Alone</option>
                    <option value="post_treatment_followup">Post-Treatment Surveillance</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="indication">Indication</label>
                  <select
                    id="indication"
                    value={form.indication}
                    onChange={(e) => setForm({ ...form, indication: e.target.value })}
                  >
                    <option value="routine_screening">Routine Well-Woman Screening</option>
                    <option value="abnormal_prior_screening">Abnormal Prior Cytology/HPV</option>
                    <option value="postcoital_bleeding">Postcoital Bleeding</option>
                    <option value="intermenstrual_bleeding">Intermenstrual Bleeding</option>
                    <option value="persistent_vaginal_discharge">Persistent Vaginal Discharge</option>
                    <option value="visible_cervical_lesion">Clinically Suspicious Cervix</option>
                    <option value="post_treatment_surveillance">Post-LEEP/Conization Followup</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Section 1: Cytology (Bethesda 2014) */}
              <div className="card stack" style={{ background: '#fdfbfb', gap: '0.8rem' }}>
                <div className="row middle" style={{ gap: '0.6rem' }}>
                  <input
                    id="papPerformed"
                    type="checkbox"
                    checked={form.papPerformed}
                    onChange={(e) => setForm({ ...form, papPerformed: e.target.checked })}
                  />
                  <label htmlFor="papPerformed" style={{ fontWeight: 'bold', margin: 0, cursor: 'pointer' }}>
                    1. Pap Cytology Smear Performed
                  </label>
                </div>

                {form.papPerformed && (
                  <div className="row wrap" style={{ gap: '0.8rem' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <label htmlFor="papResult">Bethesda 2014 Result</label>
                      <select
                        id="papResult"
                        value={form.papResult}
                        onChange={(e) => setForm({ ...form, papResult: e.target.value })}
                      >
                        {Object.entries(BETHESDA_CYTOLOGY_MAP).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: '1 1 180px' }}>
                      <label htmlFor="papAdequacy">Specimen Adequacy</label>
                      <select
                        id="papAdequacy"
                        value={form.papAdequacy}
                        onChange={(e) => setForm({ ...form, papAdequacy: e.target.value })}
                      >
                        <option value="satisfactory_with_ec_tz">Satisfactory (EC/TZ Component Present)</option>
                        <option value="satisfactory_without_ec_tz">Satisfactory (No EC/TZ Component)</option>
                        <option value="unsatisfactory_scant">Unsatisfactory (Scant Cellularity)</option>
                        <option value="unsatisfactory_obscured">Unsatisfactory (Obscured by Blood/Pus)</option>
                      </select>
                    </div>
                    <div style={{ flex: '1 1 160px' }}>
                      <label htmlFor="papSampleType">Smear Technique</label>
                      <select
                        id="papSampleType"
                        value={form.papSampleType}
                        onChange={(e) => setForm({ ...form, papSampleType: e.target.value })}
                      >
                        <option value="liquid_based">Liquid-Based Cytology (LBC)</option>
                        <option value="conventional_smear">Conventional Pap Smear</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: HPV DNA Molecular Testing */}
              <div className="card stack" style={{ background: '#fbfdff', gap: '0.8rem' }}>
                <div className="row middle" style={{ gap: '0.6rem' }}>
                  <input
                    id="hpvPerformed"
                    type="checkbox"
                    checked={form.hpvPerformed}
                    onChange={(e) => setForm({ ...form, hpvPerformed: e.target.checked })}
                  />
                  <label htmlFor="hpvPerformed" style={{ fontWeight: 'bold', margin: 0, cursor: 'pointer' }}>
                    2. High-Risk HPV DNA Molecular Assay Performed
                  </label>
                </div>

                {form.hpvPerformed && (
                  <div className="stack" style={{ gap: '0.8rem' }}>
                    <div className="row wrap" style={{ gap: '0.8rem' }}>
                      <div style={{ flex: '1 1 180px' }}>
                        <label htmlFor="hpvOverallResult">Overall Result</label>
                        <select
                          id="hpvOverallResult"
                          value={form.hpvOverallResult}
                          onChange={(e) => setForm({ ...form, hpvOverallResult: e.target.value })}
                        >
                          <option value="negative">Negative (No High-Risk HPV)</option>
                          <option value="positive">Positive (High-Risk HPV Detected)</option>
                          <option value="invalid_inconclusive">Inconclusive / Invalid</option>
                        </select>
                      </div>
                      <div style={{ flex: '1 1 180px' }}>
                        <label htmlFor="hpvTestType">Platform / Technology</label>
                        <select
                          id="hpvTestType"
                          value={form.hpvTestType}
                          onChange={(e) => setForm({ ...form, hpvTestType: e.target.value })}
                        >
                          <option value="pcr">Target Amplification (Real-Time PCR)</option>
                          <option value="cobas">Roche Cobas 4800/6800</option>
                          <option value="hybrid_capture_2">Hybrid Capture 2 (Qiagen)</option>
                          <option value="genexpert">Cepheid GeneXpert HPV</option>
                          <option value="other">Other Assay</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.2rem' }}>
                      <span className="small muted bold">Specific Genotype Detections:</span>
                      <div className="row wrap" style={{ gap: '1.2rem', marginTop: '0.4rem' }}>
                        <label className="row middle" style={{ gap: '0.4rem', cursor: 'pointer', margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={form.hpv16Positive}
                            onChange={(e) => setForm({ ...form, hpv16Positive: e.target.checked })}
                          />
                          <span style={{ color: form.hpv16Positive ? '#dc2626' : 'inherit', fontWeight: form.hpv16Positive ? 700 : 400 }}>
                            HPV 16 Detected
                          </span>
                        </label>
                        <label className="row middle" style={{ gap: '0.4rem', cursor: 'pointer', margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={form.hpv18Positive}
                            onChange={(e) => setForm({ ...form, hpv18Positive: e.target.checked })}
                          />
                          <span style={{ color: form.hpv18Positive ? '#dc2626' : 'inherit', fontWeight: form.hpv18Positive ? 700 : 400 }}>
                            HPV 18 Detected
                          </span>
                        </label>
                        <label className="row middle" style={{ gap: '0.4rem', cursor: 'pointer', margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={form.hpv45Positive}
                            onChange={(e) => setForm({ ...form, hpv45Positive: e.target.checked })}
                          />
                          <span>HPV 45 Detected</span>
                        </label>
                        <label className="row middle" style={{ gap: '0.4rem', cursor: 'pointer', margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={form.hpvOtherHighRiskPositive}
                            onChange={(e) => setForm({ ...form, hpvOtherHighRiskPositive: e.target.checked })}
                          />
                          <span>Other High-Risk Pool (31,33,35,52,58 etc.)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Colposcopy & Swede Scoring */}
              <div className="card stack" style={{ background: '#f8fafc', gap: '0.8rem' }}>
                <div className="row middle" style={{ gap: '0.6rem' }}>
                  <input
                    id="colposcopyPerformed"
                    type="checkbox"
                    checked={form.colposcopyPerformed}
                    onChange={(e) => setForm({ ...form, colposcopyPerformed: e.target.checked })}
                  />
                  <label htmlFor="colposcopyPerformed" style={{ fontWeight: 'bold', margin: 0, cursor: 'pointer' }}>
                    3. Colposcopy Examination Performed
                  </label>
                </div>

                {form.colposcopyPerformed && (
                  <div className="stack" style={{ gap: '0.8rem' }}>
                    <div className="row wrap" style={{ gap: '0.8rem' }}>
                      <div style={{ flex: '1 1 200px' }}>
                        <label htmlFor="transformationZoneType">Transformation Zone Type</label>
                        <select
                          id="transformationZoneType"
                          value={form.transformationZoneType}
                          onChange={(e) => setForm({ ...form, transformationZoneType: e.target.value })}
                        >
                          {TRANSFORMATION_ZONE_TYPES.map((tz) => (
                            <option key={tz.value} value={tz.value}>
                              {tz.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: '1 1 200px' }}>
                        <label htmlFor="squamocolumnarJunctionVisible">SCJ Visibility</label>
                        <select
                          id="squamocolumnarJunctionVisible"
                          value={form.squamocolumnarJunctionVisible}
                          onChange={(e) => setForm({ ...form, squamocolumnarJunctionVisible: e.target.value })}
                        >
                          <option value="completely_visible">Completely Visible</option>
                          <option value="partially_visible">Partially Visible</option>
                          <option value="not_visible">Not Visible</option>
                        </select>
                      </div>
                    </div>

                    {/* Swede Score Parameters 0-2 */}
                    <div style={{ background: '#fff', padding: '0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div className="row between middle" style={{ marginBottom: '0.6rem' }}>
                        <span className="bold">Swede Score Parameters (0–2 each):</span>
                        {liveSwede && (
                          <span className="tag bold" style={{ background: liveSwede.color, color: '#fff' }}>
                            Calculated Swede Score: {liveSwede.total} / 10 ({liveSwede.title})
                          </span>
                        )}
                      </div>

                      <div className="stack" style={{ gap: '0.6rem' }}>
                        <div>
                          <label htmlFor="swedeAcetowhitening" className="small">1. Acetowhitening</label>
                          <select
                            id="swedeAcetowhitening"
                            value={form.swedeAcetowhitening}
                            onChange={(e) => setForm({ ...form, swedeAcetowhitening: Number(e.target.value) })}
                          >
                            {SWEDE_ACETOWHITENING_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="swedeMargins" className="small">2. Margins &amp; Surface</label>
                          <select
                            id="swedeMargins"
                            value={form.swedeMargins}
                            onChange={(e) => setForm({ ...form, swedeMargins: Number(e.target.value) })}
                          >
                            {SWEDE_MARGIN_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="swedeVessels" className="small">3. Vascular Pattern</label>
                          <select
                            id="swedeVessels"
                            value={form.swedeVessels}
                            onChange={(e) => setForm({ ...form, swedeVessels: Number(e.target.value) })}
                          >
                            {SWEDE_VESSEL_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="swedeLesionSize" className="small">4. Lesion Size</label>
                          <select
                            id="swedeLesionSize"
                            value={form.swedeLesionSize}
                            onChange={(e) => setForm({ ...form, swedeLesionSize: Number(e.target.value) })}
                          >
                            {SWEDE_SIZE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="swedeIodineStaining" className="small">5. Iodine Staining (Schiller&apos;s / Lugol test)</label>
                          <select
                            id="swedeIodineStaining"
                            value={form.swedeIodineStaining}
                            onChange={(e) => setForm({ ...form, swedeIodineStaining: Number(e.target.value) })}
                          >
                            {SWEDE_IODINE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Clock Face Lesion Selection */}
                    <div>
                      <span className="small muted bold">Select Acetowhite Lesion Clock Locations:</span>
                      <div className="row wrap" style={{ gap: '0.4rem', marginTop: '0.4rem' }}>
                        {CERVICAL_CLOCK_POSITIONS.map((cp) => {
                          const active = form.selectedClockPositions.includes(cp.clock);
                          return (
                            <button
                              key={cp.clock}
                              type="button"
                              className={`btn small ${active ? 'error' : ''}`}
                              onClick={() => toggleClockPosition(cp.clock)}
                              style={{ minWidth: '45px', textAlign: 'center' }}
                            >
                              {cp.clock}h
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: Biopsy & Management Recommendation */}
              <div className="card stack" style={{ background: '#fdfbf7', gap: '0.8rem' }}>
                <div className="row middle" style={{ gap: '0.6rem' }}>
                  <input
                    id="biopsyTaken"
                    type="checkbox"
                    checked={form.biopsyTaken}
                    onChange={(e) => setForm({ ...form, biopsyTaken: e.target.checked })}
                  />
                  <label htmlFor="biopsyTaken" style={{ fontWeight: 'bold', margin: 0, cursor: 'pointer' }}>
                    4. Cervical Biopsy Taken
                  </label>
                </div>

                {form.biopsyTaken && (
                  <div className="row wrap" style={{ gap: '0.8rem' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <label htmlFor="biopsyType">Biopsy Procedure</label>
                      <select
                        id="biopsyType"
                        value={form.biopsyType}
                        onChange={(e) => setForm({ ...form, biopsyType: e.target.value })}
                      >
                        <option value="punch_biopsy">Colposcopy-Directed Punch Biopsy</option>
                        <option value="punch_and_ecc">Punch Biopsy + Endocervical Curettage (ECC)</option>
                        <option value="ecc_only">Endocervical Curettage (ECC) Alone</option>
                        <option value="leep_lletz">LEEP / LLETZ Excisional Conization</option>
                        <option value="cold_knife_conization">Cold Knife Conization (CKC)</option>
                        <option value="thermal_ablation">Thermal Ablation</option>
                      </select>
                    </div>
                    <div style={{ flex: '1 1 200px' }}>
                      <label htmlFor="biopsyResult">Histopathology Outcome</label>
                      <select
                        id="biopsyResult"
                        value={form.biopsyResult}
                        onChange={(e) => setForm({ ...form, biopsyResult: e.target.value })}
                      >
                        <option value="pending">Pending Specimen Analysis</option>
                        <option value="normal_cervicitis">Normal / Chronic Cervicitis</option>
                        <option value="cin_1_mild">CIN 1 (Low-Grade Squamous Dysplasia)</option>
                        <option value="cin_2_moderate">CIN 2 (Moderate Squamous Dysplasia)</option>
                        <option value="cin_3_severe_cis">CIN 3 / Carcinoma In Situ (Severe)</option>
                        <option value="squamous_cell_carcinoma">Squamous Cell Carcinoma (Invasive)</option>
                        <option value="ais">Adenocarcinoma In Situ (AIS)</option>
                        <option value="adenocarcinoma">Adenocarcinoma (Invasive)</option>
                        <option value="inadequate_sample">Inadequate / Non-diagnostic Sample</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Management Plan Advisory */}
                <div style={{ marginTop: '0.4rem' }}>
                  <div className="row between middle">
                    <label htmlFor="managementRecommendation"><strong>Management Recommendation &amp; Follow-up</strong></label>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => {
                        setForm({
                          ...form,
                          managementRecommendation: liveRecommendation.recommendation,
                          nextRecallMonths: liveRecommendation.recallMonths,
                        });
                      }}
                    >
                      ↺ Use ASCCP Algorithm Suggestion
                    </button>
                  </div>
                  <input
                    id="managementRecommendation"
                    type="text"
                    required
                    value={form.managementRecommendation || liveRecommendation.recommendation}
                    onChange={(e) => setForm({ ...form, managementRecommendation: e.target.value })}
                  />
                  <div className="row wrap middle" style={{ gap: '0.8rem', marginTop: '0.4rem' }}>
                    <div style={{ flex: '0 0 160px' }}>
                      <label htmlFor="nextRecallMonths" className="small">Recall Interval (Months)</label>
                      <input
                        id="nextRecallMonths"
                        type="number"
                        min="1"
                        max="120"
                        value={form.nextRecallMonths}
                        onChange={(e) => setForm({ ...form, nextRecallMonths: Number(e.target.value) })}
                      />
                    </div>
                    <div className="small muted" style={{ flex: '1 1 300px' }}>
                      Clinical Basis: {liveRecommendation.clinicalBasis}
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="clinicalNotes" className="small">Additional Clinical Notes</label>
                  <textarea
                    id="clinicalNotes"
                    rows={2}
                    value={form.clinicalNotes}
                    onChange={(e) => setForm({ ...form, clinicalNotes: e.target.value })}
                    placeholder="Enter examination details, gross visual appearance, or patient counseling notes..."
                  />
                </div>
              </div>

              <div className="row end" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowScreeningModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  {editingRecordId ? 'Update Screening Record' : 'Save Screening & Colposcopy Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Targeted Biopsy Specimen */}
      {showBiopsyModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="row between middle" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '0.6rem' }}>
              <h3 style={{ margin: 0 }}>Add Cervical Biopsy Specimen</h3>
              <button type="button" className="btn small" onClick={() => setShowBiopsyModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddBiopsy} className="stack" style={{ gap: '0.8rem', marginTop: '1rem' }}>
              <div>
                <label htmlFor="siteLocation">Anatomical Site / Description *</label>
                <input
                  id="siteLocation"
                  type="text"
                  required
                  value={biopsyForm.siteLocation}
                  onChange={(e) => setBiopsyForm({ ...biopsyForm, siteLocation: e.target.value })}
                  placeholder="e.g. 12 o'clock anterior lip, Endocervical canal, 6 o'clock"
                />
              </div>
              <div className="row wrap" style={{ gap: '0.8rem' }}>
                <div style={{ flex: '1 1 140px' }}>
                  <label htmlFor="clockPosition">Clock Position (1–12)</label>
                  <select
                    id="clockPosition"
                    value={biopsyForm.clockPosition}
                    onChange={(e) => setBiopsyForm({ ...biopsyForm, clockPosition: Number(e.target.value) })}
                  >
                    {CERVICAL_CLOCK_POSITIONS.map((cp) => (
                      <option key={cp.clock} value={cp.clock}>{cp.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label htmlFor="specimenLabel">Specimen Label</label>
                  <input
                    id="specimenLabel"
                    type="text"
                    value={biopsyForm.specimenLabel}
                    onChange={(e) => setBiopsyForm({ ...biopsyForm, specimenLabel: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="histopathologyResult">Histopathology Result</label>
                <select
                  id="histopathologyResult"
                  value={biopsyForm.histopathologyResult}
                  onChange={(e) => setBiopsyForm({ ...biopsyForm, histopathologyResult: e.target.value })}
                >
                  <option value="pending">Pending Specimen Analysis</option>
                  <option value="normal_benign">Normal / Benign / Cervicitis</option>
                  <option value="cin_1">CIN 1 (Low-grade squamous dysplasia)</option>
                  <option value="cin_2">CIN 2 (Moderate squamous dysplasia)</option>
                  <option value="cin_3_cis">CIN 3 / Carcinoma In Situ</option>
                  <option value="scc">Invasive Squamous Cell Carcinoma</option>
                  <option value="ais">Adenocarcinoma In Situ (AIS)</option>
                  <option value="adenocarcinoma">Invasive Adenocarcinoma</option>
                  <option value="inconclusive">Inconclusive / Inadequate sample</option>
                </select>
              </div>
              <div>
                <label htmlFor="pathologistNotes">Pathologist Notes</label>
                <textarea
                  id="pathologistNotes"
                  rows={2}
                  value={biopsyForm.pathologistNotes}
                  onChange={(e) => setBiopsyForm({ ...biopsyForm, pathologistNotes: e.target.value })}
                  placeholder="Histopathologic details, margins, depth of invasion, immunohistochemistry..."
                />
              </div>
              <div className="row end" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowBiopsyModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save Biopsy Specimen</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
