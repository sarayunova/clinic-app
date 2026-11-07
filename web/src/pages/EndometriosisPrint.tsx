import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type Patient,
  type EndometriosisEpisode,
  getEndometriosisEpisode,
  auditPrintEndometriosis,
} from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';

export function EndometriosisPrint() {
  const { patientId, id } = useParams();
  const episodeId = Number(id);
  const pId = Number(patientId);

  const { clinic, error: clinicError } = useClinic();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [episode, setEpisode] = useState<EndometriosisEpisode | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!episodeId || !pId) return;

    Promise.all([
      api<{ patient: Patient }>('GET', `/api/patients/${pId}`),
      getEndometriosisEpisode(episodeId),
    ])
      .then(([pRes, eRes]) => {
        setPatient(pRes.patient);
        setEpisode(eRes);
      })
      .catch(setError);
  }, [pId, episodeId]);

  const handlePrint = async () => {
    try {
      await auditPrintEndometriosis(episodeId);
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
        <p className="muted">Loading endometriosis staging dossier…</p>
      </div>
    );
  }

  return (
    <Sheet
      clinic={clinic}
      title="ENDOMETRIOSIS & DEEP INFILTRATING ENDOMETRIOSIS (#ENZIAN & rASRM) OPERATIVE DOSSIER"
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
          Revised ASRM Staging &bull; #Enzian 2021 DIE Mapping &bull; VAS Pain Metrics
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
          Fertil Steril 1997 &bull; Keckstein J et al. Hum Reprod 2021 &bull; ESHRE Endometriosis Guidelines
        </div>
      </div>

      {/* Patient & Assessment Header */}
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
            <td style={{ padding: '4px 8px', fontWeight: 700, color: '#4338ca' }}>
              {episode.assessmentDate}
            </td>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Surgical Approach:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600, textTransform: 'capitalize' }}>
              {episode.surgicalApproach.replace(/_/g, ' ')}
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Primary Indication:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600, textTransform: 'capitalize' }}>
              {episode.indication.replace(/_/g, ' ')}
            </td>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Fertility Intent:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600 }}>
              {episode.fertilitySparing ? 'Fertility Sparing Conservative Care' : 'Definitive Surgical Management'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Primary Staging Summary Badge Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '1rem',
        }}
      >
        <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', padding: '10px 14px', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3730a3', textTransform: 'uppercase' }}>
            rASRM Classification (Revised 1996)
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1b4b', marginTop: '2px' }}>
            {episode.rasrmStage.toUpperCase().replace('_', ' ')}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#4338ca', fontWeight: 600, marginTop: '2px' }}>
            Calculated Score: {episode.rasrmTotalScore} points
          </div>
        </div>

        <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', padding: '10px 14px', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase' }}>
            #Enzian 2021 Composite Code (DIE)
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#3b0764', marginTop: '2px', fontFamily: 'monospace' }}>
            {episode.enzianCompositeCode || 'None documented'}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#7e22ce', marginTop: '2px' }}>
            Adenomyosis (FA): {episode.enzianAdenomyosisFa ? 'Positive' : 'Negative'}
          </div>
        </div>
      </div>

      {/* VAS Pain Assessment Table */}
      <div style={{ marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ background: '#f8fafc', padding: '6px 10px', borderBottom: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
          VISUAL ANALOGUE SCALE (VAS) PAIN PROFILE (0–10)
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '6px' }}>Dysmenorrhea</th>
              <th style={{ padding: '6px' }}>Dyspareunia</th>
              <th style={{ padding: '6px' }}>Dyschezia</th>
              <th style={{ padding: '6px' }}>Dysuria</th>
              <th style={{ padding: '6px' }}>Chronic Pelvic Pain</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '8px', fontWeight: 700, fontSize: '1.1rem', color: episode.vasDysmenorrhea >= 7 ? '#dc2626' : '#1e293b' }}>
                {episode.vasDysmenorrhea}/10
              </td>
              <td style={{ padding: '8px', fontWeight: 700, fontSize: '1.1rem', color: episode.vasDyspareunia >= 7 ? '#dc2626' : '#1e293b' }}>
                {episode.vasDyspareunia}/10
              </td>
              <td style={{ padding: '8px', fontWeight: 700, fontSize: '1.1rem', color: episode.vasDyschezia >= 7 ? '#dc2626' : '#1e293b' }}>
                {episode.vasDyschezia}/10
              </td>
              <td style={{ padding: '8px', fontWeight: 700, fontSize: '1.1rem', color: episode.vasDysuria >= 7 ? '#dc2626' : '#1e293b' }}>
                {episode.vasDysuria}/10
              </td>
              <td style={{ padding: '8px', fontWeight: 700, fontSize: '1.1rem', color: episode.vasChronicPelvicPain >= 7 ? '#dc2626' : '#1e293b' }}>
                {episode.vasChronicPelvicPain}/10
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* rASRM Detailed Points Table */}
      <div style={{ marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ background: '#f8fafc', padding: '6px 10px', borderBottom: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
          rASRM ANATOMICAL POINTS BREAKDOWN
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '4px 8px', width: '35%', color: '#475569' }}>Peritoneal Implants (Sup / Deep):</td>
              <td style={{ padding: '4px 8px', fontWeight: 600 }}>
                {episode.rasrmPeritonealSuperficialPts} pts (superficial) &bull; {episode.rasrmPeritonealDeepPts} pts (deep)
              </td>
              <td style={{ padding: '4px 8px', width: '25%', color: '#475569' }}>Pouch of Douglas:</td>
              <td style={{ padding: '4px 8px', fontWeight: 700, textTransform: 'capitalize' }}>
                {episode.pouchOfDouglasObliteration.replace(/_/g, ' ')}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '4px 8px', color: '#475569' }}>Right Ovary (Sup / Deep):</td>
              <td style={{ padding: '4px 8px', fontWeight: 600 }}>
                {episode.rasrmOvaryRightSuperficialPts} pts (sup) &bull; {episode.rasrmOvaryRightDeepPts} pts (deep)
              </td>
              <td style={{ padding: '4px 8px', color: '#475569' }}>Left Ovary (Sup / Deep):</td>
              <td style={{ padding: '4px 8px', fontWeight: 600 }}>
                {episode.rasrmOvaryLeftSuperficialPts} pts (sup) &bull; {episode.rasrmOvaryLeftDeepPts} pts (deep)
              </td>
            </tr>
            <tr>
              <td style={{ padding: '4px 8px', color: '#475569' }}>Right Adhesions (Ovary / Tube):</td>
              <td style={{ padding: '4px 8px', fontWeight: 600 }}>
                {episode.rasrmAdhesionsOvaryRightPts} pts (ovary) &bull; {episode.rasrmAdhesionsTubeRightPts} pts (tube)
              </td>
              <td style={{ padding: '4px 8px', color: '#475569' }}>Left Adhesions (Ovary / Tube):</td>
              <td style={{ padding: '4px 8px', fontWeight: 600 }}>
                {episode.rasrmAdhesionsOvaryLeftPts} pts (ovary) &bull; {episode.rasrmAdhesionsTubeLeftPts} pts (tube)
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Operative Findings & Management Plan */}
      <div style={{ marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ background: '#f8fafc', padding: '6px 10px', borderBottom: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
          SURGICAL PROCEDURE PERFORMED &amp; MEDICAL MANAGEMENT
        </div>
        <div style={{ padding: '8px 10px', fontSize: '0.85rem', lineHeight: '1.4' }}>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>Procedure / Operative Findings: </span>
            <span>{episode.surgicalProcedurePerformed || 'Diagnostic assessment only.'}</span>
          </div>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>Medical Management Regimen: </span>
            <span>{episode.medicalManagementRegimen || 'None documented.'}</span>
          </div>
          {episode.postOpHormonalSuppression && (
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 700, color: '#334155' }}>Post-Operative Hormonal Suppression: </span>
              <span>{episode.postOpHormonalSuppression}</span>
            </div>
          )}
          {episode.clinicalNotes && (
            <div style={{ marginTop: '6px', fontStyle: 'italic', color: '#475569' }}>
              &ldquo;{episode.clinicalNotes}&rdquo;
            </div>
          )}
        </div>
      </div>

      {/* Operative Sign-off Block */}
      <SignatureBlock
        clinic={clinic}
        signatoryName={episode.leadSurgeon || episode.reviewedByName || 'Consultant Gynecological Surgeon'}
        qualifications="MS, DNB (Obstetrics & Gynecology), FMAS"
        regNo="KMC/REG/67210"
        designation="Consultant Gynecological Endoscopy Surgeon"
      />
    </Sheet>
  );
}
