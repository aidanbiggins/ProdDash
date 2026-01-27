// Pre-Mortem Service
// Deterministic risk scoring and failure prediction for requisitions

import { differenceInDays } from 'date-fns';
import { Requisition, Candidate, Event, User, RequisitionStatus, CanonicalStage } from '../types/entities';
import { assessReqHealth } from './reqHealthService';
import { ReqHealthAssessment, ReqHealthStatus } from '../types/dataHygieneTypes';
import { HMPendingAction } from '../types/hmTypes';
import { ActionType, ActionOwnerType, ActionPriority, ActionItem, generateActionId } from '../types/actionTypes';
import {
  PreMortemResult,
  PreMortemScoringContext,
  RiskDriver,
  RiskEvidence,
  RecommendedIntervention,
  ComparableHistory,
  ConfidenceAssessment,
  FailureMode,
  RiskBand,
  RiskScoringWeights,
  RiskThresholds,
  DEFAULT_RISK_WEIGHTS,
  DEFAULT_RISK_THRESHOLDS,
  scoreToRiskBand,
  generateInterventionId,
} from '../types/preMortemTypes';

// ===== CONSTANTS =====

const DEFAULT_BENCHMARK_TTF = 45; // Default TTF benchmark when no cohort data
const DEFAULT_STAGE_DURATION = 7; // Default days per stage

// ===== CONTEXT BUILDING =====

/**
 * Build scoring context for a single requisition.
 */
export function buildScoringContext(
  req: Requisition,
  candidates: Candidate[],
  events: Event[],
  hmActions: HMPendingAction[],
  benchmarkTTF: number | null = null
): PreMortemScoringContext {
  const now = new Date();

  // Calculate days open
  const daysOpen = req.opened_at ? differenceInDays(now, req.opened_at) : 0;

  // Filter candidates for this req
  const reqCandidates = candidates.filter(c => c.req_id === req.req_id);

  // Count active candidates (not rejected/withdrawn/hired)
  const activeCandidates = reqCandidates.filter(c =>
    c.disposition === 'Active' ||
    (!c.disposition && c.current_stage !== CanonicalStage.REJECTED && c.current_stage !== CanonicalStage.WITHDREW)
  );

  // Candidates in offer stage
  const candidatesInOffer = reqCandidates.filter(c =>
    c.current_stage === CanonicalStage.OFFER && c.disposition === 'Active'
  );

  // Max days in offer stage
  let daysInOfferMax: number | null = null;
  if (candidatesInOffer.length > 0) {
    const offerDays = candidatesInOffer
      .filter(c => c.current_stage_entered_at)
      .map(c => differenceInDays(now, c.current_stage_entered_at!));
    if (offerDays.length > 0) {
      daysInOfferMax = Math.max(...offerDays);
    }
  }

  // HM pending actions for this req
  const reqHMActions = hmActions.filter(a => a.reqId === req.req_id);
  const hmPendingCount = reqHMActions.length;

  // Average HM latency (if we have data)
  let hmAvgLatency: number | null = null;
  if (reqHMActions.length > 0) {
    const latencies = reqHMActions.map(a => a.daysWaiting);
    hmAvgLatency = latencies.reduce((sum, d) => sum + d, 0) / latencies.length;
  }

  // Calculate stage velocity ratio from events
  const reqEvents = events.filter(e => e.req_id === req.req_id && e.event_type === 'STAGE_CHANGE');
  let stageVelocityRatio: number | null = null;

  // Simple velocity: if we have stage events, compare average stage duration to benchmark
  if (reqEvents.length >= 2) {
    const sortedEvents = [...reqEvents].sort((a, b) =>
      a.event_at.getTime() - b.event_at.getTime()
    );
    const totalDuration = differenceInDays(
      sortedEvents[sortedEvents.length - 1].event_at,
      sortedEvents[0].event_at
    );
    const stageCount = sortedEvents.length - 1;
    if (stageCount > 0) {
      const avgStageDuration = totalDuration / stageCount;
      const benchmarkStageDuration = DEFAULT_STAGE_DURATION;
      stageVelocityRatio = avgStageDuration / benchmarkStageDuration;
    }
  }

  // Get req health assessment
  const healthAssessment = assessReqHealth(req, candidates, events);
  const isStalled = healthAssessment.status === ReqHealthStatus.STALLED;
  const isZombie = healthAssessment.status === ReqHealthStatus.ZOMBIE;
  const isAtRisk = healthAssessment.status === ReqHealthStatus.AT_RISK;

  return {
    days_open: daysOpen,
    active_candidate_count: activeCandidates.length,
    candidates_in_offer: candidatesInOffer.length,
    days_in_offer_max: daysInOfferMax,
    hm_pending_actions: hmPendingCount,
    hm_avg_latency_days: hmAvgLatency,
    stage_velocity_ratio: stageVelocityRatio,
    is_stalled: isStalled,
    is_zombie: isZombie,
    is_at_risk: isAtRisk,
    benchmark_ttf: benchmarkTTF || DEFAULT_BENCHMARK_TTF,
  };
}

