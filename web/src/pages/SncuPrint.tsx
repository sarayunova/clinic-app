import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type Patient,
  type SncuAdmission,
  getSncuAdmission,
  auditPrintSncu,
} from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';

export function SncuPrint() {
  const { patientId, id } = useParams();
  const admissionId = Number(id);
  const pId = Number(patientId);

  const { clinic, error: clinicError } = useClinic();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [admission, setAdmission] = useState<SncuAdmission | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!admissionId || !pId) return;

    Promise.all([
      api<{ patient: Patient }>('GET', `/api/patients/${pId}`),
      getSncuAdmission(admissionId),
    ])
      .then(([pRes, aRes]) => {
        setPatient(pRes.patient);
        setAdmission(aRes);
      })
      .catch(setError);
  }, [pId, admissionId]);

  const handlePrint = async () => {
    try {
      await auditPrintSncu(admissionId);
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

  if (!clinic || !patient || !admission) {
    return (
      <div className="page narrow stack">
        <p className="muted">Loading SNCU Inpatient Clinical Sheet…</p>
      </div>
    );
  }

  return (
    <Sheet
      clinic={clinic}
      title="SPECIAL NEWBORN CARE UNIT (SNCU / LEVEL-2 NICU) CLINICAL DOSSIER"
      back={`/patients/${pId}`}
      onPrint={() => void handlePrint()}
    >
      {/* Subhead */}
      <div
        style={{
          textAlign: 'center',
          borderBottom: '2px solid #0f172a',
          paddingBottom: '0.4rem',
          marginBottom: '0.8rem',
        }}
      >
        <div
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: '#1e293b',
            textTransform: 'uppercase',
          }}
        >
          Neonatal Inpatient Flowsheet &bull; Silverman-Anderson &amp; Downes Scores &bull; CPAP &amp; Fluid Regimen
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
          National Neonatology Forum (NNF) India &bull; WHO Standards for Sick Newborn Care in Level-2 Facilities
        </div>
      </div>

      {/* Patient & Gestational Summary */}
      <div
        style={{
          marginBottom: '1rem',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: '#f8fafc',
            padding: '6px 10px',
            borderBottom: '1px solid #cbd5e1',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#1e293b',
          }}
        >
          INFANT DEMOGRAPHIC &amp; GESTATIONAL PROFILE
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 10px', color: '#64748b', width: '25%' }}>Infant Name:</td>
              <td style={{ padding: '6px 10px', fontWeight: 700, width: '25%' }}>
                {patient.fullName}
              </td>
              <td style={{ padding: '6px 10px', color: '#64748b', width: '25%' }}>Patient Number:</td>
              <td style={{ padding: '6px 10px', fontWeight: 600, width: '25%' }}>
                #{patient.patientNumber}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>Admission Time:</td>
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>
                {admission.admissionDatetime?.replace('T', ' ')}
              </td>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>Primary Indication:</td>
              <td style={{ padding: '6px 10px', fontWeight: 700, color: '#0369a1' }}>
                {admission.admissionIndication?.replace(/_/g, ' ').toUpperCase()}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>Gestational Age:</td>
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>
                {admission.gestationalAgeWeeks}w {admission.gestationalAgeDays}d{' '}
                {admission.gestationalAgeWeeks < 37 ? '(Preterm)' : '(Term)'}
              </td>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>Birth Weight / Current:</td>
              <td style={{ padding: '6px 10px', fontWeight: 700 }}>
                {admission.birthWeightG} g / {admission.currentWeightG ? `${admission.currentWeightG} g` : 'N/A'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Respiratory Support & Distress Scores */}
      <div
        style={{
          marginBottom: '1rem',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: '#f8fafc',
            padding: '6px 10px',
            borderBottom: '1px solid #cbd5e1',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#1e293b',
          }}
        >
          RESPIRATORY SUPPORT &amp; OBJECTIVE DISTRESS INDICES
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 10px', color: '#64748b', width: '25%' }}>Support Modality:</td>
              <td style={{ padding: '6px 10px', fontWeight: 700, color: '#0284c7', width: '25%' }}>
                {admission.respiratorySupport?.replace(/_/g, ' ').toUpperCase()}
              </td>
              <td style={{ padding: '6px 10px', color: '#64748b', width: '25%' }}>FiO2 Delivered:</td>
              <td style={{ padding: '6px 10px', fontWeight: 600, width: '25%' }}>
                {admission.fio2Percent || 21}%
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>PEEP (cm H2O) / Flow:</td>
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>
                {admission.peepCmH2o ? `${admission.peepCmH2o} cm H2O` : 'None'} /{' '}
                {admission.flowRateLMin ? `${admission.flowRateLMin} L/min` : 'N/A'}
              </td>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>Target SpO2:</td>
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>
                {admission.spo2Percent ? `${admission.spo2Percent}% (Target 91–95%)` : '91–95%'}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>Silverman-Anderson Index:</td>
              <td style={{ padding: '6px 10px', fontWeight: 700, color: (admission.silvermanAndersonScore || 0) > 3 ? '#b91c1c' : '#166534' }}>
                {admission.silvermanAndersonScore ?? '—'} / 10{' '}
                {(admission.silvermanAndersonScore || 0) > 6
                  ? '(Severe / Impending Failure)'
                  : (admission.silvermanAndersonScore || 0) > 3
                    ? '(Moderate Distress)'
                    : '(Mild / None)'}
              </td>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>Downes Score:</td>
              <td style={{ padding: '6px 10px', fontWeight: 700, color: (admission.downesScore || 0) > 3 ? '#b91c1c' : '#166534' }}>
                {admission.downesScore ?? '—'} / 10{' '}
                {(admission.downesScore || 0) > 7
                  ? '(Critical Failure)'
                  : (admission.downesScore || 0) > 3
                    ? '(Moderate Distress - CPAP Indicated)'
                    : '(Mild / Stable)'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Fluid, Caloric & Phototherapy Plan */}
      <div
        style={{
          marginBottom: '1rem',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: '#f8fafc',
            padding: '6px 10px',
            borderBottom: '1px solid #cbd5e1',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#1e293b',
          }}
        >
          FLUIDS, NUTRITION, THERMOREGULATION &amp; KMC
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 10px', color: '#64748b', width: '25%' }}>Fluid Goal:</td>
              <td style={{ padding: '6px 10px', fontWeight: 700, width: '25%' }}>
                {admission.totalFluidGoalMlKgDay} mL/kg/day
              </td>
              <td style={{ padding: '6px 10px', color: '#64748b', width: '25%' }}>Feeding Route:</td>
              <td style={{ padding: '6px 10px', fontWeight: 600, width: '25%' }}>
                {admission.feedingMode?.replace(/_/g, ' ').toUpperCase()}{' '}
                {admission.feedingVolumeMl ? `(${admission.feedingVolumeMl} mL q${admission.feedingFrequencyHours}h)` : ''}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>Phototherapy Unit:</td>
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>
                {admission.phototherapyStatus?.replace(/_/g, ' ').toUpperCase()}
              </td>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>KMC Duration Today:</td>
              <td style={{ padding: '6px 10px', fontWeight: 700, color: '#9a3412' }}>
                {admission.kmcDurationHoursToday || 0} Hours
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 10px', color: '#64748b' }}>IV Fluid Rate / Solution:</td>
              <td colSpan={3} style={{ padding: '6px 10px', fontWeight: 600 }}>
                {admission.ivFluidTypeRate || 'None (Full enteral feeds)'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Vitals, Antibiotics & Directives */}
      <div
        style={{
          marginBottom: '1rem',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: '#f8fafc',
            padding: '6px 10px',
            borderBottom: '1px solid #cbd5e1',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#1e293b',
          }}
        >
          VITALS SURVEILLANCE, ANTIBIOTIC REGIMEN &amp; CLINICAL ROUND DIRECTIVES
        </div>
        <div style={{ padding: '8px 10px', fontSize: '0.85rem', lineHeight: '1.4' }}>
          <div style={{ marginBottom: '6px' }}>
            <strong>Round Vitals:</strong> HR: {admission.heartRateBpm || '—'} bpm | RR:{' '}
            {admission.respiratoryRateBpm || '—'} /min | SpO2: {admission.spo2Percent || '—'}% |
            Temp: {admission.temperatureCelsius || '—'} °C | CBG:{' '}
            {admission.capillaryBloodGlucoseMgDl || '—'} mg/dL
          </div>
          {admission.antibioticRegimen && (
            <div style={{ marginBottom: '6px' }}>
              <strong>Antibiotic Cover:</strong> {admission.antibioticRegimen}
            </div>
          )}
          {admission.clinicalNotes && (
            <div style={{ marginTop: '6px', fontStyle: 'italic', color: '#475569' }}>
              &ldquo;{admission.clinicalNotes}&rdquo;
            </div>
          )}
        </div>
      </div>

      {/* Sign-off Block */}
      <SignatureBlock
        clinic={clinic}
        signatoryName={
          admission.attendingPediatrician ||
          admission.reviewedByName ||
          'Consultant Neonatologist & Pediatrician'
        }
        qualifications="MD (Pediatrics), DM (Neonatology), Level-2 SNCU Incharge"
        regNo="MCI/NEO/68201"
        designation="Consultant Neonatologist & Pediatric Intensivist"
      />
    </Sheet>
  );
}
