import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type OperativeNote } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner } from './ui';
import { OperativeNoteModal } from './OperativeNoteModal';

export interface OperativeNotesListProps {
  patientId: number;
  patientName: string;
  admissionId?: number | null;
}

export function OperativeNotesList({ patientId, patientName, admissionId }: OperativeNotesListProps) {
  const { can } = useAuth();
  const canWrite = can('care:write_clinical');

  const [notes, setNotes] = useState<OperativeNote[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<OperativeNote | null>(null);

  const loadNotes = async () => {
    try {
      const url = admissionId
        ? `/api/admissions/${admissionId}/operative-notes`
        : `/api/patients/${patientId}/operative-notes`;
      const data = await api<OperativeNote[]>('GET', url);
      setNotes(data);
      setError(null);
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    void loadNotes();
  }, [patientId, admissionId]);

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <div className="row wrap between" style={{ alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>🩺 Surgical & Operative Delivery Records</h2>
          <div className="muted small">
            LSCS, operative vaginal deliveries, laparotomies, and pre/post-operative surgical records
          </div>
        </div>
        {canWrite && (
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setEditingNote(null);
              setModalOpen(true);
            }}
          >
            + Record Operative Note / LSCS
          </button>
        )}
      </div>

      <ErrorBanner error={error} />

      {notes === null && !error && <p className="muted">Loading operative records…</p>}

      {notes && notes.length === 0 && (
        <div className="empty card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p>No surgical or operative delivery records for this patient.</p>
          {canWrite ? (
            <p className="muted small">
              Click “+ Record Operative Note / LSCS” to record an operative delivery with WHO safety checklist.
            </p>
          ) : (
            <p className="muted small">Surgeon or obstetrician can document operative procedures.</p>
          )}
        </div>
      )}

      {notes && notes.length > 0 && (
        <div className="stack" style={{ gap: '0.85rem' }}>
          {notes.map((note) => {
            const isEmergency = note.urgency === 'emergency';
            const isPph = note.estimatedBloodLossMl >= 1000;

            return (
              <div
                key={note.id}
                className="card stack"
                style={{
                  padding: '1rem 1.25rem',
                  borderLeft: `4px solid ${isEmergency ? 'var(--danger)' : 'var(--primary)'}`,
                  background: 'var(--surface)',
                }}
              >
                <div className="row wrap between" style={{ alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div>
                    <div className="row wrap" style={{ alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{note.procedureName}</span>
                      <span className={`badge ${isEmergency ? 'danger' : 'info'}`} style={{ fontWeight: 600 }}>
                        {isEmergency ? 'Emergency' : 'Elective'}
                      </span>
                      <span className="badge muted small">Ref: {note.operativeNumber}</span>
                    </div>
                    <div className="muted small" style={{ marginTop: '0.2rem' }}>
                      Surgery Date: <b>{note.surgeryDate}</b> at <b>{note.startTime}</b>
                      {note.endTime ? ` – ${note.endTime}` : ''} · Lead Surgeon: <b>{note.surgeonName}</b>
                      {note.assistantName ? ` · Assist: ${note.assistantName}` : ''}
                      {note.anesthetistName ? ` · Anesth: ${note.anesthetistName} (${note.anesthesiaType})` : ''}
                    </div>
                  </div>

                  <div className="row wrap" style={{ gap: '0.4rem' }}>
                    <Link to={`/operative-notes/${note.id}/print`} className="btn small primary">
                      🖨️ View & Print Note
                    </Link>
                    {canWrite && (
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => {
                          setEditingNote(note);
                          setModalOpen(true);
                        }}
                      >
                        ✏️ Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* Indication */}
                <div style={{ background: 'var(--bg)', padding: '0.4rem 0.6rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                  <span className="muted">Indication: </span>
                  <b>{note.indication}</b>
                </div>

                {/* Key Findings Grid */}
                <div
                  className="grid4"
                  style={{
                    gap: '0.5rem',
                    fontSize: '0.82rem',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '0.5rem',
                  }}
                >
                  <div>
                    <span className="muted" style={{ display: 'block' }}>Incision & Presentation</span>
                    <b>{note.incisionType}</b> · {note.presentation}
                  </div>

                  <div>
                    <span className="muted" style={{ display: 'block' }}>Liquor & Placenta</span>
                    <b>{note.liquorCharacteristics}</b> · {note.placentaDelivery} ({note.placentaCompleteness})
                  </div>

                  <div>
                    <span className="muted" style={{ display: 'block' }}>Blood Loss & Sterilization</span>
                    <span style={{ color: isPph ? 'var(--danger)' : 'inherit', fontWeight: isPph ? 700 : 600 }}>
                      {note.estimatedBloodLossMl} ml {isPph ? '⚠️ (PPH)' : ''}
                    </span>
                    {note.tubalLigationPerformed ? ' · Tubectomy Done' : ''}
                  </div>

                  <div>
                    <span className="muted" style={{ display: 'block' }}>Safety Checklist & Counts</span>
                    <span style={{ color: note.spongeCountVerified && note.instrumentCountVerified ? '#16a34a' : 'var(--danger)', fontWeight: 600 }}>
                      {note.spongeCountVerified && note.instrumentCountVerified ? '✓ All Counts Correct' : '⚠️ Count Discrepancy'}
                    </span>
                  </div>
                </div>

                {/* Newborn Outcome Banner (if applicable) */}
                {note.babyGender && (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '5px',
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.83rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      👶 <b>Newborn: </b>
                      <span style={{ textTransform: 'capitalize' }}>{note.babyGender}</span>
                      {note.babyWeightGrams ? ` · Weight: ${note.babyWeightGrams}g` : ''}
                      {note.babyDeliveryTime ? ` · Delivered at: ${note.babyDeliveryTime}` : ''}
                    </div>
                    <div>
                      <b>APGAR: </b>
                      <span className={`badge ${Number(note.apgar1min) >= 7 ? 'ok' : 'danger'}`} style={{ padding: '0.1rem 0.35rem' }}>
                        1 min: {note.apgar1min ?? '—'}/10
                      </span>{' '}
                      <span className={`badge ${Number(note.apgar5min) >= 8 ? 'ok' : 'danger'}`} style={{ padding: '0.1rem 0.35rem' }}>
                        5 min: {note.apgar5min ?? '—'}/10
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Operative Note Creator / Editor Modal */}
      {modalOpen && (
        <OperativeNoteModal
          patientId={patientId}
          patientName={patientName}
          admissionId={admissionId}
          existingNote={editingNote}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            void loadNotes();
          }}
        />
      )}
    </div>
  );
}
