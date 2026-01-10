// Metrics types for the Recruiter Productivity Dashboard

import { Requisition, Candidate, Event, CanonicalStage } from './entities';

// ===== DATE RANGE =====

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export type DateRangePreset = '30' | '60' | '90' | '180' | '365' | 'custom';

// ===== FILTERS =====

export interface MetricFilters {
  dateRange: DateRange;
  recruiterIds?: string[];
  functions?: string[];
  jobFamilies?: string[];
  levels?: string[];
  regions?: string[];
  locationTypes?: string[];
  hiringManagerIds?: string[];
  sources?: string[];
  useWeighted: boolean;
  normalizeByLoad: boolean;
}

// ===== OUTCOME METRICS =====

export interface OutcomeMetrics {
  hires: number;
  offersExtended: number;
  offersAccepted: number;
  offerAcceptanceRate: number | null;  // null if no offers
  timeToFillMedian: number | null;  // days, null if no hires
}

// ===== EXECUTION VOLUME METRICS =====

export interface ExecutionVolumeMetrics {
  outreachSent: number;
  screensCompleted: number;
  submittalsToHM: number;
  interviewLoopsScheduled: number;
  followUpVelocityMedian: number | null;  // hours
}

// ===== FUNNEL CONVERSION METRICS =====

export interface StageConversion {
  fromStage: CanonicalStage;
  toStage: CanonicalStage;
  entered: number;
  converted: number;
  rate: number | null;  // null if 0 entered
}

export interface FunnelConversionMetrics {
  screenToHmScreen: StageConversion;
  hmScreenToOnsite: StageConversion;
  onsiteToOffer: StageConversion;
  offerToHired: StageConversion;
}

// ===== AGING AND FLOW METRICS =====

export interface AgingBucket {
  label: string;
  min: number;
  max: number | null;  // null for "120+"
  count: number;
  reqIds: string[];
}

export interface AgingMetrics {
  openReqCount: number;
  agingBuckets: AgingBucket[];
  stalledReqs: {
    count: number;
    threshold: number;  // days
    reqIds: string[];
  };
}

// ===== COMPLEXITY SCORING =====

export interface ComplexityWeights {
  levelWeights: Record<string, number>;
  marketWeights: {
    Remote: number;
    Hybrid: number;
    Onsite: number;
    hardMarketBonus: number;
  };
  nicheWeights: Record<string, number>;
}

export interface ComplexityScore {
  reqId: string;
  levelWeight: number;
  marketWeight: number;
  nicheWeight: number;
  hmWeight: number;
  totalScore: number;
}

// ===== WEIGHTED METRICS =====

export interface WeightedMetrics {
  weightedHires: number;
  weightedOffers: number;
  offerMultiplier: number;
  complexityScores: ComplexityScore[];
}

// ===== TIME ATTRIBUTION =====

export interface TimeAttribution {
  recruiterControlledTime: {
    leadToFirstAction: number | null;  // hours median
    screenToSubmittal: number | null;  // hours median
  };
  hmControlledTime: {
    feedbackLatency: number | null;  // hours median
    decisionLatency: number | null;  // hours median
  };
  opsControlledTime: {
    offerApprovalLatency: number | null;  // hours median
    available: boolean;
  };
}

// ===== HIRING MANAGER FRICTION =====

export interface HMTimeComposition {
  activeTimeHours: number;      // Productive interviewing time
  feedbackLatencyHours: number; // Time waiting for interview feedback
  decisionLatencyHours: number; // Time waiting for hire/no-hire decision
  totalLatencyHours: number;    // feedbackLatency + decisionLatency
  timeTaxPercent: number;       // % of cycle spent waiting (0-100)
}

export interface HiringManagerFriction {
  hmId: string;
  hmName: string;
  reqsInRange: number;
  feedbackLatencyMedian: number | null;  // hours
  decisionLatencyMedian: number | null;  // hours
  offerAcceptanceRate: number | null;
  hmWeight: number;
  loopCount: number;  // for confidence indicator
  // Time composition metrics
  composition: HMTimeComposition;
}

// ===== RECRUITER SUMMARY =====

