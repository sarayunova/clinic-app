import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { IucdInsertionRecord, Patient } from '../api';

export function IucdPrint() {
  const { patientId, id } = useParams<{ patientId: string; id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [insertion, setInsertion] = useState<IucdInsertionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const ptRes = await fetch(`/api/patients/${patientId}`);
        if (!ptRes.ok) throw new Error('Failed to load patient');
        const ptData = await ptRes.json();
        setPatient(ptData.patient);

        const insRes = await fetch(`/api/patients/${patientId}/contraception/iucd-insertions/${id}`);
        if (!insRes.ok) throw new Error('Failed to load IUCD insertion record');
        const insData = await insRes.json();
        setInsertion(insData.insertion);

        void fetch(`/api/patients/${patientId}/contraception/iucd-insertions/${id}/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error loading IUCD print card');
      } finally {
        setLoading(false);
      }
    }
    if (patientId && id) void fetchData();
  }, [patientId, id]);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        Loading IUCD Insertion &amp; Discharge Card for printing...
      </div>
    );
  }

  if (error || !insertion || !patient) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626', fontFamily: 'sans-serif' }}>
        {error || 'IUCD record not found'}
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '850px',
        margin: '0 auto',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#1e293b',
        background: '#fff',
      }}
    >
      {/* Top Action Bar */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '12px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <button
          onClick={() => window.history.back()}
          style={{
            padding: '8px 16px',
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          ← Back
        </button>
        <button
          onClick={() => window.print()}
          style={{
            padding: '8px 20px',
            background: '#0d9488',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          🖨️ Print IUCD Client Card
        </button>
      </div>

      {/* Clinic Header */}
      <div
        style={{
          textAlign: 'center',
          borderBottom: '2px solid #0d9488',
          paddingBottom: '12px',
          marginBottom: '16px',
        }}
      >
        <h1 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Obstetrics &amp; Gynaecology Specialty Clinic
        </h1>
        <div style={{ fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
          Postpartum Family Planning (PPFP) &amp; Comprehensive Contraceptive Services
        </div>
        <h2
          style={{
            margin: '8px 0 0 0',
            fontSize: '16px',
            color: '#0f172a',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Intrauterine Contraceptive Device (IUCD / LNG-IUS) Client Card
        </h2>
      </div>

      {/* Patient Demographic Information Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '4px',
          padding: '10px 14px',
          fontSize: '12px',
          marginBottom: '16px',
        }}
      >
        <div>
          <span style={{ color: '#64748b' }}>Client Name:</span>
          <div style={{ fontWeight: 700, fontSize: '13px' }}>{String(patient.fullName || '')}</div>
        </div>
        <div>
          <span style={{ color: '#64748b' }}>Patient ID:</span>
          <div style={{ fontWeight: 700 }}>{String(patient.patientNumber || '')}</div>
        </div>
        <div>
          <span style={{ color: '#64748b' }}>Age / DOB:</span>
          <div style={{ fontWeight: 600 }}>
            {String(patient.dateOfBirth || (patient.estimatedAgeYears ? `${patient.estimatedAgeYears} yrs` : '—'))}
          </div>
        </div>
        <div>
          <span style={{ color: '#64748b' }}>Phone:</span>
          <div style={{ fontWeight: 600 }}>{patient.phone ? String(patient.phone) : '—'}</div>
        </div>
      </div>

      {/* Device & Insertion Highlights Box */}
      <div
        style={{
          border: '2px solid #0d9488',
          borderRadius: '6px',
          padding: '14px',
          background: '#f0fdfa',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '12px' }}>
          <div>
            <span style={{ color: '#0f766e', fontWeight: 600 }}>Device Inserted:</span>
            <div style={{ fontWeight: 800, fontSize: '15px', color: '#134e4a' }}>
              {insertion.device_brand_name || insertion.device_type.toUpperCase()}
            </div>
            <div style={{ color: '#475569', fontSize: '11px', marginTop: '2px' }}>
              Type: {insertion.device_type.includes('lng') ? 'Levonorgestrel Hormonal System' : 'Copper T Non-Hormonal'}
            </div>
          </div>

          <div>
            <span style={{ color: '#0f766e', fontWeight: 600 }}>Date of Insertion:</span>
            <div style={{ fontWeight: 800, fontSize: '15px', color: '#134e4a' }}>
              {insertion.insertion_date}
            </div>
            <div style={{ color: '#475569', fontSize: '11px', marginTop: '2px' }}>
              Timing: {insertion.insertion_timing.replace(/_/g, ' ')}
            </div>
          </div>

          <div>
            <span style={{ color: '#0f766e', fontWeight: 600 }}>Protected Until (Expiry):</span>
            <div style={{ fontWeight: 800, fontSize: '15px', color: '#b91c1c' }}>
              {insertion.expected_removal_date}
            </div>
            <div style={{ color: '#0d9488', fontSize: '11px', fontWeight: 700, marginTop: '2px' }}>
              Approved Duration: {insertion.lifespan_years} Years
            </div>
          </div>
        </div>
      </div>

      {/* Procedure Details Table */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', fontSize: '12px', marginBottom: '16px' }}>
        <div style={{ fontWeight: 700, color: '#0d9488', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px' }}>
          Procedure &amp; Placement Specifications
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          <div>
            <span style={{ color: '#64748b' }}>Operator:</span>
            <div style={{ fontWeight: 600 }}>{insertion.inserted_by}</div>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Lot / Batch #:</span>
            <div style={{ fontWeight: 600 }}>{insertion.lot_batch_number || '—'}</div>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Uterine Depth:</span>
            <div style={{ fontWeight: 600 }}>{insertion.uterine_depth_cm ? `${insertion.uterine_depth_cm} cm` : '—'}</div>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>String Cut Length:</span>
            <div style={{ fontWeight: 600 }}>{insertion.thread_length_cut_cm ? `${insertion.thread_length_cut_cm} cm` : '—'}</div>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Analgesia:</span>
            <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{insertion.analgesia_used.replace(/_/g, ' ')}</div>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Insertion Ease:</span>
            <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{insertion.insertion_ease.replace(/_/g, ' ')}</div>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Post-Procedure USG:</span>
            <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{insertion.post_insertion_ultrasound.replace(/_/g, ' ')}</div>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Device Status:</span>
            <div style={{ fontWeight: 700, color: '#0d9488', textTransform: 'uppercase' }}>{insertion.status.replace(/_/g, ' ')}</div>
          </div>
        </div>

        {insertion.clinical_notes && (
          <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #f1f5f9', color: '#475569' }}>
            <strong>Operator Notes:</strong> {insertion.clinical_notes}
          </div>
        )}
      </div>

      {/* Client Care & Warning Signs Section (PAINS) */}
      <div style={{ border: '1px solid #f87171', borderRadius: '4px', padding: '12px', background: '#fff5f5', marginBottom: '16px', fontSize: '11px' }}>
        <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '12px', marginBottom: '6px', textTransform: 'uppercase' }}>
          Important Client Information &amp; Warning Signs (&quot;P - A - I - N - S&quot;)
        </div>
        <p style={{ margin: '0 0 6px 0', lineHeight: 1.4 }}>
          Visit the clinic immediately if you experience any of the following symptoms:
        </p>
        <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: 1.5 }}>
          <li><strong>P - Period late or abnormal spotting:</strong> May signify unexpected pregnancy; consult doctor immediately.</li>
          <li><strong>A - Abdominal pain or severe cramps:</strong> Persistent lower abdominal pain or discomfort during intercourse.</li>
          <li><strong>I - Infection signs:</strong> Unusual or foul-smelling vaginal discharge, pelvic tenderness.</li>
          <li><strong>N - Not feeling well:</strong> Unexplained fever, chills, or systemic weakness.</li>
          <li><strong>S - Strings missing, lengthened, or shortened:</strong> You cannot feel strings, or feel the hard plastic tip of the device poking through the cervix.</li>
        </ul>
      </div>

      {/* Routine Follow-Up Schedule */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '10px 12px', fontSize: '11px', marginBottom: '24px' }}>
        <div style={{ fontWeight: 700, color: '#0d9488', marginBottom: '4px' }}>
          Routine Follow-up &amp; Surveillance Schedule
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div>
            <strong>1st Checkup:</strong> 6 Weeks Post-Insertion (or after 1st menses)
          </div>
          <div>
            <strong>2nd Checkup:</strong> 6 Months Post-Insertion
          </div>
          <div>
            <strong>Routine Surveillance:</strong> Once Annually thereafter
          </div>
        </div>
      </div>

      {/* Signature and Verification Footer */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          marginTop: '30px',
          fontSize: '11px',
          color: '#475569',
        }}
      >
        <div>
          <div>Card Issued: {new Date().toLocaleDateString()}</div>
          <div>Clinic Electronic Medical Record System • Tamper-evident Audit Logged</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ height: '35px' }} />
          <div style={{ borderTop: '1px solid #475569', display: 'inline-block', minWidth: '200px', paddingTop: '4px' }}>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>{insertion.inserted_by}</div>
            <div>Consultant Gynecologist / Authorized Operator</div>
          </div>
        </div>
      </div>
    </div>
  );
}
