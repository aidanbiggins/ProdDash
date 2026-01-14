// Capacity Fit Engine - Main Orchestration
// Coordinates all capacity analysis components

import {
  CapacityAnalysisResult,
  TeamCapacitySummary,
  RecruiterLoadRow,
  CapacityDriver,
  BlockingConditions,
  CAPACITY_CONSTANTS,
  getLoadStatus,
  calculateConfidence,
  ReqWithWorkload,
  RecruiterCapacity
} from '../types/capacityTypes';
import { Requisition, Candidate, Event, User } from '../types';
import { DashboardConfig } from '../types/config';
import { buildAllReqWorkloads, calculateDemand } from './workloadScoring';
import { calculateAllRecruiterCapacities } from './sustainableCapacity';
import { buildFitMatrix } from './fitScoring';
import { generateRebalanceRecommendations } from './rebalanceOptimizer';
import { createHMWeightsMap, calculateHMFrictionMetrics } from './complexityScoring';
import { MetricFilters } from '../types';

// ===== BLOCKING CONDITIONS =====

/**
 * Checks if we have sufficient data to run capacity analysis
 */
export function checkBlockingConditions(
  requisitions: Requisition[],
  events: Event[]
): BlockingConditions {
  // Get unique recruiters with req assignments
  const recruiterIds = new Set(
    requisitions
      .map(r => r.recruiter_id)
      .filter((id): id is string => id !== null && id !== undefined && id !== '')
  );

  // Calculate recruiter ID coverage
  const recsWithRecruiterId = requisitions.filter(r => r.recruiter_id).length;
  const recruiterIdCoverage = requisitions.length > 0
    ? recsWithRecruiterId / requisitions.length
    : 0;

  return {
    hasMinRecruiters: recruiterIds.size >= CAPACITY_CONSTANTS.MIN_RECRUITERS_FOR_TEAM,
    hasMinReqs: requisitions.length >= CAPACITY_CONSTANTS.MIN_REQS_FOR_ANALYSIS,
    hasEventData: events.length > 0,
    hasRecruiterIds: recruiterIdCoverage >= 0.5,
    recruiterIdCoverage
  };
}

/**
 * Returns a human-readable block reason if blocked
 */
function getBlockReason(conditions: BlockingConditions): string | null {
  const reasons: string[] = [];

  if (!conditions.hasMinRecruiters) {
    reasons.push(`fewer than ${CAPACITY_CONSTANTS.MIN_RECRUITERS_FOR_TEAM} recruiters with req assignments`);
  }
  if (!conditions.hasMinReqs) {
    reasons.push(`fewer than ${CAPACITY_CONSTANTS.MIN_REQS_FOR_ANALYSIS} open requisitions`);
  }
  if (!conditions.hasEventData) {
    reasons.push('no event data available for historical capacity calculation');
  }
  if (!conditions.hasRecruiterIds) {
    reasons.push(`recruiter_id missing on ${Math.round((1 - conditions.recruiterIdCoverage) * 100)}% of reqs`);
  }

  return reasons.length > 0 ? reasons.join('; ') : null;
}

// ===== CAPACITY DRIVERS =====

/**
 * Identifies top drivers of capacity gap
 */
function identifyCapacityDrivers(
  reqWorkloads: ReqWithWorkload[],
  hmWeights: Map<string, number>
): CapacityDriver[] {
  const drivers: CapacityDriver[] = [];

  // Empty pipelines (remainingWork > 0.8)
  const emptyPipelineReqs = reqWorkloads.filter(r => r.components.remainingWork > 0.8);
  if (emptyPipelineReqs.length > 0) {
    const impactWU = emptyPipelineReqs.reduce((sum, r) =>
      sum + (r.workloadScore * 0.3), 0 // ~30% of score from empty pipeline
    );
    drivers.push({
      type: 'empty_pipeline',
      description: `${emptyPipelineReqs.length} reqs with empty or thin pipelines`,
      impactWU: Math.round(impactWU),
      reqIds: emptyPipelineReqs.map(r => r.reqId)
    });
  }

  // High friction HMs (frictionMultiplier > 1.1)
  const highFrictionReqs = reqWorkloads.filter(r => r.components.frictionMultiplier > 1.1);
  if (highFrictionReqs.length > 0) {
    const impactWU = highFrictionReqs.reduce((sum, r) =>
      sum + (r.workloadScore * (r.components.frictionMultiplier - 1.0)), 0
    );
    drivers.push({
      type: 'high_friction_hm',
      description: `${highFrictionReqs.length} reqs with slow HM responsiveness`,
      impactWU: Math.round(impactWU),
      reqIds: highFrictionReqs.map(r => r.reqId)
    });
  }

  // Aging reqs (90+ days)
  const agingReqs = reqWorkloads.filter(r => r.reqAgeDays >= 90);
  if (agingReqs.length > 0) {
    const impactWU = agingReqs.reduce((sum, r) =>
      sum + (r.workloadScore * (r.components.agingMultiplier - 1.0)), 0
    );
    drivers.push({
      type: 'aging_reqs',
      description: `${agingReqs.length} reqs open 90+ days`,
      impactWU: Math.round(impactWU),
      reqIds: agingReqs.map(r => r.reqId)
    });
  }

  // Sort by impact and return top 3
  return drivers
    .sort((a, b) => b.impactWU - a.impactWU)
    .slice(0, 3);
}

// ===== RECRUITER LOAD TABLE =====

/**
 * Builds recruiter load rows from workload and capacity data
 */
