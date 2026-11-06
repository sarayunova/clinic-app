import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  api,
  type PediatricResponse,
  type VaccineItem,
  type VaccineMilestone,
  type VaccineStatus,
  type PediatricProfile,
} from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, Field, todayLocal } from './ui';
import type { Attachment } from './Documents';
import { CommunicationModal } from './CommunicationModal';

interface Props {
  patientId: number;
  dateOfBirth?: string | null;
  onChanged?: () => void;
}

const MILESTONE_ORDER: VaccineMilestone[] = [
  'birth',
  '6_weeks',
  '10_weeks',
  '14_weeks',
  '9_12_months',
  '16_24_months',
  '5_6_years',
  '10_16_years',
];

const MILESTONE_LABELS: Record<VaccineMilestone, string> = {
  birth: 'At Birth',
  '6_weeks': '6 Weeks',
  '10_weeks': '10 Weeks',
  '14_weeks': '14 Weeks',
  '9_12_months': '9 - 12 Months',
  '16_24_months': '16 - 24 Months',
  '5_6_years': '5 - 6 Years',
  '10_16_years': '10 & 16 Years',
};

const DELIVERY_TYPE_LABEL: Record<string, string> = {
  normal_vaginal: 'Normal Vaginal Delivery (NVD)',
  cesarean: 'Cesarean Section (LSCS)',
  assisted: 'Assisted (Vacuum / Forceps)',
  other: 'Other',
};

