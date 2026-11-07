// Antimicrobial Stewardship (AMS), AWaRe Classification & Antibiogram Engine
// Reference: WHO AWaRe Classification 2023, CDC Core Elements of Hospital Antibiotic Stewardship,
// and CLSI M39 Cumulative Antibiogram Guidelines.

export type AwareTier = 'access' | 'watch' | 'reserve';

export interface AntibioticMetadata {
  name: string;
  tier: AwareTier;
  routeDefault: 'iv' | 'oral';
  requiresRestrictedApproval: boolean;
  pediatricDosingHint: string;
}

export const AWARE_FORMULARY: Record<string, AntibioticMetadata> = {
  // ACCESS (First & second choice, narrower spectrum, lower resistance potential)
  Ampicillin: {
    name: 'Ampicillin',
    tier: 'access',
    routeDefault: 'iv',
    requiresRestrictedApproval: false,
    pediatricDosingHint: '50-100 mg/kg/dose IV q8-12h (Listeria, GBS, Enterococcus)',
  },
  Amoxicillin: {
    name: 'Amoxicillin',
    tier: 'access',
    routeDefault: 'oral',
    requiresRestrictedApproval: false,
    pediatricDosingHint: '40-90 mg/kg/day PO divided q8-12h (CAP, AOM)',
  },
  'Amoxicillin-Clavulanate': {
    name: 'Amoxicillin-Clavulanate',
    tier: 'access',
    routeDefault: 'oral',
    requiresRestrictedApproval: false,
    pediatricDosingHint: '45-90 mg/kg/day PO divided q12h',
  },
  Cefazolin: {
    name: 'Cefazolin',
    tier: 'access',
    routeDefault: 'iv',
    requiresRestrictedApproval: false,
    pediatricDosingHint: '25-50 mg/kg/dose IV q8h (Surgical prophylaxis, MSSA)',
  },
  Cloxacillin: {
    name: 'Cloxacillin',
    tier: 'access',
    routeDefault: 'iv',
    requiresRestrictedApproval: false,
    pediatricDosingHint: '25-50 mg/kg/dose IV q6h (Anti-staphylococcal)',
  },
  Gentamicin: {
    name: 'Gentamicin',
    tier: 'access',
    routeDefault: 'iv',
    requiresRestrictedApproval: false,
    pediatricDosingHint: '4-5 mg/kg IV once daily (Synergistic Gram-negative cover)',
  },
  Metronidazole: {
    name: 'Metronidazole',
    tier: 'access',
    routeDefault: 'iv',
    requiresRestrictedApproval: false,
    pediatricDosingHint: '7.5-15 mg/kg/dose IV q8-12h (Anaerobes, NEC)',
  },

  // WATCH (Higher resistance potential, targets of intense surveillance)
  Cefotaxime: {
    name: 'Cefotaxime',
    tier: 'watch',
    routeDefault: 'iv',
    requiresRestrictedApproval: false,
    pediatricDosingHint: '50 mg/kg/dose IV q6-8h (Neonatal sepsis & meningitis)',
  },
  Ceftriaxone: {
    name: 'Ceftriaxone',
    tier: 'watch',
    routeDefault: 'iv',
    requiresRestrictedApproval: false,
    pediatricDosingHint: '50-100 mg/kg IV once daily (Avoid in neonates with hyperbilirubinemia)',
  },
  'Piperacillin-Tazobactam': {
    name: 'Piperacillin-Tazobactam',
    tier: 'watch',
    routeDefault: 'iv',
    requiresRestrictedApproval: true,
    pediatricDosingHint: '80-100 mg/kg/dose IV q6-8h (Pseudomonas, nosocomial sepsis)',
  },
  Meropenem: {
    name: 'Meropenem',
    tier: 'watch',
    routeDefault: 'iv',
    requiresRestrictedApproval: true,
    pediatricDosingHint: '20-40 mg/kg/dose IV q8h (Extended infusion for ESBL)',
  },
  Vancomycin: {
    name: 'Vancomycin',
    tier: 'watch',
    routeDefault: 'iv',
    requiresRestrictedApproval: true,
    pediatricDosingHint: '15 mg/kg/dose IV q8h (MRSA, Ampicillin-resistant Enterococcus)',
  },
  Amikacin: {
    name: 'Amikacin',
    tier: 'watch',
    routeDefault: 'iv',
    requiresRestrictedApproval: false,
    pediatricDosingHint: '15 mg/kg IV once daily (Hospital-acquired Gram-negative bacilli)',
  },
  Ciprofloxacin: {
    name: 'Ciprofloxacin',
    tier: 'watch',
    routeDefault: 'iv',
    requiresRestrictedApproval: true,
    pediatricDosingHint: '10-15 mg/kg/dose IV/PO q12h (Complicated enteric fever, Pseudomonas)',
  },

  // RESERVE (Last-resort, reserved for multidrug-resistant pathogens)
  Colistin: {
    name: 'Colistin',
    tier: 'reserve',
    routeDefault: 'iv',
    requiresRestrictedApproval: true,
    pediatricDosingHint: '75,000-150,000 IU/kg/day IV divided q8h (Carbapenem-resistant GNB)',
  },
  Linezolid: {
    name: 'Linezolid',
    tier: 'reserve',
    routeDefault: 'iv',
    requiresRestrictedApproval: true,
    pediatricDosingHint: '10 mg/kg/dose IV/PO q8h (Vancomycin-resistant Enterococcus, MRSA)',
  },
  'Polymyxin B': {
    name: 'Polymyxin B',
    tier: 'reserve',
    routeDefault: 'iv',
    requiresRestrictedApproval: true,
    pediatricDosingHint: '15,000-25,000 U/kg/day IV divided q12h (Pan-drug resistant isolates)',
  },
  'Ceftazidime-Avibactam': {
    name: 'Ceftazidime-Avibactam',
    tier: 'reserve',
    routeDefault: 'iv',
    requiresRestrictedApproval: true,
    pediatricDosingHint: '50 mg/kg/dose IV q8h (OXA-48 / KPC carbapenemase producers)',
  },
};

