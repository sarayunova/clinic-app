import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Partograph } from '../partographLogic';
import { OUTCOME_LABELS } from '../partographLogic';
import { PartographChart } from '../components/PartographChart';
import { Sheet, useClinic } from '../components/Sheet';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner } from '../components/ui';

export function PartographPrint() {
  const { id } = useParams();
  const partographId = Number(id);
  const { clinic, error: clinicError } = useClinic();
  const [partograph, setPartograph] = useState<Partograph | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!Number.isInteger(partographId) || partographId < 1) return;
    api<Partograph>('GET', `/api/partographs/${partographId}`).then(setPartograph, setError);
  }, [partographId]);

  const logPrint = () => {
    if (!partographId) return;
    void api('POST', `/api/partographs/${partographId}/print`).catch(() => {});
  };

  if (error || clinicError) {
    return (
      <div className="page narrow">
        <ErrorBanner error={error ?? clinicError} />
      </div>
    );
  }

  if (!partograph || !clinic) {
    return <p className="muted" style={{ padding: '2rem' }}>Loading partograph report…</p>;
  }

  const backUrl = partograph.admissionId
    ? `/admissions/${partograph.admissionId}`
    : `/patients/${partograph.patientId}`;

  return (
    <Sheet
      clinic={clinic}
      title="WHO INTRAPARTUM LABOR PROGRESS PARTOGRAPH"
      back={backUrl}
      onPrint={logPrint}
      controls={
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span className="small muted">Partograph Ref: <strong>{partograph.partographNumber}</strong></span>
        </div>
      }
    >
      {/* Patient Demographics & Labor Baseline Block */}
      <section className="sheet-block">
        <dl className="sheet-meta" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div>
            <dt>Patient Name:</dt>
            <dd><strong>{partograph.patientName}</strong></dd>
          </div>
          <div>
            <dt>MRN / Patient No:</dt>
            <dd><strong>{partograph.patientNumber}</strong></dd>
          </div>
          <div>
            <dt>Obstetric Parity:</dt>
            <dd><strong>{partograph.parity || 'Unspecified'}</strong></dd>
          </div>
          <div>
            <dt>Gestational Age:</dt>
            <dd>{partograph.gestationalAgeWeeks ? `${partograph.gestationalAgeWeeks} Weeks` : 'Term'}</dd>
          </div>
          <div>
            <dt>Active Phase Start:</dt>
            <dd>{new Date(partograph.startTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</dd>
          </div>
          <div>
            <dt>Rupture of Membranes:</dt>
            <dd>
              {partograph.ruptureOfMembranesTime
                ? new Date(partograph.ruptureOfMembranesTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                : 'Intact at Admission'}
            </dd>
          </div>
          <div>
            <dt>Fetal Position:</dt>
            <dd><strong>{partograph.fetalPosition || 'LOA'}</strong></dd>
          </div>
          {partograph.admissionNumber && (
            <div>
              <dt>Admission No:</dt>
              <dd>{partograph.admissionNumber} {partograph.bedLabel ? `(${partograph.bedLabel})` : ''}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* SVG Graphical WHO Partograph */}
      <section className="sheet-block" style={{ marginTop: '0.8rem' }}>
        <h3 style={{ fontSize: '0.96rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>
          Intrapartum Labor Graph (Alert &amp; Action Curves)
        </h3>
        <PartographChart partograph={partograph} entries={partograph.entries} />
      </section>

      {/* Delivery Outcome Block (if completed) */}
      {partograph.outcome && (
        <section
          className="sheet-block"
          style={{
            marginTop: '0.9rem',
            padding: '0.65rem 0.85rem',
            background: '#f8fafc',
            border: '1.5px solid #0f172a',
            borderRadius: '4px',
          }}
        >
          <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.98rem', color: '#0f172a' }}>
            DELIVERY OUTCOME &amp; NEONATAL RECORD
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.5rem', fontSize: '0.88rem' }}>
            <div>
              <span className="muted small" style={{ display: 'block' }}>Delivery Mode:</span>
              <strong>{OUTCOME_LABELS[partograph.outcome]}</strong>
            </div>

            <div>
              <span className="muted small" style={{ display: 'block' }}>Delivery Time:</span>
              <strong>{partograph.deliveryTime ? new Date(partograph.deliveryTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</strong>
            </div>

            <div>
              <span className="muted small" style={{ display: 'block' }}>Neonatal Gender &amp; Weight:</span>
              <strong>
                {partograph.babyGender ? partograph.babyGender.toUpperCase() : ''}{' '}
                {partograph.babyWeightGrams ? `· ${partograph.babyWeightGrams} g (${(partograph.babyWeightGrams / 1000).toFixed(2)} kg)` : ''}
              </strong>
            </div>

            <div>
              <span className="muted small" style={{ display: 'block' }}>APGAR Score (1m / 5m):</span>
              <strong>{partograph.apgar1min ?? '—'} / {partograph.apgar5min ?? '—'}</strong>
            </div>
          </div>

          {partograph.outcomeNotes && (
            <div style={{ marginTop: '0.45rem', paddingTop: '0.35rem', borderTop: '1px dashed #cbd5e1', fontSize: '0.84rem' }}>
              <span className="muted small" style={{ fontWeight: 600 }}>Labor Summary / Perineal Notes:</span>
              <div style={{ marginTop: '0.15rem' }}>{partograph.outcomeNotes}</div>
            </div>
          )}
        </section>
      )}

      {/* Signature & Attestation Block */}
      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="muted small" style={{ maxWidth: '380px', fontSize: '0.74rem', lineHeight: 1.35 }}>
          * WHO Labor Care Guide intrapartum clinical record. All observations recorded real-time at bedside. Alert Line denotes expected 1 cm/hr active phase dilatation; Action Line denotes critical obstetric decision boundary.
        </div>

        <SignatureBlock
          clinic={clinic}
          signatoryName={clinic.doctorName}
          designation="Consultant Obstetrician &amp; Gynecologist"
          style={{ marginTop: 0 }}
        />
      </div>
    </Sheet>
  );
}
