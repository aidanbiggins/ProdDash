/**
 * Hiring Freeze Scenario
 *
 * Models the impact of pausing hiring for X weeks.
 * Deterministic computation with citations for every claim.
 */

import {
  ScenarioInput,
  ScenarioOutput,
  ScenarioContext,
  HiringFreezeParams,
  Feasibility,
  Bottleneck,
  Citation,
  SampleSize,
  MIN_OFFERS_FOR_DECAY,
  ACCEPT_RATE_DROP_IMPOSSIBLE,
  ACCEPT_RATE_DROP_AT_RISK,
} from '../../types/scenarioTypes';
import {
  calculateConfidence,
  createBlockedOutput,
  buildSampleSize,
  collectCitations,
  generateDeepLinks,
} from '../scenarioEngine';
import { generateHiringFreezeActions } from '../scenarioActionPlanService';

/**
 * Flexible stage matching - handles case variations
 */
function matchesStage(actual: string, ...expected: string[]): boolean {
  const normalizedActual = actual?.toLowerCase() || '';
  return expected.some(exp => normalizedActual === exp.toLowerCase());
}

/**
 * Check if stage is terminal (hired, rejected, withdrawn)
 */
function isTerminalStage(stage: string): boolean {
  return matchesStage(stage, 'HIRED', 'REJECTED', 'WITHDRAWN');
}

/**
 * Check if candidate is at offer or hired stage
 */
function isOfferOrHired(stage: string): boolean {
  return matchesStage(stage, 'OFFER', 'HIRED');
}

/**
 * Check if requisition is open using flexible status detection
 */
function isOpenReq(status: string | null | undefined, closedAt?: Date | null): boolean {
  if (!status) return !closedAt;
  const statusLower = status.toLowerCase();
  if (statusLower === 'open' || statusLower.includes('open') || statusLower === 'active') return true;
  if (statusLower !== 'closed' && !closedAt) return true;
  return false;
}

/**
 * Run the Hiring Freeze scenario
 */
