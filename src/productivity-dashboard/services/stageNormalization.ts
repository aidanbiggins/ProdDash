// Stage Normalization Service for the Recruiter Productivity Dashboard

import { CanonicalStage, Candidate, Event } from '../types';
import { StageMappingConfig, StageMapping, DashboardConfig } from '../types/config';

// ===== STAGE MAPPING DETECTION =====

/**
 * Extracts all unique stage names from candidates and events
 */
export function extractAllStages(candidates: Candidate[], events: Event[]): string[] {
  const stages = new Set<string>();

  // From candidates
  candidates.forEach(c => {
    if (c.current_stage) {
      stages.add(c.current_stage);
    }
  });

  // From events
  events.forEach(e => {
    if (e.from_stage) {
      stages.add(e.from_stage);
    }
    if (e.to_stage) {
      stages.add(e.to_stage);
    }
  });

  return Array.from(stages).sort();
}

/**
 * Auto-suggest mappings based on common naming patterns
 */
export function autoSuggestMappings(atsStages: string[]): StageMapping[] {
  const suggestions: StageMapping[] = [];
  const mapped = new Set<string>();

  const patterns: Array<{ regex: RegExp; canonical: CanonicalStage }> = [
    // Lead stage
    { regex: /^lead$/i, canonical: CanonicalStage.LEAD },
    { regex: /prospect/i, canonical: CanonicalStage.LEAD },
    { regex: /sourced$/i, canonical: CanonicalStage.LEAD },

    // Applied stage
    { regex: /^applied$/i, canonical: CanonicalStage.APPLIED },
    { regex: /^application/i, canonical: CanonicalStage.APPLIED },
    { regex: /^new$/i, canonical: CanonicalStage.APPLIED },
    { regex: /^submitted$/i, canonical: CanonicalStage.APPLIED },

    // Screen stage (recruiter screen)
    { regex: /recruiter.*screen/i, canonical: CanonicalStage.SCREEN },
    { regex: /phone.*screen/i, canonical: CanonicalStage.SCREEN },
    { regex: /^screen$/i, canonical: CanonicalStage.SCREEN },
    { regex: /initial.*screen/i, canonical: CanonicalStage.SCREEN },
    { regex: /ta.*screen/i, canonical: CanonicalStage.SCREEN },

    // HM Screen stage
    { regex: /hiring.*manager.*screen/i, canonical: CanonicalStage.HM_SCREEN },
    { regex: /hm.*screen/i, canonical: CanonicalStage.HM_SCREEN },
    { regex: /manager.*review/i, canonical: CanonicalStage.HM_SCREEN },
    { regex: /submitted.*to.*hm/i, canonical: CanonicalStage.HM_SCREEN },
    { regex: /tech.*screen/i, canonical: CanonicalStage.HM_SCREEN },

    // Onsite/Interview stage
    { regex: /onsite/i, canonical: CanonicalStage.ONSITE },
    { regex: /panel.*interview/i, canonical: CanonicalStage.ONSITE },
    { regex: /virtual.*onsite/i, canonical: CanonicalStage.ONSITE },
    { regex: /interview.*loop/i, canonical: CanonicalStage.ONSITE },
    { regex: /full.*loop/i, canonical: CanonicalStage.ONSITE },
    { regex: /team.*interview/i, canonical: CanonicalStage.ONSITE },

    // Final stage
    { regex: /^final$/i, canonical: CanonicalStage.FINAL },
    { regex: /final.*round/i, canonical: CanonicalStage.FINAL },
    { regex: /exec.*interview/i, canonical: CanonicalStage.FINAL },
    { regex: /leadership.*interview/i, canonical: CanonicalStage.FINAL },
    { regex: /debrief/i, canonical: CanonicalStage.FINAL },

    // Offer stage
    { regex: /^offer$/i, canonical: CanonicalStage.OFFER },
    { regex: /offer.*extended/i, canonical: CanonicalStage.OFFER },
    { regex: /offer.*pending/i, canonical: CanonicalStage.OFFER },
    { regex: /pending.*offer/i, canonical: CanonicalStage.OFFER },

    // Hired stage
    { regex: /^hired$/i, canonical: CanonicalStage.HIRED },
    { regex: /offer.*accepted/i, canonical: CanonicalStage.HIRED },
    { regex: /accepted/i, canonical: CanonicalStage.HIRED },
    { regex: /start.*date/i, canonical: CanonicalStage.HIRED },

    // Rejected stage
    { regex: /reject/i, canonical: CanonicalStage.REJECTED },
    { regex: /declined.*by.*company/i, canonical: CanonicalStage.REJECTED },
    { regex: /not.*selected/i, canonical: CanonicalStage.REJECTED },
    { regex: /closed.*not.*hired/i, canonical: CanonicalStage.REJECTED },

    // Withdrew stage
    { regex: /withdrew/i, canonical: CanonicalStage.WITHDREW },
    { regex: /withdrawn/i, canonical: CanonicalStage.WITHDREW },
    { regex: /candidate.*declined/i, canonical: CanonicalStage.WITHDREW },
    { regex: /offer.*declined/i, canonical: CanonicalStage.WITHDREW },
    { regex: /no.*longer.*interested/i, canonical: CanonicalStage.WITHDREW }
  ];

  for (const stage of atsStages) {
    if (mapped.has(stage)) continue;

    for (const pattern of patterns) {
      if (pattern.regex.test(stage)) {
        suggestions.push({
          atsStage: stage,
          canonicalStage: pattern.canonical
        });
        mapped.add(stage);
        break;
      }
    }
  }

  return suggestions;
}

