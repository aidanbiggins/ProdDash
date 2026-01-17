/**
 * Recruiter Leaves Scenario
 *
 * Models the impact when a recruiter leaves and plans for requisition reassignment.
 * Deterministic computation with citations for every claim.
 */

import {
  ScenarioInput,
  ScenarioOutput,
  ScenarioContext,
  RecruiterLeavesParams,
  Feasibility,
  Bottleneck,
  RecruiterImpact,
  ResourceImpact,
  Citation,
  SampleSize,
  RebalanceRecommendation,
  TEAM_UTILIZATION_IMPOSSIBLE,
  TEAM_UTILIZATION_AT_RISK,
  UTILIZATION_OVERLOADED,
  MIN_FIT_OBSERVATIONS,
} from '../../types/scenarioTypes';
import {
  calculateConfidence,
  createBlockedOutput,
  buildSampleSize,
  collectCitations,
  generateDeepLinks,
  createRecruiterIndexMap,
  anonymizeRecruiterName,
} from '../scenarioEngine';
import { generateRecruiterLeavesActions } from '../scenarioActionPlanService';

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
 * Run the Recruiter Leaves scenario
 */
export function runRecruiterLeavesScenario(
  input: ScenarioInput,
  context: ScenarioContext
): ScenarioOutput {
  const params = input.parameters as RecruiterLeavesParams;
  const citations: Citation[] = [];
  const now = new Date();

  // Step 1: Validate scenario-specific gates
  const gating = validateRecruiterLeavesGates(params, context);
  if (!gating.passed) {
    return createBlockedOutput(input, gating.blocked!);
  }

  // Create anonymization map for recruiters
  const recruiterIndexMap = createRecruiterIndexMap(context.recruiters);

  // Step 2: Get departing recruiter's current load
  const departingRecruiter = context.recruiters.find(
    r => r.recruiter_id === params.recruiter_id
  )!;
  const affectedReqs = context.requisitions.filter(
    r => r.recruiter_id === params.recruiter_id && isOpenReq(r.status, r.closed_at)
  );

  // Citation: departing recruiter workload
  citations.push({
    key_path: 'departing_recruiter.current_demand_wu',
    label: 'Departing recruiter workload (WU)',
    value: departingRecruiter.demand_wu,
    source_service: 'capacity_fit_engine',
  });
  citations.push({
    key_path: 'departing_recruiter.req_count',
    label: 'Departing recruiter req count',
    value: affectedReqs.length,
    source_service: 'capacity_fit_engine',
  });

  const workloadToReassign = departingRecruiter.demand_wu;

  // Step 3: Calculate team capacity after departure
  const remainingRecruiters = context.recruiters.filter(
    r => r.recruiter_id !== params.recruiter_id
  );
  const remainingCapacity = remainingRecruiters.reduce(
    (sum, r) => sum + r.capacity_wu,
    0
  );
  const currentTotalDemand = context.recruiters.reduce(
    (sum, r) => sum + r.demand_wu,
    0
  );
  const remainingDemand = currentTotalDemand; // Demand stays same, just redistributed
  const newTeamUtilization = remainingCapacity > 0
    ? remainingDemand / remainingCapacity
    : Infinity;
  const currentTeamUtilization = context.capacityAnalysis?.team_utilization || 0;

  // Citation: capacity metrics
  citations.push({
    key_path: 'capacity.remaining_capacity',
    label: 'Remaining team capacity (WU)',
    value: remainingCapacity,
    source_service: 'capacity_fit_engine',
  });
  citations.push({
    key_path: 'capacity.remaining_demand',
    label: 'Total demand (WU)',
    value: remainingDemand,
    source_service: 'capacity_fit_engine',
  });
  citations.push({
    key_path: 'capacity.new_team_utilization',
    label: 'Projected team utilization',
    value: `${Math.round(newTeamUtilization * 100)}%`,
    source_service: 'capacity_fit_engine',
  });

  // Step 4: Generate reassignment plan
  const reassignmentPlan = generateReassignmentPlan(
    params,
    affectedReqs,
    remainingRecruiters,
    context.fitMatrix,
    recruiterIndexMap
  );

  // Citation: reassignment plan
  citations.push({
    key_path: 'reassignment_plan.total_reqs',
    label: 'Requisitions to reassign',
    value: reassignmentPlan.length,
    source_service: 'scenario_library',
  });

  // Step 5: Calculate per-recruiter impact
  const recruiterImpacts = calculateRecruiterImpacts(
    remainingRecruiters,
    reassignmentPlan,
    recruiterIndexMap
  );

  // Step 6: Determine feasibility
  const unassignableReqs = affectedReqs.length - reassignmentPlan.length;
  const feasibility = determineReassignmentFeasibility({
    newTeamUtilization,
    recruiterImpacts,
    unassignableReqs,
  });

  // Step 7: Identify bottlenecks
  const bottlenecks = identifyReassignmentBottlenecks({
    recruiterImpacts,
    newTeamUtilization,
    affectedReqs: affectedReqs.length,
    reassignmentPlan,
    currentTeamUtilization,
  });

  // Step 8: Calculate confidence
  const sampleSizes: SampleSize[] = [
    buildSampleSize('remaining_recruiters', remainingRecruiters.length, 2),
    buildSampleSize('fit_observations', getFitObservationCount(context.fitMatrix), MIN_FIT_OBSERVATIONS),
  ];
  const confidence = calculateConfidence(sampleSizes);

  // Step 9: Generate action plan
  const actionPlan = generateRecruiterLeavesActions(
    params,
    affectedReqs.map(r => ({
      req_id: r.req_id,
      title: r.title,
      hiring_manager_id: r.hiring_manager_id,
    })),
    reassignmentPlan,
    affectedReqs.length,
    recruiterIndexMap
  );

  // Step 10: Calculate deltas
  const timeToOfferDelta = estimateTTODelayFromReassignment(
    reassignmentPlan,
    context.fitMatrix
  );

  // Step 11: Generate deep links
  const deepLinks = generateDeepLinks('recruiter_leaves', params, feasibility);

  return {
    scenario_id: 'recruiter_leaves',
    scenario_name: `${anonymizeRecruiterName(params.recruiter_id, recruiterIndexMap)} departure`,
    generated_at: now,
    feasibility,
    deltas: {
      expected_hires_delta: null, // Not directly impacted
      offers_delta: null, // Not directly impacted
      pipeline_gap_delta: null, // Not directly impacted
      time_to_offer_delta: timeToOfferDelta,
    },
    bottlenecks,
    resource_impact: {
      team_utilization_delta: newTeamUtilization - currentTeamUtilization,
      recruiter_impacts: recruiterImpacts,
    },
    action_plan: actionPlan,
    confidence,
    citations: collectCitations(citations),
    deep_links: deepLinks,
    blocked: null,
  };
}

