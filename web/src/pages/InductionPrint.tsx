import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type Patient,
  type LaborInductionEpisode,
  getInductionEpisode,
  auditPrintInduction,
} from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';

export function InductionPrint() {
  const { patientId, id } = useParams();
  const epId = Number(id);
  const pId = Number(patientId);

  const { clinic, error: clinicError } = useClinic();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [episode, setEpisode] = useState<LaborInductionEpisode | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!epId || !pId) return;

    Promise.all([
      api<{ patient: Patient }>('GET', `/api/patients/${pId}`),
      getInductionEpisode(epId),
    ])
      .then(([pRes, epRes]) => {
        setPatient(pRes.patient);
        setEpisode(epRes);
      })
      .catch(setError);
  }, [pId, epId]);

  const handlePrint = async () => {
    try {
      await auditPrintInduction(epId);
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
        <p className="muted">Loading labor induction flowsheet…</p>
      </div>
    );
  }

  return (
    <Sheet
      clinic={clinic}
      title="LABOR INDUCTION & MODIFIED BISHOP SCORE FLOWSHEET"
      back={`/patients/${pId}`}
      onPrint={() => void handlePrint()}
    >
      {/* Subhead with guideline citations */}
      <div
        style={{
          textAlign: 'center',
          borderBottom: '2px solid #0f172a',
          paddingBottom: '0.4rem',
          marginBottom: '0.8rem',
        }}
      >
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase' }}>
          Cervical Ripening Optimizer, Oxytocin Regimen &amp; Delivery Audit
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
          ACOG Practice Bulletin No. 107 • NICE Clinical Guideline NG207 • ARRIVE Trial Protocol
        </div>
      </div>

      {/* Patient & Gestational Demographics */}
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
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Gestational Age:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600 }}>
              {episode.gestationalAgeWeeks} weeks {episode.gestationalAgeDays} days
            </td>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Initiation Time:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600 }}>
              {episode.initiationDate} {episode.initiationTime ? `@ ${episode.initiationTime}` : ''}
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Primary Indication:</td>
            <td style={{ padding: '4px 8px', fontWeight: 700, color: '#1e3a8a', textTransform: 'capitalize' }}>
              {episode.indication.replace(/_/g, ' ')}
            </td>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Prior Cesarean Count:</td>
            <td style={{ padding: '4px 8px', fontWeight: 700, color: episode.previousCesareanCount > 0 ? '#b91c1c' : '#0f172a' }}>
              {episode.previousCesareanCount > 0 ? `${episode.previousCesareanCount} (Scarred Uterus - Prostaglandins Contraindicated)` : '0 (Unscarred)'}
            </td>
          </tr>
          {episode.indicationDetails && (
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '4px 8px', color: '#64748b' }}>Indication Rationale:</td>
              <td colSpan={3} style={{ padding: '4px 8px', fontStyle: 'italic' }}>
                {episode.indicationDetails}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Modified Bishop Score Grid */}
      <div style={{ marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ background: '#f8fafc', padding: '6px 10px', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
            PRE-INDUCTION MODIFIED BISHOP SCORE (0–13 POINTS)
          </span>
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: episode.calculatedBishopScore >= 8 ? '#047857' : episode.calculatedBishopScore >= 6 ? '#b45309' : '#b91c1c' }}>
            TOTAL SCORE: {episode.calculatedBishopScore} / 13 &bull; {episode.cervixFavorability.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>
              <th style={{ padding: '6px' }}>Cervical Parameter</th>
              <th style={{ padding: '6px' }}>0 points</th>
              <th style={{ padding: '6px' }}>1 point</th>
              <th style={{ padding: '6px' }}>2 points</th>
              <th style={{ padding: '6px' }}>3 points</th>
              <th style={{ padding: '6px' }}>Patient Finding</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '5px', textAlign: 'left', fontWeight: 600 }}>Dilation (cm)</td>
              <td>0 cm</td>
              <td>1–2 cm</td>
              <td>3–4 cm</td>
              <td>&gt;=5 cm</td>
              <td style={{ fontWeight: 700, color: '#1e40af' }}>{episode.dilationCm} cm</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '5px', textAlign: 'left', fontWeight: 600 }}>Effacement (%)</td>
              <td>0–30%</td>
              <td>40–50%</td>
              <td>60–70%</td>
              <td>&gt;=80%</td>
              <td style={{ fontWeight: 700, color: '#1e40af' }}>{episode.effacementPercent}%</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '5px', textAlign: 'left', fontWeight: 600 }}>Station (Ischial Spines)</td>
              <td>-3</td>
              <td>-2</td>
              <td>-1 / 0</td>
              <td>+1 / +2</td>
              <td style={{ fontWeight: 700, color: '#1e40af' }}>{episode.fetalStation}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '5px', textAlign: 'left', fontWeight: 600 }}>Consistency</td>
              <td>Firm</td>
              <td>Medium</td>
              <td>Soft</td>
              <td>—</td>
              <td style={{ fontWeight: 700, color: '#1e40af', textTransform: 'capitalize' }}>{episode.consistency}</td>
            </tr>
            <tr>
              <td style={{ padding: '5px', textAlign: 'left', fontWeight: 600 }}>Cervical Position</td>
              <td>Posterior</td>
              <td>Mid-position</td>
              <td>Anterior</td>
              <td>—</td>
              <td style={{ fontWeight: 700, color: '#1e40af', textTransform: 'capitalize' }}>{episode.position}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Cervical Ripening & Oxytocin Protocol */}
      <table style={{ width: '100%', marginBottom: '1rem', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <tbody>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '6px 8px', color: '#64748b', width: '25%' }}>Ripening Agent / Method:</td>
            <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a', width: '35%', textTransform: 'capitalize' }}>
              {episode.ripeningMethod.replace(/_/g, ' ')}
            </td>
            <td style={{ padding: '6px 8px', color: '#64748b', width: '20%' }}>Ripening Details:</td>
            <td style={{ padding: '6px 8px', width: '20%' }}>
              {episode.ripeningDoseDetails || 'Standard clinical dose'}
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '6px 8px', color: '#64748b' }}>Oxytocin Infusion:</td>
            <td style={{ padding: '6px 8px', fontWeight: 600 }}>
              {episode.oxytocinUsed
                ? `Active (Start: ${episode.oxytocinStartRateMUPerMin || 2} mU/min, Max: ${episode.oxytocinMaxRateMUPerMin || 20} mU/min)`
                : 'Not administered'}
            </td>
            <td style={{ padding: '6px 8px', color: '#64748b' }}>Amniotomy (ARM):</td>
            <td style={{ padding: '6px 8px', fontWeight: 600 }}>
              {episode.armPerformed ? `Performed @ ${episode.armTime || 'N/A'}` : 'Membranes intact'}
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '6px 8px', color: '#64748b' }}>Amniotic Liquor:</td>
            <td style={{ padding: '6px 8px', fontWeight: 600, textTransform: 'capitalize' }}>
              {episode.liquorStatus?.replace(/_/g, ' ') || 'Clear'}
            </td>
            <td style={{ padding: '6px 8px', color: '#64748b' }}>Tachysystole:</td>
            <td style={{ padding: '6px 8px', fontWeight: 700, color: episode.tachysystoleDetected ? '#b91c1c' : '#047857' }}>
              {episode.tachysystoleDetected ? 'Detected (>5 cont/10m)' : 'None'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Outcome Section */}
      <div style={{ marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', background: '#f8fafc' }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', marginBottom: '6px' }}>
          DELIVERY &amp; NEONATAL OUTCOME AUDIT
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: '#64748b' }}>Induction Outcome:</span>{' '}
            <strong style={{ textTransform: 'capitalize', color: episode.inductionOutcome.includes('vaginal') ? '#047857' : '#b91c1c' }}>
              {episode.inductionOutcome.replace(/_/g, ' ')}
            </strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Delivery Datetime:</span>{' '}
            <strong>{episode.deliveryDatetime ? episode.deliveryDatetime.replace('T', ' ') : 'In progress'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Birth Weight:</span>{' '}
            <strong>{episode.birthWeightGrams ? `${episode.birthWeightGrams} g` : 'Pending'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>APGAR (1m / 5m):</span>{' '}
            <strong>
              {episode.apgar1Min !== null && episode.apgar1Min !== undefined ? `${episode.apgar1Min} / ${episode.apgar5Min}` : 'N/A'}
            </strong>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <span style={{ color: '#64748b' }}>Cesarean Indication / Complications:</span>{' '}
            <span>{episode.cesareanReason || episode.postpartumComplications || 'None reported'}</span>
          </div>
        </div>
        {episode.inductionSummaryNotes && (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#334155' }}>
            <span style={{ fontWeight: 600 }}>Clinical Summary: </span>
            {episode.inductionSummaryNotes}
          </div>
        )}
      </div>

      {/* Statutory PC-PNDT Non-Disclosure Declaration */}
      <div
        style={{
          border: '1px solid #d97706',
          backgroundColor: '#fffbeb',
          padding: '6px 10px',
          borderRadius: '4px',
          fontSize: '0.75rem',
          color: '#92400e',
          marginBottom: '1rem',
          textAlign: 'center',
          fontWeight: 600,
        }}
      >
        STATUTORY DECLARATION (PC-PNDT ACT 1994):
        Under no circumstances has the sex of the fetus been determined or disclosed.
      </div>

      <SignatureBlock
        clinic={clinic}
        signatoryName={episode.reviewedByName || episode.attendingObstetrician || 'Consultant Obstetrician'}
        designation="Consultant Obstetrician &amp; Gynecologist"
        date={episode.initiationDate}
      />
    </Sheet>
  );
}
