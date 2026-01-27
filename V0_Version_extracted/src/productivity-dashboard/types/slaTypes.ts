// types/slaTypes.ts
// SLA Attribution V1 - Type definitions for SLA tracking and bottleneck analysis

/**
 * Owner type for SLA attribution
 */
export type SlaOwnerType = 'HM' | 'RECRUITER' | 'OPS' | 'UNKNOWN';

/**
 * Confidence level for attribution
 */
export type AttributionConfidence = 'high' | 'medium' | 'low';

/**
 * SLA Policy - Defines time limits per stage
 * Stored in organization config (org_settings.sla_policies) in V2
 * V1: Hardcoded defaults
 */
export interface SlaPolicy {
  /** Canonical stage key (e.g., 'HM_SCREEN', 'OFFER') */
  stage_key: string;

  /** Maximum hours allowed in this stage before breach */
  sla_hours: number;

  /** Default owner responsible for this stage */
  owner_type: SlaOwnerType;

  /** Whether this SLA is actively tracked */
  enabled: boolean;

  /** Human-readable stage name for display */
  display_name: string;
}

/**
 * Default SLA policies (V1 hardcoded, V2 org-configurable)
 */
export const DEFAULT_SLA_POLICIES: SlaPolicy[] = [
  { stage_key: 'SCREEN', sla_hours: 48, owner_type: 'RECRUITER', enabled: true, display_name: 'Recruiter Screen' },
  { stage_key: 'HM_SCREEN', sla_hours: 72, owner_type: 'HM', enabled: true, display_name: 'HM Screen' },
  { stage_key: 'ONSITE', sla_hours: 120, owner_type: 'HM', enabled: true, display_name: 'Onsite Interview' },
  { stage_key: 'FINAL', sla_hours: 48, owner_type: 'HM', enabled: true, display_name: 'Final Decision' },
  { stage_key: 'OFFER', sla_hours: 72, owner_type: 'RECRUITER', enabled: true, display_name: 'Offer Stage' },
];

/**
 * Stage to owner type mapping for attribution
 */
export const STAGE_OWNER_MAP: Record<string, SlaOwnerType> = {
  LEAD: 'OPS',
  APPLIED: 'RECRUITER',
  SCREEN: 'RECRUITER',
  HM_SCREEN: 'HM',
  ONSITE: 'HM',
  FINAL: 'HM',
  OFFER: 'RECRUITER',
  HIRED: 'OPS',
  REJECTED: 'RECRUITER',
  WITHDRAWN: 'OPS',
};

/**
 * Measured dwell time for a candidate in a specific stage
 * Computed from snapshot diff events
 */
export interface StageDwellMetric {
  /** Requisition ID */
  req_id: string;

  /** Candidate ID */
  candidate_id: string;

  /** Canonical stage key */
  stage_key: string;

  /** When candidate entered this stage (from STAGE_CHANGE event) */
  entered_at: Date;

  /** When candidate exited this stage (null if still in stage) */
  exited_at: Date | null;

  /** Total hours in stage (computed or ongoing) */
  dwell_hours: number;

  /** Whether SLA was breached */
  breached: boolean;

  /** Hours over SLA limit (0 if not breached) */
  breach_hours: number;

  /** Applicable SLA policy (null if no policy for this stage) */
  sla_policy: SlaPolicy | null;

  // === Attribution ===

  /** Who is responsible for this stage's time */
  attribution_owner_type: SlaOwnerType;

  /** Attribution owner ID (HM user_id, recruiter user_id, or null for OPS) */
  attribution_owner_id: string | null;

  /** Attribution owner name for display */
  attribution_owner_name: string | null;

  /** Confidence in attribution */
  attribution_confidence: AttributionConfidence;

  /** Reasons for attribution decision */
  attribution_reasons: string[];

  // === Provenance ===

  /** Event ID that started this dwell period */
  enter_event_id: string | null;

  /** Event ID that ended this dwell period */
  exit_event_id: string | null;

  /** Whether this is from snapshot diff (true) or inferred (false) */
  is_observed: boolean;

  // === Regression tracking ===

  /** Whether this is a re-entry to a previously visited stage */
  is_reentry: boolean;

  /** Which visit number this is (1 = first visit) */
  visit_number: number;

  /** Whether a regression occurred during this dwell period */
  has_regression: boolean;
}

/**
 * Aggregated bottleneck statistics for a stage
 */
export interface StageBottleneck {
  /** Canonical stage key */
  stage_key: string;

  /** Human-readable stage name */
  display_name: string;

  /** Median dwell hours across all candidates */
  median_dwell_hours: number;

  /** P90 dwell hours */
  p90_dwell_hours: number;

  /** Total candidates measured in this stage */
  candidate_count: number;

  /** Candidates who breached SLA */
  breach_count: number;

  /** Breach rate (0-1) */
  breach_rate: number;

  /** Total hours lost to breaches */
  total_breach_hours: number;

