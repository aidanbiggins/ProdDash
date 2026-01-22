// Demo Types - Types for Ultimate Demo data generation
// See docs/plans/ULTIMATE_DEMO_DATA_INTERACTIVE_V1.md

import { Requisition, Candidate, Event, User } from './entities';
import { DataSnapshot, SnapshotEvent } from './snapshotTypes';

// ============================================
// DEMO PACK CONFIGURATION
// ============================================

export interface DemoPackConfig {
  core_ats: boolean;
  recruiter_hm: boolean;
  offers_outcomes: boolean;
  snapshots_diffs: boolean;
  capacity_history: boolean;
  calibration_history: boolean;
  scenarios: boolean;
  synthetic_pii: boolean;
  ai_stubs: boolean;
}

export const DEFAULT_PACK_CONFIG: DemoPackConfig = {
  core_ats: true,
  recruiter_hm: true,
  offers_outcomes: true,
  snapshots_diffs: true,
  capacity_history: true,
  calibration_history: true,
  scenarios: true,
  synthetic_pii: true,
  ai_stubs: true,
};

export const MINIMAL_PACK_CONFIG: DemoPackConfig = {
  core_ats: true,
  recruiter_hm: false,
  offers_outcomes: false,
  snapshots_diffs: false,
  capacity_history: false,
  calibration_history: false,
  scenarios: false,
  synthetic_pii: false,
  ai_stubs: false,
};

// ============================================
// PACK METADATA
// ============================================

export interface DemoPackInfo {
  id: keyof DemoPackConfig;
  name: string;
  description: string;
  dependencies: (keyof DemoPackConfig)[];
}

export const DEMO_PACK_INFO: DemoPackInfo[] = [
  {
    id: 'core_ats',
    name: 'Core ATS',
    description: 'Requisitions, candidates, basic stage progression',
    dependencies: [],
  },
  {
    id: 'recruiter_hm',
    name: 'Recruiter + HM Assignments',
    description: 'Recruiter ownership, HM assignments per req',
    dependencies: ['core_ats'],
  },
  {
    id: 'offers_outcomes',
    name: 'Offers & Outcomes',
    description: 'Offer extended/accepted/declined/withdrawn data',
    dependencies: ['core_ats'],
  },
  {
    id: 'snapshots_diffs',
    name: 'Snapshots & Diffs',
    description: 'Multiple import snapshots for dwell/regression/SLA',
    dependencies: ['core_ats'],
  },
  {
    id: 'capacity_history',
    name: 'Capacity History',
    description: '8+ weeks of throughput data for inference',
    dependencies: ['core_ats', 'recruiter_hm'],
  },
  {
    id: 'calibration_history',
    name: 'Calibration History',
    description: '20+ completed hires with predictions for backtest',
    dependencies: ['core_ats', 'offers_outcomes'],
  },
  {
    id: 'scenarios',
    name: 'Scenarios Library',
    description: 'Hiring freeze, recruiter leaves, spin-up team data',
    dependencies: ['core_ats', 'recruiter_hm'],
  },
  {
    id: 'synthetic_pii',
    name: 'Synthetic PII',
    description: 'Fake names/emails/phones to trigger PII detection',
    dependencies: ['core_ats'],
  },
  {
    id: 'ai_stubs',
    name: 'AI Fallback Stubs',
    description: 'Deterministic narratives for AI-off mode',
    dependencies: [],
  },
];

// ============================================
// AI STUBS
// ============================================

export interface AIStub {
  intent: string;
  response: string;
  citations: string[];
  confidence: 'high' | 'medium';
}

// ============================================
// CALIBRATION HISTORY
// ============================================

export interface CalibrationRecord {
  reqId: string;
  predictedFillDate: Date;
  actualFillDate: Date;
  deviationDays: number;
  roleProfile: {
    function: string;
    level: string;
    locationType: string;
  };
}

// ============================================
// CAPABILITY PREVIEW
// ============================================

export interface CapabilityPreview {
  enabled: string[];
  disabled: string[];
  disabledReasons: Record<string, string>;
}

// ============================================
// DEMO CANDIDATE (extends Candidate with optional PII fields)
// ============================================

export interface DemoCandidate extends Candidate {
  // Optional PII fields for synthetic_pii pack
  email?: string | null;
  phone?: string | null;
}

// ============================================
// DEMO BUNDLE
// ============================================

export interface UltimateDemoBundle {
  // Core data (always present if core_ats enabled)
  requisitions: Requisition[];
  candidates: DemoCandidate[];  // Uses DemoCandidate for PII support
  events: Event[];
  users: User[];

  // Optional based on packs
  snapshots?: DataSnapshot[];
  snapshotEvents?: SnapshotEvent[];
  calibrationHistory?: CalibrationRecord[];
  aiStubs?: AIStub[];

  // Metadata
  seed: string;
  packsEnabled: DemoPackConfig;
  generatedAt: Date;

  // Capability preview (what this config enables)
  capabilityPreview: CapabilityPreview;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a pack's dependencies are satisfied
 */
export function arePackDependenciesMet(
  packId: keyof DemoPackConfig,
  config: DemoPackConfig
): boolean {
  const packInfo = DEMO_PACK_INFO.find(p => p.id === packId);
  if (!packInfo) return true;

  return packInfo.dependencies.every(dep => config[dep]);
}

/**
 * Get missing dependencies for a pack
 */
export function getMissingDependencies(
  packId: keyof DemoPackConfig,
  config: DemoPackConfig
): (keyof DemoPackConfig)[] {
  const packInfo = DEMO_PACK_INFO.find(p => p.id === packId);
  if (!packInfo) return [];

  return packInfo.dependencies.filter(dep => !config[dep]);
}

/**
 * Resolve pack config with dependencies (auto-enable required packs)
 */
export function resolvePackDependencies(
  config: Partial<DemoPackConfig>
): DemoPackConfig {
  const resolved: DemoPackConfig = { ...DEFAULT_PACK_CONFIG };

  // Apply user config
  for (const [key, value] of Object.entries(config)) {
    if (key in resolved) {
      resolved[key as keyof DemoPackConfig] = value as boolean;
    }
  }

  // Auto-enable dependencies for enabled packs
  for (const pack of DEMO_PACK_INFO) {
    if (resolved[pack.id]) {
      for (const dep of pack.dependencies) {
        resolved[dep] = true;
      }
    }
  }

  return resolved;
}