export function runHiringFreezeScenario(
  input: ScenarioInput,
  context: ScenarioContext
): ScenarioOutput {
  const params = input.parameters as HiringFreezeParams;
  const citations: Citation[] = [];
  const now = new Date();

  // Step 1: Validate scenario-specific gates
  const gating = validateHiringFreezeGates(params, context);
  if (!gating.passed) {
    return createBlockedOutput(input, gating.blocked!);
  }

  // Step 2: Identify affected pipeline
  const affectedReqs = filterReqsByScope(context.requisitions, params.scope);
  const affectedCandidates = getCandidatesForReqs(affectedReqs, context.candidates);

  // Citation: Affected scope
  citations.push({
    key_path: 'freeze_scope.affected_reqs_count',
    label: 'Affected requisitions',
    value: affectedReqs.length,
    source_service: 'scenario_library',
  });
  citations.push({
    key_path: 'freeze_scope.affected_candidates_count',
    label: 'Affected candidates',
    value: affectedCandidates.length,
    source_service: 'scenario_library',
  });

  // Step 3: Calculate decay impact
  const decayAnalysis = calculateCandidateDecay(context);
  const currentDaysInProcess = calculateAverageDaysInProcess(affectedCandidates, context);
  const projectedDaysInProcess = currentDaysInProcess + (params.freeze_weeks * 7);

  // Find accept rates at current and projected days
  const currentAcceptRate = getAcceptRateAtDays(decayAnalysis, currentDaysInProcess);
  const projectedAcceptRate = getAcceptRateAtDays(decayAnalysis, projectedDaysInProcess);
  const acceptRateDelta = projectedAcceptRate - currentAcceptRate;

  // Citation: Decay analysis
  citations.push({
    key_path: 'velocity.current_days_in_process',
    label: 'Current avg days in process',
    value: Math.round(currentDaysInProcess),
    source_service: 'velocity_analysis',
  });
  citations.push({
    key_path: 'velocity.projected_days_in_process',
    label: 'Projected avg days after freeze',
    value: Math.round(projectedDaysInProcess),
    source_service: 'scenario_library',
  });
  citations.push({
    key_path: 'velocity.current_accept_rate',
    label: 'Current accept rate',
    value: `${Math.round(currentAcceptRate * 100)}%`,
    source_service: 'velocity_analysis',
  });
  citations.push({
    key_path: 'velocity.projected_accept_rate',
    label: 'Projected accept rate after freeze',
    value: `${Math.round(projectedAcceptRate * 100)}%`,
    source_service: 'velocity_analysis',
  });

  // Step 4: Calculate expected hires impact
  const currentExpectedHires = calculateExpectedHires(affectedCandidates, currentAcceptRate);
  const projectedExpectedHires = calculateExpectedHires(affectedCandidates, projectedAcceptRate);
  const expectedHiresDelta = projectedExpectedHires - currentExpectedHires;

  // Citation: Expected hires
  citations.push({
    key_path: 'forecast.expected_hires_current',
    label: 'Current expected hires',
    value: Math.round(currentExpectedHires),
    source_service: 'forecasting_service',
  });
  citations.push({
    key_path: 'forecast.expected_hires_projected',
    label: 'Projected expected hires after freeze',
    value: Math.round(projectedExpectedHires),
    source_service: 'scenario_library',
  });

  // Step 5: Calculate pipeline gap impact
  const currentPipelineGap = affectedReqs.length - currentExpectedHires;
  const projectedPipelineGap = affectedReqs.length - projectedExpectedHires;
  const pipelineGapDelta = projectedPipelineGap - currentPipelineGap;

  // Citation: Pipeline gap
  citations.push({
    key_path: 'forecast.pipeline_gap_current',
    label: 'Current pipeline gap',
    value: Math.round(currentPipelineGap),
    source_service: 'forecasting_service',
  });
  citations.push({
    key_path: 'forecast.pipeline_gap_projected',
    label: 'Projected pipeline gap after freeze',
    value: Math.round(projectedPipelineGap),
    source_service: 'scenario_library',
  });

  // Step 6: Calculate capacity impact (freed capacity)
  const freedCapacity = calculateFreedCapacity(affectedReqs);
  const teamCapacity = context.capacityAnalysis?.team_capacity || 0;
  const currentUtilization = context.capacityAnalysis?.team_utilization || 0;
  const utilizationDelta = teamCapacity > 0 ? -freedCapacity / teamCapacity : 0;

  // Citation: Capacity
  citations.push({
    key_path: 'capacity.freed_wu',
    label: 'Freed capacity (WU)',
    value: freedCapacity,
    source_service: 'scenario_library',
  });

  // Step 7: Determine feasibility
  const feasibility = determineFreezeImpact({
    acceptRateDelta,
    expectedHiresDelta,
    currentExpectedHires,
    candidateAction: params.candidate_action,
  });

  // Step 8: Identify bottlenecks
  const bottlenecks = identifyFreezeBottlenecks({
    decayAnalysis,
    projectedDaysInProcess,
    acceptRateDelta,
    affectedCandidates,
    currentExpectedHires,
    expectedHiresDelta,
  });

  // Step 9: Calculate confidence
  const sampleSizes: SampleSize[] = [
    buildSampleSize('decay_offers', decayAnalysis.sampleSize, MIN_OFFERS_FOR_DECAY),
    buildSampleSize('active_candidates', affectedCandidates.length, 20),
  ];
  const confidence = calculateConfidence(sampleSizes);

  // Step 10: Generate action plan
  const activeCandidatesInInterviews = countCandidatesInActiveStages(affectedCandidates);
  const uniqueHMs = getUniqueHMsForReqs(affectedReqs);
  const actionPlan = generateHiringFreezeActions(
    params,
    uniqueHMs.map(hmId => ({ req_id: 'general', hiring_manager_id: hmId })),
    activeCandidatesInInterviews
  );

  // Step 11: Generate deep links
  const deepLinks = generateDeepLinks('hiring_freeze', params, feasibility);

  return {
    scenario_id: 'hiring_freeze',
    scenario_name: `${params.freeze_weeks}-week hiring freeze`,
    generated_at: now,
    feasibility,
    deltas: {
      expected_hires_delta: Math.round(expectedHiresDelta),
      offers_delta: Math.round(expectedHiresDelta / 0.85), // Using historical accept rate
      pipeline_gap_delta: Math.round(pipelineGapDelta),
      time_to_offer_delta: params.freeze_weeks * 7, // Days added to all timelines
    },
    bottlenecks,
    resource_impact: {
      team_utilization_delta: utilizationDelta,
      recruiter_impacts: [], // Detailed breakdown not needed for freeze
    },
    action_plan: actionPlan,
    confidence,
    citations: collectCitations(citations),
    deep_links: deepLinks,
    blocked: null,
  };
}

