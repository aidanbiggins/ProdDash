/**
 * Spin Up Team Scenario
 *
 * Models the hiring plan to spin up a new team by a target date.
 * Deterministic computation with citations for every claim.
 */

import {
  ScenarioInput,
  ScenarioOutput,
  ScenarioContext,
  SpinUpTeamParams,
  Feasibility,
  Bottleneck,
  RecruiterImpact,
  Citation,
  SampleSize,
  TTF_IMPOSSIBLE_MULTIPLIER,
  TTF_AT_RISK_MULTIPLIER,
  CAPACITY_AT_RISK_THRESHOLD,
  TEAM_UTILIZATION_IMPOSSIBLE,
  TEAM_UTILIZATION_AT_RISK,
  MIN_HIRES_FOR_TTF,
  UTILIZATION_OVERLOADED,
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
import { generateSpinUpTeamActions } from '../scenarioActionPlanService';

/**
 * Run the Spin Up Team scenario
 */
export function runSpinUpTeamScenario(
  input: ScenarioInput,
  context: ScenarioContext
): ScenarioOutput {
  const params = input.parameters as SpinUpTeamParams;
  const citations: Citation[] = [];
  const now = new Date();

  // Step 1: Validate scenario-specific gates
  const gating = validateSpinUpTeamGates(params, context);
  if (!gating.passed) {
    return createBlockedOutput(input, gating.blocked!);
  }

  // Create anonymization map for recruiters
  const recruiterIndexMap = createRecruiterIndexMap(context.recruiters);

  // Step 2: Get TTF prediction for role profile
  const { predictedTTF, ttfConfidence, ttfSampleSize } = predictTimeToFill(
    params,
    context
  );
  const targetDays = params.target_days;

  // Citation: TTF prediction
  citations.push({
    key_path: 'ttf_prediction.median_days',
    label: 'Predicted median TTF (days)',
    value: predictedTTF,
    source_service: 'forecasting_service',
  });
  citations.push({
    key_path: 'ttf_prediction.confidence',
    label: 'TTF prediction confidence',
    value: ttfConfidence,
    source_service: 'forecasting_service',
  });

  // Step 3: Calculate pipeline requirements
  const pipelineReqs = calculatePipelineRequirements(params, context);
  const totalCandidatesNeeded = pipelineReqs.candidatesPerHire * params.headcount;

  // Citation: Pipeline requirements
  citations.push({
    key_path: 'pipeline_requirements.candidates_per_hire',
    label: 'Candidates needed per hire',
    value: pipelineReqs.candidatesPerHire,
    source_service: 'velocity_analysis',
  });
  citations.push({
    key_path: 'pipeline_requirements.total_candidates_needed',
    label: 'Total candidates needed',
    value: totalCandidatesNeeded,
    source_service: 'scenario_library',
  });

  // Step 4: Calculate capacity impact
  const capacityBefore = context.capacityAnalysis?.team_capacity || 0;
  const demandBefore = context.capacityAnalysis?.team_demand || 0;
  const utilizationBefore = context.capacityAnalysis?.team_utilization || 0;
  const newWorkload = estimateWorkloadForReqs(params.headcount);
  const capacityGapBefore = context.capacityAnalysis?.capacity_gap || 0;
  const capacityGapAfter = capacityGapBefore + newWorkload;
  const demandAfter = demandBefore + newWorkload;
  const utilizationAfter = capacityBefore > 0 ? demandAfter / capacityBefore : Infinity;

  // Citation: Capacity metrics
  citations.push({
    key_path: 'capacity.team_capacity',
    label: 'Team capacity (WU)',
    value: capacityBefore,
    source_service: 'capacity_fit_engine',
  });
  citations.push({
    key_path: 'capacity.team_demand',
    label: 'Current team demand (WU)',
    value: demandBefore,
    source_service: 'capacity_fit_engine',
  });
  citations.push({
    key_path: 'capacity.new_workload',
    label: 'New workload from hiring (WU)',
    value: newWorkload,
    source_service: 'scenario_library',
  });
  citations.push({
    key_path: 'capacity.projected_utilization',
    label: 'Projected team utilization',
    value: `${Math.round(utilizationAfter * 100)}%`,
    source_service: 'capacity_fit_engine',
  });

  // Step 5: Determine feasibility
  const feasibility = determineFeasibility({
    predictedTTF,
    targetDays,
    capacityGapAfter,
    capacityBefore,
    ttfConfidence,
    utilizationAfter,
  });

  // Step 6: Identify bottlenecks
  const bottlenecks = identifyBottlenecks({
    predictedTTF,
    targetDays,
    capacityGapAfter,
    capacityBefore,
    pipelineReqs,
    params,
    context,
    utilizationAfter,
  });

  // Step 7: Calculate deltas
  const acceptRate = context.benchmarks?.accept_rate || 0.85;
  const deltas = {
    expected_hires_delta: params.headcount,
    offers_delta: Math.ceil(params.headcount / acceptRate),
    pipeline_gap_delta: -params.headcount, // Improvement by filling positions
    time_to_offer_delta: null, // Not applicable for new team
  };

  // Citation: Accept rate
  citations.push({
    key_path: 'benchmarks.accept_rate',
    label: 'Historical accept rate',
    value: `${Math.round(acceptRate * 100)}%`,
    source_service: 'velocity_analysis',
  });

  // Step 8: Calculate resource impact
  const resourceImpact = calculateResourceImpact(
    params,
    newWorkload,
    context,
    recruiterIndexMap
  );

  // Step 9: Calculate confidence
  const sampleSizes: SampleSize[] = [
    buildSampleSize('historical_hires', ttfSampleSize, MIN_HIRES_FOR_TTF),
    buildSampleSize('funnel_conversion', pipelineReqs.sampleSize, 10),
  ];
  const confidence = calculateConfidence(sampleSizes);

  // Step 10: Generate action plan
  const actionPlan = generateSpinUpTeamActions(params, bottlenecks);

  // Step 11: Generate deep links
  const deepLinks = generateDeepLinks('spin_up_team', params, feasibility);

  return {
    scenario_id: 'spin_up_team',
    scenario_name: `Spin up ${params.headcount}-person ${params.role_profile.function} team`,
    generated_at: now,
    feasibility,
    deltas,
    bottlenecks,
    resource_impact: resourceImpact,
    action_plan: actionPlan,
    confidence,
    citations: collectCitations(citations),
    deep_links: deepLinks,
    blocked: null,
  };
}

/**
 * Validate scenario-specific gates for Spin Up Team
 */
function validateSpinUpTeamGates(
  params: SpinUpTeamParams,
  context: ScenarioContext
): { passed: boolean; blocked: { reason: string; missing_data: any[]; fix_instructions: string[] } | null } {
  const missing_data: any[] = [];
  const fix_instructions: string[] = [];

  // Gate 1: Historical hires for TTF calculation (≥5)
  const matchingHires = countMatchingHires(params, context);
  if (matchingHires < MIN_HIRES_FOR_TTF) {
    missing_data.push({
      field: 'historical_hires',
      description: `Only ${matchingHires} historical hires found for this role profile`,
      required_for: 'TTF prediction requires at least 5 historical hires in matching cohort',
    });
    fix_instructions.push('Insufficient historical hires for this role profile');
  }

  // Gate 2: TTF data (valid opened_at and hired_at on hires)
  const hiresWithTimestamps = countHiresWithValidTimestamps(context);
  if (hiresWithTimestamps < MIN_HIRES_FOR_TTF) {
    missing_data.push({
      field: 'ttf_timestamps',
      description: `Only ${hiresWithTimestamps} hires have valid timestamps`,
      required_for: 'TTF calculation requires opened_at and closed_at timestamps',
    });
    fix_instructions.push('Ensure timestamps on closed requisitions');
  }

  // Gate 3: Velocity data (funnel conversion rates)
  if (!context.benchmarks || !context.benchmarks.funnel_conversion_rates) {
    missing_data.push({
      field: 'velocity_data',
      description: 'No funnel conversion rates available',
      required_for: 'Pipeline requirements calculation needs stage progression events',
    });
    fix_instructions.push('Need stage progression events');
  }

  if (missing_data.length > 0) {
    return {
      passed: false,
      blocked: {
        reason: 'Cannot run Spin Up Team scenario',
        missing_data,
        fix_instructions,
      },
    };
  }

  return { passed: true, blocked: null };
}

/**
 * Check if requisition is closed using flexible status detection
 */
function isClosedReq(status: string | null | undefined, closedAt: Date | null): boolean {
  if (closedAt) return true;
  if (!status) return false;
  const statusLower = status.toLowerCase();
  return statusLower === 'closed' || statusLower.includes('closed') || statusLower === 'filled';
}

/**
 * Count historical hires matching the role profile
 * Uses fuzzy matching and falls back to all hires if no role-specific matches
 */
function countMatchingHires(
  params: SpinUpTeamParams,
  context: ScenarioContext
): number {
  // First, count all closed reqs
  const allClosedReqs = context.requisitions.filter(r => isClosedReq(r.status, r.closed_at));

  // If no function specified, return all closed
  if (!params.role_profile.function) {
    return allClosedReqs.length;
  }

  const functionLower = params.role_profile.function.toLowerCase();
  const levelLower = params.role_profile.level?.toLowerCase();

  // Try fuzzy matching on job_family OR title
  const roleMatches = allClosedReqs.filter(r => {
    // Fuzzy match on job_family (contains instead of exact)
    const jobFamilyMatch = r.job_family?.toLowerCase().includes(functionLower) ||
                           functionLower.includes(r.job_family?.toLowerCase() || '');

    // Also try matching on title if job_family doesn't match
    const titleMatch = r.title?.toLowerCase().includes(functionLower);

    const functionMatch = jobFamilyMatch || titleMatch;

    // Level matching is optional - only filter if level specified AND role matches
    if (!functionMatch) return false;
    if (!levelLower) return true;

    const levelMatch = r.level?.toLowerCase().includes(levelLower) ||
                       levelLower.includes(r.level?.toLowerCase() || '');
    return levelMatch || true; // Don't require level match, just role
  });

  // If we found role-specific matches, use them
  if (roleMatches.length >= MIN_HIRES_FOR_TTF) {
    return roleMatches.length;
  }

  // Fall back to all closed reqs if no role-specific matches found
  // This allows the scenario to run with lower confidence
  return allClosedReqs.length;
}

/**
 * Count hires with valid timestamps for TTF calculation
 */
function countHiresWithValidTimestamps(context: ScenarioContext): number {
  return context.requisitions.filter(
    r => r.opened_at !== null && r.closed_at !== null
  ).length;
}

/**
 * Predict time-to-fill for the role profile
 */
function predictTimeToFill(
  params: SpinUpTeamParams,
  context: ScenarioContext
): { predictedTTF: number; ttfConfidence: string; ttfSampleSize: number } {
  // Get all closed reqs with timestamps
  const allClosedWithTimestamps = context.requisitions.filter(r => {
    const isClosed = isClosedReq(r.status, r.closed_at);
    const hasTimestamps = r.opened_at !== null && r.closed_at !== null;
    return isClosed && hasTimestamps;
  });

  let matchingReqs = allClosedWithTimestamps;

  // If function specified, try fuzzy matching
  if (params.role_profile.function) {
    const functionLower = params.role_profile.function.toLowerCase();
    const roleMatches = allClosedWithTimestamps.filter(r => {
      const jobFamilyMatch = r.job_family?.toLowerCase().includes(functionLower) ||
                             functionLower.includes(r.job_family?.toLowerCase() || '');
      const titleMatch = r.title?.toLowerCase().includes(functionLower);
      return jobFamilyMatch || titleMatch;
    });

    // Only use role-specific matches if we have enough data
    if (roleMatches.length >= MIN_HIRES_FOR_TTF) {
      matchingReqs = roleMatches;
    }
    // Otherwise fall back to all closed reqs
  }

  if (matchingReqs.length === 0) {
    // Use global median from benchmarks
    const globalMedian = context.benchmarks?.median_ttf_days || 45;
    return {
      predictedTTF: globalMedian,
      ttfConfidence: 'low',
      ttfSampleSize: 0,
    };
  }

  // Calculate median TTF
  const ttfDays = matchingReqs
    .map(r => {
      const opened = new Date(r.opened_at!).getTime();
      const closed = new Date(r.closed_at!).getTime();
      return Math.round((closed - opened) / (1000 * 60 * 60 * 24));
    })
    .filter(d => d > 0)
    .sort((a, b) => a - b);

  const medianIndex = Math.floor(ttfDays.length / 2);
  const medianTTF = ttfDays.length > 0
    ? (ttfDays.length % 2 === 0
        ? (ttfDays[medianIndex - 1] + ttfDays[medianIndex]) / 2
        : ttfDays[medianIndex])
    : 45;

  // Apply HM friction adjustment if specified
  let adjustedTTF = medianTTF;
  if (params.hiring_manager_id && context.hiringManagers) {
    const hm = context.hiringManagers.find(h => h.hm_id === params.hiring_manager_id);
    if (hm && hm.avg_feedback_days > 2) {
      // Add HM latency penalty
      adjustedTTF += (hm.avg_feedback_days - 2) * 2; // 2 days per day of HM delay over baseline
    }
  }

  // Determine confidence
  let confidence: string;
  if (ttfDays.length >= MIN_HIRES_FOR_TTF * 2) {
    confidence = 'high';
  } else if (ttfDays.length >= MIN_HIRES_FOR_TTF * 1.5) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    predictedTTF: Math.round(adjustedTTF),
    ttfConfidence: confidence,
    ttfSampleSize: ttfDays.length,
  };
}

