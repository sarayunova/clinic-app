import React, { useState } from 'react';
import { logPediatricAsthmaFlowsheet } from '../api';
import { calculateMwcas } from '../pediatricAsthmaStatusEngine';

interface Props {
  episodeId: number;
  lastRr?: number;
  lastHr?: number;
  lastSpo2?: number;
  lastAlbuterolRate?: number;
  onClose: () => void;
  onSaved: () => void;
}

export const PediatricAsthmaStatusFlowsheetModal: React.FC<Props> = ({
  episodeId,
  lastRr = 44,
  lastHr = 138,
  lastSpo2 = 93,
  lastAlbuterolRate = 8.0,
  onClose,
  onSaved,
}) => {
  const [logDatetime, setLogDatetime] = useState(new Date().toISOString().slice(0, 16));
  const [minutesFromTriage, setMinutesFromTriage] = useState(30);
  const [rr, setRr] = useState(lastRr);
  const [hr, setHr] = useState(lastHr);
  const [spo2, setSpo2] = useState(lastSpo2);
  const [fio2, setFio2] = useState(40);

  // M-WCAS Scores
  const [spo2Score, setSpo2Score] = useState(1);
  const [wheezingScore, setWheezingScore] = useState(1);
  const [retractionsScore, setRetractionsScore] = useState(1);
  const [airEntryScore, setAirEntryScore] = useState(1);
  const [mentalStateScore, setMentalStateScore] = useState(0);

  // Medications
  const [albuterolRate, setAlbuterolRate] = useState<number | ''>(lastAlbuterolRate);
  const [terbutalineRate, setTerbutalineRate] = useState<number | ''>('');
  const [bipapSettings, setBipapSettings] = useState('');
  const [vbgPh, setVbgPh] = useState<number | ''>('');
  const [vbgPco2, setVbgPco2] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const mwcas = calculateMwcas({
    spo2Score,
    wheezingScore,
    retractionsScore,
    airEntryScore,
    mentalStateScore,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await logPediatricAsthmaFlowsheet(episodeId, {
        logDatetime,
        minutesFromTriage: Number(minutesFromTriage),
        respiratoryRate: Number(rr),
        heartRate: Number(hr),
        spo2Percent: Number(spo2),
        fio2Percent: Number(fio2),
        spo2Score,
        wheezingScore,
        retractionsScore,
        airEntryScore,
        mentalStateScore,
        albuterolRateMgHr: albuterolRate === '' ? undefined : Number(albuterolRate),
        terbutalineRateMcgKgMin: terbutalineRate === '' ? undefined : Number(terbutalineRate),
        bipapSettings: bipapSettings || undefined,
        vbgPh: vbgPh === '' ? undefined : Number(vbgPh),
        vbgPco2Mmhg: vbgPco2 === '' ? undefined : Number(vbgPco2),
        notes,
      });
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save asthma flowsheet observation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>⏱️ Log Pediatric Asthma Flowsheet Observation</h3>
          <button type="button" className="btn small" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="stack">
          <div style={{ padding: '8px 12px', borderRadius: 6, backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'space-between' }}>
            <span>Current M-WCAS Score: <strong>{mwcas.totalScore} / 10</strong></span>
            <span>Severity: <strong>{mwcas.severityTier.replace(/_/g, ' ')}</strong></span>
          </div>

          <div className="grid2">
            <div>
              <label>Log Datetime</label>
              <input
                type="datetime-local"
                value={logDatetime}
                onChange={(e) => setLogDatetime(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Minutes from Triage</label>
              <input
                type="number"
                min="0"
                value={minutesFromTriage}
                onChange={(e) => setMinutesFromTriage(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>Respiratory Rate (breaths/min)</label>
              <input
                type="number"
                min="10"
                max="120"
                value={rr}
                onChange={(e) => setRr(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>Heart Rate (bpm)</label>
              <input
                type="number"
                min="40"
                max="240"
                value={hr}
                onChange={(e) => setHr(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>SpO2 (%)</label>
              <input
                type="number"
                min="40"
                max="100"
                value={spo2}
                onChange={(e) => setSpo2(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>FiO2 (%)</label>
              <input
                type="number"
                min="21"
                max="100"
                value={fio2}
                onChange={(e) => setFio2(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <fieldset className="card">
            <legend>M-WCAS Component Scores (0 - 2 each)</legend>
            <div className="grid2">
              <div>
                <label>Oxygen Saturation Score</label>
                <select value={spo2Score} onChange={(e) => setSpo2Score(Number(e.target.value))}>
                  <option value={0}>0 - SpO2 &gt; 95% on RA</option>
                  <option value={1}>1 - SpO2 92-95% on RA</option>
                  <option value={2}>2 - SpO2 &lt; 92% on RA</option>
                </select>
              </div>
              <div>
                <label>Wheezing Score</label>
                <select value={wheezingScore} onChange={(e) => setWheezingScore(Number(e.target.value))}>
                  <option value={0}>0 - None / mild end-expiratory</option>
                  <option value={1}>1 - Moderate throughout expiration</option>
                  <option value={2}>2 - Inspiratory + expiratory / silent chest</option>
                </select>
              </div>
              <div>
                <label>Retractions Score</label>
                <select value={retractionsScore} onChange={(e) => setRetractionsScore(Number(e.target.value))}>
                  <option value={0}>0 - None / minimal</option>
                  <option value={1}>1 - Moderate subcostal / intercostal</option>
                  <option value={2}>2 - Severe / tracheal tug / head bobbing</option>
                </select>
              </div>
              <div>
                <label>Air Entry Score</label>
                <select value={airEntryScore} onChange={(e) => setAirEntryScore(Number(e.target.value))}>
                  <option value={0}>0 - Normal bilateral</option>
                  <option value={1}>1 - Moderately decreased</option>
                  <option value={2}>2 - Markedly decreased / silent chest</option>
                </select>
              </div>
              <div>
                <label>Mental State Score</label>
                <select value={mentalStateScore} onChange={(e) => setMentalStateScore(Number(e.target.value))}>
                  <option value={0}>0 - Alert / calm</option>
                  <option value={1}>1 - Restless / irritable</option>
                  <option value={2}>2 - Lethargic / confused / exhausted</option>
                </select>
              </div>
            </div>
          </fieldset>

          <div className="grid2">
            <div>
              <label>Albuterol Rate (mg/hr)</label>
              <input
                type="number"
                step="0.5"
                placeholder="e.g. 8.0"
                value={albuterolRate}
                onChange={(e) => setAlbuterolRate(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label>Terbutaline Rate (mcg/kg/min)</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 0.8"
                value={terbutalineRate}
                onChange={(e) => setTerbutalineRate(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label>BiPAP Settings</label>
              <input
                type="text"
                placeholder="e.g. IPAP 14 / EPAP 6, FiO2 40%"
                value={bipapSettings}
                onChange={(e) => setBipapSettings(e.target.value)}
              />
            </div>
            <div>
              <label>VBG pH / pCO2</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number"
                  step="0.01"
                  placeholder="pH"
                  value={vbgPh}
                  onChange={(e) => setVbgPh(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <input
                  type="number"
                  placeholder="pCO2"
                  value={vbgPco2}
                  onChange={(e) => setVbgPco2(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div>
            <label>Notes</label>
            <input
              type="text"
              placeholder="e.g. Wheezing improved, speech becoming less fragmented..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving...' : 'Record Observation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
