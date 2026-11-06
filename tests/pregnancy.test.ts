import { describe, expect, it } from 'vitest';
import { calculateEdd, calculateGestationalAge, formatGpal } from '../web/src/pregnancy.js';

describe('Obstetric calculations & pregnancy tools', () => {
  describe('calculateEdd (Naegele rule: LMP + 280 days)', () => {
    it('returns null for missing, empty, or invalid LMP', () => {
      expect(calculateEdd(null)).toBeNull();
      expect(calculateEdd(undefined)).toBeNull();
      expect(calculateEdd('')).toBeNull();
      expect(calculateEdd('invalid-date')).toBeNull();
    });

    it('calculates EDD exactly 280 days from LMP', () => {
      // 2026-01-01 + 280 days:
      // Jan (30 days left) + Feb (28) + Mar (31) + Apr (30) + May (31) + Jun (30) + Jul (31) + Aug (31) + Sep (30) = 272 days
      // 280 - 272 = Oct 8, 2026
      expect(calculateEdd('2026-01-01')).toBe('2026-10-08');
    });

    it('correctly handles leap years', () => {
      // 2024 is a leap year (Feb has 29 days)
      // 2024-01-01 + 280 days = 2024-10-07
      expect(calculateEdd('2024-01-01')).toBe('2024-10-07');
    });

    it('crosses into the following calendar year seamlessly', () => {
      // LMP in late 2026 delivers in 2027
      expect(calculateEdd('2026-06-15')).toBe('2027-03-22');
    });
  });

  describe('calculateGestationalAge', () => {
    it('returns null for future dates relative to asOfDate', () => {
      expect(calculateGestationalAge('2026-05-10', '2026-05-01')).toBeNull();
    });

    it('returns 0w 0d on the day of LMP', () => {
      const ga = calculateGestationalAge('2026-05-01', '2026-05-01');
      expect(ga).not.toBeNull();
      expect(ga?.weeks).toBe(0);
      expect(ga?.days).toBe(0);
      expect(ga?.totalDays).toBe(0);
      expect(ga?.formatted).toBe('0w 0d');
      expect(ga?.isPlausiblePregnancy).toBe(true);
    });

    it('accurately computes weeks and remaining days', () => {
      // 25 days later = 3 weeks and 4 days
      const ga = calculateGestationalAge('2026-05-01', '2026-05-26');
      expect(ga).not.toBeNull();
      expect(ga?.weeks).toBe(3);
      expect(ga?.days).toBe(4);
      expect(ga?.totalDays).toBe(25);
      expect(ga?.formatted).toBe('3w 4d');
      expect(ga?.fullFormatted).toBe('3 weeks 4 days');
      expect(ga?.isPlausiblePregnancy).toBe(true);
    });

    it('flags dates past 44 weeks (>308 days) as not a plausible active pregnancy', () => {
      // 320 days later = 45w 5d
      const ga = calculateGestationalAge('2025-01-01', '2025-11-17');
      expect(ga).not.toBeNull();
      expect(ga?.weeks).toBe(45);
      expect(ga?.isPlausiblePregnancy).toBe(false);
    });
  });

  describe('formatGpal (Gravida, Para, Abortions, Living)', () => {
    it('returns null when no fields are present', () => {
      expect(formatGpal({})).toBeNull();
      expect(formatGpal({ gravida: null, para: null })).toBeNull();
    });

    it('formats partial or full obstetric scores', () => {
      expect(formatGpal({ gravida: 0, para: 0 })).toBe('G0 P0');
      expect(formatGpal({ gravida: 2, para: 1 })).toBe('G2 P1');
      expect(formatGpal({ gravida: 3, para: 1, abortions: 1, living: 1 })).toBe('G3 P1 A1 L1');
      expect(formatGpal({ gravida: 4, para: 2, abortions: 1, living: 2 })).toBe('G4 P2 A1 L2');
    });

    it('handles loose object types safely', () => {
      expect(formatGpal({ gravida: 'bad' as unknown as number })).toBeNull();
    });
  });
});