/**
 * Calculate pipeline requirements based on funnel conversion
 */
function calculatePipelineRequirements(
  params: SpinUpTeamParams,
  context: ScenarioContext
): { candidatesPerHire: number; sampleSize: number } {
  // Use benchmarks if available
  if (context.benchmarks?.candidates_per_hire) {
    return {
      candidatesPerHire: context.benchmarks.candidates_per_hire,
      sampleSize: context.events.length,
    };
  }

  // Calculate from funnel conversion rates
  const rates = context.benchmarks?.funnel_conversion_rates || {};
  const stages = ['APPLIED', 'SCREEN', 'HM_SCREEN', 'ONSITE', 'FINAL', 'OFFER', 'HIRED'];

  let cumulativeConversion = 1;
  for (let i = 0; i < stages.length - 1; i++) {
    const rate = rates[stages[i]] || 0.5; // Default 50% if missing
    cumulativeConversion *= rate;
  }

  const candidatesPerHire = cumulativeConversion > 0
    ? Math.ceil(1 / cumulativeConversion)
    : 10; // Default fallback

  return {
    candidatesPerHire: Math.max(1, candidatesPerHire),
    sampleSize: context.events.length,
  };
}

/**
 * Estimate workload units for new requisitions
 */
function estimateWorkloadForReqs(headcount: number): number {
  // Standard assumption: 10 WU per req
  return headcount * 10;
}

