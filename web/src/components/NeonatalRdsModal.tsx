import React, { useState, useMemo } from 'react';
import { createNeonatalRdsEpisode, type NeonatalRdsRecord } from '../api';
import {
  calculateSilvermanScore,
  calculateDownesScore,
  calculateAaRatio,
  calculateOxygenationIndex,
  calculateSurfactantDosing,
  type SilvermanAndersonInput,
  type DownesInput,
} from '../neonatalRdsEngine';

interface NeonatalRdsModalProps {
  patientId: number;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (episode: NeonatalRdsRecord) => void;
  defaultGestationalWeeks?: number;
  defaultBirthWeightKg?: number;
}

export const NeonatalRdsModal: React.FC<NeonatalRdsModalProps> = ({
  patientId,
  patientName,
  isOpen,
  onClose,
  onSuccess,
  defaultGestationalWeeks = 29.5,
  defaultBirthWeightKg = 1.25,
}) => {
  const [onsetDatetime, setOnsetDatetime] = useState<string>(new Date().toISOString().slice(0, 16));
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<string>(String(defaultGestationalWeeks));
  const [birthWeightKg, setBirthWeightKg] = useState<string>(String(defaultBirthWeightKg));
  const [currentWeightKg, setCurrentWeightKg] = useState<string>(String(defaultBirthWeightKg));

  // Silverman-Anderson items
  const [upperChest, setUpperChest] = useState<number>(1);
  const [lowerChest, setLowerChest] = useState<number>(1);
  const [xiphoid, setXiphoid] = useState<number>(1);
  const [naresDilation, setNaresDilation] = useState<number>(1);
  const [expiratoryGrunt, setExpiratoryGrunt] = useState<number>(1);

  // Downes items
  const [cyanosis, setCyanosis] = useState<number>(1);
  const [retractions, setRetractions] = useState<number>(1);
  const [grunting, setGrunting] = useState<number>(1);
  const [airEntry, setAirEntry] = useState<number>(1);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(1);

  // Blood gas / oxygenation
  const [fio2RequirementPercent, setFio2RequirementPercent] = useState<string>('35.0');
  const [arterialPao2Mmhg, setArterialPao2Mmhg] = useState<string>('52.0');
  const [arterialPco2Mmhg, setArterialPco2Mmhg] = useState<string>('48.0');
  const [meanAirwayPressure, setMeanAirwayPressure] = useState<string>('6.5');

  // Surfactant
  const [surfactantIndicated, setSurfactantIndicated] = useState<boolean>(true);
  const [surfactantBrand, setSurfactantBrand] = useState<'curosurf_poractant_alfa' | 'survanta_beractant' | 'infasurf_calfactant'>('curosurf_poractant_alfa');
  const [administrationMethod, setAdministrationMethod] = useState<'lisa_mist_thin_catheter' | 'insure_intubate_surfactant_extubate' | 'endotracheal_invasive'>('lisa_mist_thin_catheter');
  const [surfactantAdministeredAt, setSurfactantAdministeredAt] = useState<string>(new Date().toISOString().slice(0, 16));

  // Bubble CPAP
  const [nivModality, setNivModality] = useState<'bubble_cpap' | 'variable_flow_cpap' | 'high_flow_nasal_cannula' | 'biphasic_niv' | 'intubated_conventional_cmv'>('bubble_cpap');
  const [currentPeepCmh2o, setCurrentPeepCmh2o] = useState<string>('6.0');
  const [currentFlowLpm, setCurrentFlowLpm] = useState<string>('6.0');
  const [currentFio2Percent, setCurrentFio2Percent] = useState<string>('35.0');
  const [clinicalNotes, setClinicalNotes] = useState<string>('Preterm neonate with early respiratory distress on Bubble CPAP. LISA surfactant planned.');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Computations
  const silvermanResult = useMemo(() => {
    return calculateSilvermanScore({
      upperChest,
      lowerChest,
      xiphoidRetractions: xiphoid,
      naresDilation,
      expiratoryGrunt,
    });
  }, [upperChest, lowerChest, xiphoid, naresDilation, expiratoryGrunt]);

  const downesResult = useMemo(() => {
    return calculateDownesScore({
      cyanosis,
      retractions,
      grunting,
      airEntry,
      respiratoryRate,
    });
  }, [cyanosis, retractions, grunting, airEntry, respiratoryRate]);

  const aaRatioResult = useMemo(() => {
    const pao2 = Number(arterialPao2Mmhg) || 0;
    const fio2 = Number(fio2RequirementPercent) || 21;
    const paco2 = Number(arterialPco2Mmhg) || 40;
    return calculateAaRatio(pao2, fio2, paco2);
  }, [arterialPao2Mmhg, fio2RequirementPercent, arterialPco2Mmhg]);

  const oiResult = useMemo(() => {
    const map = Number(meanAirwayPressure) || 6;
    const fio2 = Number(fio2RequirementPercent) || 21;
    const pao2 = Number(arterialPao2Mmhg) || 50;
    return calculateOxygenationIndex(map, fio2, pao2);
  }, [meanAirwayPressure, fio2RequirementPercent, arterialPao2Mmhg]);

  const surfactantCalc = useMemo(() => {
    const wt = Number(currentWeightKg) || 1.0;
    const ga = Number(gestationalAgeWeeks) || 30;
    const fio2 = Number(currentFio2Percent) || 30;
    const peep = Number(currentPeepCmh2o) || 6;
    return calculateSurfactantDosing({
      brand: surfactantBrand,
      weightKg: wt,
      gestationalAgeWeeks: ga,
      currentFiO2Percent: fio2,
      peepCmh2o: peep,
    });
  }, [surfactantBrand, currentWeightKg, gestationalAgeWeeks, currentFio2Percent, currentPeepCmh2o]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        patientId,
        onsetDatetime,
        gestationalAgeWeeks: Number(gestationalAgeWeeks),
        birthWeightKg: Number(birthWeightKg),
        currentWeightKg: Number(currentWeightKg),
        silvermanAndersonScore: silvermanResult.score,
        downesScore: downesResult.score,
        fio2RequirementPercent: Number(fio2RequirementPercent),
        arterialPao2Mmhg: arterialPao2Mmhg ? Number(arterialPao2Mmhg) : null,
        alveolarPao2Mmhg: aaRatioResult.calculatedPAO2,
        aARatio: aaRatioResult.aaRatio,
        oxygenationIndex: oiResult.oi,
        surfactantIndicated,
        surfactantBrand: surfactantIndicated ? surfactantBrand : null,
        surfactantDoseMgPerKg: surfactantIndicated ? surfactantCalc.doseMgPerKg : null,
        surfactantTotalDoseMg: surfactantIndicated ? surfactantCalc.totalDoseMg : null,
        surfactantTotalVolumeMl: surfactantIndicated ? surfactantCalc.totalVolumeMl : null,
        administrationMethod: surfactantIndicated ? administrationMethod : null,
        surfactantAdministeredAt: surfactantIndicated ? surfactantAdministeredAt : null,
        repeatSurfactantNeeded: false,
        nivModality,
        currentPeepCmh2o: Number(currentPeepCmh2o),
        currentFlowLpm: Number(currentFlowLpm),
        currentFio2Percent: Number(currentFio2Percent),
        status: surfactantIndicated ? 'surfactant_administered_stabilized' : 'active_niv',
        clinicalNotes,
      };

      const res = await createNeonatalRdsEpisode(payload);
      onSuccess(res.episode);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate Neonatal RDS protocol');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-sky-900 flex items-center gap-2">
              <span>🫁</span> Neonatal RDS & Bubble CPAP / LISA Surfactant
            </h2>
            <p className="text-xs text-gray-500">
              European Consensus Guidelines (2022/2023) Protocol • Patient: <span className="font-semibold">{patientName}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Demographics & Time */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-sky-50 p-3 rounded-lg border border-sky-100">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Onset Datetime</label>
              <input
                type="datetime-local"
                value={onsetDatetime}
                onChange={(e) => setOnsetDatetime(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Gestational Age (weeks)</label>
              <input
                type="number"
                step="0.1"
                min="22"
                max="44"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Birth Weight (kg)</label>
              <input
                type="number"
                step="0.01"
                min="0.4"
                max="6"
                value={birthWeightKg}
                onChange={(e) => setBirthWeightKg(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Current Weight (kg)</label>
              <input
                type="number"
                step="0.01"
                min="0.4"
                max="6"
                value={currentWeightKg}
                onChange={(e) => setCurrentWeightKg(e.target.value)}
                required
                className="w-full text-xs border rounded p-1.5 mt-1"
              />
            </div>
          </div>

          {/* Section 2: Silverman-Anderson & Downes Scoring */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Silverman Card */}
            <div className="border border-indigo-200 rounded-lg p-3 bg-indigo-50/40">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-xs text-indigo-900 uppercase">Silverman-Anderson Retraction Score</h3>
                <span className="text-sm font-extrabold px-2 py-0.5 rounded bg-indigo-600 text-white">
                  {silvermanResult.score} / 10
                </span>
              </div>
              <p className="text-xs text-indigo-700 mb-2 italic">{silvermanResult.description}</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span>Upper Chest Movement:</span>
                  <select value={upperChest} onChange={(e) => setUpperChest(Number(e.target.value))} className="border rounded p-1 text-xs">
                    <option value={0}>0: Synchronized</option>
                    <option value={1}>1: Lag on inspiration</option>
                    <option value={2}>2: See-saw respiration</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span>Lower Chest Retractions:</span>
                  <select value={lowerChest} onChange={(e) => setLowerChest(Number(e.target.value))} className="border rounded p-1 text-xs">
                    <option value={0}>0: None</option>
                    <option value={1}>1: Just visible</option>
                    <option value={2}>2: Marked</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span>Xiphoid Retractions:</span>
                  <select value={xiphoid} onChange={(e) => setXiphoid(Number(e.target.value))} className="border rounded p-1 text-xs">
                    <option value={0}>0: None</option>
                    <option value={1}>1: Just visible</option>
                    <option value={2}>2: Marked</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span>Nares Dilation:</span>
                  <select value={naresDilation} onChange={(e) => setNaresDilation(Number(e.target.value))} className="border rounded p-1 text-xs">
                    <option value={0}>0: None</option>
                    <option value={1}>1: Minimal flaring</option>
                    <option value={2}>2: Marked flaring</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span>Expiratory Grunt:</span>
                  <select value={expiratoryGrunt} onChange={(e) => setExpiratoryGrunt(Number(e.target.value))} className="border rounded p-1 text-xs">
                    <option value={0}>0: None</option>
                    <option value={1}>1: With stethoscope</option>
                    <option value={2}>2: Naked ear</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Downes Card */}
            <div className="border border-purple-200 rounded-lg p-3 bg-purple-50/40">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-xs text-purple-900 uppercase">Downes' Distress Score</h3>
                <span className="text-sm font-extrabold px-2 py-0.5 rounded bg-purple-600 text-white">
                  {downesResult.score} / 10
                </span>
              </div>
              <p className="text-xs text-purple-700 mb-2 italic">{downesResult.description}</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span>Cyanosis:</span>
                  <select value={cyanosis} onChange={(e) => setCyanosis(Number(e.target.value))} className="border rounded p-1 text-xs">
                    <option value={0}>0: None in room air</option>
                    <option value={1}>1: Relieved by FiO2 &lt;40%</option>
                    <option value={2}>2: Needs FiO2 ≥40%</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span>Retractions:</span>
                  <select value={retractions} onChange={(e) => setRetractions(Number(e.target.value))} className="border rounded p-1 text-xs">
                    <option value={0}>0: None</option>
                    <option value={1}>1: Mild</option>
                    <option value={2}>2: Moderate/Severe</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span>Grunting:</span>
                  <select value={grunting} onChange={(e) => setGrunting(Number(e.target.value))} className="border rounded p-1 text-xs">
                    <option value={0}>0: None</option>
                    <option value={1}>1: With stethoscope</option>
                    <option value={2}>2: Naked ear</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span>Air Entry:</span>
                  <select value={airEntry} onChange={(e) => setAirEntry(Number(e.target.value))} className="border rounded p-1 text-xs">
                    <option value={0}>0: Bilateral clear</option>
                    <option value={1}>1: Mildly reduced</option>
                    <option value={2}>2: Barely audible</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span>Respiratory Rate:</span>
                  <select value={respiratoryRate} onChange={(e) => setRespiratoryRate(Number(e.target.value))} className="border rounded p-1 text-xs">
                    <option value={0}>0: &lt; 60 bpm</option>
                    <option value={1}>1: 60 - 80 bpm</option>
                    <option value={2}>2: &gt; 80 bpm or apnea</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Arterial Blood Gas & a/A Ratio, OI */}
          <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50/40">
            <h3 className="font-bold text-xs text-emerald-900 uppercase mb-2">Oxygenation & Arterial Gas Dynamics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700">FiO2 Required (%)</label>
                <input
                  type="number"
                  step="1"
                  min="21"
                  max="100"
                  value={fio2RequirementPercent}
                  onChange={(e) => setFio2RequirementPercent(e.target.value)}
                  className="w-full text-xs border rounded p-1.5 mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700">PaO2 (mmHg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="10"
                  max="300"
                  value={arterialPao2Mmhg}
                  onChange={(e) => setArterialPao2Mmhg(e.target.value)}
                  className="w-full text-xs border rounded p-1.5 mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700">PaCO2 (mmHg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="15"
                  max="150"
                  value={arterialPco2Mmhg}
                  onChange={(e) => setArterialPco2Mmhg(e.target.value)}
                  className="w-full text-xs border rounded p-1.5 mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700">Mean Airway Press (cmH2O)</label>
                <input
                  type="number"
                  step="0.5"
                  min="3"
                  max="20"
                  value={meanAirwayPressure}
                  onChange={(e) => setMeanAirwayPressure(e.target.value)}
                  className="w-full text-xs border rounded p-1.5 mt-1"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-medium text-emerald-950 bg-white p-2 rounded border border-emerald-200">
              <div>
                Alveolar PAO2: <span className="font-bold">{aaRatioResult.calculatedPAO2} mmHg</span>
              </div>
              <div>
                a/A Ratio: <span className={`font-bold px-1.5 py-0.5 rounded ${aaRatioResult.aaRatio < 0.22 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{aaRatioResult.aaRatio}</span>
              </div>
              <div>
                Oxygenation Index (OI): <span className="font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">{oiResult.oi} ({oiResult.severity})</span>
              </div>
            </div>
          </div>

          {/* Section 4: Surfactant & LISA Technique */}
          <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/40">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-xs text-amber-900 uppercase">Surfactant Replacement Strategy</h3>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={surfactantIndicated}
                  onChange={(e) => setSurfactantIndicated(e.target.checked)}
                  className="rounded text-amber-600"
                />
                Administer Surfactant
              </label>
            </div>

            {surfactantCalc.indicationAlert && (
              <div className="p-2 mb-3 bg-amber-100 border-l-4 border-amber-500 text-amber-900 text-xs font-medium">
                ⚡ {surfactantCalc.indicationReason}
              </div>
            )}

            {surfactantIndicated && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Surfactant Preparation</label>
                    <select
                      value={surfactantBrand}
                      onChange={(e) => setSurfactantBrand(e.target.value as any)}
                      className="w-full text-xs border rounded p-1.5 mt-1"
                    >
                      <option value="curosurf_poractant_alfa">Curosurf® (Poractant alfa 80mg/mL) - 200 mg/kg</option>
                      <option value="survanta_beractant">Survanta® (Beractant 25mg/mL) - 100 mg/kg</option>
                      <option value="infasurf_calfactant">Infasurf® (Calfactant 35mg/mL) - 105 mg/kg</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Delivery Method</label>
                    <select
                      value={administrationMethod}
                      onChange={(e) => setAdministrationMethod(e.target.value as any)}
                      className="w-full text-xs border rounded p-1.5 mt-1 font-semibold text-sky-800"
                    >
                      <option value="lisa_mist_thin_catheter">LISA / MIST (Thin Catheter on CPAP) - GOLD STANDARD</option>
                      <option value="insure_intubate_surfactant_extubate">InSurE (Intubate-Surfactant-Extubate)</option>
                      <option value="endotracheal_invasive">Endotracheal Tube (Invasive Ventilation)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Administered Datetime</label>
                    <input
                      type="datetime-local"
                      value={surfactantAdministeredAt}
                      onChange={(e) => setSurfactantAdministeredAt(e.target.value)}
                      className="w-full text-xs border rounded p-1.5 mt-1"
                    />
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded border border-amber-300 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Weight-Calibrated Dose:</span>
                    <p className="font-bold text-amber-900">{surfactantCalc.totalDoseMg} mg ({surfactantCalc.doseMgPerKg} mg/kg)</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Volume:</span>
                    <p className="font-bold text-amber-900">{surfactantCalc.totalVolumeMl} mL</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Repeat Window:</span>
                    <p className="font-bold text-gray-800">q{surfactantCalc.repeatWindowHours}h (Max {surfactantCalc.maxDoses} doses)</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Catheter Size:</span>
                    <p className="font-bold text-sky-800">16G Angiocath / Surfcath (1.5-2 cm depth)</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Bubble CPAP Settings */}
          <div className="border border-sky-200 rounded-lg p-3 bg-sky-50/40">
            <h3 className="font-bold text-xs text-sky-900 uppercase mb-2">Non-Invasive Ventilation / Bubble CPAP Baseline</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700">Modality</label>
                <select
                  value={nivModality}
                  onChange={(e) => setNivModality(e.target.value as any)}
                  className="w-full text-xs border rounded p-1.5 mt-1"
                >
                  <option value="bubble_cpap">Bubble CPAP (Water seal)</option>
                  <option value="variable_flow_cpap">Variable-Flow CPAP (Infant Flow)</option>
                  <option value="high_flow_nasal_cannula">High-Flow Nasal Cannula (HFNC)</option>
                  <option value="biphasic_niv">BiPhasic / NIPPV</option>
                  <option value="intubated_conventional_cmv">Intubated CMV</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700">PEEP (cm H2O)</label>
                <input
                  type="number"
                  step="0.5"
                  min="4"
                  max="10"
                  value={currentPeepCmh2o}
                  onChange={(e) => setCurrentPeepCmh2o(e.target.value)}
                  className="w-full text-xs border rounded p-1.5 mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700">Flow (LPM)</label>
                <input
                  type="number"
                  step="0.5"
                  min="2"
                  max="12"
                  value={currentFlowLpm}
                  onChange={(e) => setCurrentFlowLpm(e.target.value)}
                  className="w-full text-xs border rounded p-1.5 mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700">FiO2 Baseline (%)</label>
                <input
                  type="number"
                  step="1"
                  min="21"
                  max="100"
                  value={currentFio2Percent}
                  onChange={(e) => setCurrentFio2Percent(e.target.value)}
                  className="w-full text-xs border rounded p-1.5 mt-1"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Clinical Notes & Team Orders</label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              className="w-full text-xs border rounded p-2 mt-1"
              placeholder="e.g. Spontaneous respirations maintained; columella silicone barrier placed; caffeine citrate 20 mg/kg loaded."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-sky-700 text-white rounded text-xs font-bold hover:bg-sky-800 shadow"
            >
              {loading ? 'Initiating...' : 'Initiate RDS & Bubble CPAP Protocol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