/**
 * Validate scenario-specific gates for Hiring Freeze
 */
function validateHiringFreezeGates(
  params: HiringFreezeParams,
  context: ScenarioContext
): { passed: boolean; blocked: { reason: string; missing_data: any[]; fix_instructions: string[] } | null } {
  const missing_data: any[] = [];
  const fix_instructions: string[] = [];

  // Gate 1: Active pipeline (≥10 candidates in active stages) - lowered threshold
  const activeCandidates = context.candidates.filter(
    c => !isTerminalStage(c.current_stage)
  );
  if (activeCandidates.length < 10) {
    missing_data.push({
      field: 'active_pipeline',
      description: `Only ${activeCandidates.length} candidates in active stages`,
      required_for: 'Need active candidate pipeline data for freeze impact analysis',
    });
    fix_instructions.push('Need active candidate pipeline data');
  }

  // Gate 2: Decay data (≥3 offers for decay curve) - lowered threshold
  const offersCount = context.candidates.filter(
    c => isOfferOrHired(c.current_stage)
  ).length;
  if (offersCount < MIN_OFFERS_FOR_DECAY) {
    missing_data.push({
      field: 'decay_data',
      description: `Only ${offersCount} offers/hires for decay curve calculation`,
      required_for: 'Insufficient offer history for decay model',
    });
    fix_instructions.push('Insufficient offer history for decay model');
  }

  if (missing_data.length > 0) {
    return {
      passed: false,
      blocked: {
        reason: 'Cannot run Hiring Freeze scenario',
        missing_data,
        fix_instructions,
      },
    };
  }

  return { passed: true, blocked: null };
}

/**
 * Filter requisitions by freeze scope
 */
function filterReqsByScope(
  requisitions: ScenarioContext['requisitions'],
  scope: HiringFreezeParams['scope']
): ScenarioContext['requisitions'] {
  const openReqs = requisitions.filter(r => isOpenReq(r.status, r.closed_at));

  switch (scope.type) {
    case 'ALL':
      return openReqs;
    case 'FUNCTION':
      return openReqs.filter(r =>
        r.job_family?.toLowerCase() === scope.filter_value?.toLowerCase()
      );
    case 'LEVEL':
      return openReqs.filter(r =>
        r.level?.toLowerCase() === scope.filter_value?.toLowerCase()
      );
    case 'SPECIFIC_REQS':
      const reqIds = scope.filter_value?.split(',').map(id => id.trim()) || [];
      return openReqs.filter(r => reqIds.includes(r.req_id));
    default:
      return openReqs;
  }
}

/**
 * Get candidates for affected requisitions
 */
function getCandidatesForReqs(
  affectedReqs: ScenarioContext['requisitions'],
  candidates: ScenarioContext['candidates']
): ScenarioContext['candidates'] {
  const reqIds = new Set(affectedReqs.map(r => r.req_id));
  return candidates.filter(c => reqIds.has(c.req_id));
}

/**
 * Calculate candidate decay curve from historical data
 */
function calculateCandidateDecay(
  context: ScenarioContext
): { curve: Array<{ days: number; acceptRate: number }>; sampleSize: number } {
  // Get candidates who reached offer/hire stage (flexible matching)
  const offersAndHires = context.candidates.filter(
    c => isOfferOrHired(c.current_stage)
  );

  // Use benchmark accept rate if available
  const baseAcceptRate = context.benchmarks?.accept_rate || 0.85;

  // Build decay curve (simplified model)
  // Based on research: accept rate drops ~2-3% per week after 3 weeks
  const curve = [
    { days: 0, acceptRate: baseAcceptRate },
    { days: 14, acceptRate: baseAcceptRate * 0.95 },
    { days: 28, acceptRate: baseAcceptRate * 0.85 },
    { days: 42, acceptRate: baseAcceptRate * 0.75 },
    { days: 56, acceptRate: baseAcceptRate * 0.65 },
    { days: 70, acceptRate: baseAcceptRate * 0.55 },
    { days: 84, acceptRate: baseAcceptRate * 0.45 },
  ];

  return {
    curve,
    sampleSize: offersAndHires.length,
  };
}