/**
 * Validate scenario-specific gates for Recruiter Leaves
 */
function validateRecruiterLeavesGates(
  params: RecruiterLeavesParams,
  context: ScenarioContext
): { passed: boolean; blocked: { reason: string; missing_data: any[]; fix_instructions: string[] } | null } {
  const missing_data: any[] = [];
  const fix_instructions: string[] = [];

  // Gate 1: Selected recruiter exists and has reqs
  const recruiter = context.recruiters.find(r => r.recruiter_id === params.recruiter_id);
  if (!recruiter) {
    missing_data.push({
      field: 'recruiter',
      description: 'Selected recruiter not found in data',
      required_for: 'Cannot model departure of unknown recruiter',
    });
    fix_instructions.push('Select a valid recruiter from the list');
  } else {
    const recruiterReqs = context.requisitions.filter(
      r => r.recruiter_id === params.recruiter_id && isOpenReq(r.status, r.closed_at)
    );
    if (recruiterReqs.length === 0) {
      // More helpful message - show what reqs exist
      const allRecruiterReqs = context.requisitions.filter(
        r => r.recruiter_id === params.recruiter_id
      );
      missing_data.push({
        field: 'recruiter_reqs',
        description: allRecruiterReqs.length > 0
          ? `Selected recruiter has ${allRecruiterReqs.length} reqs but none are open`
          : 'Selected recruiter has no assigned requisitions',
        required_for: 'Recruiter Leaves scenario requires open reqs to reassign',
      });
      fix_instructions.push('Selected recruiter has no open requisitions to reassign');
    }
  }

  // Gate 2: At least 2 other recruiters available
  const otherRecruiters = context.recruiters.filter(
    r => r.recruiter_id !== params.recruiter_id
  );
  if (otherRecruiters.length < 2) {
    missing_data.push({
      field: 'remaining_recruiters',
      description: `Only ${otherRecruiters.length} other recruiter(s) available`,
      required_for: 'Need at least 2 other recruiters for reassignment',
    });
    fix_instructions.push('Need at least 2 other recruiters for reassignment');
  }

  if (missing_data.length > 0) {
    return {
      passed: false,
      blocked: {
        reason: 'Cannot run Recruiter Leaves scenario',
        missing_data,
        fix_instructions,
      },
    };
  }

  return { passed: true, blocked: null };
}

