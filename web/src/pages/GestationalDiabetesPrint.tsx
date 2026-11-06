import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type { GdmProfile, GdmGlucoseLog, GdmFetalSurveillance, GdmProfileResponse, Patient } from '../api';
import { calculateGlycemicSummary, getGdmDeliveryAdvisory } from '../gdmEngine';

export function GestationalDiabetesPrint() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [profile, setProfile] = useState<GdmProfile | null>(null);
  const [logs, setLogs] = useState<GdmGlucoseLog[]>([]);
  const [surveillances, setSurveillances] = useState<GdmFetalSurveillance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch patient
        const ptRes = await fetch(`/api/patients/${id}`);
        if (!ptRes.ok) throw new Error('Failed to load patient');
        const ptData = await ptRes.json();
        setPatient(ptData.patient);

        // Fetch GDM profile
        const pRes = await fetch(`/api/patients/${id}/gdm/profile`);
        if (!pRes.ok) throw new Error('Failed to load GDM profile');
        const pData: GdmProfileResponse = await pRes.json();
        setProfile(pData.profile);

        // Fetch logs
        const lRes = await fetch(`/api/patients/${id}/gdm/logs?limit=200`);
        if (lRes.ok) {
          const lData = await lRes.json();
          setLogs(lData.logs || []);
        }

        // Fetch surveillance
        const sRes = await fetch(`/api/patients/${id}/gdm/surveillance`);
        if (sRes.ok) {
          const sData = await sRes.json();
          setSurveillances(sData.surveillance || []);
        }
      } catch (err: any) {
        setError(err.message || 'Error loading GDM report for printing');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchData();
  }, [id]);

  const summary = useMemo(() => {
    return calculateGlycemicSummary(logs);
  }, [logs]);

  const deliveryAdvisory = useMemo(() => {
    if (!profile) return '';
    const ctrl = summary.timeInRangePercent >= 75 ? 'good' : 'suboptimal';
    const latestSurv = surveillances[0];
    return getGdmDeliveryAdvisory(profile.white_classification, ctrl, latestSurv?.estimated_fetal_weight_g);
  }, [profile, summary, surveillances]);

  const getSlotLabel = (s: string) => {
    switch (s) {
      case 'fasting':
        return 'Fasting';
      case 'post_breakfast':
        return 'Post-Breakfast';
      case 'pre_lunch':
        return 'Pre-Lunch';
      case 'post_lunch':
        return 'Post-Lunch';
      case 'pre_dinner':
        return 'Pre-Dinner';
      case 'post_dinner':
        return 'Post-Dinner';
      case 'bedtime':
        return 'Bedtime';
      case '3_am_nocturnal':
        return '3 AM';
      default:
        return 'Random';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        Loading GDM glycemic monitoring report for printing...
      </div>
    );
  }

  if (error || !profile || !patient) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626', fontFamily: 'sans-serif' }}>
        {error || 'GDM Profile not found'}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b' }}>
      {/* Top Action Bar */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
        <button
          onClick={() => window.history.back()}
          style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          ← Back
        </button>
        <button
          onClick={() => window.print()}
          style={{ padding: '8px 20px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          🖨️ Print GDM Monitoring Chart
        </button>
      </div>

      {/* Hospital Letterhead */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '14px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', textTransform: 'uppercase', letterSpacing: '1px', color: '#0f172a' }}>
          MATERNAL-FETAL MEDICINE & OBSTETRIC CLINIC
        </h1>
        <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
          Department of Obstetrics, Gynecology & Antenatal Endocrinology
        </div>
        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#0369a1', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Gestational Diabetes Mellitus (GDM) & Glycemic Monitoring Chart
        </div>
      </div>

      {/* Patient & Antenatal Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', marginBottom: '16px' }}>
        <div>
          <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Patient Name</span>
          <strong style={{ fontSize: '13px' }}>{patient.fullName}</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>MRN / Phone</span>
          <strong>{patient.id} / {String(patient.phone || '—')}</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Obstetric Formula</span>
          <strong>G{Number(patient.gravida) || 0} P{Number(patient.para) || 0} L{Number(patient.living) || 0} A{Number(patient.abortions) || 0}</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Gestational Age / EDD</span>
          <strong>{profile.gestational_age_weeks ? `${profile.gestational_age_weeks}w` : '—'} | {String(patient.lastMenstrualPeriod || '—')}</strong>
        </div>
      </div>

      {/* Diagnostic & White's Classification Box */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', fontSize: '12px' }}>
          <div style={{ fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px', color: '#0f172a' }}>
            Diagnostic Assessment & White's Classification
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <div><b>Protocol:</b> <span style={{ textTransform: 'uppercase' }}>{profile.diagnostic_criteria.replace('_', ' ')}</span></div>
            <div><b>Diagnostic Date:</b> {profile.diagnostic_date}</div>
            <div><b>White Class:</b> <span style={{ textTransform: 'uppercase', color: '#4338ca', fontWeight: 'bold' }}>{profile.white_classification.replace('_', ' ')}</span></div>
            <div><b>Baseline HbA1c:</b> {profile.baseline_hba1c ? `${profile.baseline_hba1c}%` : '—'}</div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#475569', background: '#f1f5f9', padding: '6px', borderRadius: '4px' }}>
            {profile.ogtt_fasting_mg_dl ? `Fasting: ${profile.ogtt_fasting_mg_dl} mg/dL | ` : ''}
            {profile.ogtt_1hr_mg_dl ? `1-Hr: ${profile.ogtt_1hr_mg_dl} mg/dL | ` : ''}
            {profile.ogtt_2hr_mg_dl ? `2-Hr: ${profile.ogtt_2hr_mg_dl} mg/dL | ` : ''}
            {profile.ogtt_3hr_mg_dl ? `3-Hr: ${profile.ogtt_3hr_mg_dl} mg/dL` : ''}
          </div>
        </div>

        <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', fontSize: '12px' }}>
          <div style={{ fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px', color: '#0f172a' }}>
            Management Regimen & Glycemic Targets
          </div>
          <div style={{ marginBottom: '6px' }}>
            <b>Therapy:</b> <span style={{ textTransform: 'capitalize', fontWeight: 'bold', color: '#0369a1' }}>{profile.current_management.replace(/_/g, ' ')}</span>
            {profile.insulin_regimen_type !== 'none' && (
              <div style={{ fontSize: '11px', color: '#6b21a8', marginTop: '2px' }}>
                Pattern: {profile.insulin_regimen_type.replace(/_/g, ' ')}
                {profile.basal_units_night ? ` | Basal: ${profile.basal_units_night}u night` : ''}
                {profile.bolus_units_breakfast ? ` | Bolus: ${profile.bolus_units_breakfast}-${profile.bolus_units_lunch || 0}-${profile.bolus_units_dinner || 0}u` : ''}
              </div>
            )}
            {profile.metformin_dose_mg_day ? (
              <div style={{ fontSize: '11px', color: '#6b21a8' }}>Metformin: {profile.metformin_dose_mg_day} mg/day</div>
            ) : null}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px', color: '#334155' }}>
            <div>Target Fasting: <b>&le; {profile.target_fasting_mg_dl} mg/dL</b></div>
            <div>Target {profile.postprandial_window === '1_hour' ? '1-Hr' : '2-Hr'} Post-Meal: <b>&le; {profile.target_postprandial_mg_dl} mg/dL</b></div>
          </div>
        </div>
      </div>

      {/* Glycemic Metrics & Time In Range Summary */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '12px', marginBottom: '16px', fontSize: '12px' }}>
        <div style={{ fontWeight: 'bold', color: '#166534', marginBottom: '8px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
          Glycemic Profile & Time In Range (TIR) Metrics ({summary.totalReadings} readings recorded)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', textAlign: 'center' }}>
          <div>
            <span style={{ fontSize: '10px', color: '#4b5563', display: 'block' }}>Time In Range (TIR)</span>
            <strong style={{ fontSize: '16px', color: summary.timeInRangePercent >= 75 ? '#16a34a' : '#d97706' }}>
              {summary.timeInRangePercent}%
            </strong>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#4b5563', display: 'block' }}>Mean Blood Glucose</span>
            <strong style={{ fontSize: '16px', color: '#1e40af' }}>{summary.meanBloodGlucose || '—'} mg/dL</strong>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#4b5563', display: 'block' }}>Estimated HbA1c</span>
            <strong style={{ fontSize: '16px', color: '#6b21a8' }}>{summary.estimatedHbA1c ? `${summary.estimatedHbA1c}%` : '—'}</strong>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#4b5563', display: 'block' }}>Hyperglycemic Excursions</span>
            <strong style={{ fontSize: '16px', color: '#d97706' }}>{summary.excursionCount}</strong>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#4b5563', display: 'block' }}>Hypoglycemia Events</span>
            <strong style={{ fontSize: '16px', color: '#dc2626' }}>{summary.hypoglycemiaCount}</strong>
          </div>
        </div>
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#166534' }}>
          <b>Clinical Evaluation:</b> {summary.advisory}
        </div>
      </div>

      {/* Fetal Surveillance Snapshot */}
      {surveillances.length > 0 && surveillances[0] && (
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px 12px', marginBottom: '16px', fontSize: '12px' }}>
          <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '6px', textTransform: 'uppercase', fontSize: '11px' }}>
            Latest Fetal Macrosomia & Polyhydramnios Surveillance ({surveillances[0].assessment_date})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '11px' }}>
            <div>Fetal AC: <b>{surveillances[0].abdominal_circumference_mm || '—'} mm</b> ({surveillances[0].ac_percentile ? `${surveillances[0].ac_percentile}th centile` : '—'})</div>
            <div>EFW: <b>{surveillances[0].estimated_fetal_weight_g || '—'} g</b> ({surveillances[0].efw_percentile ? `${surveillances[0].efw_percentile}th centile` : '—'})</div>
            <div>AFI / SDP: <b>{surveillances[0].amniotic_fluid_index_cm || '—'} cm</b> / {surveillances[0].single_deepest_pocket_cm || '—'} cm</div>
            <div>Risk Category: <b style={{ textTransform: 'uppercase', color: surveillances[0].macrosomia_risk_flag === 'normal' ? '#16a34a' : '#d97706' }}>{surveillances[0].macrosomia_risk_flag.replace(/_/g, ' ')}</b></div>
          </div>
        </div>
      )}

      {/* Glucose Log Table */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', marginBottom: '6px', color: '#0f172a' }}>
          Multi-Point Capillary Blood Glucose Logbook
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
              <th style={{ padding: '6px 8px' }}>Date</th>
              <th style={{ padding: '6px 8px' }}>Time</th>
              <th style={{ padding: '6px 8px' }}>Meal Slot</th>
              <th style={{ padding: '6px 8px' }}>Blood Sugar</th>
              <th style={{ padding: '6px 8px' }}>Status</th>
              <th style={{ padding: '6px 8px' }}>Insulin Administered</th>
              <th style={{ padding: '6px 8px' }}>Symptoms / Food Notes</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>
                  No readings logged yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '5px 8px', fontWeight: 600 }}>{log.log_date}</td>
                  <td style={{ padding: '5px 8px', color: '#64748b' }}>{log.log_time}</td>
                  <td style={{ padding: '5px 8px' }}>{getSlotLabel(log.meal_slot)}</td>
                  <td style={{ padding: '5px 8px', fontWeight: 'bold', fontSize: '12px' }}>
                    {log.blood_glucose_mg_dl} mg/dL
                  </td>
                  <td style={{ padding: '5px 8px' }}>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                      background: log.target_status === 'in_target' ? '#dcfce7' : log.target_status.includes('hypo') ? '#fee2e2' : '#fef3c7',
                      color: log.target_status === 'in_target' ? '#15803d' : log.target_status.includes('hypo') ? '#b91c1c' : '#b45309',
                    }}>
                      {log.target_status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '5px 8px' }}>
                    {log.insulin_administered_units ? `${log.insulin_administered_units} units` : '—'}
                  </td>
                  <td style={{ padding: '5px 8px', color: '#475569' }}>
                    {log.symptoms ? `${log.symptoms}; ` : ''}
                    {log.carbs_consumed_estimate || log.notes || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delivery Planning & Physician Instructions */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', fontSize: '11px', marginBottom: '24px', background: '#f8fafc' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#0f172a' }}>Delivery Timing & Peripartum Glycemic Plan</div>
        <div>{deliveryAdvisory}</div>
        <div style={{ marginTop: '4px', color: '#64748b' }}>
          * Intrapartum Plan: Maintain maternal capillary glucose between 70–110 mg/dL during active labor. Stop subcutaneous morning insulin if planned induction; initiate Glucose-Insulin-Potassium (GIP) infusion if required.
        </div>
      </div>

      {/* Signature & Verification Block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #cbd5e1', fontSize: '12px' }}>
        <div>
          <div>Patient / Guardian Signature</div>
          <div style={{ marginTop: '30px', color: '#94a3b8' }}>____________________________</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>Consultant Obstetrician / Diabetologist</div>
          <div style={{ marginTop: '30px', color: '#94a3b8' }}>____________________________</div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>Reg. No. / Seal & Date</div>
        </div>
      </div>
    </div>
  );
}