// ===== RISK SCORING =====

interface RiskFactorScore {
  key: string;
  score: number;         // 0-100 severity for this factor
  weight: number;        // Weight from config
  weightedScore: number; // score * (weight/100)
  evidence: RiskEvidence;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Calculate individual risk factor scores.
 */
export function calculateRiskFactors(
  context: PreMortemScoringContext,
  weights: RiskScoringWeights = DEFAULT_RISK_WEIGHTS,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): RiskFactorScore[] {
  const factors: RiskFactorScore[] = [];

  // 1. Pipeline Gap Score
  const pipelineScore = calculatePipelineScore(context, thresholds);
  factors.push({
    key: 'pipeline_gap',
    score: pipelineScore.score,
    weight: weights.pipeline_gap,
    weightedScore: pipelineScore.score * (weights.pipeline_gap / 100),
    evidence: pipelineScore.evidence,
    severity: pipelineScore.severity,
  });

  // 2. Days Open Score (Age vs Benchmark)
  const ageScore = calculateAgeScore(context, thresholds);
  factors.push({
    key: 'days_open',
    score: ageScore.score,
    weight: weights.days_open,
    weightedScore: ageScore.score * (weights.days_open / 100),
    evidence: ageScore.evidence,
    severity: ageScore.severity,
  });

  // 3. Stage Velocity Score
  const velocityScore = calculateVelocityScore(context);
  factors.push({
    key: 'stage_velocity',
    score: velocityScore.score,
    weight: weights.stage_velocity,
    weightedScore: velocityScore.score * (weights.stage_velocity / 100),
    evidence: velocityScore.evidence,
    severity: velocityScore.severity,
  });

  // 4. HM Latency Score
  const hmScore = calculateHMLatencyScore(context, thresholds);
  factors.push({
    key: 'hm_latency',
    score: hmScore.score,
    weight: weights.hm_latency,
    weightedScore: hmScore.score * (weights.hm_latency / 100),
    evidence: hmScore.evidence,
    severity: hmScore.severity,
  });

  // 5. Offer Decay Score
  const offerScore = calculateOfferDecayScore(context, thresholds);
  factors.push({
    key: 'offer_decay',
    score: offerScore.score,
    weight: weights.offer_decay,
    weightedScore: offerScore.score * (weights.offer_decay / 100),
    evidence: offerScore.evidence,
    severity: offerScore.severity,
  });

  // 6. Req Health Score (Zombie/Stalled)
  const healthScore = calculateReqHealthScore(context);
  factors.push({
    key: 'req_health',
    score: healthScore.score,
    weight: weights.req_health,
    weightedScore: healthScore.score * (weights.req_health / 100),
    evidence: healthScore.evidence,
    severity: healthScore.severity,
  });

  return factors;
}

function calculatePipelineScore(
  context: PreMortemScoringContext,
  thresholds: RiskThresholds
): { score: number; evidence: RiskEvidence; severity: 'critical' | 'high' | 'medium' | 'low' } {
  const count = context.active_candidate_count;

  let score: number;
  let severity: 'critical' | 'high' | 'medium' | 'low';
  let description: string;

  if (count === 0) {
    score = 100;
    severity = 'critical';
    description = 'No active candidates in pipeline';
  } else if (count <= thresholds.thin_pipeline_threshold) {
    score = 70 - (count * 10); // 60, 50, 40 for 1, 2, 3 candidates
    severity = count === 1 ? 'high' : 'medium';
    description = `Only ${count} active candidate${count > 1 ? 's' : ''} in pipeline`;
  } else {
    score = Math.max(0, 30 - (count * 3)); // Decreases as pipeline grows
    severity = 'low';
    description = `${count} active candidates in pipeline`;
  }

  return {
    score,
    severity,
    evidence: {
      metric_key: 'pipeline_health',
      actual_value: count,
      benchmark_value: 5, // Target: at least 5 active candidates
      variance: count === 0 ? -100 : ((count - 5) / 5) * 100,
      unit: 'candidates',
      description,
    },
  };
}

function calculateAgeScore(
  context: PreMortemScoringContext,
  thresholds: RiskThresholds
): { score: number; evidence: RiskEvidence; severity: 'critical' | 'high' | 'medium' | 'low' } {
  const daysOpen = context.days_open;
  const benchmark = context.benchmark_ttf || DEFAULT_BENCHMARK_TTF;

  const ratio = daysOpen / benchmark;

  let score: number;
  let severity: 'critical' | 'high' | 'medium' | 'low';
  let description: string;

  if (ratio >= thresholds.age_critical_multiplier) {
    score = 100;
    severity = 'critical';
    description = `Open ${daysOpen}d, ${ratio.toFixed(1)}x expected TTF`;
  } else if (ratio >= thresholds.age_warning_multiplier) {
    score = 50 + (ratio - 1.5) * 100; // 50-100 range
    severity = 'high';
    description = `Open ${daysOpen}d, ${ratio.toFixed(1)}x expected TTF`;
  } else if (ratio >= 1.0) {
    score = 30 + (ratio - 1.0) * 40; // 30-50 range
    severity = 'medium';
    description = `Open ${daysOpen}d, at expected TTF`;
  } else {
    score = ratio * 30; // 0-30 range
    severity = 'low';
    description = `Open ${daysOpen}d, within expected TTF`;
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    severity,
    evidence: {
      metric_key: 'time_to_fill',
      actual_value: daysOpen,
      benchmark_value: benchmark,
      variance: ((daysOpen - benchmark) / benchmark) * 100,
      unit: 'days',
      description,
    },
  };
}

function calculateVelocityScore(
  context: PreMortemScoringContext
): { score: number; evidence: RiskEvidence; severity: 'critical' | 'high' | 'medium' | 'low' } {
  const ratio = context.stage_velocity_ratio;

  if (ratio === null) {
    // No velocity data - low confidence, moderate score
    return {
      score: 30,
      severity: 'medium',
      evidence: {
        metric_key: 'stage_velocity',
        actual_value: 0,
        unit: 'ratio',
        description: 'Insufficient stage data for velocity analysis',
      },
    };
  }

  let score: number;
  let severity: 'critical' | 'high' | 'medium' | 'low';
  let description: string;

  if (ratio >= 2.5) {
    score = 100;
    severity = 'critical';
    description = `Stage velocity ${ratio.toFixed(1)}x slower than benchmark`;
  } else if (ratio >= 1.5) {
    score = 50 + (ratio - 1.5) * 50;
    severity = 'high';
    description = `Stage velocity ${ratio.toFixed(1)}x slower than benchmark`;
  } else if (ratio >= 1.0) {
    score = 20 + (ratio - 1.0) * 60;
    severity = 'medium';
    description = `Stage velocity ${ratio.toFixed(1)}x benchmark`;
  } else {
    score = ratio * 20;
    severity = 'low';
    description = `Stage velocity ${ratio.toFixed(1)}x benchmark (faster)`;
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    severity,
    evidence: {
      metric_key: 'stage_velocity',
      actual_value: ratio,
      benchmark_value: 1.0,
      variance: (ratio - 1.0) * 100,
      unit: 'ratio',
      description,
    },
  };
}

function calculateHMLatencyScore(
  context: PreMortemScoringContext,
  thresholds: RiskThresholds
): { score: number; evidence: RiskEvidence; severity: 'critical' | 'high' | 'medium' | 'low' } {
  const pendingCount = context.hm_pending_actions;
  const avgLatency = context.hm_avg_latency_days;

  if (pendingCount === 0) {
    return {
      score: 0,
      severity: 'low',
      evidence: {
        metric_key: 'hm_latency',
        actual_value: 0,
        unit: 'actions',
        description: 'No pending HM actions',
      },
    };
  }

  const latency = avgLatency || 0;
  let score: number;
  let severity: 'critical' | 'high' | 'medium' | 'low';
  let description: string;

  if (latency >= thresholds.hm_latency_critical_days) {
    score = 80 + (pendingCount * 5); // 85-100 based on count
    severity = 'critical';
    description = `${pendingCount} HM action(s) pending, avg ${latency.toFixed(0)}d wait`;
  } else if (latency >= thresholds.hm_latency_warning_days) {
    score = 50 + (latency * 5) + (pendingCount * 3);
    severity = 'high';
    description = `${pendingCount} HM action(s) pending, avg ${latency.toFixed(0)}d wait`;
  } else {
    score = 20 + (pendingCount * 5);
    severity = 'medium';
    description = `${pendingCount} HM action(s) pending, avg ${latency.toFixed(0)}d wait`;
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    severity,
    evidence: {
      metric_key: 'hm_latency',
      actual_value: latency,
      benchmark_value: 2, // Target: 2 days response time
      variance: latency > 0 ? ((latency - 2) / 2) * 100 : 0,
      unit: 'days',
      description,
    },
  };
}

function calculateOfferDecayScore(
  context: PreMortemScoringContext,
  thresholds: RiskThresholds
): { score: number; evidence: RiskEvidence; severity: 'critical' | 'high' | 'medium' | 'low' } {
  const candidatesInOffer = context.candidates_in_offer;
  const daysInOffer = context.days_in_offer_max;

  if (candidatesInOffer === 0) {
    return {
      score: 0,
      severity: 'low',
      evidence: {
        metric_key: 'offer_decay',
        actual_value: 0,
        unit: 'days',
        description: 'No candidates in offer stage',
      },
    };
  }

  const days = daysInOffer || 0;
  let score: number;
  let severity: 'critical' | 'high' | 'medium' | 'low';
  let description: string;

  if (days >= thresholds.offer_decay_critical_days) {
    score = 90 + Math.min(10, days - thresholds.offer_decay_critical_days);
    severity = 'critical';
    description = `Offer pending ${days}d - high decline risk`;
  } else if (days >= thresholds.offer_decay_warning_days) {
    score = 50 + (days - thresholds.offer_decay_warning_days) * 8;
    severity = 'high';
    description = `Offer pending ${days}d - follow up needed`;
  } else {
    score = days * 10;
    severity = days >= 3 ? 'medium' : 'low';
    description = `Offer pending ${days}d`;
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    severity,
    evidence: {
      metric_key: 'offer_decay',
      actual_value: days,
      benchmark_value: 3, // Target: accept within 3 days
      variance: days > 0 ? ((days - 3) / 3) * 100 : 0,
      unit: 'days',
      description,
    },
  };
}

function calculateReqHealthScore(
  context: PreMortemScoringContext
): { score: number; evidence: RiskEvidence; severity: 'critical' | 'high' | 'medium' | 'low' } {
  let score: number;
  let severity: 'critical' | 'high' | 'medium' | 'low';
  let description: string;

  if (context.is_zombie) {
    score = 100;
    severity = 'critical';
    description = 'Zombie req - no activity 30+ days';
  } else if (context.is_stalled) {
    score = 70;
    severity = 'high';
    description = 'Stalled req - no activity 14-30 days';
  } else if (context.is_at_risk) {
    score = 50;
    severity = 'medium';
    description = 'At-risk - open 120+ days with thin pipeline';
  } else {
    score = 0;
    severity = 'low';
    description = 'Req health is active';
  }

  return {
    score,
    severity,
    evidence: {
      metric_key: 'req_health',
      actual_value: score,
      unit: 'status',
      description,
    },
  };
}

// ===== FAILURE MODE DETECTION =====

/**
 * Determine the primary failure mode based on risk factors.
 */
export function determineFailureMode(factors: RiskFactorScore[]): FailureMode {
  // Sort by weighted score (highest first)
  const sorted = [...factors].sort((a, b) => b.weightedScore - a.weightedScore);

  // Get highest scoring factor
  const topFactor = sorted[0];

  // Map factor key to failure mode
  const modeMapping: Record<string, FailureMode> = {
    pipeline_gap: 'EMPTY_PIPELINE',
    hm_latency: 'HM_DELAY',
    offer_decay: 'OFFER_RISK',
    days_open: 'AGING_DECAY',
    stage_velocity: 'STALLED_PIPELINE',
    req_health: topFactor.evidence.description.includes('Zombie') ? 'AGING_DECAY' : 'STALLED_PIPELINE',
  };

  // Check for complexity mismatch (high age + low pipeline = complexity issue)
  const pipelineFactor = factors.find(f => f.key === 'pipeline_gap');
  const ageFactor = factors.find(f => f.key === 'days_open');
  if (
    pipelineFactor &&
    ageFactor &&
    pipelineFactor.score >= 70 &&
    ageFactor.score >= 50 &&
    topFactor.key === 'pipeline_gap'
  ) {
    return 'COMPLEXITY_MISMATCH';
  }

  return modeMapping[topFactor.key] || 'UNKNOWN';
}

// ===== INTERVENTION GENERATION =====

/**
 * Generate recommended interventions based on risk factors.
 */
export function generateInterventions(
  reqId: string,
  factors: RiskFactorScore[],
  failureMode: FailureMode
): RecommendedIntervention[] {
  const interventions: RecommendedIntervention[] = [];

  // Sort factors by weighted score
  const topFactors = [...factors]
    .filter(f => f.score >= 30) // Only consider significant factors
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, 3);

