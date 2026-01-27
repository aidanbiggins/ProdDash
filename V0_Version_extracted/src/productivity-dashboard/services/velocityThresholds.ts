/**
 * Velocity Insights Thresholds
 *
 * Minimum sample size constants used throughout Velocity Insights to ensure
 * statistical validity. Any metric/insight that does not meet its threshold
 * displays "Insufficient data" with the observed sample size (n).
 *
 * These thresholds prevent misleading 0/0 results and ensure users understand
 * the confidence level of displayed metrics.
 */

// ===== MINIMUM SAMPLE THRESHOLDS =====

/** Minimum offers required for candidate decay curve analysis */
export const MIN_OFFERS_FOR_DECAY = 10;

/** Minimum hires required for fast vs slow cohort comparison */
export const MIN_HIRES_FOR_FAST_VS_SLOW = 10;

/** Minimum denominator for pass rate/percentage calculations */
export const MIN_DENOM_FOR_PASS_RATE = 5;

/** Minimum reqs required for requisition decay analysis */
export const MIN_REQS_FOR_REQ_DECAY = 10;

/** Minimum bucket size for decay chart data points */
export const MIN_BUCKET_SIZE_FOR_CHART = 3;

// ===== CONFIDENCE LEVELS =====

export type ConfidenceLevel = 'HIGH' | 'MED' | 'LOW' | 'INSUFFICIENT';

export interface DataConfidence {
  level: ConfidenceLevel;
  sampleSize: number;
  threshold: number;
  reason: string;
}

/**
 * Calculate confidence level based on sample size and threshold
 */
export function calculateConfidence(
  sampleSize: number,
  threshold: number,
  context: string
): DataConfidence {
  if (sampleSize === 0) {
    return {
      level: 'INSUFFICIENT',
      sampleSize,
      threshold,
      reason: `No ${context} data available`
    };
  }

  if (sampleSize < threshold) {
    return {
      level: 'INSUFFICIENT',
      sampleSize,
      threshold,
      reason: `Need at least ${threshold} ${context} (have ${sampleSize})`
    };
  }

  // HIGH: 2x threshold or more
  if (sampleSize >= threshold * 2) {
    return {
      level: 'HIGH',
      sampleSize,
      threshold,
      reason: `Strong sample: ${sampleSize} ${context}`
    };
  }

  // MED: between 1x and 2x threshold
  if (sampleSize >= threshold * 1.5) {
    return {
      level: 'MED',
      sampleSize,
      threshold,
      reason: `Adequate sample: ${sampleSize} ${context}`
    };
  }

  // LOW: meets threshold but barely
  return {
    level: 'LOW',
    sampleSize,
    threshold,
    reason: `Limited sample: ${sampleSize} ${context} (threshold: ${threshold})`
  };
}

// ===== SAFE DIVISION UTILITIES =====

export interface SafeRateResult {
  value: number | null;
  numerator: number;
  denominator: number;
  displayValue: string;
  isValid: boolean;
  error?: string;
}

/**
 * Safely calculate a rate/percentage, handling 0/0 and invalid cases
 *
 * Returns:
 * - null value and '—' display for 0/0 (insufficient data)
 * - null value and 'Invalid data' for impossible cases (num > 0, denom = 0)
 * - Actual rate for valid calculations
 */
export function safeRate(
  numerator: number,
  denominator: number,
  asPercent: boolean = false
): SafeRateResult {
  // Case 1: 0/0 - Insufficient data
  if (numerator === 0 && denominator === 0) {
    return {
      value: null,
      numerator,
      denominator,
      displayValue: '—',
      isValid: false,
      error: 'insufficient_data'
    };
  }

  // Case 2: n/0 where n > 0 - Invalid/impossible
  if (denominator === 0 && numerator > 0) {
    console.warn(`[VelocityThresholds] Invalid rate calculation: ${numerator}/${denominator}`);
    return {
      value: null,
      numerator,
      denominator,
      displayValue: 'Invalid data',
      isValid: false,
      error: 'invalid_denominator'
    };
  }

  // Case 3: Valid calculation
  const rate = numerator / denominator;
  const displayRate = asPercent ? Math.round(rate * 100) : rate;

  return {
    value: rate,
    numerator,
    denominator,
    displayValue: asPercent ? `${displayRate}%` : displayRate.toFixed(2),
    isValid: true
  };
}

