// Workload Scoring Service
// Calculates WorkloadScore for requisitions based on the capacity fit engine plan

import { differenceInDays } from 'date-fns';
import {
  ReqWithWorkload,
  WorkloadComponents,
  SegmentKey,
  CAPACITY_CONSTANTS,
  levelToLevelBand
} from '../types/capacityTypes';
import { Requisition, Candidate, CanonicalStage } from '../types';
import { DashboardConfig } from '../types/config';

// ===== BASE DIFFICULTY =====

/**
 * Calculates BaseDifficulty from level, market, and niche weights
 * BaseDifficulty = LevelWeight × MarketWeight × NicheWeight
 */
export function calculateBaseDifficulty(
  req: Requisition,
  config: DashboardConfig
): number {
  // Level weight
  const levelWeight = config.levelWeights[req.level] ?? 1.0;

  // Market weight based on location type
  let marketWeight: number;
  switch (req.location_type) {
    case 'Remote':
      marketWeight = config.marketWeights.Remote;
      break;
    case 'Hybrid':
      marketWeight = config.marketWeights.Hybrid;
      break;
    case 'Onsite':
      marketWeight = config.marketWeights.Onsite;
      break;
    default:
      marketWeight = 1.0;
  }

  // Add hard market bonus if applicable
  if (req.location_city) {
    const isHardMarket = config.marketWeights.hardMarketsList.some(
      city => city.toLowerCase() === req.location_city?.toLowerCase()
    );
    if (isHardMarket) {
      marketWeight += config.marketWeights.hardMarketBonus;
    }
  }

  // Niche weight by job family
  const nicheWeight = config.nicheWeights[req.job_family] ?? 1.0;

  return levelWeight * marketWeight * nicheWeight;
}

// ===== REMAINING WORK =====

/**
 * Calculates RemainingWork based on pipeline fullness
 * RemainingWork = 1.0 - PipelineProgress
 * Range: 1.0 (empty pipeline) → 0.0 (offer accepted)
 */
export function calculateRemainingWork(
  candidates: Candidate[]
): number {
  if (candidates.length === 0) {
    return 1.0; // Empty pipeline = full work remaining
  }

  // Check for candidates at each stage
  const hasLeads = candidates.some(c =>
    c.current_stage === CanonicalStage.LEAD ||
    c.current_stage === CanonicalStage.APPLIED
  );

  const hasScreened = candidates.some(c =>
    c.current_stage === CanonicalStage.SCREEN ||
    c.current_stage === CanonicalStage.HM_SCREEN
  );

  const hasInterviewing = candidates.some(c =>
    c.current_stage === CanonicalStage.ONSITE
  );

  const hasFinalist = candidates.some(c =>
    c.current_stage === CanonicalStage.FINAL
  );

  const hasOffer = candidates.some(c =>
    c.current_stage === CanonicalStage.OFFER
  );

  // Calculate pipeline progress (weighted sum)
  const pipelineProgress =
    (hasLeads ? 0.1 : 0) +
    (hasScreened ? 0.2 : 0) +
    (hasInterviewing ? 0.3 : 0) +
    (hasFinalist ? 0.3 : 0) +
    (hasOffer ? 0.1 : 0);

  return Math.max(0, 1.0 - pipelineProgress);
}

// ===== AGING MULTIPLIER =====

/**
 * Calculates AgingMultiplier for older reqs
 * AgingMultiplier = 1.0 + (reqAgeDays / 90) × 0.3
 * Capped at 1.6 (180+ days)
 */
export function calculateAgingMultiplier(reqAgeDays: number): number {
  const rawMultiplier = 1.0 + (reqAgeDays / CAPACITY_CONSTANTS.AGING_SCALE_DAYS) * CAPACITY_CONSTANTS.AGING_SCALE_FACTOR;
  return Math.min(CAPACITY_CONSTANTS.AGING_CAP, rawMultiplier);
}

// ===== WORKLOAD SCORE =====

/**
 * Calculates the complete WorkloadScore for a requisition
 * WorkloadScore = BaseDifficulty × RemainingWork × FrictionMultiplier × AgingMultiplier
 */
export function calculateWorkloadScore(
  req: Requisition,
  candidates: Candidate[],
  hmWeight: number,
  config: DashboardConfig
): { score: number; components: WorkloadComponents } {
  const baseDifficulty = calculateBaseDifficulty(req, config);
  const remainingWork = calculateRemainingWork(candidates);
  const frictionMultiplier = hmWeight; // From HM friction metrics, defaults to 1.0

  // Calculate req age in days
  const reqAgeDays = req.opened_at
    ? differenceInDays(new Date(), req.opened_at)
    : 0;
  const agingMultiplier = calculateAgingMultiplier(reqAgeDays);

  const score = baseDifficulty * remainingWork * frictionMultiplier * agingMultiplier;

  return {
    score,
    components: {
      baseDifficulty,
      remainingWork,
      frictionMultiplier,
      agingMultiplier
    }
  };
}

// ===== REQ WITH WORKLOAD =====

/**
 * Builds a ReqWithWorkload object for a requisition
 */
export function buildReqWithWorkload(
  req: Requisition,
  candidates: Candidate[],
  hmWeight: number,
  config: DashboardConfig
): ReqWithWorkload {
  const { score, components } = calculateWorkloadScore(req, candidates, hmWeight, config);

  // Filter candidates for this req
  const reqCandidates = candidates.filter(c => c.req_id === req.req_id);

  // Check for offer and finalist stages
  const hasOfferOut = reqCandidates.some(c => c.current_stage === CanonicalStage.OFFER);
  const hasFinalist = reqCandidates.some(c => c.current_stage === CanonicalStage.FINAL);

  // Calculate req age
  const reqAgeDays = req.opened_at
    ? differenceInDays(new Date(), req.opened_at)
    : 0;

  // Build segment
  const segment: SegmentKey = {
    jobFamily: req.job_family || 'General',
    levelBand: levelToLevelBand(req.level || 'IC3'),
    locationType: req.location_type || 'Hybrid'
  };

  return {
    reqId: req.req_id,
    reqTitle: req.req_title || '',
    recruiterId: req.recruiter_id || '',
    workloadScore: score,
    components,
    segment,
    hasOfferOut,
    hasFinalist,
    reqAgeDays
  };
}

// ===== DEMAND CALCULATION =====

/**
 * Calculates total Demand (WU) for a recruiter
 * Demand = Σ WorkloadScore for all reqs owned by recruiter
 */
export function calculateDemand(
  recruiterId: string,
  reqWorkloads: ReqWithWorkload[]
): number {
  return reqWorkloads
    .filter(r => r.recruiterId === recruiterId)
    .reduce((sum, r) => sum + r.workloadScore, 0);
}

/**
 * Builds all ReqWithWorkload objects for a set of requisitions
 */
export function buildAllReqWorkloads(
  requisitions: Requisition[],
  candidates: Candidate[],
  hmWeights: Map<string, number>,
  config: DashboardConfig
): ReqWithWorkload[] {
  return requisitions.map(req => {
    const reqCandidates = candidates.filter(c => c.req_id === req.req_id);
    const hmWeight = hmWeights.get(req.hiring_manager_id || '') ?? 1.0;
    return buildReqWithWorkload(req, reqCandidates, hmWeight, config);
  });
}