  for (const factor of topFactors) {
    const intervention = createInterventionForFactor(reqId, factor, failureMode);
    if (intervention) {
      interventions.push(intervention);
    }
  }

  return interventions;
}

function createInterventionForFactor(
  reqId: string,
  factor: RiskFactorScore,
  failureMode: FailureMode
): RecommendedIntervention | null {
  const interventionTemplates: Record<string, {
    action_type: ActionType;
    owner_type: ActionOwnerType;
    title: string;
    description: string;
    priority: ActionPriority;
    impact: string;
    steps: string[];
  }> = {
    pipeline_gap: {
      action_type: 'SOURCE_CANDIDATES',
      owner_type: 'RECRUITER',
      title: 'Emergency Pipeline Sourcing',
      description: 'Pipeline is critically thin or empty. Immediate sourcing needed.',
      priority: factor.severity === 'critical' ? 'P0' : 'P1',
      impact: 'Could add 3-5 candidates within 1 week',
      steps: [
        'Review job posting and refresh if stale',
        'Activate sourcing channels (LinkedIn, referrals)',
        'Consider expanding search criteria',
        'Request recruiter support if needed',
      ],
    },
    hm_latency: {
      action_type: 'FEEDBACK_DUE',
      owner_type: 'HIRING_MANAGER',
      title: 'HM Response Needed',
      description: 'Hiring manager actions are overdue. Escalate for resolution.',
      priority: factor.severity === 'critical' ? 'P0' : 'P1',
      impact: 'Could reduce TTF by 3-5 days',
      steps: [
        'Send reminder to hiring manager',
        'Schedule sync meeting if no response',
        'Escalate to HM manager if critical',
        'Document delays in tracking system',
      ],
    },
    offer_decay: {
      action_type: 'FOLLOW_UP_OFFERS',
      owner_type: 'RECRUITER',
      title: 'Offer Follow-Up Required',
      description: 'Offer is pending too long. Risk of candidate declining.',
      priority: 'P0', // Offers always urgent
      impact: 'Could save offer acceptance',
      steps: [
        'Call candidate to understand concerns',
        'Address any compensation questions',
        'Set firm decision deadline',
        'Prepare backup candidate if available',
      ],
    },
    days_open: {
      action_type: 'REVIEW_STALLED_REQS',
      owner_type: 'TA_OPS',
      title: 'Review Aging Requisition',
      description: 'Req has been open longer than expected. Review viability.',
      priority: factor.severity === 'critical' ? 'P0' : 'P1',
      impact: 'Could identify root cause and correct course',
      steps: [
        'Review req requirements for feasibility',
        'Check if salary band is competitive',
        'Consider role level adjustment',
        'Discuss with HM about expectations',
      ],
    },
    stage_velocity: {
      action_type: 'STREAMLINE_PROCESS',
      owner_type: 'TA_OPS',
      title: 'Streamline Interview Process',
      description: 'Stage progression is slower than benchmark. Review bottlenecks.',
      priority: 'P1',
      impact: 'Could reduce stage duration by 2-3 days',
      steps: [
        'Identify slowest stages in funnel',
        'Check interviewer availability',
        'Consider consolidating interview rounds',
        'Set SLAs for feedback turnaround',
      ],
    },
    req_health: {
      action_type: 'REVIEW_ZOMBIE_REQS',
      owner_type: 'RECRUITER',
      title: 'Revive or Close Zombie Req',
      description: 'Req has no recent activity. Decide to revive or close.',
      priority: factor.severity === 'critical' ? 'P0' : 'P1',
      impact: 'Could free up recruiter capacity or restart momentum',
      steps: [
        'Contact hiring manager for status',
        'Determine if role still needed',
        'If needed, create action plan to restart',
        'If not, close req and update tracking',
      ],
    },
  };

  const template = interventionTemplates[factor.key];
  if (!template) return null;

  return {
    intervention_id: generateInterventionId(reqId, template.action_type, template.owner_type),
    action_type: template.action_type,
    owner_type: template.owner_type,
    title: template.title,
    description: template.description,
    priority: template.priority,
    estimated_impact: template.impact,
    steps: template.steps,
  };
}

