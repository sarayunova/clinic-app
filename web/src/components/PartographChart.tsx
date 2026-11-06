import React from 'react';
import type { Partograph, PartographEntry } from '../partographLogic';
import {
  calculateActionLineDilatation,
  calculateAlertLineDilatation,
  stationToNumeric,
} from '../partographLogic';

interface Props {
  partograph: Partograph;
  entries: PartographEntry[];
  maxHours?: number;
}

/**
 * Standard WHO Graphical Partograph SVG component.
 * Renders FHR baseline, Liquor/Molding, Cervical Dilatation (X) with Alert/Action lines,
 * Head Descent (O), Contractions (1-5 with intensity shading), Oxytocin/Drugs, and Maternal Vitals.
 */
export function PartographChart({ partograph, entries, maxHours }: Props) {
  // Determine hours grid range (minimum 12 hours or up to latest entry + 2)
  const latestEntryHours = entries.length > 0 ? Math.max(...entries.map((e) => e.hoursFromStart)) : 0;
  const totalHours = Math.max(12, Math.min(24, Math.ceil(Math.max(latestEntryHours + 2, maxHours || 12))));

  const alertStartH = partograph.alertLineStartHours ?? 0.0;
  const alertStartCm = partograph.alertLineStartCm ?? 4.0;
  const actionStartH = alertStartH + 4.0;

  // Chart Geometry
  const width = 920;
  const leftMargin = 120;
  const rightMargin = 30;
  const graphWidth = width - leftMargin - rightMargin;
  const hourStep = graphWidth / totalHours;

  const getX = (h: number) => leftMargin + h * hourStep;

  // 1. FHR Chart Geometry (Y: 80 to 200 bpm, height: 140px)
  const fhrTop = 30;
  const fhrHeight = 130;
  const fhrMin = 80;
  const fhrMax = 200;
  const getFhrY = (bpm: number) => fhrTop + fhrHeight - ((bpm - fhrMin) / (fhrMax - fhrMin)) * fhrHeight;

  // 2. Liquor & Molding Strip (Y: 175, height: 44px)
  const lmTop = fhrTop + fhrHeight + 15;
  const lmHeight = 46;

  // 3. Dilatation & Descent Chart (Y: 250, height: 180px, 0 to 10 cm / 5 to 0 fifths)
  const dilTop = lmTop + lmHeight + 15;
  const dilHeight = 180;
  const getDilY = (cm: number) => dilTop + dilHeight - (cm / 10.0) * dilHeight;
  const getStationY = (stationNum: number) => dilTop + dilHeight - (stationNum / 5.0) * (dilHeight / 2.0); // mapped cleanly

  // 4. Contractions Strip (Y: 460, height: 80px, 1 to 5 boxes)
  const contTop = dilTop + dilHeight + 15;
  const contHeight = 75;
  const boxHeight = contHeight / 5.0;

  // 5. Oxytocin & Drugs Strip (Y: 565, height: 44px)
  const oxyTop = contTop + contHeight + 15;
  const oxyHeight = 44;

  // 6. Maternal Vitals: BP & Pulse Chart (Y: 640, height: 110px, 40 to 180 bpm/mmHg)
  const bpTop = oxyTop + oxyHeight + 15;
  const bpHeight = 110;
  const bpMin = 40;
  const bpMax = 180;
  const getBpY = (val: number) => bpTop + bpHeight - ((val - bpMin) / (bpMax - bpMin)) * bpHeight;

  // 7. Maternal Temp & Urine Strip (Y: 780, height: 44px)
  const tempTop = bpTop + bpHeight + 15;
  const tempHeight = 44;

  const totalSvgHeight = tempTop + tempHeight + 25;

  // FHR Polyline path
  const fhrPoints = entries
    .filter((e) => e.fetalHeartRate != null)
    .map((e) => `${getX(e.hoursFromStart)},${getFhrY(e.fetalHeartRate!)}`)
    .join(' ');

  // Dilatation Polyline path
  const dilPoints = entries
    .filter((e) => e.cervicalDilatationCm != null)
    .map((e) => `${getX(e.hoursFromStart)},${getDilY(e.cervicalDilatationCm!)}`)
    .join(' ');

  // Station Descent Polyline path
  const stationEntries = entries
    .map((e) => ({ ...e, num: stationToNumeric(e.stationDescent) }))
    .filter((e) => e.num != null);
  const stationPoints = stationEntries
    .map((e) => `${getX(e.hoursFromStart)},${dilTop + (5 - e.num!) * (dilHeight / 5.0)}`)
    .join(' ');

  // Maternal Pulse Polyline path
  const pulsePoints = entries
    .filter((e) => e.maternalPulseBpm != null)
    .map((e) => `${getX(e.hoursFromStart)},${getBpY(e.maternalPulseBpm!)}`)
    .join(' ');

  return (
    <div style={{ overflowX: 'auto', background: '#ffffff', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
      <svg
        viewBox={`0 0 ${width} ${totalSvgHeight}`}
        style={{ width: '100%', minWidth: '780px', height: 'auto', display: 'block', fontFamily: 'system-ui, sans-serif' }}
      >
        <defs>
          {/* Diagonal hatching pattern for moderate contractions (20-40 sec) */}
          <pattern id="diagonalHatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#1e293b" strokeWidth="2.5" />
          </pattern>
          {/* Dotted pattern for mild contractions (< 20 sec) */}
          <pattern id="dotPattern" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="1.3" fill="#64748b" />
          </pattern>
        </defs>

        {/* ========================================================= */}
        {/* SECTION 1: FETAL HEART RATE (80 - 200 BPM) */}
        {/* ========================================================= */}
        <g id="fhr-section">
          {/* Background Normal Band (110 - 160 bpm) */}
          <rect
            x={leftMargin}
            y={getFhrY(160)}
            width={graphWidth}
            height={getFhrY(110) - getFhrY(160)}
            fill="#dcfce7"
            opacity="0.65"
          />

          {/* Section Border & Y-Axis Label */}
          <rect x={leftMargin} y={fhrTop} width={graphWidth} height={fhrHeight} fill="none" stroke="#0f172a" strokeWidth="1.2" />
          <text x="15" y={fhrTop + 35} fontSize="11" fontWeight="700" fill="#0f172a">FETAL HEART</text>
          <text x="15" y={fhrTop + 50} fontSize="11" fontWeight="700" fill="#0f172a">RATE (BPM)</text>
          <text x="15" y={fhrTop + 72} fontSize="9.5" fill="#15803d" fontWeight="600">Normal 110–160</text>

          {/* Horizontal Grid lines every 20 bpm */}
          {[80, 100, 110, 120, 140, 160, 180, 200].map((bpm) => {
            const y = getFhrY(bpm);
            const isBound = bpm === 110 || bpm === 160;
            return (
              <g key={bpm}>
                <line
                  x1={leftMargin}
                  y1={y}
                  x2={leftMargin + graphWidth}
                  y2={y}
                  stroke={isBound ? '#15803d' : '#e2e8f0'}
                  strokeWidth={isBound ? '1.2' : '0.8'}
                  strokeDasharray={isBound ? '4,3' : 'none'}
                />
                <text x={leftMargin - 8} y={y + 3.5} textAnchor="end" fontSize="9" fill={isBound ? '#15803d' : '#475569'} fontWeight={isBound ? '700' : '400'}>
                  {bpm}
                </text>
              </g>
            );
          })}

          {/* FHR Plot */}
          {fhrPoints && (
            <polyline fill="none" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" points={fhrPoints} />
          )}
          {entries
            .filter((e) => e.fetalHeartRate != null)
            .map((e) => {
              const x = getX(e.hoursFromStart);
              const y = getFhrY(e.fetalHeartRate!);
              const isAbnormal = e.fetalHeartRate! < 110 || e.fetalHeartRate! > 160;
              return (
                <g key={`fhr-${e.id}`}>
                  <circle cx={x} cy={y} r={isAbnormal ? 4.5 : 3.5} fill={isAbnormal ? '#dc2626' : '#0284c7'} stroke="#ffffff" strokeWidth="1" />
                  <text x={x} y={y - 6} textAnchor="middle" fontSize="8" fontWeight="700" fill={isAbnormal ? '#dc2626' : '#0369a1'}>
                    {e.fetalHeartRate}
                  </text>
                </g>
              );
            })}
        </g>

        {/* ========================================================= */}
        {/* SECTION 2: LIQUOR & MOLDING */}
        {/* ========================================================= */}
        <g id="liquor-molding-section">
          <rect x={leftMargin} y={lmTop} width={graphWidth} height={lmHeight} fill="#f8fafc" stroke="#0f172a" strokeWidth="1" />
          <line x1={leftMargin} y1={lmTop + lmHeight / 2} x2={leftMargin + graphWidth} y2={lmTop + lmHeight / 2} stroke="#cbd5e1" strokeWidth="0.8" />

          <text x="15" y={lmTop + 16} fontSize="10" fontWeight="700" fill="#0f172a">Amniotic Fluid</text>
          <text x="15" y={lmTop + 38} fontSize="10" fontWeight="700" fill="#0f172a">Molding of Head</text>

          {/* Half-hour / Hour values */}
          {entries.map((e) => {
            const x = getX(e.hoursFromStart);
            return (
              <g key={`lm-${e.id}`}>
                {e.liquor && (
                  <text
                    x={x}
                    y={lmTop + 16}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill={e.liquor === 'M' ? '#dc2626' : e.liquor === 'B' ? '#b91c1c' : '#0f172a'}
                  >
                    {e.liquor}
                  </text>
                )}
                {e.molding && (
                  <text
                    x={x}
                    y={lmTop + 38}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill={e.molding === '+++' ? '#dc2626' : '#0f172a'}
                  >
                    {e.molding}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* ========================================================= */}
        {/* SECTION 3: CERVICAL DILATATION (X) & DESCENT (O) */}
        {/* ========================================================= */}
        <g id="dilatation-descent-section">
          <rect x={leftMargin} y={dilTop} width={graphWidth} height={dilHeight} fill="#ffffff" stroke="#0f172a" strokeWidth="1.2" />

          {/* Y-Axis Label */}
          <text x="15" y={dilTop + 45} fontSize="11" fontWeight="700" fill="#0f172a">CERVICAL DIL.</text>
          <text x="15" y={dilTop + 60} fontSize="11" fontWeight="700" fill="#0f172a">(cm: 0–10) [ ✕ ]</text>
          <text x="15" y={dilTop + 95} fontSize="10" fontWeight="700" fill="#059669">HEAD DESCENT</text>
          <text x="15" y={dilTop + 110} fontSize="10" fontWeight="700" fill="#059669">(Fifths: 5–0) [ ◯ ]</text>

          {/* Grid lines 0 to 10 cm */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((cm) => {
            const y = getDilY(cm);
            const isFour = cm === 4;
            const isTen = cm === 10;
            return (
              <g key={`dil-grid-${cm}`}>
                <line
                  x1={leftMargin}
                  y1={y}
                  x2={leftMargin + graphWidth}
                  y2={y}
                  stroke={isFour || isTen ? '#94a3b8' : '#f1f5f9'}
                  strokeWidth={isFour || isTen ? '1' : '0.8'}
                />
                <text x={leftMargin - 8} y={y + 3.5} textAnchor="end" fontSize="9" fontWeight="600" fill="#334155">
                  {cm} cm
                </text>
                <text x={leftMargin + graphWidth + 6} y={y + 3.5} textAnchor="start" fontSize="8" fill="#64748b">
                  {cm % 2 === 0 ? `${5 - cm / 2}/5` : ''}
                </text>
              </g>
            );
          })}

          {/* ALERT LINE: Gold diagonal line starting at (alertStartH, 4cm) to (alertStartH + 6, 10cm) */}
          {alertStartH < totalHours && (
            <g id="alert-line">
              <line
                x1={getX(alertStartH)}
                y1={getDilY(alertStartCm)}
                x2={getX(Math.min(totalHours, alertStartH + (10 - alertStartCm)))}
                y2={getDilY(Math.min(10, alertStartCm + (Math.min(totalHours, alertStartH + 6) - alertStartH)))}
                stroke="#d97706"
                strokeWidth="2.4"
              />
              <text
                x={getX(alertStartH + 2)}
                y={getDilY(alertStartCm + 2) - 8}
                fill="#b45309"
                fontSize="9"
                fontWeight="700"
                transform={`rotate(-28, ${getX(alertStartH + 2)}, ${getDilY(alertStartCm + 2) - 8})`}
              >
                ALERT LINE
              </text>
            </g>
          )}

          {/* ACTION LINE: Red diagonal line starting at (actionStartH, 4cm) to (actionStartH + 6, 10cm) */}
          {actionStartH < totalHours && (
            <g id="action-line">
              <line
                x1={getX(actionStartH)}
                y1={getDilY(alertStartCm)}
                x2={getX(Math.min(totalHours, actionStartH + (10 - alertStartCm)))}
                y2={getDilY(Math.min(10, alertStartCm + (Math.min(totalHours, actionStartH + 6) - actionStartH)))}
                stroke="#dc2626"
                strokeWidth="2.4"
                strokeDasharray="6,3"
              />
              <text
                x={getX(actionStartH + 2)}
                y={getDilY(alertStartCm + 2) - 8}
                fill="#b91c1c"
                fontSize="9"
                fontWeight="700"
                transform={`rotate(-28, ${getX(actionStartH + 2)}, ${getDilY(alertStartCm + 2) - 8})`}
              >
                ACTION LINE (4 hr)
              </text>
            </g>
          )}

          {/* Fetal Head Descent (Fifths palpable) - Plotted with 'O' and dashed green line */}
          {stationPoints && (
            <polyline fill="none" stroke="#059669" strokeWidth="1.8" strokeDasharray="4,4" points={stationPoints} />
          )}
          {stationEntries.map((e) => {
            const x = getX(e.hoursFromStart);
            const y = dilTop + (5 - e.num!) * (dilHeight / 5.0);
            return (
              <g key={`station-${e.id}`}>
                <circle cx={x} cy={y} r="5" fill="#ffffff" stroke="#059669" strokeWidth="2.2" />
                <text x={x} y={y + 13} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#047857">
                  {e.stationDescent}
                </text>
              </g>
            );
          })}

          {/* Cervical Dilatation - Plotted with bold 'X' and solid navy line */}
          {dilPoints && (
            <polyline fill="none" stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round" points={dilPoints} />
          )}
          {entries
            .filter((e) => e.cervicalDilatationCm != null)
            .map((e) => {
              const x = getX(e.hoursFromStart);
              const y = getDilY(e.cervicalDilatationCm!);
              const d = e.cervicalDilatationCm!;
              return (
                <g key={`dil-${e.id}`}>
                  {/* Crisp 'X' mark */}
                  <line x1={x - 4.5} y1={y - 4.5} x2={x + 4.5} y2={y + 4.5} stroke="#0f172a" strokeWidth="2.8" strokeLinecap="round" />
                  <line x1={x + 4.5} y1={y - 4.5} x2={x - 4.5} y2={y + 4.5} stroke="#0f172a" strokeWidth="2.8" strokeLinecap="round" />
                  <text x={x} y={y - 7} textAnchor="middle" fontSize="9" fontWeight="800" fill="#0f172a">
                    {d} cm
                  </text>
                </g>
              );
            })}
        </g>

        {/* ========================================================= */}
        {/* SECTION 4: UTERINE CONTRACTIONS (per 10 min) */}
        {/* ========================================================= */}
        <g id="contractions-section">
          <rect x={leftMargin} y={contTop} width={graphWidth} height={contHeight} fill="#ffffff" stroke="#0f172a" strokeWidth="1" />
          <text x="15" y={contTop + 25} fontSize="11" fontWeight="700" fill="#0f172a">CONTRACTIONS</text>
          <text x="15" y={contTop + 40} fontSize="9.5" fontWeight="600" fill="#0f172a">per 10 minutes</text>
          <text x="15" y={contTop + 55} fontSize="8.5" fill="#64748b">(1 to 5 boxes)</text>

          {/* 5 horizontal contraction level rows */}
          {[1, 2, 3, 4, 5].map((lvl) => {
            const y = contTop + contHeight - lvl * boxHeight;
            return (
              <g key={`cont-lvl-${lvl}`}>
                <line x1={leftMargin} y1={y} x2={leftMargin + graphWidth} y2={y} stroke="#e2e8f0" strokeWidth="0.8" />
                <text x={leftMargin - 8} y={y + boxHeight / 2 + 3} textAnchor="end" fontSize="9" fill="#475569">
                  {lvl}
                </text>
              </g>
            );
          })}

          {/* Plot Contraction Bars */}
          {entries
            .filter((e) => e.contractionsCount != null && e.contractionsCount > 0)
            .map((e) => {
              const x = getX(e.hoursFromStart);
              const count = Math.min(5, e.contractionsCount!);
              const intensity = e.contractionsIntensity || 'moderate';
              const fill =
                intensity === 'strong'
                  ? '#0f172a'
                  : intensity === 'mild'
                  ? 'url(#dotPattern)'
                  : 'url(#diagonalHatch)';
              const barHeight = count * boxHeight;
              const barY = contTop + contHeight - barHeight;
              const barWidth = Math.max(12, hourStep * 0.45);

              return (
                <g key={`cont-bar-${e.id}`}>
                  <rect
                    x={x - barWidth / 2}
                    y={barY}
                    width={barWidth}
                    height={barHeight}
                    fill={fill}
                    stroke="#0f172a"
                    strokeWidth="1"
                  />
                  <text x={x} y={barY - 3} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#0f172a">
                    {e.contractionsDurationSec ? `${e.contractionsDurationSec}s` : `${count}/10`}
                  </text>
                </g>
              );
            })}
        </g>

        {/* ========================================================= */}
        {/* SECTION 5: OXYTOCIN & MEDICATIONS */}
        {/* ========================================================= */}
        <g id="oxytocin-section">
          <rect x={leftMargin} y={oxyTop} width={graphWidth} height={oxyHeight} fill="#f8fafc" stroke="#0f172a" strokeWidth="1" />
          <line x1={leftMargin} y1={oxyTop + oxyHeight / 2} x2={leftMargin + graphWidth} y2={oxyTop + oxyHeight / 2} stroke="#cbd5e1" strokeWidth="0.8" />

          <text x="15" y={oxyTop + 15} fontSize="10" fontWeight="700" fill="#0f172a">Oxytocin (U/L · gtt)</text>
          <text x="15" y={oxyTop + 36} fontSize="10" fontWeight="700" fill="#0f172a">Drugs &amp; IV Fluids</text>

          {entries.map((e) => {
            const x = getX(e.hoursFromStart);
            return (
              <g key={`oxy-${e.id}`}>
                {(e.oxytocinDropsPerMin != null || e.oxytocinUPerL != null) && (
                  <text x={x} y={oxyTop + 15} textAnchor="middle" fontSize="9" fontWeight="700" fill="#2563eb">
                    {e.oxytocinDropsPerMin ? `${e.oxytocinDropsPerMin} dpm` : ''}
                    {e.oxytocinUPerL ? ` (${e.oxytocinUPerL}U)` : ''}
                  </text>
                )}
                {(e.drugsGiven || e.ivFluids) && (
                  <text x={x} y={oxyTop + 36} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#0f172a">
                    {(e.drugsGiven || e.ivFluids)?.slice(0, 14)}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* ========================================================= */}
        {/* SECTION 6: MATERNAL VITALS (BP & PULSE) */}
        {/* ========================================================= */}
        <g id="maternal-vitals-section">
          <rect x={leftMargin} y={bpTop} width={graphWidth} height={bpHeight} fill="#ffffff" stroke="#0f172a" strokeWidth="1.2" />

          <text x="15" y={bpTop + 35} fontSize="11" fontWeight="700" fill="#0f172a">MATERNAL</text>
          <text x="15" y={bpTop + 50} fontSize="11" fontWeight="700" fill="#dc2626">PULSE (●)</text>
          <text x="15" y={bpTop + 65} fontSize="11" fontWeight="700" fill="#2563eb">BLOOD PRESS.</text>
          <text x="15" y={bpTop + 80} fontSize="9" fill="#2563eb">SYS ↕ DIA</text>

          {/* Grid lines 60, 80, 100, 120, 140, 160 */}
          {[60, 80, 100, 120, 140, 160].map((v) => {
            const y = getBpY(v);
            return (
              <g key={`bp-grid-${v}`}>
                <line x1={leftMargin} y1={y} x2={leftMargin + graphWidth} y2={y} stroke="#f1f5f9" strokeWidth="0.8" />
                <text x={leftMargin - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">
                  {v}
                </text>
              </g>
            );
          })}

          {/* Blood Pressure Arrows (Sys ↕ Dia) */}
          {entries
            .filter((e) => e.maternalSystolicMmhg != null && e.maternalDiastolicMmhg != null)
            .map((e) => {
              const x = getX(e.hoursFromStart);
              const ySys = getBpY(e.maternalSystolicMmhg!);
              const yDia = getBpY(e.maternalDiastolicMmhg!);
              const isHtn = e.maternalSystolicMmhg! >= 140 || e.maternalDiastolicMmhg! >= 90;
              return (
                <g key={`bp-${e.id}`}>
                  {/* Connecting bar */}
                  <line x1={x} y1={ySys} x2={x} y2={yDia} stroke={isHtn ? '#dc2626' : '#2563eb'} strokeWidth="2.5" />
                  {/* Top arrow head for Systolic */}
                  <path d={`M ${x - 4} ${ySys + 4} L ${x} ${ySys} L ${x + 4} ${ySys + 4}`} fill="none" stroke={isHtn ? '#dc2626' : '#2563eb'} strokeWidth="2.2" />
                  {/* Bottom arrow head for Diastolic */}
                  <path d={`M ${x - 4} ${yDia - 4} L ${x} ${yDia} L ${x + 4} ${yDia - 4}`} fill="none" stroke={isHtn ? '#dc2626' : '#2563eb'} strokeWidth="2.2" />
                  <text x={x} y={ySys - 4} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={isHtn ? '#dc2626' : '#1d4ed8'}>
                    {e.maternalSystolicMmhg}/{e.maternalDiastolicMmhg}
                  </text>
                </g>
              );
            })}

          {/* Maternal Pulse Polyline & dots */}
          {pulsePoints && (
            <polyline fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" points={pulsePoints} />
          )}
          {entries
            .filter((e) => e.maternalPulseBpm != null)
            .map((e) => {
              const x = getX(e.hoursFromStart);
              const y = getBpY(e.maternalPulseBpm!);
              return (
                <circle key={`pulse-${e.id}`} cx={x} cy={y} r="3.2" fill="#dc2626" stroke="#ffffff" strokeWidth="1" />
              );
            })}
        </g>

        {/* ========================================================= */}
        {/* SECTION 7: MATERNAL TEMP & URINE */}
        {/* ========================================================= */}
        <g id="temp-urine-section">
          <rect x={leftMargin} y={tempTop} width={graphWidth} height={tempHeight} fill="#f8fafc" stroke="#0f172a" strokeWidth="1" />
          <line x1={leftMargin} y1={tempTop + tempHeight / 2} x2={leftMargin + graphWidth} y2={tempTop + tempHeight / 2} stroke="#cbd5e1" strokeWidth="0.8" />

          <text x="15" y={tempTop + 15} fontSize="10" fontWeight="700" fill="#0f172a">Temp (°C)</text>
          <text x="15" y={tempTop + 36} fontSize="10" fontWeight="700" fill="#0f172a">Urine (Prot/Ket/Vol)</text>

          {entries.map((e) => {
            const x = getX(e.hoursFromStart);
            return (
              <g key={`tu-${e.id}`}>
                {e.maternalTemperatureC != null && (
                  <text
                    x={x}
                    y={tempTop + 15}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="700"
                    fill={e.maternalTemperatureC >= 38.0 ? '#dc2626' : '#0f172a'}
                  >
                    {e.maternalTemperatureC.toFixed(1)}°
                  </text>
                )}
                {(e.urineProtein || e.urineKetones || e.urineVolumeMl) && (
                  <text x={x} y={tempTop + 36} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#475569">
                    {e.urineProtein ? `P:${e.urineProtein}` : ''} {e.urineKetones ? `K:${e.urineKetones}` : ''}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* ========================================================= */}
        {/* TIME / HOUR TICKS ACROSS ALL CHARTS */}
        {/* ========================================================= */}
        <g id="time-grid-lines">
          {Array.from({ length: totalHours + 1 }).map((_, h) => {
            const x = getX(h);
            return (
              <g key={`time-tick-${h}`}>
                {/* Vertical grid line */}
                <line
                  x1={x}
                  y1={fhrTop}
                  x2={x}
                  y2={tempTop + tempHeight}
                  stroke="#cbd5e1"
                  strokeWidth="0.7"
                  strokeDasharray={h % 2 === 0 ? 'none' : '2,2'}
                />
                {/* Hour indicator on top of dilatation chart */}
                <rect x={x - 12} y={dilTop - 13} width="24" height="12" fill="#f1f5f9" rx="2" />
                <text x={x} y={dilTop - 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="#334155">
                  T+{h}
                </text>
              </g>
            );
          })}
        </g>

        {/* Legend at Bottom */}
        <g id="legend" transform={`translate(${leftMargin}, ${tempTop + tempHeight + 15})`}>
          <text x="0" y="0" fontSize="8.5" fill="#475569">
            <strong>Legend:</strong> [ ✕ ] Cervical Dilatation · [ ◯ ] Head Descent (fifths) ·{' '}
            <tspan fill="#d97706" fontWeight="700">— Alert Line</tspan> ·{' '}
            <tspan fill="#dc2626" fontWeight="700">- - Action Line</tspan> ·{' '}
            <tspan fill="#dc2626">● Maternal Pulse</tspan> ·{' '}
            <tspan fill="#2563eb">↕ Maternal BP</tspan> · Contractions: ░ &lt;20s | ▨ 20–40s | █ &gt;40s
          </text>
        </g>
      </svg>
    </div>
  );
}
