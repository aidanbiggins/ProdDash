/**
 * What-If Simulator Model
 * Pure deterministic math for modeling intervention impacts
 * NO UI dependencies - just data in, data out
 */

// ===== TYPES =====

/**
 * Input sliders for the what-if model
 */
export interface WhatIfInputs {
  /** Days to reduce time from interview to offer (0..14) */
  offer_speed_days_faster: number;
  /** Hours to reduce HM feedback latency (0..72) */
  hm_feedback_hours_saved: number;
  /** Additional leads to add per open requisition (0..50) */
  pipeline_add_leads_per_req: number;
}

/**
 * Baseline context for calculations
 */
export interface WhatIfBaseline {
  /** Current accept rate (0..1, displayed as 0..100%) */
  accept_rate: number | null;
  /** Current expected hires */
  expected_hires: number | null;
  /** Current pipeline gap (open reqs - expected hires) */
  pipeline_gap: number | null;
  /** Current time to offer in days */
  time_to_offer_days: number | null;
  /** Number of open requisitions */
  open_reqs: number;
  /** Current HM latency in hours (for bounds checking) */
  current_hm_latency_hours: number | null;
  /** Decay rate per day (for accept rate impact) */
  decay_rate_per_day: number | null;
}

/**
 * Projected values after intervention
 */
export interface WhatIfProjected {
  accept_rate: number | null;
  expected_hires: number | null;
  pipeline_gap: number | null;
  time_to_offer_days: number | null;
}

/**
 * Delta values (projected - baseline)
 */
export interface WhatIfDeltas {
  accept_rate_delta: number | null;
  expected_hires_delta: number | null;
  pipeline_gap_delta: number | null;
  time_to_offer_delta: number | null;
}

/**
 * Confidence level for projections
 */
export type WhatIfConfidence = 'HIGH' | 'MED' | 'LOW';

/**
 * Full model output
 */
export interface WhatIfModelOutput {
  baseline: WhatIfBaseline;
  projected: WhatIfProjected;
  deltas: WhatIfDeltas;
  confidence: WhatIfConfidence;
  confidence_reason: string;
  /** Fields that couldn't be calculated with reasons */
  unavailable_reasons: Record<string, string>;
}

// ===== CONSTANTS =====

export const WHATIF_INPUT_BOUNDS = {
  offer_speed_days_faster: { min: 0, max: 14, step: 1 },
  hm_feedback_hours_saved: { min: 0, max: 72, step: 4 },
  pipeline_add_leads_per_req: { min: 0, max: 50, step: 5 },
} as const;

export const WHATIF_DEFAULT_INPUTS: WhatIfInputs = {
  offer_speed_days_faster: 0,
  hm_feedback_hours_saved: 0,
  pipeline_add_leads_per_req: 0,
};

// ===== HELPER FUNCTIONS =====

/**
 * Clamp a value to bounds
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Round to 1 decimal place
 */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// ===== PROJECTION CALCULATIONS =====

/**
 * Calculate accept rate impact from offer speed improvement
 *
 * Model: Faster offers = less candidate decay = higher accept rate
 * Each day saved improves accept rate by decay_rate_per_day
 */
function calculateOfferSpeedImpact(
  inputs: WhatIfInputs,
  baseline: WhatIfBaseline
): { accept_rate_delta: number; time_to_offer_delta: number } {
  const { offer_speed_days_faster } = inputs;
  const { accept_rate, time_to_offer_days, decay_rate_per_day } = baseline;

  // No impact if no intervention or missing baseline
  if (offer_speed_days_faster === 0 || time_to_offer_days === null) {
    return { accept_rate_delta: 0, time_to_offer_delta: 0 };
  }

  // Can't reduce more than current time to offer (leave at least 1 day)
  const effective_days_saved = Math.min(offer_speed_days_faster, time_to_offer_days - 1);
  if (effective_days_saved <= 0) {
    return { accept_rate_delta: 0, time_to_offer_delta: 0 };
  }

  // Calculate accept rate improvement
  let accept_rate_delta = 0;
  if (decay_rate_per_day !== null && accept_rate !== null) {
    // Each day saved recovers decay_rate worth of accept rate
    accept_rate_delta = effective_days_saved * decay_rate_per_day;
    // Cap at 15% improvement and can't exceed 95% total
    const max_improvement = Math.min(0.15, 0.95 - accept_rate);
    accept_rate_delta = Math.min(accept_rate_delta, max_improvement);
  }

  return {
    accept_rate_delta: Math.max(0, accept_rate_delta),
    time_to_offer_delta: -effective_days_saved,
  };
}

/**
 * Calculate impact from reducing HM feedback latency
 *
 * Model: Faster HM feedback = faster pipeline = less decay
 * Typically 2-3 HM touchpoints per hire
 */