// ===== COMPARABLE HISTORY =====

/**
 * Find comparable historical requisitions for context.
 */
export function findComparableHistory(
  req: Requisition,
  allReqs: Requisition[]
): ComparableHistory[] {
  const history: ComparableHistory[] = [];

  // Filter to closed reqs
  const closedReqs = allReqs.filter(r =>
    r.status === RequisitionStatus.Closed && r.closed_at && r.opened_at
  );

  // Build cohort key from req attributes
  const cohortParts: string[] = [];
  if (req.function) cohortParts.push(req.function);
  if (req.level) cohortParts.push(req.level);
  if (req.location_type) cohortParts.push(req.location_type);

  // Find exact cohort matches
  const exactMatches = closedReqs.filter(r =>
    r.function === req.function &&
    r.level === req.level &&
    r.location_type === req.location_type
  );

  if (exactMatches.length >= 3) {
    const ttfs = exactMatches
      .map(r => differenceInDays(r.closed_at!, r.opened_at!))
      .filter(d => d > 0);
    const avgTTF = ttfs.length > 0 ? Math.round(ttfs.reduce((a, b) => a + b, 0) / ttfs.length) : 0;

    history.push({
      cohort_key: cohortParts.join(' - ') || 'Similar roles',
      count: exactMatches.length,
      outcome_summary: `Avg ${avgTTF}d TTF, ${exactMatches.length} historical hires`,
    });
  }

  // Fallback to function-only matches
  if (history.length === 0 && req.function) {
    const functionMatches = closedReqs.filter(r => r.function === req.function);
    if (functionMatches.length >= 3) {
      const ttfs = functionMatches
        .map(r => differenceInDays(r.closed_at!, r.opened_at!))
        .filter(d => d > 0);
      const avgTTF = ttfs.length > 0 ? Math.round(ttfs.reduce((a, b) => a + b, 0) / ttfs.length) : 0;

      history.push({
        cohort_key: req.function,
        count: functionMatches.length,
        outcome_summary: `Avg ${avgTTF}d TTF across ${functionMatches.length} ${req.function} roles`,
      });
    }
  }

  // Global fallback
  if (history.length === 0 && closedReqs.length >= 3) {
    const ttfs = closedReqs
      .map(r => differenceInDays(r.closed_at!, r.opened_at!))
      .filter(d => d > 0);
    const avgTTF = ttfs.length > 0 ? Math.round(ttfs.reduce((a, b) => a + b, 0) / ttfs.length) : 0;

    history.push({
      cohort_key: 'All roles',
      count: closedReqs.length,
      outcome_summary: `Org avg ${avgTTF}d TTF across ${closedReqs.length} hires`,
    });
  }

  return history;
}