/**
 * Format a rate for display with optional 'Insufficient data' fallback
 */
export function formatRate(
  numerator: number,
  denominator: number,
  options: {
    asPercent?: boolean;
    minDenom?: number;
    decimals?: number;
    showInsufficient?: boolean;
  } = {}
): string {
  const {
    asPercent = true,
    minDenom = MIN_DENOM_FOR_PASS_RATE,
    decimals = 0,
    showInsufficient = true
  } = options;

  // Check minimum denominator
  if (denominator < minDenom) {
    return showInsufficient ? 'Insufficient data' : '—';
  }

  const result = safeRate(numerator, denominator, false);

  if (!result.isValid) {
    return result.displayValue;
  }

  if (asPercent) {
    return `${(result.value! * 100).toFixed(decimals)}%`;
  }

  return result.value!.toFixed(decimals);
}

/**
 * Check if we have enough data for a specific analysis type
 */
export function hasEnoughData(
  analysisType: 'offers' | 'hires' | 'reqs' | 'passRate',
  sampleSize: number,
  denominator?: number
): boolean {
  switch (analysisType) {
    case 'offers':
      return sampleSize >= MIN_OFFERS_FOR_DECAY;
    case 'hires':
      return sampleSize >= MIN_HIRES_FOR_FAST_VS_SLOW;
    case 'reqs':
      return sampleSize >= MIN_REQS_FOR_REQ_DECAY;
    case 'passRate':
      return (denominator ?? sampleSize) >= MIN_DENOM_FOR_PASS_RATE;
    default:
      return sampleSize >= MIN_DENOM_FOR_PASS_RATE;
  }
}

// ===== DATA CAPABILITY DETECTION =====

export type DataCapability = 'POINT_IN_TIME' | 'SNAPSHOT_DIFF' | 'TIMESTAMP_ONLY' | 'NONE';

export interface StageTimingCapability {
  capability: DataCapability;
  hasStageEnterTimestamps: boolean;
  hasSnapshotDiffEvents: boolean;
  canShowStageDuration: boolean;
  reason: string;
}

/**
 * Detect what stage timing capabilities are supported by the current data
 */
export function detectStageTimingCapability(
  events: Array<{ event_type: string; from_stage?: string | null; to_stage?: string | null; event_at: Date }>,
  candidates: Array<{ current_stage_entered_at?: Date | null }>
): StageTimingCapability {
  // Check for stage change events with from/to stages (snapshot diff)
  const stageChangeEvents = events.filter(e =>
    e.event_type === 'STAGE_CHANGE' &&
    e.from_stage !== null &&
    e.to_stage !== null
  );
  const hasSnapshotDiffEvents = stageChangeEvents.length >= 10;

  // Check for candidates with stage enter timestamps
  // Need at least some candidates AND at least 50% have timestamps OR at least 10 have timestamps
  const candidatesWithStageTimestamp = candidates.filter(c => c.current_stage_entered_at !== null);
  const hasStageEnterTimestamps = candidates.length > 0 &&
    candidatesWithStageTimestamp.length >= Math.min(10, Math.max(1, candidates.length * 0.5));

  // Determine capability level
  if (hasSnapshotDiffEvents) {
    return {
      capability: 'SNAPSHOT_DIFF',
      hasStageEnterTimestamps,
      hasSnapshotDiffEvents,
      canShowStageDuration: true,
      reason: 'Stage change events with from/to transitions available'
    };
  }

  if (hasStageEnterTimestamps) {
    return {
      capability: 'TIMESTAMP_ONLY',
      hasStageEnterTimestamps,
      hasSnapshotDiffEvents,
      canShowStageDuration: false,
      reason: 'Only current stage timestamps available - cannot calculate stage durations'
    };
  }

  return {
    capability: 'NONE',
    hasStageEnterTimestamps: false,
    hasSnapshotDiffEvents: false,
    canShowStageDuration: false,
    reason: 'Insufficient stage timing data - import daily snapshots to unlock'
  };
}
