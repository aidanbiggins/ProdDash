// Capacity Fit Engine Types
// All interfaces and types for the capacity planning module

// ===== CONSTANTS =====

export const CAPACITY_CONSTANTS = {
  // Shrinkage constant
  SHRINKAGE_K: 5,

  // Capacity thresholds
  MIN_STABLE_WEEKS: 8,
  MIN_RECRUITERS_FOR_TEAM: 3,
  MIN_REQS_FOR_ANALYSIS: 10,

  // Utilization thresholds
  UTILIZATION_CRITICAL: 1.2,
  UTILIZATION_OVERLOADED: 1.1,
  UTILIZATION_BALANCED_HIGH: 1.1,
  UTILIZATION_BALANCED_LOW: 0.9,
  UTILIZATION_AVAILABLE: 0.7,

  // Fit thresholds
  FIT_STRONG: 0.3,
  FIT_GOOD: 0.1,
  FIT_WEAK: -0.1,
  FIT_POOR: -0.3,

  // Sample thresholds
  MIN_N_FOR_FIT_CELL: 3,
  MIN_N_FOR_FIT_PAIR: 5,
  MIN_N_FOR_FIT_SINGLE: 8,
  MIN_N_FOR_TEAM: 15,

  // Aging multiplier
  AGING_CAP: 1.6,
  AGING_SCALE_DAYS: 90,
  AGING_SCALE_FACTOR: 0.3,

  // Rebalancing constraints
  MAX_DEST_UTILIZATION_AFTER_MOVE: 1.05,
  MIN_SOURCE_RELIEF: 0.05,
  MAX_MOVES_PER_RECRUITER: 2,
  MIN_FIT_FOR_ASSIGNMENT: -0.2,

  // Metric weights for FitScore
  METRIC_WEIGHTS: {
    hires_per_wu: 0.4,
    ttf_days: 0.25,
    offer_accept_rate: 0.2,
    candidate_throughput: 0.15
  }
} as const;

// ===== ENUMS =====

export type ConfidenceLevel = 'HIGH' | 'MED' | 'LOW' | 'INSUFFICIENT';

export type LoadStatus = 'critical' | 'overloaded' | 'balanced' | 'available' | 'underutilized';

export type FitLabel = 'Strong Fit' | 'Good Fit' | 'Neutral' | 'Weak Fit' | 'Poor Fit';

export type CapacityDriverType =
  | 'empty_pipeline'
  | 'high_friction_hm'
  | 'aging_reqs'
  | 'niche_roles'
  | 'understaffed_function';

export type LevelBand = 'Junior' | 'Mid' | 'Senior' | 'Leadership';

// ===== SEGMENT TYPES =====

export interface SegmentKey {
  jobFamily: string;
  levelBand: LevelBand;
  locationType: string;
}

export function segmentKeyToString(segment: SegmentKey): string {
  return `${segment.jobFamily}/${segment.levelBand}/${segment.locationType}`;
}

export function stringToSegmentKey(str: string): SegmentKey | null {
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  return {
    jobFamily: parts[0],
    levelBand: parts[1] as LevelBand,
    locationType: parts[2]
  };
}

// ===== WORKLOAD SCORING =====

export interface WorkloadComponents {
  baseDifficulty: number;
  remainingWork: number;
  frictionMultiplier: number;
  agingMultiplier: number;
}

export interface ReqWithWorkload {
  reqId: string;
  reqTitle: string;
  recruiterId: string;
  workloadScore: number;
  components: WorkloadComponents;
  segment: SegmentKey;
  hasOfferOut: boolean;
  hasFinalist: boolean;
  reqAgeDays: number;
}

// ===== CAPACITY =====

export interface RecruiterCapacity {
  recruiterId: string;
  recruiterName: string;
  sustainableCapacityUnits: number;
  stableWeeksCount: number;
  usedTeamMedian: boolean;
  confidence: ConfidenceLevel;
}

export interface CapacityDriver {
  type: CapacityDriverType;
  description: string;
  impactWU: number;
  reqIds: string[];
}

export interface TeamCapacitySummary {
  teamDemand: number;
  teamCapacity: number;
  capacityGap: number;
  capacityGapPercent: number;
  confidence: ConfidenceLevel;
  topDrivers: CapacityDriver[];
  status: 'understaffed' | 'overstaffed' | 'balanced';
}