export function PediatricTracker({ patientId, onChanged }: Props) {
  const { can } = useAuth();
  const [data, setData] = useState<PediatricResponse | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [activeTab, setActiveTab] = useState<'all' | VaccineMilestone>('all');

  // Edit profile state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<Partial<PediatricProfile>>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<unknown>(null);

  // Edit vaccine state
  const [editingVaccineKey, setEditingVaccineKey] = useState<string | null>(null);
  const [vaxStatus, setVaxStatus] = useState<VaccineStatus>('given');
  const [vaxDate, setVaxDate] = useState('');
  const [vaxBatch, setVaxBatch] = useState('');
  const [vaxRoute, setVaxRoute] = useState('');
  const [vaxAdmin, setVaxAdmin] = useState('');
  const [vaxNotes, setVaxNotes] = useState('');
  const [vaxAttachmentId, setVaxAttachmentId] = useState<number | null>(null);
  const [vaxSaving, setVaxSaving] = useState(false);
  const [vaxError, setVaxError] = useState<unknown>(null);
  const [commVaccine, setCommVaccine] = useState<VaccineItem | null>(null);

  const canEdit =
    can('patient:write_clinical') || can('care:write_nursing') || can('vitals:write');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [pedsRes, attRes] = await Promise.all([
        api<PediatricResponse>('GET', `/api/patients/${patientId}/pediatric`),
        can('attachment:read')
          ? api<Attachment[]>('GET', `/api/patients/${patientId}/attachments`).catch(() => [])
          : Promise.resolve([]),
      ]);
      setData(pedsRes);
      setAttachments(attRes);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [patientId, can]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const startEditProfile = () => {
    setProfileForm(data?.profile ?? {});
    setEditingProfile(true);
    setProfileError(null);
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setProfileSaving(true);
      setProfileError(null);
      await api('PATCH', `/api/patients/${patientId}/pediatric/profile`, {
        birthWeightKg: profileForm.birthWeightKg ? Number(profileForm.birthWeightKg) : null,
        birthLengthCm: profileForm.birthLengthCm ? Number(profileForm.birthLengthCm) : null,
        birthHeadCircumferenceCm: profileForm.birthHeadCircumferenceCm
          ? Number(profileForm.birthHeadCircumferenceCm)
          : null,
        gestationalAgeWeeks: profileForm.gestationalAgeWeeks
          ? Number(profileForm.gestationalAgeWeeks)
          : null,
        deliveryType: profileForm.deliveryType || null,
        birthHospital: profileForm.birthHospital?.trim() || null,
        apgar1min: profileForm.apgar1min != null ? Number(profileForm.apgar1min) : null,
        apgar5min: profileForm.apgar5min != null ? Number(profileForm.apgar5min) : null,
        bloodGroup: profileForm.bloodGroup?.trim() || null,
        birthNotes: profileForm.birthNotes?.trim() || null,
      });
      setEditingProfile(false);
      await loadData();
      onChanged?.();
    } catch (err) {
      setProfileError(err);
    } finally {
      setProfileSaving(false);
    }
  };

  const startEditVaccine = (v: VaccineItem) => {
    setEditingVaccineKey(v.vaccineKey);
    setVaxStatus(v.status);
    setVaxDate(v.givenDate ?? (v.status === 'given' ? todayLocal() : ''));
    setVaxBatch(v.batchNumber ?? '');
    setVaxRoute(v.routeSite ?? v.standardRoute);
    setVaxAdmin(v.administeredBy ?? '');
    setVaxNotes(v.notes ?? '');
    setVaxAttachmentId(v.attachmentId ?? null);
    setVaxError(null);
  };

  const saveVaccine = async (vaccineKey: string) => {
    try {
      setVaxSaving(true);
      setVaxError(null);
      await api('PATCH', `/api/patients/${patientId}/pediatric/vaccinations/${vaccineKey}`, {
        status: vaxStatus,
        givenDate: vaxDate || null,
        batchNumber: vaxBatch.trim() || null,
        routeSite: vaxRoute.trim() || null,
        administeredBy: vaxAdmin.trim() || null,
        notes: vaxNotes.trim() || null,
        attachmentId: vaxAttachmentId,
      });
      setEditingVaccineKey(null);
      await loadData();
      onChanged?.();
    } catch (err) {
      setVaxError(err);
    } finally {
      setVaxSaving(false);
    }
  };

  const quickMarkGiven = async (v: VaccineItem) => {
    if (!canEdit) return;
    try {
      await api('PATCH', `/api/patients/${patientId}/pediatric/vaccinations/${v.vaccineKey}`, {
        status: 'given',
        givenDate: todayLocal(),
      });
      await loadData();
      onChanged?.();
    } catch (err) {
      setError(err);
    }
  };

  if (loading && !data) {
    return <p className="muted">Loading child health and immunization records…</p>;
  }

  if (error) {
    return <ErrorBanner error={error} />;
  }

  if (!data) return null;

  const pct = data.summary.completionPercentage;
  const growth = data.growth;
  const filteredVaccines =
    activeTab === 'all'
      ? data.vaccinations
      : data.vaccinations.filter((v) => v.milestone === activeTab);

  return (
    <div className="pediatric-tracker stack" style={{ marginTop: '0.5rem' }}>
      {/* Child Birth Profile & Growth Trajectory Card */}
      <div
        className="card"
        style={{
          background: 'var(--surface)',
          borderLeft: '4px solid #10b981',
          padding: '1rem 1.25rem',
        }}
      >
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>👶 Pediatric Health & Growth Profile</span>
              {data.profile?.bloodGroup && (
                <span className="badge ok small">{data.profile.bloodGroup}</span>
              )}
            </h3>
            <div className="muted small" style={{ marginTop: '0.35rem' }}>
              <strong>Child Age:</strong> {data.ageFormatted}
              {data.dateOfBirth && ` (DOB: ${data.dateOfBirth})`}
              {data.profile?.gestationalAgeWeeks && ` · Born at ${data.profile.gestationalAgeWeeks} weeks`}
              {data.profile?.deliveryType && ` · ${DELIVERY_TYPE_LABEL[data.profile.deliveryType] ?? data.profile.deliveryType}`}
            </div>
          </div>

          {canEdit && !editingProfile && (
            <button type="button" className="btn small" onClick={startEditProfile}>
              {data.profile ? 'Edit birth profile' : '+ Record birth details'}
            </button>
          )}
        </div>

        {/* Birth Metrics & Milestones */}
        {data.profile ? (
          <div className="row wrap" style={{ gap: '1rem', marginTop: '0.9rem', alignItems: 'center' }}>
            <div className="stat" style={{ padding: '0.4rem 0.8rem', minWidth: 'auto' }}>
              <span style={{ fontSize: '0.75rem' }}>Birth Weight</span>
              <b style={{ fontSize: '1.15rem' }}>{data.profile.birthWeightKg ?? '—'} kg</b>
            </div>

            {growth.latestWeightKg != null && growth.birthWeightKg != null && (
              <div className="stat" style={{ padding: '0.4rem 0.8rem', minWidth: 'auto' }}>
                <span style={{ fontSize: '0.75rem' }}>Current Weight</span>
                <b style={{ fontSize: '1.15rem', color: '#16a34a' }}>
                  {growth.latestWeightKg} kg
                  {growth.totalWeightGainKg != null && (
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, marginLeft: '0.3rem' }}>
                      (+{growth.totalWeightGainKg} kg)
                    </span>
                  )}
                </b>
              </div>
            )}

            <div className="stat" style={{ padding: '0.4rem 0.8rem', minWidth: 'auto' }}>
              <span style={{ fontSize: '0.75rem' }}>Birth Length</span>
              <b style={{ fontSize: '1.15rem' }}>{data.profile.birthLengthCm ?? '—'} cm</b>
            </div>

            <div className="stat" style={{ padding: '0.4rem 0.8rem', minWidth: 'auto' }}>
              <span style={{ fontSize: '0.75rem' }}>Head Circ. (Birth)</span>
              <b style={{ fontSize: '1.15rem' }}>{data.profile.birthHeadCircumferenceCm ?? '—'} cm</b>
            </div>

            {(data.profile.apgar1min != null || data.profile.apgar5min != null) && (
              <div className="stat" style={{ padding: '0.4rem 0.8rem', minWidth: 'auto' }}>
                <span style={{ fontSize: '0.75rem' }}>APGAR Score</span>
                <b style={{ fontSize: '1.15rem' }}>
                  {data.profile.apgar1min ?? '—'} / {data.profile.apgar5min ?? '—'}
                </b>
              </div>
            )}

            {growth.doubledBirthWeight && (
              <span className="badge ok small" title="Birth weight doubled (normal by 5-6 months)">
                ✓ Doubled Birth Weight
              </span>
            )}
            {growth.tripledBirthWeight && (
              <span className="badge ok small" title="Birth weight tripled (normal by 1 year)">
                ✓ Tripled Birth Weight
              </span>
            )}
          </div>
        ) : (
          <p className="muted small" style={{ marginTop: '0.6rem' }}>
            No birth parameters recorded yet. Click &quot;+ Record birth details&quot; to log birth weight, length, delivery type, and APGAR.
          </p>
        )}

        {data.profile?.birthNotes && (
          <p className="muted small" style={{ margin: '0.6rem 0 0', fontStyle: 'italic' }}>
            Birth Notes: {data.profile.birthNotes}
          </p>
        )}

        {/* Profile Edit Form */}
        {editingProfile && (
          <form onSubmit={saveProfile} className="stack" style={{ marginTop: '1rem', borderTop: '1px dashed var(--border)', paddingTop: '1rem' }}>
            <ErrorBanner error={profileError} />
            <div className="grid2">
              <Field label="Birth Weight (kg)" hint="e.g. 3.15">
                <input
                  type="number"
                  step="0.01"
                  min="0.2"
                  max="10"
                  value={profileForm.birthWeightKg ?? ''}
                  onChange={(e) => setProfileForm({ ...profileForm, birthWeightKg: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>

              <Field label="Birth Length (cm)" hint="e.g. 50">
                <input
                  type="number"
                  step="0.1"
                  min="15"
                  max="80"
                  value={profileForm.birthLengthCm ?? ''}
                  onChange={(e) => setProfileForm({ ...profileForm, birthLengthCm: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>

              <Field label="Head Circumference at Birth (cm)">
                <input
                  type="number"
                  step="0.1"
                  min="15"
                  max="60"
                  value={profileForm.birthHeadCircumferenceCm ?? ''}
                  onChange={(e) => setProfileForm({ ...profileForm, birthHeadCircumferenceCm: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>

              <Field label="Gestational Age at Birth (weeks)">
                <input
                  type="number"
                  step="1"
                  min="20"
                  max="44"
                  placeholder="e.g. 39"
                  value={profileForm.gestationalAgeWeeks ?? ''}
                  onChange={(e) => setProfileForm({ ...profileForm, gestationalAgeWeeks: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>

              <Field label="Delivery Type">
                <select
                  value={profileForm.deliveryType ?? ''}
                  onChange={(e) => setProfileForm({ ...profileForm, deliveryType: (e.target.value || null) as any })}
                >
                  <option value="">— Select delivery type —</option>
                  <option value="normal_vaginal">Normal Vaginal Delivery (NVD)</option>
                  <option value="cesarean">Cesarean Section (LSCS)</option>
                  <option value="assisted">Assisted (Vacuum / Forceps)</option>
                  <option value="other">Other</option>
                </select>
              </Field>

              <Field label="Child Blood Group">
                <input
                  placeholder="e.g. O Rh-positive (O+)"
                  value={profileForm.bloodGroup ?? ''}
                  onChange={(e) => setProfileForm({ ...profileForm, bloodGroup: e.target.value })}
                  maxLength={30}
                />
              </Field>

              <Field label="APGAR Score (1 min)">
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={profileForm.apgar1min ?? ''}
                  onChange={(e) => setProfileForm({ ...profileForm, apgar1min: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>

              <Field label="APGAR Score (5 min)">
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={profileForm.apgar5min ?? ''}
                  onChange={(e) => setProfileForm({ ...profileForm, apgar5min: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>
            </div>

            <Field label="Birth Hospital / Place of Delivery">
              <input
                value={profileForm.birthHospital ?? ''}
                placeholder="Hospital name or clinic"
                onChange={(e) => setProfileForm({ ...profileForm, birthHospital: e.target.value })}
                maxLength={200}
              />
            </Field>

            <Field label="Birth Notes / Perinatal Observations">
              <textarea
                rows={2}
                value={profileForm.birthNotes ?? ''}
                placeholder="e.g. Cried immediately, no resuscitation needed, initiated breastfeeding within 1 hour"
                onChange={(e) => setProfileForm({ ...profileForm, birthNotes: e.target.value })}
                maxLength={1000}
              />
            </Field>

            <div className="row wrap" style={{ gap: '0.6rem' }}>
              <button className="btn primary small" disabled={profileSaving}>
                {profileSaving ? 'Saving…' : 'Save Birth Profile'}
              </button>
              <button type="button" className="btn small" onClick={() => setEditingProfile(false)} disabled={profileSaving}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Immunization Progress Header */}
      <div
        className="card"
        style={{
          background: 'var(--surface)',
          borderLeft: '4px solid #6366f1',
          padding: '1rem 1.25rem',
        }}
      >
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>💉 National Pediatric Immunization Schedule</span>
              <span className="badge ok">{pct}% Immunized</span>
            </h3>
            <div className="muted small" style={{ marginTop: '0.35rem' }}>
              <span>
                {data.summary.givenCount} given, {data.summary.pendingCount} pending, {data.summary.overdueCount} overdue (of {data.summary.totalVaccines - data.summary.exemptCount} total)
              </span>
            </div>
          </div>

          <div style={{ minWidth: '220px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
              <span>Vaccination Progress</span>
              <strong>{pct}%</strong>
            </div>
            <div style={{ height: '10px', width: '100%', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: pct === 100 ? '#16a34a' : '#6366f1',
                  borderRadius: '999px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        </div>

        {data.summary.overdueCount > 0 && (
          <div className="banner warn" style={{ marginTop: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <div>
              <strong>{data.summary.overdueCount} {data.summary.overdueCount === 1 ? 'Vaccine Overdue' : 'Vaccines Overdue'}: </strong>
              <span>
                {data.vaccinations
                  .filter((v) => v.isOverdue)
                  .map((v) => v.vaccineName)
                  .join(', ')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Milestone Filter Tabs */}
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="quick-meds-tabs" role="tablist">
          <button
            type="button"
            className={activeTab === 'all' ? 'active' : ''}
            onClick={() => setActiveTab('all')}
          >
            All Milestones ({data.vaccinations.length})
          </button>
          {MILESTONE_ORDER.map((m) => {
            const count = data.vaccinations.filter((v) => v.milestone === m).length;
            const given = data.vaccinations.filter((v) => v.milestone === m && v.status === 'given').length;
            const hasOverdue = data.vaccinations.some((v) => v.milestone === m && v.isOverdue);
            return (
              <button
                key={m}
                type="button"
                className={activeTab === m ? 'active' : ''}
                onClick={() => setActiveTab(m)}
              >
                {MILESTONE_LABELS[m]} {hasOverdue ? '⚠️' : ''} ({given}/{count})
              </button>
            );
          })}
        </div>

        <div className="muted small">
          Showing {filteredVaccines.length} vaccines
        </div>
      </div>

      {/* Vaccine Cards Grouped by Milestone */}
      {MILESTONE_ORDER.filter((m) => activeTab === 'all' || activeTab === m).map((m) => {
        const vaxList = data.vaccinations.filter((v) => v.milestone === m);
        if (vaxList.length === 0) return null;

        return (
          <div key={m} className="card stack" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0 }}>Milestone: {MILESTONE_LABELS[m]}</h4>
                <span className="muted small">
                  {vaxList.filter((v) => v.status === 'given').length} / {vaxList.length} administered
                </span>
              </div>
            </div>

            <div className="stack" style={{ gap: '0.75rem' }}>
              {vaxList.map((v) => {
                const isEditing = editingVaccineKey === v.vaccineKey;

                return (
                  <div
                    key={v.vaccineKey}
                    className="rx-item"
                    style={{
                      background: isEditing ? 'var(--bg)' : 'var(--surface)',
                      borderLeft:
                        v.status === 'given'
                          ? '4px solid #16a34a'
                          : v.isOverdue
                          ? '4px solid #b3261e'
                          : v.status === 'scheduled'
                          ? '4px solid #0284c7'
                          : '1px solid var(--border)',
                    }}
                  >
                    <div className="rx-head">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong>{v.vaccineName}</strong>
                        <span className="badge small" style={{ background: 'transparent' }}>
                          📅 {v.recommendedAge}
                        </span>
                        {v.dueDate && (
                          <span className="muted small">
                            Due: {v.dueDate}
                          </span>
                        )}
                        {v.status === 'given' && (
                          <span className="badge ok small">✓ Administered</span>
                        )}
                        {v.status === 'scheduled' && (
                          <span className="badge info small">⏳ Scheduled</span>
                        )}
                        {v.status === 'pending' && v.isOverdue && (
                          <span className="badge danger small">⚠️ Overdue</span>
                        )}
                        {v.status === 'pending' && !v.isOverdue && (
                          <span className="badge warn small">○ Pending</span>
                        )}
                        {v.status === 'exempt' && (
                          <span className="badge small">✕ Exempt</span>
                        )}
                      </div>

                      {canEdit && !isEditing && (
                        <div className="row" style={{ gap: '0.4rem' }}>
                          {v.status !== 'given' && (
                            <button
                              type="button"
                              className="chip-btn pill-add"
                              onClick={() => quickMarkGiven(v)}
                              title="Mark given today"
                            >
                              ✓ Given today
                            </button>
                          )}
                          {v.status !== 'given' && (
                            <button
                              type="button"
                              className="btn small"
                              onClick={() => setCommVaccine(v)}
                              title="Send vaccine reminder to parent via WhatsApp or SMS"
                            >
                              💬 Remind Parent
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => startEditVaccine(v)}
                          >
                            Edit details
                          </button>
                        </div>
                      )}
                    </div>

                    {!isEditing ? (
                      <div className="stack" style={{ gap: '0.35rem', fontSize: '0.9rem' }}>
                        <div className="muted small">
                          <strong>Prevents:</strong> {v.targetDisease} · <strong>Route:</strong> {v.standardRoute} · <strong>Dose:</strong> {v.standardDose}
                        </div>

                        {v.status === 'given' && (
                          <div
                            style={{
                              background: 'var(--bg)',
                              padding: '0.4rem 0.75rem',
                              borderRadius: 'var(--radius)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            <strong>Administered: </strong>
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>
                              {v.givenDate ?? 'Date recorded'}
                            </span>
                            {v.batchNumber && (
                              <span className="muted small" style={{ marginLeft: '0.75rem' }}>
                                (Batch: <code>{v.batchNumber}</code>)
                              </span>
                            )}
                            {v.administeredBy && (
                              <span className="muted small" style={{ marginLeft: '0.75rem' }}>
                                by {v.administeredBy}
                              </span>
                            )}
                          </div>
                        )}

                        {v.attachmentId && (
                          <div className="row" style={{ alignItems: 'center', gap: '0.4rem' }}>
                            <span>📎 Immunization Card / Certificate:</span>
                            <a
                              href={`/api/attachments/${v.attachmentId}/file`}
                              target="_blank"
                              rel="noreferrer"
                              className="badge info small"
                              style={{ textDecoration: 'none' }}
                            >
                              📄 {v.attachmentTitle ?? 'View Document'}
                            </a>
                          </div>
                        )}

                        {v.notes && (
                          <div className="muted small" style={{ fontStyle: 'italic' }}>
                            Notes: {v.notes}
                          </div>
                        )}
                      </div>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void saveVaccine(v.vaccineKey);
                        }}
                        className="stack"
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.75rem',
                          border: '1px dashed var(--border)',
                          borderRadius: 'var(--radius)',
                        }}
                      >
                        <ErrorBanner error={vaxError} />
                        <div className="grid2">
                          <Field label="Vaccination Status">
                            <select
                              value={vaxStatus}
                              onChange={(e) => setVaxStatus(e.target.value as VaccineStatus)}
                            >
                              <option value="given">Administered / Given</option>
                              <option value="pending">Pending</option>
                              <option value="scheduled">Scheduled</option>
                              <option value="delayed">Delayed / Postponed</option>
                              <option value="exempt">Exempt / Contraindicated</option>
                            </select>
                          </Field>

                          <Field label="Date Administered">
                            <input
                              type="date"
                              max={todayLocal()}
                              value={vaxDate}
                              onChange={(e) => setVaxDate(e.target.value)}
                            />
                          </Field>
                        </div>

                        <div className="grid2">
                          <Field label="Batch Number / Lot">
                            <input
                              placeholder="e.g. BCG-2026-X4"
                              value={vaxBatch}
                              onChange={(e) => setVaxBatch(e.target.value)}
                              maxLength={100}
                            />
                          </Field>

                          <Field label="Route & Injection Site">
                            <input
                              value={vaxRoute}
                              placeholder="e.g. Left upper arm ID"
                              onChange={(e) => setVaxRoute(e.target.value)}
                              maxLength={100}
                            />
                          </Field>
                        </div>

                        <div className="grid2">
                          <Field label="Administered By (Staff / Centre)">
                            <input
                              value={vaxAdmin}
                              placeholder="Staff name or hospital"
                              onChange={(e) => setVaxAdmin(e.target.value)}
                              maxLength={120}
                            />
                          </Field>

                          <Field label="Link Uploaded Certificate / Card">
                            <select
                              value={vaxAttachmentId ?? ''}
                              onChange={(e) =>
                                setVaxAttachmentId(e.target.value ? Number(e.target.value) : null)
                              }
                            >
                              <option value="">— None linked —</option>
                              {attachments.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.documentDate} · {a.title} ({a.originalName})
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>

                        <Field label="Notes / Observations">
                          <input
                            value={vaxNotes}
                            placeholder="e.g. Given without immediate adverse reaction; fever advice provided"
                            onChange={(e) => setVaxNotes(e.target.value)}
                            maxLength={500}
                          />
                        </Field>

                        <div className="row wrap" style={{ gap: '0.6rem', marginTop: '0.4rem' }}>
                          <button className="btn primary small" disabled={vaxSaving}>
                            {vaxSaving ? 'Saving…' : 'Save Vaccine Record'}
                          </button>
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => setEditingVaccineKey(null)}
                            disabled={vaxSaving}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {commVaccine && data && (
        <CommunicationModal
          open={true}
          onClose={() => setCommVaccine(null)}
          patientId={data.patientId}
          patientName={data.patientName}
          patientPhone={data.phone}
          defaultType="vaccination"
          vaccineData={{
            childName: data.patientName,
            parentName: data.parentName ?? undefined,
            vaccineName: commVaccine.vaccineName,
            dueAge: commVaccine.recommendedAge,
            dueDate: commVaccine.dueDate ?? undefined,
          }}
        />
      )}
    </div>
  );
}