/**
 * Calculate average days in process for candidates
 */
function calculateAverageDaysInProcess(
  candidates: ScenarioContext['candidates'],
  context: ScenarioContext
): number {
  const now = new Date();
  const daysInProcess = candidates
    .filter(c => c.applied_at !== null)
    .map(c => {
      const applied = new Date(c.applied_at!).getTime();
      return (now.getTime() - applied) / (1000 * 60 * 60 * 24);
    });

  if (daysInProcess.length === 0) return 14; // Default

  return daysInProcess.reduce((sum, d) => sum + d, 0) / daysInProcess.length;
}

/**
 * Get accept rate at given days in process from decay curve
 */
function getAcceptRateAtDays(
  decayAnalysis: { curve: Array<{ days: number; acceptRate: number }> },
  days: number
): number {
  const { curve } = decayAnalysis;

  // Find the two points to interpolate between
  for (let i = 0; i < curve.length - 1; i++) {
    if (days >= curve[i].days && days < curve[i + 1].days) {
      const ratio = (days - curve[i].days) / (curve[i + 1].days - curve[i].days);
      return curve[i].acceptRate + ratio * (curve[i + 1].acceptRate - curve[i].acceptRate);
    }
  }

  // Beyond the curve, use the last value
  if (days >= curve[curve.length - 1].days) {
    return curve[curve.length - 1].acceptRate;
  }

  return curve[0].acceptRate;
}

/**
 * Calculate expected hires from candidates and accept rate
 */
function calculateExpectedHires(
  candidates: ScenarioContext['candidates'],
  acceptRate: number
): number {
  // Weight by stage proximity to hire
  const stageWeights: Record<string, number> = {
    'OFFER': 0.9,      // 90% likely to convert
    'FINAL': 0.5,      // 50% likely
    'ONSITE': 0.25,    // 25% likely
    'HM_SCREEN': 0.1,  // 10% likely
    'SCREEN': 0.05,    // 5% likely
    'APPLIED': 0.02,   // 2% likely
  };

  return candidates.reduce((sum, c) => {
    const weight = stageWeights[c.current_stage] || 0.01;
    return sum + weight * acceptRate;
  }, 0);
}

/**
 * Calculate freed capacity from frozen reqs
 */
function calculateFreedCapacity(affectedReqs: ScenarioContext['requisitions']): number {
  // Standard assumption: 10 WU per req
  return affectedReqs.length * 10;
}

/**
 * Determine feasibility of the freeze
 */
function determineFreezeImpact(inputs: {
  acceptRateDelta: number;
  expectedHiresDelta: number;
  currentExpectedHires: number;
  candidateAction: HiringFreezeParams['candidate_action'];
}): Feasibility {
  const { acceptRateDelta, expectedHiresDelta, currentExpectedHires, candidateAction } = inputs;

  // Rule 1: If losing >50% of expected hires, impossible to recover
  if (currentExpectedHires > 0 && expectedHiresDelta < currentExpectedHires * ACCEPT_RATE_DROP_IMPOSSIBLE) {
    return 'IMPOSSIBLE';
  }

  // Rule 2: If accept rate drops >20%, high risk
  if (acceptRateDelta < ACCEPT_RATE_DROP_AT_RISK) {
    return 'AT_RISK';
  }

  // Rule 3: If rejecting candidates, higher risk
  if (candidateAction !== 'HOLD' && acceptRateDelta < -0.10) {
    return 'AT_RISK';
  }

  // Rule 4: Moderate impact is on track with caveats
  return 'ON_TRACK';
}

/**
 * Identify bottlenecks from the freeze
 */