// ===== CONFIDENCE ASSESSMENT =====

/**
 * Assess confidence in the pre-mortem result.
 */
export function assessConfidence(
  context: PreMortemScoringContext,
  comparableHistory: ComparableHistory[]
): ConfidenceAssessment {
  let confidence: 'HIGH' | 'MED' | 'LOW';
  let reasons: string[] = [];

  // Check data completeness
  const hasVelocityData = context.stage_velocity_ratio !== null;
  const hasBenchmark = context.benchmark_ttf !== null;
  const hasHistory = comparableHistory.length > 0 && comparableHistory[0].count >= 5;

  // Calculate confidence score
  let confidenceScore = 0;

  if (hasVelocityData) confidenceScore += 30;
  if (hasBenchmark) confidenceScore += 30;
  if (hasHistory) confidenceScore += 40;

  if (confidenceScore >= 70) {
    confidence = 'HIGH';
    reasons.push('Strong historical data available');
    if (hasVelocityData) reasons.push('Stage velocity data available');
  } else if (confidenceScore >= 40) {
    confidence = 'MED';
    if (!hasVelocityData) reasons.push('Limited stage progression data');
    if (!hasHistory) reasons.push('Few comparable historical reqs');
  } else {
    confidence = 'LOW';
    reasons.push('Limited data for comparison');
    if (!hasVelocityData) reasons.push('No stage velocity data');
    if (!hasBenchmark) reasons.push('No benchmark TTF data');
    if (!hasHistory) reasons.push('No comparable history');
  }

  return {
    level: confidence,
    reason: reasons.join('; '),
  };
}