// ===== RECRUITER LOAD =====

export interface RecruiterLoadRow {
  recruiterId: string;
  recruiterName: string;
  demandWU: number;
  capacityWU: number;
  utilization: number;
  status: LoadStatus;
  topDriver: string;
  reqCount: number;
  confidence: ConfidenceLevel;
}

// ===== FIT SCORING =====

export interface MetricResidual {
  metric: string;
  observed: number;
  expected: number;
  rawResidual: number;
  sampleSize: number;
  shrinkageFactor: number;
  adjustedResidual: number;
  weight: number;
  contribution: number;
}

export interface FitMatrixCell {
  recruiterId: string;
  recruiterName: string;
  segment: SegmentKey;
  segmentString: string;
  fitScore: number;
  confidence: ConfidenceLevel;
  sampleSize: number;
  metrics: {
    hires_per_wu: { value: number; residual: number; n: number };
    ttf_days: { value: number; residual: number; n: number };
    offer_accept_rate: { value: number; residual: number; n: number };
    candidate_throughput: { value: number; residual: number; n: number };
  };
}

// ===== REBALANCING =====

export interface RebalanceRecommendation {
  reqId: string;
  reqTitle: string;
  fromRecruiterId: string;
  fromRecruiterName: string;
  fromUtilization: number;
  toRecruiterId: string;
  toRecruiterName: string;
  toUtilization: number;
  rationale: string;
  fitScoreImprovement: number | null;
  demandImpact: number;
  rank: number;
}

// ===== EXPLAIN DRAWERS =====

export interface OverloadExplanation {
  recruiterId: string;
  recruiterName: string;
  currentDemand: number;
  sustainableCapacity: number;
  utilization: number;

  demandBreakdown: Array<{
    reqId: string;
    reqTitle: string;
    workloadScore: number;
    components: WorkloadComponents;
  }>;

  capacityDerivation: {
    stableWeeksCount: number;
    medianWeeklyLoad: number;
    confidenceNote: string;
  };

  recommendations: string[];
}

export interface FitExplanation {
  recruiterId: string;
  recruiterName: string;
  segment: SegmentKey;
  segmentString: string;
  fitScore: number;
  confidence: ConfidenceLevel;

  metricBreakdown: MetricResidual[];

  sampleReqs: Array<{
    reqId: string;
    reqTitle: string;
    outcome: 'hired' | 'open' | 'closed_no_hire';
    ttfDays: number | null;
  }>;

  caveat: string | null;
}

// ===== ENGINE OUTPUT =====

export interface CapacityAnalysisResult {
  blocked: boolean;
  blockReason: string | null;

  teamSummary: TeamCapacitySummary | null;
  recruiterLoads: RecruiterLoadRow[];
  fitMatrix: FitMatrixCell[];
  rebalanceRecommendations: RebalanceRecommendation[];

  // For explain drawers
  reqWorkloads: ReqWithWorkload[];
  recruiterCapacities: RecruiterCapacity[];
}

// ===== BLOCKING CONDITIONS =====

export interface BlockingConditions {
  hasMinRecruiters: boolean;
  hasMinReqs: boolean;
  hasEventData: boolean;
  hasRecruiterIds: boolean;
  recruiterIdCoverage: number;
}

// ===== HELPER FUNCTIONS =====

export function getLoadStatus(utilization: number): LoadStatus {
  if (utilization > CAPACITY_CONSTANTS.UTILIZATION_CRITICAL) return 'critical';
  if (utilization > CAPACITY_CONSTANTS.UTILIZATION_OVERLOADED) return 'overloaded';
  if (utilization > CAPACITY_CONSTANTS.UTILIZATION_BALANCED_LOW) return 'balanced';
  if (utilization > CAPACITY_CONSTANTS.UTILIZATION_AVAILABLE) return 'available';
  return 'underutilized';
}

export function getFitLabel(fitScore: number): FitLabel {
  if (fitScore > CAPACITY_CONSTANTS.FIT_STRONG) return 'Strong Fit';
  if (fitScore > CAPACITY_CONSTANTS.FIT_GOOD) return 'Good Fit';
  if (fitScore > CAPACITY_CONSTANTS.FIT_WEAK) return 'Neutral';
  if (fitScore > CAPACITY_CONSTANTS.FIT_POOR) return 'Weak Fit';
  return 'Poor Fit';
}

