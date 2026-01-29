/**
 * Load vs Performance Analysis
 *
 * Tests the hypothesis: "Recruiters hire faster when they have a manageable number of reqs"
 *
 * Method:
 * 1. Find all completed hires with valid TTF
 * 2. For each hire, calculate the recruiter's concurrent req load at that time
 * 3. Group by load buckets (1-5, 6-10, 11-15, 16+)
 * 4. Calculate median TTF per bucket
 * 5. Return correlation data
 */

import { Requisition, Candidate, RequisitionStatus, CandidateDisposition } from '../types';
import { differenceInDays } from 'date-fns';

export interface LoadBucket {
  label: string;
  minReqs: number;
  maxReqs: number;
  hireCount: number;
  medianTTF: number | null;
  avgTTF: number | null;
  ttfValues: number[];
}

export interface LoadVsPerformanceResult {
  buckets: LoadBucket[];
  correlation: {
    direction: 'positive' | 'negative' | 'none';
    strength: 'strong' | 'moderate' | 'weak' | 'none';
    description: string;
  };
  sampleSize: number;
  confidence: 'HIGH' | 'MED' | 'LOW' | 'INSUFFICIENT';
  insight: string;
}

/**
 * Calculate median of an array
 */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate average of an array
 */
function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * For a given hire date and recruiter, count how many reqs were open at that time
 */
function countConcurrentReqs(
  recruiterId: string,
  hireDate: Date,
  requisitions: Requisition[]
): number {
  return requisitions.filter(req => {
    if (req.recruiter_id !== recruiterId) return false;

    // Req was open before or on hire date
    const openedBefore = req.opened_at && req.opened_at <= hireDate;

    // Req was either still open, or closed after the hire date
    const stillOpenOrClosedLater =
      req.status === RequisitionStatus.Open ||
      (req.closed_at && req.closed_at >= hireDate);

    return openedBefore && stillOpenOrClosedLater;
  }).length;
}

/**
 * Analyze the relationship between recruiter workload and hiring speed
 */
export function analyzeLoadVsPerformance(
  requisitions: Requisition[],
  candidates: Candidate[]
): LoadVsPerformanceResult {
  // Define load buckets
  const bucketDefs = [
    { label: '1-5 reqs', minReqs: 1, maxReqs: 5 },
    { label: '6-10 reqs', minReqs: 6, maxReqs: 10 },
    { label: '11-15 reqs', minReqs: 11, maxReqs: 15 },
    { label: '16+ reqs', minReqs: 16, maxReqs: Infinity },
  ];

  // Initialize buckets
  const buckets: LoadBucket[] = bucketDefs.map(def => ({
    ...def,
    hireCount: 0,
    medianTTF: null,
    avgTTF: null,
    ttfValues: [],
  }));

  // Find all hires with valid TTF
  const hires = candidates.filter(c =>
    c.disposition === CandidateDisposition.Hired &&
    c.hired_at &&
    c.applied_at
  );

  // For each hire, calculate concurrent load and TTF
  for (const hire of hires) {
    const req = requisitions.find(r => r.req_id === hire.req_id);
    if (!req || !req.recruiter_id || !hire.hired_at || !hire.applied_at) continue;

    const ttf = differenceInDays(hire.hired_at, hire.applied_at);
    if (ttf < 0 || ttf > 365) continue; // Sanity check

    const concurrentLoad = countConcurrentReqs(
      req.recruiter_id,
      hire.hired_at,
      requisitions
    );

    // Find the right bucket
    const bucket = buckets.find(b =>
      concurrentLoad >= b.minReqs && concurrentLoad <= b.maxReqs
    );

    if (bucket) {
      bucket.hireCount++;
      bucket.ttfValues.push(ttf);
    }
  }

  // Calculate stats for each bucket
  for (const bucket of buckets) {
    bucket.medianTTF = median(bucket.ttfValues);
    bucket.avgTTF = average(bucket.ttfValues);
  }

  // Calculate correlation
  const bucketsWithData = buckets.filter(b => b.medianTTF !== null && b.hireCount >= 3);

  let correlation: LoadVsPerformanceResult['correlation'];
  let insight: string;

  if (bucketsWithData.length < 2) {
    correlation = {
      direction: 'none',
      strength: 'none',
      description: 'Insufficient data across load buckets',
    };
    insight = 'Not enough data to determine relationship between workload and hiring speed.';
  } else {
    // Check if TTF increases with load (positive correlation = higher load = slower)
    const firstBucket = bucketsWithData[0];
    const lastBucket = bucketsWithData[bucketsWithData.length - 1];

    const ttfDiff = (lastBucket.medianTTF || 0) - (firstBucket.medianTTF || 0);
    const percentDiff = firstBucket.medianTTF
      ? (ttfDiff / firstBucket.medianTTF) * 100
      : 0;

    if (percentDiff > 30) {
      correlation = {
        direction: 'positive',
        strength: percentDiff > 50 ? 'strong' : 'moderate',
        description: `Higher workload correlates with ${Math.round(percentDiff)}% slower hiring`,
      };
      insight = `Data supports the thesis: Recruiters with ${firstBucket.label} hire in ~${Math.round(firstBucket.medianTTF || 0)} days, while those with ${lastBucket.label} take ~${Math.round(lastBucket.medianTTF || 0)} days (+${Math.round(ttfDiff)} days).`;
    } else if (percentDiff < -30) {
      correlation = {
        direction: 'negative',
        strength: percentDiff < -50 ? 'strong' : 'moderate',
        description: 'Higher workload correlates with faster hiring (unexpected)',
      };
      insight = `Counterintuitively, recruiters with higher loads hire faster. This may indicate that high performers get more reqs assigned to them.`;
    } else {
      correlation = {
        direction: 'none',
        strength: 'weak',
        description: 'No significant correlation between workload and hiring speed',
      };
      insight = `Workload doesn't significantly impact hiring speed in this dataset. Other factors (req difficulty, candidate quality) may be more important.`;
    }
  }

  const totalSample = buckets.reduce((sum, b) => sum + b.hireCount, 0);

  return {
    buckets,
    correlation,
    sampleSize: totalSample,
    confidence: totalSample >= 50 ? 'HIGH' : totalSample >= 20 ? 'MED' : totalSample >= 10 ? 'LOW' : 'INSUFFICIENT',
    insight,
  };
}

/**
 * Format the analysis as a summary for display
 */
export function formatLoadVsPerformanceSummary(result: LoadVsPerformanceResult): string {
  const lines: string[] = [];

  lines.push(`**Analysis: Workload vs. Hiring Speed** (n=${result.sampleSize})`);
  lines.push('');

  for (const bucket of result.buckets) {
    if (bucket.hireCount > 0) {
      lines.push(`• ${bucket.label}: ${bucket.medianTTF?.toFixed(0) || 'N/A'} days median TTF (${bucket.hireCount} hires)`);
    }
  }

  lines.push('');
  lines.push(`**Finding:** ${result.insight}`);

  return lines.join('\n');
}
