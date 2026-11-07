import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type Patient,
  type PerinatalLossEpisode,
  getPerinatalLossEpisode,
  auditPrintPerinatalLoss,
} from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';

export function PerinatalLossPrint() {
  const { patientId, id } = useParams();
  const epId = Number(id);
  const pId = Number(patientId);

  const { clinic, error: clinicError } = useClinic();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [episode, setEpisode] = useState<PerinatalLossEpisode | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!epId || !pId) return;

    Promise.all([
      api<{ patient: Patient }>('GET', `/api/patients/${pId}`),
      getPerinatalLossEpisode(epId),
    ])
      .then(([pRes, epRes]) => {
        setPatient(pRes.patient);
        setEpisode(epRes);
      })
      .catch(setError);
  }, [pId, epId]);

  const handlePrint = async () => {
    try {
      await auditPrintPerinatalLoss(epId);
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
        <p className="muted">Loading perinatal loss audit dossier…</p>
      </div>
    );
  }

  return (
    <Sheet
      clinic={clinic}
      title="PERINATAL LOSS, STILLBIRTH & IUFD CLINICAL AUDIT DOSSIER"
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
          Multidisciplinary Investigation, ReCoDe Etiology &amp; Recurrence Prevention
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
          RCOG Green-top Guideline No. 55 • ACOG Practice Bulletin No. 200 • WHO Perinatal Audit
        </div>
      </div>

      {/* Demographics & Loss Event */}
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
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Loss Classification:</td>
            <td style={{ padding: '4px 8px', fontWeight: 700, color: '#b91c1c', textTransform: 'capitalize' }}>
              {episode.lossType.replace(/_/g, ' ')}
            </td>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Diagnosis / Delivery:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600 }}>
              {episode.diagnosisDate} {episode.deliveryDate ? `(Delivered: ${episode.deliveryDate})` : ''}
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Gestational Age:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600 }}>
              {episode.gestationalAgeWeeks} weeks {episode.gestationalAgeDays} days
            </td>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Fetal Weight:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600 }}>
              {episode.fetalBirthWeightG ? `${episode.fetalBirthWeightG} grams` : 'Not recorded'}
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Maternal Blood Group:</td>
            <td style={{ padding: '4px 8px', fontWeight: 700 }}>
              {episode.maternalBloodGroup?.replace(/_/g, ' ') || 'Unknown'}
            </td>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Anti-D Immunoglobulin:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600, color: episode.antiDAdministered ? '#6b21a8' : '#64748b' }}>
              {episode.antiDAdministered
                ? `Administered (${episode.antiDDoseMcg || 300} mcg) • FMH: ${episode.fetomaternalHemorrhageMl || 0} mL`
                : 'Not Indicated / Rh+'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Etiology Box */}
      <div style={{ marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', background: '#f8fafc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
            PRIMARY ETIOLOGY &amp; CONTRIBUTING FACTORS
          </span>
          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#4338ca', fontFamily: 'monospace' }}>
            CATEGORY: {episode.primaryCauseCategory.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>
        <div style={{ fontSize: '0.85rem', color: '#1e293b', marginBottom: '4px' }}>
          <strong>Cause Narrative: </strong>
          <span>{episode.primaryCauseDetails}</span>
        </div>
        {episode.contributingFactors && (
          <div style={{ fontSize: '0.85rem', color: '#334155' }}>
            <strong>Contributing Factors: </strong>
            {episode.contributingFactors}
          </div>
        )}
      </div>

      {/* Bereavement & Recurrence Risk */}
      <table style={{ width: '100%', marginBottom: '1rem', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <tbody>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '6px 8px', color: '#64748b', width: '25%' }}>Lactation Suppression:</td>
            <td style={{ padding: '6px 8px', fontWeight: 600, width: '25%' }}>
              {episode.lactationSuppressionGiven ? (episode.lactationSuppressionDetails || 'Cabergoline 1 mg stat') : 'Declined / Not given'}
            </td>
            <td style={{ padding: '6px 8px', color: '#64748b', width: '25%' }}>Memory Box &amp; Counseling:</td>
            <td style={{ padding: '6px 8px', fontWeight: 600, width: '25%' }}>
              {episode.memoryBoxAccepted ? 'Provided' : 'Offered'} &bull; {episode.bereavementCounselorContacted ? 'Counselor active' : ''}
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '6px 8px', color: '#64748b' }}>Mode of Delivery:</td>
            <td style={{ padding: '6px 8px', fontWeight: 600, textTransform: 'capitalize' }}>
              {episode.modeOfDelivery.replace(/_/g, ' ')}
            </td>
            <td style={{ padding: '6px 8px', color: '#64748b' }}>Recurrence Risk Level:</td>
            <td style={{ padding: '6px 8px', fontWeight: 700, textTransform: 'capitalize', color: episode.recurrenceRiskCategory.includes('high') ? '#b91c1c' : '#0f172a' }}>
              {episode.recurrenceRiskCategory.replace(/_/g, ' ')}
            </td>
          </tr>
          {episode.futurePregnancyPlan && (
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '6px 8px', color: '#64748b' }}>Future Pregnancy Protocol:</td>
              <td colSpan={3} style={{ padding: '6px 8px', fontWeight: 600, color: '#1e3a8a' }}>
                {episode.futurePregnancyPlan}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Audit Review Status */}
      <div style={{ marginBottom: '1rem', padding: '8px 12px', background: '#f1f5f9', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
        <span><strong>Attending Obstetrician: </strong>{episode.consultantName || episode.reviewedByName || 'Consultant Obstetrician'}</span>
        <span>Reviewed by: <strong>{episode.reviewedByName || 'Consultant'}</strong></span>
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
        signatoryName={episode.reviewedByName || episode.consultantName || 'Consultant Obstetrician & Gynecologist'}
        designation="Consultant Obstetrician &amp; Gynecologist"
        date={episode.diagnosisDate}
      />
    </Sheet>
  );
}