/**
 * Validates that all required canonical stages have at least one mapping
 */
export function validateStageMappingCompleteness(mappings: StageMapping[]): {
  isComplete: boolean;
  missingStages: CanonicalStage[];
  mappedStages: CanonicalStage[];
} {
  const requiredStages: CanonicalStage[] = [
    CanonicalStage.SCREEN,
    CanonicalStage.HM_SCREEN,
    CanonicalStage.ONSITE,
    CanonicalStage.OFFER,
    CanonicalStage.HIRED,
    CanonicalStage.REJECTED
  ];

  const mappedCanonical = new Set(mappings.map(m => m.canonicalStage));
  const missingStages = requiredStages.filter(s => !mappedCanonical.has(s));

  return {
    isComplete: missingStages.length === 0,
    missingStages,
    mappedStages: Array.from(mappedCanonical)
  };
}

/**
 * Creates a stage mapping configuration from a list of mappings and unmapped stages
 */
export function createStageMappingConfig(
  mappings: StageMapping[],
  allStages: string[]
): StageMappingConfig {
  const mappedAtsStages = new Set(mappings.map(m => m.atsStage));
  const unmappedStages = allStages.filter(s => !mappedAtsStages.has(s));
  const completeness = validateStageMappingCompleteness(mappings);

  return {
    mappings,
    unmappedStages,
    isComplete: completeness.isComplete
  };
}

// ===== STAGE NORMALIZATION =====

/**
 * Normalizes an ATS stage name to a canonical stage
 */
export function normalizeStage(
  atsStage: string | null | undefined,
  config: StageMappingConfig
): CanonicalStage | null {
  if (!atsStage) return null;

  const mapping = config.mappings.find(m =>
    m.atsStage.toLowerCase() === atsStage.toLowerCase()
  );

  return mapping?.canonicalStage || null;
}

/**
 * Normalizes all stages in candidates array
 */
export interface NormalizedCandidate extends Candidate {
  canonicalStage: CanonicalStage | null;
}

export function normalizeCandidateStages(
  candidates: Candidate[],
  config: StageMappingConfig
): NormalizedCandidate[] {
  return candidates.map(c => ({
    ...c,
    canonicalStage: normalizeStage(c.current_stage, config)
  }));
}

/**
 * Normalizes all stages in events array
 */