/**
 * Generate a reassignment plan for the departing recruiter's reqs
 */
function generateReassignmentPlan(
  params: RecruiterLeavesParams,
  affectedReqs: ScenarioContext['requisitions'],
  remainingRecruiters: ScenarioContext['recruiters'],
  fitMatrix: ScenarioContext['fitMatrix'],
  recruiterIndexMap: Map<string, number>
): RebalanceRecommendation[] {
  // If manual assignments, validate and use them
  if (params.reassignment_strategy === 'MANUAL' && params.manual_assignments) {
    return params.manual_assignments.map(a => {
      const req = affectedReqs.find(r => r.req_id === a.req_id);
      const toRecruiter = remainingRecruiters.find(r => r.recruiter_id === a.to_recruiter_id);
      return {
        req_id: a.req_id,
        req_title: req?.title || 'Unknown Req',
        from_recruiter_id: params.recruiter_id,
        to_recruiter_id: a.to_recruiter_id,
        demand_impact: 10, // Default WU per req
        fit_score: getFitScore(fitMatrix, a.to_recruiter_id, a.req_id),
        rationale: 'Manual assignment',
      };
    });
  }

  // Auto-generate based on strategy
  const recommendations: RebalanceRecommendation[] = [];

  // Sort recruiters by current utilization (ascending) for BALANCE_LOAD
  // Or by fit score (descending) for OPTIMIZE_FIT
  const sortedRecruiters = [...remainingRecruiters];

  if (params.reassignment_strategy === 'BALANCE_LOAD') {
    sortedRecruiters.sort((a, b) => a.utilization - b.utilization);
  }

  // Track projected utilization as we assign
  const projectedLoads = new Map<string, number>();
  remainingRecruiters.forEach(r => projectedLoads.set(r.recruiter_id, r.demand_wu));

  for (const req of affectedReqs) {
    const reqWorkload = 10; // Default WU per req

    let bestRecruiter: typeof remainingRecruiters[0] | null = null;
    let bestScore = -Infinity;

    for (const recruiter of sortedRecruiters) {
      const currentLoad = projectedLoads.get(recruiter.recruiter_id) || 0;
      const projectedUtil = (currentLoad + reqWorkload) / recruiter.capacity_wu;

      // Skip if this would severely overload
      if (projectedUtil > 1.3) continue;

      let score: number;
      if (params.reassignment_strategy === 'OPTIMIZE_FIT') {
        // Prefer higher fit score, penalize high utilization
        const fitScore = getFitScore(fitMatrix, recruiter.recruiter_id, req.req_id);
        score = fitScore - projectedUtil * 0.5;
      } else {
        // BALANCE_LOAD: prefer lower utilization
        score = 1 - projectedUtil;
      }

      if (score > bestScore) {
        bestScore = score;
        bestRecruiter = recruiter;
      }
    }

    if (bestRecruiter) {
      const fitScore = getFitScore(fitMatrix, bestRecruiter.recruiter_id, req.req_id);
      const toRecruiterAnon = anonymizeRecruiterName(bestRecruiter.recruiter_id, recruiterIndexMap);

      recommendations.push({
        req_id: req.req_id,
        req_title: req.title,
        from_recruiter_id: params.recruiter_id,
        to_recruiter_id: bestRecruiter.recruiter_id,
        demand_impact: reqWorkload,
        fit_score: fitScore,
        rationale: params.reassignment_strategy === 'OPTIMIZE_FIT'
          ? `Best fit score (${fitScore.toFixed(1)}) for ${toRecruiterAnon}`
          : `Lowest utilization assignment to ${toRecruiterAnon}`,
      });

      // Update projected load
      const newLoad = (projectedLoads.get(bestRecruiter.recruiter_id) || 0) + reqWorkload;
      projectedLoads.set(bestRecruiter.recruiter_id, newLoad);
    }
  }

  return recommendations;
}