/**
 * Determine feasibility of the spin-up plan
 */
function determineFeasibility(inputs: {
  predictedTTF: number;
  targetDays: number;
  capacityGapAfter: number;
  capacityBefore: number;
  ttfConfidence: string;
  utilizationAfter: number;
}): Feasibility {
  const { predictedTTF, targetDays, capacityGapAfter, capacityBefore, ttfConfidence, utilizationAfter } = inputs;

  // Rule 1: If predicted TTF > target × 1.5, impossible
  if (predictedTTF > targetDays * TTF_IMPOSSIBLE_MULTIPLIER) {
    return 'IMPOSSIBLE';
  }

  // Rule 2: If team becomes critically overloaded, impossible
  if (utilizationAfter > TEAM_UTILIZATION_IMPOSSIBLE) {
    return 'IMPOSSIBLE';
  }

  // Rule 3: If significant capacity gap (>30%), at risk
  const capacityGapPercent = capacityBefore > 0 ? capacityGapAfter / capacityBefore : 0;
  if (capacityGapPercent > CAPACITY_AT_RISK_THRESHOLD) {
    return 'AT_RISK';
  }

  // Rule 4: If TTF within target but low confidence, at risk
  if (predictedTTF <= targetDays && ttfConfidence === 'low') {
    return 'AT_RISK';
  }

  // Rule 5: If team utilization exceeds 110%, at risk
  if (utilizationAfter > TEAM_UTILIZATION_AT_RISK) {
    return 'AT_RISK';
  }

  // Rule 6: If TTF exceeds target × 1.2, at risk
  if (predictedTTF > targetDays * TTF_AT_RISK_MULTIPLIER) {
    return 'AT_RISK';
  }

  return 'ON_TRACK';
}

