// Complexity Scoring Service for the Recruiter Productivity Dashboard

import { differenceInHours } from 'date-fns';
import {
  Requisition,
  Event,
  User,
  EventType,
  ComplexityScore,
  HiringManagerFriction,
  MetricFilters
} from '../types';
import { DashboardConfig } from '../types/config';

// ===== UTILITY =====

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ===== COMPLEXITY SCORING =====

/**
 * Calculates the complexity score for a single requisition
 */
export function calculateReqComplexityScore(
  req: Requisition,
  hmWeight: number,
  config: DashboardConfig
): ComplexityScore {
  // Level weight
  const levelWeight = config.levelWeights[req.level] || 1.0;

  // Market weight
  let marketWeight: number;
  switch (req.location_type) {
    case 'Remote': marketWeight = config.marketWeights.Remote; break;
    case 'Hybrid': marketWeight = config.marketWeights.Hybrid; break;
    case 'Onsite': marketWeight = config.marketWeights.Onsite; break;
    default: marketWeight = 1.0;
  }

  // Add hard market bonus if applicable
  if (req.location_city) {
    const isHardMarket = config.marketWeights.hardMarketsList.some(
      city => city.toLowerCase() === req.location_city?.toLowerCase()
    );
    if (isHardMarket) {
      marketWeight = marketWeight + config.marketWeights.hardMarketBonus;
    }
  }

  // Niche weight (by job family)
  const nicheWeight = config.nicheWeights[req.job_family] || 1.0;

  // Total complexity score
  const totalScore = levelWeight * marketWeight * nicheWeight * hmWeight;

  return {
    reqId: req.req_id,
    levelWeight,
    marketWeight,
    nicheWeight,
    hmWeight,
    totalScore
  };
}

/**
 * Calculates complexity scores for all requisitions
 */
export function calculateAllComplexityScores(
  requisitions: Requisition[],
  hmWeights: Map<string, number>,
  config: DashboardConfig
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const req of requisitions) {
    const hmWeight = hmWeights.get(req.hiring_manager_id) || 1.0;
    const score = calculateReqComplexityScore(req, hmWeight, config);
    scores.set(req.req_id, score.totalScore);
  }

  return scores;
}

// ===== HIRING MANAGER FRICTION INDEX =====

interface HMInterviewData {
  hmId: string;
  interviewCompletedAt: Date;
  feedbackSubmittedAt: Date | null;
  decisionAt: Date | null;
  candidateId: string;
}

/**
 * Calculates the hiring manager friction metrics for all HMs
 */
export function calculateHMFrictionMetrics(
  requisitions: Requisition[],
  events: Event[],
  users: User[],
  filter: MetricFilters,
  config: DashboardConfig
): HiringManagerFriction[] {
  // Get unique HMs from requisitions
  const hmIds = Array.from(new Set(requisitions.map(r => r.hiring_manager_id))).filter(Boolean);

  // Group requisitions by HM
  const reqsByHM = new Map<string, Requisition[]>();
  for (const req of requisitions) {
    if (!req.hiring_manager_id) continue;
    const existing = reqsByHM.get(req.hiring_manager_id) || [];
    existing.push(req);
    reqsByHM.set(req.hiring_manager_id, existing);
  }

  // Calculate metrics for each HM
  const results: HiringManagerFriction[] = [];

  for (const hmId of hmIds) {
    const hmReqs = reqsByHM.get(hmId) || [];
    const hmReqIds = new Set(hmReqs.map(r => r.req_id));

    // Get interview completed events for this HM's reqs
    const interviewCompleted = events.filter(e =>
      hmReqIds.has(e.req_id) &&
      e.event_type === EventType.INTERVIEW_COMPLETED
    );

    // Calculate feedback latencies
    const feedbackLatencies: number[] = [];
    const loopCandidates = new Set<string>();

    for (const ic of interviewCompleted) {
      loopCandidates.add(ic.candidate_id);

      // Find first feedback after this interview
      const feedback = events.find(e =>
        e.candidate_id === ic.candidate_id &&
        e.event_type === EventType.FEEDBACK_SUBMITTED &&
        e.event_at > ic.event_at
      );

      if (feedback) {
        feedbackLatencies.push(differenceInHours(feedback.event_at, ic.event_at));
      }
    }

    // Calculate decision latencies (from last interview to offer/reject)
    const candidateLastInterviews = new Map<string, Date>();
    for (const e of interviewCompleted) {
      const existing = candidateLastInterviews.get(e.candidate_id);
      if (!existing || e.event_at > existing) {
        candidateLastInterviews.set(e.candidate_id, e.event_at);
      }
    }

    const decisionLatencies: number[] = [];
    for (const [candId, lastInterview] of candidateLastInterviews) {
      const decision = events.find(e =>
        e.candidate_id === candId &&
        hmReqIds.has(e.req_id) &&
        (e.event_type === EventType.OFFER_EXTENDED || e.event_type === EventType.REJECTION_SENT) &&
        e.event_at > lastInterview
      );
      if (decision) {
        decisionLatencies.push(differenceInHours(decision.event_at, lastInterview));
      }
    }

    // Offer acceptance for this HM's reqs
    const offers = events.filter(e =>
      hmReqIds.has(e.req_id) &&
      e.event_type === EventType.OFFER_EXTENDED
    );
    const accepts = events.filter(e =>
      hmReqIds.has(e.req_id) &&
      e.event_type === EventType.OFFER_ACCEPTED
    );

    const user = users.find(u => u.user_id === hmId);

    results.push({
      hmId,
      hmName: user?.name || hmId,
      reqsInRange: hmReqs.length,
      feedbackLatencyMedian: median(feedbackLatencies),
      decisionLatencyMedian: median(decisionLatencies),
      offerAcceptanceRate: offers.length > 0 ? accepts.length / offers.length : null,
      hmWeight: 1.0,  // Will be calculated after we have all HM medians
      loopCount: loopCandidates.size
    });
  }

  // Now calculate hm_weight based on relative decision latency
  const allDecisionLatencies = results
    .filter(r => r.decisionLatencyMedian !== null)
    .map(r => r.decisionLatencyMedian as number);

  const p50Latency = median(allDecisionLatencies);

  if (p50Latency !== null && p50Latency > 0) {
    for (const result of results) {
      if (result.decisionLatencyMedian !== null && result.loopCount >= config.thresholds.minLoopsForHMWeight) {
        result.hmWeight = clamp(result.decisionLatencyMedian / p50Latency, 0.8, 1.3);
      } else {
        result.hmWeight = 1.0;  // Default if insufficient data
      }
    }
  }

  return results;
}