export function lookupAwareTier(drugName: string): AwareTier {
  const match = Object.keys(AWARE_FORMULARY).find(
    k => k.toLowerCase() === drugName.trim().toLowerCase()
  );
  return match && AWARE_FORMULARY[match] ? AWARE_FORMULARY[match].tier : 'watch';
}

export function isRestrictedApprovalRequired(drugName: string): boolean {
  const match = Object.keys(AWARE_FORMULARY).find(
    k => k.toLowerCase() === drugName.trim().toLowerCase()
  );
  return match && AWARE_FORMULARY[match] ? AWARE_FORMULARY[match].requiresRestrictedApproval : false;
}

export interface TimeoutEvaluation {
  isTimeoutDue: boolean;
  hoursElapsed: number;
  urgency: 'routine' | 'due_warning' | 'overdue_critical';
  recommendation: string;
}

export function evaluateAntibioticTimeout(params: {
  prescribedDatetime: string;
  hasReviewLogged: boolean;
  cultureResultSummary?: string;
  clinicalResponse?: string;
}): TimeoutEvaluation {
  const now = new Date();
  const start = new Date(params.prescribedDatetime);
  const diffHours = Math.max(0, Math.round(((now.getTime() - start.getTime()) / (1000 * 60 * 60)) * 10) / 10);

  if (params.hasReviewLogged) {
    return {
      isTimeoutDue: false,
      hoursElapsed: diffHours,
      urgency: 'routine',
      recommendation: 'Timeout review completed. Continue targeted surveillance.',
    };
  }

  if (diffHours >= 72) {
    return {
      isTimeoutDue: true,
      hoursElapsed: diffHours,
      urgency: 'overdue_critical',
      recommendation: 'OVERDUE TIMEOUT (≥ 72h): Mandatory clinical review required. Review culture sensitivities and de-escalate or discontinue empiric coverage.',
    };
  } else if (diffHours >= 48) {
    return {
      isTimeoutDue: true,
      hoursElapsed: diffHours,
      urgency: 'due_warning',
      recommendation: 'ANTIBIOTIC TIMEOUT DUE (48-72h): Microbiology preliminary results ready. Review cultures, evaluate clinical recovery, and document de-escalation plan.',
    };
  }

  return {
    isTimeoutDue: false,
    hoursElapsed: diffHours,
    urgency: 'routine',
    recommendation: `Empiric phase (${diffHours}h elapsed). Antibiotic timeout due at 48 hours.`,
  };
}

export interface AntibiogramRow {
  pathogen: string;
  totalIsolates: number;
  drugs: Record<
    string,
    {
      testedCount: number;
      susceptibleCount: number;
      susceptibilityPct: number;
    }
  >;
}

export function generateAntibiogram(
  isolates: Array<{
    pathogen_isolated: string;
    sensitivities_json: string;
  }>
): AntibiogramRow[] {
  const map: Record<string, { total: number; drugs: Record<string, { tested: number; s: number }> }> = {};

  for (const iso of isolates) {
    const pathogen = iso.pathogen_isolated.trim();
    if (!map[pathogen]) {
      map[pathogen] = { total: 0, drugs: {} };
    }
    const pathogenData = map[pathogen]!;
    pathogenData.total += 1;

    let sens: Record<string, string> = {};
    try {
      sens = JSON.parse(iso.sensitivities_json || '{}');
    } catch {
      sens = {};
    }

    for (const [drug, result] of Object.entries(sens)) {
      if (!pathogenData.drugs[drug]) {
        pathogenData.drugs[drug] = { tested: 0, s: 0 };
      }
      const drugStat = pathogenData.drugs[drug]!;
      drugStat.tested += 1;
      if (result.toUpperCase() === 'S') {
        drugStat.s += 1;
      }
    }
  }

  const resultRows: AntibiogramRow[] = [];

  for (const [pathogen, data] of Object.entries(map)) {
    const drugsMap: AntibiogramRow['drugs'] = {};

    for (const [drug, st] of Object.entries(data.drugs)) {
      const pct = st.tested > 0 ? Math.round((st.s / st.tested) * 100) : 0;
      drugsMap[drug] = {
        testedCount: st.tested,
        susceptibleCount: st.s,
        susceptibilityPct: pct,
      };
    }

    resultRows.push({
      pathogen,
      totalIsolates: data.total,
      drugs: drugsMap,
    });
  }

  return resultRows.sort((a, b) => b.totalIsolates - a.totalIsolates);
}