export function calculateConfidence(n: number, minThreshold: number): ConfidenceLevel {
  if (n < minThreshold) return 'INSUFFICIENT';
  if (n < minThreshold * 1.5) return 'LOW';
  if (n < minThreshold * 2) return 'MED';
  return 'HIGH';
}

export function levelToLevelBand(level: string): LevelBand {
  const normalized = level.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Handle L1, L2, IC1, IC2, etc.
  if (/^(L|IC)?[12]$/.test(normalized) || /JUNIOR|ENTRY|ASSOCIATE/.test(normalized)) {
    return 'Junior';
  }

  // Handle L3, L4, IC3, IC4, etc.
  if (/^(L|IC)?[34]$/.test(normalized) || /MID|INTERMEDIATE/.test(normalized)) {
    return 'Mid';
  }

  // Handle L5, L6, IC5, IC6, Staff, Principal
  if (/^(L|IC)?[56]$/.test(normalized) || /SENIOR|STAFF|PRINCIPAL/.test(normalized)) {
    return 'Senior';
  }

  // Handle L7+, Director, VP, etc.
  if (/^(L|IC)?[789]$/.test(normalized) || /DIRECTOR|VP|HEAD|LEAD|MANAGER|CHIEF/.test(normalized)) {
    return 'Leadership';
  }

  // Default to Mid if unknown
  return 'Mid';
}

// ============================================
// ORACLE CAPACITY-AWARE TYPES (v1)
// ============================================

import { CanonicalStage, Event, Candidate, Requisition, User } from './entities';

/** Confidence reason for capacity inference */
export interface OracleCapacityConfidenceReason {
    type: 'sample_size' | 'volatility' | 'missing_data' | 'recency' | 'shrinkage';
    message: string;
    impact: 'positive' | 'neutral' | 'negative';
}

/** Stage throughput capacity */
export interface OracleStageCapacity {
    stage: CanonicalStage;
    /** Observed throughput in candidates per week */
    throughput_per_week: number;
    /** Sample size (number of weeks observed) */
    n_weeks: number;
    /** Number of transitions observed */
    n_transitions: number;
    /** Confidence in this estimate */
    confidence: ConfidenceLevel;
    /** Prior used for shrinkage (if applicable) */
    prior_throughput?: number;
    /** Raw observed value before shrinkage */
    observed_throughput?: number;
}

/** Recruiter capacity for Oracle */
export interface OracleRecruiterCapacity {
    recruiter_id: string;
    recruiter_name?: string;
    /** Screens completed per week */
    screens_per_week: OracleStageCapacity;
    /** HM screens facilitated per week (if distinguishable) */
    hm_screens_per_week?: OracleStageCapacity;
    /** Onsites coordinated per week */
    onsites_per_week?: OracleStageCapacity;
    /** Offers extended per week */
    offers_per_week?: OracleStageCapacity;
    /** Overall confidence */
    overall_confidence: ConfidenceLevel;
    confidence_reasons: OracleCapacityConfidenceReason[];
    /** Date range used */
    date_range: { start: Date; end: Date; weeks_analyzed: number };
}

/** Hiring Manager capacity for Oracle */
export interface OracleHMCapacity {
    hm_id: string;
    hm_name?: string;
    /** Feedback turnaround in hours (proxy for responsiveness) */
    feedback_turnaround_hours?: {
        median: number;
        p75: number;
        n: number;
        confidence: ConfidenceLevel;
    };
    /** HM interviews per week */
    interviews_per_week?: OracleStageCapacity;
    /** Resume reviews per week */
    reviews_per_week?: OracleStageCapacity;
    /** Overall confidence */
    overall_confidence: ConfidenceLevel;
    confidence_reasons: OracleCapacityConfidenceReason[];
    /** Date range used */
    date_range: { start: Date; end: Date; weeks_analyzed: number };
}

/** Cohort/global defaults used when individual data is insufficient */
export interface OracleCohortCapacityDefaults {
    screens_per_week: number;
    hm_screens_per_week: number;
    onsites_per_week: number;
    offers_per_week: number;
    hm_feedback_hours: number;
    sample_sizes: { recruiters: number; hms: number; weeks: number };
}