  /** Default owner type for this stage */
  owner_type: SlaOwnerType;

  /** Bottleneck score (higher = worse, for ranking) */
  bottleneck_score: number;
}

/**
 * Owner-level breach aggregation
 */
export interface OwnerBreachSummary {
  /** Owner type */
  owner_type: SlaOwnerType;

  /** Owner ID (user_id) */
  owner_id: string;

  /** Owner name for display */
  owner_name: string;

  /** Total breaches attributed to this owner */
  breach_count: number;

  /** Total breach hours */
  total_breach_hours: number;

  /** Average breach hours per instance */
  avg_breach_hours: number;

  /** Stages where breaches occurred */
  breach_stages: string[];

  /** Requisitions with breaches */
  req_ids: string[];
}

/**
 * Requisition-level breach summary
 */
export interface ReqBreachSummary {
  req_id: string;
  req_title: string;
  recruiter_id: string | null;
  recruiter_name: string | null;
  hiring_manager_id: string | null;
  hiring_manager_name: string | null;

  /** Total breaches on this req */
  breach_count: number;

  /** Total breach hours */
  total_breach_hours: number;

  /** Worst breach stage */
  worst_stage: string;

  /** Worst breach hours */
  worst_breach_hours: number;

  /** Days req has been open */
  days_open: number;

  /** Current pipeline count */
  candidate_count: number;
}

/**
 * Coverage statistics for gating
 */
export interface SnapshotCoverage {
  /** Total snapshots in date range */
  snapshot_count: number;

  /** Total diff events generated */
  event_count: number;

  /** Oldest snapshot date */
  oldest_snapshot: Date | null;

  /** Newest snapshot date */
  newest_snapshot: Date | null;

  /** Days spanned by snapshots */
  day_span: number;

  /** Average days between snapshots */
  avg_gap_days: number;

  /** Percentage of days with snapshots */
  coverage_percent: number;

  /** Whether coverage is sufficient for SLA tracking */
  is_sufficient: boolean;

  /** Reasons if insufficient */
  insufficiency_reasons: string[];
}

/**
 * Complete bottleneck summary
 */
export interface BottleneckSummary {
  /** Top bottleneck stages ranked by score */
  top_stages: StageBottleneck[];

  /** Top reqs by breach hours */
  top_reqs: ReqBreachSummary[];

  /** Owner leaderboard (aggregated HMs) */
  top_owners: OwnerBreachSummary[];

  /** Breach counts by stage */
  breach_counts: Record<string, number>;

  /** Breach counts by owner type */
  breach_by_owner_type: Record<SlaOwnerType, number>;

  /** Coverage statistics */
  coverage: SnapshotCoverage;

  /** Date range for this summary */
  date_range: {
    start: Date;
    end: Date;
  };

  /** Total candidates analyzed */
  total_candidates_analyzed: number;

  /** Total dwell records */
  total_dwell_records: number;

  /** Computation timestamp */
  computed_at: Date;
}

/**
 * Attribution result from delay attribution
 */
export interface AttributionResult {
  owner_type: SlaOwnerType;
  owner_id: string | null;
  owner_name: string | null;
  confidence: AttributionConfidence;
  reasons: string[];
}

/**
 * Internal type for building dwell periods
 */
export interface StageDwellPeriod {
  stage_key: string;
  entered_at: Date;
  exited_at: Date | null;
  enter_event_id: string | null;
  exit_event_id: string | null;
}

/**
 * Dwell period with regression tracking
 */
export interface DwellPeriodWithRegressions extends StageDwellPeriod {
  is_reentry: boolean;
  visit_number: number;
  has_regression: boolean;
  regression_count: number;
}

/**
 * Thresholds for SLA Attribution feature
 */
export const SLA_THRESHOLDS = {
  /** Minimum snapshots required for any dwell calculation */
  MIN_SNAPSHOTS_FOR_DWELL: 2,

  /** Minimum day span for SLA tracking to be meaningful */
  MIN_DAYS_SPAN_FOR_SLA: 7,

  /** Maximum gap between snapshots (days) before warning */
  MAX_SNAPSHOT_GAP_DAYS: 3,

  /** Minimum candidates per stage for bottleneck ranking */
  MIN_CANDIDATES_PER_STAGE: 5,

  /** Minimum coverage percentage for confident reporting */
  MIN_COVERAGE_PERCENT: 50,

  /** Minimum breaches to show owner in leaderboard */
  MIN_BREACHES_FOR_LEADERBOARD: 3,
} as const;

/**
 * Terminal stages that don't need dwell tracking
 */
export const TERMINAL_STAGES = ['HIRED', 'REJECTED', 'WITHDRAWN'] as const;
export type TerminalStage = typeof TERMINAL_STAGES[number];

/**
 * Check if a stage is terminal
 */
export function isTerminalStage(stage: string): stage is TerminalStage {
  return TERMINAL_STAGES.includes(stage as TerminalStage);
}
