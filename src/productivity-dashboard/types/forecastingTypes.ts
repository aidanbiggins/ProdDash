// Forecasting Types for the Recruiter Productivity Dashboard

// ===== ROLE PROFILE (Wizard Inputs) =====

export interface RoleProfile {
  function: string;           // e.g., "Engineering"
  level: string;              // e.g., "IC4"
  locationType: string;       // "Remote" | "Hybrid" | "Onsite"
  jobFamily: string;          // e.g., "Backend", "Security"
  hiringManagerId?: string;   // Optional - affects HM weight
}

// ===== TTF PREDICTION =====

export interface TTFPrediction {
  medianDays: number;
  p25Days: number;            // Optimistic (25th percentile)
  p75Days: number;            // Pessimistic (75th percentile)
  confidenceLevel: 'high' | 'medium' | 'low';
  sampleSize: number;         // Historical hires used for prediction
  cohortDescription: string;  // e.g., "Engineering IC4 Remote Backend"
  isFallback: boolean;        // True if using global/partial benchmarks
}

// ===== PIPELINE REQUIREMENTS =====

export interface PipelineStageRequirement {
  stage: string;              // "Screen", "HM Screen", "Onsite", "Offer"
  candidatesNeeded: number;   // Target count at this stage
  conversionRateUsed: number; // Historical rate used for calculation
  confidenceLevel: 'high' | 'medium' | 'low';
}

export interface PipelineRequirements {
  totalCandidatesNeeded: number;  // Top of funnel
  byStage: PipelineStageRequirement[];
  assumptions: string[];          // Explanations of rates used
}

// ===== SOURCE MIX RECOMMENDATION =====

export interface SourceRecommendation {
  source: string;             // "Referral", "Sourced", "Inbound", etc.
  targetPercentage: number;   // Recommended percentage of pipeline
  historicalHireRate: number; // Historical success rate
  historicalTTF: number;      // Median days to hire from this source
  rationale: string;          // Why this source is recommended
}

export interface SourceMixRecommendation {
  recommendations: SourceRecommendation[];
  topRecommendation: string;  // Best source for this role
  insights: string[];         // Key insights about source mix
}

// ===== RISK FACTORS =====

export interface RiskFactor {
  factor: string;             // e.g., "HM Decision Latency"
  severity: 'high' | 'medium' | 'low';
  impact: string;             // e.g., "+12 days TTF"
  mitigation: string;         // Suggested action
  dataPoint: string;          // Evidence, e.g., "HM avg 72hr feedback vs 24hr benchmark"
}

// ===== MILESTONE TIMELINE =====

export interface MilestoneEvent {
  milestone: string;          // e.g., "First Screen", "HM Interview", "Offer Extended"
  targetDay: number;          // Days from req open
  rangeMin: number;           // Optimistic
  rangeMax: number;           // Pessimistic
  isCriticalPath: boolean;    // Affects overall timeline
}

export interface MilestoneTimeline {
  milestones: MilestoneEvent[];
  totalDays: number;
  criticalPathDays: number;
}

// ===== FULL ROLE FORECAST =====

export interface RoleForecast {
  roleProfile: RoleProfile;
  ttfPrediction: TTFPrediction;
  pipelineRequirements: PipelineRequirements;
  sourceMix: SourceMixRecommendation;
  riskFactors: RiskFactor[];
  milestoneTimeline: MilestoneTimeline;
  complexityScore: number;
  generatedAt: Date;
}

// ===== ACTIVE ROLE HEALTH =====

export type HealthStatus = 'on-track' | 'at-risk' | 'off-track';

export interface ActionRecommendation {
  action: string;
  priority: 'urgent' | 'important' | 'suggested';
  expectedImpact: string;
  owner: 'recruiter' | 'hm' | 'ops';
}

export interface RoleHealthMetrics {
  reqId: string;
  reqTitle: string;
  function: string;
  level: string;
  jobFamily: string;
  hiringManagerId: string;
  hiringManagerName: string;
  recruiterId: string;
  recruiterName: string;

  // Timing
  daysOpen: number;
  predictedFillDate: Date | null;
  predictedFillDateRange: { min: Date; max: Date } | null;
  benchmarkTTF: number;       // What similar roles took historically
  paceVsBenchmark: number;    // Ratio: actual pace vs expected pace

  // Pipeline health
  currentPipelineDepth: number;
  benchmarkPipelineDepth: number;
  pipelineGap: number;        // Negative = behind, positive = ahead
  candidatesByStage: Record<string, number>;

  // Velocity
  lastActivityDate: Date | null;
  daysSinceActivity: number;
  velocityTrend: 'improving' | 'stable' | 'declining' | 'stalled';

  // Overall status
  healthStatus: HealthStatus;
  healthScore: number;        // 0-100 composite score
  primaryIssue: string | null;
  actionRecommendations: ActionRecommendation[];
}

// ===== COHORT BENCHMARKS =====

// Stage duration data calculated from historical events
export interface StageDurationBenchmark {
  stage: string;              // Canonical stage name
  medianDays: number;         // Median days spent in this stage
  p25Days: number;            // 25th percentile (fast)
  p75Days: number;            // 75th percentile (slow)
  sampleSize: number;         // Number of observations
  // For Oracle Empirical Distributions
  histogram?: { days: number; count: number }[];
}

export interface CohortBenchmark {
  cohortKey: string;          // e.g., "Engineering|IC4|Remote|Backend"
  medianTTF: number;
  p25TTF: number;
  p75TTF: number;
  sampleSize: number;
  medianPipelineDepth: number;
  stageConversionRates: Record<string, number>;
  sourceHireRates: Record<string, number>;
  sourceTTF: Record<string, number>;
  stageDurations: StageDurationBenchmark[];  // Time spent in each stage
}

// ===== BENCHMARK AGGREGATIONS =====

export interface HMBenchmark {
  hmWeight: number;
  feedbackLatency: number;
  decisionLatency: number;
}

export interface ForecastingBenchmarks {
  byFunction: Record<string, CohortBenchmark>;
  byLevel: Record<string, CohortBenchmark>;
  byLocationType: Record<string, CohortBenchmark>;
  byJobFamily: Record<string, CohortBenchmark>;
  byCohort: Record<string, CohortBenchmark>;  // Full cohort key
  byHM: Record<string, HMBenchmark>;
  global: CohortBenchmark;
}