/** Combined capacity profile for Oracle */
export interface OracleCapacityProfile {
    recruiter: OracleRecruiterCapacity | null;
    hm: OracleHMCapacity | null;
    cohort_defaults: OracleCohortCapacityDefaults;
    overall_confidence: ConfidenceLevel;
    confidence_reasons: OracleCapacityConfidenceReason[];
    used_cohort_fallback: boolean;
}

/** Queue diagnostic for a single stage */
export interface OracleStageQueueDiagnostic {
    stage: CanonicalStage;
    stage_name: string;
    /** Candidates needing service at this stage */
    demand: number;
    /** Service rate in candidates per week */
    service_rate: number;
    /** Computed queue delay in days */
    queue_delay_days: number;
    /** Whether this is a bottleneck */
    is_bottleneck: boolean;
    /** Who owns the bottleneck */
    bottleneck_owner_type: 'recruiter' | 'hm' | 'shared' | 'none';
    /** Confidence */
    confidence: ConfidenceLevel;
}

/** Result of applying capacity penalties */
export interface OracleCapacityPenaltyResult {
    /** Adjusted stage durations */
    adjusted_durations: Record<string, OracleAdjustedDuration>;
    /** Per-stage queue diagnostics */
    stage_diagnostics: OracleStageQueueDiagnostic[];
    /** Top bottlenecks sorted by delay */
    top_bottlenecks: OracleStageQueueDiagnostic[];
    /** Total queue delay added */
    total_queue_delay_days: number;
    /** Overall confidence */
    confidence: ConfidenceLevel;
}

/** Adjusted duration for a stage */
export interface OracleAdjustedDuration {
    stage: CanonicalStage;
    original_median_days: number;
    queue_delay_days: number;
    adjusted_median_days: number;
    adjusted_mu?: number;
    adjusted_days?: number;
}

/** Complete capacity-aware forecast result */
export interface OracleCapacityAwareForecastResult {
    /** Pipeline-only forecast */
    pipeline_only: {
        p10_date: Date;
        p50_date: Date;
        p90_date: Date;
        probability_by_target?: number;
        simulated_days: number[];
    };
    /** Capacity-aware forecast */
    capacity_aware: {
        p10_date: Date;
        p50_date: Date;
        p90_date: Date;
        probability_by_target?: number;
        simulated_days: number[];
    };
    /** Difference in P50 */
    p50_delta_days: number;
    /** Bottleneck info */
    capacity_bottlenecks: OracleStageQueueDiagnostic[];
    /** Confidence and reasons */
    capacity_confidence: ConfidenceLevel;
    capacity_reasons: OracleCapacityConfidenceReason[];
    /** Whether capacity constraints significantly affect the forecast */
    capacity_constrained: boolean;
    /** Capacity profile used */
    capacity_profile: OracleCapacityProfile;
    /** Debug info */
    debug: {
        iterations: number;
        seed: string;
        queue_model_version: string;
    };
}

/** Input for capacity inference */
export interface OracleInferCapacityInput {
    reqId: string;
    recruiterId: string;
    hmId: string;
    dateRange: { start: Date; end: Date };
    events: Event[];
    candidates: Candidate[];
    requisitions: Requisition[];
    users?: User[];
}

/** Pipeline by stage count */
export interface OraclePipelineByStage {
    [stage: string]: number;
}

// ============================================
// ORACLE CAPACITY-AWARE TYPES (v1.1)
// Global workload and demand scoping
// ============================================

/** Global demand context for capacity calculation (v1.1) */
export interface OracleGlobalDemand {
    /** Demand scope used */
    demand_scope: 'single_req' | 'global_by_recruiter' | 'global_by_hm';
    /** Per-stage demand from recruiter's full workload */
    recruiter_demand: OraclePipelineByStage;
    /** Per-stage demand from HM's full workload */
    hm_demand: OraclePipelineByStage;
    /** Workload context for recruiter */
    recruiter_context: {
        recruiter_id: string | null;
        recruiter_name: string | null;
        open_req_count: number;
        total_candidates_in_flight: number;
        req_ids: string[];
    };
    /** Workload context for HM */
    hm_context: {
        hm_id: string | null;
        hm_name: string | null;
        open_req_count: number;
        total_candidates_in_flight: number;
        req_ids: string[];
    };
    /** Selected req pipeline (for display, not for demand calculation) */
    selected_req_pipeline: OraclePipelineByStage;
    /** Confidence in global demand (LOW if recruiter_id/hm_id missing) */
    confidence: ConfidenceLevel;
    /** Reasons for confidence level */
    confidence_reasons: OracleCapacityConfidenceReason[];
}

