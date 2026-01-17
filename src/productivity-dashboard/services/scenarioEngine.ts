/**
 * Scenario Engine
 *
 * Core engine for running recruiting scenarios. Handles gating, routing,
 * confidence calculation, and output assembly.
 *
 * Design principles:
 * - Deterministic engine is source of truth (AI never computes)
 * - Fail closed with NOT_ENOUGH_DATA when data is missing
 * - Explainable with citations for every computed claim
 */

import {
  ScenarioInput,
  ScenarioOutput,
  ScenarioContext,
  ScenarioId,
  ScenarioParameters,
  Feasibility,
  BlockedInfo,
  GatingResult,
  ConfidenceAssessment,
  SampleSize,
  Citation,
  DeepLink,
  MIN_RECRUITERS,
  MIN_OPEN_REQS,
  MIN_RECRUITER_ID_COVERAGE,
  HIGH_CONFIDENCE_MULTIPLIER,
  MED_CONFIDENCE_MULTIPLIER,
  RecruiterLeavesParams,
  HiringFreezeParams,
  SpinUpTeamParams,
} from '../types/scenarioTypes';

// Import scenario implementations
import { runRecruiterLeavesScenario } from './scenarios/recruiterLeavesScenario';
import { runSpinUpTeamScenario } from './scenarios/spinUpTeamScenario';
import { runHiringFreezeScenario } from './scenarios/hiringFreezeScenario';

/**
 * Check if a requisition is open using flexible status detection
 */
function isOpenReq(status: string | null | undefined, closedAt: Date | null): boolean {
  if (status === 'Open' || status === 'OPEN') return true;
  const statusLower = status?.toLowerCase() || '';
  if (statusLower.includes('open') || statusLower === 'active') return true;
  if (status !== 'Closed' && status !== 'CLOSED' && !closedAt) return true;
  return false;
}

/**
 * Main entry point for running scenarios.
 * Routes to the appropriate scenario handler after validating global gates.
 */
export function runScenario(
  input: ScenarioInput,
  context: ScenarioContext
): ScenarioOutput {
  // Step 1: Validate global gates
  const globalGating = validateGlobalGates(context);
  if (!globalGating.passed) {
    return createBlockedOutput(input, globalGating.blocked!);
  }

  // Step 2: Route to scenario-specific handler
  switch (input.scenario_id) {
    case 'recruiter_leaves':
      return runRecruiterLeavesScenario(input, context);
    case 'spin_up_team':
      return runSpinUpTeamScenario(input, context);
    case 'hiring_freeze':
      return runHiringFreezeScenario(input, context);
    default:
      return createBlockedOutput(input, {
        reason: `Unknown scenario type: ${input.scenario_id}`,
        missing_data: [],
        fix_instructions: ['Use a valid scenario ID: spin_up_team, hiring_freeze, or recruiter_leaves'],
      });
  }
}

/**
 * Validate global gating requirements that apply to all scenarios.
 */
