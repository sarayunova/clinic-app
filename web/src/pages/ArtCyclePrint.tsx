import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type Patient,
  type ArtCycleRecord,
  getArtCycle,
  auditPrintArtCycle,
} from '../api';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';

export function ArtCyclePrint() {
  const { patientId, id } = useParams();
  const cycleId = Number(id);
  const pId = Number(patientId);

  const { clinic, error: clinicError } = useClinic();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [cycle, setCycle] = useState<ArtCycleRecord | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!cycleId || !pId) return;

    Promise.all([
      api<{ patient: Patient }>('GET', `/api/patients/${pId}`),
      getArtCycle(cycleId),
    ])
      .then(([pRes, cRes]) => {
        setPatient(pRes.patient);
        setCycle(cRes);
      })
      .catch(setError);
  }, [pId, cycleId]);

  const handlePrint = async () => {
    try {
      await auditPrintArtCycle(cycleId);
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

  if (!clinic || !patient || !cycle) {
    return (
      <div className="page narrow stack">
        <p className="muted">Loading ART treatment summary…</p>
      </div>
    );
  }

  return (
    <Sheet
      clinic={clinic}
      title="ASSISTED REPRODUCTIVE TECHNOLOGY (ART) CYCLE SUMMARY & EMBRYO TRANSFER DOSSIER"
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
          COH Protocol, Gardner Blastocyst Grading, Cryostorage &amp; hCG Kinetics
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
          ASRM Practice Committee • ESHRE Guidelines • Single Embryo Transfer (SET) Policy
        </div>
      </div>

      {/* Patient & Cycle Header */}
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
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Cycle Identification:</td>
            <td style={{ padding: '4px 8px', fontWeight: 700, color: '#5b21b6' }}>
              Cycle #{cycle.cycleNumber} &bull; Started {cycle.startDate}
            </td>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Cycle Type:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600, textTransform: 'capitalize' }}>
              {cycle.cycleType.replace(/_/g, ' ')}
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Stimulation Protocol:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600, textTransform: 'capitalize' }}>
              {cycle.protocolType.replace(/_/g, ' ')}
            </td>
            <td style={{ padding: '4px 8px', color: '#64748b' }}>Infertility Indication:</td>
            <td style={{ padding: '4px 8px', fontWeight: 600, textTransform: 'capitalize' }}>
              {cycle.indication.replace(/_/g, ' ')}
            </td>
          </tr>
          {cycle.indicationNotes && (
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '4px 8px', color: '#64748b' }}>Baseline Assessment:</td>
              <td colSpan={3} style={{ padding: '4px 8px', fontStyle: 'italic' }}>
                {cycle.indicationNotes}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Stimulation & Trigger Grid */}
      <div style={{ marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ background: '#f8fafc', padding: '6px 10px', borderBottom: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
          CONTROLLED OVARIAN STIMULATION &amp; OVULATION TRIGGER
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '6px 10px', width: '25%', fontWeight: 600, color: '#475569' }}>Gonadotropins:</td>
              <td style={{ padding: '6px 10px', width: '25%' }}>{cycle.gonadotropinType || 'Standard protocol'}</td>
              <td style={{ padding: '6px 10px', width: '25%', fontWeight: 600, color: '#475569' }}>Total Dose:</td>
              <td style={{ padding: '6px 10px', width: '25%' }}>{cycle.totalGonadotropinDoseIu ? `${cycle.totalGonadotropinDoseIu} IU (${cycle.stimulationDays || 0} days)` : 'N/A'}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '6px 10px', fontWeight: 600, color: '#475569' }}>Peak Estradiol (E2):</td>
              <td style={{ padding: '6px 10px' }}>{cycle.peakEstradiolPgMl ? `${cycle.peakEstradiolPgMl} pg/mL` : 'N/A'}</td>
              <td style={{ padding: '6px 10px', fontWeight: 600, color: '#475569' }}>Trigger Progesterone (P4):</td>
              <td style={{ padding: '6px 10px' }}>{cycle.triggerProgesteroneNgMl ? `${cycle.triggerProgesteroneNgMl} ng/mL` : 'N/A'}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 10px', fontWeight: 600, color: '#475569' }}>Trigger Regimen:</td>
              <td style={{ padding: '6px 10px', textTransform: 'capitalize' }}>{cycle.triggerType?.replace(/_/g, ' ') || 'rhCG'}</td>
              <td style={{ padding: '6px 10px', fontWeight: 600, color: '#475569' }}>Trigger Datetime:</td>
              <td style={{ padding: '6px 10px' }}>{cycle.triggerDatetime ? cycle.triggerDatetime.replace('T', ' ') : 'Recorded'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* OPU & Embryology Metrics */}
      <div style={{ marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ background: '#f8fafc', padding: '6px 10px', borderBottom: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
          OOCYTE RETRIEVAL (OPU) &amp; EMBRYOLOGY REPORT
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>
              <th style={{ padding: '6px' }}>Oocytes Retrieved</th>
              <th style={{ padding: '6px' }}>Mature (MII)</th>
              <th style={{ padding: '6px' }}>Insemination</th>
              <th style={{ padding: '6px' }}>2PN Fertilized</th>
              <th style={{ padding: '6px' }}>Fertilization Rate</th>
              <th style={{ padding: '6px' }}>Day 3 Cleaved</th>
              <th style={{ padding: '6px' }}>Day 5 Blastocysts</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '8px', fontWeight: 700, fontSize: '1rem' }}>{cycle.totalOocytesRetrieved}</td>
              <td style={{ padding: '8px', fontWeight: 700, fontSize: '1rem', color: '#5b21b6' }}>{cycle.matureMiiOocytes}</td>
              <td style={{ padding: '8px', textTransform: 'uppercase', fontWeight: 600 }}>{cycle.inseminationMethod || 'ICSI'}</td>
              <td style={{ padding: '8px', fontWeight: 700, fontSize: '1rem', color: '#047857' }}>{cycle.fertilized2pnCount}</td>
              <td style={{ padding: '8px', fontWeight: 700, fontSize: '1rem', color: '#047857' }}>
                {cycle.fertilizationRatePercent !== null && cycle.fertilizationRatePercent !== undefined
                  ? `${cycle.fertilizationRatePercent}%`
                  : 'N/A'}
              </td>
              <td style={{ padding: '8px', fontWeight: 600 }}>{cycle.day3EmbryosCount}</td>
              <td style={{ padding: '8px', fontWeight: 700, color: '#5b21b6' }}>{cycle.day5BlastocystsCount}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Embryo Transfer & Cryostorage */}
      <div style={{ marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', background: '#f8fafc' }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', marginBottom: '6px' }}>
          EMBRYO TRANSFER &amp; CRYOSTORAGE INVENTORY
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: '#64748b' }}>Transfer Policy:</span>{' '}
            <strong>
              {cycle.embryosTransferredCount > 0
                ? `${cycle.embryosTransferredCount} Embryo(s) Transferred (${cycle.transferStage?.replace(/_/g, ' ') || 'Blastocyst'})`
                : 'Freeze-All (Transfer Deferred)'}
            </strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Gardner Blastocyst Grade:</span>{' '}
            <strong style={{ fontFamily: 'monospace', color: '#5b21b6', fontSize: '0.95rem' }}>
              {cycle.transferredEmbryosDetails || 'Cleavage stage'}
            </strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Endometrial Thickness:</span>{' '}
            <strong>{cycle.endometrialThicknessAtTransferMm ? `${cycle.endometrialThicknessAtTransferMm} mm` : 'N/A'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Transfer Difficulty:</span>{' '}
            <strong style={{ textTransform: 'capitalize' }}>{cycle.transferDifficulty}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Vitrified / Frozen Embryos:</span>{' '}
            <strong style={{ color: '#047857' }}>{cycle.embryosFrozenCount} blastocysts</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Luteal Support Regimen:</span>{' '}
            <span>{cycle.lutealSupportRegimen || 'Standard vaginal progesterone'}</span>
          </div>
        </div>
        {cycle.frozenStorageStraws && (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#475569' }}>
            <span style={{ fontWeight: 600 }}>Cryostorage Tank &amp; Straw IDs: </span>
            {cycle.frozenStorageStraws}
          </div>
        )}
      </div>

      {/* Pregnancy Outcome & Serial Beta-hCG Kinetics */}
      <table style={{ width: '100%', marginBottom: '1rem', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <tbody>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '6px 8px', color: '#64748b', width: '25%' }}>Day 14 Beta-hCG:</td>
            <td style={{ padding: '6px 8px', fontWeight: 700, width: '25%' }}>
              {cycle.betaHcgDay14MiuMl ? `${cycle.betaHcgDay14MiuMl} mIU/mL` : 'Pending'}
            </td>
            <td style={{ padding: '6px 8px', color: '#64748b', width: '25%' }}>Day 16 Beta-hCG:</td>
            <td style={{ padding: '6px 8px', fontWeight: 700, width: '25%' }}>
              {cycle.betaHcgDay16MiuMl ? `${cycle.betaHcgDay16MiuMl} mIU/mL` : 'Pending'}
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '6px 8px', color: '#64748b' }}>hCG Doubling Kinetics:</td>
            <td style={{ padding: '6px 8px', fontWeight: 600, color: '#1e40af' }}>
              {cycle.hcgDoublingTimeHours ? `${cycle.hcgDoublingTimeHours} hours` : 'Pending'}
            </td>
            <td style={{ padding: '6px 8px', color: '#64748b' }}>Clinical Outcome:</td>
            <td style={{ padding: '6px 8px', fontWeight: 700, textTransform: 'capitalize', color: cycle.clinicalPregnancyStatus.includes('intrauterine') ? '#047857' : '#0f172a' }}>
              {cycle.clinicalPregnancyStatus.replace(/_/g, ' ')}
            </td>
          </tr>
        </tbody>
      </table>

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
        Under no circumstances has preimplantation or prenatal fetal sex selection or disclosure occurred.
      </div>

      <SignatureBlock
        clinic={clinic}
        signatoryName={cycle.reviewedByName || cycle.leadEmbryologist || 'Reproductive Medicine Specialist'}
        designation="Reproductive Medicine Consultant &amp; Clinical Embryologist"
        date={cycle.startDate}
      />
    </Sheet>
  );
}