/**
 * Identify bottlenecks in the spin-up plan
 */
function identifyBottlenecks(inputs: {
  predictedTTF: number;
  targetDays: number;
  capacityGapAfter: number;
  capacityBefore: number;
  pipelineReqs: { candidatesPerHire: number; sampleSize: number };
  params: SpinUpTeamParams;
  context: ScenarioContext;
  utilizationAfter: number;
}): Bottleneck[] {
  const { predictedTTF, targetDays, capacityGapAfter, capacityBefore, pipelineReqs, params, context, utilizationAfter } = inputs;
  const bottlenecks: Bottleneck[] = [];
  let rank = 1;

  // Bottleneck 1: TTF exceeds target
  if (predictedTTF > targetDays && rank <= 3) {
    const severity = predictedTTF > targetDays * TTF_IMPOSSIBLE_MULTIPLIER ? 'CRITICAL' :
                     predictedTTF > targetDays * TTF_AT_RISK_MULTIPLIER ? 'HIGH' : 'MEDIUM';
    bottlenecks.push({
      rank: rank++ as 1 | 2 | 3,
      constraint_type: 'VELOCITY_DECAY',
      description: `Predicted TTF (${predictedTTF}d) exceeds target (${targetDays}d)`,
      severity,
      evidence: {
        metric_key: 'ttf_prediction.median_days',
        current_value: predictedTTF,
        threshold: targetDays,
        source_citation: 'forecasting_service',
      },
      mitigation: 'Reduce interview stages or improve HM responsiveness',
    });
  }

  // Bottleneck 2: Capacity gap
  const capacityGapPercent = capacityBefore > 0 ? capacityGapAfter / capacityBefore : 0;
  if (capacityGapPercent > 0.15 && rank <= 3) {
    const severity = utilizationAfter > TEAM_UTILIZATION_IMPOSSIBLE ? 'CRITICAL' :
                     utilizationAfter > TEAM_UTILIZATION_AT_RISK ? 'HIGH' : 'MEDIUM';
    bottlenecks.push({
      rank: rank++ as 1 | 2 | 3,
      constraint_type: 'CAPACITY_GAP',
      description: `Team capacity gap increases by ${Math.round(capacityGapPercent * 100)}%`,
      severity,
      evidence: {
        metric_key: 'capacity.projected_utilization',
        current_value: `${Math.round(utilizationAfter * 100)}%`,
        threshold: `${Math.round(TEAM_UTILIZATION_AT_RISK * 100)}%`,
        source_citation: 'capacity_fit_engine',
      },
      mitigation: 'Add more recruiters or reduce existing workload',
    });
  }

  // Bottleneck 3: HM friction
  if (params.hiring_manager_id && context.hiringManagers && rank <= 3) {
    const hm = context.hiringManagers.find(h => h.hm_id === params.hiring_manager_id);
    if (hm && hm.avg_feedback_days > 3) {
      bottlenecks.push({
        rank: rank++ as 1 | 2 | 3,
        constraint_type: 'HM_FRICTION',
        description: `HM feedback latency is ${hm.avg_feedback_days.toFixed(1)} days (target: 2d)`,
        severity: hm.avg_feedback_days > 5 ? 'HIGH' : 'MEDIUM',
        evidence: {
          metric_key: 'hm_friction.feedback_latency',
          current_value: hm.avg_feedback_days,
          threshold: 2,
          source_citation: 'hm_metrics_engine',
        },
        mitigation: 'Establish SLA with HM for faster feedback',
      });
    }
  }

  // Bottleneck 4: Pipeline depth (if we need many candidates)
  const activeCandidates = context.candidates.filter(
    c => !['HIRED', 'REJECTED', 'WITHDRAWN'].includes(c.current_stage)
  ).length;
  const totalNeeded = pipelineReqs.candidatesPerHire * params.headcount;
  if (activeCandidates < totalNeeded * 0.5 && rank <= 3) {
    bottlenecks.push({
      rank: rank++ as 1 | 2 | 3,
      constraint_type: 'PIPELINE_DEPTH',
      description: `Current pipeline (${activeCandidates}) is less than half of needed (${totalNeeded})`,
      severity: activeCandidates < totalNeeded * 0.25 ? 'HIGH' : 'MEDIUM',
      evidence: {
        metric_key: 'pipeline_requirements.total_candidates_needed',
        current_value: activeCandidates,
        threshold: totalNeeded,
        source_citation: 'scenario_library',
      },
      mitigation: 'Activate sourcing channels to build pipeline',
    });
  }

  return bottlenecks;
}

