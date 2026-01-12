// Pre-Mortem Types
// Deterministic risk scoring and failure prediction for requisitions

import { ActionItem, ActionType, ActionOwnerType, ActionPriority } from './actionTypes';

// ===== FAILURE MODES =====

/**
 * Failure modes represent the primary reason a req is likely to fail.
 * Mapped from the highest weighted risk driver.
 */
export type FailureMode =
  | 'EMPTY_PIPELINE'       // No active candidates in pipeline
  | 'HM_DELAY'             // Hiring manager latency causing bottleneck
  | 'OFFER_RISK'           // Candidate in offer stage too long, at risk of decline
  | 'COMPLEXITY_MISMATCH'  // Role complexity exceeds typical TTF expectations
  | 'AGING_DECAY'          // Req open too long, conversion rates declining
  | 'STALLED_PIPELINE'     // Pipeline exists but not progressing
  | 'UNKNOWN';             // Could not determine primary failure mode

// ===== RISK BANDS =====

export type RiskBand = 'LOW' | 'MED' | 'HIGH';

// ===== CONFIDENCE =====

export type PreMortemConfidence = 'HIGH' | 'MED' | 'LOW';

export interface ConfidenceAssessment {
  level: PreMortemConfidence;
  reason: string;
}

// ===== RISK DRIVERS =====

/**
 * A risk driver is a specific factor contributing to the overall risk score.
 * Each driver has evidence linking back to underlying metrics.
 */
export interface RiskDriver {
  driver_key: string;           // Unique key for this driver (e.g., 'pipeline_gap', 'hm_latency')
  description: string;          // Human-readable description
  severity: 'critical' | 'high' | 'medium' | 'low';
  weight: number;               // 0-100, contribution to overall score
  evidence: RiskEvidence;
}

export interface RiskEvidence {
  metric_key: string;           // Links to explain provider or metric (e.g., 'hm_latency', 'pipeline_health')
  actual_value: number;
  benchmark_value?: number;     // Expected/target value
  variance?: number;            // Percentage variance from benchmark
  unit: string;                 // 'days', 'candidates', '%', etc.
  description: string;          // Short evidence string
}

// ===== COMPARABLE HISTORY =====

/**
 * Historical cohort comparison for context.
 */
export interface ComparableHistory {
  cohort_key: string;           // e.g., 'Engineering-Senior-Remote'
  count: number;                // Number of similar historical reqs
  outcome_summary: string;      // e.g., 'Avg 45d TTF, 85% fill rate'
}

// ===== RECOMMENDED INTERVENTIONS =====

/**
 * Interventions are suggested actions to mitigate risk.
 * Compatible with ActionItem for queue integration.
 */
export interface RecommendedIntervention {
  intervention_id: string;      // Deterministic ID for deduplication
  action_type: ActionType;
  owner_type: ActionOwnerType;
  title: string;
  description: string;
  priority: ActionPriority;
  estimated_impact: string;     // e.g., 'Could reduce TTF by 5-10 days'
  steps: string[];              // Specific recommended steps
}

// ===== PRE-MORTEM RESULT =====

/**
 * The complete Pre-Mortem assessment for a single requisition.
 */
export interface PreMortemResult {
  req_id: string;
  req_title: string;

  // Risk assessment
  risk_score: number;           // 0-100, higher = more at risk
  risk_band: RiskBand;
  failure_mode: FailureMode;

  // Drivers and evidence
  top_drivers: RiskDriver[];    // Sorted by weight (highest first)

  // Recommended actions
  recommended_interventions: RecommendedIntervention[];

  // Historical context
  comparable_history: ComparableHistory[];

  // Confidence in the assessment
  confidence: ConfidenceAssessment;

  // Metadata
  assessed_at: Date;
  days_open: number;
  active_candidate_count: number;
}

// ===== RISK SCORING WEIGHTS =====

/**
 * Weights for risk scoring model.
 * Total weights should sum to 100.
 */
export interface RiskScoringWeights {
  pipeline_gap: number;         // Weight for empty/thin pipeline
  days_open: number;            // Weight for age vs benchmark
  stage_velocity: number;       // Weight for slow stage progression
  hm_latency: number;           // Weight for HM response delays
  offer_decay: number;          // Weight for offer stage risk
  req_health: number;           // Weight for stalled/zombie status
}