export interface RecruiterSummary {
  recruiterId: string;
  recruiterName: string;
  team: string | null;
  outcomes: OutcomeMetrics;
  executionVolume: ExecutionVolumeMetrics;
  funnelConversion: FunnelConversionMetrics;
  aging: AgingMetrics;
  weighted: WeightedMetrics;
  timeAttribution: TimeAttribution;
  productivityIndex: number;
  activeReqLoad: number;
}

// ===== OVERVIEW METRICS =====

export interface PriorPeriodMetrics {
  hires: number;
  weightedHires: number;
  offers: number;
  label: string;  // e.g., "prior 90d"
}

export interface OverviewMetrics {
  totalHires: number;
  totalWeightedHires: number;
  totalOffers: number;
  totalOfferAcceptanceRate: number | null;
  medianTTF: number | null;
  medianHMDecisionLatency: number | null;
  stalledReqCount: number;
  recruiterSummaries: RecruiterSummary[];
  priorPeriod?: PriorPeriodMetrics;
  recruiterPriorPeriods?: Record<string, PriorPeriodMetrics>;  // Per-recruiter prior period data
}

// ===== QUALITY GUARDRAILS =====

export interface QualityMetrics {
  offerAcceptanceByRecruiter: Array<{
    recruiterId: string;
    recruiterName: string;
    acceptanceRate: number | null;
    offerCount: number;
  }>;
  offerAcceptanceByFunction: Array<{
    function: string;
    acceptanceRate: number | null;
    offerCount: number;
  }>;
  lateStageFallout: {
    onsiteToReject: { count: number; rate: number | null };
    offerToDecline: { count: number; rate: number | null };
    offerToWithdraw: { count: number; rate: number | null };
  };
  candidateExperience: {
    applicationToFirstTouchMedian: number | null;  // hours
    timeBetweenStepsMedian: number | null;  // hours
  };
}

// ===== METRIC AUDITABILITY =====

export interface MetricAudit {
  metricName: string;
  formula: string;
  includedRecordsCount: number;
  includedRecordIds: string[];
  computedAt: Date;
  filters: MetricFilters;
}

// ===== REQ DETAIL =====

export interface ReqDetail {
  req: Requisition;
  candidateCount: number;
  stageDistribution: Record<string, number>;
  lastActivityAt: Date | null;
  lastActivityType: string | null;
  complexityScore: number;
  isStalled: boolean;
  ageInDays: number;
  hmName: string;
  delayContributor: 'HM' | 'Recruiter' | 'Ops' | 'None';
  delayDays: number;
}

// ===== WEEKLY TREND DATA =====

export interface WeeklyTrend {
  weekStart: Date;
  weekEnd: Date;
  hires: number;
  offers: number;
  hmLatencyMedian: number | null;
  outreachSent: number;
  screens: number;           // Phone/recruiter screens completed
  submissions: number;       // Candidates submitted to HM (moved to HM Screen stage)
  stageChanges: number;      // Total pipeline movement (all stage transitions)
  applicants: number;        // New applications received
  onsites: number;           // Candidates entering onsite/interview loop stage
}

// ===== SOURCE EFFECTIVENESS =====

export interface StageFunnelData {
  stage: string;
  entered: number;
  passed: number;
  passRate: number | null;
}

export interface SourceMetrics {
  source: string;
  totalCandidates: number;
  hires: number;
  hireRate: number | null;  // hires / total, null if 0 candidates
  offers: number;
  offerAcceptRate: number | null;  // accepted / extended
  medianTimeToHire: number | null;  // days
  screenPassRate: number | null;  // passed screen / total screened
  onsitePassRate: number | null;  // passed onsite / total onsite
  funnel: StageFunnelData[];  // stage-by-stage progression
}

export interface SourceEffectivenessMetrics {
  bySource: SourceMetrics[];
  bestSource: {
    name: string;
    hireRate: number;
  } | null;
  worstSource: {
    name: string;
    hireRate: number;
  } | null;
  totalCandidates: number;
  sourceDistribution: Array<{ source: string; percentage: number }>;
}
