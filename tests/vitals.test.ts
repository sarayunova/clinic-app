import { describe, expect, it } from 'vitest';
import { evaluateVitalsAlerts, getHighestSeverity, calculateBmi } from '../web/src/vitalsAlerts.js';

describe('MEOWS & Clinical Vitals Alerts', () => {
  it('returns no alerts for normal physiological vitals', () => {
    const normal = {
      systolicMmhg: 120,
      diastolicMmhg: 80,
      pulseBpm: 72,
      temperatureC: 36.8,
      spo2Pct: 98,
      respRate: 16,
    };
    const alerts = evaluateVitalsAlerts(normal);
    expect(alerts).toEqual([]);
    expect(getHighestSeverity(alerts)).toBeNull();
  });

  describe('blood pressure alerts', () => {
    it('flags severe hypertension (red danger) for systolic >= 160 or diastolic >= 110', () => {
      const redSys = evaluateVitalsAlerts({ systolicMmhg: 162, diastolicMmhg: 95 });
      expect(redSys).toHaveLength(1);
      expect(redSys[0]).toMatchObject({ parameter: 'bp', severity: 'danger', label: 'Severe BP' });

      const redDia = evaluateVitalsAlerts({ systolicMmhg: 135, diastolicMmhg: 112 });
      expect(redDia).toHaveLength(1);
      expect(redDia[0]).toMatchObject({ parameter: 'bp', severity: 'danger', label: 'Severe BP' });
      expect(getHighestSeverity(redDia)).toBe('danger');
    });

    it('flags high blood pressure (amber warning) for systolic >= 140 or diastolic >= 90', () => {
      const warnSys = evaluateVitalsAlerts({ systolicMmhg: 145, diastolicMmhg: 85 });
      expect(warnSys).toHaveLength(1);
      expect(warnSys[0]).toMatchObject({ parameter: 'bp', severity: 'warn', label: 'High BP' });

      const warnDia = evaluateVitalsAlerts({ systolicMmhg: 125, diastolicMmhg: 92 });
      expect(warnDia).toHaveLength(1);
      expect(warnDia[0]).toMatchObject({ parameter: 'bp', severity: 'warn', label: 'High BP' });
      expect(getHighestSeverity(warnDia)).toBe('warn');
    });

    it('flags hypotension (warning) and severe hypotension (danger)', () => {
      const low = evaluateVitalsAlerts({ systolicMmhg: 88, diastolicMmhg: 58 });
      expect(low).toHaveLength(1);
      expect(low[0]).toMatchObject({ parameter: 'bp', severity: 'warn', label: 'Low BP' });

      const severeLow = evaluateVitalsAlerts({ systolicMmhg: 75, diastolicMmhg: 45 });
      expect(severeLow).toHaveLength(1);
      expect(severeLow[0]).toMatchObject({ parameter: 'bp', severity: 'danger', label: 'Severe Low BP' });
    });
  });

  describe('heart rate / pulse alerts', () => {
    it('flags severe tachycardia (>= 120 bpm) and tachycardia (>= 100 bpm)', () => {
      const severe = evaluateVitalsAlerts({ pulseBpm: 125 });
      expect(severe).toHaveLength(1);
      expect(severe[0]).toMatchObject({ parameter: 'pulse', severity: 'danger', label: 'Severe Tachycardia' });

      const warn = evaluateVitalsAlerts({ pulseBpm: 104 });
      expect(warn).toHaveLength(1);
      expect(warn[0]).toMatchObject({ parameter: 'pulse', severity: 'warn', label: 'Tachycardia' });
    });

    it('flags bradycardia (< 50 bpm) and severe bradycardia (< 40 bpm)', () => {
      const warn = evaluateVitalsAlerts({ pulseBpm: 46 });
      expect(warn).toHaveLength(1);
      expect(warn[0]).toMatchObject({ parameter: 'pulse', severity: 'warn', label: 'Bradycardia' });

      const severe = evaluateVitalsAlerts({ pulseBpm: 36 });
      expect(severe).toHaveLength(1);
      expect(severe[0]).toMatchObject({ parameter: 'pulse', severity: 'danger', label: 'Severe Bradycardia' });
    });
  });

  describe('temperature alerts', () => {
    it('flags high pyrexia (>= 38.5°C) and pyrexia (>= 38.0°C)', () => {
      const red = evaluateVitalsAlerts({ temperatureC: 38.7 });
      expect(red).toHaveLength(1);
      expect(red[0]).toMatchObject({ parameter: 'temperature', severity: 'danger', label: 'High Fever' });

      const yellow = evaluateVitalsAlerts({ temperatureC: 38.2 });
      expect(yellow).toHaveLength(1);
      expect(yellow[0]).toMatchObject({ parameter: 'temperature', severity: 'warn', label: 'Pyrexia' });
    });

    it('flags hypothermia (< 36.0°C) and severe hypothermia (< 35.0°C)', () => {
      const yellow = evaluateVitalsAlerts({ temperatureC: 35.6 });
      expect(yellow).toHaveLength(1);
      expect(yellow[0]).toMatchObject({ parameter: 'temperature', severity: 'warn', label: 'Hypothermia' });

      const red = evaluateVitalsAlerts({ temperatureC: 34.5 });
      expect(red).toHaveLength(1);
      expect(red[0]).toMatchObject({ parameter: 'temperature', severity: 'danger', label: 'Severe Hypothermia' });
    });
  });

  describe('oxygen saturation alerts', () => {
    it('flags low SpO2 (< 95%) and severe hypoxia (< 92%)', () => {
      const low = evaluateVitalsAlerts({ spo2Pct: 93 });
      expect(low).toHaveLength(1);
      expect(low[0]).toMatchObject({ parameter: 'spo2', severity: 'warn', label: 'Low SpO₂' });

      const severe = evaluateVitalsAlerts({ spo2Pct: 89 });
      expect(severe).toHaveLength(1);
      expect(severe[0]).toMatchObject({ parameter: 'spo2', severity: 'danger', label: 'Severe Hypoxia' });
    });
  });

  describe('respiratory rate alerts', () => {
    it('flags tachypnea and bradypnea thresholds', () => {
      const severeFast = evaluateVitalsAlerts({ respRate: 32 });
      expect(severeFast[0]).toMatchObject({ parameter: 'respRate', severity: 'danger', label: 'Severe Tachypnea' });

      const fast = evaluateVitalsAlerts({ respRate: 26 });
      expect(fast[0]).toMatchObject({ parameter: 'respRate', severity: 'warn', label: 'Tachypnea' });

      const slow = evaluateVitalsAlerts({ respRate: 10 });
      expect(slow[0]).toMatchObject({ parameter: 'respRate', severity: 'warn', label: 'Bradypnea' });

      const severeSlow = evaluateVitalsAlerts({ respRate: 7 });
      expect(severeSlow[0]).toMatchObject({ parameter: 'respRate', severity: 'danger', label: 'Severe Bradypnea' });
    });
  });

  describe('form input coercion & combinations', () => {
    it('handles string input values from form state', () => {
      const alerts = evaluateVitalsAlerts({
        systolicMmhg: '155',
        diastolicMmhg: '96',
        pulseBpm: '108',
        temperatureC: '38.1',
      });
      expect(alerts).toHaveLength(3); // BP, pulse, temp
      expect(getHighestSeverity(alerts)).toBe('warn');
    });

    it('determines highest severity when danger and warn are mixed', () => {
      const mixed = evaluateVitalsAlerts({
        systolicMmhg: 165, // danger
        pulseBpm: 105,     // warn
        spo2Pct: 94,       // warn
      });
      expect(getHighestSeverity(mixed)).toBe('danger');
    });

    it('safely handles empty, null or undefined input', () => {
      expect(evaluateVitalsAlerts(null)).toEqual([]);
      expect(evaluateVitalsAlerts(undefined)).toEqual([]);
      expect(evaluateVitalsAlerts({})).toEqual([]);
      expect(evaluateVitalsAlerts({ systolicMmhg: '' })).toEqual([]);
    });
  });

  describe('BMI calculation', () => {
    it('calculates BMI and categorizes correctly', () => {
      // Normal: 65 kg, 170 cm -> 65 / (1.7 * 1.7) = 22.49 -> 22.5
      expect(calculateBmi(65, 170)).toEqual({ bmi: 22.5, category: 'Normal' });

      // Underweight: 42 kg, 160 cm -> 42 / 2.56 = 16.4
      expect(calculateBmi(42, 160)).toEqual({ bmi: 16.4, category: 'Underweight' });

      // Overweight: 75 kg, 165 cm -> 75 / 2.7225 = 27.5
      expect(calculateBmi(75, 165)).toEqual({ bmi: 27.5, category: 'Overweight' });

      // Obese: 95 kg, 165 cm -> 95 / 2.7225 = 34.9
      expect(calculateBmi(95, 165)).toEqual({ bmi: 34.9, category: 'Obese' });
    });

    it('returns null when values are missing or zero', () => {
      expect(calculateBmi(undefined, 170)).toBeNull();
      expect(calculateBmi(60, 0)).toBeNull();
      expect(calculateBmi(0, 160)).toBeNull();
      expect(calculateBmi('', '160')).toBeNull();
    });
  });
});