export function validateGlobalGates(context: ScenarioContext): GatingResult {
  const missing_data: BlockedInfo['missing_data'] = [];
  const fix_instructions: string[] = [];

  // Gate 1: Minimum recruiters (≥3)
  const activeRecruiters = context.recruiters.filter(r => r.demand_wu > 0);
  if (activeRecruiters.length < MIN_RECRUITERS) {
    missing_data.push({
      field: 'recruiters',
      description: `Only ${activeRecruiters.length} active recruiters found`,
      required_for: 'All scenarios require at least 3 active recruiters',
    });
    fix_instructions.push('Add recruiter_id to requisition records');
  }

  // Gate 2: Minimum open reqs (≥10)
  const openReqs = context.requisitions.filter(r => isOpenReq(r.status, r.closed_at));
  if (openReqs.length < MIN_OPEN_REQS) {
    missing_data.push({
      field: 'open_reqs',
      description: `Only ${openReqs.length} open requisitions found`,
      required_for: 'All scenarios require at least 10 open requisitions',
    });
    fix_instructions.push('Import more requisition data');
  }

  // Gate 3: Recruiter ID coverage (≥50%)
  const reqsWithRecruiter = context.requisitions.filter(r => r.recruiter_id !== null);
  const coverage = context.requisitions.length > 0
    ? reqsWithRecruiter.length / context.requisitions.length
    : 0;
  if (coverage < MIN_RECRUITER_ID_COVERAGE) {
    missing_data.push({
      field: 'recruiter_id_coverage',
      description: `Only ${Math.round(coverage * 100)}% of requisitions have recruiter assignments`,
      required_for: 'All scenarios require at least 50% recruiter ID coverage',
    });
    fix_instructions.push('Ensure recruiter assignments in source data');
  }

  // Gate 4: Event history exists
  if (context.events.length === 0) {
    missing_data.push({
      field: 'events',
      description: 'No candidate event history found',
      required_for: 'Scenarios use event data for pipeline analysis',
    });
    fix_instructions.push('Import candidate event history');
  }

  if (missing_data.length > 0) {
    return {
      passed: false,
      blocked: {
        reason: 'Insufficient data to run scenario',
        missing_data,
        fix_instructions,
      },
    };
  }

  return { passed: true, blocked: null };
}

/**
 * Calculate confidence assessment based on sample sizes.
 */
export function calculateConfidence(sampleSizes: SampleSize[]): ConfidenceAssessment {
  // Check for any insufficient data
  const insufficientData = sampleSizes.filter(s => !s.sufficient);

  if (insufficientData.length > 0) {
    return {
      level: 'LOW',
      reasons: insufficientData.map(
        s => `${s.metric_key}: n=${s.n} below minimum ${s.threshold}`
      ),
      sample_sizes: sampleSizes,
    };
  }

  // Check if all samples exceed HIGH threshold (2x)
  const allHigh = sampleSizes.every(
    s => s.n >= s.threshold * HIGH_CONFIDENCE_MULTIPLIER
  );

  // Check if all samples exceed MED threshold (1.5x)
  const allMed = sampleSizes.every(
    s => s.n >= s.threshold * MED_CONFIDENCE_MULTIPLIER
  );

  return {
    level: allHigh ? 'HIGH' : allMed ? 'MED' : 'LOW',
    reasons: allHigh
      ? ['All metrics have sufficient sample sizes']
      : ['Some metrics have limited sample sizes'],
    sample_sizes: sampleSizes,
  };
}

/**
 * Create a blocked output when scenario cannot run.
 */
export function createBlockedOutput(
  input: ScenarioInput,
  blocked: BlockedInfo
): ScenarioOutput {
  return {
    scenario_id: input.scenario_id,
    scenario_name: getScenarioName(input.scenario_id, input.parameters),
    generated_at: new Date(),
    feasibility: 'NOT_ENOUGH_DATA',
    deltas: {
      expected_hires_delta: null,
      offers_delta: null,
      pipeline_gap_delta: null,
      time_to_offer_delta: null,
    },
    bottlenecks: [],
    resource_impact: null,
    action_plan: [],
    confidence: {
      level: 'LOW',
      reasons: ['Cannot calculate confidence - scenario blocked'],
      sample_sizes: [],
    },
    citations: [],
    deep_links: [],
    blocked,
  };
}

/**
 * Create a placeholder output for scenarios not yet implemented.
 */
function createNotImplementedOutput(
  input: ScenarioInput,
  scenarioId: ScenarioId
): ScenarioOutput {
  return createBlockedOutput(input, {
    reason: `Scenario '${scenarioId}' is not yet implemented`,
    missing_data: [],
    fix_instructions: ['This scenario will be available in a future update'],
  });
}

/**
 * Get human-readable scenario name.
 */
export function getScenarioName(
  scenarioId: ScenarioId,
  params: ScenarioParameters
): string {
  switch (scenarioId) {
    case 'spin_up_team': {
      const p = params as SpinUpTeamParams;
      return `Spin up ${p.headcount}-person ${p.role_profile.function} team`;
    }
    case 'hiring_freeze': {
      const p = params as HiringFreezeParams;
      return `${p.freeze_weeks}-week hiring freeze`;
    }
    case 'recruiter_leaves': {
      return 'Recruiter departure';
    }
    default:
      return 'Unknown scenario';
  }
}

