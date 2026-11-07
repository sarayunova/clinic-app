/**
 * Compact, self-contained SVG QR Code Generator (ISO/IEC 18004)
 * Generates an SVG matrix without external dependencies, fully strict-null compliant.
 */

export function generateQrSvg(text: string, size = 180): string {
  const modules = generateQrMatrix(text);
  const numModules = modules.length;
  const cellSize = size / (numModules + 4);
  const offset = 2 * cellSize;

  let rects = '';
  for (let r = 0; r < numModules; r++) {
    const row = modules[r];
    if (!row) continue;
    for (let c = 0; c < numModules; c++) {
      if (row[c]) {
        const x = (offset + c * cellSize).toFixed(2);
        const y = (offset + r * cellSize).toFixed(2);
        const s = cellSize.toFixed(2);
        rects += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#000000"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="#ffffff"/>
    ${rects}
  </svg>`;
}

function generateQrMatrix(dataStr: string): boolean[][] {
  const bytes = new TextEncoder().encode(dataStr);
  const len = bytes.length;

  const capacity = [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271, 321, 367, 425];
  let version = 1;
  while (version < capacity.length) {
    const cap = capacity[version] ?? 0;
    if (cap >= len + 3) break;
    version++;
  }
  if (version >= capacity.length) version = capacity.length - 1;

  const size = version * 4 + 17;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  function setFunction(r: number, c: number, val: boolean) {
    const mRow = matrix[r];
    const fRow = isFunction[r];
    if (mRow && fRow) {
      mRow[c] = val;
      fRow[c] = true;
    }
  }

  // 1. Finder patterns
  function drawFinder(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          const isEdge = r === 0 || r === 6 || c === 0 || c === 6;
          const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          const val = (isEdge || isCenter) && (r >= 0 && r <= 6 && c >= 0 && c <= 6);
          setFunction(nr, nc, val);
        }
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0;
    const fRow6 = isFunction[6];
    const fRowI = isFunction[i];
    if (fRow6 && !fRow6[i]) setFunction(6, i, val);
    if (fRowI && !fRowI[6]) setFunction(i, 6, val);
  }

  // 3. Dark module
  setFunction(4 * version + 9, 8, true);

  // 4. Alignment patterns for Version >= 2
  if (version >= 2) {
    const alignPos: Record<number, number[]> = {
      2: [6, 18],
      3: [6, 22],
      4: [6, 26],
      5: [6, 30],
      6: [6, 34],
      7: [6, 22, 38],
      8: [6, 24, 42],
      9: [6, 26, 46],
      10: [6, 28, 50],
      11: [6, 30, 54],
      12: [6, 32, 58],
      13: [6, 34, 62],
    };
    const coords = alignPos[version] ?? [6, size - 7];
    for (const r of coords) {
      for (const c of coords) {
        const fRow = isFunction[r];
        if (fRow && fRow[c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBorder = Math.abs(dr) === 2 || Math.abs(dc) === 2;
            const isCenter = dr === 0 && dc === 0;
            setFunction(r + dr, c + dc, isBorder || isCenter);
          }
        }
      }
    }
  }

  // Reserve format info areas
  for (let i = 0; i < 9; i++) {
    const fRow8 = isFunction[8];
    const fRowI = isFunction[i];
    if (fRow8 && !fRow8[i]) fRow8[i] = true;
    if (fRowI && !fRowI[8]) fRowI[8] = true;
  }
  for (let i = 0; i < 8; i++) {
    const fRow8 = isFunction[8];
    const fRowBack = isFunction[size - 1 - i];
    if (fRow8) fRow8[size - 1 - i] = true;
    if (fRowBack) fRowBack[8] = true;
  }

  // 5. Data Bitstream generation
  const bits: number[] = [];
  function pushBits(val: number, bitLen: number) {
    for (let i = bitLen - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  }

  // Mode: 0100 (Byte mode)
  pushBits(0b0100, 4);
  pushBits(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) {
    pushBits(b, 8);
  }
  for (let i = 0; i < 4; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      const bit = bits[i + j] ?? 0;
      b = (b << 1) | bit;
    }
    dataBytes.push(b);
  }

  const totalCapacityBytes = capacity[version] ?? 100;
  let padToggle = false;
  while (dataBytes.length < totalCapacityBytes) {
    dataBytes.push(padToggle ? 0x11 : 0xec);
    padToggle = !padToggle;
  }

  const ecCount = Math.floor(totalCapacityBytes * 0.3) || 7;
  const ecBytes = calculateRsParity(dataBytes, ecCount);
  const allCodewords = [...dataBytes, ...ecBytes];

  const finalBits: number[] = [];
  for (const byte of allCodewords) {
    for (let i = 7; i >= 0; i--) {
      finalBits.push((byte >>> i) & 1);
    }
  }

  // 6. Place data in matrix
  let bitIdx = 0;
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--;
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const c of [right, right - 1]) {
        const fRow = isFunction[r];
        const mRow = matrix[r];
        if (fRow && mRow && !fRow[c]) {
          const bit = bitIdx < finalBits.length ? (finalBits[bitIdx++] ?? 0) : 0;
          const mask = (r + c) % 2 === 0;
          mRow[c] = (bit ^ (mask ? 1 : 0)) === 1;
        }
      }
    }
    upward = !upward;
  }

  // 7. Write format information
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  const row8 = matrix[8];
  if (row8) {
    for (let i = 0; i < 6; i++) row8[i] = formatBits[i] === 1;
    row8[7] = formatBits[6] === 1;
    row8[8] = formatBits[7] === 1;
    for (let i = 8; i < 15; i++) {
      row8[size - 15 + i] = formatBits[i] === 1;
    }
  }
  const row7 = matrix[7];
  if (row7) row7[8] = formatBits[8] === 1;

  for (let i = 9; i < 15; i++) {
    const row = matrix[14 - i];
    if (row) row[8] = formatBits[i] === 1;
  }
  for (let i = 0; i < 8; i++) {
    const row = matrix[size - 1 - i];
    if (row) row[8] = formatBits[i] === 1;
  }

  return matrix;
}

// Galois Field GF(256) arithmetic for Reed-Solomon
const GF_EXP: number[] = new Array(512).fill(0);
const GF_LOG: number[] = new Array(256).fill(0);
(function initGf() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = val;
    GF_EXP[i + 255] = val;
    GF_LOG[val] = i;
    val = (val << 1) ^ (val >= 128 ? 0x11d : 0);
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  const logX = GF_LOG[x] ?? 0;
  const logY = GF_LOG[y] ?? 0;
  return GF_EXP[logX + logY] ?? 0;
}

function calculateRsParity(data: number[], ecCount: number): number[] {
  let gen = [1];
  for (let i = 0; i < ecCount; i++) {
    const nextGen: number[] = new Array(gen.length + 1).fill(0);
    const expI = GF_EXP[i] ?? 0;
    for (let j = 0; j < gen.length; j++) {
      const g = gen[j] ?? 0;
      const currentVal = nextGen[j] ?? 0;
      nextGen[j] = currentVal ^ gfMul(g, expI);
      const nextVal = nextGen[j + 1] ?? 0;
      nextGen[j + 1] = nextVal ^ g;
    }
    gen = nextGen;
  }

  const remainder: number[] = new Array(ecCount).fill(0);
  for (const byte of data) {
    const firstRem = remainder[0] ?? 0;
    const factor = byte ^ firstRem;
    for (let i = 0; i < ecCount - 1; i++) {
      const genI1 = gen[i + 1] ?? 0;
      const remI1 = remainder[i + 1] ?? 0;
      remainder[i] = remI1 ^ gfMul(genI1, factor);
    }
    const genLast = gen[ecCount] ?? 0;
    remainder[ecCount - 1] = gfMul(genLast, factor);
  }

  return remainder;
}