// ===== MAIN PRE-MORTEM FUNCTION =====

/**
 * Run pre-mortem analysis for a single requisition.
 */
export function runPreMortem(
  req: Requisition,
  candidates: Candidate[],
  events: Event[],
  allReqs: Requisition[],
  hmActions: HMPendingAction[],
  benchmarkTTF: number | null = null,
  weights: RiskScoringWeights = DEFAULT_RISK_WEIGHTS,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): PreMortemResult {
  // Build scoring context
  const context = buildScoringContext(req, candidates, events, hmActions, benchmarkTTF);

  // Calculate risk factors
  const factors = calculateRiskFactors(context, weights, thresholds);

  // Calculate base risk score (sum of weighted scores)
  let riskScore = Math.round(
    factors.reduce((sum, f) => sum + f.weightedScore, 0)
  );

  // Apply critical condition multipliers
  // When a req has empty/thin pipeline AND is aging, factors like offer_decay
  // score 0 (no candidates to be at risk), which artificially lowers the score.
  // We need to recognize these as critical situations.
  const pipelineFactor = factors.find(f => f.key === 'pipeline_gap');
  const ageFactor = factors.find(f => f.key === 'days_open');

  // Critical combo: Empty pipeline + significantly aging
  if (pipelineFactor && ageFactor) {
    const hasEmptyPipeline = context.active_candidate_count === 0;
    const hasThinPipeline = context.active_candidate_count <= thresholds.thin_pipeline_threshold;
    const isAging = ageFactor.score >= 50; // At or past expected TTF
    const isCriticallyAging = ageFactor.score >= 80;

    if (hasEmptyPipeline && isCriticallyAging) {
      // Empty pipeline + way over TTF = definitely HIGH risk
      riskScore = Math.max(riskScore, 85);
    } else if (hasEmptyPipeline && isAging) {
      // Empty pipeline + past TTF = HIGH risk
      riskScore = Math.max(riskScore, 75);
    } else if (hasEmptyPipeline) {
      // Empty pipeline alone = at least MED risk
      riskScore = Math.max(riskScore, 50);
    } else if (hasThinPipeline && isCriticallyAging) {
      // Thin pipeline + way over TTF = HIGH risk
      riskScore = Math.max(riskScore, 70);
    } else if (hasThinPipeline && isAging) {
      // Thin pipeline + past TTF = MED-HIGH risk
      riskScore = Math.max(riskScore, 55);
    }
  }

  // Determine risk band
  const riskBand = scoreToRiskBand(riskScore, thresholds);

  // Determine failure mode
  const failureMode = determineFailureMode(factors);

  // Convert factors to risk drivers
  const topDrivers: RiskDriver[] = factors
    .filter(f => f.score >= 20) // Only include significant factors
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, 4)
    .map(f => ({
      driver_key: f.key,
      description: f.evidence.description,
      severity: f.severity,
      weight: f.weight,
      evidence: f.evidence,
    }));

  // Generate interventions
  const interventions = generateInterventions(req.req_id, factors, failureMode);

  // Find comparable history
  const comparableHistory = findComparableHistory(req, allReqs);

  // Assess confidence
  const confidence = assessConfidence(context, comparableHistory);

  return {
    req_id: req.req_id,
    req_title: req.req_title || req.req_id,
    risk_score: Math.min(100, Math.max(0, riskScore)),
    risk_band: riskBand,
    failure_mode: failureMode,
    top_drivers: topDrivers,
    recommended_interventions: interventions,
    comparable_history: comparableHistory,
    confidence,
    assessed_at: new Date(),
    days_open: context.days_open,
    active_candidate_count: context.active_candidate_count,
  };
}

