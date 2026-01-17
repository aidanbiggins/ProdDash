// Ask ProdDash Types
// Types for the Ask ProdDash conversational interface

// ─────────────────────────────────────────────────────────────
// Risk Types
// ─────────────────────────────────────────────────────────────

export type RiskType = 'zombie' | 'stalled' | 'pipeline_gap' | 'hm_delay' | 'offer_risk' | 'at_risk';

// ─────────────────────────────────────────────────────────────
// KPI Metric
// ─────────────────────────────────────────────────────────────

export interface KPIMetric {
  value: number | null;
  unit: string;                              // 'days', '%', 'count'
  threshold: {
    green: number;
    yellow: number;
    red: number;
  };
  status: 'green' | 'yellow' | 'red';
  n: number;                                 // Sample size
  trend: 'up' | 'down' | 'flat' | null;
}

// ─────────────────────────────────────────────────────────────
// Explain Types
// ─────────────────────────────────────────────────────────────

export interface ExplainDriver {
  factor: string;                            // "HM Screen stage"
  impact: string;                            // "adds 4.2 days on average"
  evidence_key: string;                      // Fact Pack key path
}

export interface ExplainSummary {
  metric_name: string;
  value: number | null;
  unit: string;
  top_drivers: ExplainDriver[];              // Max 3
  exclusions: string[];                      // What was excluded from calc
  confidence: 'high' | 'medium' | 'low';
  n: number;
}

// ─────────────────────────────────────────────────────────────
// Action Types
// ─────────────────────────────────────────────────────────────

export interface ActionSummary {
  action_id: string;
  title: string;
  owner_type: 'RECRUITER' | 'HIRING_MANAGER' | 'TA_OPS';
  owner_label: string;                       // "Recruiter 3" (anonymized)
  priority: 'P0' | 'P1' | 'P2';
  action_type: string;
  due_in_days: number;
  req_id: string | null;
  req_title: string | null;                  // Redacted
}

// ─────────────────────────────────────────────────────────────
// Risk Types
// ─────────────────────────────────────────────────────────────

export interface RiskSummary {
  risk_id: string;
  req_id: string;
  req_title: string;                         // Redacted
  risk_type: RiskType;
  failure_mode: string;                      // Human-readable
  days_open: number;
  candidate_count: number;
  owner_label: string;                       // "Recruiter 2" (anonymized)
  top_driver: string;                        // Main cause
}

// ─────────────────────────────────────────────────────────────
// Velocity Types
// ─────────────────────────────────────────────────────────────

export interface FunnelStage {
  stage: string;                             // Canonical stage name
  candidate_count: number;
  conversion_rate: number | null;            // To next stage, 0-1
  avg_days: number | null;
  is_bottleneck: boolean;
}

// ─────────────────────────────────────────────────────────────
// Source Types
// ─────────────────────────────────────────────────────────────

export interface SourceSummary {
  source_name: string;
  candidate_count: number;
  hire_count: number;
  conversion_rate: number | null;            // 0-1
  quality_score: number | null;              // 0-100
}

// ─────────────────────────────────────────────────────────────
// Recruiter Performance Types
// ─────────────────────────────────────────────────────────────

export interface RecruiterPerformanceSummary {
  anonymized_id: string;               // Stable ID for deep links (hash of user_id)
  anonymized_label: string;            // "Recruiter 1", "Recruiter 2", etc.
  open_reqs: number;                   // Current open requisitions
  hires_in_period: number;             // Hires during data window
  offers_in_period: number;            // Offers during data window
  avg_ttf: number | null;              // Average time to fill (days)
  active_candidates: number;           // Active candidates across all reqs
  productivity_score: number | null;   // Composite score 0-100 (hires + offers weighted)
}

// ─────────────────────────────────────────────────────────────
// Hiring Manager Ownership Types
// ─────────────────────────────────────────────────────────────

export interface HMOwnershipEntry {
  anonymized_id: string;               // Stable hash of hm_id for deep links
  hm_label: string;                    // "Manager 1", "Manager 2", etc.
  open_req_count: number;              // Number of open reqs owned
  req_ids: string[];                   // Up to 10 req IDs
  avg_hm_latency?: number | null;      // Optional: average HM latency in days
}

export interface HiringManagerOwnershipSummary {
  available: boolean;                  // Whether HM ownership data is available
  unavailable_reason?: string;         // Reason if not available
  total_hiring_managers: number;       // Total unique HMs
  open_reqs_by_hm: HMOwnershipEntry[]; // Top 10 HMs by open req count
  n: number;                           // Sample size (HMs with open reqs)
  confidence: 'high' | 'medium' | 'low';
}

