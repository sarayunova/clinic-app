import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type Patient,
  type UrogynecologyEpisode,
  getUrogynEpisode,
  auditPrintUrogyn,
} from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';

export function UrogynecologyPrint() {
  const { patientId, id } = useParams();
  const episodeId = Number(id);
  const pId = Number(patientId);

  const { clinic, error: clinicError } = useClinic();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [episode, setEpisode] = useState<UrogynecologyEpisode | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!episodeId || !pId) return;

    Promise.all([
      api<{ patient: Patient }>('GET', `/api/patients/${pId}`),
      getUrogynEpisode(episodeId),
    ])
      .then(([pRes, uRes]) => {
        setPatient(pRes.patient);
        setEpisode(uRes);
      })
      .catch(setError);
  }, [pId, episodeId]);

  const handlePrint = async () => {
    try {
      await auditPrintUrogyn(episodeId);
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
        <p className="muted">Loading POP-Q examination report…</p>
      </div>
    );
  }

  return (
    <Sheet
      clinic={clinic}
      title="PELVIC ORGAN PROLAPSE QUANTIFICATION (POP-Q) & UROGYNECOLOGY DOSSIER"
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
          Standardized 9-Point POP-Q Staging &bull; Incontinence Diary &bull; Pelvic Floor Registry
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
          IUGA / ICS Joint Terminology Standard &bull; Bump RC et al. Am J Obstet Gynecol 1996 &bull; ACOG PB 214
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
            <td style={{ padding: '4px 8px', fontWeight: 700, color: '#065f46' }}>
              {episode.assessmentDate}
            </td>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Obstetric Parity:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600 }}>
              {episode.parity || 'Not recorded'}
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Menopausal Status:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600, textTransform: 'capitalize' }}>
              {episode.menopausalStatus}
            </td>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>PFMT Physiotherapy:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600 }}>
              {episode.pelvicFloorPhysiotherapy ? 'Active / Instructed' : 'Not started'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Primary POP-Q Staging Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '1rem',
        }}
      >
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '10px 14px', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase' }}>
            Automated POP-Q Stage
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#064e3b', marginTop: '2px' }}>
            {episode.popqStage.toUpperCase().replace('_', ' ')}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#047857', fontWeight: 600, marginTop: '2px' }}>
            Leading Edge: {episode.leadingEdgeDistanceCm > 0 ? `+${episode.leadingEdgeDistanceCm}` : episode.leadingEdgeDistanceCm} cm
          </div>
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
            Leading Compartment &amp; Support
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#14532d', marginTop: '2px', textTransform: 'capitalize' }}>
            {episode.leadingCompartment.replace(/_/g, ' ')}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#15803d', marginTop: '2px' }}>
            Pessary: {episode.pessaryManagement !== 'none' ? `${episode.pessaryManagement.replace(/_/g, ' ')} (${episode.pessarySizeMm} mm)` : 'None fitted'}
          </div>
        </div>
      </div>

      {/* Standardized 3x3 POP-Q Grid Table */}
      <div style={{ marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ background: '#f8fafc', padding: '6px 10px', borderBottom: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
          STANDARDIZED 3 × 3 POP-Q EXAMINATION GRID (Measurements in cm relative to hymenal ring)
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.9rem' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fffbeb' }}>
              <td style={{ padding: '8px', borderRight: '1px solid #e2e8f0', width: '33.3%' }}>
                <span style={{ fontSize: '0.75rem', color: '#92400e', display: 'block' }}>Anterior Wall (Aa)</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {episode.popqAaCm > 0 ? `+${episode.popqAaCm}` : episode.popqAaCm} cm
                </span>
              </td>
              <td style={{ padding: '8px', borderRight: '1px solid #e2e8f0', width: '33.3%' }}>
                <span style={{ fontSize: '0.75rem', color: '#92400e', display: 'block' }}>Anterior Wall (Ba)</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {episode.popqBaCm > 0 ? `+${episode.popqBaCm}` : episode.popqBaCm} cm
                </span>
              </td>
              <td style={{ padding: '8px', width: '33.3%', background: '#faf5ff' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b21a8', display: 'block' }}>Cervix / Cuff (C)</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {episode.popqCCm > 0 ? `+${episode.popqCCm}` : episode.popqCCm} cm
                </span>
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <td style={{ padding: '8px', borderRight: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', color: '#475569', display: 'block' }}>Genital Hiatus (gh)</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {episode.popqGhCm} cm
                </span>
              </td>
              <td style={{ padding: '8px', borderRight: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', color: '#475569', display: 'block' }}>Perineal Body (pb)</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {episode.popqPbCm} cm
                </span>
              </td>
              <td style={{ padding: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: '#475569', display: 'block' }}>Total Vaginal Length (tvl)</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {episode.popqTvlCm} cm
                </span>
              </td>
            </tr>
            <tr style={{ background: '#f0f9ff' }}>
              <td style={{ padding: '8px', borderRight: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', color: '#0369a1', display: 'block' }}>Posterior Wall (Ap)</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {episode.popqApCm > 0 ? `+${episode.popqApCm}` : episode.popqApCm} cm
                </span>
              </td>
              <td style={{ padding: '8px', borderRight: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', color: '#0369a1', display: 'block' }}>Posterior Wall (Bp)</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {episode.popqBpCm > 0 ? `+${episode.popqBpCm}` : episode.popqBpCm} cm
                </span>
              </td>
              <td style={{ padding: '8px', background: '#faf5ff' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b21a8', display: 'block' }}>Posterior Fornix (D)</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {episode.popqDCm !== null && episode.popqDCm !== undefined ? (episode.popqDCm > 0 ? `+${episode.popqDCm}` : `${episode.popqDCm} cm`) : 'Hysterectomy'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Urinary Incontinence & Diary Metrics */}
      <div style={{ marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ background: '#f8fafc', padding: '6px 10px', borderBottom: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
          URINARY INCONTINENCE &amp; BLADDER DIARY METRICS
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 10px', color: '#64748b', width: '25%' }}>Incontinence Phenotype:</td>
              <td style={{ padding: '6px 10px', fontWeight: 700, textTransform: 'capitalize', width: '25%' }}>
                {episode.urinaryIncontinenceType.replace(/_/g, ' ')}
              </td>
              <td style={{ padding: '6px 10px', color: '#64748b', width: '25%' }}>Daily Pad Usage:</td>
              <td style={{ padding: '6px 10px', fontWeight: 700, width: '25%' }}>
                {episode.padCountPerDay} pads / day
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>Daytime Frequency:</td>
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>
                {episode.bladderDiaryDayFrequency ? `${episode.bladderDiaryDayFrequency} voids / day` : 'Not recorded'}
              </td>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>Nocturia Episodes:</td>
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>
                {episode.bladderDiaryNocturia ? `${episode.bladderDiaryNocturia} voids / night` : 'Not recorded'}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>Leak Episodes / 24h:</td>
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>
                {episode.leakEpisodes24h ? `${episode.leakEpisodes24h} leaks` : '0 leaks'}
              </td>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>ICIQ-SF Score (0–21):</td>
              <td style={{ padding: '6px 10px', fontWeight: 700 }}>
                {episode.botherScoreIciqSf ? `${episode.botherScoreIciqSf}/21` : 'Not assessed'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Management Plan & Reconstruction Notes */}
      <div style={{ marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ background: '#f8fafc', padding: '6px 10px', borderBottom: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
          MANAGEMENT DIRECTIVES &amp; SURGICAL RECONSTRUCTION PLAN
        </div>
        <div style={{ padding: '8px 10px', fontSize: '0.85rem', lineHeight: '1.4' }}>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>Pessary Management: </span>
            <span style={{ textTransform: 'capitalize' }}>
              {episode.pessaryManagement !== 'none'
                ? `${episode.pessaryManagement.replace(/_/g, ' ')} (${episode.pessarySizeMm} mm), interval ${episode.pessaryChangeIntervalWeeks || 12} weeks`
                : 'Conservative non-pessary pathway'}
            </span>
          </div>
          {episode.surgicalProcedurePlanned && (
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 700, color: '#334155' }}>Surgical Procedure Planned: </span>
              <span style={{ fontWeight: 600, color: '#047857' }}>{episode.surgicalProcedurePlanned}</span>
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
        signatoryName={episode.performedBy || episode.reviewedByName || 'Consultant Urogynecologist'}
        qualifications="MS (OBGYN), Fellowship in Urogynecology & Pelvic Floor Reconstruction"
        regNo="KMC/REG/78142"
        designation="Consultant Urogynecologist & Pelvic Surgeon"
      />
    </Sheet>
  );
}
