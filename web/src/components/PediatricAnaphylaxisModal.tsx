import React, { useState, useEffect } from 'react';
import { createPediatricAnaphylaxisEpisode, calculatePediatricAnaphylaxis } from '../api';

interface PediatricAnaphylaxisModalProps {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const PediatricAnaphylaxisModal: React.FC<PediatricAnaphylaxisModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [triageDatetime, setTriageDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [ageMonths, setAgeMonths] = useState(48);
  const [weightKg, setWeightKg] = useState(16.5);
  const [triggerType, setTriggerType] = useState<string>('food_peanut_nut_milk_egg');
  const [triggerDetails, setTriggerDetails] = useState('Accidental ingestion of peanut-containing cookie at daycare.');

  // Manifestations
  const [skinMucosalInvolvement, setSkinMucosalInvolvement] = useState(true);
  const [respiratoryCompromise, setRespiratoryCompromise] = useState(true);
  const [cardiovascularHypotension, setCardiovascularHypotension] = useState(false);
  const [persistentGastrointestinal, setPersistentGastrointestinal] = useState(true);

  // Doses
  const [imEpinephrineDosesGiven, setImEpinephrineDosesGiven] = useState(1);
  const [epinephrineFirstDoseDatetime, setEpinephrineFirstDoseDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [epinephrineSecondDoseDatetime, setEpinephrineSecondDoseDatetime] = useState('');

  // Refractory & Advanced
  const [refractoryShockDeclared, setRefractoryShockDeclared] = useState(false);
  const [ivEpinephrineInfusionActive, setIvEpinephrineInfusionActive] = useState(false);
  const [epinephrineInfusionRateMcgKgMin, setEpinephrineInfusionRateMcgKgMin] = useState<number | ''>('');
  const [secondLineH1AntihistamineGiven, setSecondLineH1AntihistamineGiven] = useState(true);
  const [secondLineH2AntihistamineGiven, setSecondLineH2AntihistamineGiven] = useState(true);
  const [systemicSteroidGiven, setSystemicSteroidGiven] = useState(true);
  const [glucagonAdministered, setGlucagonAdministered] = useState(false);
  const [fluidBolusVolumeMl, setFluidBolusVolumeMl] = useState(330);
  const [status, setStatus] = useState('acute_resuscitation_bay');
  const [clinicalNotes, setClinicalNotes] = useState('Child developed generalized urticaria, perioral angioedema, and stridor within 15 minutes of peanut ingestion. IM Epinephrine given immediately.');

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live calculation preview
  useEffect(() => {
    calculatePediatricAnaphylaxis({
      ageMonths,
      weightKg,
      triggerType,
      triggerDetails,
      skinMucosalInvolvement,
      respiratoryCompromise,
      cardiovascularHypotension,
      persistentGastrointestinal,
      imEpinephrineDosesGiven,
    })
      .then((res) => {
        setPreview(res.evalResult);
        if (res.evalResult.fluidBolusVolumeMl) {
          setFluidBolusVolumeMl(res.evalResult.fluidBolusVolumeMl);
        }
      })
      .catch(() => {});
  }, [
    ageMonths,
    weightKg,
    triggerType,
    triggerDetails,
    skinMucosalInvolvement,
    respiratoryCompromise,
    cardiovascularHypotension,
    persistentGastrointestinal,
    imEpinephrineDosesGiven,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createPediatricAnaphylaxisEpisode({
        patientId,
        triageDatetime,
        ageMonths: Number(ageMonths),
        weightKg: Number(weightKg),
        triggerType,
        triggerDetails: triggerDetails || null,
        skinMucosalInvolvement,
        respiratoryCompromise,
        cardiovascularHypotension,
        persistentGastrointestinal,
        imEpinephrineDosesGiven: Number(imEpinephrineDosesGiven),
        epinephrineFirstDoseDatetime,
        epinephrineSecondDoseDatetime: epinephrineSecondDoseDatetime || null,
        refractoryShockDeclared,
        ivEpinephrineInfusionActive,
        epinephrineInfusionRateMcgKgMin: epinephrineInfusionRateMcgKgMin === '' ? null : Number(epinephrineInfusionRateMcgKgMin),
        secondLineH1AntihistamineGiven,
        secondLineH2AntihistamineGiven,
        systemicSteroidGiven,
        glucagonAdministered,
        fluidBolusVolumeMl: Number(fluidBolusVolumeMl),
        status,
        clinicalNotes: clinicalNotes || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to record pediatric anaphylaxis episode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="modal-card" style={{ background: '#fff', borderRadius: 8, maxWidth: 840, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
          <div>
            <h3 style={{ margin: 0, color: '#dc2626' }}>🚨 Pediatric Anaphylaxis Emergency Resuscitation</h3>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              WAO 2020 / EAACI Protocol: Weight-Adjusted IM Epinephrine & Biphasic Surveillance for {patientName}
            </span>
          </div>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Section 1: Triage & Demographics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Triage Datetime</label>
              <input type="datetime-local" className="form-control" value={triageDatetime} onChange={(e) => setTriageDatetime(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Age (months)</label>
              <input type="number" className="form-control" value={ageMonths} onChange={(e) => setAgeMonths(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Body Weight (kg)</label>
              <input type="number" step="0.5" className="form-control" value={weightKg} onChange={(e) => setWeightKg(Number(e.target.value))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Trigger Category</label>
              <select className="form-control" value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
                <option value="food_peanut_nut_milk_egg">Food (Peanut / Tree Nut / Milk / Egg)</option>
                <option value="insect_venom_bee_wasp">Insect Venom (Bee / Wasp / Ant)</option>
                <option value="medication_antibiotic_nsaid">Medication (Beta-Lactam / NSAID)</option>
                <option value="vaccine_biologic">Vaccine / Biologic</option>
                <option value="latex">Natural Rubber Latex</option>
                <option value="exercise_or_cold">Exercise / Cold / Temperature</option>
                <option value="idiopathic">Idiopathic</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Trigger Details & Allergen Exposure</label>
            <input type="text" className="form-control" value={triggerDetails} onChange={(e) => setTriggerDetails(e.target.value)} placeholder="e.g. Ingestion of peanut butter at lunch" />
          </div>

          {/* Section 2: WAO Multi-System Involvement */}
          <div style={{ background: '#fef2f2', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #fca5a5' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#b91c1c', fontSize: '0.9rem' }}>WAO Multi-System Diagnostic Manifestations</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, fontSize: '0.85rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <input type="checkbox" checked={skinMucosalInvolvement} onChange={(e) => setSkinMucosalInvolvement(e.target.checked)} />
                <div>
                  <strong>Cutaneo-Mucosal Signs:</strong>
                  <div style={{ fontSize: '0.78rem', color: '#666' }}>Generalized hives, pruritus, flushing, swollen lips/tongue/uvula</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <input type="checkbox" checked={respiratoryCompromise} onChange={(e) => setRespiratoryCompromise(e.target.checked)} />
                <div>
                  <strong>Respiratory Compromise:</strong>
                  <div style={{ fontSize: '0.78rem', color: '#666' }}>Dyspnea, inspiratory stridor, wheezing, bronchospasm, SpO2 &lt; 92%</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <input type="checkbox" checked={cardiovascularHypotension} onChange={(e) => setCardiovascularHypotension(e.target.checked)} />
                <div>
                  <strong>Circulatory / Hypotension:</strong>
                  <div style={{ fontSize: '0.78rem', color: '#666' }}>Hypotension for age, collapse, syncope, incontinence, capillary refill &gt; 3s</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <input type="checkbox" checked={persistentGastrointestinal} onChange={(e) => setPersistentGastrointestinal(e.target.checked)} />
                <div>
                  <strong>Persistent Gastrointestinal:</strong>
                  <div style={{ fontSize: '0.78rem', color: '#666' }}>Severe crampy abdominal pain, repetitive vomiting</div>
                </div>
              </label>
            </div>
          </div>

          {/* Section 3: Epinephrine Dosing & Delivery */}
          <div style={{ background: '#eff6ff', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #bfdbfe' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#1e40af', fontSize: '0.9rem' }}>Intramuscular Epinephrine Administration</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>IM Epinephrine Doses Given</label>
                <select className="form-control" value={imEpinephrineDosesGiven} onChange={(e) => setImEpinephrineDosesGiven(Number(e.target.value))}>
                  <option value={1}>1 Dose (Initial Dose Given)</option>
                  <option value={2}>2 Doses (Repeat Dose Given)</option>
                  <option value={3}>3 Doses (Escalated Dose Given)</option>
                  <option value={4}>&gt;= 4 Doses (Refractory)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>1st Dose Datetime</label>
                <input type="datetime-local" className="form-control" value={epinephrineFirstDoseDatetime} onChange={(e) => setEpinephrineFirstDoseDatetime(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>2nd Dose Datetime</label>
                <input type="datetime-local" className="form-control" value={epinephrineSecondDoseDatetime} onChange={(e) => setEpinephrineSecondDoseDatetime(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Fluid Bolus (mL)</label>
                <input type="number" className="form-control" value={fluidBolusVolumeMl} onChange={(e) => setFluidBolusVolumeMl(Number(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Real-time Calculation Card */}
          {preview && (
            <div style={{ background: preview.refractoryShockDeclared ? '#fee2e2' : '#f0fdf4', border: `1px solid ${preview.refractoryShockDeclared ? '#ef4444' : '#86efac'}`, padding: 12, borderRadius: 6, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: preview.refractoryShockDeclared ? '#991b1b' : '#166534', fontSize: '0.95rem' }}>
                  {preview.severityLabel}
                </strong>
                <span className={`badge ${preview.anaphylaxisCriteriaMet ? 'badge-danger' : 'badge-secondary'}`}>
                  {preview.anaphylaxisCriteriaMet ? 'ANAPHYLAXIS CONFIRMED' : 'CRITERIA NOT MET'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8, fontSize: '0.85rem' }}>
                <div><strong>IM Epinephrine (0.01 mg/kg):</strong> {preview.epinephrineImDoseMg} mg ({preview.epinephrineImVolumeMl} mL of 1:1,000)</div>
                <div><strong>Delivery Device:</strong> {preview.autoinjectorLabel}</div>
                <div><strong>Repeat Timing:</strong> Every {preview.repeatDoseIntervalMinutes}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 6, fontSize: '0.82rem', color: '#444' }}>
                <div><strong>Diphenhydramine IV:</strong> {preview.h1AntihistamineDoseMg} mg</div>
                <div><strong>Famotidine IV:</strong> {preview.h2AntagonistDoseMg} mg</div>
                <div><strong>Methylprednisolone IV:</strong> {preview.methylprednisoloneDoseMg} mg</div>
              </div>
              {preview.refractoryShockDeclared && (
                <div className="alert alert-danger" style={{ margin: '8px 0 0 0', padding: 6, fontSize: '0.82rem' }}>
                  🚨 REFRACTORY SHOCK PROTOCOL: Initiate IV Epinephrine infusion at 0.1 mcg/kg/min titrating up to 1.0 mcg/kg/min; infuse 20 mL/kg fluid bolus ({preview.fluidBolusVolumeMl} mL); prepare ICU transfer.
                </div>
              )}
            </div>
          )}

          {/* Section 4: Refractory & Adjunct Checkboxes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem' }}><input type="checkbox" checked={refractoryShockDeclared} onChange={(e) => setRefractoryShockDeclared(e.target.checked)} /> Refractory Shock Declared</label>
            <label style={{ fontSize: '0.8rem' }}><input type="checkbox" checked={ivEpinephrineInfusionActive} onChange={(e) => setIvEpinephrineInfusionActive(e.target.checked)} /> IV Epinephrine Infusion Running</label>
            <label style={{ fontSize: '0.8rem' }}><input type="checkbox" checked={secondLineH1AntihistamineGiven} onChange={(e) => setSecondLineH1AntihistamineGiven(e.target.checked)} /> H1-Antihistamine Given</label>
            <label style={{ fontSize: '0.8rem' }}><input type="checkbox" checked={systemicSteroidGiven} onChange={(e) => setSystemicSteroidGiven(e.target.checked)} /> Systemic Corticosteroid Given</label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>IV Epinephrine Rate (mcg/kg/min)</label>
              <input type="number" step="0.05" className="form-control" value={epinephrineInfusionRateMcgKgMin} onChange={(e) => setEpinephrineInfusionRateMcgKgMin(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 0.10" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Status</label>
              <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="acute_resuscitation_bay">Acute Resuscitation Bay</option>
                <option value="refractory_picu_infusion">Refractory PICU Infusion</option>
                <option value="biphasic_surveillance_observation">Biphasic Surveillance Observation</option>
                <option value="discharged_auto_injector_prescribed">Discharged (Autoinjector Prescribed)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Clinical Notes</label>
            <textarea className="form-control" rows={2} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Resuscitation Episode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
