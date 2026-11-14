/**
 * Self-contained QR Code generator (ISO/IEC 18004), byte mode, versions 1-40, rendered as SVG.
 * No dependencies. Follows the structure of Project Nayuki's reference generator (MIT): choose the
 * smallest version that fits at error-correction level M, raise the level if it still fits, split into
 * Reed-Solomon blocks and interleave, place the codewords, then pick the mask with the lowest penalty.
 *
 * The previous version of this file produced codes that looked right but that no scanner could read.
 * tests/qrSvg.test.ts pins outputs that an independent decoder read back correctly, so any change to the
 * output fails the tests until it has been re-verified the same way.
 */

export type Ecl = 'L' | 'M' | 'Q' | 'H';
const ECL_INDEX: Record<Ecl, number> = { L: 0, M: 1, Q: 2, H: 3 };
const ECL_FORMAT_BITS: Record<Ecl, number> = { L: 1, M: 0, Q: 3, H: 2 };

// Indexed [ecl][version]; index 0 unused.
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

const getBit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

function numRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function numDataCodewords(ver: number, ecl: Ecl): number {
  const e = ECL_INDEX[ecl];
  return Math.floor(numRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[e]![ver]! * NUM_ERROR_CORRECTION_BLOCKS[e]![ver]!;
}

// ---------- Reed-Solomon over GF(2^8), polynomial 0x11D ----------

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number): number[] {
  const result: number[] = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j]!, root);
      if (j + 1 < result.length) result[j] = result[j]! ^ result[j + 1]!;
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result: number[] = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift()!;
    result.push(0);
    divisor.forEach((coef, i) => (result[i] = result[i]! ^ gfMul(coef, factor)));
  }
  return result;
}

// ---------- Encoding ----------

/** Thrown when the text is too long for any QR code (about 2.3 KB at level M). */
export class QrTooLongError extends Error {}

/** Returns the module matrix ([row][col], true = dark) for the text. Exported for tests. */
export function qrMatrix(text: string, minEcl: Ecl = 'M'): boolean[][] {
  const bytes = new TextEncoder().encode(text);

  // Smallest version that fits at the requested level.
  let ver = 1;
  const bitsNeeded = (v: number) => 4 + (v <= 9 ? 8 : 16) + bytes.length * 8;
  for (; ; ver++) {
    if (ver > 40) throw new QrTooLongError(`Text too long for a QR code (${bytes.length} bytes)`);
    if (bitsNeeded(ver) <= numDataCodewords(ver, minEcl) * 8) break;
  }
  // Use a stronger level for free if the data still fits in this version.
  let ecl = minEcl;
  for (const e of ['M', 'Q', 'H'] as Ecl[]) {
    if (ECL_INDEX[e] > ECL_INDEX[ecl] && bitsNeeded(ver) <= numDataCodewords(ver, e) * 8) ecl = e;
  }

  // Data bit stream: mode, length, bytes, terminator, byte padding, pad codewords.
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  const capacityBits = numDataCodewords(ver, ecl) * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  // Split into blocks, add error correction, interleave.
  const e = ECL_INDEX[ecl];
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e]![ver]!;
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[e]![ver]!;
  const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const divisor = rsDivisor(blockEccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, divisor);
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const codewords: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) codewords.push(block[i]!);
    });
  }

  return new Matrix(ver, ecl).build(codewords);
}

class Matrix {
  readonly size: number;
  readonly modules: boolean[][];
  readonly isFunction: boolean[][];

  constructor(
    readonly ver: number,
    readonly ecl: Ecl,
  ) {
    this.size = ver * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.isFunction = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }

  private set(x: number, y: number, dark: boolean) {
    this.modules[y]![x] = dark;
    this.isFunction[y]![x] = true;
  }

