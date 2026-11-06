/**
 * Objective clinical & obstetric early warning triggers (MEOWS-inspired).
 *
 * Designed to flag abnormal physiological parameters (blood pressure, pulse,
 * temperature, oxygen saturation, respiratory rate) without making automated
 * diagnoses, adhering strictly to clinic decision-support safety.
 */

export type AlertSeverity = 'danger' | 'warn';

export interface VitalAlert {
  parameter: 'bp' | 'pulse' | 'temperature' | 'spo2' | 'respRate';
  severity: AlertSeverity;
  label: string;
  valueText: string;
  message: string;
}

export interface VitalsInput {
  systolicMmhg?: number | string | null;
  diastolicMmhg?: number | string | null;
  pulseBpm?: number | string | null;
  temperatureC?: number | string | null;
  spo2Pct?: number | string | null;
  respRate?: number | string | null;
  weightKg?: number | string | null;
  heightCm?: number | string | null;
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Evaluates objective early warning triggers according to clinical & MEOWS criteria:
 * - Blood Pressure:
 *   - Severe: Systolic >= 160 or Diastolic >= 110 (Danger)
 *   - Severe Hypotension: Systolic < 80 or Diastolic < 50 (Danger)
 *   - High BP: Systolic >= 140 or Diastolic >= 90 (Warning)
 *   - Low BP: Systolic < 90 or Diastolic < 60 (Warning)
 * - Heart Rate / Pulse:
 *   - Severe Tachycardia: >= 120 bpm (Danger)
 *   - Severe Bradycardia: < 40 bpm (Danger)
 *   - Tachycardia: >= 100 bpm (Warning)
 *   - Bradycardia: < 50 bpm (Warning)
 * - Temperature (°C):
 *   - High Pyrexia: >= 38.5°C (Danger)
 *   - Severe Hypothermia: < 35.0°C (Danger)
 *   - Pyrexia: >= 38.0°C (Warning)
 *   - Hypothermia: < 36.0°C (Warning)
 * - Oxygen Saturation (SpO2 %):
 *   - Severe Hypoxia: < 92% (Danger)
 *   - Low SpO2: < 95% (Warning)
 * - Respiratory Rate (/min):
 *   - Critical Tachypnea: >= 30/min (Danger)
 *   - Critical Bradypnea: <= 8/min (Danger)
 *   - Tachypnea: >= 24/min (Warning)
 *   - Bradypnea: <= 10/min (Warning)
 */
export function evaluateVitalsAlerts(input?: VitalsInput | null): VitalAlert[] {
  if (!input) return [];
  const alerts: VitalAlert[] = [];

  const sys = num(input.systolicMmhg);
  const dia = num(input.diastolicMmhg);
  const pulse = num(input.pulseBpm);
  const temp = num(input.temperatureC);
  const spo2 = num(input.spo2Pct);
  const resp = num(input.respRate);

  // 1. Blood Pressure
  if (sys != null || dia != null) {
    const bpText =
      sys != null && dia != null ? `${sys}/${dia} mmHg` : sys != null ? `${sys}/— mmHg` : `—/${dia} mmHg`;

    if ((sys != null && sys >= 160) || (dia != null && dia >= 110)) {
      alerts.push({
        parameter: 'bp',
        severity: 'danger',
        label: 'Severe BP',
        valueText: bpText,
        message: 'Systolic ≥ 160 or Diastolic ≥ 110 mmHg: severe hypertension alert',
      });
    } else if ((sys != null && sys < 80) || (dia != null && dia < 50)) {
      alerts.push({
        parameter: 'bp',
        severity: 'danger',
        label: 'Severe Low BP',
        valueText: bpText,
        message: 'Systolic < 80 or Diastolic < 50 mmHg: severe hypotension',
      });
    } else if ((sys != null && sys >= 140) || (dia != null && dia >= 90)) {
      alerts.push({
        parameter: 'bp',
        severity: 'warn',
        label: 'High BP',
        valueText: bpText,
        message: 'Systolic ≥ 140 or Diastolic ≥ 90 mmHg: elevated / obstetric warning trigger',
      });
    } else if ((sys != null && sys < 90) || (dia != null && dia < 60)) {
      alerts.push({
        parameter: 'bp',
        severity: 'warn',
        label: 'Low BP',
        valueText: bpText,
        message: 'Systolic < 90 or Diastolic < 60 mmHg: hypotension',
      });
    }
  }

  // 2. Pulse / Heart Rate
  if (pulse != null) {
    const pulseText = `${pulse} bpm`;
    if (pulse >= 120) {
      alerts.push({
        parameter: 'pulse',
        severity: 'danger',
        label: 'Severe Tachycardia',
        valueText: pulseText,
        message: 'Heart rate ≥ 120 bpm: severe tachycardia',
      });
    } else if (pulse < 40) {
      alerts.push({
        parameter: 'pulse',
        severity: 'danger',
        label: 'Severe Bradycardia',
        valueText: pulseText,
        message: 'Heart rate < 40 bpm: severe bradycardia',
      });
    } else if (pulse >= 100) {
      alerts.push({
        parameter: 'pulse',
        severity: 'warn',
        label: 'Tachycardia',
        valueText: pulseText,
        message: 'Heart rate 100–119 bpm: elevated heart rate',
      });
    } else if (pulse < 50) {
      alerts.push({
        parameter: 'pulse',
        severity: 'warn',
        label: 'Bradycardia',
        valueText: pulseText,
        message: 'Heart rate 40–49 bpm: low heart rate',
      });
    }
  }

  // 3. Temperature (°C)
  if (temp != null) {
    const tempText = `${temp}°C`;
    if (temp >= 38.5) {
      alerts.push({
        parameter: 'temperature',
        severity: 'danger',
        label: 'High Fever',
        valueText: tempText,
        message: 'Temperature ≥ 38.5°C: high pyrexia',
      });
    } else if (temp < 35.0) {
      alerts.push({
        parameter: 'temperature',
        severity: 'danger',
        label: 'Severe Hypothermia',
        valueText: tempText,
        message: 'Temperature < 35.0°C: severe hypothermia',
      });
    } else if (temp >= 38.0) {
      alerts.push({
        parameter: 'temperature',
        severity: 'warn',
        label: 'Pyrexia',
        valueText: tempText,
        message: 'Temperature 38.0–38.4°C: elevated temperature',
      });
    } else if (temp < 36.0) {
      alerts.push({
        parameter: 'temperature',
        severity: 'warn',
        label: 'Hypothermia',
        valueText: tempText,
        message: 'Temperature 35.0–35.9°C: low body temperature',
      });
    }
  }

  // 4. Oxygen Saturation (SpO2 %)
  if (spo2 != null) {
    const spo2Text = `${spo2}%`;
    if (spo2 < 92) {
      alerts.push({
        parameter: 'spo2',
        severity: 'danger',
        label: 'Severe Hypoxia',
        valueText: spo2Text,
        message: 'SpO₂ < 92%: critical oxygen saturation',
      });
    } else if (spo2 < 95) {
      alerts.push({
        parameter: 'spo2',
        severity: 'warn',
        label: 'Low SpO₂',
        valueText: spo2Text,
        message: 'SpO₂ 92–94%: low oxygen saturation',
      });
    }
  }

  // 5. Respiratory Rate (breaths/min)
  if (resp != null) {
    const respText = `${resp}/min`;
    if (resp >= 30) {
      alerts.push({
        parameter: 'respRate',
        severity: 'danger',
        label: 'Severe Tachypnea',
        valueText: respText,
        message: 'Respiratory rate ≥ 30/min: critical tachypnea',
      });
    } else if (resp <= 8) {
      alerts.push({
        parameter: 'respRate',
        severity: 'danger',
        label: 'Severe Bradypnea',
        valueText: respText,
        message: 'Respiratory rate ≤ 8/min: critical bradypnea',
      });
    } else if (resp >= 24) {
      alerts.push({
        parameter: 'respRate',
        severity: 'warn',
        label: 'Tachypnea',
        valueText: respText,
        message: 'Respiratory rate 24–29/min: elevated breathing rate',
      });
    } else if (resp <= 10) {
      alerts.push({
        parameter: 'respRate',
        severity: 'warn',
        label: 'Bradypnea',
        valueText: respText,
        message: 'Respiratory rate 9–10/min: low breathing rate',
      });
    }
  }

  return alerts;
}

export function getHighestSeverity(alerts: VitalAlert[]): AlertSeverity | null {
  if (alerts.some((a) => a.severity === 'danger')) return 'danger';
  if (alerts.some((a) => a.severity === 'warn')) return 'warn';
  return null;
}

export function calculateBmi(
  weightKg?: number | string | null,
  heightCm?: number | string | null,
): { bmi: number; category: 'Underweight' | 'Normal' | 'Overweight' | 'Obese' } | null {
  const w = num(weightKg);
  const h = num(heightCm);
  if (w == null || h == null || w <= 0 || h <= 0) return null;
  const heightM = h / 100;
  const rawBmi = w / (heightM * heightM);
  const bmi = Math.round(rawBmi * 10) / 10;
  let category: 'Underweight' | 'Normal' | 'Overweight' | 'Obese' = 'Normal';
  if (bmi < 18.5) category = 'Underweight';
  else if (bmi < 25.0) category = 'Normal';
  else if (bmi < 30.0) category = 'Overweight';
  else category = 'Obese';
  return { bmi, category };
}