// ─────────────────────────────────────────────────────────────
// Glossary Types
// ─────────────────────────────────────────────────────────────

export interface GlossaryEntry {
  term: string;
  definition: string;
  formula: string | null;
  example: string | null;
}

// ─────────────────────────────────────────────────────────────
// Bottleneck/SLA Types
// ─────────────────────────────────────────────────────────────

export interface BottleneckStageSummary {
  stage: string;                             // Canonical stage key
  display_name: string;                      // Human-readable name
  median_hours: number;                      // Median dwell time
  sla_hours: number;                         // SLA threshold
  breach_rate: number;                       // 0-1, percentage breaching
  bottleneck_score: number;                  // Composite score for ranking
}

export interface BottleneckFactPack {
  available: boolean;                        // Whether bottleneck data is available
  unavailable_reason?: string;               // Reason if not available

  /** Top 5 bottleneck stages ranked by score */
  top_stages: BottleneckStageSummary[];

  /** Summary statistics */
  summary: {
    total_breaches: number;
    total_breach_hours: number;
    breaches_by_owner_type: Record<string, number>;
    worst_stage: string | null;
    worst_owner_type: string | null;
  };

  /** Coverage status for gating */
  coverage: {
    is_sufficient: boolean;
    snapshot_count: number;
    day_span: number;
    coverage_percent: number;
  };

  /** Deep link to bottleneck page */
  deep_link: '/diagnose/bottlenecks';
}

// ─────────────────────────────────────────────────────────────
// Complete Fact Pack Structure
// ─────────────────────────────────────────────────────────────

// Active filter context for deep link preservation
export interface FilterContext {
  recruiter_ids: string[];
  date_range_start: string | null;
  date_range_end: string | null;
  date_range_preset: string | null;        // '30', '60', '90', etc.
  functions: string[];
  regions: string[];
}

export interface AskFactPack {
  // META: Dataset metadata and capability flags
  meta: {
    generated_at: string;                    // ISO timestamp
    org_id: string;
    org_name: string;                        // Redacted if needed
    data_window: {
      start_date: string;                    // ISO date
      end_date: string;                      // ISO date
      days: number;                          // Window size
    };
    sample_sizes: {
      total_reqs: number;
      total_candidates: number;
      total_hires: number;
      total_offers: number;
      total_events: number;
    };
    // Active filter context for deep link preservation
    filter_context: FilterContext;
    capability_flags: {
      has_stage_timing: boolean;             // Can show stage durations
      has_source_data: boolean;              // Source effectiveness available
      has_hm_data: boolean;                  // HM latency data available
      has_forecast_data: boolean;            // Forecast model available
      has_quality_data: boolean;             // Quality metrics available
      ai_enabled: boolean;                   // BYOK key configured & unlocked
    };
    data_health_score: number;               // 0-100
  };

  // CONTROL_TOWER: KPIs with thresholds and sample sizes
  control_tower: {
    kpis: {
      median_ttf: KPIMetric;
      offer_count: KPIMetric;
      accept_rate: KPIMetric;
      stalled_reqs: KPIMetric;
      hm_latency: KPIMetric;
    };
    risk_summary: {
      total_at_risk: number;
      by_type: Partial<Record<RiskType, number>>;
    };
    action_summary: {
      total_open: number;
      p0_count: number;
      p1_count: number;
      p2_count: number;
    };
  };

  // EXPLAIN: Pre-computed explanations for core KPIs
  explain: {
    time_to_offer: ExplainSummary;
    hm_latency: ExplainSummary;
    accept_rate: ExplainSummary;
    pipeline_health: ExplainSummary;
    source_effectiveness: ExplainSummary;
  };

  // ACTIONS: Top actions from Unified Action Queue
  actions: {
    top_p0: ActionSummary[];                 // Max 5
    top_p1: ActionSummary[];                 // Max 5
    by_owner_type: {
      recruiter: number;
      hiring_manager: number;
      ta_ops: number;
    };
  };

  // RISKS: Top risks from Control Tower (pre-mortem view)
  risks: {
    top_risks: RiskSummary[];                // Max 10
    by_failure_mode: Partial<Record<RiskType, RiskSummary[]>>;
  };

  // FORECAST: Pipeline-based predictions
  forecast: {
    expected_hires: number;
    pipeline_gap: number;                    // open_reqs - expected_hires
    confidence: 'high' | 'medium' | 'low';
    open_reqs: number;
    active_candidates: number;
    probability_weighted_pipeline: number;
  };