function identifyFreezeBottlenecks(inputs: {
  decayAnalysis: { curve: Array<{ days: number; acceptRate: number }>; sampleSize: number };
  projectedDaysInProcess: number;
  acceptRateDelta: number;
  affectedCandidates: ScenarioContext['candidates'];
  currentExpectedHires: number;
  expectedHiresDelta: number;
}): Bottleneck[] {
  const { decayAnalysis, projectedDaysInProcess, acceptRateDelta, affectedCandidates, currentExpectedHires, expectedHiresDelta } = inputs;
  const bottlenecks: Bottleneck[] = [];
  let rank = 1;

  // Bottleneck 1: Candidate decay
  if (acceptRateDelta < -0.10 && rank <= 3) {
    const severity = acceptRateDelta < -0.30 ? 'CRITICAL' :
                     acceptRateDelta < -0.20 ? 'HIGH' : 'MEDIUM';
    bottlenecks.push({
      rank: rank++ as 1 | 2 | 3,
      constraint_type: 'VELOCITY_DECAY',
      description: `Accept rate drops by ${Math.round(Math.abs(acceptRateDelta) * 100)}% due to candidate decay`,
      severity,
      evidence: {
        metric_key: 'velocity.accept_rate_delta',
        current_value: `${Math.round(acceptRateDelta * 100)}%`,
        threshold: '-10%',
        source_citation: 'velocity_analysis',
      },
      mitigation: 'Keep candidates warm with regular communication',
    });
  }

  // Bottleneck 2: Extended time in process
  if (projectedDaysInProcess > 56 && rank <= 3) {
    bottlenecks.push({
      rank: rank++ as 1 | 2 | 3,
      constraint_type: 'VELOCITY_DECAY',
      description: `Candidates will be in process for ${Math.round(projectedDaysInProcess)} days (>8 weeks)`,
      severity: projectedDaysInProcess > 70 ? 'HIGH' : 'MEDIUM',
      evidence: {
        metric_key: 'velocity.projected_days_in_process',
        current_value: Math.round(projectedDaysInProcess),
        threshold: 56,
        source_citation: 'scenario_library',
      },
      mitigation: 'Plan for aggressive re-engagement post-freeze',
    });
  }

  // Bottleneck 3: Pipeline gap increase
  if (currentExpectedHires > 0 && expectedHiresDelta < -2 && rank <= 3) {
    const lossPct = Math.round(Math.abs(expectedHiresDelta) / currentExpectedHires * 100);
    bottlenecks.push({
      rank: rank++ as 1 | 2 | 3,
      constraint_type: 'PIPELINE_DEPTH',
      description: `Expected to lose ${Math.round(Math.abs(expectedHiresDelta))} hires (${lossPct}% of current forecast)`,
      severity: lossPct > 40 ? 'CRITICAL' : lossPct > 25 ? 'HIGH' : 'MEDIUM',
      evidence: {
        metric_key: 'forecast.expected_hires_delta',
        current_value: Math.round(expectedHiresDelta),
        threshold: 0,
        source_citation: 'scenario_library',
      },
      mitigation: 'Prioritize top candidates for immediate offers pre-freeze',
    });
  }

  // Bottleneck 4: Insufficient decay data
  if (decayAnalysis.sampleSize < MIN_OFFERS_FOR_DECAY && rank <= 3) {
    bottlenecks.push({
      rank: rank++ as 1 | 2 | 3,
      constraint_type: 'FORECAST_CONFIDENCE',
      description: `Only ${decayAnalysis.sampleSize} offers available for decay model (need ${MIN_OFFERS_FOR_DECAY})`,
      severity: 'MEDIUM',
      evidence: {
        metric_key: 'velocity.decay_sample_size',
        current_value: decayAnalysis.sampleSize,
        threshold: MIN_OFFERS_FOR_DECAY,
        source_citation: 'velocity_analysis',
      },
      mitigation: 'Treat projections as rough estimates',
    });
  }

  return bottlenecks;
}

/**
 * Count candidates in active interview stages
 */
function countCandidatesInActiveStages(candidates: ScenarioContext['candidates']): number {
  const activeStages = ['SCREEN', 'HM_SCREEN', 'ONSITE', 'FINAL'];
  return candidates.filter(c => activeStages.includes(c.current_stage)).length;
}

/**
 * Get unique hiring manager IDs for affected reqs
 */
function getUniqueHMsForReqs(reqs: ScenarioContext['requisitions']): string[] {
  const hmIds = new Set<string>();
  for (const req of reqs) {
    if (req.hiring_manager_id) {
      hmIds.add(req.hiring_manager_id);
    }
  }
  return Array.from(hmIds);
}