/**
 * Creates a map of HM ID to their friction weight
 */
export function createHMWeightsMap(
  frictionMetrics: HiringManagerFriction[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const hm of frictionMetrics) {
    map.set(hm.hmId, hm.hmWeight);
  }
  return map;
}

// ===== DETAILED COMPLEXITY BREAKDOWN =====

export interface ComplexityBreakdown {
  reqId: string;
  reqTitle: string;
  level: string;
  jobFamily: string;
  locationType: string;
  locationCity: string | null;
  hmName: string;
  levelWeight: number;
  levelWeightReason: string;
  marketWeight: number;
  marketWeightReason: string;
  nicheWeight: number;
  nicheWeightReason: string;
  hmWeight: number;
  hmWeightReason: string;
  totalScore: number;
}

/**
 * Gets detailed complexity breakdown for a requisition (for drill-down)
 */
export function getComplexityBreakdown(
  req: Requisition,
  hmWeight: number,
  hmName: string,
  config: DashboardConfig
): ComplexityBreakdown {
  const levelWeight = config.levelWeights[req.level] || 1.0;

  let marketWeight: number;
  switch (req.location_type) {
    case 'Remote': marketWeight = config.marketWeights.Remote; break;
    case 'Hybrid': marketWeight = config.marketWeights.Hybrid; break;
    case 'Onsite': marketWeight = config.marketWeights.Onsite; break;
    default: marketWeight = 1.0;
  }
  const isHardMarket = req.location_city &&
    config.marketWeights.hardMarketsList.some(
      city => city.toLowerCase() === req.location_city?.toLowerCase()
    );
  if (isHardMarket) {
    marketWeight = marketWeight + config.marketWeights.hardMarketBonus;
  }

  const nicheWeight = config.nicheWeights[req.job_family] || 1.0;
  const totalScore = levelWeight * marketWeight * nicheWeight * hmWeight;

  return {
    reqId: req.req_id,
    reqTitle: req.req_title,
    level: req.level,
    jobFamily: req.job_family,
    locationType: req.location_type,
    locationCity: req.location_city,
    hmName,
    levelWeight,
    levelWeightReason: config.levelWeights[req.level]
      ? `Level ${req.level} has weight ${levelWeight}`
      : `Level ${req.level} not in config, using default 1.0`,
    marketWeight,
    marketWeightReason: isHardMarket
      ? `${req.location_type} (${marketWeight - config.marketWeights.hardMarketBonus}) + hard market bonus (${config.marketWeights.hardMarketBonus}) for ${req.location_city}`
      : `${req.location_type} location type`,
    nicheWeight,
    nicheWeightReason: config.nicheWeights[req.job_family]
      ? `${req.job_family} has niche weight ${nicheWeight}`
      : `${req.job_family} not in config, using default 1.0`,
    hmWeight,
    hmWeightReason: hmWeight === 1.0
      ? 'Default weight (insufficient data or new HM)'
      : `Based on HM decision latency relative to median`,
    totalScore
  };
}