export const DEFAULT_RISK_WEIGHTS: RiskScoringWeights = {
  pipeline_gap: 25,             // Critical - no candidates = no hire
  days_open: 20,                // Important - aging reqs have lower conversion
  stage_velocity: 15,           // Medium - slow movement indicates issues
  hm_latency: 15,               // Medium - HM delays extend TTF significantly
  offer_decay: 15,              // Medium-High - offers at risk are costly
  req_health: 10,               // Base health status (zombie/stalled)
};

// ===== RISK THRESHOLDS =====

export interface RiskThresholds {
  // Pipeline thresholds
  empty_pipeline_threshold: number;          // 0 candidates = critical
  thin_pipeline_threshold: number;           // < X candidates = concerning

  // Age thresholds (vs benchmark)
  age_warning_multiplier: number;            // 1.5x benchmark = warning
  age_critical_multiplier: number;           // 2x benchmark = critical

  // HM latency thresholds
  hm_latency_warning_days: number;           // Days until warning
  hm_latency_critical_days: number;          // Days until critical

  // Offer decay thresholds
  offer_decay_warning_days: number;          // Days in offer stage until warning
  offer_decay_critical_days: number;         // Days in offer stage until critical

  // Risk band thresholds
  high_risk_threshold: number;               // Score >= X = HIGH risk
  med_risk_threshold: number;                // Score >= X = MED risk
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  empty_pipeline_threshold: 0,
  thin_pipeline_threshold: 3,

  age_warning_multiplier: 1.5,
  age_critical_multiplier: 2.0,

  hm_latency_warning_days: 3,
  hm_latency_critical_days: 5,

  offer_decay_warning_days: 5,
  offer_decay_critical_days: 10,

  high_risk_threshold: 70,
  med_risk_threshold: 40,
};

// ===== SCORING CONTEXT =====

/**
 * Context passed to the scoring function for a single req.
 */
export interface PreMortemScoringContext {
  days_open: number;
  active_candidate_count: number;
  candidates_in_offer: number;
  days_in_offer_max: number | null;         // Max days any candidate has been in offer
  hm_pending_actions: number;               // Count of pending HM actions
  hm_avg_latency_days: number | null;       // Average HM response time
  stage_velocity_ratio: number | null;      // Actual/benchmark velocity (1.0 = on track)
  is_stalled: boolean;
  is_zombie: boolean;
  is_at_risk: boolean;
  benchmark_ttf: number | null;             // Expected TTF for this cohort
}

// ===== HELPER FUNCTIONS =====

/**
 * Convert risk score to risk band.
 */
export function scoreToRiskBand(score: number, thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS): RiskBand {
  if (score >= thresholds.high_risk_threshold) return 'HIGH';
  if (score >= thresholds.med_risk_threshold) return 'MED';
  return 'LOW';
}

/**
 * Generate deterministic intervention ID.
 */
export function generateInterventionId(
  reqId: string,
  actionType: ActionType,
  ownerType: ActionOwnerType
): string {
  return `premortem_${reqId}_${actionType}_${ownerType}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

/**
 * Get failure mode display label.
 */
export function getFailureModeLabel(mode: FailureMode): string {
  const labels: Record<FailureMode, string> = {
    EMPTY_PIPELINE: 'Empty Pipeline',
    HM_DELAY: 'HM Bottleneck',
    OFFER_RISK: 'Offer at Risk',
    COMPLEXITY_MISMATCH: 'Complexity Issue',
    AGING_DECAY: 'Age Decay',
    STALLED_PIPELINE: 'Stalled Pipeline',
    UNKNOWN: 'Unknown Risk',
  };
  return labels[mode];
}

/**
 * Get risk band color.
 */
export function getRiskBandColor(band: RiskBand): string {
  const colors: Record<RiskBand, string> = {
    HIGH: '#ef4444',    // Red
    MED: '#f59e0b',     // Amber
    LOW: '#22c55e',     // Green
  };
  return colors[band];
}
