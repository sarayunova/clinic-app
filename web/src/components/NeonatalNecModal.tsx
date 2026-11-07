import React, { useState, useEffect } from 'react';
import { calculateNeonatalNec, createNeonatalNecEpisode } from '../api';

interface Props {
  patientId: number;
  gestationalAgeWeeks?: number;
  birthWeightGrams?: number;
  onClose: () => void;
  onSaved: () => void;
}

export const NeonatalNecModal: React.FC<Props> = ({
  patientId,
  gestationalAgeWeeks = 30,
  birthWeightGrams = 1400,
  onClose,
  onSaved,
}) => {
  const [gestAge, setGestAge] = useState(gestationalAgeWeeks);
  const [birthWeight, setBirthWeight] = useState(birthWeightGrams);
  const [currWeight, setCurrWeight] = useState(birthWeightGrams);
  const [onsetDatetime, setOnsetDatetime] = useState(new Date().toISOString().slice(0, 16));

  // Systemic signs
  const [tempInstability, setTempInstability] = useState(false);
  const [apneaBrady, setApneaBrady] = useState(false);
  const [lethargy, setLethargy] = useState(false);
  const [hypotension, setHypotension] = useState(false);

  // Intestinal signs
  const [residualsPct, setResidualsPct] = useState(30);
  const [distension, setDistension] = useState(true);
  const [biliousAspirate, setBiliousAspirate] = useState(false);
  const [hemeStool, setHemeStool] = useState(false);
  const [hematochezia, setHematochezia] = useState(false);
  const [absentBowelSounds, setAbsentBowelSounds] = useState(false);
  const [wallErythema, setWallErythema] = useState(false);

  // Radiological signs
  const [pneumatosis, setPneumatosis] = useState(true);
  const [portalVenousGas, setPortalVenousGas] = useState(false);
  const [ascites, setAscites] = useState(false);
  const [pneumoperitoneum, setPneumoperitoneum] = useState(false);

  // Labs
  const [abgPh, setAbgPh] = useState<number | ''>(7.28);
  const [plateletCount, setPlateletCount] = useState<number | ''>(95000);
  const [lactate, setLactate] = useState<number | ''>(2.8);

  // Management
  const [surgicalConsult, setSurgicalConsult] = useState('consulted_medical_management');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    void calculateNeonatalNec({
      gestationalAgeWeeks: gestAge,
      birthWeightGrams: birthWeight,
      currentWeightGrams: currWeight,
      temperatureInstability: tempInstability,
      apneaBradycardia: apneaBrady,
      lethargyHypotonia: lethargy,
      hypotensionShock: hypotension,
      gastricResidualsPercent: residualsPct,
      abdominalDistension: distension,
      biliousEmesisOrAspirate: biliousAspirate,
      hemePositiveStool: hemeStool,
      grossHematochezia: hematochezia,
      absentBowelSounds: absentBowelSounds,
      abdominalWallErythemaOrInduration: wallErythema,
      radiographicPneumatosis: pneumatosis,
      radiographicPortalVenousGas: portalVenousGas,
      radiographicAscites: ascites,
      radiographicPneumoperitoneum: pneumoperitoneum,
      abgPh: abgPh === '' ? undefined : Number(abgPh),
      plateletCount: plateletCount === '' ? undefined : Number(plateletCount),
      serumLactateMmolL: lactate === '' ? undefined : Number(lactate),
    }).then((res) => setPreview(res.evalResult));
  }, [
    gestAge,
    birthWeight,
    currWeight,
    tempInstability,
    apneaBrady,
    lethargy,
    hypotension,
    residualsPct,
    distension,
    biliousAspirate,
    hemeStool,
    hematochezia,
    absentBowelSounds,
    wallErythema,
    pneumatosis,
    portalVenousGas,
    ascites,
    pneumoperitoneum,
    abgPh,
    plateletCount,
    lactate,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createNeonatalNecEpisode({
        patientId,
        onsetDatetime,
        gestationalAgeWeeks: gestAge,
        birthWeightGrams: birthWeight,
        currentWeightGrams: currWeight,
        temperatureInstability: tempInstability,
        apneaBradycardia: apneaBrady,
        lethargyHypotonia: lethargy,
        hypotensionShock: hypotension,
        gastricResidualsPercent: residualsPct,
        abdominalDistension: distension,
        biliousEmesisOrAspirate: biliousAspirate,
        hemePositiveStool: hemeStool,
        grossHematochezia: hematochezia,
        absentBowelSounds: absentBowelSounds,
        abdominalWallErythemaOrInduration: wallErythema,
        radiographicPneumatosis: pneumatosis,
        radiographicPortalVenousGas: portalVenousGas,
        radiographicAscites: ascites,
        radiographicPneumoperitoneum: pneumoperitoneum,
        abgPh: abgPh === '' ? null : Number(abgPh),
        plateletCount: plateletCount === '' ? null : Number(plateletCount),
        serumLactateMmolL: lactate === '' ? null : Number(lactate),
        surgicalConsultStatus: surgicalConsult,
        clinicalNotes: notes,
      });
      onSaved();
    } catch (err: any) {
      alert(err.message || 'Error saving NEC episode');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal large" style={{ maxWidth: '850px' }}>
        <h2>🫄 Neonatal NEC Staging & Surgical Protocol</h2>
        <p className="muted">Modified Bell Staging, Abdominal Decompression & Pediatric Surgical Decision Engine</p>

        <form onSubmit={handleSubmit}>
          <div className="grid col-3 gap-1">
            <div>
              <label>Gestational Age (weeks)</label>
              <input type="number" step="0.1" value={gestAge} onChange={(e) => setGestAge(parseFloat(e.target.value) || 0)} required />
            </div>
            <div>
              <label>Birth Weight (g)</label>
              <input type="number" value={birthWeight} onChange={(e) => setBirthWeight(parseInt(e.target.value, 10) || 0)} required />
            </div>
            <div>
              <label>Current Weight (g)</label>
              <input type="number" value={currWeight} onChange={(e) => setCurrWeight(parseInt(e.target.value, 10) || 0)} required />
            </div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <label>Onset Datetime</label>
            <input type="datetime-local" value={onsetDatetime} onChange={(e) => setOnsetDatetime(e.target.value)} required />
          </div>

          <fieldset style={{ marginTop: '0.75rem', padding: '0.75rem' }}>
            <legend><strong>Systemic & Intestinal Findings</strong></legend>
            <div className="grid col-2 gap-1">
              <div>
                <label className="checkbox"><input type="checkbox" checked={tempInstability} onChange={(e) => setTempInstability(e.target.checked)} /> Temperature Instability</label>
                <label className="checkbox"><input type="checkbox" checked={apneaBrady} onChange={(e) => setApneaBrady(e.target.checked)} /> Apnea / Bradycardia</label>
                <label className="checkbox"><input type="checkbox" checked={lethargy} onChange={(e) => setLethargy(e.target.checked)} /> Lethargy / Hypotonia</label>
                <label className="checkbox"><input type="checkbox" checked={hypotension} onChange={(e) => setHypotension(e.target.checked)} /> Hypotension / Shock</label>
              </div>
              <div>
                <label className="checkbox"><input type="checkbox" checked={distension} onChange={(e) => setDistension(e.target.checked)} /> Abdominal Distension</label>
                <label className="checkbox"><input type="checkbox" checked={biliousAspirate} onChange={(e) => setBiliousAspirate(e.target.checked)} /> Bilious Aspirate / Vomiting</label>
                <label className="checkbox"><input type="checkbox" checked={hemeStool} onChange={(e) => setHemeStool(e.target.checked)} /> Heme-Positive Stool</label>
                <label className="checkbox"><input type="checkbox" checked={hematochezia} onChange={(e) => setHematochezia(e.target.checked)} /> Gross Hematochezia</label>
                <label className="checkbox"><input type="checkbox" checked={absentBowelSounds} onChange={(e) => setAbsentBowelSounds(e.target.checked)} /> Absent Bowel Sounds (Ileus)</label>
                <label className="checkbox"><input type="checkbox" checked={wallErythema} onChange={(e) => setWallErythema(e.target.checked)} /> Abdominal Wall Erythema / Induration</label>
              </div>
            </div>
          </fieldset>

          <fieldset style={{ marginTop: '0.75rem', padding: '0.75rem', border: '1px solid #c97a7e' }}>
            <legend><strong>Radiological Hallmark Signs (KUB / Decubitus)</strong></legend>
            <div className="grid col-2 gap-1">
              <label className="checkbox"><input type="checkbox" checked={pneumatosis} onChange={(e) => setPneumatosis(e.target.checked)} /> <strong>Pneumatosis Intestinalis</strong> (Pathognomonic Stage II)</label>
              <label className="checkbox"><input type="checkbox" checked={portalVenousGas} onChange={(e) => setPortalVenousGas(e.target.checked)} /> <strong>Portal Venous Gas</strong> (Branching liver gas)</label>
              <label className="checkbox"><input type="checkbox" checked={ascites} onChange={(e) => setAscites(e.target.checked)} /> Peritoneal Fluid / Ascites</label>
              <label className="checkbox" style={{ color: '#d9534f' }}><input type="checkbox" checked={pneumoperitoneum} onChange={(e) => setPneumoperitoneum(e.target.checked)} /> 🚨 <strong>Pneumoperitoneum</strong> (Free air under diaphragm / Perforation)</label>
            </div>
          </fieldset>

          <div className="grid col-3 gap-1" style={{ marginTop: '0.75rem' }}>
            <div>
              <label>ABG pH</label>
              <input type="number" step="0.01" value={abgPh} onChange={(e) => setAbgPh(e.target.value === '' ? '' : parseFloat(e.target.value))} />
            </div>
            <div>
              <label>Platelets (/uL)</label>
              <input type="number" value={plateletCount} onChange={(e) => setPlateletCount(e.target.value === '' ? '' : parseInt(e.target.value, 10))} />
            </div>
            <div>
              <label>Serum Lactate (mmol/L)</label>
              <input type="number" step="0.1" value={lactate} onChange={(e) => setLactate(e.target.value === '' ? '' : parseFloat(e.target.value))} />
            </div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <label>Pediatric Surgical Consult Status</label>
            <select value={surgicalConsult} onChange={(e) => setSurgicalConsult(e.target.value)}>
              <option value="not_consulted">Not Consulted</option>
              <option value="consulted_medical_management">Consulted - Medical Management & Joint Rounds</option>
              <option value="bedside_peritoneal_drain_placed">Bedside Peritoneal Drain Placed (VLBW Infant)</option>
              <option value="exploratory_laparotomy_performed">Exploratory Laparotomy / Resection Performed</option>
            </select>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <label>Clinical Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Decompression tube caliber, antibiotic start time, surgical comments..." />
          </div>

          {preview && (
            <div className={`banner ${preview.surgicalInterventionIndicated ? 'danger' : preview.severityTier === 'definite' ? 'warn' : 'info'}`} style={{ marginTop: '1rem' }}>
              <h4>{preview.bellStageTitle}</h4>
              <p><strong>NPO Duration:</strong> Strict bowel rest for {preview.recommendedNpoDaysMin}–{preview.recommendedNpoDaysMax} days.</p>
              <p><strong>Empiric Antimicrobial Regimen:</strong> {preview.recommendedAntibiotics.join(' + ')}</p>
              <p><strong>Decompression Plan:</strong> {preview.decompressionPlan}</p>
              {preview.clinicalAlerts.map((a: string, i: number) => (
                <div key={i} style={{ color: '#d9534f', fontWeight: 'bold', marginTop: '0.25rem' }}>⚠️ {a}</div>
              ))}
            </div>
          )}

          <div className="actions" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving...' : 'Save NEC Episode'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