/**
 * Calculate resource impact on recruiters
 */
function calculateResourceImpact(
  params: SpinUpTeamParams,
  newWorkload: number,
  context: ScenarioContext,
  recruiterIndexMap: Map<string, number>
): { team_utilization_delta: number; recruiter_impacts: RecruiterImpact[] } | null {
  if (context.recruiters.length < 3) return null;

  const currentUtilization = context.capacityAnalysis?.team_utilization || 0;
  const teamCapacity = context.capacityAnalysis?.team_capacity || 0;
  const teamDemand = context.capacityAnalysis?.team_demand || 0;

  const newUtilization = teamCapacity > 0
    ? (teamDemand + newWorkload) / teamCapacity
    : Infinity;

  // Calculate per-recruiter impact
  const recruiterImpacts: RecruiterImpact[] = [];

  // If specific recruiters are assigned, show their impact
  if (params.assigned_recruiter_ids && params.assigned_recruiter_ids.length > 0) {
    const workloadPerRecruiter = newWorkload / params.assigned_recruiter_ids.length;

    for (const recruiterId of params.assigned_recruiter_ids) {
      const recruiter = context.recruiters.find(r => r.recruiter_id === recruiterId);
      if (recruiter) {
        const projectedUtil = recruiter.capacity_wu > 0
          ? (recruiter.demand_wu + workloadPerRecruiter) / recruiter.capacity_wu
          : Infinity;
        recruiterImpacts.push({
          recruiter_id: recruiterId,
          recruiter_name_anon: anonymizeRecruiterName(recruiterId, recruiterIndexMap),
          current_utilization: recruiter.utilization,
          projected_utilization: projectedUtil,
          status_change: getStatusChange(recruiter.utilization, projectedUtil),
        });
      }
    }
  } else {
    // Distribute evenly across all recruiters
    const workloadPerRecruiter = newWorkload / context.recruiters.length;

    for (const recruiter of context.recruiters) {
      const projectedUtil = recruiter.capacity_wu > 0
        ? (recruiter.demand_wu + workloadPerRecruiter) / recruiter.capacity_wu
        : Infinity;
      recruiterImpacts.push({
        recruiter_id: recruiter.recruiter_id,
        recruiter_name_anon: anonymizeRecruiterName(recruiter.recruiter_id, recruiterIndexMap),
        current_utilization: recruiter.utilization,
        projected_utilization: projectedUtil,
        status_change: getStatusChange(recruiter.utilization, projectedUtil),
      });
    }
  }

  return {
    team_utilization_delta: newUtilization - currentUtilization,
    recruiter_impacts: recruiterImpacts,
  };
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
