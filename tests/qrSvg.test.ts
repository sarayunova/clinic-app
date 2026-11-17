import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { QrTooLongError, generateQrSvg, qrMatrix, type Ecl } from '../web/src/qrSvg.js';

/**
 * The QR generator is easy to get subtly wrong: the previous version produced codes that looked like QR codes
 * but that no scanner could read (patient emergency cards included). There is no QR decoder among the project's
 * dependencies, so these golden fingerprints are of outputs that were decoded successfully by an independent
 * decoder (OpenCV 5 QRCodeDetectorAruco) on 2026-11-14, alongside 97 codes across versions 1-40, all four
 * error-correction levels and UTF-8 text.
 *
 * If one of these fails after a change to qrSvg.ts, the output changed: verify the new output really scans with
 * an independent decoder (or a phone) before updating the fingerprint. Do not update it just to make this pass.
 */
const GOLDEN: [text: string, ecl: Ecl, size: number, sha256: string][] = [
  ['https://192.168.1.13:3080/welcome', 'M', 29, 'd5d48a77c285ddbd4a3f6758ee4b847b73c736881ec8e9f75a63b7dca45d9d76'],
  ['https://clinic-main-server.home.arpa:3080/welcome', 'M', 33, 'a5fee016b712c8efdd3dce1bd6b61b8757be72c270d9f9d381aff25cc1ec13de'],
  ['Allergy: पेनिसिलिन – ಪೆನ್ಸಿಲಿನ್ ✓', 'M', 37, '4940efcf4cacc3d1ef2b9985d489d76a9b01733a3b220d27065e7110f0d595f8'],
  ['B', 'H', 21, 'f56ae8b3e766c853fe224422306b86266a282798db001cb29b251ce7673c61ce'],
  ['x'.repeat(300), 'Q', 81, 'b2504fe076c1405299b5f546475fe9abc759feb765699a475f5420d92164e1b2'],
  ['y'.repeat(1200), 'L', 117, '33ba2835e3962f1820f887344e7f86dab016c6d60de062882d1a9bcd9dec197f'],
];

const fingerprint = (m: boolean[][]) =>
  crypto.createHash('sha256').update(m.map((r) => r.map((b) => (b ? '1' : '0')).join('')).join('\n')).digest('hex');

describe('QR code generator', () => {
  it.each(GOLDEN)('matches the independently decoded output for %#', (text, ecl, size, sha) => {
    const m = qrMatrix(text, ecl);
    expect(m.length).toBe(size);
    expect(fingerprint(m)).toBe(sha);
  });

  it('draws the three finder patterns and the always-dark module where scanners look for them', () => {
    const m = qrMatrix('https://192.168.1.13:3080/welcome');
    const n = m.length;
    const finderRow = [true, true, true, true, true, true, true];
    for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]] as const) {
      expect(m[r]!.slice(c, c + 7)).toEqual(finderRow); // top edge
      expect(m[r + 3]!.slice(c, c + 7)).toEqual([true, false, true, true, true, false, true]); // through the centre
    }
    expect(m[n - 8]![8]).toBe(true);
  });

  it('refuses text too long for any QR code instead of silently truncating it', () => {
    expect(() => qrMatrix('z'.repeat(3000))).toThrow(QrTooLongError);
    // The SVG says so plainly rather than crashing the page or drawing a code that does not scan.
    const svg = generateQrSvg('z'.repeat(3000));
    expect(svg).toContain('Too much text');
    expect(svg).not.toContain('<path');
  });

  it('renders an SVG with the standard 4-module light border', () => {
    const svg = generateQrSvg('https://192.168.1.13:3080/welcome', 200);
    expect(svg).toMatch(/viewBox="0 0 37 37"/); // 29 modules + 2 x 4 border
    expect(svg).toMatch(/width="200" height="200"/);
    expect(svg).toContain('M4,4h1v1h-1z'); // top-left finder starts inside the border
  });
});