function buildRecruiterLoadRows(
  reqWorkloads: ReqWithWorkload[],
  capacities: RecruiterCapacity[]
): RecruiterLoadRow[] {
  const rows: RecruiterLoadRow[] = [];

  for (const cap of capacities) {
    const recruiterReqs = reqWorkloads.filter(r => r.recruiterId === cap.recruiterId);
    const demandWU = calculateDemand(cap.recruiterId, reqWorkloads);
    const utilization = cap.sustainableCapacityUnits > 0
      ? demandWU / cap.sustainableCapacityUnits
      : 0;

    // Identify top driver for this recruiter
    let topDriver = 'Balanced workload';
    if (utilization > 1.1) {
      // Find the biggest contributor to overload
      const sortedReqs = [...recruiterReqs].sort((a, b) => b.workloadScore - a.workloadScore);
      if (sortedReqs.length > 0) {
        const topReq = sortedReqs[0];
        if (topReq.components.remainingWork > 0.8) {
          topDriver = `Empty pipeline on ${topReq.reqTitle}`;
        } else if (topReq.components.agingMultiplier > 1.2) {
          topDriver = `Aging req: ${topReq.reqTitle}`;
        } else if (topReq.components.frictionMultiplier > 1.1) {
          topDriver = `Slow HM on ${topReq.reqTitle}`;
        } else {
          topDriver = `High volume (${recruiterReqs.length} reqs)`;
        }
      }
    } else if (utilization < 0.7) {
      topDriver = 'Available capacity';
    }

    rows.push({
      recruiterId: cap.recruiterId,
      recruiterName: cap.recruiterName,
      demandWU: Math.round(demandWU),
      capacityWU: Math.round(cap.sustainableCapacityUnits),
      utilization,
      status: getLoadStatus(utilization),
      topDriver,
      reqCount: recruiterReqs.length,
      confidence: cap.confidence
    });
  }

  // Sort by utilization descending
  return rows.sort((a, b) => b.utilization - a.utilization);
}

// ===== TEAM SUMMARY =====

/**
 * Builds team capacity summary
 */
function buildTeamSummary(
  recruiterLoads: RecruiterLoadRow[],
  reqWorkloads: ReqWithWorkload[],
  hmWeights: Map<string, number>
): TeamCapacitySummary {
  const teamDemand = recruiterLoads.reduce((sum, r) => sum + r.demandWU, 0);
  const teamCapacity = recruiterLoads.reduce((sum, r) => sum + r.capacityWU, 0);
  const capacityGap = teamDemand - teamCapacity;
  const capacityGapPercent = teamCapacity > 0
    ? Math.round((capacityGap / teamCapacity) * 100)
    : 0;

  // Determine status
  let status: 'understaffed' | 'overstaffed' | 'balanced';
  if (capacityGapPercent > 10) {
    status = 'understaffed';
  } else if (capacityGapPercent < -10) {
    status = 'overstaffed';
  } else {
    status = 'balanced';
  }

  // Calculate confidence based on number of recruiters with good data
  const recruitersWithData = recruiterLoads.filter(r => r.confidence !== 'INSUFFICIENT').length;
  const confidence = calculateConfidence(recruitersWithData, CAPACITY_CONSTANTS.MIN_RECRUITERS_FOR_TEAM);

  // Get top drivers
  const topDrivers = identifyCapacityDrivers(reqWorkloads, hmWeights);

  return {
    teamDemand: Math.round(teamDemand),
    teamCapacity: Math.round(teamCapacity),
    capacityGap: Math.round(capacityGap),
    capacityGapPercent,
    confidence,
    topDrivers,
    status
  };
}

// ===== MAIN ANALYSIS =====

/**
 * Runs the complete capacity fit analysis
 */
export function analyzeCapacity(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  users: User[],
  filters: MetricFilters,
  config: DashboardConfig
): CapacityAnalysisResult {
  // Check blocking conditions
  const conditions = checkBlockingConditions(requisitions, events);
  const blocked = !conditions.hasMinRecruiters ||
                  !conditions.hasMinReqs ||
                  !conditions.hasRecruiterIds;

  if (blocked) {
    return {
      blocked: true,
      blockReason: getBlockReason(conditions),
      teamSummary: null,
      recruiterLoads: [],
      fitMatrix: [],
      rebalanceRecommendations: [],
      reqWorkloads: [],
      recruiterCapacities: []
    };
  }

  // Calculate HM friction metrics to get weights
  const hmFrictionMetrics = calculateHMFrictionMetrics(requisitions, events, users, filters, config);
  const hmWeights = createHMWeightsMap(hmFrictionMetrics);

  // Build req workloads
  const reqWorkloads = buildAllReqWorkloads(requisitions, candidates, hmWeights, config);

  // Calculate recruiter capacities
  const recruiterCapacities = calculateAllRecruiterCapacities(requisitions, events, users);

  // Build recruiter load rows
  const recruiterLoads = buildRecruiterLoadRows(reqWorkloads, recruiterCapacities);

  // Build team summary
  const teamSummary = buildTeamSummary(recruiterLoads, reqWorkloads, hmWeights);

  // Build fit matrix
  const recruiterDemands = new Map(recruiterLoads.map(r => [r.recruiterId, r.demandWU]));
  const fitMatrix = buildFitMatrix(requisitions, candidates, users, recruiterDemands);

  // Generate rebalance recommendations
  const rebalanceRecommendations = generateRebalanceRecommendations(
    recruiterLoads,
    reqWorkloads,
    fitMatrix,
    5
  );

  return {
    blocked: false,
    blockReason: null,
    teamSummary,
    recruiterLoads,
    fitMatrix,
    rebalanceRecommendations,
    reqWorkloads,
    recruiterCapacities
  };
}