/**
 * Calculate per-recruiter impact from reassignments
 */
function calculateRecruiterImpacts(
  remainingRecruiters: ScenarioContext['recruiters'],
  reassignmentPlan: RebalanceRecommendation[],
  recruiterIndexMap: Map<string, number>
): RecruiterImpact[] {
  return remainingRecruiters.map(r => {
    const assignedReqs = reassignmentPlan.filter(p => p.to_recruiter_id === r.recruiter_id);
    const additionalWorkload = assignedReqs.reduce((sum, p) => sum + p.demand_impact, 0);
    const projectedUtilization = r.capacity_wu > 0
      ? (r.demand_wu + additionalWorkload) / r.capacity_wu
      : Infinity;

    return {
      recruiter_id: r.recruiter_id,
      recruiter_name_anon: anonymizeRecruiterName(r.recruiter_id, recruiterIndexMap),
      current_utilization: r.utilization,
      projected_utilization: projectedUtilization,
      status_change: getStatusChange(r.utilization, projectedUtilization),
    };
  });
}

/**
 * Determine status change from current to projected utilization
 */
function getStatusChange(
  current: number,
  projected: number
): 'BECOMES_OVERLOADED' | 'BECOMES_AVAILABLE' | 'NO_CHANGE' {
  const wasOverloaded = current >= UTILIZATION_OVERLOADED;
  const willBeOverloaded = projected >= UTILIZATION_OVERLOADED;

  if (!wasOverloaded && willBeOverloaded) return 'BECOMES_OVERLOADED';
  if (wasOverloaded && !willBeOverloaded) return 'BECOMES_AVAILABLE';
  return 'NO_CHANGE';
}

/**
 * Determine feasibility of the reassignment
 */
function determineReassignmentFeasibility(inputs: {
  newTeamUtilization: number;
  recruiterImpacts: RecruiterImpact[];
  unassignableReqs: number;
}): Feasibility {
  const { newTeamUtilization, recruiterImpacts, unassignableReqs } = inputs;

  // Rule 1: If any reqs can't be assigned, impossible
  if (unassignableReqs > 0) {
    return 'IMPOSSIBLE';
  }

  // Rule 2: If team becomes critically overloaded, impossible
  if (newTeamUtilization > TEAM_UTILIZATION_IMPOSSIBLE) {
    return 'IMPOSSIBLE';
  }

  // Rule 3: If multiple recruiters become overloaded, at risk
  const newlyOverloaded = recruiterImpacts.filter(
    r => r.status_change === 'BECOMES_OVERLOADED'
  );
  if (newlyOverloaded.length >= 2) {
    return 'AT_RISK';
  }

  // Rule 4: If team utilization increases significantly, at risk
  if (newTeamUtilization > TEAM_UTILIZATION_AT_RISK) {
    return 'AT_RISK';
  }

  return 'ON_TRACK';
}

/**
 * Identify bottlenecks in the reassignment plan
 */
