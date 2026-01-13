/**
 * Velocity Copilot Types
 * Types for AI-powered velocity insights and the VelocityFactPack
 */

// ===== VELOCITY FACT PACK =====

/**
 * VelocityFactPack - Deterministic, redacted data structure used for AI and fallback
 * Contains all facts needed to generate insights, with NO PII
 */
export interface VelocityFactPack {
  // === Metadata ===
  metadata: {
    generated_at: string;  // ISO timestamp
    date_range: {
      start: string;  // ISO date
      end: string;    // ISO date
    };
    data_quality: 'HIGH' | 'MED' | 'LOW' | 'INSUFFICIENT';
  };

  // === Sample Sizes ===
  sample_sizes: {
    total_offers: number;
    total_accepted: number;
    total_reqs: number;
    total_filled: number;
    total_hires: number;
    fast_hires_cohort: number;
    slow_hires_cohort: number;
  };

  // === KPIs ===
  kpis: {
    median_ttf_days: number | null;
    offer_accept_rate: number | null;  // 0-1
    overall_fill_rate: number | null;  // 0-1
    decay_rate_per_day: number | null;  // For offers
    req_decay_rate_per_day: number | null;  // For reqs
    decay_start_day: number | null;
  };

  // === Stage Timing ===
  stage_timing: {
    capability: 'POINT_IN_TIME' | 'SNAPSHOT_DIFF' | 'TIMESTAMP_ONLY' | 'NONE';
    can_show_duration: boolean;
    reason: string;
  };

  // === Decay Curves ===
  candidate_decay: {
    available: boolean;
    gating_reason?: string;
    buckets: Array<{
      label: string;
      count: number;
      rate: number;  // 0-1
    }>;
  };

  req_decay: {
    available: boolean;
    gating_reason?: string;
    buckets: Array<{
      label: string;
      count: number;
      rate: number;  // 0-1
    }>;
  };

  // === Fast vs Slow Comparison ===
  cohort_comparison: {
    available: boolean;
    gating_reason?: string;
    fast_hires?: {
      count: number;
      avg_ttf: number;
      median_ttf: number;
      referral_percent: number;
      avg_pipeline_depth: number;
      avg_interviews_per_hire: number;
    };
    slow_hires?: {
      count: number;
      avg_ttf: number;
      median_ttf: number;
      referral_percent: number;
      avg_pipeline_depth: number;
      avg_interviews_per_hire: number;
    };
    factors?: Array<{
      name: string;
      fast_value: string;
      slow_value: string;
      delta: string;
      impact: 'high' | 'medium' | 'low';
    }>;
  };

  // === Top Bottleneck Stages ===
  bottleneck_stages: Array<{
    stage: string;
    avg_days: number;
    count: number;
  }>;

  // === Contributing Req IDs (redacted - just IDs, no titles with PII) ===
  contributing_reqs: {
    stalled_req_ids: string[];
    zombie_req_ids: string[];
    slow_fill_req_ids: string[];
    fast_fill_req_ids: string[];
  };

  // === Metric Definitions ===
  definitions: {
    median_ttf: string;
    offer_accept_rate: string;
    decay_rate: string;
    fast_hires: string;
    slow_hires: string;
  };

  // === Existing Insights (deterministic) ===
  deterministic_insights: Array<{
    title: string;
    type: 'warning' | 'success' | 'info';
    description: string;
    sample_size: number;
    confidence: 'HIGH' | 'MED' | 'LOW' | 'INSUFFICIENT';
    so_what?: string;
    next_step?: string;
  }>;
}

// ===== AI COPILOT INSIGHT =====

/**
 * AI-generated insight with citations
 */
export interface AICopilotInsight {
  id: string;
  title: string;
  severity: 'P0' | 'P1' | 'P2';
  claim: string;  // 1 sentence
  why_now: string;  // 1 sentence
  recommended_actions: string[];  // 1-3 bullets
  citations: string[];  // Fact paths like "kpis.median_ttf_days", "sample_sizes.total_offers"
  deep_link_params?: {
    insight_type?: string;
    metric_key?: string;
    filter?: Record<string, unknown>;
    sample_size?: number;
  };
}

/**
 * Response from AI copilot
 */
export interface AICopilotResponse {
  insights: AICopilotInsight[];
  model_used: string;
  generated_at: string;
  latency_ms: number;
  tokens_used?: number;
  error?: string;
}

/**
 * Deterministic summary (no AI needed)
 */
export interface DeterministicSummary {
  insights: AICopilotInsight[];
  generated_at: string;
}

// ===== DRAFT MESSAGE =====

/**
 * Draft message for action owner
 */
export interface DraftMessage {
  channel: 'slack' | 'email';
  recipient_role: string;  // e.g., "Hiring Manager", "Recruiter"
  subject?: string;  // For email
  body: string;
  insight_context: string;  // Redacted context used to generate
}

// ===== VALIDATION =====

/**
 * Result of validating AI response citations
 */
export interface CitationValidationResult {
  valid: boolean;
  invalid_citations: string[];
  missing_citations: boolean;
  error?: string;
}

// ===== CONSTANTS =====

/**
 * Valid fact paths in VelocityFactPack for citation validation
 */
export const VALID_FACT_PATHS = [
  'metadata.generated_at',
  'metadata.date_range.start',
  'metadata.date_range.end',
  'metadata.data_quality',
  'sample_sizes.total_offers',
  'sample_sizes.total_accepted',
  'sample_sizes.total_reqs',
  'sample_sizes.total_filled',
  'sample_sizes.total_hires',
  'sample_sizes.fast_hires_cohort',
  'sample_sizes.slow_hires_cohort',
  'kpis.median_ttf_days',
  'kpis.offer_accept_rate',
  'kpis.overall_fill_rate',
  'kpis.decay_rate_per_day',
  'kpis.req_decay_rate_per_day',
  'kpis.decay_start_day',
  'stage_timing.capability',
  'stage_timing.can_show_duration',
  'stage_timing.reason',
  'candidate_decay.available',
  'candidate_decay.gating_reason',
  'candidate_decay.buckets',
  'req_decay.available',
  'req_decay.gating_reason',
  'req_decay.buckets',
  'cohort_comparison.available',
  'cohort_comparison.gating_reason',
  'cohort_comparison.fast_hires',
  'cohort_comparison.slow_hires',
  'cohort_comparison.factors',
  'bottleneck_stages',
  'contributing_reqs.stalled_req_ids',
  'contributing_reqs.zombie_req_ids',
  'contributing_reqs.slow_fill_req_ids',
  'contributing_reqs.fast_fill_req_ids',
  'definitions.median_ttf',
  'definitions.offer_accept_rate',
  'definitions.decay_rate',
  'definitions.fast_hires',
  'definitions.slow_hires',
  'deterministic_insights',
] as const;

export type ValidFactPath = typeof VALID_FACT_PATHS[number];