/** Input for computing global demand */
export interface OracleGlobalDemandInput {
    /** The selected requisition */
    selectedReqId: string;
    /** Recruiter ID from the selected req */
    recruiterId: string | null;
    /** HM ID from the selected req */
    hmId: string | null;
    /** All candidates (active only) */
    allCandidates: Candidate[];
    /** All requisitions */
    allRequisitions: Requisition[];
    /** Users for name lookup */
    users?: User[];
}

/** Extended penalty result with global demand diagnostics (v1.1) */
export interface OracleCapacityPenaltyResultV11 extends OracleCapacityPenaltyResult {
    /** Global demand context used */
    global_demand: OracleGlobalDemand;
    /** Prescriptive recommendations */
    recommendations: OracleCapacityRecommendation[];
}

/** Recommendation for improving capacity situation */
export interface OracleCapacityRecommendation {
    type: 'increase_throughput' | 'reassign_workload' | 'reduce_demand' | 'improve_data';
    description: string;
    estimated_impact_days: number;
    /** Specific values for the recommendation */
    details: {
        stage?: CanonicalStage;
        current_value?: number;
        target_value?: number;
        owner_type?: 'recruiter' | 'hm';
    };
}

/** Extended capacity-aware forecast result (v1.1) */
export interface OracleCapacityAwareForecastResultV11 extends OracleCapacityAwareForecastResult {
    /** Global demand context */
    global_demand: OracleGlobalDemand;
    /** Prescriptive recommendations */
    recommendations: OracleCapacityRecommendation[];
}

// Oracle Capacity Constants
export const ORACLE_CAPACITY_CONSTANTS = {
    /** Minimum weeks for reliable inference */
    MIN_WEEKS_FOR_CAPACITY: 4,
    /** Minimum transitions per stage for throughput estimate */
    MIN_TRANSITIONS_FOR_THROUGHPUT: 5,
    /** Maximum queue delay cap */
    MAX_QUEUE_DELAY_DAYS: 21,
    /** Default queue factor */
    DEFAULT_QUEUE_FACTOR: 1.0,
    /** Confidence thresholds */
    CONFIDENCE_THRESHOLDS: {
        HIGH: { min_weeks: 8, min_transitions: 15 },
        MED: { min_weeks: 4, min_transitions: 5 },
        LOW: { min_weeks: 1, min_transitions: 1 }
    }
} as const;

/** Stages that are capacity-limited */
export const ORACLE_CAPACITY_LIMITED_STAGES = [
    CanonicalStage.SCREEN,
    CanonicalStage.HM_SCREEN,
    CanonicalStage.ONSITE,
    CanonicalStage.OFFER
];

/** Stage to owner type mapping */
export const ORACLE_STAGE_OWNER_MAP: Record<string, 'recruiter' | 'hm' | 'shared'> = {
    [CanonicalStage.SCREEN]: 'recruiter',
    [CanonicalStage.HM_SCREEN]: 'hm',
    [CanonicalStage.ONSITE]: 'shared',
    [CanonicalStage.OFFER]: 'recruiter'
};

/** Global prior defaults */
export const ORACLE_GLOBAL_CAPACITY_PRIORS: OracleCohortCapacityDefaults = {
    screens_per_week: 8,
    hm_screens_per_week: 4,
    onsites_per_week: 3,
    offers_per_week: 1.5,
    hm_feedback_hours: 48,
    sample_sizes: { recruiters: 0, hms: 0, weeks: 0 }
};

/** Stage labels for display */
export const ORACLE_CAPACITY_STAGE_LABELS: Record<string, string> = {
    [CanonicalStage.SCREEN]: 'Screen',
    [CanonicalStage.HM_SCREEN]: 'HM Interview',
    [CanonicalStage.ONSITE]: 'Onsite',
    [CanonicalStage.OFFER]: 'Offer'
};