export interface NormalizedEvent extends Event {
  canonicalFromStage: CanonicalStage | null;
  canonicalToStage: CanonicalStage | null;
}

export function normalizeEventStages(
  events: Event[],
  config: StageMappingConfig
): NormalizedEvent[] {
  return events.map(e => ({
    ...e,
    canonicalFromStage: normalizeStage(e.from_stage, config),
    canonicalToStage: normalizeStage(e.to_stage, config)
  }));
}

// ===== STAGE ORDERING =====

const STAGE_ORDER: Record<CanonicalStage, number> = {
  [CanonicalStage.LEAD]: 0,
  [CanonicalStage.APPLIED]: 1,
  [CanonicalStage.SCREEN]: 2,
  [CanonicalStage.HM_SCREEN]: 3,
  [CanonicalStage.ONSITE]: 4,
  [CanonicalStage.FINAL]: 5,
  [CanonicalStage.OFFER]: 6,
  [CanonicalStage.HIRED]: 7,
  [CanonicalStage.REJECTED]: 8,
  [CanonicalStage.WITHDREW]: 9
};

export function compareStages(a: CanonicalStage, b: CanonicalStage): number {
  return STAGE_ORDER[a] - STAGE_ORDER[b];
}

export function isProgression(from: CanonicalStage, to: CanonicalStage): boolean {
  // A progression is moving forward in the funnel (lower to higher order)
  // Reject/Withdraw are considered end states, not progressions
  if (to === CanonicalStage.REJECTED || to === CanonicalStage.WITHDREW) {
    return false;
  }
  return STAGE_ORDER[to] > STAGE_ORDER[from];
}

export function getNextStage(current: CanonicalStage): CanonicalStage | null {
  const currentOrder = STAGE_ORDER[current];
  const nextOrder = currentOrder + 1;

  // Find stage with next order
  const entry = Object.entries(STAGE_ORDER).find(([_, order]) => order === nextOrder);
  return entry ? entry[0] as CanonicalStage : null;
}

// ===== CONFIG MANAGEMENT =====

const CONFIG_STORAGE_KEY = 'productivity_dashboard_config';
const CONFIG_HISTORY_KEY = 'productivity_dashboard_config_history';

/**
 * Saves configuration to local storage
 */
export function saveConfig(config: DashboardConfig): void {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

/**
 * Loads configuration from local storage
 */
export function loadConfig(): DashboardConfig | null {
  const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (!stored) return null;

  try {
    const config = JSON.parse(stored) as DashboardConfig;
    config.lastUpdated = new Date(config.lastUpdated);
    return config;
  } catch {
    return null;
  }
}

/**
 * Records a config change for audit purposes
 */
export function recordConfigChange(
  userId: string,
  userName: string,
  changeType: 'stageMapping' | 'levelWeights' | 'marketWeights' | 'nicheWeights' | 'thresholds',
  previousValue: unknown,
  newValue: unknown
): void {
  const history = getConfigHistory();

  history.push({
    id: `change_${Date.now()}`,
    timestamp: new Date(),
    userId,
    userName,
    changeType,
    previousValue: JSON.stringify(previousValue),
    newValue: JSON.stringify(newValue)
  });

  // Keep last 100 changes
  if (history.length > 100) {
    history.splice(0, history.length - 100);
  }

  localStorage.setItem(CONFIG_HISTORY_KEY, JSON.stringify(history));
}

/**
 * Gets config change history
 */
export function getConfigHistory(): Array<{
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  changeType: string;
  previousValue: string;
  newValue: string;
}> {
  const stored = localStorage.getItem(CONFIG_HISTORY_KEY);
  if (!stored) return [];

  try {
    const history = JSON.parse(stored);
    return history.map((h: { timestamp: string | Date; id: string; userId: string; userName: string; changeType: string; previousValue: string; newValue: string }) => ({
      ...h,
      timestamp: new Date(h.timestamp)
    }));
  } catch {
    return [];
  }
}