function calculateHMLatencyImpact(
  inputs: WhatIfInputs,
  baseline: WhatIfBaseline
): { accept_rate_delta: number; time_to_offer_delta: number } {
  const { hm_feedback_hours_saved } = inputs;
  const { current_hm_latency_hours, time_to_offer_days, decay_rate_per_day } = baseline;

  // No impact if no intervention or missing baseline
  if (hm_feedback_hours_saved === 0 || current_hm_latency_hours === null || time_to_offer_days === null) {
    return { accept_rate_delta: 0, time_to_offer_delta: 0 };
  }

  // Can't reduce more than current latency
  const effective_hours_saved = Math.min(hm_feedback_hours_saved, current_hm_latency_hours);

  // Convert hours to days (typically 2-3 HM touchpoints)
  const hm_touchpoints = 2.5;
  const days_saved = (effective_hours_saved / 24) * hm_touchpoints;

  // Calculate accept rate impact
  let accept_rate_delta = 0;
  if (decay_rate_per_day !== null) {
    accept_rate_delta = days_saved * decay_rate_per_day;
    // Cap at 10% from HM latency alone
    accept_rate_delta = Math.min(accept_rate_delta, 0.10);
  }

  return {
    accept_rate_delta: Math.max(0, accept_rate_delta),
    time_to_offer_delta: -days_saved,
  };
}

/**
 * Calculate impact from adding pipeline
 *
 * Model: More pipeline = more conversion opportunities
 * Uses diminishing returns so output scales smoothly across slider range
 */
function calculatePipelineImpact(
  inputs: WhatIfInputs,
  baseline: WhatIfBaseline
): { expected_hires_delta: number; pipeline_gap_delta: number } {
  const { pipeline_add_leads_per_req } = inputs;
  const { expected_hires, pipeline_gap, open_reqs } = baseline;

  // No impact if no intervention or no open reqs
  if (pipeline_add_leads_per_req === 0 || open_reqs === 0) {
    return { expected_hires_delta: 0, pipeline_gap_delta: 0 };
  }

  // Calculate slider position as fraction (0 to 1)
  const max_leads = WHATIF_INPUT_BOUNDS.pipeline_add_leads_per_req.max; // 50
  const slider_fraction = pipeline_add_leads_per_req / max_leads;

  // Apply diminishing returns curve: sqrt gives nice curve
  // At 25% slider = 50% of max impact, at 50% slider = 71% of max impact
  const diminishing_fraction = Math.sqrt(slider_fraction);

  // Max increase is 30% of current expected hires (or 3 hires if no baseline)
  const max_hires_increase = expected_hires !== null
    ? expected_hires * 0.30
    : Math.min(open_reqs * 0.15, 5);

  // Scale delta by diminishing fraction
  let expected_hires_delta = max_hires_increase * diminishing_fraction;

  // Ensure we don't exceed open reqs
  if (expected_hires !== null) {
    expected_hires_delta = Math.min(expected_hires_delta, Math.max(0, open_reqs - expected_hires));
  }

  // Pipeline gap reduction - proportional to hires increase
  let pipeline_gap_delta = 0;
  if (pipeline_gap !== null && pipeline_gap > 0) {
    // Gap closes proportionally, max 25% of current gap at max slider
    const max_gap_reduction = pipeline_gap * 0.25;
    pipeline_gap_delta = -max_gap_reduction * diminishing_fraction;
  }

  return {
    expected_hires_delta: round1(Math.max(0, expected_hires_delta)),
    pipeline_gap_delta: round1(pipeline_gap_delta),
  };
}

// ===== MAIN MODEL FUNCTION =====

/**
 * Run the What-If model
 *
 * Pure function: same inputs always produce same outputs
 * Enforces all bounds and handles missing data gracefully
 */