  build(codewords: number[]): boolean[][] {
    this.drawFunctionPatterns();
    this.drawCodewords(codewords);
    let best = 0;
    let minPenalty = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      this.applyMask(mask);
      this.drawFormatBits(mask);
      const p = this.penalty();
      if (p < minPenalty) {
        best = mask;
        minPenalty = p;
      }
      this.applyMask(mask); // XOR again to undo
    }
    this.applyMask(best);
    this.drawFormatBits(best);
    return this.modules;
  }

  private drawFunctionPatterns() {
    const n = this.size;
    for (let i = 0; i < n; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    this.drawFinder(3, 3);
    this.drawFinder(n - 4, 3);
    this.drawFinder(3, n - 4);
    const align = this.alignmentPositions();
    const na = align.length;
    for (let i = 0; i < na; i++) {
      for (let j = 0; j < na; j++) {
        if (!((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0))) this.drawAlignment(align[i]!, align[j]!);
      }
    }
    this.drawFormatBits(0); // placeholder, overwritten once the mask is chosen
    this.drawVersion();
  }

  private alignmentPositions(): number[] {
    if (this.ver === 1) return [];
    const numAlign = Math.floor(this.ver / 7) + 2;
    const step = Math.floor((this.ver * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
    const result = [6];
    for (let pos = this.size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  private drawFinder(x: number, y: number) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) this.set(xx, yy, dist !== 2 && dist !== 4);
      }
    }
  }

  private drawAlignment(x: number, y: number) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) this.set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  private drawFormatBits(mask: number) {
    const data = (ECL_FORMAT_BITS[this.ecl] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const n = this.size;
    for (let i = 0; i <= 5; i++) this.set(8, i, getBit(bits, i));
    this.set(8, 7, getBit(bits, 6));
    this.set(8, 8, getBit(bits, 7));
    this.set(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, getBit(bits, i));
    for (let i = 0; i < 8; i++) this.set(n - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++) this.set(8, n - 15 + i, getBit(bits, i));
    this.set(8, n - 8, true); // the always-dark module
  }

  private drawVersion() {
    if (this.ver < 7) return;
    let rem = this.ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = getBit(bits, i);
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.set(a, b, bit);
      this.set(b, a, bit);
    }
  }

  private drawCodewords(data: number[]) {
    const n = this.size;
    let i = 0;
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < n; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? n - 1 - vert : vert;
          if (!this.isFunction[y]![x] && i < data.length * 8) {
            this.modules[y]![x] = getBit(data[i >>> 3]!, 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  private applyMask(mask: number) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.isFunction[y]![x]) continue;
        let invert: boolean;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        }
        if (invert) this.modules[y]![x] = !this.modules[y]![x];
      }
    }
  }

  /** The standard's mask penalty (rules 1-4). Any mask gives a valid code; this only picks the easiest to scan. */
  private penalty(): number {
    const n = this.size;
    const m = this.modules;
    const at = (x: number, y: number, vertical: boolean) => (vertical ? m[x]![y]! : m[y]![x]!);
    let result = 0;
    // Rule 1 (runs of 5+ same colour) and rule 3 (finder-like 1:1:3:1:1 with 4 light modules on one side).
    const FINDER_A = [true, false, true, true, true, false, true, false, false, false, false];
    const FINDER_B = [false, false, false, false, true, false, true, true, true, false, true];
    for (const vertical of [false, true]) {
      for (let y = 0; y < n; y++) {
        let runColor = false;
        let run = 0;
        for (let x = 0; x < n; x++) {
          const c = at(x, y, vertical);
          if (x > 0 && c === runColor) {
            run++;
            if (run === 5) result += 3;
            else if (run > 5) result++;
          } else {
            runColor = c;
            run = 1;
          }
          if (x + 11 <= n) {
            for (const pattern of [FINDER_A, FINDER_B]) {
              if (pattern.every((v, k) => at(x + k, y, vertical) === v)) result += 40;
            }
          }
        }
      }
    }
    // Rule 2: 2x2 blocks of one colour.
    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        const c = m[y]![x];
        if (c === m[y]![x + 1] && c === m[y + 1]![x] && c === m[y + 1]![x + 1]) result += 3;
      }
    }
    // Rule 4: overall dark/light balance.
    let dark = 0;
    for (const row of m) for (const c of row) if (c) dark++;
    const total = n * n;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += Math.max(0, k) * 10;
    return result;
  }
}

// ---------- SVG output (unchanged API) ----------

export function generateQrSvg(text: string, size = 180): string {
  let modules: boolean[][];
  try {
    modules = qrMatrix(text);
  } catch (e) {
    if (!(e instanceof QrTooLongError)) throw e;
    // Never draw something that looks like a QR code but is not one: say plainly that there is none.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"><rect x="1" y="1" width="98" height="98" fill="#ffffff" stroke="#b91c1c" stroke-width="2"/><text x="50" y="46" font-size="9" text-anchor="middle" fill="#b91c1c" font-family="sans-serif">Too much text</text><text x="50" y="58" font-size="9" text-anchor="middle" fill="#b91c1c" font-family="sans-serif">for a QR code</text></svg>`;
  }
  const numModules = modules.length;
  const quiet = 4; // the standard's required light border, in modules
  // One path instead of hundreds of rects: smaller, and no hairline gaps between neighbouring modules.
  let d = '';
  for (let r = 0; r < numModules; r++) {
    for (let c = 0; c < numModules; c++) {
      if (modules[r]![c]) d += `M${c + quiet},${r + quiet}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${numModules + quiet * 2} ${numModules + quiet * 2}" width="${size}" height="${size}" shape-rendering="crispEdges">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <path d="${d}" fill="#000000"/>
  </svg>`.replace(/^\s+/gm, '');
}

export function generateQrSvgDataUri(text: string, size = 180): string {
  const svg = generateQrSvg(text, size);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