/**
 * Run pre-mortem analysis for all open requisitions.
 */
export function runPreMortemBatch(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  hmActions: HMPendingAction[],
  benchmarkTTFMap: Map<string, number> = new Map(),
  weights: RiskScoringWeights = DEFAULT_RISK_WEIGHTS,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): PreMortemResult[] {
  // Filter to open reqs only
  const openReqs = requisitions.filter(r => r.status === RequisitionStatus.Open);

  return openReqs.map(req => {
    const benchmarkTTF = benchmarkTTFMap.get(req.req_id) || null;
    return runPreMortem(
      req,
      candidates,
      events,
      requisitions,
      hmActions,
      benchmarkTTF,
      weights,
      thresholds
    );
  });
}

/**
 * Get only HIGH risk pre-mortem results.
 */
export function getHighRiskPreMortems(results: PreMortemResult[]): PreMortemResult[] {
  return results
    .filter(r => r.risk_band === 'HIGH')
    .sort((a, b) => b.risk_score - a.risk_score);
}

// ===== ACTION QUEUE INTEGRATION =====

/**
 * Convert pre-mortem interventions to ActionItems for the action queue.
 */
export function convertToActionItems(
  preMortems: PreMortemResult[],
  onlyHighRisk: boolean = true
): ActionItem[] {
  const results = onlyHighRisk ? getHighRiskPreMortems(preMortems) : preMortems;
  const now = new Date();

  const actions: ActionItem[] = [];

  for (const pm of results) {
    for (const intervention of pm.recommended_interventions) {
      // Calculate due date based on priority
      const dueDays = intervention.priority === 'P0' ? 1 : intervention.priority === 'P1' ? 3 : 7;
      const dueDate = new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000);

      actions.push({
        action_id: generateActionId(
          intervention.owner_type,
          intervention.owner_type === 'RECRUITER' ? 'all_recruiters' :
            intervention.owner_type === 'HIRING_MANAGER' ? 'all_hms' : 'ta_ops_team',
          pm.req_id,
          intervention.action_type
        ),
        owner_type: intervention.owner_type,
        owner_id: intervention.owner_type === 'RECRUITER' ? 'all_recruiters' :
          intervention.owner_type === 'HIRING_MANAGER' ? 'all_hms' : 'ta_ops_team',
        owner_name: intervention.owner_type === 'RECRUITER' ? 'Recruiting Team' :
          intervention.owner_type === 'HIRING_MANAGER' ? 'Hiring Manager' : 'TA Ops',
        req_id: pm.req_id,
        req_title: pm.req_title,
        action_type: intervention.action_type,
        title: intervention.title,
        priority: intervention.priority,
        due_in_days: dueDays,
        due_date: dueDate,
        evidence: {
          kpi_key: 'pre_mortem',
          explain_provider_key: 'pre_mortem',
          short_reason: `Risk Score: ${pm.risk_score}/100 - ${pm.failure_mode}`,
        },
        recommended_steps: intervention.steps,
        created_at: now,
        status: 'OPEN',
      });
    }
  }

  return actions;
}
