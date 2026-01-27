// Fit Scoring Service
// Calculates PerformanceResidual, Shrinkage, and FitScore by segment

import {
  FitMatrixCell,
  MetricResidual,
  SegmentKey,
  ConfidenceLevel,
  CAPACITY_CONSTANTS,
  calculateConfidence,
  segmentKeyToString
} from '../types/capacityTypes';
import { Requisition, Candidate, User } from '../types';

// ===== SHRINKAGE =====

/**
 * Applies Bayesian shrinkage to a residual
 * AdjustedResidual = (n / (n + k)) × RawResidual
 */
export function applyShrinkage(
  rawResidual: number,
  sampleSize: number,
  k: number = CAPACITY_CONSTANTS.SHRINKAGE_K
): number {
  return (sampleSize / (sampleSize + k)) * rawResidual;
}

// ===== SEGMENT METRICS =====

interface RecruiterSegmentMetrics {
  recruiterId: string;
  recruiterName: string;
  segment: SegmentKey;
  hires: number;
  totalReqs: number;
  totalTTFDays: number;
  ttfCount: number;
  offersExtended: number;
  offersAccepted: number;
  candidatesAdvanced: number;
  weeksActive: number;
  demandWU: number;
}

/**
 * Calculates metrics for a recruiter in a specific segment
 */