/**
 * Build a sample size entry for confidence calculation.
 */
export function buildSampleSize(
  metric_key: string,
  n: number,
  threshold: number
): SampleSize {
  return {
    metric_key,
    n,
    threshold,
    sufficient: n >= threshold,
  };
}

/**
 * Collect citations from various sources into a flat list.
 */
export function collectCitations(citations: Citation[]): Citation[] {
  // Deduplicate by key_path
  const seen = new Set<string>();
  return citations.filter(c => {
    if (seen.has(c.key_path)) return false;
    seen.add(c.key_path);
    return true;
  });
}

/**
 * Add a citation to the list.
 */
export function addCitation(
  citations: Citation[],
  key_path: string,
  label: string,
  value: number | string,
  source_service: string
): void {
  citations.push({ key_path, label, value, source_service });
}

/**
 * Generate deep links based on scenario output.
 */
export function generateDeepLinks(
  scenarioId: ScenarioId,
  params: ScenarioParameters,
  feasibility: Feasibility
): DeepLink[] {
  const links: DeepLink[] = [];

  // Always link to capacity
  links.push({
    label: 'View Capacity Analysis',
    tab: 'capacity',
    params: {},
    rationale: 'Review team capacity distribution',
  });

  if (scenarioId === 'recruiter_leaves') {
    links.push({
      label: 'View Recruiter Details',
      tab: 'recruiter-detail',
      params: { recruiter_id: (params as RecruiterLeavesParams).recruiter_id },
      rationale: 'Review departing recruiter workload',
    });
  }

  if (scenarioId === 'spin_up_team') {
    links.push({
      label: 'View Velocity Metrics',
      tab: 'velocity',
      params: {},
      rationale: 'Review funnel conversion rates',
    });
    links.push({
      label: 'View Forecasting',
      tab: 'forecasting',
      params: {},
      rationale: 'Review TTF predictions',
    });
  }

  if (scenarioId === 'hiring_freeze') {
    links.push({
      label: 'View Pipeline Health',
      tab: 'control-tower',
      params: {},
      rationale: 'Review current pipeline status',
    });
  }

  return links;
}

/**
 * Create an anonymization map for recruiters.
 * Returns a map of recruiter_id -> index (0-based).
 */
export function createRecruiterIndexMap(
  recruiters: Array<{ recruiter_id: string }>
): Map<string, number> {
  const map = new Map<string, number>();
  recruiters.forEach((r, i) => map.set(r.recruiter_id, i));
  return map;
}

/**
 * Anonymize a recruiter name to "Recruiter N" format.
 */
export function anonymizeRecruiterName(
  recruiterId: string,
  indexMap: Map<string, number>
): string {
  const index = indexMap.get(recruiterId);
  if (index !== undefined) {
    return `Recruiter ${index + 1}`;
  }
  // Fallback: hash the ID
  let hash = 0;
  for (let i = 0; i < recruiterId.length; i++) {
    hash = ((hash << 5) - hash) + recruiterId.charCodeAt(i);
    hash = hash & hash;
  }
  return `Recruiter ${Math.abs(hash) % 100 + 1}`;
}

/**
 * Type guard for Recruiter Leaves params
 */
export function isRecruiterLeavesParams(
  params: ScenarioParameters
): params is RecruiterLeavesParams {
  return 'recruiter_id' in params && 'departure_date' in params;
}

/**
 * Type guard for Hiring Freeze params
 */
export function isHiringFreezeParams(
  params: ScenarioParameters
): params is HiringFreezeParams {
  return 'freeze_weeks' in params && 'candidate_action' in params;
}

/**
 * Type guard for Spin Up Team params
 */
export function isSpinUpTeamParams(
  params: ScenarioParameters
): params is SpinUpTeamParams {
  return 'headcount' in params && 'role_profile' in params;
}