  // VELOCITY: Stage timing and funnel metrics
  velocity: {
    funnel: FunnelStage[];
    bottleneck_stage: string | null;
    avg_days_to_offer: number | null;
    avg_days_to_hire: number | null;
  };

  // SOURCES: Source effectiveness summary
  sources: {
    top_by_volume: SourceSummary[];          // Max 5
    top_by_conversion: SourceSummary[];      // Max 5
    total_sources: number;
  };

  // CAPACITY: Team capacity summary
  capacity: {
    total_recruiters: number;
    avg_req_load: number;
    overloaded_count: number;                // > 15 reqs
    underloaded_count: number;               // < 5 reqs
  };

  // RECRUITER_PERFORMANCE: Per-recruiter metrics (anonymized)
  recruiter_performance: {
    available: boolean;                                // Whether recruiter data is available
    unavailable_reason?: string;                       // Reason if not available
    top_by_hires: RecruiterPerformanceSummary[];      // Top 5 by hires
    top_by_productivity: RecruiterPerformanceSummary[]; // Top 5 by score
    bottom_by_productivity: RecruiterPerformanceSummary[]; // Bottom 3 (for coaching)
    team_avg_productivity: number | null;              // Average productivity score
    total_recruiters: number;                          // Total number of recruiters
    n: number;                                         // Sample size (recruiters with activity)
    confidence: 'high' | 'medium' | 'low';            // Confidence in the data
  };

  // HIRING_MANAGER_OWNERSHIP: HM req ownership metrics (anonymized)
  hiring_manager_ownership: HiringManagerOwnershipSummary;

  // BOTTLENECKS: SLA & bottleneck analysis from snapshot diffs
  bottlenecks: BottleneckFactPack;

  // GLOSSARY: Metric definitions for AI context
  glossary: GlossaryEntry[];
}

// ─────────────────────────────────────────────────────────────
// Anonymization Maps
// ─────────────────────────────────────────────────────────────

export interface AnonymizationMaps {
  recruiters: Map<string, string>;    // original_id -> "Recruiter 1"
  hms: Map<string, string>;           // original_id -> "Manager 1"
  reverse: Map<string, string>;       // "Recruiter 1" -> original_id (for deep links)
}

// ─────────────────────────────────────────────────────────────
// Intent Handler Types
// ─────────────────────────────────────────────────────────────

export interface FactCitation {
  ref: string;                    // "[1]", "[2]", etc.
  key_path: string;               // "control_tower.kpis.median_ttf"
  label: string;                  // "Median TTF: 42 days"
  value: string | number | null;  // The actual value being cited
}

export interface DeepLinkSpec {
  label: string;
  tab: string;
  params: Record<string, string>;
  highlight?: string;
}

export interface IntentResponse {
  answer_markdown: string;
  citations: FactCitation[];
  deep_links: DeepLinkSpec[];
  suggested_questions: string[];
}

export interface IntentHandler {
  intent_id: string;
  patterns: RegExp[];
  keywords: string[];
  handler: (factPack: AskFactPack) => IntentResponse;
  fact_keys_used: string[];  // Documentation of which keys this handler reads
}

// ─────────────────────────────────────────────────────────────
// AI Response Types
// ─────────────────────────────────────────────────────────────

export interface AICitation {
  ref: string;                       // "[1]", "[2]", etc.
  key_path: string;                  // Exact Fact Pack path
  label: string;                     // Human description
  value: string | number | null;     // The cited value
}

export interface AIDeepLink {
  label: string;
  tab: string;
  params: Record<string, string>;
}

export interface AskAIResponse {
  answer_markdown: string;           // Markdown with [N] citation refs
  citations: AICitation[];           // REQUIRED - at least 1
  suggested_questions: string[];     // Max 3
  deep_links: AIDeepLink[];          // Navigation suggestions
}

// ─────────────────────────────────────────────────────────────
// Validation Types
// ─────────────────────────────────────────────────────────────

export type AskValidationErrorType =
  | 'MISSING_CITATIONS'
  | 'INVALID_KEY_PATH'
  | 'VALUE_MISMATCH'
  | 'HALLUCINATED_NUMBER'
  | 'UNRESOLVABLE_DEEP_LINK';

export interface AskValidationError {
  type: AskValidationErrorType;
  message: string;
  citation_ref?: string;
}

export interface AskValidationResult {
  valid: boolean;
  errors: AskValidationError[];
  fallback_triggered: boolean;
}

// ─────────────────────────────────────────────────────────────
// Deep Link Types
// ─────────────────────────────────────────────────────────────

export interface DeepLinkResult {
  url: string;
  tab: string;
  params: Record<string, string>;
  highlightSelector?: string;
}