function calculateRecruiterSegmentMetrics(
  recruiterId: string,
  recruiterName: string,
  segment: SegmentKey,
  requisitions: Requisition[],
  candidates: Candidate[],
  demandWU: number
): RecruiterSegmentMetrics {
  // Filter reqs for this recruiter and segment
  const segmentReqs = requisitions.filter(r =>
    r.recruiter_id === recruiterId &&
    (r.job_family || 'General') === segment.jobFamily &&
    (r.location_type || 'Hybrid') === segment.locationType
    // Note: level band matching is more complex, handled separately
  );

  const reqIds = new Set(segmentReqs.map(r => r.req_id));

  // Count hires (candidates with hired_at)
  const hires = candidates.filter(c =>
    reqIds.has(c.req_id) && c.hired_at !== null
  ).length;

  // Calculate TTF for completed hires
  const ttfDays: number[] = [];
  for (const c of candidates) {
    if (reqIds.has(c.req_id) && c.hired_at && c.applied_at) {
      const ttf = Math.round(
        (c.hired_at.getTime() - c.applied_at.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (ttf > 0 && ttf < 365) {
        ttfDays.push(ttf);
      }
    }
  }

  // Count offers
  const offersExtended = candidates.filter(c =>
    reqIds.has(c.req_id) && c.offer_extended_at !== null
  ).length;

  const offersAccepted = candidates.filter(c =>
    reqIds.has(c.req_id) && c.hired_at !== null
  ).length;

  // Estimate candidates advanced (approximation)
  const candidatesAdvanced = candidates.filter(c =>
    reqIds.has(c.req_id)
  ).length;

  return {
    recruiterId,
    recruiterName,
    segment,
    hires,
    totalReqs: segmentReqs.length,
    totalTTFDays: ttfDays.reduce((a, b) => a + b, 0),
    ttfCount: ttfDays.length,
    offersExtended,
    offersAccepted,
    candidatesAdvanced,
    weeksActive: 12, // Simplified - would need actual activity tracking
    demandWU
  };
}

// ===== COHORT BENCHMARKS =====

interface CohortBenchmarks {
  hiresPerWU: number;
  ttfDays: number;
  offerAcceptRate: number;
  candidateThroughput: number;
}

/**
 * Calculates cohort benchmarks (expected values) for a segment
 */
function calculateCohortBenchmarks(
  allMetrics: RecruiterSegmentMetrics[]
): CohortBenchmarks {
  const hiresPerWUValues: number[] = [];
  const ttfValues: number[] = [];
  const acceptRateValues: number[] = [];
  const throughputValues: number[] = [];

  for (const m of allMetrics) {
    if (m.demandWU > 0) {
      hiresPerWUValues.push(m.hires / m.demandWU);
    }
    if (m.ttfCount > 0) {
      ttfValues.push(m.totalTTFDays / m.ttfCount);
    }
    if (m.offersExtended > 0) {
      acceptRateValues.push(m.offersAccepted / m.offersExtended);
    }
    if (m.weeksActive > 0) {
      throughputValues.push(m.candidatesAdvanced / m.weeksActive);
    }
  }

  return {
    hiresPerWU: median(hiresPerWUValues) ?? 0.1,
    ttfDays: median(ttfValues) ?? 45,
    offerAcceptRate: median(acceptRateValues) ?? 0.8,
    candidateThroughput: median(throughputValues) ?? 5
  };
}

/**
 * Calculates median of an array
 */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ===== FIT SCORE CALCULATION =====

interface FitScoreInput {
  hires_per_wu: { adjusted: number; weight: number; n: number };
  ttf_days: { adjusted: number; weight: number; n: number };
  offer_accept_rate: { adjusted: number; weight: number; n: number };
  candidate_throughput: { adjusted: number; weight: number; n: number };
}

/**
 * Calculates FitScore from weighted residuals
 * Returns null if any metric has insufficient data
 */
export function calculateFitScore(
  residuals: Partial<FitScoreInput>,
  options?: { minN?: number }
): number | null {
  const minN = options?.minN ?? CAPACITY_CONSTANTS.MIN_N_FOR_FIT_CELL;

  // Check if all metrics have sufficient data
  const metrics = ['hires_per_wu', 'ttf_days', 'offer_accept_rate', 'candidate_throughput'] as const;
  for (const metric of metrics) {
    const data = residuals[metric];
    if (data && data.n < minN) {
      return null;
    }
  }

  // Calculate weighted sum
  let weightedSum = 0;
  let totalWeight = 0;

  for (const metric of metrics) {
    const data = residuals[metric];
    if (data) {
      // For ttf_days, invert the residual (negative is good)
      const adjustedValue = metric === 'ttf_days' ? -data.adjusted : data.adjusted;
      weightedSum += adjustedValue * data.weight;
      totalWeight += data.weight;
    }
  }

  if (totalWeight === 0) return null;
  return weightedSum / totalWeight;
}

/**
 * Calculates minimum confidence across all metrics
 */
function calculateMinConfidence(metrics: RecruiterSegmentMetrics): ConfidenceLevel {
  const sampleSizes = [
    metrics.totalReqs,
    metrics.ttfCount,
    metrics.offersExtended,
    metrics.candidatesAdvanced
  ];

  const minN = Math.min(...sampleSizes);
  return calculateConfidence(minN, CAPACITY_CONSTANTS.MIN_N_FOR_FIT_CELL);
}

// ===== FIT MATRIX =====

/**
 * Builds the complete fit matrix for all recruiters and segments
 */
export function buildFitMatrix(
  requisitions: Requisition[],
  candidates: Candidate[],
  users: User[],
  recruiterDemands: Map<string, number>
): FitMatrixCell[] {
  const fitMatrix: FitMatrixCell[] = [];

  // Get unique recruiters
  const recruiterIds = Array.from(new Set(
    requisitions
      .map(r => r.recruiter_id)
      .filter((id): id is string => id !== null && id !== undefined && id !== '')
  ));

  // Get unique segments from requisitions
  const segments: SegmentKey[] = [];
  const segmentSet = new Set<string>();

  for (const req of requisitions) {
    const segment: SegmentKey = {
      jobFamily: req.job_family || 'General',
      levelBand: 'Mid', // Simplified - would use levelToLevelBand
      locationType: req.location_type || 'Hybrid'
    };
    const key = segmentKeyToString(segment);
    if (!segmentSet.has(key)) {
      segmentSet.add(key);
      segments.push(segment);
    }
  }

  // For each recruiter and segment, calculate fit
  for (const recruiterId of recruiterIds) {
    const user = users.find(u => u.user_id === recruiterId);
    const recruiterName = user?.name || recruiterId;
    const demandWU = recruiterDemands.get(recruiterId) ?? 0;

    for (const segment of segments) {
      const metrics = calculateRecruiterSegmentMetrics(
        recruiterId,
        recruiterName,
        segment,
        requisitions,
        candidates,
        demandWU
      );

      // Skip if no activity in this segment
      if (metrics.totalReqs === 0) continue;

      // Get all recruiters' metrics for this segment to calculate cohort benchmarks
      const allSegmentMetrics = recruiterIds.map(rid => {
        const u = users.find(u => u.user_id === rid);
        return calculateRecruiterSegmentMetrics(
          rid,
          u?.name || rid,
          segment,
          requisitions,
          candidates,
          recruiterDemands.get(rid) ?? 0
        );
      }).filter(m => m.totalReqs > 0);

      const benchmarks = calculateCohortBenchmarks(allSegmentMetrics);

      // Calculate observed values
      const observedHiresPerWU = demandWU > 0 ? metrics.hires / demandWU : 0;
      const observedTTF = metrics.ttfCount > 0 ? metrics.totalTTFDays / metrics.ttfCount : 0;
      const observedAcceptRate = metrics.offersExtended > 0
        ? metrics.offersAccepted / metrics.offersExtended
        : 0;
      const observedThroughput = metrics.weeksActive > 0
        ? metrics.candidatesAdvanced / metrics.weeksActive
        : 0;

      // Calculate raw residuals
      const rawHiresResidual = observedHiresPerWU - benchmarks.hiresPerWU;
      const rawTTFResidual = observedTTF - benchmarks.ttfDays;
      const rawAcceptResidual = observedAcceptRate - benchmarks.offerAcceptRate;
      const rawThroughputResidual = observedThroughput - benchmarks.candidateThroughput;

      // Apply shrinkage
      const adjustedHires = applyShrinkage(rawHiresResidual, metrics.totalReqs);
      const adjustedTTF = applyShrinkage(rawTTFResidual, metrics.ttfCount);
      const adjustedAccept = applyShrinkage(rawAcceptResidual, metrics.offersExtended || 1);
      const adjustedThroughput = applyShrinkage(rawThroughputResidual, metrics.candidatesAdvanced || 1);

      // Calculate fit score
      const fitScoreInput: FitScoreInput = {
        hires_per_wu: {
          adjusted: adjustedHires,
          weight: CAPACITY_CONSTANTS.METRIC_WEIGHTS.hires_per_wu,
          n: metrics.totalReqs
        },
        ttf_days: {
          adjusted: adjustedTTF,
          weight: CAPACITY_CONSTANTS.METRIC_WEIGHTS.ttf_days,
          n: metrics.ttfCount
        },
        offer_accept_rate: {
          adjusted: adjustedAccept,
          weight: CAPACITY_CONSTANTS.METRIC_WEIGHTS.offer_accept_rate,
          n: metrics.offersExtended || 1
        },
        candidate_throughput: {
          adjusted: adjustedThroughput,
          weight: CAPACITY_CONSTANTS.METRIC_WEIGHTS.candidate_throughput,
          n: metrics.candidatesAdvanced || 1
        }
      };

      const fitScore = calculateFitScore(fitScoreInput);
      const confidence = calculateMinConfidence(metrics);

      // Only add if we have a valid fit score
      if (fitScore !== null) {
        fitMatrix.push({
          recruiterId,
          recruiterName,
          segment,
          segmentString: segmentKeyToString(segment),
          fitScore,
          confidence,
          sampleSize: metrics.totalReqs,
          metrics: {
            hires_per_wu: {
              value: observedHiresPerWU,
              residual: adjustedHires,
              n: metrics.totalReqs
            },
            ttf_days: {
              value: observedTTF,
              residual: adjustedTTF,
              n: metrics.ttfCount
            },
            offer_accept_rate: {
              value: observedAcceptRate,
              residual: adjustedAccept,
              n: metrics.offersExtended || 1
            },
            candidate_throughput: {
              value: observedThroughput,
              residual: adjustedThroughput,
              n: metrics.candidatesAdvanced || 1
            }
          }
        });
      }
    }
  }

  return fitMatrix;
}

/**
 * Gets FitScore for a specific recruiter and segment
 */
export function getFitScore(
  fitMatrix: FitMatrixCell[],
  recruiterId: string,
  segment: SegmentKey
): number | null {
  const segmentStr = segmentKeyToString(segment);
  const cell = fitMatrix.find(c =>
    c.recruiterId === recruiterId &&
    c.segmentString === segmentStr
  );
  return cell?.fitScore ?? null;
}