export function runWhatIfModel(
  inputs: WhatIfInputs,
  baseline: WhatIfBaseline
): WhatIfModelOutput {
  const unavailable_reasons: Record<string, string> = {};

  // Clamp inputs to valid bounds
  const safe_inputs: WhatIfInputs = {
    offer_speed_days_faster: clamp(
      Math.round(inputs.offer_speed_days_faster),
      WHATIF_INPUT_BOUNDS.offer_speed_days_faster.min,
      WHATIF_INPUT_BOUNDS.offer_speed_days_faster.max
    ),
    hm_feedback_hours_saved: clamp(
      Math.round(inputs.hm_feedback_hours_saved),
      WHATIF_INPUT_BOUNDS.hm_feedback_hours_saved.min,
      WHATIF_INPUT_BOUNDS.hm_feedback_hours_saved.max
    ),
    pipeline_add_leads_per_req: clamp(
      Math.round(inputs.pipeline_add_leads_per_req),
      WHATIF_INPUT_BOUNDS.pipeline_add_leads_per_req.min,
      WHATIF_INPUT_BOUNDS.pipeline_add_leads_per_req.max
    ),
  };

  // Calculate individual impacts
  const offer_speed_impact = calculateOfferSpeedImpact(safe_inputs, baseline);
  const hm_latency_impact = calculateHMLatencyImpact(safe_inputs, baseline);
  const pipeline_impact = calculatePipelineImpact(safe_inputs, baseline);

  // Combine accept rate deltas (additive, capped at 20%)
  const combined_accept_rate_delta = Math.min(
    offer_speed_impact.accept_rate_delta + hm_latency_impact.accept_rate_delta,
    0.20
  );

  // Combine time to offer deltas
  const combined_time_to_offer_delta =
    offer_speed_impact.time_to_offer_delta + hm_latency_impact.time_to_offer_delta;

  // Build projected values with bounds enforcement
  const projected: WhatIfProjected = {
    accept_rate: null,
    expected_hires: null,
    pipeline_gap: null,
    time_to_offer_days: null,
  };

  const deltas: WhatIfDeltas = {
    accept_rate_delta: null,
    expected_hires_delta: null,
    pipeline_gap_delta: null,
    time_to_offer_delta: null,
  };

  // Accept rate: bounds [0, 1]
  if (baseline.accept_rate !== null) {
    const raw_projected = baseline.accept_rate + combined_accept_rate_delta;
    projected.accept_rate = clamp(raw_projected, 0, 1);
    deltas.accept_rate_delta = round1((projected.accept_rate - baseline.accept_rate) * 100) / 100;
  } else {
    unavailable_reasons['accept_rate'] = 'No baseline accept rate data';
  }

  // Expected hires: bounds [0, open_reqs]
  if (baseline.expected_hires !== null) {
    const raw_projected = baseline.expected_hires + pipeline_impact.expected_hires_delta;
    projected.expected_hires = clamp(raw_projected, 0, baseline.open_reqs);
    deltas.expected_hires_delta = round1(projected.expected_hires - baseline.expected_hires);
  } else {
    unavailable_reasons['expected_hires'] = 'No baseline expected hires data';
  }

  // Pipeline gap: bounds [0, infinity)
  if (baseline.pipeline_gap !== null) {
    const raw_projected = baseline.pipeline_gap + pipeline_impact.pipeline_gap_delta;
    projected.pipeline_gap = Math.max(0, round1(raw_projected));
    deltas.pipeline_gap_delta = round1(projected.pipeline_gap - baseline.pipeline_gap);
  } else {
    unavailable_reasons['pipeline_gap'] = 'No baseline pipeline gap data';
  }

  // Time to offer: bounds [1, infinity)
  if (baseline.time_to_offer_days !== null) {
    const raw_projected = baseline.time_to_offer_days + combined_time_to_offer_delta;
    projected.time_to_offer_days = Math.max(1, round1(raw_projected));
    deltas.time_to_offer_delta = round1(projected.time_to_offer_days - baseline.time_to_offer_days);
  } else {
    unavailable_reasons['time_to_offer_days'] = 'No baseline time to offer data';
  }

  // Determine confidence
  const available_count = [
    baseline.accept_rate,
    baseline.expected_hires,
    baseline.pipeline_gap,
    baseline.time_to_offer_days,
  ].filter(v => v !== null).length;

  let confidence: WhatIfConfidence;
  let confidence_reason: string;

  if (available_count >= 4) {
    confidence = 'HIGH';
    confidence_reason = 'All baseline metrics available';
  } else if (available_count >= 2) {
    confidence = 'MED';
    confidence_reason = `${4 - available_count} baseline metrics unavailable`;
  } else {
    confidence = 'LOW';
    confidence_reason = 'Insufficient baseline data for reliable projections';
  }

  return {
    baseline,
    projected,
    deltas,
    confidence,
    confidence_reason,
    unavailable_reasons,
  };
}

/**
 * Create a baseline from velocity metrics context
 * This adapts the existing context to the WhatIfBaseline format
 */
export function createBaseline(context: {
  currentAcceptRate: number | null;
  currentExpectedHires: number | null;
  currentPipelineGap: number | null;
  currentTimeToOfferDays: number | null;
  openReqsCount: number;
  currentHMLatencyHours: number | null;
  decayRatePerDay: number | null;
}): WhatIfBaseline {
  return {
    accept_rate: context.currentAcceptRate,
    expected_hires: context.currentExpectedHires,
    pipeline_gap: context.currentPipelineGap,
    time_to_offer_days: context.currentTimeToOfferDays,
    open_reqs: context.openReqsCount,
    current_hm_latency_hours: context.currentHMLatencyHours,
    decay_rate_per_day: context.decayRatePerDay,
  };
}
