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