function identifyReassignmentBottlenecks(inputs: {
  recruiterImpacts: RecruiterImpact[];
  newTeamUtilization: number;
  affectedReqs: number;
  reassignmentPlan: RebalanceRecommendation[];
  currentTeamUtilization: number;
}): Bottleneck[] {
  const { recruiterImpacts, newTeamUtilization, affectedReqs, reassignmentPlan, currentTeamUtilization } = inputs;
  const bottlenecks: Bottleneck[] = [];
  let rank = 1;

  // Bottleneck 1: Capacity gap
  const utilizationIncrease = newTeamUtilization - currentTeamUtilization;
  if (utilizationIncrease > 0.15) {
    bottlenecks.push({
      rank: rank++ as 1 | 2 | 3,
      constraint_type: 'CAPACITY_GAP',
      description: `Team utilization increases by ${Math.round(utilizationIncrease * 100)}%`,
      severity: newTeamUtilization > TEAM_UTILIZATION_IMPOSSIBLE ? 'CRITICAL' : 'HIGH',
      evidence: {
        metric_key: 'capacity.new_team_utilization',
        current_value: `${Math.round(newTeamUtilization * 100)}%`,
        threshold: `${Math.round(TEAM_UTILIZATION_AT_RISK * 100)}%`,
        source_citation: 'capacity_fit_engine',
      },
      mitigation: 'Consider hiring a replacement or temporary staffing',
    });
  }

  // Bottleneck 2: Recruiters becoming overloaded
  const overloadedRecruiters = recruiterImpacts.filter(
    r => r.status_change === 'BECOMES_OVERLOADED'
  );
  if (overloadedRecruiters.length > 0 && rank <= 3) {
    bottlenecks.push({
      rank: rank++ as 1 | 2 | 3,
      constraint_type: 'CAPACITY_GAP',
      description: `${overloadedRecruiters.length} recruiter(s) will become overloaded`,
      severity: overloadedRecruiters.length >= 2 ? 'CRITICAL' : 'HIGH',
      evidence: {
        metric_key: 'recruiter_impacts.overloaded_count',
        current_value: overloadedRecruiters.length,
        threshold: 0,
        source_citation: 'capacity_fit_engine',
      },
      mitigation: 'Redistribute workload or reduce req count before departure',
    });
  }

  // Bottleneck 3: Unassignable reqs
  const unassigned = affectedReqs - reassignmentPlan.length;
  if (unassigned > 0 && rank <= 3) {
    bottlenecks.push({
      rank: rank++ as 1 | 2 | 3,
      constraint_type: 'MISSING_DATA',
      description: `${unassigned} requisition(s) cannot be reassigned`,
      severity: 'CRITICAL',
      evidence: {
        metric_key: 'reassignment_plan.unassigned_count',
        current_value: unassigned,
        threshold: 0,
        source_citation: 'scenario_library',
      },
      mitigation: 'Close or pause these requisitions, or hire additional recruiters',
    });
  }

  return bottlenecks;
}

/**
 * Get fit score from matrix, with fallback
 */
function getFitScore(
  fitMatrix: ScenarioContext['fitMatrix'],
  recruiterId: string,
  reqId: string
): number {
  if (!fitMatrix?.scores) return 0.5; // Default neutral fit
  const recruiterScores = fitMatrix.scores[recruiterId];
  if (!recruiterScores) return 0.5;
  return recruiterScores[reqId] ?? 0.5;
}

/**
 * Count total fit observations in the matrix
 */
function getFitObservationCount(fitMatrix: ScenarioContext['fitMatrix']): number {
  if (!fitMatrix?.scores) return 0;
  let count = 0;
  for (const recruiterScores of Object.values(fitMatrix.scores)) {
    count += Object.keys(recruiterScores).length;
  }
  return count;
}

/**
 * Estimate time-to-offer delay from reassignments
 * Based on average fit score - lower fit = longer ramp-up
 */
function estimateTTODelayFromReassignment(
  reassignmentPlan: RebalanceRecommendation[],
  fitMatrix: ScenarioContext['fitMatrix']
): number | null {
  if (reassignmentPlan.length === 0) return null;
  if (!fitMatrix) return null;

  const avgFitScore = reassignmentPlan.reduce((sum, r) => sum + r.fit_score, 0) / reassignmentPlan.length;

  // Model: Low fit (0.3) = +7 days, High fit (0.9) = +1 day
  // Linear interpolation: delay = 8 - 7 * fitScore
  const estimatedDelay = Math.max(1, Math.round(8 - 7 * avgFitScore));

  return estimatedDelay;
}
