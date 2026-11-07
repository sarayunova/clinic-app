import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type Patient,
  type GynOncologyEpisode,
  getGynOncologyEpisode,
  auditPrintGynOncology,
} from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';

export function GynOncologyPrint() {
  const { patientId, id } = useParams();
  const episodeId = Number(id);
  const pId = Number(patientId);

  const { clinic, error: clinicError } = useClinic();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [episode, setEpisode] = useState<GynOncologyEpisode | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!episodeId || !pId) return;

    Promise.all([
      api<{ patient: Patient }>('GET', `/api/patients/${pId}`),
      getGynOncologyEpisode(episodeId),
    ])
      .then(([pRes, gRes]) => {
        setPatient(pRes.patient);
        setEpisode(gRes);
      })
      .catch(setError);
  }, [pId, episodeId]);

  const handlePrint = async () => {
    try {
      await auditPrintGynOncology(episodeId);
    } catch {
      // non-blocking
    }
    window.print();
  };

  if (clinicError || error) {
    return (
      <div className="page narrow stack">
        <ErrorBanner error={clinicError || error} />
        <p>
          <Link to={`/patients/${pId}`} className="btn small">
            ← Back to Patient
          </Link>
        </p>
      </div>
    );
  }

  if (!clinic || !patient || !episode) {
    return (
      <div className="page narrow stack">
        <p className="muted">Loading oncology risk stratification report…</p>
      </div>
    );
  }

  return (
    <Sheet
      clinic={clinic}
      title="GYNECOLOGICAL ONCOLOGY & MALIGNANCY RISK STRATIFICATION (RMI & IOTA) DOSSIER"
      back={`/patients/${pId}`}
      onPrint={() => void handlePrint()}
    >
      {/* Subhead with protocol citation */}
      <div
        style={{
          textAlign: 'center',
          borderBottom: '2px solid #0f172a',
          paddingBottom: '0.4rem',
          marginBottom: '0.8rem',
        }}
      >
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase' }}>
          RMI-1 Jacobs Score &bull; IOTA Simple Rules &bull; PMB Endometrial Biopsy Criteria
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
          Jacobs I et al. Br J Obstet Gynaecol 1990 &bull; Timmerman D et al. Ultrasound Obstet Gynecol 2008 &bull; RCOG GTG 34
        </div>
      </div>

      {/* Patient & Assessment Details */}
      <table style={{ width: '100%', marginBottom: '1rem', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <tbody>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '4px 8px', color: '#64748b', width: '20%' }}>Patient Name:</td>
            <td style={{ padding: '4px 8px', fontWeight: 700, color: '#0f172a', width: '30%' }}>
              {patient.fullName}
            </td>
            <td style={{ padding: '4px 8px', color: '#64748b', width: '20%' }}>Hospital / UHID:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600, color: '#0f172a', width: '30%' }}>
              #{patient.id}
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Assessment Date:</td>
            <td style={{ padding: '4px 8px', fontWeight: 700, color: '#9f1239' }}>
              {episode.assessmentDate}
            </td>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Menopausal Status:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600, textTransform: 'capitalize' }}>
              {episode.menopausalStatus} (M = {episode.menopausalStatus === 'postmenopausal' ? '3' : '1'})
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Clinical Indication:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600, textTransform: 'capitalize' }}>
              {episode.clinicalIndication.replace(/_/g, ' ')}
            </td>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>FIGO Stage:</td>
            <td style={{ padding: '4px 8px', fontWeight: 700, color: '#be123c' }}>
              {episode.figoClinicalStage || 'Not assigned'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Primary Malignancy Staging Score Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '1rem',
        }}
      >
        <div
          style={{
            background: episode.rmiRiskTier === 'high_risk_gt_200' ? '#fef2f2' : episode.rmiRiskTier === 'intermediate_risk_26_200' ? '#fffbeb' : '#f0fdf4',
            border: `1px solid ${episode.rmiRiskTier === 'high_risk_gt_200' ? '#fca5a5' : episode.rmiRiskTier === 'intermediate_risk_26_200' ? '#fde68a' : '#bbf7d0'}`,
            padding: '10px 14px',
            borderRadius: '6px',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
            Risk of Malignancy Index (RMI-1 Jacobs)
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#7f1d1d', marginTop: '2px' }}>
            RMI = {episode.rmiScore}
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#991b1b', marginTop: '2px', textTransform: 'uppercase' }}>
            {episode.rmiRiskTier.replace(/_/g, ' ')}
          </div>
        </div>

        <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', padding: '10px 14px', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase' }}>
            IOTA Simple Rules &amp; Tumor Board
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3b0764', marginTop: '2px', textTransform: 'uppercase' }}>
            {episode.iotaSimpleRulesCategory}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#7e22ce', marginTop: '2px' }}>
            MDT Status: {episode.multidisciplinaryTumorBoardStatus.replace(/_/g, ' ')}
          </div>
        </div>
      </div>

      {/* Biomarkers & Ultrasound Morphology Details */}
      <div style={{ marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ background: '#f8fafc', padding: '6px 10px', borderBottom: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
          TUMOR BIOMARKERS &amp; ULTRASOUND MORPHOLOGY (U-SCORE CRITERIA)
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 10px', color: '#64748b', width: '25%' }}>Serum CA-125:</td>
              <td style={{ padding: '6px 10px', fontWeight: 700, color: (episode.ca125LevelUml || 0) > 35 ? '#dc2626' : '#1e293b', width: '25%' }}>
                {episode.ca125LevelUml ? `${episode.ca125LevelUml} U/mL (ref < 35)` : 'Not measured'}
              </td>
              <td style={{ padding: '6px 10px', color: '#64748b', width: '25%' }}>Serum HE4:</td>
              <td style={{ padding: '6px 10px', fontWeight: 600, width: '25%' }}>
                {episode.he4PmolL ? `${episode.he4PmolL} pmol/L` : 'Not measured'}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>Mass Max Diameter:</td>
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>
                {episode.lesionMaxDiameterMm ? `${episode.lesionMaxDiameterMm} mm` : '—'}
              </td>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>Solid Component Proportion:</td>
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>
                {episode.proportionSolidTissuePercent !== null && episode.proportionSolidTissuePercent !== undefined ? `${episode.proportionSolidTissuePercent}%` : '0%'}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>Multilocular Cysts:</td>
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>
                {episode.multilocularCysts ? 'Yes (Point +1)' : 'No'}
              </td>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>Bilateral Adnexal Masses:</td>
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>
                {episode.bilateralLesions ? 'Yes (Point +1)' : 'No'}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>Ascites Detected:</td>
              <td style={{ padding: '6px 10px', fontWeight: 700, color: episode.ascitesPresent ? '#dc2626' : '#1e293b' }}>
                {episode.ascitesPresent ? 'Present (Point +1)' : 'Absent'}
              </td>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>Color Doppler Score (1–4):</td>
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>
                {episode.colorDopplerScore ? `Score ${episode.colorDopplerScore}/4` : 'Score 1 (no flow)'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Endometrial Evaluation & PMB Criteria */}
      <div style={{ marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ background: '#f8fafc', padding: '6px 10px', borderBottom: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
          ENDOMETRIAL ASSESSMENT &amp; POSTMENOPAUSAL BLEEDING (PMB) THRESHOLD
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 10px', color: '#64748b', width: '25%' }}>Endometrial Thickness:</td>
              <td style={{ padding: '6px 10px', fontWeight: 700, color: (episode.endometrialThicknessMm || 0) > 4 ? '#b91c1c' : '#1e293b', width: '25%' }}>
                {episode.endometrialThicknessMm ? `${episode.endometrialThicknessMm} mm (cutoff > 4 mm)` : 'Not imaged'}
              </td>
              <td style={{ padding: '6px 10px', color: '#64748b', width: '25%' }}>Biopsy Performed:</td>
              <td style={{ padding: '6px 10px', fontWeight: 600, width: '25%' }}>
                {episode.endometrialBiopsyDone ? 'Pipelle / Hysteroscopic Biopsy Done' : 'Not performed'}
              </td>
            </tr>
            {episode.endometrialHistology && (
              <tr>
                <td style={{ padding: '6px 10px', color: '#64748b' }}>Histopathology Result:</td>
                <td colSpan={3} style={{ padding: '6px 10px', fontWeight: 600 }}>
                  {episode.endometrialHistology}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Multidisciplinary Care Plan */}
      <div style={{ marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ background: '#f8fafc', padding: '6px 10px', borderBottom: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
          TUMOR BOARD CARE PLAN &amp; SURGICAL STAGING DIRECTIVES
        </div>
        <div style={{ padding: '8px 10px', fontSize: '0.85rem', lineHeight: '1.4' }}>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>Management Directives: </span>
            <span>{episode.managementPlan || 'Follow conservative or surgical plan as per multidisciplinary review.'}</span>
          </div>
          {episode.surgicalStagingDetails && (
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 700, color: '#334155' }}>Surgical Staging Details: </span>
              <span>{episode.surgicalStagingDetails}</span>
            </div>
          )}
          {episode.clinicalNotes && (
            <div style={{ marginTop: '6px', fontStyle: 'italic', color: '#475569' }}>
              &ldquo;{episode.clinicalNotes}&rdquo;
            </div>
          )}
        </div>
      </div>

      {/* Sign-off Block */}
      <SignatureBlock
        clinic={clinic}
        signatoryName={episode.gynOncologistName || episode.reviewedByName || 'Consultant Gynecological Oncologist'}
        qualifications="MS, MCh (Gynecological Oncology), Fellowship in Minimally Invasive Gyn Oncology"
        regNo="KMC/REG/54391"
        designation="Consultant Gynecological Oncologist & Pelvic Surgeon"
      />
    </Sheet>
  );
}
