import React, { useState, useEffect } from 'react';
import { createObstetricPpcmEpisode, calculateObstetricPpcm } from '../api';

interface ObstetricPpcmModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ObstetricPpcmModal: React.FC<ObstetricPpcmModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [presentationDatetime, setPresentationDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [timingCategory, setTimingCategory] = useState<string>('postpartum_first_month');
  const [maternalAge, setMaternalAge] = useState<number | ''>(31);
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number | ''>('');
  const [daysPostpartum, setDaysPostpartum] = useState<number | ''>(10);

  const [nyhaClass, setNyhaClass] = useState<string>('class_iii');
  const [lvefPercent, setLvefPercent] = useState(32.0);
  const [lveddMm, setLveddMm] = useState<number | ''>(58.0);
  const [ntProbnpPgMl, setNtProbnpPgMl] = useState<number | ''>(4850);
  const [troponinINgMl, setTroponinINgMl] = useState<number | ''>(0.07);
  const [pulmonaryEdemaPresent, setPulmonaryEdemaPresent] = useState(true);
  const [cardiogenicShockPresent, setCardiogenicShockPresent] = useState(false);

  const [bromocriptineRegimen, setBromocriptineRegimen] = useState<string>('intensive_2_5mg_bid_2weeks_then_daily_6weeks');
  const [bromocriptineInitiated, setBromocriptineInitiated] = useState(true);
  const [anticoagulationPrescribed, setAnticoagulationPrescribed] = useState(true);
  const [anticoagulationAgent, setAnticoagulationAgent] = useState<string>('lmwh_therapeutic');

  const [loopDiureticGiven, setLoopDiureticGiven] = useState(true);
  const [betaBlockerGiven, setBetaBlockerGiven] = useState(true);
  const [vasodilatorAgent, setVasodilatorAgent] = useState<string>('hydralazine_nitrates_pregnancy_safe');
  const [status, setStatus] = useState<string>('acute_decompensation');
  const [clinicalNotes, setClinicalNotes] = useState(
    'Postpartum day 10 presentation with acute pulmonary edema and severe orthopnea. Echo demonstrates LVEF 32% with LV dilation. Initiated intensive Bromocriptine and therapeutic LMWH under BOARD protocol.',
  );

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculateObstetricPpcm({
      timingCategory,
      maternalAge: maternalAge === '' ? undefined : Number(maternalAge),
      gestationalAgeWeeks: gestationalAgeWeeks === '' ? undefined : Number(gestationalAgeWeeks),
      daysPostpartum: daysPostpartum === '' ? undefined : Number(daysPostpartum),
      nyhaClass,
      lvefPercent: Number(lvefPercent),
      lveddMm: lveddMm === '' ? undefined : Number(lveddMm),
      ntProbnpPgMl: ntProbnpPgMl === '' ? undefined : Number(ntProbnpPgMl),
      troponinINgMl: troponinINgMl === '' ? undefined : Number(troponinINgMl),
      pulmonaryEdemaPresent,
      cardiogenicShockPresent,
      bromocriptineRegimen,
      bromocriptineInitiated,
      anticoagulationPrescribed,
      anticoagulationAgent,
      loopDiureticGiven,
      betaBlockerGiven,
      vasodilatorAgent,
    })
      .then((res) => {
        setPreview(res.evalResult);
        if (res.evalResult?.recommendedBromocriptineRegimen && bromocriptineRegimen === 'none') {
          setBromocriptineRegimen(res.evalResult.recommendedBromocriptineRegimen);
        }
      })
      .catch(() => {});
  }, [
    timingCategory,
    maternalAge,
    gestationalAgeWeeks,
    daysPostpartum,
    nyhaClass,
    lvefPercent,
    lveddMm,
    ntProbnpPgMl,
    troponinINgMl,
    pulmonaryEdemaPresent,
    cardiogenicShockPresent,
    bromocriptineRegimen,
    bromocriptineInitiated,
    anticoagulationPrescribed,
    anticoagulationAgent,
    loopDiureticGiven,
    betaBlockerGiven,
    vasodilatorAgent,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createObstetricPpcmEpisode({
        patientId,
        presentationDatetime: new Date(presentationDatetime).toISOString(),
        timingCategory,
        maternalAge: maternalAge === '' ? undefined : Number(maternalAge),
        gestationalAgeWeeks: gestationalAgeWeeks === '' ? undefined : Number(gestationalAgeWeeks),
        daysPostpartum: daysPostpartum === '' ? undefined : Number(daysPostpartum),
        nyhaClass,
        lvefPercent: Number(lvefPercent),
        lveddMm: lveddMm === '' ? undefined : Number(lveddMm),
        ntProbnpPgMl: ntProbnpPgMl === '' ? undefined : Number(ntProbnpPgMl),
        troponinINgMl: troponinINgMl === '' ? undefined : Number(troponinINgMl),
        pulmonaryEdemaPresent,
        cardiogenicShockPresent,
        bromocriptineRegimen,
        bromocriptineInitiated,
        anticoagulationPrescribed,
        anticoagulationAgent,
        loopDiureticGiven,
        betaBlockerGiven,
        vasodilatorAgent,
        status,
        clinicalNotes,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate obstetric PPCM episode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal card" style={{ maxWidth: 860, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#e11d48' }}>
            🫀 Obstetric Peripartum Cardiomyopathy (PPCM) Protocol
          </h2>
          <button className="button small" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Patient: <strong>{patientName}</strong> | Reference: ESC Heart Failure Guidelines &amp; BOARD Protocol
        </p>

        {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Timing & Patient Factors */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label>Presentation Datetime *</label>
              <input
                type="datetime-local"
                value={presentationDatetime}
                onChange={(e) => setPresentationDatetime(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Clinical Timing *</label>
              <select value={timingCategory} onChange={(e) => setTimingCategory(e.target.value)}>
                <option value="antepartum_late_third_trimester">Antepartum (Late 3rd Trimester)</option>
                <option value="postpartum_first_month">Postpartum (Month 1)</option>
                <option value="postpartum_months_2_to_5">Postpartum (Months 2 to 5)</option>
              </select>
            </div>
            <div>
              <label>Maternal Age (years)</label>
              <input
                type="number"
                min="14"
                max="55"
                value={maternalAge}
                onChange={(e) => setMaternalAge(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            {timingCategory === 'antepartum_late_third_trimester' ? (
              <div>
                <label>Gestational Age (weeks)</label>
                <input
                  type="number"
                  step="0.1"
                  min="24"
                  max="44"
                  value={gestationalAgeWeeks}
                  onChange={(e) => setGestationalAgeWeeks(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            ) : (
              <div>
                <label>Days Postpartum</label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={daysPostpartum}
                  onChange={(e) => setDaysPostpartum(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            )}
            <div>
              <label>NYHA Functional Class *</label>
              <select value={nyhaClass} onChange={(e) => setNyhaClass(e.target.value)}>
                <option value="class_i">Class I (No limitation)</option>
                <option value="class_ii">Class II (Slight limitation / dyspnea on exertion)</option>
                <option value="class_iii">Class III (Marked limitation / dyspnea on mild exertion)</option>
                <option value="class_iv">Class IV (Symptoms at rest / Orthopnea)</option>
              </select>
            </div>
            <div>
              <label>LV Ejection Fraction (%) *</label>
              <input
                type="number"
                step="0.5"
                min="5.0"
                max="65.0"
                value={lvefPercent}
                onChange={(e) => setLvefPercent(Number(e.target.value))}
                required
              />
            </div>
          </div>

          {/* Biomarkers & Hemodynamics */}
          <div className="card" style={{ background: '#fff1f2', border: '1px solid #fecdd3', padding: 12, marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#be123c' }}>
              Echocardiographic & Biomarker Diagnostics
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <label>LVEDD (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 58"
                  value={lveddMm}
                  onChange={(e) => setLveddMm(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <label>NT-proBNP (pg/mL)</label>
                <input
                  type="number"
                  placeholder="e.g. 4500"
                  value={ntProbnpPgMl}
                  onChange={(e) => setNtProbnpPgMl(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <label>Troponin I (ng/mL)</label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="e.g. 0.08"
                  value={troponinINgMl}
                  onChange={(e) => setTroponinINgMl(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={pulmonaryEdemaPresent}
                  onChange={(e) => setPulmonaryEdemaPresent(e.target.checked)}
                />
                <span>Acute Pulmonary Edema Present</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#be123c' }}>
                <input
                  type="checkbox"
                  checked={cardiogenicShockPresent}
                  onChange={(e) => setCardiogenicShockPresent(e.target.checked)}
                />
                <strong>Cardiogenic Shock (Inotrope Dependent)</strong>
              </label>
            </div>
          </div>

          {/* BOARD Protocol Pharmacotherapy */}
          <div className="card" style={{ background: '#f8fafc', padding: 12, marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#334155' }}>
              BOARD Protocol Pharmacotherapy & Safety Auditing
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
              <div>
                <label>Bromocriptine Prolactin Suppression Regimen</label>
                <select value={bromocriptineRegimen} onChange={(e) => setBromocriptineRegimen(e.target.value)}>
                  <option value="none">None / Deferred</option>
                  <option value="standard_2_5mg_daily_1week">Standard: 2.5 mg daily for 7 days</option>
                  <option value="intensive_2_5mg_bid_2weeks_then_daily_6weeks">
                    Intensive: 2.5 mg BID for 14d, then 2.5 mg daily for 42d
                  </option>
                </select>
              </div>
              <div>
                <label>Anticoagulation Agent (MANDATORY with Bromocriptine)</label>
                <select value={anticoagulationAgent} onChange={(e) => setAnticoagulationAgent(e.target.value)}>
                  <option value="none">None (WARNING: Prothrombotic Violation)</option>
                  <option value="lmwh_prophylactic">LMWH Prophylactic (Enoxaparin 40 mg daily)</option>
                  <option value="lmwh_therapeutic">LMWH Therapeutic (Enoxaparin 1 mg/kg q12h)</option>
                  <option value="warfarin_therapeutic_postpartum_only">Warfarin (INR 2-3, Postpartum ONLY)</option>
                  <option value="unfractionated_heparin">IV Unfractionated Heparin (ICU Titrated)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={bromocriptineInitiated}
                  onChange={(e) => setBromocriptineInitiated(e.target.checked)}
                />
                <span>Bromocriptine Initiated</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={anticoagulationPrescribed}
                  onChange={(e) => setAnticoagulationPrescribed(e.target.checked)}
                />
                <span>Anticoagulation Prescribed</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={loopDiureticGiven}
                  onChange={(e) => setLoopDiureticGiven(e.target.checked)}
                />
                <span>IV Loop Diuretic (Furosemide) Given</span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 12 }}>
              <div>
                <label>Vasodilator Selection</label>
                <select value={vasodilatorAgent} onChange={(e) => setVasodilatorAgent(e.target.value)}>
                  <option value="none">None</option>
                  <option value="hydralazine_nitrates_pregnancy_safe">Hydralazine + Oral Nitrates (Pregnancy Safe)</option>
                  <option value="acei_arb_arni_strictly_postpartum_non_lactating">
                    ACEi / ARB / ARNI (Strictly Postpartum &amp; Non-Lactating)
                  </option>
                  <option value="nitroprusside_icu_only">IV Sodium Nitroprusside (ICU Monitoring Only)</option>
                </select>
              </div>
              <div>
                <label>Episode Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="acute_decompensation">Acute Decompensation</option>
                  <option value="icu_mechanical_support">ICU / Mechanical Circulatory Support</option>
                  <option value="stabilized_on_board_protocol">Stabilized on BOARD Protocol</option>
                  <option value="recovered_ejection_fraction">Recovered Ejection Fraction (LVEF ≥ 50%)</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={betaBlockerGiven}
                  onChange={(e) => setBetaBlockerGiven(e.target.checked)}
                />
                <span>Beta-Blocker Prescribed (Metoprolol Succinate / Carvedilol)</span>
              </label>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>Clinical Notes & MDT Plan</label>
            <textarea
              rows={3}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Record echocardiogram measurements, cardiology consult, breastfeeding counseling, and delivery plan..."
            />
          </div>

          {/* Live Preview & Safety Alerts */}
          {preview && (
            <div
              className="card"
              style={{
                background: preview.lvefSeverityTier === 'severe_dysfunction_lt_35' ? '#fff1f2' : '#f0fdf4',
                border: `1px solid ${preview.lvefSeverityTier === 'severe_dysfunction_lt_35' ? '#fecdd3' : '#86efac'}`,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: preview.lvefSeverityTier === 'severe_dysfunction_lt_35' ? '#e11d48' : '#16a34a' }}>
                  {preview.lvefSeverityLabel}
                </strong>
                <span className="badge" style={{ background: '#be123c', color: '#fff' }}>
                  {preview.recommendedBromocriptineRegimen.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="small" style={{ margin: '6px 0' }}>
                {preview.bromocriptineRationale}
              </p>
              {preview.anticoagulationAuditDeficiency && (
                <div style={{ color: '#be123c', fontSize: 13, fontWeight: 'bold', marginTop: 4 }}>
                  🚨 CRITICAL SAFETY AUDIT ERROR: Bromocriptine carries significant thrombotic risk. Concomitant anticoagulation is MANDATORY!
                </div>
              )}
              {preview.deliveryPlanningGuidance && (
                <div style={{ color: '#0369a1', fontSize: 12, marginTop: 4 }}>
                  ℹ️ {preview.deliveryPlanningGuidance}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="button secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={loading}>
              {loading ? 'Saving...' : 'Initiate PPCM BOARD Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
