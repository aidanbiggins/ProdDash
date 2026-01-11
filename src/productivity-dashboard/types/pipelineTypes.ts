// Pipeline Benchmark Types for Ideal vs Actual Performance Tracking

import { CanonicalStage } from './entities';

// ===== BENCHMARK CONFIGURATION =====

export interface StageBenchmark {
  stage: CanonicalStage;
  targetDays: number;      // SLA target for time in stage
  maxDays: number;         // Red flag threshold
  targetPassRate: number;  // Expected conversion % (0-1)
  minPassRate: number;     // Red flag threshold (0-1)
}

export interface PipelineBenchmarkConfig {
  stages: StageBenchmark[];
  targetTotalTTF: number;  // Total target time-to-fill in days
  lastUpdated: Date | null;
  source: 'manual' | 'historical' | 'default';
}

// Default benchmark configuration
export const DEFAULT_PIPELINE_BENCHMARKS: PipelineBenchmarkConfig = {
  stages: [
    { stage: CanonicalStage.SCREEN, targetDays: 3, maxDays: 7, targetPassRate: 0.50, minPassRate: 0.30 },
    { stage: CanonicalStage.HM_SCREEN, targetDays: 5, maxDays: 10, targetPassRate: 0.60, minPassRate: 0.40 },
    { stage: CanonicalStage.ONSITE, targetDays: 7, maxDays: 14, targetPassRate: 0.40, minPassRate: 0.25 },
    { stage: CanonicalStage.OFFER, targetDays: 3, maxDays: 7, targetPassRate: 0.80, minPassRate: 0.60 },
  ],
  targetTotalTTF: 45,
  lastUpdated: null,
  source: 'default'
};

// ===== PERFORMANCE STATUS =====

export type PerformanceStatus = 'ahead' | 'on-track' | 'behind' | 'critical';

export function getPerformanceStatus(
  actual: number,
  target: number,
  max: number,
  higherIsBetter: boolean = false
): PerformanceStatus {
  if (higherIsBetter) {
    // For pass rates: higher is better
    if (actual >= target) return 'ahead';
    if (actual >= (target + max) / 2) return 'on-track';
    if (actual >= max) return 'behind';
    return 'critical';
  } else {
    // For duration: lower is better
    if (actual <= target) return 'ahead';
    if (actual <= (target + max) / 2) return 'on-track';
    if (actual <= max) return 'behind';
    return 'critical';
  }
}

// ===== STAGE PERFORMANCE =====

export interface StagePerformance {
  stage: CanonicalStage;
  stageName: string;

  // Duration metrics
  targetDays: number;
  maxDays: number;
  actualMedianDays: number;
  actualP25Days: number;
  actualP75Days: number;
  durationVariance: number;      // actual - target (positive = behind)
  durationStatus: PerformanceStatus;
  durationSampleSize: number;

  // Pass rate metrics
  targetPassRate: number;
  minPassRate: number;
  actualPassRate: number;
  passRateVariance: number;      // actual - target (negative = behind)
  passRateStatus: PerformanceStatus;
  passRateSampleSize: number;

  // Volume metrics
  candidatesEntered: number;
  candidatesPassed: number;
  candidatesRejected: number;
  candidatesWithdrawn: number;

  // Root cause insights
  insights: PipelineInsight[];
  primaryBlocker: string | null;
}

// ===== PIPELINE INSIGHTS =====

export type InsightSeverity = 'info' | 'warning' | 'critical';
export type InsightCategory = 'hm-latency' | 'recruiter-latency' | 'volume' | 'rejection-rate' | 'bottleneck' | 'positive';

export interface PipelineInsight {
  category: InsightCategory;
  severity: InsightSeverity;
  message: string;
  dataPoint: string;
  recommendation: string;
  affectedEntities?: Array<{ id: string; name: string; value: number }>;
}

// ===== OVERALL PIPELINE HEALTH =====

export interface PipelineHealthSummary {
  // Overall status
  overallStatus: PerformanceStatus;
  healthScore: number;  // 0-100

  // TTF comparison
  targetTTF: number;
  actualMedianTTF: number;
  ttfVariance: number;
  ttfStatus: PerformanceStatus;

  // Stage breakdown
  stagePerformance: StagePerformance[];

  // Summary counts
  stagesAhead: number;
  stagesOnTrack: number;
  stagesBehind: number;
  stagesCritical: number;

  // Top insights (across all stages)
  topInsights: PipelineInsight[];

  // Comparison metadata
  periodStart: Date;
  periodEnd: Date;
  sampleSize: number;
}

// ===== RECRUITER GOALS =====

export interface RecruiterGoal {
visiblerecruiterId: string;
  periodStart: Date;
  periodEnd: Date;

  // Outcome goals
  hiresTarget: number;
  weightedHiresTarget: number;
  offersTarget: number;

  // Activity goals
  screensTarget: number;
  submittalsTarget: number;

  // Efficiency goals
  ttfTargetDays: number | null;
  passRateTarget: number | null;  // Overall funnel conversion
}

export interface RecruiterGoalProgress {
  recruiterId: string;
  recruiterName: string;
  goal: RecruiterGoal;

  // Actual performance
  actualHires: number;
  actualWeightedHires: number;
  actualOffers: number;
  actualScreens: number;
  actualSubmittals: number;
  actualMedianTTF: number | null;
  actualPassRate: number | null;

  // Progress percentages
  hiresProgress: number;      // 0-100+
  weightedHiresProgress: number;
  offersProgress: number;
  screensProgress: number;
  submittalsProgress: number;

  // Overall goal status
  overallProgress: number;
  status: 'exceeding' | 'on-track' | 'behind' | 'at-risk';
  daysRemaining: number;
  projectedHires: number;     // Based on current pace
}

// ===== FUNCTION/LEVEL BENCHMARKS =====

export interface CohortBenchmarkOverride {
  cohortKey: string;  // e.g., "Engineering|IC4" or "Sales|Manager"
  function?: string;
  level?: string;
  benchmarks: Partial<PipelineBenchmarkConfig>;
}

// ===== HISTORICAL BENCHMARK GENERATION =====

export interface HistoricalBenchmarkResult {
  benchmarks: PipelineBenchmarkConfig;
  confidence: 'high' | 'medium' | 'low';
  sampleSize: number;
  dataRange: { start: Date; end: Date };
  notes: string[];
}
